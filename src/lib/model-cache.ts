import { asArrayBuffer, concatBytes, sha256Hex } from './bytes';
import { manifest, MODEL_BYTES, type ModelManifest } from './manifest';
import { modelPartUrl } from './model-url';

export interface PartProgress {
  loaded: number;
  total: number;
  file: string;
  cached: boolean;
  stage: 'fetch' | 'checksum' | 'cache';
}

const DB_NAME = 'clearframe-isnet';
const STORE = 'parts';

function partKey(sha256: string): string {
  return `${manifest.cacheVersion}:${sha256}`;
}

function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (value instanceof Uint8Array) return asArrayBuffer(value);
  return null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the model cache.'));
  });
}

async function readIdb(key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not read the model cache.'));
    });
    return toArrayBuffer(value);
  } catch {
    return null;
  }
}

async function writeIdb(key: string, bytes: ArrayBuffer): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(bytes, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not store the model.'));
    });
  } catch {
    // The session can continue when persistent storage is unavailable.
  }
}

async function deleteIdb(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore.
  }
}

async function readCache(url: string): Promise<ArrayBuffer | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(manifest.cacheVersion);
    const match = await cache.match(url);
    if (!match) return null;
    return await match.arrayBuffer();
  } catch {
    return null;
  }
}

async function writeCache(url: string, bytes: ArrayBuffer): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(manifest.cacheVersion);
    await cache.put(
      url,
      new Response(bytes.slice(0), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(bytes.byteLength),
        },
      }),
    );
  } catch {
    // Ignore quota and private-mode failures.
  }
}

async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number) => void,
): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(
      'Could not reach the model host. Check PUBLIC_MODEL_BASE_URL, your connection, and the bucket CORS policy (GET and HEAD).',
    );
  }
  if (!response.ok) {
    throw new Error(
      `Could not download the model (${response.status}). Check PUBLIC_MODEL_BASE_URL and that the R2 objects are public.`,
    );
  }
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress(buffer.byteLength);
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded);
  }
  return asArrayBuffer(concatBytes(chunks));
}

async function expectPart(bytes: ArrayBuffer, part: ModelManifest['parts'][number]): Promise<void> {
  if (bytes.byteLength !== part.bytes) {
    throw new Error(`${part.file} is ${bytes.byteLength} bytes; expected ${part.bytes}. The file looks truncated.`);
  }
  const hash = await sha256Hex(bytes);
  if (hash !== part.sha256) {
    throw new Error(`${part.file} failed its checksum. The download was not used.`);
  }
}

async function loadPart(
  part: ModelManifest['parts'][number],
  baseUrl: string,
  origin: string,
  completed: number,
  onProgress: (progress: PartProgress) => void,
): Promise<Uint8Array> {
  const url = modelPartUrl(baseUrl, part.file, origin);
  const key = partKey(part.sha256);
  const report = (loaded: number, cached: boolean, stage: PartProgress['stage']) => {
    onProgress({
      loaded: completed + Math.min(loaded, part.bytes),
      total: MODEL_BYTES,
      file: part.file,
      cached,
      stage,
    });
  };

  const cachedIdb = await readIdb(key);
  if (cachedIdb && cachedIdb.byteLength === part.bytes) {
    report(part.bytes, true, 'checksum');
    try {
      await expectPart(cachedIdb, part);
      return new Uint8Array(cachedIdb);
    } catch {
      await deleteIdb(key);
    }
  }

  const cachedHttp = await readCache(url);
  if (cachedHttp && cachedHttp.byteLength === part.bytes) {
    report(part.bytes, true, 'checksum');
    try {
      await expectPart(cachedHttp, part);
      await writeIdb(key, cachedHttp);
      return new Uint8Array(cachedHttp);
    } catch {
      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open(manifest.cacheVersion);
          await cache.delete(url);
        } catch {
          // Fetch a fresh copy below.
        }
      }
    }
  }

  const downloaded = await fetchWithProgress(url, (loaded) => report(loaded, false, 'fetch'));
  report(part.bytes, false, 'checksum');
  await expectPart(downloaded, part);
  await Promise.all([writeIdb(key, downloaded), writeCache(url, downloaded)]);
  report(part.bytes, false, 'cache');
  return new Uint8Array(downloaded);
}

export async function loadModelBytes(
  baseUrl: string,
  origin: string,
  onProgress: (progress: PartProgress) => void,
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let completed = 0;
  for (const part of manifest.parts) {
    const bytes = await loadPart(part, baseUrl, origin, completed, onProgress);
    completed += part.bytes;
    parts.push(bytes);
  }
  return concatBytes(parts);
}
