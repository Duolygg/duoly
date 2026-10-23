import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const image = readFileSync(
  new URL('../../public/assets/avatars/avatar-1.png', import.meta.url),
);
const id = '11111111-1111-4111-8111-111111111111',
  assignment = '22222222-2222-4222-8222-222222222222';
const order = {
  id,
  public_reference: 'DL-42',
  status: 'queued',
  game: 'lol',
  service: 'duo',
  title: 'Duo queue',
  units: 2,
  unit: 'game',
  gg: false,
  rank: 'Gold',
  region: 'EUW',
  ign: 'Player#EUW',
  note: 'Ready for two games',
  voice: false,
  customer_name: 'Customer',
  customer_image: '/assets/avatars/avatar-2.png',
  customer_country: 'de',
  payout_usd_cents: 1234,
  current_assignment_id: null,
};
test('original layout, server queue, real chat transport and private completion stay connected', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let accepted = false;
  const messages: object[] = [];
  const requests: string[] = [];
  await page.route('**/api/**', async (r) => {
    const req = r.request(),
      url = new URL(req.url());
    requests.push(url.pathname);
    if (url.pathname === '/api/teammate/queue')
      return r.fulfill({ json: { orders: accepted ? [] : [order] } });
    if (url.pathname === '/api/teammate/order')
      return r.fulfill({
        json: {
          order: accepted
            ? {
                ...order,
                status: 'in_progress',
                current_assignment_id: assignment,
              }
            : null,
        },
      });
    if (url.pathname.endsWith('/accept')) {
      expect(req.postDataJSON()).toEqual({ csrf: 'fixture-csrf' });
      accepted = true;
      return r.fulfill({
        json: {
          order: {
            ...order,
            status: 'in_progress',
            current_assignment_id: assignment,
          },
        },
      });
    }
    if (url.pathname.endsWith('/chat/typing')) {
      expect(req.headers()['x-csrf-token']).toBe('fixture-csrf');
      return r.fulfill({
        json: { order_id: id, assignment_id: assignment, ok: true },
      });
    }
    if (url.pathname.endsWith('/chat')) {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        expect(body.assignment_id).toBe(assignment);
        expect(req.headers()['x-csrf-token']).toBe('fixture-csrf');
        expect(Object.keys(body).sort()).toEqual([
          'assignment_id',
          'body',
          'request_id',
        ]);
        const message = {
          id: '33333333-3333-4333-8333-333333333333',
          sequence: 1,
          kind: 'user',
          sender: 'teammate',
          name: 'Fabian',
          image: '',
          body: body.body,
          created_at: '2026-10-23T10:00:00Z',
          request_id: body.request_id,
        };
        messages.push(message);
        return r.fulfill({
          json: {
            order_id: id,
            assignment_id: assignment,
            request_id: body.request_id,
            outcome: 'sent',
            message,
            note: null,
          },
        });
      }
      expect(url.searchParams.get('assignment_id')).toBe(assignment);
      return r.fulfill({
        json: {
          order_id: id,
          assignment_id: assignment,
          viewer: 'teammate',
          writable: true,
          participant: { role: 'customer', name: 'Customer', image: '' },
          messages,
          typing: [],
          archives: [],
        },
      });
    }
    if (url.pathname.endsWith('/proof'))
      return r.fulfill({ json: { proofs: [] } });
    return r.fulfill({ status: 404, json: { error: 'Unexpected endpoint' } });
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Ready to play?' }),
  ).toBeVisible();
  await expect(page.getByText('DL-42', { exact: true })).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.getByText('Queue settings', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText('Earned today', { exact: true })).toHaveCount(0);
  await expect(page.locator('header')).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath('teammate-queue.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(
    page.getByText('Finish with proof', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Choose one evidence image')).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Mark as done', exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel('Message Customer', { exact: true })
    .fill('Hello customer');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('Hello customer', { exact: true })).toBeVisible();
  await expect(page.getByText('Sent', { exact: false })).toBeVisible();
  expect(
    requests.some((p) =>
      /stats|heartbeat|leaderboard|settings|preview/.test(p),
    ),
  ).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: 'Refresh evidence' }),
  ).toHaveCSS('min-height', '44px');
  expect(
    (await page
      .getByRole('heading', { name: 'Duo queue ×2 with Customer' })
      .boundingBox())!.width,
  ).toBeGreaterThan(100);
  await page.screenshot({
    path: info.outputPath('teammate-active.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test('uploads private evidence then freezes completion across uncertain retry and authoritative readback', async ({
  page,
}, info) => {
  let uploaded = false,
    completed = false,
    orderReads = 0,
    denyReadback = true;
  const attempts: unknown[] = [];
  const proof = {
    id: '77777777-7777-4777-8777-777777777777',
    order_id: id,
    assignment_id: assignment,
    mime: 'image/png',
    byte_size: image.length,
    created_at: '2026-10-23T10:00:00Z',
  };
  await page.route('**/api/**', async (r) => {
    const req = r.request(),
      path = new URL(req.url()).pathname;
    if (path === '/api/teammate/order') {
      orderReads++;
      return denyReadback && completed
        ? r.fulfill({ status: 503, json: {} })
        : r.fulfill({
            json: {
              order: completed
                ? null
                : {
                    ...order,
                    status: 'in_progress',
                    current_assignment_id: assignment,
                  },
            },
          });
    }
    if (path === '/api/teammate/queue')
      return r.fulfill({ json: { orders: [] } });
    if (path.endsWith('/chat'))
      return r.fulfill({
        json: {
          order_id: id,
          assignment_id: assignment,
          viewer: 'teammate',
          writable: true,
          participant: { role: 'customer', name: 'Customer', image: '' },
          messages: [],
          typing: [],
          archives: [],
        },
      });
    if (path.endsWith('/proof') && req.method() === 'POST') {
      expect(path).toBe('/api/teammate/orders/' + id + '/proof');
      expect(req.headers()['x-assignment-id']).toBe(assignment);
      expect(req.headers()['x-csrf-token']).toBe('fixture-csrf');
      uploaded = true;
      return r.fulfill({ json: { proof } });
    }
    if (path.endsWith('/proof'))
      return r.fulfill({ json: { proofs: uploaded ? [proof] : [] } });
    if (path.includes('/proof/'))
      return r.fulfill({ contentType: 'image/png', body: image });
    if (path.endsWith('/complete')) {
      const command = req.postDataJSON();
      attempts.push(command);
      expect(command.assignment_id).toBe(assignment);
      expect(command.proof_ids).toEqual([proof.id]);
      if (attempts.length === 1)
        return r.fulfill({
          status: 503,
          json: { error: 'Acknowledgement lost' },
        });
      completed = true;
      return r.fulfill({
        json: {
          completion: {
            order_id: id,
            assignment_id: assignment,
            request_id: command.request_id,
            proof_ids: command.proof_ids,
            completed_at: '2026-10-23T10:00:00Z',
            payout_usd_cents: 1234,
            deposit_percent: 10,
            held_usd_cents: 123,
            net_usd_cents: 1111,
            trust_tier: 'rookie',
          },
        },
      });
    }
    return r.fulfill({ status: 404, json: {} });
  });
  await page.goto('/');
  await page
    .getByLabel('Choose one evidence image')
    .setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: image });
  await page.getByRole('button', { name: 'Upload selected image' }).click();
  await expect(
    page.getByRole('button', { name: 'Mark as done', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Mark as done', exact: true }).click();
  const reads = orderReads;
  await page.waitForTimeout(3300);
  expect(orderReads).toBe(reads);
  await page
    .getByRole('button', { name: 'Confirm completion', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Retry same completion' }),
  ).toBeVisible();
  await page.waitForTimeout(3300);
  expect(orderReads).toBe(reads);
  expect(attempts).toHaveLength(1);
  await page.screenshot({
    path: info.outputPath('teammate-completion-uncertain.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Retry same completion' }).click();
  await expect(
    page.getByRole('button', { name: 'Read back desk' }),
  ).toBeEnabled();
  expect(attempts[0]).toEqual(attempts[1]);
  const failedReads = orderReads;
  await page.waitForTimeout(3300);
  expect(orderReads).toBe(failedReads);
  denyReadback = false;
  await page.getByRole('button', { name: 'Read back desk' }).click();
  await expect(
    page.getByText('Finish with proof', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Waiting for orders!', { exact: true }),
  ).toBeVisible();
  expect(attempts).toHaveLength(2);
  await page.screenshot({
    path: info.outputPath('teammate-completed.png'),
    fullPage: true,
  });
});

test('desk 401 removes mounted private assignment, chat and evidence controls', async ({
  page,
}) => {
  let signedOut = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/teammate/queue')
      return route.fulfill({ json: { orders: [] } });
    if (path === '/api/teammate/order')
      return signedOut
        ? route.fulfill({ status: 401, json: { error: 'Signed out' } })
        : route.fulfill({
            json: {
              order: {
                ...order,
                status: 'in_progress',
                current_assignment_id: assignment,
              },
            },
          });
    if (path.endsWith('/chat'))
      return route.fulfill({
        json: {
          order_id: id,
          assignment_id: assignment,
          viewer: 'teammate',
          writable: true,
          participant: { role: 'customer', name: 'Customer', image: '' },
          messages: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              sequence: 1,
              kind: 'user',
              sender: 'customer',
              name: 'Customer',
              image: '',
              body: 'Private conversation',
              created_at: '2026-10-23T10:00:00Z',
              request_id: id,
            },
          ],
          typing: [],
          archives: [],
        },
      });
    if (path.endsWith('/proof')) return route.fulfill({ json: { proofs: [] } });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/');
  await expect(
    page.getByText('Private conversation', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Choose one evidence image')).toBeVisible();
  await page
    .getByLabel('Message Customer', { exact: true })
    .fill('Private draft');
  signedOut = true;
  await expect(
    page.getByText('Sign in again to load your desk.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Private conversation', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Player#EUW', { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel('Message Customer', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Choose one evidence image')).toHaveCount(0);
  await expect(
    page.getByText('Finish with proof', { exact: true }),
  ).toHaveCount(0);
});
for (const failure of ['503', 'network']) {
  test(`uncertain accept ${failure} only permits read-only refresh before another acceptance`, async ({
    page,
  }) => {
    let uncertain = false;
    let recovered = false;
    const mutations: string[] = [];
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/teammate/queue')
        return route.fulfill({
          json: {
            orders: [
              order,
              {
                ...order,
                id: '33333333-3333-4333-8333-333333333333',
                public_reference: 'DL-43',
              },
            ],
          },
        });
      if (path === '/api/teammate/order')
        return uncertain && !recovered
          ? route.fulfill({ status: 503, json: {} })
          : route.fulfill({ json: { order: null } });
      if (path.endsWith('/accept')) {
        mutations.push(path);
        uncertain = true;
        return failure === 'network'
          ? route.abort('failed')
          : route.fulfill({ status: 503, json: { error: 'Uncertain' } });
      }
      return route.fulfill({ status: 404, json: {} });
    });
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: 'Accept', exact: true }),
    ).toHaveCount(2);
    await page
      .getByRole('button', { name: 'Accept', exact: true })
      .first()
      .click();
    await expect(
      page.getByRole('button', { name: 'Refresh desk', exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Accept', exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Refresh desk', exact: true })
      .click();
    await expect(
      page.getByText('Could not load your desk. Retrying…', { exact: true }),
    ).toBeVisible();
    expect(mutations).toHaveLength(1);
    recovered = true;
    await page
      .getByRole('button', { name: 'Refresh desk', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Accept', exact: true }),
    ).toHaveCount(2);
    expect(mutations).toHaveLength(1);
  });
}
test('Discord gate is the original popup with a real CSRF link form and no desk requests', async ({
  page,
}) => {
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) calls.push(r.url());
  });
  await page.goto('/?discord=missing');
  await expect(page.getByRole('dialog')).toBeVisible();
  const form = page.locator('form[action="/api/discord/link"]');
  await expect(form.locator('[name="csrf"]')).toHaveValue('fixture-csrf');
  await expect(form.locator('[name="next"]')).toHaveValue('teammate');
  await expect(
    form.getByRole('button', { name: 'Connect Discord' }),
  ).toBeEnabled();
  expect(calls).toEqual([]);
});
