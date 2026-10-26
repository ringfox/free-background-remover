import { defineConfig, devices } from '@playwright/test';

const port = 4321;
const baseURL = `http://127.0.0.1:${port}`;
const real = process.env.E2E_REAL === '1';

export default defineConfig({
  testDir: 'e2e',
  timeout: real ? 180_000 : 30_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: real
    ? [{ name: 'real', testMatch: /real-model\.spec\.ts/, use: { ...devices['Desktop Chrome'] } }]
    : [{ name: 'mock', testIgnore: /real-model\.spec\.ts/, use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PUBLIC_ALLOW_INFERENCE_MOCK: real ? 'false' : 'true',
      PUBLIC_SITE_URL: baseURL,
      PUBLIC_MODEL_BASE_URL: real ? `${baseURL}/models` : 'https://models.example.invalid/models',
      PUBLIC_ORT_BASE_URL: '/ort/',
      PUBLIC_CONTACT_EMAIL: 'privacy@example.com',
    },
  },
});
