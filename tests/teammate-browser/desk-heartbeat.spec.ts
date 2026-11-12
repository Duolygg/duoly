import { test, expect, type Page } from '@playwright/test';

// One desk heartbeat per browser and the leaving beacon
// (src/components/teammate/presence-leader.js, docs/product/background-work.md), against
// fictional API answers. What this holds onto: several tabs of one browser write one check-in per
// 10 seconds instead of one each, the cadence itself does not change, and closing the LAST tab
// asks for a presence-check timer without ever writing "offline".

type Call = {
  /** Which tab the call came from: one route handler per page. */
  tab: string;
  path: string;
  body: { action?: string; online?: boolean } | null;
};

async function mock(page: Page, log: Call[], tab = 'only') {
  await page.route('**/api/**', async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    const body = req.method() === 'POST' ? req.postDataJSON() : null;
    log.push({ tab, path, body });
    if (path === '/api/teammate/presence')
      return r.fulfill({
        json: {
          online: true,
          online_since: '2026-11-04T10:00:00.000Z',
          forced_offline: null,
          afk_in: 14400,
        },
      });
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
      return r.fulfill({ json: { orders: [] } });
    if (path === '/api/teammate/order')
      return r.fulfill({ json: { order: null } });
    if (path === '/api/teammate/streaming')
      return r.fulfill({ json: { streaming: null } });
    return r.fulfill({ json: {} });
  });
}

const presence = (log: Call[]) =>
  log.filter((e) => e.path === '/api/teammate/presence');
const checkIns = (log: Call[]) => presence(log).length;

const ready = async (page: Page, log: Call[]) => {
  await expect(
    page.getByRole('heading', { name: 'Another page' }),
  ).toBeVisible();
  await expect.poll(() => checkIns(log)).toBeGreaterThan(0);
};

test('two tabs of one browser keep one heartbeat between them', async ({
  context,
}) => {
  const log: Call[] = [];
  const first = await context.newPage();
  await mock(first, log, 'first');
  await first.goto('/other');
  await ready(first, log);

  const second = await context.newPage();
  await mock(second, log, 'second');
  await second.goto('/other');
  await ready(second, log);

  // Both tabs check in as they mount, which is what gives each of them its own first answer.
  // After that one writer is enough.
  const settled = checkIns(log);
  await first.waitForTimeout(21_000);
  const steady = presence(log).slice(settled);
  // The heartbeat never stops: the 10 s cadence is unchanged.
  expect(steady.length).toBeGreaterThan(1);
  // One tab did the writing. The other is allowed one, because a leader whose request is slow on a
  // loaded dev server is exactly what the watchdog is for, and taking over is the right answer. Two
  // independent writers would both be at 2 or more here.
  const perTab = ['first', 'second'].map(
    (tab) => steady.filter((e) => e.tab === tab).length,
  );
  expect(Math.min(...perTab)).toBeLessThanOrEqual(1);
  // And one tab's worth of writes overall, not two.
  expect(steady.length).toBeLessThanOrEqual(3);

  // Nobody was ever switched offline on the way.
  expect(
    log.some(
      (e) => e.path === '/api/teammate/presence' && e.body?.online === false,
    ),
  ).toBe(false);
  await second.close();
  await first.close();
});

test('the last tab asks for a presence check and never writes offline', async ({
  context,
}) => {
  const log: Call[] = [];
  const page = await context.newPage();
  await mock(page, log);
  await page.goto('/other');
  await ready(page, log);

  await page.evaluate(() =>
    window.dispatchEvent(new Event('pagehide', { cancelable: false })),
  );
  await expect
    .poll(
      () =>
        log.filter(
          (e) =>
            e.path === '/api/teammate/presence' && e.body?.action === 'leaving',
        ).length,
    )
    .toBe(1);
  expect(
    log.some(
      (e) => e.path === '/api/teammate/presence' && e.body?.online === false,
    ),
  ).toBe(false);
  await page.close();
});

test('a tab that is not the last one sends no beacon', async ({ context }) => {
  const log: Call[] = [];
  const first = await context.newPage();
  await mock(first, log, 'first');
  await first.goto('/other');
  await ready(first, log);

  const second = await context.newPage();
  await mock(second, log, 'second');
  await second.goto('/other');
  await ready(second, log);

  await second.evaluate(() =>
    window.dispatchEvent(new Event('pagehide', { cancelable: false })),
  );
  await first.waitForTimeout(2000);
  expect(
    log.some(
      (e) =>
        e.path === '/api/teammate/presence' && e.body?.action === 'leaving',
    ),
  ).toBe(false);
  await second.close();
  await first.close();
});
