import React from 'react';
import { expect, test } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../../src/components/account/Dashboard.jsx';
import TrustScore from '../../src/components/teammate/TrustScore.jsx';

const history = {
  now: Date.now(),
  orders: [],
  mates: [],
  wallet: 20,
  walletCashable: 0,
  walletPromo: 20,
  refunds: 0,
  cashbackTotal: 12.34,
  cashbackMonth: 2.34,
  levelGifts: 20,
  gifted: 0,
  walletSpent: 0,
  lifetimeOrders: 250,
  weekOrders: 0,
  gamesPlayed: 250,
  rewards: {
    orders: 250,
    cashbackTotal: 12.34,
    cashbackMonth: 2.34,
    cashbackPending: 0.99,
    pendingOrders: 2,
    gifts: [
      { level: 'silver', amountEurCents: 500 },
      { level: 'gold', amountEurCents: 1500 },
    ],
    giftClaimed: true,
  },
};

test('original Rewards screen shows live level, received gifts and pending cashback', async ({
  page,
}) => {
  const dashboard = new Dashboard({
    user: { name: 'Rewards Customer', email: 'rewards@example.invalid' },
    onSignOut: () => undefined,
  });
  (dashboard.state as Record<string, unknown>).history = history;
  await page.setContent(renderToStaticMarkup(dashboard.render()));

  const rewards = page.locator('#rewards');
  await expect(rewards).toBeVisible();
  await expect(
    rewards.getByRole('heading', { name: 'Play more, get more back' }),
  ).toBeVisible();
  await expect(rewards).toContainText('Gold');
  await expect(rewards).toContainText('250 ORDERS');
  await expect(rewards).toContainText('€12.34');
  await expect(rewards).toContainText('€0.99');
  await expect(rewards).toContainText('pending from 2 orders');
  await expect(rewards).toContainText('Received');
  await expect(rewards).not.toContainText('Claim');
});

test('Gold priority matching is live while later perks remain coming soon', async ({
  page,
}) => {
  const dashboard = new Dashboard({
    user: { name: 'Rewards Customer', email: 'rewards@example.invalid' },
    onSignOut: () => undefined,
  });
  (dashboard.state as Record<string, unknown>).history = history;
  await page.setContent(renderToStaticMarkup(dashboard.render()));

  const rewards = page.locator('#rewards');
  await expect(
    rewards.locator('li').filter({ hasText: 'Priority matching' }),
  ).not.toContainText('coming soon');
  for (const perk of ['Free monthly Play and Learn', 'Pick any teammate']) {
    await expect(rewards.locator('li').filter({ hasText: perk })).toContainText(
      'coming soon',
    );
  }
});

test('customer teammate cards show the live Trusted badge', async ({
  page,
}) => {
  const dashboard = new Dashboard({
    user: { name: 'Rewards Customer', email: 'rewards@example.invalid' },
    onSignOut: () => undefined,
  });
  (dashboard.state as Record<string, unknown>).history = {
    ...history,
    mates: [
      {
        id: 'trusted-mate',
        name: 'Mika Star',
        image: '/assets/avatars/avatar-2.png',
        country: 'de',
        main: 'lol',
        orders: 3,
        rating: 5,
        online: null,
        trustBadge: { id: 'trusted', name: 'Trusted' },
      },
    ],
  };
  await page.setContent(renderToStaticMarkup(dashboard.render()));

  const card = page.locator('#mates-h').locator('..').getByRole('listitem');
  await expect(card).toContainText('Mika');
  await expect(card).toContainText('Trusted');
});

test('teammate TrustScore shows Trusted and Legend badge thresholds', async ({
  page,
}) => {
  await page.setContent(
    renderToStaticMarkup(
      React.createElement(
        'main',
        null,
        React.createElement(TrustScore, { completed: 100, held: 0, saved: 0 }),
        React.createElement(TrustScore, {
          completed: 1000,
          held: 0,
          saved: 0,
        }),
      ),
    ),
  );

  await expect(page.locator('[data-trust-badge="trusted"]')).toHaveText(
    /Trusted/,
  );
  await expect(page.locator('[data-trust-badge="legend"]')).toHaveText(
    /Legend/,
  );
});
