import { test, expect } from '@playwright/test';

// Admin Payouts (ledger #14) against fictional API answers.
const week = Date.UTC(2026, 9, 15, 22);
const base = {
  week: '2026-10-16',
  start: week,
  end: week + 7 * 86400000,
  dueAt: week + 7 * 86400000,
  orders: 3,
  gross: 60,
  tips: 0,
  held: 6,
  net: 54,
  releasing: 2,
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
};
const payouts = [
  {
    ...base,
    id: '6d000000-0000-4000-8000-0000000000a1',
    teammateId: '6d000000-0000-4000-8000-0000000000f1',
    teammate: 'Alpha Mate',
    email: 'alpha@example.invalid',
    country: 'Austria',
    legalName: 'Alpha, "Legal" Mate',
    payoutMethod: 'wise',
    total: 56,
    status: 'Scheduled',
  },
  {
    ...base,
    id: '6d000000-0000-4000-8000-0000000000a2',
    teammateId: '6d000000-0000-4000-8000-0000000000f2',
    teammate: 'Beta Mate',
    email: 'beta@example.invalid',
    country: 'Germany',
    legalName: 'Beta Legal',
    payoutMethod: 'bank',
    total: 20,
    status: 'On hold',
    reason: 'Checking a chargeback',
  },
  {
    ...base,
    id: 'accruing:6d000000-0000-4000-8000-0000000000f1',
    teammateId: '6d000000-0000-4000-8000-0000000000f1',
    teammate: 'Alpha Mate',
    email: 'alpha@example.invalid',
    country: 'Austria',
    legalName: '',
    payoutMethod: 'wise',
    start: week + 7 * 86400000,
    end: week + 14 * 86400000,
    dueAt: week + 14 * 86400000,
    total: 12,
    status: 'Accruing',
  },
];

test('payouts lists weeks, exports scheduled CSV, and pays and holds with audit', async ({
  page,
}) => {
  const writes: Record<string, unknown>[] = [];
  await page.route('**/api/**', async (r) => {
    const req = r.request(),
      url = new URL(req.url());
    if (url.pathname === '/api/admin/payouts') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        writes.push(body);
        if (body.action === 'pay') {
          const p = payouts.find((x) => x.id === body.payoutId)!;
          p.status = 'Paid';
          (p as { paidAt: number | null }).paidAt = Date.now();
        }
        return r.fulfill({ json: { ok: true } });
      }
      return r.fulfill({ json: { payouts, teammates: [], minimum: 10 } });
    }
    if (url.pathname === '/api/admin/audit')
      return r.fulfill({ json: { entries: [] } });
    if (url.pathname === '/api/admin/presence')
      return r.fulfill({ json: { teammates: [] } });
    if (url.pathname === '/api/admin/applications')
      return r.fulfill({ json: { applications: [] } });
    return r.fulfill({ json: {} });
  });
  await page.goto('/admin/payouts');
  const main = page.getByRole('main');
  await expect(main.getByText('Alpha Mate').first()).toBeVisible();
  await expect(
    main
      .getByRole('row', { name: /Beta Mate/ })
      .getByRole('button', { name: 'Release' }),
  ).toBeVisible();
  await expect(main).toContainText('Week running');
  await expect(main).not.toContainText('Not connected');

  const download = page.waitForEvent('download');
  await main.getByRole('button', { name: 'Export CSV' }).click();
  const file = await download;
  const csv = await (await file.createReadStream()).toArray();
  expect(Buffer.concat(csv).toString('utf8')).toBe(
    '"name","email","country","payout method","amount USD"\r\n' +
      '"Alpha, ""Legal"" Mate","alpha@example.invalid","Austria","wise","56.00"',
  );

  await main.getByRole('button', { name: 'Pay all scheduled' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog).toContainText('Mark all scheduled payouts as paid?');
  await dialog.getByLabel('Transfer reference').fill('WISE-BATCH-1');
  await dialog.getByRole('button', { name: 'Mark paid' }).click();
  await expect
    .poll(() => writes.at(-1))
    .toEqual({
      action: 'payAll',
      method: 'wise',
      reference: 'WISE-BATCH-1',
      csrf: 'fixture-csrf',
    });
});
