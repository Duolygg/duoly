import { test, expect } from '@playwright/test';

// Admins correct a made-up win/loss report and wrong screenshots (migration 20261105140000),
// against fictional API answers.

const orderId = '99999999-9999-4999-8999-999999999999';
const assignmentId = '99999999-9999-4999-8999-99999999aaaa';
type FixtureProof = { id: string; removed: unknown; addedBy: unknown } & Record<
  string,
  unknown
>;
const proof = (
  id: string,
  extra: Record<string, unknown> = {},
): FixtureProof => ({
  id,
  order_id: orderId,
  assignment_id: assignmentId,
  mime: 'image/png',
  byte_size: 68,
  created_at: '2026-11-04T10:00:00.000Z',
  removed: null,
  addedBy: null,
  ...extra,
});
// a 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test('an admin corrects the result, removes a wrong screenshot and adds the right one', async ({
  page,
}) => {
  const posts: {
    path: string;
    body: unknown;
    headers?: Record<string, string>;
  }[] = [];
  let proofs = [
    proof('11111111-1111-4111-8111-111111111111'),
    proof('22222222-2222-4222-8222-222222222222'),
  ];
  const report = {
    orderId,
    assignmentId,
    reference: 'DL-501',
    game: 'lol',
    service: 'duo1',
    title: 'Duo Plus',
    units: 2,
    orderIgn: 'Viewer#EUW',
    customer: 'Dana',
    teammate: { id: 't', name: 'Tim Teammate', image: '' },
    state: 'completed',
    games: [
      {
        teammateIgn: 'Tim#1',
        customerIgn: 'Viewer#EUW',
        link: 'https://x.test/1',
      },
      {
        teammateIgn: 'Tim#1',
        customerIgn: 'Viewer#EUW',
        link: 'https://x.test/2',
      },
    ],
    wins: 2,
    losses: 0,
    edited: null,
    createdAt: '2026-11-04T10:00:00.000Z',
    updatedAt: '2026-11-04T10:00:00.000Z',
  };
  await page.route('**/api/**', async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/admin/match-reports') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        posts.push({ path, body });
        return r.fulfill({
          json: {
            report: {
              assignmentId,
              games: body.games,
              wins: body.wins,
              losses: body.losses,
              edited: {
                by: 'Fixture Admin',
                at: '2026-11-04T11:00:00.000Z',
                reason: body.reason,
              },
            },
          },
        });
      }
      return r.fulfill({ json: { reports: [report] } });
    }
    if (path === '/api/admin/proofs/' + orderId) {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        posts.push({ path, body });
        proofs = proofs.map((p) =>
          p.id === body.proofId
            ? {
                ...p,
                removed: body.removed
                  ? {
                      by: 'Fixture Admin',
                      at: '2026-11-04T11:00:00.000Z',
                      reason: body.reason,
                    }
                  : null,
              }
            : p,
        );
      }
      return r.fulfill({ json: { proofs } });
    }
    if (path === '/api/admin/proofs/' + orderId + '/upload') {
      posts.push({ path, body: null, headers: req.headers() });
      proofs = proofs.concat(
        proof('33333333-3333-4333-8333-333333333333', {
          addedBy: 'Fixture Admin',
        }),
      );
      return r.fulfill({ json: { proof: proofs[proofs.length - 1] } });
    }
    if (path.startsWith('/api/orders/' + orderId + '/proof/'))
      return r.fulfill({ body: PNG, contentType: 'image/png' });
    return r.fulfill({ json: {} });
  });

  await page.goto('/admin/teammates?access=owner');
  await expect.poll(() => page.locator('astro-island[ssr]').count()).toBe(0);
  const main = page.getByRole('main');
  await main.getByRole('tab', { name: /Match reports/ }).dispatchEvent('click');
  const row = main.locator('[data-match-report="DL-501"]');
  await row.getByRole('button', { name: /DL-501/ }).dispatchEvent('click');

  // correct the made-up 2W 0L to 0W 2L
  await row
    .getByRole('button', { name: 'Correct result' })
    .dispatchEvent('click');
  const editor = row.locator('[data-match-editor]');
  await editor.getByLabel('Wins').fill('0');
  await editor.getByLabel('Losses').fill('2');
  await editor
    .getByRole('button', { name: 'Save correction' })
    .dispatchEvent('click');
  await expect(editor.getByRole('alert')).toContainText('Add a reason');
  await editor
    .getByLabel('Reason for the correction')
    .fill('Match history shows 2 losses');
  await editor
    .getByRole('button', { name: 'Save correction' })
    .dispatchEvent('click');
  await expect(row).toContainText('Corrected by Fixture Admin');
  await expect(row).toContainText('0W');
  expect(posts[0]).toMatchObject({
    path: '/api/admin/match-reports',
    body: {
      action: 'edit',
      assignmentId,
      wins: 0,
      losses: 2,
      reason: 'Match history shows 2 losses',
    },
  });

  // remove the second screenshot with a reason
  const shots = row.locator('[data-proof-manager]');
  await expect(shots).toContainText('2 visible');
  await shots
    .getByRole('button', { name: 'Remove' })
    .nth(1)
    .dispatchEvent('click');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('Not from this match');
  await dialog.getByRole('button', { name: 'Remove' }).dispatchEvent('click');
  await expect(shots).toContainText(
    'Removed by Fixture Admin: Not from this match',
  );
  await expect(shots).toContainText('1 visible');
  await expect(shots.getByRole('button', { name: 'Show again' })).toBeVisible();

  // add the correct one
  await shots.getByLabel('Add correct screenshots').setInputFiles({
    name: 'match.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(shots).toContainText('Added by Fixture Admin');
  await expect(shots).toContainText('2 visible');
  const upload = posts.find((p) => p.path.endsWith('/upload'))!;
  expect(upload.headers!['x-csrf-token']).toBe('fixture-csrf');
  expect(upload.headers!['content-type']).toBe('image/png');
  expect(upload.headers!['x-idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
});
