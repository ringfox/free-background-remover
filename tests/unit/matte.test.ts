import { describe, expect, it } from 'vitest';
import { alphaStats, compositeDestinationIn, matteToAlpha, rgbaToNchw } from '../../src/lib/matte';

describe('rgbaToNchw', () => {
  it('packs RGB as NCHW and normalizes each channel with pixel/255 - 0.5', () => {
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 128,
      0, 0, 255, 0,
      128, 128, 128, 255,
    ]);
    const out = rgbaToNchw(rgba, 2, 2);
    expect(out).toHaveLength(12);
    expect(out[0]).toBeCloseTo(0.5);
    expect(out[1]).toBeCloseTo(-0.5);
    expect(out[2]).toBeCloseTo(-0.5);
    expect(out[3]).toBeCloseTo(128 / 255 - 0.5);
    expect(out[4]).toBeCloseTo(-0.5);
    expect(out[5]).toBeCloseTo(0.5);
    expect(out[10]).toBeCloseTo(0.5);
  });

  it('rejects a short buffer', () => {
    expect(() => rgbaToNchw(new Uint8ClampedArray(3), 1, 1)).toThrow(/RGBA/);
  });
});

describe('matteToAlpha', () => {
  it('min-max scales to 8-bit alpha using the reference epsilon', () => {
    expect(Array.from(matteToAlpha(new Float32Array([0, 0.5, 1])))).toEqual([0, 127, 255]);
    expect(Array.from(matteToAlpha(new Float32Array([-2, 0, 2])))).toEqual([0, 127, 255]);
  });

  it('collapses a constant matte toward zero', () => {
    expect(Array.from(matteToAlpha(new Float32Array([0.2, 0.2, 0.2])))).toEqual([0, 0, 0]);
  });

  it('returns an empty mask for an empty matte', () => {
    expect(matteToAlpha(new Float32Array())).toHaveLength(0);
  });
});

describe('compositeDestinationIn', () => {
  it('keeps destination RGB and multiplies alpha', () => {
    const dest = new Uint8ClampedArray([10, 20, 30, 255, 1, 2, 3, 200]);
    const out = compositeDestinationIn(dest, new Uint8Array([128, 0]));
    expect(Array.from(out)).toEqual([10, 20, 30, 128, 1, 2, 3, 0]);
  });

  it('rejects a mismatched mask', () => {
    expect(() => compositeDestinationIn(new Uint8ClampedArray(4), new Uint8Array(2))).toThrow(/alpha/);
  });
});

describe('alphaStats', () => {
  it('counts transparent and opaque pixels', () => {
    expect(alphaStats(new Uint8Array([0, 10, 255, 255]))).toEqual({
      min: 0,
      max: 255,
      transparent: 1,
      opaque: 2,
    });
  });
});
