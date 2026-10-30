import { test, expect } from '@playwright/test';

test('admin demo stays offline and read only even after a live failure', async ({
  page,
}) => {
  let reads = 0;
  const posts: string[] = [];
  await page.route('**/api/admin/**', async (route) => {
    const request = route.request();
    // The admin shell has an independent presence heartbeat. The preview must
    // never read or write the live performance endpoints.
    if (request.url().includes('/performance')) {
      if (request.method() === 'POST') posts.push(request.url());
      reads++;
      return route.fulfill({
        status: 503,
        json: { error: 'Live rankings unavailable' },
      });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin/performance');
  await expect(page.getByText('Live rankings unavailable')).toBeVisible();
  await page.getByRole('button', { name: 'Show demo', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Demo preview' }),
  ).toBeVisible();
  const initialReads = reads;
  const table = page.getByRole('table');
  for (const bracket of [1, 5, 10, 25, 50]) {
    await expect(
      table.getByText(`TOP ${bracket}%`, { exact: true }),
    ).toBeVisible();
  }
  await expect(table.getByText('Unranked', { exact: true })).toHaveCount(2);
  await expect(
    page.getByText('Simulated: Synced', { exact: true }).first(),
  ).toBeVisible();
  const nova = page.getByRole('row').filter({ hasText: 'Demo Nova' });
  await nova.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('#5 of 100', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Not eligible', exact: true }).click();
  await expect(
    table.getByRole('cell', {
      name: 'Demo Starter Needs 10 completed orders',
      exact: true,
    }),
  ).toBeVisible();
  await expect(table.getByText('Demo Nova', { exact: true })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Discord issues', exact: true })
    .click();
  await expect(table.getByText('Demo Echo', { exact: true })).toBeVisible();
  await expect(table.getByText('Demo Nova', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ranked', exact: true }).click();
  await expect(table.getByRole('button', { name: /history/i })).toHaveCount(6);
  await expect(
    page.getByRole('button', { name: 'Recalculate now', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Save settings', exact: true }),
  ).toBeDisabled();
  for (const input of await page.getByRole('spinbutton').all())
    await expect(input).toBeDisabled();
  await page.clock.install();
  await page.clock.fastForward(125_000);
  expect(reads).toBe(initialReads);
  expect(posts).toEqual([]);
  await page.getByRole('button', { name: 'Back to live', exact: true }).click();
  await expect.poll(() => reads).toBeGreaterThan(initialReads);
  await expect(page.getByText('Live rankings unavailable')).toBeVisible();
  const resumedReads = reads;
  await page.clock.fastForward(61_000);
  await expect.poll(() => reads).toBeGreaterThan(resumedReads);
  expect(posts).toEqual([]);
});

for (const mutation of ['Recalculate now', 'Save settings']) {
  test(`admin demo isolates outstanding live reads and ${mutation}`, async ({
    page,
  }) => {
    let releaseMutation!: () => void;
    const pendingMutation = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reads = 0;
    let historyReads = 0;
    await page.route('**/api/admin/**', async (route) => {
      if (!route.request().url().includes('/performance'))
        return route.fulfill({ json: {} });
      if (route.request().method() === 'POST') {
        await pendingMutation;
        return route.fulfill({ json: { eligible: 100, teammates: 101 } });
      }
      if (route.request().url().includes('?user=')) {
        historyReads++;
        return route.fulfill({
          json: {
            history: [
              {
                run: 'live-history',
                at: '2026-10-29T12:00:00Z',
                eligible: true,
                score: 99,
                rank: 2,
                of: 200,
                bracket: 1,
              },
            ],
          },
        });
      }
      reads++;
      if (reads === 1) await pending;
      return route.fulfill({
        json: {
          discordEnabled: false,
          run: null,
          settings: {
            w_retention: 45,
            w_satisfaction: 35,
            w_orders: 20,
            window_days: 90,
            min_orders: 5,
            min_reviews: 3,
            min_customers: 3,
            updated_at: '2026-10-30T12:00:00Z',
          },
          contractors: [
            {
              userId: 'live-fixture',
              name: 'Live fixture teammate',
              eligible: true,
              rank: 1,
              percentile: 1,
              bracket: 1,
              score: 100,
              retentionRate: 1,
              retentionScore: 100,
              avgRating: 5,
              satisfactionScore: 100,
              ordersScore: 100,
              reviews: 10,
              customers: 10,
              returningCustomers: 10,
              completedOrders: 30,
              previousRank: 2,
              discord: { status: 'off' },
            },
          ],
        },
      });
    });
    await page.goto('/admin/performance');
    await expect.poll(() => reads).toBe(1);
    await page.getByRole('button', { name: 'Show demo', exact: true }).click();
    release();
    await expect(
      page.getByRole('heading', { name: 'Demo preview' }),
    ).toBeVisible();
    await expect(page.getByText('Demo Nova', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Live fixture teammate', { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Back to live', exact: true })
      .click();
    await expect(
      page.getByText('Live fixture teammate', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Recalculate now', exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Save settings', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByText('#2 of 200', { exact: true })).toBeVisible();
    expect(historyReads).toBe(1);
    expect(reads).toBe(2);
    await page.getByRole('button', { name: mutation, exact: true }).click();
    await page.getByRole('button', { name: 'Show demo', exact: true }).click();
    const response = page.waitForResponse(
      (res) =>
        res.url().includes('/performance') && res.request().method() === 'POST',
    );
    releaseMutation();
    await response;
    await page.clock.install();
    await page.clock.fastForward(125_000);
    await expect(
      page.getByRole('heading', { name: 'Demo preview' }),
    ).toBeVisible();
    await expect(page.getByText('Demo Nova', { exact: true })).toBeVisible();
    expect(reads).toBe(2);
    expect(historyReads).toBe(1);
  });
}
