import { test, expect, type Page } from '@playwright/test';

// Staying online across the site (src/components/teammate/desk-keeper.js), against fictional
// API answers: leaving the desk doesn't set the teammate offline, other pages keep checking in,
// and a new order shows a browser notification there, once (the bell rings on the desk only).

const order = (id: string) => ({
  id,
  public_reference: 'DL-' + id.slice(-1),
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
});

type State = {
  online: boolean;
  orders: unknown[];
  afkIn?: number | null;
  forced?: { reason: string; by: string } | null;
};

async function mock(page: Page, state: State) {
  const log: { path: string; body: unknown }[] = [];
  await page.addInitScript(() => {
    const w = window as unknown as { shown: string[]; bells: number };
    w.shown = [];
    w.bells = 0;
    class FakeNotification {
      static permission = 'granted';
      static requestPermission = async () => 'granted';
      onclick: null | (() => void) = null;
      constructor(title: string, options: { body?: string }) {
        w.shown.push(title + ' | ' + (options?.body ?? ''));
      }
      close() {}
    }
    (window as unknown as { Notification: unknown }).Notification =
      FakeNotification;
    HTMLMediaElement.prototype.play = function () {
      w.bells += 1;
      return Promise.resolve();
    };
  });
  await page.route('**/api/**', async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    const body = req.method() === 'POST' ? req.postDataJSON() : null;
    log.push({ path, body });
    if (path === '/api/teammate/presence') {
      if (body.action === 'set') state.online = body.online;
      return r.fulfill({
        json: {
          online: state.online,
          online_since: state.online ? '2026-11-04T10:00:00.000Z' : null,
          forced_offline: state.online ? null : (state.forced ?? null),
          afk_in: state.online ? (state.afkIn ?? 14400) : null,
        },
      });
    }
    if (path === '/api/teammate/queue-settings')
      return r.fulfill({
        json: {
          allowed_games: ['lol'],
          approved_games: ['lol'],
          enabled_games: ['lol'],
          gg_access: false,
          voice_opt_in: false,
        },
      });
    if (path === '/api/teammate/queue')
      return r.fulfill({ json: { orders: state.orders } });
    if (path === '/api/teammate/order')
      return r.fulfill({ json: { order: null } });
    if (path === '/api/teammate/streaming')
      return r.fulfill({ json: { streaming: null } });
    return r.fulfill({ json: {} });
  });
  return log;
}

test('another page keeps an online teammate online and pops up new orders once, without the bell', async ({
  page,
}) => {
  const state = {
    online: true,
    orders: [order('aa000000-0000-4000-8000-000000000001')],
  };
  const log = await mock(page, state);
  await page.goto('/other');
  await expect(
    page.getByRole('heading', { name: 'Another page' }),
  ).toBeVisible();
  // checks in right away, never turns them offline
  await expect
    .poll(() => log.filter((e) => e.path === '/api/teammate/presence').length)
    .toBeGreaterThan(0);
  // the order that was already there doesn't pop up; a new one does
  await expect
    .poll(() => log.filter((e) => e.path === '/api/teammate/queue').length)
    .toBeGreaterThan(0);
  state.orders = [
    ...state.orders,
    order('bb000000-0000-4000-8000-000000000002'),
  ];
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as unknown as { shown: string[] }).shown),
      {
        timeout: 15_000,
      },
    )
    .toEqual([
      'New Order Available! | New Order: Duo queue · League of Legends\nPrice: $12.34',
    ]);
  // off the desk: the popup only, no bell (the bell rings on the desk alone)
  expect(
    await page.evaluate(() => (window as unknown as { bells: number }).bells),
  ).toBe(0);
  // the next page of the same tab doesn't show it again
  await page.reload();
  await page.waitForTimeout(6000);
  expect(
    await page.evaluate(() => (window as unknown as { shown: string[] }).shown),
  ).toEqual([]);
  expect(
    await page.evaluate(() => (window as unknown as { bells: number }).bells),
  ).toBe(0);
  expect(
    log.some(
      (e) =>
        e.path === '/api/teammate/presence' &&
        (e.body as { action?: string }).action === 'set',
    ),
  ).toBe(false);
});

test('an offline teammate stays offline on other pages', async ({ page }) => {
  const state = { online: false, orders: [] };
  const log = await mock(page, state);
  await page.goto('/other');
  await page.waitForTimeout(12000);
  const presence = log.filter((e) => e.path === '/api/teammate/presence');
  expect(presence).toHaveLength(1); // one check-in, then the keeper stops
  expect(log.some((e) => e.path === '/api/teammate/queue')).toBe(false);
});

test('leaving the desk for another page doesn’t set the teammate offline', async ({
  page,
}) => {
  const state = { online: true, orders: [] };
  const log = await mock(page, state);
  await page.goto('/');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.waitForTimeout(1500);
  await page.goto('/other');
  await page.waitForTimeout(1500);
  expect(state.online).toBe(true);
  expect(
    log.some(
      (e) =>
        e.path === '/api/teammate/presence' &&
        (e.body as { online?: boolean }).online === false,
    ),
  ).toBe(false);
});

test('4 hours idle: warned 5 minutes before, then offline with its own wording', async ({
  page,
}) => {
  const state: State = { online: true, orders: [], afkIn: 240 };
  const log = await mock(page, state);
  await page.goto('/');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.locator('[data-afk-warning]').first()).toContainText(
    'Still there?',
    { timeout: 15_000 },
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { shown: string[] }).shown),
    )
    .toContainEqual(expect.stringMatching(/^Still there? |/));
  // a key press checks in right away with the new activity
  const before = log.filter((e) => e.path === '/api/teammate/presence').length;
  state.afkIn = 14400;
  await page.keyboard.press('Shift');
  await expect
    .poll(() => log.filter((e) => e.path === '/api/teammate/presence').length, {
      timeout: 4000,
    })
    .toBeGreaterThan(before);
  await expect(page.locator('[data-afk-warning]')).toHaveCount(0);
  // the server switched them offline
  state.online = false;
  state.forced = { reason: 'No activity for 4 hours', by: '' };
  await expect(
    page
      .getByText('You were set offline after 4 hours without any activity.')
      .first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('An admin set you offline')).toHaveCount(0);
});

test('other pages warn too, once', async ({ page }) => {
  const state: State = { online: true, orders: [], afkIn: 200 };
  await mock(page, state);
  await page.goto('/other');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { shown: string[] }).shown),
    )
    .toEqual([expect.stringMatching(/^Still there? |/)]);
  await page.waitForTimeout(11000); // the next check-in: still the same warning, no second popup
  expect(
    await page.evaluate(() => (window as unknown as { shown: string[] }).shown),
  ).toHaveLength(1);
});
