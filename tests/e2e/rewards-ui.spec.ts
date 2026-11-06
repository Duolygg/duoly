import React from 'react';
import { expect, test } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../../src/components/account/Dashboard.jsx';
import TrustScore from '../../src/components/teammate/TrustScore.jsx';
import { PRO_OFFER } from '../../src/contracts/pro';

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

test('Gold re-rolls are live while later perks stay coming soon until the server has perks', async ({
  page,
}) => {
  const dashboard = new Dashboard({
    user: { name: 'Rewards Customer', email: 'rewards@example.invalid' },
    onSignOut: () => undefined,
  });
  (dashboard.state as Record<string, unknown>).history = history;
  await page.setContent(renderToStaticMarkup(dashboard.render()));

  const rewards = page.locator('#rewards');
  // "Priority matching" was removed from the Gold perks on 2026-11-06 (owner decision).
  await expect(rewards).not.toContainText('Priority matching');
  await expect(rewards).not.toContainText('Pick any teammate');
  await expect(
    rewards.locator('li').filter({ hasText: '4 free re-rolls' }),
  ).not.toContainText('coming soon');
  for (const perk of ['Free monthly Play and Learn', 'Free Duoly PRO']) {
    await expect(rewards.locator('li').filter({ hasText: perk })).toContainText(
      'coming soon',
    );
  }
});

const perksFor = (
  level: 'gold' | 'platinum' | 'diamond',
  available: boolean,
) => ({
  level,
  freeCoaching: {
    eligible: level !== 'gold',
    used: level !== 'gold' && !available,
    available: level !== 'gold' && available,
    month: '2026-10',
  },
  freePro: { eligible: level === 'diamond' },
});

const rewardsAt = async (
  page: import('@playwright/test').Page,
  orders: number,
  perks: unknown,
) => {
  const dashboard = new Dashboard({
    user: { name: 'Rewards Customer', email: 'rewards@example.invalid' },
    onSignOut: () => undefined,
    // PRO switched on, so free PRO for Diamond is live
    pro: PRO_OFFER,
  });
  (dashboard.state as Record<string, unknown>).history = {
    ...history,
    lifetimeOrders: orders,
    rewards: { ...history.rewards, orders, perks },
  };
  await page.setContent(renderToStaticMarkup(dashboard.render()));
  return page.locator('#rewards');
};

test('Gold: both new perks show their unlock level, not coming soon', async ({
  page,
}) => {
  const rewards = await rewardsAt(page, 250, perksFor('gold', false));
  const free = rewards.locator('li[data-perk="freeCoaching"]');
  const pick = rewards.locator('li[data-perk="freePro"]');
  await expect(free).toHaveAttribute('data-unlocked', 'false');
  await expect(free).toContainText('Platinum');
  await expect(pick).toHaveAttribute('data-unlocked', 'false');
  await expect(pick).toContainText('Diamond');
  await expect(rewards).not.toContainText('coming soon');
  await expect(
    rewards.getByRole('link', { name: 'Book coaching' }),
  ).toHaveCount(0);
});

test('Platinum: free monthly coaching is unlocked and ready, free PRO stays Diamond', async ({
  page,
}) => {
  const rewards = await rewardsAt(page, 600, perksFor('platinum', true));
  const free = rewards.locator('li[data-perk="freeCoaching"]');
  await expect(free).toHaveAttribute('data-unlocked', 'true');
  await expect(free).toContainText(
    'Your free coaching session for October is ready',
  );
  await expect(
    free.getByRole('link', { name: 'Book coaching' }),
  ).toHaveAttribute('href', '/?coaching=1#checkout');
  const pick = rewards.locator('li[data-perk="freePro"]');
  await expect(pick).toHaveAttribute('data-unlocked', 'false');
  await expect(pick).toContainText('Diamond');
});

test('Diamond: free coaching and free PRO unlocked, used month says when it comes back', async ({
  page,
}) => {
  const rewards = await rewardsAt(page, 1200, perksFor('diamond', false));
  await expect(rewards.locator('li[data-perk="freeCoaching"]')).toContainText(
    'Used for October. Back on the 1st.',
  );
  await expect(rewards.locator('li[data-perk="freePro"]')).toHaveAttribute(
    'data-unlocked',
    'true',
  );
  await expect(rewards).not.toContainText('coming soon');
});

test('a free perk order shows Free with your perk instead of a price', async ({
  page,
}) => {
  const dashboard = new Dashboard({
    user: { name: 'Rewards Customer', email: 'rewards@example.invalid' },
    onSignOut: () => undefined,
  });
  (dashboard.state as Record<string, unknown>).history = {
    ...history,
    orders: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        ref: 'DL-5',
        status: 'completed',
        game: 'lol',
        title: 'VOD Review',
        games: 1,
        region: 'EUW',
        rerolls: 0,
        teammate: { name: 'Mika', image: '', country: 'de' },
        lastTeammate: null,
        review: null,
        createdAt: Date.now() - 3600_000,
        completedAt: Date.now() - 1800_000,
        amountEur: 14.99,
        paid: null,
        cashback: 0.5,
        refund: null,
        cancelReason: '',
        freePerk: true,
      },
    ],
  };
  await page.setContent(renderToStaticMarkup(dashboard.render()));
  await expect(page.getByText('Free with your perk').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('€14.99');
  await expect(page.locator('body')).not.toContainText('€0.50 back');
});

test('teammate TrustScore shows the live matching perks by tier', async ({
  page,
}) => {
  await page.setContent(
    renderToStaticMarkup(
      React.createElement(
        'main',
        null,
        React.createElement(TrustScore, { completed: 10, held: 0, saved: 0 }),
        React.createElement(TrustScore, { completed: 600, held: 0, saved: 0 }),
      ),
    ),
  );
  const [rookie, elite] = [
    page.locator('#trust').nth(0),
    page.locator('#trust').nth(1),
  ];
  for (const card of [rookie, elite]) {
    await expect(card).toContainText('Orders of €20 or more reach you first');
    await expect(card).toContainText('You get matched faster');
    await expect(card).not.toContainText('coming soon');
    await expect(card).not.toContainText('seconds');
  }
  await expect(rookie.locator('[data-perk-active]')).toHaveCount(0);
  await expect(elite.locator('[data-perk-active]')).toHaveCount(2);
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
