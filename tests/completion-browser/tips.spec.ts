import { test, expect } from '@playwright/test';

const orderId = '11111111-1111-4111-8111-111111111111';
const order = {
  id: orderId,
  public_reference: 'DL-90001',
  status: 'completed',
  game: 'val',
  service: 'Ranked duo',
  title: 'VALORANT x3',
  units: 3,
  unit: 'game',
  gg: false,
  rank: 'Gold III',
  region: 'EU West',
  ign: 'Alex#EUW',
  note: '',
  voice: false,
  amount_eur_cents: 2599,
  created_at: '2026-10-23T08:00:00Z',
  queued_at: '2026-10-23T08:00:00Z',
  accepted_at: '2026-10-23T08:10:00Z',
  completed_at: '2026-10-23T09:00:00Z',
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 0,
  current_assignment_id: null,
  teammate: {
    name: 'Mina',
    country: 'at',
    image: '/assets/avatars/avatar-3.png',
    bio: 'Patient teammate',
    languages: ['English'],
  },
  review: null,
  tip: null,
  reports: [],
};

test('customer selects a tip with the rating and opens its separate payment', async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: 'duoly-consent',
      value: 'necessary',
      url: 'http://127.0.0.1:4336',
    },
  ]);
  let submitted: Record<string, unknown> | null = null;
  await page.route(`**/api/orders/${orderId}`, async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { order } });
    return route.fallback();
  });
  await page.route(`**/api/orders/${orderId}/proof`, (route) =>
    route.fulfill({ json: { proofs: [] } }),
  );
  await page.route(`**/api/orders/${orderId}/review`, async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      json: {
        order: {
          ...order,
          review: {
            rating: 5,
            tags: [],
            text: '',
            created_at: '2026-10-23T09:05:00Z',
          },
          tip: {
            state: 'pending',
            amount: 5,
            currency: 'EUR',
            refunded: 0,
            paidAt: null,
          },
        },
        tipPayment: {
          clientSecret: 'pi_tip_secret_fixture',
          publishableKey: 'pk_test_fixture',
          amount: 5,
          currency: 'EUR',
          teammate: 'Mina',
        },
      },
    });
  });

  await page.goto('/?mode=queue');
  await page.getByRole('radio', { name: '5 stars' }).click();
  await expect(page.getByText('Leave a tip for Mina')).toBeVisible();
  await page.getByRole('radio', { name: '€5' }).click();
  await page.getByRole('button', { name: 'Send rating and €5 tip' }).click();

  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted).toMatchObject({
    csrf: 'fixture-csrf',
    rating: 5,
    tip_cents: 500,
  });
  await expect(
    page.getByText(
      'Your rating is saved. Now pay your €5 tip, and 100% of it goes to',
      {
        exact: false,
      },
    ),
  ).toBeVisible();
  await expect(
    page.getByText('100% of it goes to Mina.', { exact: false }),
  ).toBeVisible();
});
