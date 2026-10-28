import { test, expect, type Page, type Route } from '@playwright/test';

// Stripe Connect payouts (M9, ledger #14 phase 2) against fictional API answers.
const me = '44444444-4444-4444-8444-444444444444';
const stats = {
  now: 1,
  me,
  stats: {
    completed: 2,
    tier: { name: 'Rookie', deposit: 10 },
    held: 0,
    released: 0,
    forfeited: 0,
    saved: 0,
    progress: { current: 2, next: 100, remaining: 98, percent: 2 },
    rating: null,
    reviews: 0,
    tipsTotal: 0,
    recent: [],
    latestReviews: [],
    adjustments: [],
    payout: {
      weekStart: 1_699_570_800_000,
      weekEnd: 1_700_175_600_000,
      due: 12.34,
      carried: 0,
      held: 0,
      minimum: 10,
      details: true,
      owed: 0,
      history: [],
    },
  },
  leaderboard: {
    week: { global: [] },
    month: { global: [] },
    all: { global: [] },
  },
};

const desk = async (
  page: Page,
  connect: (route: Route) => Promise<void> | void,
  query = '?connect=on',
) => {
  await page.route('**/api/**', async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/api/teammate/connect') return connect(r);
    if (path === '/api/teammate/stats') return r.fulfill({ json: stats });
    if (path === '/api/teammate/presence')
      return r.fulfill({
        json: { online: false, online_since: null, forced_offline: null },
      });
    if (path === '/api/teammate/queue')
      return r.fulfill({ json: { orders: [] } });
    if (path === '/api/teammate/order')
      return r.fulfill({ json: { order: null } });
    if (path === '/api/teammate/queue-settings')
      return r.fulfill({
        json: {
          allowed_games: ['lol'],
          enabled_games: ['lol'],
          gg_access: false,
          voice_opt_in: false,
        },
      });
    return r.fulfill({ json: {} });
  });
  await page.goto('/' + query);
  await expect.poll(() => page.locator('astro-island[ssr]').count()).toBe(0);
};

test('teammate desk shows Stripe setup and starts onboarding', async ({
  page,
}) => {
  const posts: unknown[] = [];
  await desk(page, async (r) => {
    if (r.request().method() === 'POST') {
      posts.push(r.request().postDataJSON());
      return r.fulfill({
        status: 409,
        json: {
          error:
            'Stripe payouts are not available in your country yet. We keep paying you manually.',
        },
      });
    }
    return r.fulfill({
      json: {
        enabled: true,
        connect: { status: 'not_started', account: false },
        details: true,
        countries: ['AT'],
      },
    });
  });
  const group = page.getByRole('group', { name: 'Stripe payouts' });
  await expect(group).toContainText('Not started');
  await group
    .getByRole('button', { name: 'Set up payouts with Stripe' })
    .click();
  await expect
    .poll(() => posts)
    .toEqual([{ csrf: 'fixture-csrf', action: 'onboard' }]);
  await expect(
    page.getByText('Stripe payouts are not available in your country yet.', {
      exact: false,
    }),
  ).toBeVisible();
});

test('teammate desk shows each Stripe status and refreshes it', async ({
  page,
}) => {
  let status = 'pending';
  const reads: string[] = [];
  await desk(page, (r) => {
    reads.push(new URL(r.request().url()).search);
    return r.fulfill({
      json: {
        enabled: true,
        connect: { status, account: true, payoutFailed: false },
        details: true,
      },
    });
  });
  const group = page.getByRole('group', { name: 'Stripe payouts' });
  await expect(group).toContainText('Pending verification');
  await expect(
    group.getByRole('button', { name: 'Continue setup with Stripe' }),
  ).toBeVisible();
  status = 'restricted';
  await group.getByRole('button', { name: 'Refresh status' }).click();
  await expect(group).toContainText('Restricted');
  status = 'ready';
  await group.getByRole('button', { name: 'Refresh status' }).click();
  await expect(group).toContainText('Ready');
  await expect(
    group.getByRole('button', { name: 'Update details in Stripe' }),
  ).toBeVisible();
  expect(reads).toEqual(['', '?sync=1', '?sync=1']);
});

test('without the flag the teammate desk keeps the manual payout panel only', async ({
  page,
}) => {
  let calls = 0;
  await desk(
    page,
    (r) => {
      calls++;
      return r.fulfill({ json: { enabled: false } });
    },
    '',
  );
  await expect(
    page.getByRole('button', { name: 'Edit payout details' }),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: 'Stripe payouts' })).toHaveCount(
    0,
  );
  expect(calls).toBe(0);
});
