import { expect, test } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../../src/components/account/Dashboard.jsx';
import Home from '../../src/components/home/Home.jsx';
import { PRO_OFFER, type ProView } from '../../src/contracts/pro';

// Duoly PRO (ledger #39): Fabian's dashboard card and the checkout line, on real props.
const history = {
  now: Date.now(),
  orders: [],
  mates: [],
  wallet: 0,
  walletCashable: 0,
  walletPromo: 0,
  refunds: 0,
  cashbackTotal: 0,
  cashbackMonth: 0,
  levelGifts: 0,
  gifted: 0,
  walletSpent: 0,
  lifetimeOrders: 0,
  weekOrders: 0,
  gamesPlayed: 0,
};

const dashboard = (pro: ProView | null, proWelcome = false) => {
  const view = new Dashboard({
    user: { name: 'Pro Customer', email: 'pro@example.invalid' },
    onSignOut: () => undefined,
    csrf: 'csrf',
    pro,
    proWelcome,
  });
  (view.state as Record<string, unknown>).history = history;
  return renderToStaticMarkup(view.render());
};

const member: ProView = {
  member: true,
  trialEligible: false,
  status: 'trialing',
  trialEnd: Date.parse('2026-11-04T10:00:00Z'),
  periodEnd: Date.parse('2026-11-04T10:00:00Z'),
  cancelAtPeriodEnd: false,
  graceUntil: null,
  manage: true,
};

test('PRO card stays hidden while PRO is switched off', async ({ page }) => {
  await page.setContent(dashboard(null));
  await expect(page.locator('#pro')).toHaveCount(0);
});

test('PRO card offers the 7-day trial with the original copy', async ({
  page,
}) => {
  await page.setContent(dashboard(PRO_OFFER));
  const card = page.locator('section#pro');
  await expect(card).toContainText('Duoly PRO');
  await expect(
    card.getByRole('heading', { name: 'Save 10% on every game' }),
  ).toBeVisible();
  await expect(card).toContainText('✓ Priority matching');
  await expect(card).toContainText('✓ Free re-rolls on every game');
  await expect(card).toContainText('✓ 7 days free, no card needed');
  const cta = card.getByRole('link', { name: 'Try PRO free for 7 days' });
  await expect(cta).toHaveAttribute('href', '/pro');
});

test('PRO card without a second trial says Get PRO', async ({ page }) => {
  await page.setContent(dashboard({ ...PRO_OFFER, trialEligible: false }));
  const card = page.locator('section#pro');
  await expect(card).toContainText('✓ Cancel anytime');
  await expect(
    card.getByRole('link', { name: 'Get PRO · €9.99/month' }),
  ).toHaveAttribute('href', '/pro');
});

test('PRO members get the trial status and Manage PRO', async ({ page }) => {
  await page.setContent(dashboard(member));
  const card = page.locator('section#pro');
  await expect(
    card.getByRole('heading', { name: 'You’re saving 10% on every game' }),
  ).toBeVisible();
  await expect(card).toContainText(
    'Free trial until 4 Nov. To keep PRO after that, add a card in Manage PRO: €9.99/month, cancel anytime.',
  );
  await expect(card.getByRole('link', { name: 'Manage PRO' })).toBeVisible();
});

test('a failed renewal shows the 3-day grace', async ({ page }) => {
  await page.setContent(
    dashboard({
      ...member,
      status: 'past_due',
      graceUntil: Date.parse('2026-11-03T10:00:00Z'),
    }),
  );
  await expect(page.locator('section#pro')).toContainText(
    'Your last payment failed. PRO stays on until 3 Nov. Update your card to keep it.',
  );
});

const home = (pro: ProView | null) => {
  const view = new Home({
    session: {
      user: {
        id: 'b9000000-0000-4000-8000-000000000001',
        role: 'customer',
        name: 'Pro Customer',
      },
    },
    walletEur: 0,
    usdRate: 1.1,
    stats: null,
    recentMatches: [],
    onlineNow: 0,
    onCheckout: async () => ({ url: '/queue/order-1' }),
    pro,
  });
  return renderToStaticMarkup(view.render());
};

test('checkout shows the PRO line to non-members and links to /pro', async ({
  page,
}) => {
  await page.setContent(home(PRO_OFFER));
  const line = page.locator('[data-pro-line]');
  await expect(line).toContainText('Duoly PRO members save');
  await expect(line).toContainText('on this order');
  await expect(
    line.getByRole('link', { name: 'Try PRO free for 7 days' }),
  ).toHaveAttribute('href', '/pro');
  await expect(page.locator('[data-pro-discount]')).toHaveCount(0);
});

test('checkout takes 10% off for PRO members', async ({ page }) => {
  await page.setContent(home(member));
  await expect(page.locator('[data-pro-line]')).toHaveCount(0);
  const discount = page.locator('[data-pro-discount]').first();
  await expect(discount).toContainText('PRO members save 10%');
  await expect(discount).toContainText('−€');
});

test('checkout has no PRO line while PRO is switched off', async ({ page }) => {
  await page.setContent(home(null));
  await expect(page.locator('[data-pro-line]')).toHaveCount(0);
  await expect(page.locator('[data-pro-discount]')).toHaveCount(0);
});
