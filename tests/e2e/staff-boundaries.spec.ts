import { expect, test } from '@playwright/test';

test('real staff routes are role protected', async ({ request }) => {
  const admin = await request.get('/admin', { maxRedirects: 0 });
  expect(admin.status()).toBe(404);
  const teammate = await request.get('/teammate', { maxRedirects: 0 });
  expect(teammate.status()).toBe(303);
  expect(teammate.headers().location).toBe('/login');
});
