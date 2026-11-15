import { test, expect } from '@playwright/test';

// Admin, Users, Order access: Plus only per game (migration 20261115140000), against fictional API
// answers. Only games the teammate can take are offered, and other games stay Standard.

const mate = {
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Max Climber',
  email: 'max@example.test',
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
  discord: 'max',
  access: { games: ['lol', 'val'], gg: false, suspended: false, stream: [] },
  busy: false,
};

test('admins make a teammate Plus only in one game, Standard in the others', async ({
  page,
}) => {
  const posts: Record<string, unknown>[] = [];
  let plusOnly: string[] = [];
  let access = { ...mate.access };
  await page.route('**/api/**', async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/admin/duo-levels') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        posts.push(body);
        plusOnly = body.plusOnly;
        return r.fulfill({ json: { userId: body.userId, plusOnly } });
      }
      return r.fulfill({ json: { plusOnly: { [mate.id]: plusOnly } } });
    }
    if (path === '/api/admin/users') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        posts.push(body);
        access = { ...access, games: body.access.games, gg: body.access.gg };
        return r.fulfill({
          json: { access: { games: access.games, gg: access.gg } },
        });
      }
      return r.fulfill({ json: { accounts: [{ ...mate, access }] } });
    }
    return r.fulfill({ json: {} });
  });
  await page.goto('/admin/users');
  const main = page.getByRole('main');
  await expect(main.getByText('Max Climber').first()).toBeVisible({
    timeout: 15_000,
  });
  await main.getByRole('button', { name: 'Edit access' }).first().click();

  const plus = main.getByRole('group', {
    name: 'Plus only games for Max Climber',
  });
  // offered: League and Valorant (their games), nothing else; none picked yet
  await expect(plus.getByRole('button')).toHaveCount(2);
  await expect(plus.getByRole('button', { pressed: true })).toHaveCount(0);
  await plus.getByRole('button', { name: 'Plus only in Valorant' }).click();
  await main.getByRole('button', { name: 'Save access' }).click();

  await expect
    .poll(() => posts.find((p) => 'plusOnly' in p))
    .toEqual({
      csrf: expect.any(String),
      userId: mate.id,
      plusOnly: ['val'],
    });
  await expect(main.getByText('Plus only · Valorant')).toBeVisible();
});

test('a game they no longer take is dropped from Plus only', async ({
  page,
}) => {
  const posts: Record<string, unknown>[] = [];
  let access = { ...mate.access };
  await page.route('**/api/**', async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/admin/duo-levels') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        posts.push(body);
        return r.fulfill({
          json: { userId: body.userId, plusOnly: body.plusOnly },
        });
      }
      return r.fulfill({ json: { plusOnly: { [mate.id]: ['lol', 'val'] } } });
    }
    if (path === '/api/admin/users') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        posts.push(body);
        access = { ...access, games: body.access.games, gg: body.access.gg };
        return r.fulfill({
          json: { access: { games: access.games, gg: access.gg } },
        });
      }
      return r.fulfill({ json: { accounts: [{ ...mate, access }] } });
    }
    return r.fulfill({ json: {} });
  });
  await page.goto('/admin/users');
  const main = page.getByRole('main');
  await expect(main.getByText('Max Climber').first()).toBeVisible({
    timeout: 15_000,
  });
  await main.getByRole('button', { name: 'Edit access' }).first().click();
  // take League away: it leaves the Plus only list too
  await main
    .getByRole('group', { name: 'Games for Max Climber', exact: true })
    .getByRole('button', { name: 'League of Legends' })
    .click();
  await expect(
    main
      .getByRole('group', { name: 'Plus only games for Max Climber' })
      .getByRole('button'),
  ).toHaveCount(1);
  await main.getByRole('button', { name: 'Save access' }).click();
  await expect
    .poll(() => posts.find((p) => 'plusOnly' in p))
    .toEqual({
      csrf: expect.any(String),
      userId: mate.id,
      plusOnly: ['val'],
    });
});
