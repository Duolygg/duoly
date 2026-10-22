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
test('malformed room id is a 404', async ({ request }) => {
  const missing = await request.get('/queue/not-a-uuid');
  expect(missing.status()).toBe(404);
});
test('anonymous dashboard remains private with no operational order leakage', async ({
  request,
}) => {
  const response = await request.get('/dashboard', { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe('/login');
  expect(response.headers()['cache-control']).toContain('no-store');
});
