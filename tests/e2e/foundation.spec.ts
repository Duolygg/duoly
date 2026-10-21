import { expect, test } from '@playwright/test';

test('design preview is honest, readable and not indexable', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?email=private@example.invalid#secret');
  await expect(page).toHaveTitle('Duoly — Duo up in under 2 minutes');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /Duo up in\s*under 2 minutes\./,
  );
  await expect(page.getByText('Design preview', { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'Sample data. Login, payments and order actions are not connected.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Protected Duoly design preview with deterministic sample data. Login, payments and order actions are not connected.',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');
});

test('SSR responses have baseline security headers', async ({ request }) => {
  for (const path of ['/', '/api/health', '/missing']) {
    const response = await request.get(path);
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
    expect(response.headers()['content-security-policy']).toBe(
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    );
  }
});

test('health is an uncached SSR JSON response', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toEqual({ status: 'ok' });
});
