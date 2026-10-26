import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { symlinkSync, lstatSync, rmSync, mkdirSync } from 'node:fs';
import manifest from '../model/manifest.json' with { type: 'json' };
import { verifyPartFile } from './lib/verify-parts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceBase = (
  process.env.MODEL_SOURCE_URL || 'https://huggingface.co/chenjindu/isnet-web/resolve/main/'
).replace(/\/?$/, '/');
const outDir = join(root, '.model-cache');
const shouldLink = process.argv.includes('--link');

await mkdir(outDir, { recursive: true });

for (const part of manifest.parts) {
  const destination = join(outDir, part.file);
  const existing = await verifyPartFile(destination, part);
  if (!existing) {
    console.log(`${part.file} already matches the manifest`);
    continue;
  }
  const url = new URL(part.file, sourceBase);
  console.log(`Downloading ${url.href}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed for ${part.file}: ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  const error = await verifyPartFile(destination, part);
  if (error) throw new Error(error);
  const size = (await stat(destination)).size;
  console.log(`Saved ${part.file} (${size} bytes)`);
}

if (shouldLink) {
  const linkPath = join(root, 'public/models');
  mkdirSync(join(root, 'public'), { recursive: true });
  try {
    if (lstatSync(linkPath).isSymbolicLink()) rmSync(linkPath);
    else throw new Error('public/models already exists and is not a symlink. Remove it before --link.');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') throw error;
    if (error instanceof Error && !('code' in error)) throw error;
  }
  symlinkSync(join('..', '.model-cache'), linkPath, 'dir');
  console.log('Linked public/models -> ../.model-cache');
}

console.log('Model parts are in .model-cache (gitignored).');
