import { expect, test } from '@playwright/test';

test('disabled Google provider is rejected on the server with a valid same-origin CSRF request', async ({
  page,
}) => {
  await page.goto('/login');
  const csrf = await page.locator('input[name="csrf"]').first().inputValue();
  const origin = new URL(page.url()).origin;
  const response = await page.request.post('/auth/oauth', {
    headers: { Origin: origin },
    data: { csrf, provider: 'google' },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(503);
  expect(response.headers().location).toBeUndefined();
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(await response.json()).toEqual({
    error: 'This sign-in method is not configured.',
  });
});
