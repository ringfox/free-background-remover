import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflare, runWrangler } from './lib/wrangler.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'infra/r2-cors.json');

console.log(`Applying CORS to ${cloudflare.bucket}. This overwrites the bucket policy.`);
runWrangler(['r2', 'bucket', 'cors', 'set', cloudflare.bucket, '--file', file, '--force']);
console.log('Confirm with: npx wrangler r2 bucket cors list', cloudflare.bucket);
