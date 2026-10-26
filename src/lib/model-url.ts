function absoluteBase(base: string, origin: string): URL {
  const trimmed = base.trim();
  if (!trimmed) {
    throw new Error(
      'Model base URL is not configured. Set PUBLIC_MODEL_BASE_URL to your R2 public URL (trailing slash optional).',
    );
  }
  const withSlash = trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  const originBase = origin.endsWith('/') ? origin : `${origin}/`;
  return new URL(withSlash, originBase);
}

/**
 * Join a configured model base with a part filename.
 * Accepts bases with or without a trailing slash, including site-relative bases such as `/models/`.
 */
export function modelPartUrl(base: string, file: string, origin = 'http://localhost'): string {
  return new URL(file, absoluteBase(base, origin)).href;
}

/** Directory URL with a trailing slash, for ONNX Runtime `wasmPaths`. */
export function runtimeBaseUrl(base: string, origin = 'http://localhost'): string {
  return absoluteBase(base, origin).href;
}
