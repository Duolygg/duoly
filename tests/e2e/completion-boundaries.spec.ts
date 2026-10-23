import { expect, test } from '@playwright/test';
const path =
  '/api/teammate/orders/00000000-0000-4000-8000-000000000001/complete';
function privateResponse(headers: Record<string, string>) {
  expect(headers['cache-control']).toContain('private');
  expect(headers['cache-control']).toContain('no-store');
}
test('completion rejects GET and untrusted mutations without leaking money or evidence', async ({
  request,
}) => {
  const get = await request.get(path);
  expect(get.status()).toBe(405);
  expect(get.headers().allow).toBe('POST');
  privateResponse(get.headers());
  const post = await request.post(path, {
    headers: { Origin: 'https://untrusted.invalid' },
    data: { csrf: 'bad', proof_ids: ['bad'] },
  });
  expect(post.status()).toBe(403);
  privateResponse(post.headers());
  expect(await post.text()).not.toMatch(
    /payout_usd_cents|proof_ids|storage_key|teammate_id/,
  );
});
test('earnings requires a session and never presents denial as an empty history', async ({
  request,
}) => {
  const get = await request.get('/api/teammate/earnings');
  expect(get.status()).toBe(401);
  privateResponse(get.headers());
  expect(await get.json()).toEqual({ error: 'Authentication required.' });
  const post = await request.post('/api/teammate/earnings', { data: {} });
  expect(post.status()).toBe(405);
  expect(post.headers().allow).toBe('GET');
  privateResponse(post.headers());
});
