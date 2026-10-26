import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from '../model/manifest.json' with { type: 'json' };
import { verifyPartFile } from './lib/verify-parts.mjs';
import { cloudflare, runWrangler } from './lib/wrangler.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, '.model-cache');

for (const part of manifest.parts) {
  const filePath = join(dir, part.file);
  const error = await verifyPartFile(filePath, part);
  if (error) {
    console.error(error);
    console.error('Run npm run model:download before uploading.');
    process.exit(1);
  }
  const key = `${cloudflare.modelPrefix}/${part.file}`;
  console.log(`Uploading ${key}`);
  runWrangler([
    'r2',
    'object',
    'put',
    `${cloudflare.bucket}/${key}`,
    '--file',
    filePath,
    '--content-type',
    'application/octet-stream',
    '--cache-control',
    'public, max-age=31536000, immutable',
    '--remote',
    '--force',
  ]);
}

console.log(`Uploaded model parts to r2://${cloudflare.bucket}/${cloudflare.modelPrefix}/`);
console.log(`Public base: ${cloudflare.modelBaseUrl}`);
