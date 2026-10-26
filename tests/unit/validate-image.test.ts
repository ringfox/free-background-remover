import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES } from '../../src/lib/limits';
import { detectImageKind, validateDimensions, validateImageSelection } from '../../src/lib/validate-image';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

describe('detectImageKind', () => {
  it('recognizes jpeg, png, and webp', () => {
    expect(detectImageKind(jpeg)).toBe('jpeg');
    expect(detectImageKind(png)).toBe('png');
    expect(detectImageKind(webp)).toBe('webp');
    expect(detectImageKind(gif)).toBeNull();
  });
});

describe('validateImageSelection', () => {
  it('accepts a small png', () => {
    expect(validateImageSelection({ name: 'dot.png', size: 32 }, png)).toEqual({ ok: true, kind: 'png' });
  });

  it('rejects empty files, oversized files, and other formats', () => {
    expect(validateImageSelection({ name: 'empty.png', size: 0 }, png).ok).toBe(false);
    const huge = validateImageSelection({ name: 'big.jpg', size: MAX_FILE_BYTES + 1 }, jpeg);
    expect(huge.ok).toBe(false);
    if (!huge.ok) expect(huge.message).toMatch(/limit/i);
    const rejected = validateImageSelection({ name: 'anim.gif', size: 20 }, gif);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.message).toMatch(/JPEG, PNG, or WebP/);
  });
});

describe('validateDimensions', () => {
  it('rejects tiny and oversized images', () => {
    expect(validateDimensions(64, 64)).toEqual({ ok: true });
    expect(validateDimensions(1, 64).ok).toBe(false);
    expect(validateDimensions(9000, 10).ok).toBe(false);
  });
});
