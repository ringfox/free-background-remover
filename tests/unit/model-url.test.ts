import { describe, expect, it } from 'vitest';
import cloudflare from '../../infra/cloudflare.json' with { type: 'json' };
import manifest from '../../model/manifest.json' with { type: 'json' };
import { configuredModelBaseUrl, DEFAULT_MODEL_BASE_URL } from '../../src/lib/config';
import { MODEL_BYTES } from '../../src/lib/manifest';
import { modelPartUrl, runtimeBaseUrl } from '../../src/lib/model-url';

describe('model URLs', () => {
  it('uses the owner R2 prefix and keeps an env override', () => {
    expect(DEFAULT_MODEL_BASE_URL).toBe('https://pub-8351688b2a9b42318f662dc52714bef3.r2.dev/models');
    expect(cloudflare.bucket).toBe('free-bg-remover-models');
    expect(cloudflare.accountId).toBe('3cbe3dbbd5650161a784846887f23f94');
    expect(configuredModelBaseUrl()).toBe(DEFAULT_MODEL_BASE_URL);
  });

  it('joins part filenames with or without a trailing slash', () => {
    const base = 'https://pub-8351688b2a9b42318f662dc52714bef3.r2.dev/models';
    for (const part of manifest.parts) {
      expect(modelPartUrl(base, part.file)).toBe(`${base}/${part.file}`);
      expect(modelPartUrl(`${base}/`, part.file)).toBe(`${base}/${part.file}`);
    }
    expect(modelPartUrl('/models/', 'isnet-w8.part00', 'http://127.0.0.1:4321')).toBe(
      'http://127.0.0.1:4321/models/isnet-w8.part00',
    );
  });

  it('rejects an empty base and normalizes the runtime directory', () => {
    expect(() => modelPartUrl('   ', 'isnet-w8.part00')).toThrow(/PUBLIC_MODEL_BASE_URL/);
    expect(runtimeBaseUrl('/ort/', 'http://127.0.0.1:4321')).toBe('http://127.0.0.1:4321/ort/');
    expect(runtimeBaseUrl('https://cdn.example.com/ort')).toBe('https://cdn.example.com/ort/');
  });

  it('locks the published ISNet part checksums', () => {
    expect(manifest.inputName).toBe('input_image');
    expect(manifest.outputName).toBe('output_image');
    expect(manifest.inputSize).toBe(1024);
    expect(manifest.parts.map((part) => [part.file, part.bytes, part.sha256])).toEqual([
      ['isnet-w8.part00', 20971520, '4a9400b963ab3c6b6458026afe0e5e0d0d62b5a80d9373ea9b292835df3b3081'],
      ['isnet-w8.part01', 20971520, '0486a7019b37b985504a70ecbe378b103feb1555bc43c0bc543c703503a98296'],
      ['isnet-w8.part02', 4771450, '84fa00f9b72f85fb6af7833c54560d635cc05d0dfad7bce6ce623145fe6acc27'],
    ]);
    expect(MODEL_BYTES).toBe(46714490);
    expect(cloudflare.modelPrefix).toBe('models');
  });
});
