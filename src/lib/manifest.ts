import manifestJson from '../../model/manifest.json' with { type: 'json' };

export const manifest = manifestJson;

export type ModelManifest = typeof manifestJson;

export const MODEL_BYTES = manifest.parts.reduce((sum, part) => sum + part.bytes, 0);
