import { describe, expect, it } from 'vitest';
import { concatBytes, sha256Hex } from '../../src/lib/bytes';
import { verifyPartFile } from '../../scripts/lib/verify-parts.mjs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('concatBytes', () => {
  it('matches a Blob-style concatenation', () => {
    const merged = concatBytes([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array()]);
    expect(Array.from(merged)).toEqual([1, 2, 3]);
  });
});

describe('sha256Hex', () => {
  it('hashes a known string', async () => {
    const bytes = new TextEncoder().encode('hello');
    expect(await sha256Hex(bytes)).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});

describe('verifyPartFile', () => {
  it('accepts a matching file and reports checksum or size failures', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'isnet-'));
    const file = join(dir, 'tiny.bin');
    await writeFile(file, new Uint8Array([1, 2, 3, 4]));
    const sha256 = await sha256Hex(new Uint8Array([1, 2, 3, 4]));
    expect(await verifyPartFile(file, { file: 'tiny.bin', bytes: 4, sha256 })).toBeNull();
    expect(await verifyPartFile(file, { file: 'tiny.bin', bytes: 3, sha256 })).toMatch(/bytes/);
    expect(await verifyPartFile(file, { file: 'tiny.bin', bytes: 4, sha256: 'ab'.repeat(32) })).toMatch(/checksum/);
    expect(await verifyPartFile(join(dir, 'missing.bin'), { file: 'missing.bin', bytes: 1, sha256 })).toMatch(/missing/);
  });
});
