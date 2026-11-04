import { test, expect, type Page } from '@playwright/test';

// Restored original admin layouts (parity audit #3 to #9, #15) against fictional API answers.
const NOW = Date.now();
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const baseOrder = {
  game: 'lol',
  service: 'Duo Queue',
  unit: 'game',
  region: 'EUW',
  rank: 'Gold',
  gg: false,
  voice: true,
  fx: 1.0842,
  rerolls: 0,
  customer: 'Fixture Customer',
  customerAv: '/assets/avatars/avatar-1.png',
  teammate: null,
  teammateAv: null,
  refundCents: 0,
  review: null,
  acceptedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelReason: null,
};
const orders = [
  {
    ...baseOrder,
    orderId: 'o-1',
    id: 'DL-2001',
    status: 'queued',
    units: 2,
    amountCents: 2000,
    payoutUsdCents: 1300,
    createdAt: iso(60_000),
    queuedAt: iso(60_000),
    payment: { state: 'authorized', method: 'card', stripeId: 'pi_fixture_1' },
  },
  {
    ...baseOrder,
    orderId: 'o-2',
    id: 'DL-2002',
    status: 'in_progress',
    units: 1,
    amountCents: 1000,
    payoutUsdCents: 650,
    createdAt: iso(1_800_000),
    queuedAt: iso(1_800_000),
    acceptedAt: iso(1_700_000),
    teammate: 'Fixture Mate',
    teammateId: '77777777-7777-4777-8777-777777777777',
    teammateRating: 4.9,
    teammateTrust: { trust_tier: 'trusted', deposit_percent: 8 },
    customerOrderCount: 3,
    customerLoyalty: { id: 'bronze', name: 'Bronze', cashback: 1 },
    depositPercent: 8,
    depositHeldUsdCents: 52,
    teammateNetUsdCents: 598,
    cashbackPercent: 1,
    cashbackEurCents: 10,
    payment: { state: 'captured', method: 'card', stripeId: 'pi_fixture_2' },
  },
  {
    ...baseOrder,
    orderId: 'o-3',
    id: 'DL-2003',
    status: 'cancelled',
    units: 1,
    amountCents: 1000,
    payoutUsdCents: 650,
    createdAt: iso(3_600_000),
    queuedAt: iso(3_600_000),
    cancelledAt: iso(3_300_000),
    cancelReason: 'queue_expired',
    payment: { state: 'released', method: 'card', stripeId: 'pi_fixture_3' },
  },
];
const presence = {
  now: NOW,
  online: [
    {
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Fixture Mate',
      image: '/assets/avatars/avatar-1.png',
      admin: false,
      playing: true,
      games: ['lol'],
      since: iso(3_600_000),
      lastActive: iso(30_000),
      order: { id: 'DL-2002', title: 'Duo Queue', games: 1, unit: 'game' },
    },
    {
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Idle Mate',
      image: '/assets/avatars/avatar-1.png',
      admin: false,
      playing: false,
      games: ['val'],
      since: iso(7_200_000),
      lastActive: iso(40 * 60_000),
      order: null,
    },
  ],
};
const teammates = [
  {
    id: '77777777-7777-4777-8777-777777777777',
    name: 'Fixture Mate',
    image: '/assets/avatars/avatar-1.png',
    country: 'at',
    games: ['lol'],
    online: true,
    playing: true,
    joined: iso(30 * 86_400_000),
    lastSeen: iso(30_000),
    completed: 12,
    earned30UsdCents: 4200,
    rating: 4.9,
    reviews: 8,
    warnings: 0,
    suspended: null,
    discord: true,
    trust: { trust_tier: 'trusted', deposit_percent: 8 },
    depositHeldUsdCents: 250,
    payout: { due: 12.5, owed: 0 },
  },
];
const applications = [
  {
    id: 'a-1',
    reference: 'AP-1001',
    name: 'Applicant One',
    email: 'applicant@example.test',
    discord: 'applicant_one',
    country: 'at',
    game: 'lol',
    rank: 'Diamond',
    region: 'EUW',
    hours: '20',
    services: ['Duo Queue'],
    why: 'I like coaching.',
    link: '',
    video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    status: 'pending',
    submittedAt: iso(3_600_000),
    decidedAt: null,
    decidedBy: null,
    reason: null,
  },
];

async function mock(page: Page) {
  await page.route('**/api/**', async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/api/admin/orders') return r.fulfill({ json: { orders } });
    if (path === '/api/admin/overview')
      return r.fulfill({
        json: {
          queuedOrders: 1,
          activeOrders: 2,
          pendingApplications: 1,
          reportsOpen: 0,
          payoutsDue: 1,
          payoutsDueUsdCents: 1250,
        },
      });
    if (path === '/api/admin/presence') return r.fulfill({ json: presence });
    if (path === '/api/admin/priority')
      return r.fulfill({
        json: {
          accounts: [
            {
              id: presence.online[0]!.id,
              prio: 30,
              effective: 30,
              adj: null,
              penalty: 0,
              missed: 0,
            },
          ],
        },
      });
    if (path === '/api/admin/teammates')
      return r.fulfill({ json: { teammates } });
    if (path === '/api/admin/applications')
      return r.fulfill({ json: { applications } });
    if (path === '/api/admin/audit')
      return r.fulfill({ json: { entries: [] } });
    return r.fulfill({ json: {} });
  });
}

test('live desk restores the order desk and online cards', async ({ page }) => {
  await mock(page);
  await page.goto('/admin/live');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Order desk' })).toBeVisible();
  await expect(main.getByText('Watching the queue')).toBeVisible();
  await expect(main.getByText('Admin · always on')).toBeVisible();
  await expect(
    main.getByRole('heading', { name: 'Available orders' }),
  ).toBeVisible();
  const queued = main.getByRole('listitem', { name: 'Order DL-2001' });
  await expect(queued).toContainText('2 games');
  await expect(queued).toContainText(/\d:\d\d left/);
  await expect(
    queued.getByRole('button', { name: 'Handover link' }),
  ).toBeVisible();
  await expect(
    main.getByRole('heading', { name: 'Being played right now' }),
  ).toBeVisible();
  await expect(
    main.getByText('DL-2002 · Duo Queue for Fixture Customer'),
  ).toBeVisible();
  await expect(
    main.getByRole('heading', { name: 'Auto-cancelled' }),
  ).toBeVisible();
  await expect(main.getByText('Not charged')).toBeVisible();
  await expect(
    main.getByRole('heading', { name: 'Online right now' }),
  ).toBeVisible();
  await expect(main.getByText('PRIO 30')).toBeVisible();
  const online = main.getByRole('region', { name: 'Online right now' });
  await online.getByRole('button', { name: /^Idle/ }).click();
  await expect(online.getByText('Idle Mate')).toBeVisible();
  await expect(online.getByText('AFK?')).toBeVisible();
  await expect(online.getByText('Fixture Mate', { exact: true })).toHaveCount(
    0,
  );
  // the header badge says what is shared, like the original
  await expect(page.getByText('Live · shared with teammates')).toBeVisible();
  // sidebar counts the queue on Live desk
  await expect(page.getByRole('link', { name: /Live desk\s*1/ })).toBeVisible();
});

test('applications are a tab inside Teammates with a real URL', async ({
  page,
}) => {
  await mock(page);
  await page.goto('/admin/teammates');
  const main = page.getByRole('main');
  const tabs = main.getByRole('tablist', { name: 'Teammates' });
  await expect(
    tabs.getByRole('tab', { name: /Teammates\s*1/ }),
  ).toHaveAttribute('aria-selected', 'true');
  const row = main.getByRole('row', { name: /Fixture Mate/ });
  await expect(row).toContainText('★ 4.90');
  await expect(row).toContainText('Trusted');
  await expect(row).toContainText('$2.50');
  await expect(row).toContainText('$12.50');
  await expect(row).not.toContainText('Soon');
  await expect(
    row.getByRole('button', { name: 'Adjust balance' }),
  ).toBeEnabled();
  await expect(page.getByText('Live · partly connected')).toHaveCount(0);
  // no separate Applications entry in the sidebar; Teammates carries the pending count
  await expect(page.getByRole('link', { name: /^Applications/ })).toHaveCount(
    0,
  );
  await tabs.getByRole('tab', { name: /Applications\s*1/ }).click();
  await expect(page).toHaveURL(/\/admin\/applications$/);
  await expect(main.getByText('Applicant One')).toBeVisible();
  await expect(
    main.getByText(/applicant@example\.test · Discord/),
  ).toBeVisible();
  // the required intro video, opened on YouTube
  await expect(
    main.getByRole('link', {
      name: 'Watch Applicant One’s intro video on YouTube',
    }),
  ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.goto('/admin/applications');
  await expect(main.getByRole('tab', { name: /Applications/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(
    page.getByRole('link', { name: /Teammates/ }).first(),
  ).toHaveAttribute('aria-current', 'page');
});

test('orders drawer shows the original money rows and timeline', async ({
  page,
}) => {
  await mock(page);
  await page.goto('/admin/orders');
  const main = page.getByRole('main');
  await main.getByRole('row', { name: /DL-2002/ }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('Customer paid')).toBeVisible();
  await expect(drawer.getByText('Duoly fee (40%)')).toBeVisible();
  await expect(drawer.getByText('Teammate share')).toBeVisible();
  await expect(drawer.getByText('Security deposit (8%)')).toBeVisible();
  await expect(drawer.getByText('Teammate net pay')).toBeVisible();
  await expect(drawer.getByText('Cashback to customer (1%)')).toBeVisible();
  await expect(drawer.getByText('Bronze · 3 orders')).toBeVisible();
  await expect(drawer.getByText('Trusted · ★ 4.90')).toBeVisible();
  await expect(drawer.getByText('Not live yet')).toHaveCount(0);
  await expect(drawer.getByText('Paid with Card')).toBeVisible();
  await expect(
    drawer.getByText(/Matched with Fixture Mate after/),
  ).toBeVisible();
  await expect(drawer.getByText('Playing now')).toBeVisible();
});
