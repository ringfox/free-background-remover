export type EngineName = 'webgpu' | 'wasm';

export interface InferenceProgress {
  phase: 'download' | 'verify' | 'session' | 'inference';
  loaded: number;
  total: number;
  message: string;
  cached: boolean;
}

export interface InferenceResult {
  alpha: Uint8Array;
  ep: EngineName;
}

interface WorkerProgress {
  type: 'progress';
  requestId: number;
  phase: InferenceProgress['phase'];
  loaded: number;
  total: number;
  message: string;
  cached: boolean;
}

interface WorkerResult {
  type: 'result';
  requestId: number;
  alpha: ArrayBuffer;
  ep: EngineName;
}

interface WorkerError {
  type: 'error';
  requestId: number;
  message: string;
}

type WorkerOut = WorkerProgress | WorkerResult | WorkerError;

interface Pending {
  onProgress: (progress: InferenceProgress) => void;
  resolve: (result: InferenceResult) => void;
  reject: (error: Error) => void;
}

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

/** Mock mattes exist only in `astro dev`. Production builds eliminate the branch. */
export function mockInferenceAllowed(): boolean {
  return import.meta.env.DEV;
}

/**
 * Owns the inference worker. The worker (and ONNX Runtime) is created on the first process() call.
 */
export function createInferenceClient() {
  let worker: Worker | null = null;
  let requestSerial = 0;
  const pending = new Map<number, Pending>();

  function ensureWorker(): Worker {
    if (worker) return worker;
    worker = new Worker(new URL('../workers/inference.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerOut>) => {
      const message = event.data;
      const job = pending.get(message.requestId);
      if (!job) return;
      if (message.type === 'progress') {
        job.onProgress(message);
        return;
      }
      pending.delete(message.requestId);
      if (message.type === 'error') {
        job.reject(new Error(message.message));
        return;
      }
      job.resolve({ alpha: new Uint8Array(message.alpha), ep: message.ep });
    };
    worker.onerror = (event) => {
      const message = event.message || 'The background removal worker failed to start.';
      for (const [id, job] of pending) {
        pending.delete(id);
        job.reject(new Error(message));
      }
    };
    return worker;
  }

  function process(options: {
    baseUrl: string;
    ortBaseUrl: string;
    pixels: Uint8Array;
    width: number;
    height: number;
    mock: boolean;
    onProgress: (progress: InferenceProgress) => void;
  }): { requestId: number; done: Promise<InferenceResult> } {
    const requestId = ++requestSerial;
    for (const [id, job] of pending) {
      pending.delete(id);
      job.reject(new CancelledError());
    }
    const done = new Promise<InferenceResult>((resolve, reject) => {
      pending.set(requestId, { resolve, reject, onProgress: options.onProgress });
    });
    const pixels = new Uint8Array(options.pixels);
    ensureWorker().postMessage(
      {
        type: 'process',
        requestId,
        baseUrl: options.baseUrl,
        ortBaseUrl: options.ortBaseUrl,
        pixels: pixels.buffer,
        width: options.width,
        height: options.height,
        mock: options.mock,
      },
      [pixels.buffer],
    );
    return { requestId, done };
  }

  function dispose(): void {
    for (const [id, job] of pending) {
      pending.delete(id);
      job.reject(new CancelledError());
    }
    worker?.terminate();
    worker = null;
  }

  return { process, dispose };
}
