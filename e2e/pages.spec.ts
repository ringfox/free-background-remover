import { expect, test } from '@playwright/test';

test('legal pages and footer links', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await footer.getByRole('link', { name: 'Privacy Policy', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  await expect(page.getByText('there is no upload endpoint')).toBeVisible();

  await footer.getByRole('link', { name: 'Terms of Use', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();

  await footer.getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Contact' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Email privacy@example.com' })).toBeVisible();
});
