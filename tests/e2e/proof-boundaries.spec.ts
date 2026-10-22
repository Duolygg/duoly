import { expect, test } from '@playwright/test';

// Integration acceptance: requires the parent's real proof HTTP routes.
// No fake routes, browser auth bypass or production proof fallback.
const order = '12345678-1234-4234-8234-123456789012';
const proof = '12345678-1234-4234-8234-123456789014';
function privateResponse(headers: Record<string, string>) {
  expect(headers['cache-control']).toContain('private');
  expect(headers['cache-control']).toContain('no-store');
}
for (const path of [
  `/api/orders/${order}/proof`,
  `/api/orders/${order}/proof/${proof}`,
  `/api/orders/${order}/proof/not-a-uuid`,
]) {
  test(`anonymous private evidence cannot be read: ${path}`, async ({
    request,
  }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    privateResponse(response.headers());
    expect(response.headers().location).toBeUndefined();
    expect(await response.text()).not.toMatch(
      /storage\/v1|signedUrl|assignment_id|created_at/,
    );
  });
}
test('raw upload denies cross-origin CSRF and never provides completion or payment state', async ({
  request,
}) => {
  const response = await request.post(`/api/teammate/orders/${order}/proof`, {
    headers: {
      Origin: 'https://untrusted.invalid',
      'Content-Type': 'image/png',
      'X-CSRF-Token': 'invalid',
      'X-Assignment-Id': proof,
      'X-Idempotency-Key': proof,
    },
    data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);
  privateResponse(response.headers());
  expect(await response.text()).not.toMatch(
    /completed_at|earning|cashback|storage\/v1/,
  );
});
test('private order pages stay behind existing account boundaries at mobile width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/queue/${order}`);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Choose one evidence image')).toHaveCount(0);
  await expect(page.locator('img[src*="/proof/"]')).toHaveCount(0);
  await page.goto('/teammate');
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('button', { name: 'Upload selected image' }),
  ).toHaveCount(0);
});
