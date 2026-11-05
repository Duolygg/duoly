import { test, expect, type Page } from '@playwright/test';

// Play again in the customer order room (docs/product/play-again.md): the button after the teammate
// finished, the summary with balance and saved card, the booking, and why it's off. Fictional order,
// mocked API: nothing reaches Stripe or a database.
const orderId = '11111111-1111-4111-8111-111111111111';
const newOrder = '44444444-4444-4444-8444-444444444444';

async function room(page: Page, offer: Record<string, unknown>) {
  await page.context().addCookies([
    {
      name: 'duoly-consent',
      value: 'v2.a0.m0.r0',
      url: 'http://127.0.0.1:4336',
    },
  ]);
  const now = Date.now();
  const order = {
    id: orderId,
    public_reference: 'DL-90003',
    status: 'completed',
    game: 'val',
    service: 'duo1',
    title: 'Duo Pro',
    units: 3,
    unit: 'game',
    gg: false,
    rank: 'Gold III',
    region: 'EU West',
    ign: 'Alex#EUW',
    note: '',
    voice: false,
    amount_eur_cents: 807,
    created_at: new Date(now - 3_600_000).toISOString(),
    queued_at: new Date(now - 3_600_000).toISOString(),
    accepted_at: new Date(now - 3_500_000).toISOString(),
    completed_at: new Date(now - 60_000).toISOString(),
    cancelled_at: null,
    cancel_reason: null,
    rerolls: 0,
    current_assignment_id: '22222222-2222-4222-8222-222222222222',
    teammate: {
      name: 'Mina Park',
      country: 'at',
      image: '/assets/avatars/avatar-3.png',
    },
    review: { rating: 5, text: '', tags: [], at: new Date(now).toISOString() },
    tip: null,
    reports: [],
  };
  const posts: Record<string, unknown>[] = [];
  await page.route(`**/api/orders/${orderId}**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/api/orders/${orderId}/play-again`) {
      if (route.request().method() === 'POST') {
        posts.push(route.request().postDataJSON());
        return route.fulfill({
          json: { url: `/?mode=queue&new=${newOrder}`, orderId: newOrder },
        });
      }
      return route.fulfill({ json: offer });
    }
    if (path === `/api/orders/${orderId}`)
      return route.fulfill({ json: { order } });
    if (path.endsWith('/favorite'))
      return route.fulfill({ json: { available: true, favorite: false } });
    return route.fulfill({ json: { proofs: [], messages: [] } });
  });
  await page.goto('/?mode=queue');
  return posts;
}

test('Play again: one tap books the same session with the saved card', async ({
  page,
}) => {
  const posts = await room(page, {
    available: true,
    reason: null,
    amountEurCents: 807,
    walletEurCents: 200,
    cardEurCents: 607,
    card: { brand: 'visa', last4: '4242' },
  });
  const button = page.getByRole('button', {
    name: 'Play again with Mina · €8.07',
  });
  // the offer loads after the room: on a cold dev build that can take longer than 5 s
  await expect(button).toBeVisible({ timeout: 15_000 });
  await button.click();
  const sheet = page.getByRole('group', { name: 'Play again with Mina' });
  await expect(sheet).toContainText('From your Duoly balance');
  await expect(sheet).toContainText('€2');
  await expect(sheet).toContainText('Visa •••• 4242');
  await expect(sheet).toContainText('€6.07');
  await expect(sheet).toContainText(
    'Mina gets it first for a minute, then any teammate can take it.',
  );
  await sheet.getByRole('button', { name: 'Pay €8.07 and play again' }).click();
  await expect(page).toHaveURL(new RegExp(`new=${newOrder}`));
  expect(posts).toEqual([{ csrf: 'fixture-csrf', amountEurCents: 807 }]);
});

test('Play again is off while the teammate is offline, and says so', async ({
  page,
}) => {
  await room(page, {
    available: false,
    reason: 'teammate_away',
    amountEurCents: 807,
    walletEurCents: 0,
    cardEurCents: 0,
    card: null,
  });
  await expect(page.locator('[data-play-again-note]')).toHaveText(
    'Mina is offline right now. Play again comes back when they’re online.',
  );
  await expect(
    page.getByRole('button', { name: /Play again with/ }),
  ).toHaveCount(0);
  // Queue again still books anyone
  await expect(page.getByRole('link', { name: 'Queue again' })).toBeVisible();
});
