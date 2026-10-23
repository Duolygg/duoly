import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const proofImage = readFileSync(
  new URL('../../public/assets/avatars/avatar-1.png', import.meta.url),
);
import {
  mockChat,
  state,
  orderId,
  assignmentId,
} from '../chat-browser/fixtures';
const proof = {
  id: '77777777-7777-4777-8777-777777777777',
  order_id: orderId,
  assignment_id: assignmentId,
  mime: 'image/png',
  byte_size: proofImage.length,
  created_at: '2026-10-23T10:00:00Z',
};
test('refresh stays locked while authoritative reads are pending after idle completion controls unmount', async ({
  page,
}) => {
  await mockChat(page, state(), 'teammate');
  await page.route('**/api/teammate/earnings', (r) =>
    r.fulfill({ json: { earnings: [] } }),
  );
  await page.goto('/?view=teammate');
  await expect(
    page.getByRole('button', { name: 'Mark as done', exact: true }),
  ).toBeVisible();
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  await page.route('**/api/teammate/order', async (r) => {
    reads++;
    await wait;
    await r.fulfill({ json: { order: null } });
  });
  await page.getByRole('button', { name: 'Refresh desk' }).click();
  await expect(
    page.getByRole('button', { name: 'Refresh desk' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Refresh desk' })
    .dispatchEvent('click');
  await expect.poll(() => reads).toBe(1);
  release();
  await expect(
    page.getByRole('button', { name: 'Refresh desk' }),
  ).toBeEnabled();
});

test('readback recovers a lost acknowledgement without a second money mutation and blocks next accept until assignment is clear', async ({
  page,
}) => {
  await mockChat(page, state(), 'teammate');
  let receipt: Record<string, unknown> | null = null,
    posts = 0,
    available = false;
  await page.route('**/api/teammate/earnings', (r) =>
    r.fulfill({ json: { earnings: available && receipt ? [receipt] : [] } }),
  );
  await page.route('**/api/orders/*/proof', (r) =>
    r.fulfill({ json: { proofs: [proof] } }),
  );
  await page.route('**/api/teammate/orders/*/complete', async (r) => {
    posts++;
    const command = r.request().postDataJSON();
    receipt = {
      ...command,
      order_id: orderId,
      completed_at: '2026-10-23T10:00:00Z',
      payout_usd_cents: 2000,
      deposit_percent: 10,
      held_usd_cents: 200,
      net_usd_cents: 1800,
      trust_tier: 'rookie',
    };
    if (receipt) delete receipt.csrf;
    return r.fulfill({ status: 503, json: { error: 'Lost acknowledgement' } });
  });
  await page.goto('/?view=teammate');
  await page.getByRole('button', { name: 'Mark as done', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Refresh desk' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Confirm completion', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Read back completion' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Read back completion' }).click();
  await expect(
    page.getByText('This does not prove the request failed.', { exact: false }),
  ).toBeVisible();
  expect(posts).toBe(1);
  available = true;
  await page.getByRole('button', { name: 'Read back completion' }).click();
  await expect(
    page.getByText(
      'Completion recorded, but the current assignment is not confirmed clear.',
      { exact: false },
    ),
  ).toBeVisible();
  expect(posts).toBe(1);
  await expect(
    page.getByRole('button', { name: 'Refresh desk' }),
  ).toBeEnabled();
});

test('evidence read failures cannot enable completion and earnings denial is not a zero balance', async ({
  page,
}) => {
  await mockChat(page, state(), 'teammate');
  let denied = false;
  await page.route('**/api/teammate/earnings', (r) =>
    r.fulfill({ status: 403, json: {} }),
  );
  await page.route('**/api/orders/*/proof', (r) =>
    r.fulfill({
      status: denied ? 503 : 200,
      json: denied ? {} : { proofs: [proof] },
    }),
  );
  await page.goto('/?view=teammate');
  await expect(
    page.getByRole('button', { name: 'Mark as done', exact: true }),
  ).toBeEnabled();
  denied = true;
  await page.getByRole('button', { name: 'Refresh evidence' }).click();
  await expect(
    page.getByRole('button', { name: 'Mark as done', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('Permanent earnings access denied.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('No permanent earnings recorded.')).toHaveCount(
    0,
  );
  await expect(
    page.getByText('Displayed evidence may be stale.', { exact: false }),
  ).toBeVisible();
});

test('confirms completion, freezes retry after lost acknowledgement and reads authoritative desk and earning', async ({
  page,
}, info) => {
  await mockChat(page, state(), 'teammate');
  await page.route('**/api/orders/*/proof/*', (route) =>
    route.fulfill({ contentType: 'image/png', body: proofImage }),
  );
  let receipt: Record<string, unknown> | null = null;
  const attempts: unknown[] = [];
  let completed = false;
  await page.route('**/api/teammate/earnings', (r) =>
    r.fulfill({ json: { earnings: receipt ? [receipt] : [] } }),
  );
  await page.route('**/api/orders/*/proof', (r) =>
    r.fulfill({ json: { proofs: [proof] } }),
  );
  await page.route('**/api/teammate/orders/*/complete', async (r) => {
    const command = r.request().postDataJSON();
    attempts.push(command);
    receipt = {
      order_id: orderId,
      assignment_id: assignmentId,
      request_id: command.request_id,
      proof_ids: command.proof_ids,
      completed_at: '2026-10-23T10:00:00Z',
      payout_usd_cents: 2000,
      deposit_percent: 10,
      held_usd_cents: 200,
      net_usd_cents: 1800,
      trust_tier: 'rookie',
    };
    if (attempts.length === 1)
      return r.fulfill({
        status: 503,
        json: { error: 'Lost acknowledgement' },
      });
    completed = true;
    return r.fulfill({ json: { completion: receipt } });
  });
  await page.route('**/api/teammate/order', async (r) =>
    completed ? r.fulfill({ json: { order: null } }) : r.fallback(),
  );
  await page.goto('/?view=teammate');
  await expect(
    page.getByRole('button', { name: 'Mark as done', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Mark as done', exact: true }).click();
  expect(attempts).toHaveLength(0);
  await expect(page.getByText('Confirm order completion')).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText('Evidence image 1', { exact: true })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.addStyleTag({
    content: 'astro-dev-toolbar { display: none !important; }',
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath(`completion-confirm-${info.project.name}.png`),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Confirm completion', exact: true })
    .dblclick();
  await expect(
    page.getByText('Completion is unconfirmed.', { exact: false }),
  ).toBeVisible();
  expect(attempts).toHaveLength(1);
  await expect(
    page.getByRole('button', { name: 'Refresh evidence' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Retry same completion' }).click();
  await expect(
    page.getByText('No current assignment.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Completion recorded.', { exact: false }),
  ).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
  await expect(
    page.getByRole('heading', { name: 'Recent permanent earnings' }),
  ).toBeVisible();
  await expect(
    page.getByText('$18.00 USD', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText('Withdrawals and deposit releases are not available yet.')
      .first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.addStyleTag({
    content: 'astro-dev-toolbar { display: none !important; }',
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath(`completion-${info.project.name}.png`),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Refresh desk' }).click();
  await expect(page.getByText('$18.00 USD', { exact: true })).toBeVisible();
});
