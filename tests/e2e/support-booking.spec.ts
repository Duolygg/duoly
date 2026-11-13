import { expect, test } from '@playwright/test';

// Sparky's booking ticket in the support chat: rendered from the server's ticket, quantity
// tiles switch between the precomputed prices, and the button opens the prefilled booking.
const href = (qty: number) =>
  `/?game=val&service=duo1&agent=sparky&rank=Platinum&region=EU&voice=true&qty=${qty}#modes-h`;
const ticket = {
  v: 1,
  game: { id: 'val', name: 'Valorant', img: '/assets/games/valorant.png' },
  service: { id: 'duo1', name: 'Duo Plus', category: 'duo', unit: 'game' },
  rank: 'Platinum',
  region: 'EU',
  voice: true,
  currency: 'EUR',
  selected: 1,
  options: [
    {
      quantity: 1,
      amountMinor: 599,
      fullMinor: 599,
      discountPercent: 0,
      href: href(1),
    },
    {
      quantity: 3,
      amountMinor: 1797,
      fullMinor: 1797,
      discountPercent: 0,
      href: href(3),
    },
    {
      quantity: 5,
      amountMinor: 2396,
      fullMinor: 2995,
      discountPercent: 20,
      href: href(5),
    },
  ],
  online: 4,
};

test('Sparky shows a booking ticket that opens the prefilled booking', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'duoly-consent',
      value: 'v2.a0.m0.r0',
      url: `http://127.0.0.1:${process.env.DUOLY_TEST_PORT ?? '4321'}`,
    },
  ]);
  await page.route('**/api/support', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          json: {
            csrf: 'token',
            role: 'guest',
            chips: [],
            greeting: 'Hey, I am Sparky.',
            team: [],
            conversation: {
              id: 'c1',
              status: 'bot',
              agent: null,
              messages: [
                {
                  id: 'm1',
                  from: 'user',
                  text: 'need a valorant duo, plat EU, how much?',
                  at: 1,
                  by: null,
                  booking: null,
                },
                {
                  id: 'm2',
                  from: 'bot',
                  text: 'Here is a Platinum duo on EU for you.',
                  at: 2,
                  by: null,
                  booking: ticket,
                },
              ],
            },
          },
        })
      : route.abort(),
  );
  await page.goto('/');
  const chat = page.getByRole('dialog', { name: 'Duoly support chat' });
  // The bubble hydrates after load; retry the click until the panel opens.
  await expect(async () => {
    await page
      .locator('button[aria-label*="chat" i], button[aria-label*="support" i]')
      .first()
      .click();
    await expect(chat).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  const card = chat.getByRole('group', { name: 'Booking: Valorant, Duo Plus' });
  await expect(card).toBeVisible();
  await expect(card.getByText('4 teammates online')).toBeVisible();
  const cta = card.getByRole('link', { name: /^Book 1 game · €5\.99$/ });
  await expect(cta).toHaveAttribute('href', href(1));

  await card.getByRole('button', { name: /^5/ }).click();
  await expect(card.getByRole('button', { name: /^5/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const five = card.getByRole('link', { name: /^Book 5 games · €23\.96$/ });
  await expect(five).toHaveAttribute('href', href(5));
  await expect(card.getByText('You save €5.99')).toBeVisible();
  // The ticket never leaves the chat panel.
  const box = (await card.boundingBox())!;
  const panel = (await chat.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width + 0.5);

  await five.click();
  await page.waitForURL(/qty=5/);
  const url = new URL(page.url());
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    game: 'val',
    service: 'duo1',
    rank: 'Platinum',
    region: 'EU',
    qty: '5',
  });
});
