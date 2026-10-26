import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflare, runWrangler } from './lib/wrangler.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'node_modules/onnxruntime-web/dist');
const files = readdirSync(dist).filter((name) => name.startsWith('ort-wasm-simd-threaded.'));
if (files.length === 0) {
  console.error('No ONNX Runtime wasm files found. Install dependencies first.');
  process.exit(1);
}

function contentType(name) {
  if (name.endsWith('.wasm')) return 'application/wasm';
  if (name.endsWith('.mjs') || name.endsWith('.js')) return 'application/javascript';
  return 'application/octet-stream';
}

for (const name of files) {
  const filePath = join(dist, name);
  const key = `${cloudflare.ortPrefix}/${name}`;
  console.log(`Uploading ${key} (${statSync(filePath).size} bytes, ${contentType(name)})`);
  runWrangler([
    'r2',
    'object',
    'put',
    `${cloudflare.bucket}/${key}`,
    '--file',
    filePath,
    '--content-type',
    contentType(name),
    '--cache-control',
    'public, max-age=31536000, immutable',
    '--remote',
    '--force',
  ]);
}

console.log(`Uploaded ONNX Runtime files to r2://${cloudflare.bucket}/${cloudflare.ortPrefix}/`);
console.log(`Set PUBLIC_ORT_BASE_URL=${cloudflare.ortBaseUrl} and rebuild so WebGPU can load the files that exceed the Pages 25 MiB asset limit.`);
