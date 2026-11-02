import { expect, test } from '@playwright/test';

const accept =
  '/api/teammate/orders/00000000-0000-4000-8000-000000000001/accept';

function expectPrivate(headers: Record<string, string>) {
  expect(headers['cache-control']).toContain('private');
  expect(headers['cache-control']).toContain('no-store');
}

test('anonymous desk redirects privately; browser never receives queue or assignment', async ({
  request,
  page,
}) => {
  const response = await request.get('/teammate', { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe('/?signin=1');
  expectPrivate(response.headers());
  const body = await response.text();
  expect(body).not.toMatch(/DL-[0-9]+|customer_name|payout_usd_cents/);
  await page.goto('/teammate');
  // the homepage with its sign-in dialog (?signin=1 is dropped once it opens)
  await expect(page).toHaveURL(/\/(\?signin=1)?$/);
  await expect(page.getByRole('button', { name: /accept order/i })).toHaveCount(
    0,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/,
  );
});

for (const path of ['/api/teammate/queue', '/api/teammate/order']) {
  test(`anonymous ${path} is denied, not a successful empty result`, async ({
    request,
  }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expectPrivate(response.headers());
    expect(await response.json()).toEqual({
      error: 'Authentication required.',
    });
    const wrongMethod = await request.post(path, {
      data: { csrf: 'not-a-token' },
    });
    expect(wrongMethod.status()).toBe(405);
    expect(wrongMethod.headers().allow).toBe('GET');
  });
}

test('accept does not mutate on GET or untrusted and malformed writes', async ({
  request,
}) => {
  const get = await request.get(accept);
  expect(get.status()).toBe(405);
  expect(get.headers().allow).toBe('POST');
  expectPrivate(get.headers());
  const untrusted = await request.post(accept, {
    headers: { Origin: 'https://untrusted.invalid' },
    data: { csrf: 'not-a-token' },
  });
  expect(untrusted.status()).toBe(403);
  expectPrivate(untrusted.headers());
  const malformed = await request.post(accept, {
    headers: { 'Content-Type': 'application/json' },
    data: '{',
  });
  expect(malformed.status()).toBe(400);
  expectPrivate(malformed.headers());
});
