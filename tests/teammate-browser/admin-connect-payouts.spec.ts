import { test, expect } from '@playwright/test';

// Admin Payouts rail column and Pay via Stripe (M9, ledger #14 phase 2), fictional answers.
const week = Date.UTC(2026, 9, 15, 22);
const base = {
  week: '2026-10-16',
  start: week,
  end: week + 7 * 86400000,
  dueAt: week + 7 * 86400000,
  orders: 2,
  gross: 40,
  tips: 0,
  held: 0,
  net: 40,
  releasing: 0,
  adjust: 0,
  carried: 0,
  autoHeld: 0,
  adjustments: [],
  reason: '',
  paidAt: null,
  method: null,
  reference: null,
  av: '/assets/avatars/avatar-1.png',
  tier: 'Rookie',
  deposit: 10,
  details: true,
  country: 'Austria',
  legalName: 'Legal',
  payoutMethod: 'wise',
  transfer: null,
};
const STRIPE = '6d000000-0000-4000-8000-0000000000c1';
const MANUAL = '6d000000-0000-4000-8000-0000000000c2';
const fresh = () => [
  {
    ...base,
    id: STRIPE,
    teammateId: '6d000000-0000-4000-8000-0000000000e1',
    teammate: 'Stripe Mate',
    email: 'stripe@example.invalid',
    total: 40,
    status: 'Scheduled',
    connect: 'ready',
  },
  {
    ...base,
    id: MANUAL,
    teammateId: '6d000000-0000-4000-8000-0000000000e2',
    teammate: 'Manual Mate',
    email: 'manual@example.invalid',
    total: 25,
    status: 'Scheduled',
    connect: 'pending',
  },
];

const routes = async (
  page: import('@playwright/test').Page,
  connect: boolean,
  writes: { path: string; body: Record<string, unknown> }[],
) => {
  const payouts = fresh();
  await page.route('**/api/**', async (r) => {
    const req = r.request(),
      url = new URL(req.url());
    if (url.pathname === '/api/admin/payout-stripe') {
      const body = req.postDataJSON();
      writes.push({ path: url.pathname, body });
      const p = payouts.find((x) => x.id === body.payoutId)!;
      p.status = 'Paid';
      (p as { method: string | null }).method = 'stripe';
      (p as { paidAt: number | null }).paidAt = Date.now();
      (p as { transfer: unknown }).transfer = {
        state: 'paid',
        transferId: 'tr_fixture1',
        currency: 'EUR',
        amount: 36.36,
        fx: 1.1,
        reversed: 0,
        error: null,
      };
      return r.fulfill({ json: { ok: true, transferId: 'tr_fixture1' } });
    }
    if (url.pathname === '/api/admin/payouts') {
      if (req.method() === 'POST') {
        writes.push({ path: url.pathname, body: req.postDataJSON() });
        return r.fulfill({ json: { ok: true } });
      }
      return r.fulfill({
        json: { payouts, teammates: [], minimum: 25, connect },
      });
    }
    if (url.pathname === '/api/admin/audit')
      return r.fulfill({ json: { entries: [] } });
    if (url.pathname === '/api/admin/presence')
      return r.fulfill({ json: { teammates: [] } });
    if (url.pathname === '/api/admin/applications')
      return r.fulfill({ json: { applications: [] } });
    return r.fulfill({ json: {} });
  });
};

test('payouts shows the rail and pays ready accounts via Stripe, others manually', async ({
  page,
}) => {
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  await routes(page, true, writes);
  await page.goto('/admin/payouts');
  const main = page.getByRole('main');
  await expect(main.getByRole('columnheader', { name: 'Rail' })).toBeVisible();
  const stripeRow = main.getByRole('row', { name: /Stripe Mate/ });
  const manualRow = main.getByRole('row', { name: /Manual Mate/ });
  await expect(stripeRow.locator('[data-rail]')).toHaveText('Stripe');
  await expect(manualRow.locator('[data-rail]')).toContainText('Manual');
  await expect(manualRow).toContainText('Stripe pending verification');
  await expect(
    stripeRow.getByRole('button', { name: 'Mark paid' }),
  ).toHaveCount(0);
  await expect(
    manualRow.getByRole('button', { name: 'Pay via Stripe' }),
  ).toHaveCount(0);

  await stripeRow.getByRole('button', { name: 'Pay via Stripe' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('via Stripe?');
  await dialog.getByRole('button', { name: 'Pay via Stripe' }).click();
  await expect
    .poll(() => writes.at(-1))
    .toEqual({
      path: '/api/admin/payout-stripe',
      body: { payoutId: STRIPE, csrf: 'fixture-csrf' },
    });
  await expect(stripeRow).toContainText('Done');
  await expect(stripeRow.locator('[data-rail]')).toHaveText('Stripe');

  await manualRow.getByRole('button', { name: 'Mark paid' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'no ready Stripe account',
  );
});

test('without the flag payouts keep the manual layout', async ({ page }) => {
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  await routes(page, false, writes);
  await page.goto('/admin/payouts');
  const main = page.getByRole('main');
  await expect(main.getByText('Stripe Mate').first()).toBeVisible();
  await expect(main.getByRole('columnheader', { name: 'Rail' })).toHaveCount(0);
  await expect(
    main.getByRole('button', { name: 'Pay via Stripe' }),
  ).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Mark paid' })).toHaveCount(2);
});
