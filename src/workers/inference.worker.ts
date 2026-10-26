import { asArrayBuffer } from '../lib/bytes';
import { manifest } from '../lib/manifest';
import { matteToAlpha, rgbaToNchw } from '../lib/matte';
import { loadModelBytes } from '../lib/model-cache';
import { runtimeBaseUrl } from '../lib/model-url';

interface WorkerScope {
  location: { origin: string };
  navigator: Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } };
  postMessage: (message: OutMessage, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<InMessage>) => void) | null;
}

type EngineName = 'webgpu' | 'wasm';

interface ProcessMessage {
  type: 'process';
  requestId: number;
  baseUrl: string;
  ortBaseUrl: string;
  pixels: ArrayBuffer;
  width: number;
  height: number;
  mock: boolean;
}

type InMessage = ProcessMessage;

type OutMessage =
  | {
      type: 'progress';
      requestId: number;
      phase: 'download' | 'verify' | 'session' | 'inference';
      loaded: number;
      total: number;
      message: string;
      cached: boolean;
    }
  | { type: 'result'; requestId: number; alpha: ArrayBuffer; ep: EngineName }
  | { type: 'error'; requestId: number; message: string };

const scope = globalThis as unknown as WorkerScope;

let sessionPromise: Promise<{ session: OrtSession; ort: OrtNamespace; ep: EngineName }> | null = null;
let ortBase = '/ort/';

interface OrtSession {
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: ArrayLike<number> }>>;
}

interface OrtNamespace {
  env: { wasm: { numThreads: number; wasmPaths: string; proxy?: boolean }; logLevel: string };
  InferenceSession: {
    create(
      model: Uint8Array,
      options: { executionProviders: string[]; graphOptimizationLevel: 'all' },
    ): Promise<OrtSession>;
  };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
}

function post(message: OutMessage, transfer: Transferable[] = []): void {
  scope.postMessage(message, transfer);
}

function configureOrt(ort: OrtNamespace): void {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = runtimeBaseUrl(ortBase, scope.location.origin);
  ort.env.logLevel = 'error';
}

async function importOrt(ep: EngineName): Promise<OrtNamespace> {
  const ort = (
    ep === 'webgpu' ? await import('onnxruntime-web/webgpu') : await import('onnxruntime-web/wasm')
  ) as unknown as OrtNamespace;
  configureOrt(ort);
  return ort;
}

async function webGpuAvailable(): Promise<boolean> {
  const gpu = (scope.navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

async function createSession(
  baseUrl: string,
  requestId: number,
): Promise<{ session: OrtSession; ort: OrtNamespace; ep: EngineName }> {
  post({
    type: 'progress',
    requestId,
    phase: 'download',
    loaded: 0,
    total: manifest.parts.reduce((sum, part) => sum + part.bytes, 0),
    message: 'Downloading the segmentation model…',
    cached: false,
  });

  let usedCache = true;
  const model = await loadModelBytes(baseUrl, scope.location.origin, (part) => {
    if (!part.cached) usedCache = false;
    const message =
      part.stage === 'checksum'
        ? `Checking ${part.file}`
        : part.cached
          ? `Using cached ${part.file}`
          : `Downloading ${part.file}`;
    post({
      type: 'progress',
      requestId,
      phase: part.stage === 'checksum' ? 'verify' : 'download',
      loaded: part.loaded,
      total: part.total,
      message,
      cached: usedCache,
    });
  });

  post({
    type: 'progress',
    requestId,
    phase: 'session',
    loaded: 1,
    total: 1,
    message: 'Starting the on-device runtime…',
    cached: false,
  });

  const preferWebGpu = await webGpuAvailable();
  if (preferWebGpu) {
    try {
      const ort = await importOrt('webgpu');
      const session = await ort.InferenceSession.create(model, {
        executionProviders: ['webgpu'],
        graphOptimizationLevel: 'all',
      });
      return { session, ort, ep: 'webgpu' };
    } catch (error) {
      console.warn('WebGPU session failed, falling back to WASM.', error);
    }
  }

  const ort = await importOrt('wasm');
  const session = await ort.InferenceSession.create(model, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  return { session, ort, ep: 'wasm' };
}

function circleAlpha(size: number): Uint8Array {
  const alpha = new Uint8Array(size * size);
  const center = (size - 1) / 2;
  const radius = size * 0.32;
  const radiusSquared = radius * radius;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      alpha[y * size + x] = dx * dx + dy * dy <= radiusSquared ? 255 : 0;
    }
  }
  return alpha;
}

async function runInference(message: ProcessMessage): Promise<void> {
  if (message.width !== manifest.inputSize || message.height !== manifest.inputSize) {
    throw new Error(`The model input must be ${manifest.inputSize}×${manifest.inputSize}.`);
  }

  if (message.mock) {
    if (!import.meta.env.DEV) {
      throw new Error('Mock inference is disabled.');
    }
    post({
      type: 'progress',
      requestId: message.requestId,
      phase: 'inference',
      loaded: 1,
      total: 1,
      message: 'Removing the background…',
      cached: false,
    });
    const alpha = circleAlpha(message.width);
    const alphaBuffer = asArrayBuffer(alpha);
    post({ type: 'result', requestId: message.requestId, alpha: alphaBuffer, ep: 'wasm' }, [alphaBuffer]);
    return;
  }

  if (!message.baseUrl.trim()) {
    throw new Error(
      'Model base URL is not configured. Set PUBLIC_MODEL_BASE_URL to your R2 public URL (trailing slash optional).',
    );
  }

  ortBase = message.ortBaseUrl.trim() || '/ort/';
  if (!sessionPromise) {
    sessionPromise = createSession(message.baseUrl, message.requestId).catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }
  const { session, ort, ep } = await sessionPromise;

  post({
    type: 'progress',
    requestId: message.requestId,
    phase: 'inference',
    loaded: 0,
    total: 1,
    message: 'Removing the background…',
    cached: false,
  });

  const pixels = new Uint8ClampedArray(message.pixels);
  const nchw = rgbaToNchw(pixels, message.width, message.height);
  const tensor = new ort.Tensor('float32', nchw, [1, 3, message.width, message.height]);
  const outputs = await session.run({ [manifest.inputName]: tensor });
  const output = outputs[manifest.outputName];
  if (!output) {
    throw new Error(`The model did not return ${manifest.outputName}.`);
  }
  const alpha = matteToAlpha(output.data);
  if (alpha.length !== message.width * message.height) {
    throw new Error(`Unexpected matte length ${alpha.length}.`);
  }
  const alphaBuffer = asArrayBuffer(alpha);
  post({ type: 'result', requestId: message.requestId, alpha: alphaBuffer, ep }, [alphaBuffer]);
}

let queue: Promise<void> = Promise.resolve();

scope.onmessage = (event: MessageEvent<InMessage>) => {
  const message = event.data;
  if (!message || message.type !== 'process') return;
  queue = queue.then(async () => {
    try {
      await runInference(message);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : 'Background removal failed.';
      post({ type: 'error', requestId: message.requestId, message: text });
    }
  });
};
