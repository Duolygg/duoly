import { test, expect } from '@playwright/test';

// Admin Settings and Creators (ledger #24, #28) against fictional API answers.
const alpha = {
  id: '6c000000-0000-4000-8000-0000000000a1',
  code: 'ALPHA10',
  name: 'Alpha Streams',
  channel: 'twitch.tv/alpha',
  active: true,
  createdAt: '2026-10-01T10:00:00.000Z',
  createdBy: 'Fixture Admin',
  customers: 3,
  orders: 4,
  openOrders: 1,
  owedCents: 351,
  months: [
    {
      month: '2026-10',
      orders: 2,
      baseCents: 4387,
      tier: 'rising',
      commission: 8,
      commissionCents: 351,
    },
  ],
};
const rules = {
  months: 12,
  payoutMinCents: 5000,
  tiers: [
    { id: 'rising', name: 'Rising', from: 0, commission: 8 },
    { id: 'partner', name: 'Partner', from: 25, commission: 10 },
    { id: 'elite', name: 'Elite', from: 100, commission: 12 },
  ],
};
const orders = [
  {
    id: 'DL-1001',
    at: '2026-10-20T10:00:00.000Z',
    code: 'ALPHA10',
    customer: 'Viewer One',
    status: 'completed',
    payment: 'captured',
    amountCents: 1887,
    refundCents: 0,
  },
  {
    id: 'DL-1002',
    at: '2026-10-21T10:00:00.000Z',
    code: 'ALPHA10',
    customer: 'Viewer Two',
    status: 'queued',
    payment: 'authorized',
    amountCents: 2500,
    refundCents: 0,
  },
];

async function mock(
  page: import('@playwright/test').Page,
  start: (typeof alpha)[] = [alpha],
) {
  const writes: Record<string, unknown>[] = [];
  let creators = start;
  await page.route('**/api/**', async (r) => {
    const req = r.request(),
      url = new URL(req.url());
    if (url.pathname === '/api/admin/settings')
      return r.fulfill({
        json: {
          fx: { rate: 1.0842, customerRate: 1.095, markup: 0.01, live: true },
          ownersConfigured: true,
          referralsEnabled: false,
        },
      });
    if (url.pathname === '/api/admin/creators') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        writes.push(body);
        expect(body.csrf).toBe('fixture-csrf');
        if (body.action === 'create') {
          if (creators.some((c) => c.code === body.code))
            return r.fulfill({
              status: 409,
              json: { error: 'That code is taken.' },
            });
          const c = {
            ...alpha,
            id: '6c000000-0000-4000-8000-0000000000b2',
            code: body.code,
            name: body.name,
            channel: body.channel,
            customers: 0,
            orders: 0,
            openOrders: 0,
            owedCents: 0,
            months: [],
          };
          creators = [c, ...creators];
          return r.fulfill({ json: { creator: c } });
        }
        const c = creators.find((x) => x.id === body.creatorId)!;
        if (body.action === 'pay') {
          const m = c.months.find((x) => x.month === body.month)!;
          Object.assign(m, {
            paid: true,
            paidAt: '2026-10-28T10:00:00.000Z',
            reference: body.reference,
          });
          c.owedCents -= m.commissionCents;
          return r.fulfill({ json: { creator: c } });
        }
        c.active = body.active;
        return r.fulfill({ json: { creator: c } });
      }
      return r.fulfill({ json: { rules, creators, orders } });
    }
    if (url.pathname === '/api/admin/audit')
      return r.fulfill({ json: { entries: [] } });
    if (url.pathname === '/api/admin/presence')
      return r.fulfill({ json: { teammates: [] } });
    if (url.pathname === '/api/admin/applications')
      return r.fulfill({ json: { applications: [] } });
    return r.fulfill({ json: {} });
  });
  return writes;
}

test('settings shows the live rules read-only, with honest not-live labels', async ({
  page,
}) => {
  await mock(page);
  await page.goto('/admin/settings');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Money' })).toBeVisible();
  await expect(main.getByText('1.0842')).toBeVisible();
  await expect(main.getByText('USD customers pay 1.0950 (+1%)')).toBeVisible();
  await expect(main.getByText('40%', { exact: true })).toBeVisible();
  await expect(
    main.getByRole('heading', { name: 'Customer reward levels Not live yet' }),
  ).toBeVisible();
  await expect(main.getByText('Not applied at checkout yet')).toBeVisible();
  await expect(main.getByText('Referral links:')).toContainText('Off');
  await expect(main.getByText('Owners configured:')).toContainText('Yes');
  // Read-only: no inputs, toggles or save buttons; no env names leak.
  await expect(
    main.locator('section input, section select, section textarea'),
  ).toHaveCount(0);
  await expect(main.getByRole('button', { name: /save/i })).toHaveCount(0);
  await expect(main).not.toContainText('ADMIN_EMAILS');
  await expect(main).not.toContainText('.env');
  await main.getByRole('button', { name: 'Users and roles' }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
});

test('creators lists codes, months and orders, and adds and pauses with audit', async ({
  page,
}) => {
  const writes = await mock(page);
  await page.goto('/admin/creators');
  const main = page.getByRole('main');
  const row = main.getByRole('row', { name: /ALPHA10 Alpha Streams/ });
  await expect(row).toContainText('Active');
  await expect(row).toContainText('€3.51');
  await expect(row).toContainText('below €50 minimum');
  await expect(main.getByText('Commission owed')).toBeVisible();
  await expect(main.getByText('Links are not tracked yet')).toBeVisible();
  await row.getByRole('button', { name: 'Months' }).click();
  await expect(
    main.getByRole('cell', { name: 'October 2026', exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole('cell', { name: 'Rising · 8%', exact: true }),
  ).toBeVisible();
  await expect(
    main
      .getByRole('row', { name: /DL-1001/ })
      .getByRole('cell')
      .last(),
  ).toHaveText('Yes');
  await expect(
    main
      .getByRole('row', { name: /DL-1002/ })
      .getByRole('cell')
      .last(),
  ).toHaveText('When completed');

  // Client-side validation stops a bad code before any request.
  await main.getByRole('textbox', { name: 'Code', exact: true }).fill('no');
  await main.getByLabel('Name', { exact: true }).fill('Beta');
  await main.getByRole('button', { name: 'Add creator' }).click();
  await expect(main.getByRole('alert')).toHaveText(
    'Codes are 3 to 20 letters or numbers.',
  );
  expect(writes).toHaveLength(0);

  await main.getByRole('textbox', { name: 'Code', exact: true }).fill('beta5');
  await main.getByRole('button', { name: 'Add creator' }).click();
  await expect(main.getByRole('row', { name: /BETA5 Beta/ })).toBeVisible();
  expect(writes[0]).toEqual({
    action: 'create',
    code: 'BETA5',
    name: 'Beta',
    channel: '',
    csrf: 'fixture-csrf',
  });

  // Duplicate code: the server refusal is shown.
  await main
    .getByRole('textbox', { name: 'Code', exact: true })
    .fill('ALPHA10');
  await main.getByLabel('Name', { exact: true }).fill('Copy');
  await main.getByRole('button', { name: 'Add creator' }).click();
  await expect(main.getByRole('alert')).toHaveText('That code is taken.');

  await row.getByRole('button', { name: 'Pause' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Pause ALPHA10?');
  await dialog.getByRole('button', { name: 'Pause' }).click();
  await expect(row).toContainText('Paused');
  await expect(row.getByRole('button', { name: 'Reactivate' })).toBeVisible();
  expect(writes.at(-1)).toEqual({
    action: 'setActive',
    creatorId: alpha.id,
    active: false,
    csrf: 'fixture-csrf',
  });
});

test('creators marks a finished month paid once owed reaches the minimum', async ({
  page,
}) => {
  const big = {
    ...alpha,
    id: '6c000000-0000-4000-8000-0000000000c3',
    code: 'GAMMA10',
    name: 'Gamma Streams',
    owedCents: 6000,
    months: [
      {
        month: '2026-09',
        orders: 30,
        baseCents: 60000,
        tier: 'partner',
        commission: 10,
        commissionCents: 6000,
      },
    ],
  };
  const writes = await mock(page, [big]);
  await page.goto('/admin/creators');
  const main = page.getByRole('main');
  const row = main.getByRole('row', { name: /GAMMA10 Gamma Streams/ });
  await row.getByRole('button', { name: 'Months' }).click();
  await main.getByRole('button', { name: 'Mark paid' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Mark September 2026 paid?');
  await dialog.getByLabel('Transfer reference').fill('BANK-77');
  await dialog.getByRole('button', { name: 'Mark paid' }).click();
  await expect(main.getByText(/Paid .*BANK-77/)).toBeVisible();
  expect(writes.at(-1)).toEqual({
    action: 'pay',
    creatorId: big.id,
    month: '2026-09',
    method: 'bank',
    reference: 'BANK-77',
    csrf: 'fixture-csrf',
  });
});
