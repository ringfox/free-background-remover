import cloudflare from '../../infra/cloudflare.json' with { type: 'json' };

/** Owner's public r2.dev prefix. Override with PUBLIC_MODEL_BASE_URL (trailing slash optional). */
export const DEFAULT_MODEL_BASE_URL = cloudflare.modelBaseUrl;

/**
 * Same-origin runtime files shipped with the Pages build.
 * WebGPU's larger wasm binaries exceed the 25 MiB Pages asset limit, so point
 * PUBLIC_ORT_BASE_URL at the R2 `ort/` prefix after `npm run runtime:upload`.
 */
export const SAME_ORIGIN_ORT_BASE_URL = '/ort/';

export const R2_ORT_BASE_URL = cloudflare.ortBaseUrl;

export function configuredModelBaseUrl(): string {
  const fromEnv = import.meta.env.PUBLIC_MODEL_BASE_URL?.trim() ?? '';
  return fromEnv || DEFAULT_MODEL_BASE_URL;
}

export function configuredOrtBaseUrl(): string {
  const fromEnv = import.meta.env.PUBLIC_ORT_BASE_URL?.trim() ?? '';
  return fromEnv || SAME_ORIGIN_ORT_BASE_URL;
}
