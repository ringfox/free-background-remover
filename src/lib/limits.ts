export const ACCEPTED_IMAGE_KINDS = ['jpeg', 'png', 'webp'] as const;

export type ImageKind = (typeof ACCEPTED_IMAGE_KINDS)[number];

/** Longest side, in pixels, that we will decode. Larger files are rejected. */
export const MAX_EDGE_PX = 8192;

export const MIN_EDGE_PX = 2;

/** Upload cap. The model itself always sees a 1024×1024 stretch. */
export const MAX_FILE_BYTES = 12 * 1024 * 1024;

export const MODEL_INPUT_SIZE = 1024;

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
