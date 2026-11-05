import { test, expect, type Page } from '@playwright/test';

// Twitch streaming panel on the teammate desk (migration 20261105100000), against fictional
// API answers: hidden without streaming access; with it, rate, hours, Twitch name and going live.

const desk = {
  games: ['lol', 'val'],
  streamOnline: false,
  live: false,
  deskOnline: true,
  rateEurCents: null as number | null,
  durations: [1, 2],
  twitch: null as string | null,
  name: 'Lea',
};

async function mock(
  page: Page,
  streaming: typeof desk | null,
  posts: unknown[],
) {
  await page.route('**/api/**', async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/teammate/streaming') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        posts.push(body);
        streaming = {
          ...streaming!,
          streamOnline: body.online,
          live: body.online,
          rateEurCents: body.rateEurCents,
          durations: body.durations,
          twitch: body.twitch || null,
        };
      }
      return r.fulfill({ json: { streaming } });
    }
    if (path === '/api/teammate/presence')
      return r.fulfill({
        json: { online: false, online_since: null, forced_offline: null },
      });
    if (path === '/api/teammate/queue-settings')
      return r.fulfill({
        json: {
          allowed_games: ['lol'],
          enabled_games: ['lol'],
          gg_access: false,
          voice_opt_in: false,
        },
      });
    if (path === '/api/teammate/queue')
      return r.fulfill({ json: { orders: [] } });
    if (path === '/api/teammate/order')
      return r.fulfill({ json: { order: null } });
    return r.fulfill({ json: {} });
  });
}

test('no streaming access: no panel', async ({ page }) => {
  await mock(page, null, []);
  await page.goto('/');
  await expect.poll(() => page.locator('astro-island[ssr]').count()).toBe(0);
  await expect(page.locator('[data-streaming-panel]')).toHaveCount(0);
});

test('streamer sets a rate and hours, then goes live', async ({ page }) => {
  const posts: unknown[] = [];
  await mock(page, { ...desk }, posts);
  await page.goto('/');
  const panel = page.locator('[data-streaming-panel]');
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await expect(panel).toContainText('Offline for streaming');
  await expect(panel).toContainText('League of Legends, Valorant');

  const go = panel.getByRole('button', { name: 'Go online for streaming' });
  await expect(go).toBeDisabled(); // no rate yet
  await panel.getByLabel('Hourly rate (€)').fill('15');
  await expect(panel).toContainText('You keep €9 per hour (60%)');
  await panel.getByRole('button', { name: '3 h' }).click();
  await panel.getByRole('button', { name: '1 h' }).click();
  await expect(go).toBeDisabled(); // no Twitch username yet
  await panel.getByLabel('Twitch username').fill('lea_tv');
  await go.click();

  await expect(panel).toContainText('Live · customers can book you');
  await expect(
    panel.getByRole('button', { name: 'Go offline for streaming' }),
  ).toBeVisible();
  expect(posts).toEqual([
    {
      csrf: 'fixture-csrf',
      online: true,
      rateEurCents: 1500,
      durations: [2, 3],
      twitch: 'lea_tv',
    },
  ]);
});
