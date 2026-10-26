import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

const fixture = readFileSync(new URL('../tests/fixtures/red-square.png', import.meta.url));

test('real ISNet model returns an RGBA PNG', async ({ page, request }) => {
  test.skip(process.env.E2E_REAL !== '1', 'Run npm run test:e2e:real after linking the model into public/models.');
  const probe = await request.get('/models/isnet-w8.part00');
  test.skip(!probe.ok(), 'Model parts are not served at /models. Run npm run model:download -- --link.');

  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'red-square.png',
    mimeType: 'image/png',
    buffer: fixture,
  });
  await expect(page.getByRole('link', { name: 'Download transparent PNG' })).toBeVisible({ timeout: 170_000 });
  const engine = page.getByText(/Ran on (WASM|WebGPU)/);
  await expect(engine).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download transparent PNG' }).click(),
  ]);
  const path = await download.path();
  const png = PNG.sync.read(readFileSync(path!));
  expect(png.width).toBe(64);
  expect(png.height).toBe(64);
  let sawTransparent = false;
  let sawOpaque = false;
  for (let i = 3; i < png.data.length; i += 4) {
    if (png.data[i] === 0) sawTransparent = true;
    if (png.data[i] === 255) sawOpaque = true;
  }
  expect(sawTransparent || sawOpaque).toBe(true);
});
