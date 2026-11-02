import { test, expect, type Page } from '@playwright/test';

// Perks (migration 20261026160000) on the original homepage checkout and the teammate desk,
// against fictional API answers. Nothing here reaches a database or a payment provider.

const settle = async (page: Page) => {
  await expect.poll(() => page.locator('astro-island[ssr]').count()).toBe(0);
};

// Phones: the sticky order bar and the header can cover a target, so clicks are dispatched
// on the element itself (React handles them the same way).
const UNAVAILABLE =
  'That teammate is not available right now. Pick someone else or book without a pick.';
const mika = {
  handle: '77777777-7777-4777-8777-777777777777',
  name: 'Mika',
  image: '/assets/avatars/avatar-3.png',
  country: 'de',
  orders: 4,
};
const jo = {
  handle: '88888888-8888-4888-8888-888888888888',
  name: 'Jo',
  image: '/assets/avatars/avatar-4.png',
  country: 'fr',
  orders: 1,
};

type Checkout = (body: Record<string, unknown>) => {
  status: number;
  json: Record<string, unknown>;
};

async function bookingPage(
  page: Page,
  {
    perks,
    teammates = () => [],
    checkout,
  }: {
    perks: unknown;
    teammates?: (query: URLSearchParams) => unknown[];
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
    if (url.pathname === '/api/orders/pickable-teammates') {
      pickQueries.push(url.search);
      return r.fulfill({
        json: { eligible: true, teammates: teammates(url.searchParams) },
      });
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
  pickTeammate: { eligible: false },
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
  // Pick a teammate is Diamond only.
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
  pickTeammate: { eligible: true },
};

test('pick a teammate sends pickSource and handles the unavailable answer', async ({
  page,
}) => {
  let calls = 0;
  let mikaOnline = true;
  const { pickQueries, checkoutBodies } = await bookingPage(page, {
    perks: diamond,
    teammates: () => (mikaOnline ? [mika, jo] : [jo]),
    checkout: () => {
      calls += 1;
      if (calls === 1) {
        mikaOnline = false;
        return { status: 409, json: { error: UNAVAILABLE } };
      }
      return {
        status: 503,
        json: { error: 'Checkout is unavailable. Try again.' },
      };
    },
  });
  const picker = page.locator('[data-pick-teammate]');
  await expect(picker).toContainText(
    'They get your order first for 60 seconds. If they don’t take it, it goes to everyone.',
  );
  await expect(picker).toContainText('4 orders together');
  await expect(picker).toContainText('1 order together');
  // The free month is used: no free toggle.
  await expect(
    page.getByRole('switch', { name: /Use my free monthly coaching/ }),
  ).toHaveCount(0);
  expect(pickQueries[0]).toBe('?game=lol&gg=false&voice=true');

  // Voice off: the list is read again for the new choice.
  await page
    .getByRole('switch', { name: 'Voice on Discord' })
    .dispatchEvent('click');
  await expect
    .poll(() => pickQueries.at(-1))
    .toBe('?game=lol&gg=false&voice=false');
  await expect(picker).toContainText('4 orders together');

  await picker.getByRole('radio', { name: /Mika/ }).dispatchEvent('click');
  await expect(picker.getByRole('radio', { name: /Mika/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page
    .getByRole('complementary', { name: 'Order summary' })
    .getByRole('button', { name: /^Pay / })
    .dispatchEvent('click');
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Name#TAG').fill('Dana#EUW');
  const before = pickQueries.length;
  await dialog
    .getByRole('button', { name: /Continue to payment/ })
    .dispatchEvent('click');
  await expect.poll(() => checkoutBodies.length).toBe(1);
  expect(checkoutBodies[0]).toMatchObject({
    pickSource: mika.handle,
    useWallet: true,
    voice: false,
  });
  expect(checkoutBodies[0]).not.toHaveProperty('freePerk');
  await expect(dialog.getByRole('alert')).toHaveText(UNAVAILABLE);
  // The pick is cleared, the list read again and Mika is gone.
  await expect.poll(() => pickQueries.length).toBe(before + 1);
  await expect(picker.getByRole('alert')).toHaveText(UNAVAILABLE);
  await expect(picker.getByRole('radio', { name: /Mika/ })).toHaveCount(0);
  await expect(picker.getByRole('radio', { name: 'Anyone' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await dialog
    .getByRole('button', { name: /Continue to payment/ })
    .dispatchEvent('click');
  await expect.poll(() => checkoutBodies.length).toBe(2);
  expect(checkoutBodies[1]).not.toHaveProperty('pickSource');
  await expect(dialog.getByRole('alert')).toHaveText(
    'Checkout is unavailable. Try again.',
  );
});

test('pick a teammate with nobody online says so', async ({ page }) => {
  await bookingPage(page, {
    perks: diamond,
    teammates: () => [],
    checkout: () => ({ status: 503, json: { error: 'x' } }),
  });
  // The list is read only after perks load, which waits for the whole homepage to mount; on a
  // CI runner's dev build that can take most of the default 5 s (trace: answer 0.7 s before it).
  await expect(page.locator('[data-pick-teammate]')).toContainText(
    'None of your past teammates are online for this right now.',
    { timeout: 15_000 },
  );
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
