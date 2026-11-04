import { test, expect } from '@playwright/test';

// Admin, Users, Order access: granting Twitch streaming per game (migration 20261105100000),
// against fictional API answers. Only games the teammate can take are offered.

const mate = {
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Lea Streamer',
  email: 'lea@example.test',
  image: '',
  country: 'at',
  provider: 'email',
  role: 'teammate',
  owner: false,
  you: false,
  roleBy: '',
  roleAt: '2026-11-01T10:00:00.000Z',
  firstSeen: '2026-10-01T10:00:00.000Z',
  lastSeen: '2026-11-04T10:00:00.000Z',
  discord: 'lea',
  access: { games: ['lol', 'val'], gg: false, suspended: false, stream: [] },
  busy: false,
};

test('admins grant streaming for approved games only', async ({ page }) => {
  const posts: Record<string, unknown>[] = [];
  let access = { ...mate.access };
  await page.route('**/api/**', async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/admin/users') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        posts.push(body);
        // the shapes admin_set_access and admin_set_stream_access return
        if (body.access) {
          access = { ...access, games: body.access.games, gg: body.access.gg };
          return r.fulfill({
            json: { access: { games: access.games, gg: access.gg } },
          });
        }
        access = { ...access, stream: body.streamGames };
        return r.fulfill({ json: { access: { stream: access.stream } } });
      }
      return r.fulfill({ json: { accounts: [{ ...mate, access }] } });
    }
    return r.fulfill({ json: {} });
  });
  await page.goto('/admin/users');
  const main = page.getByRole('main');
  await expect(main.getByText('Lea Streamer').first()).toBeVisible({
    timeout: 15_000,
  });
  await main.getByRole('button', { name: 'Edit access' }).first().click();

  const streaming = main.getByRole('group', {
    name: 'Twitch streaming games for Lea Streamer',
  });
  // offered: League and Valorant (their games), nothing else
  await expect(streaming.getByRole('button')).toHaveCount(2);
  await streaming
    .getByRole('button', { name: 'Stream League of Legends' })
    .click();
  await main.getByRole('button', { name: 'Save access' }).click();

  await expect
    .poll(() => posts.find((p) => 'streamGames' in p))
    .toEqual({
      csrf: expect.any(String),
      userId: mate.id,
      streamGames: ['lol'],
    });
  await expect(main.getByText('Twitch · 1 game')).toBeVisible();
});
