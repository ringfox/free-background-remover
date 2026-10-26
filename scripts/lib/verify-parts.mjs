import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * @param {string} filePath
 * @param {{ file: string, bytes: number, sha256: string }} part
 * @returns {Promise<string | null>}
 */
export async function verifyPartFile(filePath, part) {
  let size;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return `${part.file} is missing at ${filePath}`;
  }
  if (size !== part.bytes) {
    return `${part.file} is ${size} bytes; expected ${part.bytes}`;
  }
  const digest = await sha256File(filePath);
  if (digest !== part.sha256) {
    return `${part.file} checksum ${digest} does not match ${part.sha256}`;
  }
  return null;
}
