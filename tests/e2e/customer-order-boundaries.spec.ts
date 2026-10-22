import { expect, test } from '@playwright/test';
const id = '00000000-0000-4000-8000-000000000001';
test('operational UUID room requires login and is never cached', async ({
  request,
}) => {
  const response = await request.get(`/queue/${id}`, { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe('/login');
  expect(response.headers()['cache-control']).toContain('private');
  expect(response.headers()['cache-control']).toContain('no-store');
});
test('malformed room preserves the preview 404 and sample stays available', async ({
  page,
  request,
}) => {
  const missing = await request.get('/queue/not-a-uuid');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain(
    'This identifier is not a sample record.',
  );
  const sample = await request.get('/queue/preview-order');
  expect(sample.status()).toBe(200);
  expect(await sample.text()).toContain(
    '<title>Order queue | Duoly preview</title>',
  );
  await page.goto('/queue/preview-order');
  // The preserved preview intentionally replaces its SSR title after hydration.
  await expect(page).toHaveTitle(
    /\(\d+:\d{2}\) Finding your teammate .* Duoly$/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/,
  );
});
test('anonymous dashboard remains private with no operational order leakage', async ({
  request,
}) => {
  const response = await request.get('/dashboard', { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe('/login');
  expect(response.headers()['cache-control']).toContain('no-store');
});
