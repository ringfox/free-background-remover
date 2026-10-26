import { MAX_EDGE_PX, MAX_FILE_BYTES, MIN_EDGE_PX, formatMegabytes, type ImageKind } from './limits';

export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

export function validateImageSelection(
  file: { name: string; size: number },
  header: Uint8Array,
): { ok: true; kind: ImageKind } | { ok: false; message: string } {
  if (file.size <= 0) {
    return { ok: false, message: 'That file is empty. Choose a JPEG, PNG, or WebP image.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: `${file.name || 'That file'} is ${formatMegabytes(file.size)}. The limit is ${formatMegabytes(MAX_FILE_BYTES)}.`,
    };
  }
  const kind = detectImageKind(header);
  if (!kind) {
    return {
      ok: false,
      message: 'Use a JPEG, PNG, or WebP image. HEIC, GIF, and other formats are not supported.',
    };
  }
  return { ok: true, kind };
}

export function validateDimensions(width: number, height: number): { ok: true } | { ok: false; message: string } {
  if (width < MIN_EDGE_PX || height < MIN_EDGE_PX) {
    return { ok: false, message: 'That image is too small to cut out.' };
  }
  if (width > MAX_EDGE_PX || height > MAX_EDGE_PX) {
    return {
      ok: false,
      message: `Images must be ${MAX_EDGE_PX} pixels or smaller on each side. This one is ${width}×${height}.`,
    };
  }
  return { ok: true };
}
