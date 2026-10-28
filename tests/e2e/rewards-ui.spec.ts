import { expect, test } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../../src/components/account/Dashboard.jsx';

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

test('unbuilt Gold, Platinum and Diamond perks are marked coming soon', async ({
  page,
}) => {
  const dashboard = new Dashboard({
    user: { name: 'Rewards Customer', email: 'rewards@example.invalid' },
    onSignOut: () => undefined,
  });
  (dashboard.state as Record<string, unknown>).history = history;
  await page.setContent(renderToStaticMarkup(dashboard.render()));

  const rewards = page.locator('#rewards');
  for (const perk of [
    'Priority matching',
    'Free monthly Play and Learn',
    'Pick any teammate',
  ]) {
    await expect(rewards.locator('li').filter({ hasText: perk })).toContainText(
      'coming soon',
    );
  }
});
