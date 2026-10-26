/**
 * ISNet browser preprocess / postprocess.
 *
 * Matches the verified Apache-2.0 reference at
 * https://github.com/chenjindu/browser-remove-background/blob/main/index.html
 *
 * - RGB is stretched to 1024×1024 (no letterbox) and packed NCHW float32.
 * - Each channel is normalized as `(pixel / 255 - 0.5)`.
 * - The single-channel `output_image` matte is min-max scaled to 0–255 alpha.
 * - Alpha is composited onto the original RGB with destination-in.
 */

const MATTE_EPSILON = 1e-8;

export function rgbaToNchw(rgba: ArrayLike<number>, width: number, height: number): Float32Array {
  const count = width * height;
  if (rgba.length < count * 4) {
    throw new Error(`Expected at least ${count * 4} RGBA samples, received ${rgba.length}.`);
  }
  const out = new Float32Array(3 * count);
  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    out[i] = rgba[offset] / 255 - 0.5;
    out[count + i] = rgba[offset + 1] / 255 - 0.5;
    out[2 * count + i] = rgba[offset + 2] / 255 - 0.5;
  }
  return out;
}

/**
 * Min-max normalize a matte to 8-bit alpha.
 * A constant matte collapses toward 0 because the reference divides by `(max - min + 1e-8)`.
 */
export function matteToAlpha(matte: ArrayLike<number>): Uint8Array {
  const count = matte.length;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const value = matte[i];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const alpha = new Uint8Array(count);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return alpha;
  const span = max - min + MATTE_EPSILON;
  for (let i = 0; i < count; i++) {
    const scaled = Math.round(((matte[i] - min) / span) * 255);
    alpha[i] = scaled < 0 ? 0 : scaled > 255 ? 255 : scaled;
  }
  return alpha;
}

/**
 * Pixel equivalent of canvas `destination-in` with an opaque-white source whose alpha is `sourceAlpha`.
 * RGB stays on the destination. Destination alpha is multiplied by the matte alpha.
 */
export function compositeDestinationIn(dest: Uint8ClampedArray, sourceAlpha: Uint8Array): Uint8ClampedArray {
  if (dest.length !== sourceAlpha.length * 4) {
    throw new Error(
      `RGBA length ${dest.length} does not match alpha length ${sourceAlpha.length}.`,
    );
  }
  const out = new Uint8ClampedArray(dest.length);
  for (let i = 0; i < sourceAlpha.length; i++) {
    const offset = i * 4;
    out[offset] = dest[offset];
    out[offset + 1] = dest[offset + 1];
    out[offset + 2] = dest[offset + 2];
    out[offset + 3] = Math.round((dest[offset + 3] * sourceAlpha[i]) / 255);
  }
  return out;
}

export function alphaStats(alpha: ArrayLike<number>): {
  min: number;
  max: number;
  transparent: number;
  opaque: number;
} {
  let min = 255;
  let max = 0;
  let transparent = 0;
  let opaque = 0;
  for (let i = 0; i < alpha.length; i++) {
    const value = alpha[i];
    if (value < min) min = value;
    if (value > max) max = value;
    if (value === 0) transparent += 1;
    if (value === 255) opaque += 1;
  }
  if (alpha.length === 0) return { min: 0, max: 0, transparent: 0, opaque: 0 };
  return { min, max, transparent, opaque };
}
