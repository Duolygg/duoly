import { expect, test } from '@playwright/test';

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
