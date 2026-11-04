import { test, expect } from '@playwright/test';

// "Pick any teammate" on the teammate desk and the live matching perks on the trust card,
// against fictional API answers.

const me = '44444444-4444-4444-8444-444444444444';
const pickedId = '12121212-1212-4212-8212-121212121212';
const picked = {
  id: pickedId,
  public_reference: 'DL-77',
  status: 'queued',
  game: 'lol',
  service: 'duo',
  title: 'Duo queue',
  units: 1,
  unit: 'game',
  gg: false,
  rank: 'Gold',
  region: 'EUW',
  ign: 'Player#EUW',
  note: '',
  voice: false,
  customer_name: 'Dana',
  customer_image: '/assets/avatars/avatar-2.png',
  customer_country: 'at',
  payout_usd_cents: 1234,
  current_assignment_id: null,
};
const stats = (completed: number) => ({
  now: 1,
  me,
  stats: {
    completed,
    tier: { name: 'Veteran', deposit: 5 },
    held: 0,
    released: 0,
    forfeited: 0,
    saved: 0,
    progress: { current: completed, next: 500, remaining: 200, percent: 20 },
    rating: null,
    reviews: 0,
    tipsTotal: 0,
    recent: [],
    latestReviews: [],
    adjustments: [],
    payout: {
      weekStart: 1_699_570_800_000,
      weekEnd: 1_700_175_600_000,
      due: 0,
      carried: 0,
      held: 0,
      minimum: 25,
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
});

test('picked for you: badge, bell, Pass and toast', async ({ page }) => {
  // Count new-order bells without playing sound.
  await page.addInitScript(() => {
    (window as unknown as { bells: number }).bells = 0;
    HTMLMediaElement.prototype.play = function () {
      if (String(this.src).includes('order-bell'))
        (window as unknown as { bells: number }).bells += 1;
      return Promise.resolve();
    };
  });
  let online = false;
  let queueReads = 0;
  let passed = false;
  const passes: unknown[] = [];
  await page.route('**/api/**', async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/teammate/presence') {
      const command = req.postDataJSON();
      if (command.action === 'set') online = command.online;
      return r.fulfill({
        json: {
          online,
          online_since: online ? '2026-10-28T10:00:00.000Z' : null,
          forced_offline: null,
        },
      });
    }
    if (path === '/api/teammate/stats') return r.fulfill({ json: stats(300) });
    if (path === '/api/teammate/queue-settings')
      return r.fulfill({
        json: {
          allowed_games: ['lol'],
          enabled_games: ['lol'],
          gg_access: false,
          voice_opt_in: false,
        },
      });
    if (path === '/api/teammate/queue') {
      // The first online snapshot is silent; the picked order arrives after it.
      if (!online || queueReads++ === 0)
        return r.fulfill({ json: { orders: [] } });
      return r.fulfill({
        json: {
          orders: [passed ? picked : { ...picked, picked_for_you: true }],
        },
      });
    }
    if (path === '/api/teammate/order')
      return r.fulfill({ json: { order: null } });
    if (path === `/api/teammate/orders/${pickedId}/pass`) {
      passes.push(req.postDataJSON());
      passed = true;
      return r.fulfill({ json: { passed: true } });
    }
    return r.fulfill({ json: {} });
  });
  await page.goto('/');
  await expect.poll(() => page.locator('astro-island[ssr]').count()).toBe(0);
  await page
    .getByRole('switch', { name: 'Go online' })
    .first()
    .dispatchEvent('click');
  const row = page.locator('li[data-picked="true"]');
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText('Picked for you');
  await expect(row).toContainText(
    'A past customer asked for you. Only you can take this for a moment.',
  );
  await expect(row).toContainText('DL-77');
  // A picked order is a new order: the bell rings like for any other.
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { bells: number }).bells),
    )
    .toBeGreaterThan(0);
  await row.getByRole('button', { name: 'Pass' }).dispatchEvent('click');
  await expect.poll(() => passes).toEqual([{ csrf: 'fixture-csrf' }]);
  await expect(page.getByText('Passed. It went to everyone.')).toBeVisible();
  await expect(page.locator('li[data-picked="true"]')).toHaveCount(0);
  // Still in the normal queue for everyone, this teammate included.
  await expect(page.getByText('DL-77', { exact: true })).toBeVisible();
  // No seconds, priority or delay numbers on the desk.
  await expect(page.locator('body')).not.toContainText('60 seconds');
  await expect(page.locator('body')).not.toContainText('head start');

  // Trust card at Veteran: the high-value perk is active, priority matching unlocks at Elite.
  const trust = page.locator('#trust');
  await expect(
    trust.getByText('Orders of €20 or more reach you first', { exact: false }),
  ).toBeVisible();
  await expect(
    trust.getByText('You get matched faster', { exact: false }),
  ).toBeVisible();
  await expect(trust.locator('[data-perk-active]')).toHaveCount(1);
  await expect(trust).not.toContainText('coming soon');
});
