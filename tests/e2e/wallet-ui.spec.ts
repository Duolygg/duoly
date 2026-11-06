import { expect, test } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../../src/components/account/Dashboard.jsx';
import Home from '../../src/components/home/Home.jsx';
import Customers from '../../src/components/admin/Customers.jsx';

const customer = {
  id: 'b1000000-0000-4000-8000-000000000002',
  name: 'Wallet Customer',
  email: 'wallet@example.invalid',
  wallet: 65,
  cashable: 5,
  promo: 60,
  gifted: 10,
  adjustments: 1,
  orders: 0,
  placed: 0,
  spent: 0,
  warnings: 0,
  level: 'Bronze',
  levelColor: '#C48A62',
  joined: Date.now(),
  lastOrderAt: null,
  blocked: null,
  av: '/assets/avatars/avatar-1.png',
  flag: '',
};

test('balance card shows live breakdown and enables wallet booking', async ({
  page,
}) => {
  const dashboard = new Dashboard({
    user: { name: 'Wallet Customer', email: customer.email },
    onSignOut: () => undefined,
  });
  (dashboard.state as Record<string, unknown>).history = {
    now: Date.now(),
    orders: [],
    mates: [],
    wallet: 65,
    walletCashable: 5,
    walletPromo: 60,
    refunds: 5,
    cashbackTotal: 0,
    cashbackMonth: 0,
    levelGifts: 0,
    gifted: 10,
    walletSpent: 0,
    lifetimeOrders: 0,
    weekOrders: 0,
    gamesPlayed: 0,
  };
  await page.setContent(renderToStaticMarkup(dashboard.render()));
  const card = page
    .getByRole('heading', { name: 'Duoly balance' })
    .locator('..')
    .locator('..');
  await expect(card).toContainText('€65.00');
  await expect(card).toContainText('€5.00 refunds · €60.00');
  await expect(card).toContainText('back on your original payment method');
  await expect(card).toContainText('€60.00 promotional credit');
  await expect(card).toContainText('€5.00 refunded');
  await expect(card).toContainText('€10.00 from Duoly');
  const spend = page.getByRole('link', { name: 'Book with my balance' });
  await expect(spend).toHaveAttribute('href', '/?wallet=1#checkout');
  await expect(spend).not.toContainText('coming soon');
});

test('checkout shows the wallet toggle on by default for a full-wallet booking', async ({
  page,
}) => {
  const home = new Home({
    session: {
      user: { id: customer.id, role: 'customer', name: customer.name },
    },
    walletEur: 100,
    usdRate: 1.1,
    stats: null,
    recentMatches: [],
    onlineNow: 0,
    onCheckout: async () => ({ url: '/queue/order-1' }),
  });
  home.state = { ...home.state, wallet: 100 };
  await page.setContent(renderToStaticMarkup(home.render()));
  const toggle = page.getByRole('switch', { name: /Use my Duoly balance/ });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(toggle).toContainText('€100.00 available');
  await expect(
    page.getByRole('button', { name: /Pay .* with Duoly balance/ }).first(),
  ).toBeVisible();
});

test('admin customer row exposes the original wallet adjustment control', async ({
  page,
}) => {
  const customers = new Customers({
    api: {},
    ask: () => undefined,
    toast: () => undefined,
    log: () => undefined,
  });
  customers.state = {
    ...customers.state,
    customers: [customer],
    loaded: true,
  } as unknown as typeof customers.state;
  await page.setContent(renderToStaticMarkup(customers.render()));
  await expect(
    page.getByRole('button', { name: 'Adjust balance' }),
  ).toBeVisible();
  await expect(page.getByText('€65.00', { exact: true })).toBeVisible();
});
