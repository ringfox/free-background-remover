import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from '../model/manifest.json' with { type: 'json' };
import { verifyPartFile } from './lib/verify-parts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const urlFlag = process.argv.indexOf('--url');
const remoteBase = urlFlag >= 0 ? process.argv[urlFlag + 1] : '';
const dirFlag = process.argv.indexOf('--dir');
const dir = dirFlag >= 0 ? process.argv[dirFlag + 1] : join(root, '.model-cache');

if (urlFlag >= 0 && !remoteBase) {
  console.error('Pass a base URL after --url');
  process.exit(1);
}

const errors = [];
if (remoteBase) {
  const base = remoteBase.endsWith('/') ? remoteBase : `${remoteBase}/`;
  for (const part of manifest.parts) {
    const url = new URL(part.file, base);
    const response = await fetch(url);
    if (!response.ok) {
      errors.push(`${part.file} returned ${response.status} from ${url.href}`);
      continue;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== part.bytes) {
      errors.push(`${part.file} is ${bytes.byteLength} bytes; expected ${part.bytes}`);
      continue;
    }
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    if (hex !== part.sha256) errors.push(`${part.file} checksum ${hex} does not match ${part.sha256}`);
    else console.log(`${url.href} matches`);
  }
} else {
  for (const part of manifest.parts) {
    const error = await verifyPartFile(join(dir, part.file), part);
    if (error) errors.push(error);
    else console.log(`${part.file} matches`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
