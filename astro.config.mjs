import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? '', process.cwd(), '');
const site = process.env.PUBLIC_SITE_URL || env.PUBLIC_SITE_URL || 'http://localhost:4321';

if (!process.env.PUBLIC_SITE_URL && !env.PUBLIC_SITE_URL) {
  console.warn(
    'PUBLIC_SITE_URL is unset. Canonical URLs and the sitemap use http://localhost:4321. Set it before a production deploy.',
  );
}

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: {
    inlineStylesheets: 'never',
  },
  integrations: [react(), sitemap()],
  vite: {
    resolve: {
      conditions: ['onnxruntime-web-use-extern-wasm'],
    },
    optimizeDeps: {
      exclude: ['onnxruntime-web'],
    },
    worker: {
      format: 'es',
    },
  },
});
