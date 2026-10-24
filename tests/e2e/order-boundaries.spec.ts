import { expect, test } from '@playwright/test';

const id = '00000000-0000-4000-8000-000000000001';
const reads = [
  '/api/orders/active',
  '/api/orders/history',
  '/api/orders/credits',
  `/api/orders/${id}`,
  '/api/teammate/queue',
  '/api/teammate/order',
  '/api/teammate/queue-settings',
];
const writes = [
  `/api/orders/${id}/cancel`,
  `/api/orders/${id}/reroll`,
  `/api/teammate/orders/${id}/accept`,
];
for (const path of reads) {
  test(`anonymous ${path} is private and denied`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['cache-control']).toContain('private');
    expect(await response.json()).toEqual({
      error: 'Authentication required.',
    });
  });
}
for (const path of writes) {
  test(`untrusted ${path} cannot mutate`, async ({ request }) => {
    const untrusted = await request.post(path, {
      headers: { Origin: 'https://untrusted.invalid' },
      data: { csrf: 'a'.repeat(64), bypass: true },
    });
    expect(untrusted.status()).toBe(403);
    expect(untrusted.headers()['cache-control']).toContain('no-store');
    const malformed = await request.post(path, {
      headers: { 'Content-Type': 'application/json' },
      data: '{',
    });
    expect(malformed.status()).toBe(400);
    expect(malformed.headers()['cache-control']).toContain('no-store');
    const wrongMethod = await request.get(path);
    expect(wrongMethod.status()).toBe(405);
    expect(wrongMethod.headers().allow).toBe('POST');
  });
}
test('untrusted queue settings cannot mutate', async ({ request }) => {
  const path = '/api/teammate/queue-settings';
  const untrusted = await request.post(path, {
    headers: { Origin: 'https://untrusted.invalid' },
    data: { csrf: 'a'.repeat(64), enabledGames: ['lol'], voiceOptIn: false },
  });
  expect(untrusted.status()).toBe(403);
  expect(untrusted.headers()['cache-control']).toContain('no-store');
  const malformed = await request.post(path, {
    headers: { 'Content-Type': 'application/json' },
    data: '{',
  });
  expect(malformed.status()).toBe(400);
});

test('no public order creation endpoint exists', async ({ request }) => {
  for (const path of ['/api/orders', '/api/orders/create']) {
    const response = await request.post(path, {
      data: { price: 1, paid: true, actor: id },
    });
    expect([404, 405]).toContain(response.status());
  }
});
