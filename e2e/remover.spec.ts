import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const fixture = readFileSync(new URL('../tests/fixtures/red-square.png', import.meta.url));

async function openHydrated(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
}

test('does not download the model or runtime before a file is chosen', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  await openHydrated(page, '/?mock=1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Free AI Background Remover – Transparent PNG in Seconds',
  );
  await expect(page.getByText('The model stays unloaded until you add an image.')).toBeVisible();
  expect(urls.some((url) => url.includes('isnet-w8') || url.includes('/ort/'))).toBe(false);
});

test('mock removal downloads a transparent PNG', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  await openHydrated(page, '/?mock=1');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'red-square.png',
    mimeType: 'image/png',
    buffer: fixture,
  });
  await expect(page.getByRole('link', { name: 'Download transparent PNG' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Ran on WASM')).toBeVisible();
  expect(urls.some((url) => url.includes('isnet-w8'))).toBe(false);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download transparent PNG' }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  const png = PNG.sync.read(readFileSync(path!));
  expect(png.width).toBe(64);
  expect(png.height).toBe(64);
  const center = (32 * png.width + 32) * 4;
  expect(png.data[center]).toBeGreaterThan(200);
  expect(png.data[center + 3]).toBeGreaterThan(200);
  expect(png.data[3]).toBeLessThan(20);
});

test('rejects a file that is not a supported image', async ({ page }) => {
  await openHydrated(page, '/?mock=1');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('alert')).toContainText('JPEG, PNG, or WebP');
});

test('static copy is available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Free AI Background Remover');
  await expect(page.locator('.noscript')).toContainText(
    'This tool needs JavaScript to run the model on your device',
  );
  await expect(page.getByText('Does my photo get uploaded?')).toBeVisible();
  await context.close();
});
