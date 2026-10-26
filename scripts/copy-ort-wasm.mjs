import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cloudflare from '../infra/cloudflare.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'node_modules/onnxruntime-web/dist');
const dest = join(root, 'public/ort');
const pagesSafe = process.argv.includes('--pages-safe');
const limit = cloudflare.pagesAssetLimitBytes;

if (!statSync(dist, { throwIfNoEntry: false })) {
  console.error('onnxruntime-web is not installed.');
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

const names = readdirSync(dist).filter((name) => name.startsWith('ort-wasm-simd-threaded.'));
const skipped = [];
let copied = 0;
for (const name of names) {
  const from = join(dist, name);
  const size = statSync(from).size;
  if (pagesSafe && size >= limit) {
    skipped.push(`${name} (${size} bytes)`);
    continue;
  }
  cpSync(from, join(dest, name));
  copied += 1;
}

console.log(`Copied ${copied} ONNX Runtime files to public/ort`);
if (skipped.length > 0) {
  console.log('Left out of the Pages build because a single asset must be under 25 MiB:');
  for (const line of skipped) console.log(`  ${line}`);
  console.log('WASM still runs from the smaller runtime shipped on Pages.');
  console.log(`For WebGPU, run npm run runtime:upload and set PUBLIC_ORT_BASE_URL=${cloudflare.ortBaseUrl}`);
}
