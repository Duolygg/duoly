import { test, expect, type Page } from '@playwright/test';

// Perks (migration 20261026160000) on the original homepage checkout and the teammate desk,
// against fictional API answers. Nothing here reaches a database or a payment provider.

const settle = async (page: Page) => {
  await expect.poll(() => page.locator('astro-island[ssr]').count()).toBe(0);
};

// Phones: the sticky order bar and the header can cover a target, so clicks are dispatched
// on the element itself (React handles them the same way).

type Checkout = (body: Record<string, unknown>) => {
  status: number;
  json: Record<string, unknown>;
};

async function bookingPage(
  page: Page,
  {
    perks,
    checkout,
  }: {
    perks: unknown;
    checkout: Checkout;
  },
) {
  const pickQueries: string[] = [];
  const checkoutBodies: Record<string, unknown>[] = [];
  await page.route('**/api/**', async (r) => {
    const url = new URL(r.request().url());
    if (url.pathname === '/api/orders/credits')
      return r.fulfill({
        json: { balance: { total_eur_cents: 2000 }, credits: [] },
      });
    if (url.pathname === '/api/orders/perks')
      return r.fulfill({ json: { perks } });
    // the Diamond pick ended (20261106170000): the page must not ask for it any more
    if (url.pathname === '/api/orders/pickable-teammates') {
      pickQueries.push(url.search);
      return r.fulfill({ json: { eligible: false, teammates: [] } });
    }
    if (url.pathname === '/api/checkout') {
      const body = r.request().postDataJSON();
      checkoutBodies.push(body);
      const answer = checkout(body);
      return r.fulfill({ status: answer.status, json: answer.json });
    }
    return r.fulfill({ status: 404, json: { error: 'Unexpected endpoint' } });
  });
  // The free order goes straight to its order room; the fixture has no such page.
  await page.route('**/queue/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<h1>Order room</h1>' }),
  );
  await page.goto('/book');
  await settle(page);
  return { pickQueries, checkoutBodies };
}

const platinum = (available: boolean) => ({
  level: 'platinum',
  freeCoaching: {
    eligible: true,
    used: !available,
    available,
    month: '2026-10',
  },
  freePro: { eligible: false },
});

test('free monthly coaching: toggle hides prices and sends freePerk without the wallet', async ({
  page,
}) => {
  const { checkoutBodies, pickQueries } = await bookingPage(page, {
    perks: platinum(true),
    checkout: () => ({
      status: 200,
      json: {
        intent_id: '99999999-9999-4999-8999-999999999999',
        order_id: '12121212-1212-4212-8212-121212121212',
        url: '/queue/12121212-1212-4212-8212-121212121212',
        free_perk: true,
      },
    }),
  });
  const free = page.getByRole('switch', {
    name: /Use my free monthly coaching/,
  });
  // The main Duo service is not coaching: only a hint.
  await expect(free).toHaveCount(0);
  await expect(page.locator('[data-free-hint]')).toContainText(
    'Your free monthly coaching is ready.',
  );
  await expect(
    page.getByRole('switch', { name: /Use my Duoly balance/ }),
  ).toBeVisible();
  // There is no teammate pick any more.
  await expect(page.locator('[data-pick-teammate]')).toHaveCount(0);

  await page.getByRole('tab', { name: /^Coaching/ }).dispatchEvent('click');
  await page
    .getByRole('button', { name: /VOD Review/ })
    .first()
    .dispatchEvent('click');
  await expect(free).toBeVisible();
  await expect(free).toContainText('Your Platinum perk for October');
  await expect(free).toHaveAttribute('aria-checked', 'false');
  await free.dispatchEvent('click');
  await expect(free).toHaveAttribute('aria-checked', 'true');

  const summary = page.getByRole('complementary', { name: 'Order summary' });
  await expect(summary.locator('[data-free-perk]')).toContainText(
    'Free monthly coaching',
  );
  await expect(summary).toContainText('Free');
  await expect(summary).not.toContainText('Duoly balance');
  await expect(summary).not.toContainText('PRO members save');
  await expect(summary).not.toContainText('Apple Pay, Google Pay');
  await expect(
    page.getByRole('switch', { name: /Use my Duoly balance/ }),
  ).toHaveCount(0);

  await summary
    .getByRole('button', { name: 'Book my free coaching' })
    .dispatchEvent('click');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Free with your perk');
  await dialog.getByPlaceholder('Name#TAG').fill('Dana#EUW');
  await dialog
    .getByRole('button', { name: 'Book my free coaching' })
    .dispatchEvent('click');
  await expect.poll(() => checkoutBodies.length).toBe(1);
  expect(checkoutBodies[0]).toMatchObject({
    gameId: 'lol',
    serviceId: 'vod',
    units: 1,
    freePerk: true,
    useWallet: false,
    csrf: 'fixture-csrf',
  });
  expect(checkoutBodies[0]).not.toHaveProperty('pickSource');
  await expect(page).toHaveURL(/\/queue\/12121212/);
  expect(pickQueries).toEqual([]);
});

test('free coaching refusals show inline and a used month hides the toggle', async ({
  page,
}) => {
  const { checkoutBodies } = await bookingPage(page, {
    perks: platinum(true),
    checkout: () => ({
      status: 409,
      json: {
        error:
          'You already used this month’s free coaching. It comes back on the 1st.',
      },
    }),
  });
  await page.getByRole('tab', { name: /^Coaching/ }).dispatchEvent('click');
  await page
    .getByRole('button', { name: /VOD Review/ })
    .first()
    .dispatchEvent('click');
  await page
    .getByRole('switch', { name: /Use my free monthly coaching/ })
    .dispatchEvent('click');
  await page
    .getByRole('complementary', { name: 'Order summary' })
    .getByRole('button', { name: 'Book my free coaching' })
    .dispatchEvent('click');
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Name#TAG').fill('Dana#EUW');
  await dialog
    .getByRole('button', { name: 'Book my free coaching' })
    .dispatchEvent('click');
  await expect(dialog.getByRole('alert')).toHaveText(
    'You already used this month’s free coaching. It comes back on the 1st.',
  );
  expect(checkoutBodies[0]).toMatchObject({ freePerk: true, useWallet: false });
});

const diamond = {
  level: 'diamond',
  freeCoaching: {
    eligible: true,
    used: true,
    available: false,
    month: '2026-10',
  },
  freePro: { eligible: true },
};

test('Diamond: no teammate pick any more, and no pick requests', async ({
  page,
}) => {
  const { pickQueries, checkoutBodies } = await bookingPage(page, {
    perks: diamond,
    checkout: () => ({
      status: 503,
      json: { error: 'Checkout is unavailable. Try again.' },
    }),
  });
  await expect(page.locator('[data-pick-teammate]')).toHaveCount(0);
  await page
    .getByRole('complementary', { name: 'Order summary' })
    .getByRole('button', { name: /^Pay / })
    .dispatchEvent('click');
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Name#TAG').fill('Dana#EUW');
  await dialog
    .getByRole('button', { name: /Continue to payment/ })
    .dispatchEvent('click');
  await expect.poll(() => checkoutBodies.length).toBe(1);
  expect(checkoutBodies[0]).not.toHaveProperty('pickSource');
  await expect(dialog.getByRole('alert')).toHaveText(
    'Checkout is unavailable. Try again.',
  );
  expect(pickQueries).toEqual([]);
});

test('perks not live: no perk UI and no pick requests', async ({ page }) => {
  const { pickQueries } = await bookingPage(page, {
    perks: null,
    checkout: () => ({ status: 503, json: { error: 'x' } }),
  });
  await page.getByRole('tab', { name: /^Coaching/ }).dispatchEvent('click');
  await page
    .getByRole('button', { name: /VOD Review/ })
    .first()
    .dispatchEvent('click');
  await expect(page.locator('[data-free-toggle]')).toHaveCount(0);
  await expect(page.locator('[data-free-hint]')).toHaveCount(0);
  await expect(page.locator('[data-pick-teammate]')).toHaveCount(0);
  expect(pickQueries).toEqual([]);
});
