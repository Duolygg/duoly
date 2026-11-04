import { test, expect } from '@playwright/test';

// The customer order room for this month's free coaching order (migration 20261026160000):
// no price, no refund line. Fictional order, mocked API.
const orderId = '11111111-1111-4111-8111-111111111111';

test('free perk order room shows Free with your perk and no refund line', async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: 'duoly-consent',
      value: 'v2.a0.m0.r0',
      url: 'http://127.0.0.1:4336',
    },
  ]);
  const now = Date.now();
  const order = {
    id: orderId,
    public_reference: 'DL-90002',
    status: 'queued',
    game: 'val',
    service: 'VOD Review',
    title: 'VOD Review',
    units: 1,
    unit: 'hour',
    gg: false,
    rank: null,
    region: 'EU West',
    ign: 'Alex#EUW',
    note: '',
    voice: false,
    amount_eur_cents: 1799,
    created_at: new Date(now - 20_000).toISOString(),
    queued_at: new Date(now - 20_000).toISOString(),
    accepted_at: null,
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    rerolls: 0,
    current_assignment_id: null,
    teammate: null,
    review: null,
    tip: null,
    reports: [],
    free_perk: true,
  };
  await page.route(`**/api/orders/${orderId}**`, (route) =>
    route.request().method() === 'GET' &&
    new URL(route.request().url()).pathname === `/api/orders/${orderId}`
      ? route.fulfill({ json: { order } })
      : route.fulfill({ json: { proofs: [] } }),
  );
  await page.goto('/?mode=queue');
  await expect(page.getByText('Free with your perk').first()).toBeVisible();
  await expect(
    page.getByText('Nobody free in 5:00? Your free coaching comes back.'),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText('€17.99');
  await expect(page.locator('body')).not.toContainText(
    'back to your Duoly balance',
  );
});
