import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OrderDesk, { DeskView } from '../../src/components/teammate/OrderDesk';

it('renders loading, empty and denial honestly without sample orders', () => {
  const html = renderToStaticMarkup(
    createElement(OrderDesk, { csrf: 'token' }),
  );
  expect(html).toContain('Loading eligible orders');
  expect(html).toContain('Loading your assignment');
  expect(html).toContain('Refresh desk');
  expect(html).not.toContain('DL-');
  for (const [kind, text] of [
    ['denied', 'approval and linked Discord'],
    ['signed-out', 'Sign in again'],
    ['unavailable', 'unavailable'],
  ] as const) {
    const view = renderToStaticMarkup(
      createElement(DeskView, {
        state: { queue: { kind }, assignment: { kind: 'ready', value: null } },
        pending: false,
        canAccept: false,
      }),
    );
    expect(view).toContain(text);
    expect(view).not.toContain('No eligible orders');
  }
  const empty = renderToStaticMarkup(
    createElement(DeskView, {
      state: {
        queue: { kind: 'ready', value: [] },
        assignment: { kind: 'ready', value: null },
      },
      pending: false,
      canAccept: true,
    }),
  );
  expect(empty).toContain('No eligible orders');
  expect(empty).toContain('No current assignment');
});

it('renders approved queue details, pending lock and explicit own assignment', () => {
  const html = renderToStaticMarkup(
    createElement(DeskView, {
      state: {
        queue: { kind: 'ready', value: [order] },
        assignment: { kind: 'ready', value: null },
      },
      pending: true,
      canAccept: false,
    }),
  );
  expect(html).toContain('DL-42');
  expect(html).toContain('$12.00 USD');
  expect(html).toMatch(/<button[^>]*disabled/);
  expect(html).not.toMatch(
    /EUR|customer_id|created_at|deadline|priority|previous assignments|hidden orders/i,
  );
  const active = renderToStaticMarkup(
    createElement(DeskView, {
      state: {
        queue: { kind: 'ready', value: [] },
        assignment: {
          kind: 'ready',
          value: {
            ...order,
            status: 'in_progress',
            current_assignment_id: order.id,
          },
        },
      },
      pending: false,
      canAccept: false,
    }),
  );
  expect(active).toContain('Assigned to you');
  expect(active).toContain('Player#EUW');
  expect(active).toContain(
    'Completion, proof uploads, chat and payout withdrawals are unavailable',
  );
});
import {
  readDesk,
  acceptOrder,
  claimAndRefresh,
} from '../../src/components/teammate/OrderDesk';
import type { TeammateOrder } from '../../src/contracts/orders';

const order: TeammateOrder = {
  id: '12345678-1234-4234-8234-123456789012',
  public_reference: 'DL-42',
  status: 'queued',
  game: 'lol',
  service: 'duo',
  title: 'Ranked duo',
  units: 2,
  unit: 'game',
  gg: false,
  rank: 'Gold',
  region: 'EUW',
  ign: 'Player#EUW',
  note: 'Hello',
  voice: true,
  customer_name: 'Player',
  customer_image: '/assets/avatars/avatar-1.png',
  customer_country: 'at',
  payout_usd_cents: 1200,
  current_assignment_id: null,
};

it('rejects extra private fields, malformed envelopes and failed reads rather than showing empty data', async () => {
  for (const payload of [
    { orders: [{ ...order, customer_id: order.id }] },
    { orders: [{ ...order, amount_eur_cents: 1000 }] },
    {},
    { orders: [{ ...order, created_at: '2026-01-01' }] },
  ]) {
    const state = await readDesk(async () => Response.json(payload));
    expect(state.queue.kind).toBe('unavailable');
  }
  const state = await readDesk(async () => {
    throw new Error('offline');
  });
  expect(state.queue.kind).toBe('unavailable');
  expect(state.assignment.kind).toBe('unavailable');
});

it('posts only csrf with same-origin credentials and validates acceptance response', async () => {
  const result = await acceptOrder(
    async (url, init) => {
      expect(url).toBe(`/api/teammate/orders/${order.id}/accept`);
      expect(init).toEqual({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf: 'token' }),
      });
      return Response.json({
        order: {
          ...order,
          status: 'in_progress',
          current_assignment_id: order.id,
        },
      });
    },
    order.id,
    'token',
  );
  expect(result).toBe('accepted');
});

it('does not retry claims and distinguishes conflicts, expiry, denial and uncertain results', async () => {
  for (const [status, expected] of [
    [409, 'conflict'],
    [410, 'expired'],
    [403, 'denied'],
    [401, 'signed-out'],
    [503, 'uncertain'],
  ] as const) {
    let calls = 0;
    expect(
      await acceptOrder(
        async () => {
          calls++;
          return new Response('{}', { status });
        },
        order.id,
        'token',
      ),
    ).toBe(expected);
    expect(calls).toBe(1);
  }
  expect(
    await acceptOrder(
      async () => Response.json({ order: { ...order, customer_id: order.id } }),
      order.id,
      'token',
    ),
  ).toBe('uncertain');
  let calls = 0;
  expect(
    await acceptOrder(
      async () => {
        calls++;
        throw new Error('offline');
      },
      order.id,
      'token',
    ),
  ).toBe('uncertain');
  expect(calls).toBe(1);
  expect(
    await acceptOrder(
      async () => {
        throw new Error('must not call');
      },
      '../bad',
      'token',
    ),
  ).toBe('unavailable');
});

describe('teammate desk reads', () => {
  it('keeps eligibility denial separate from an empty assignment', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const state = await readDesk(async (url, init) => {
      calls.push([url, init]);
      return new Response(
        JSON.stringify(
          url.endsWith('/queue') ? { error: 'denied' } : { order: null },
        ),
        { status: url.endsWith('/queue') ? 403 : 200 },
      );
    });
    expect(state.queue).toEqual({ kind: 'denied' });
    expect(state.assignment).toEqual({ kind: 'ready', value: null });
    expect(calls.map(([url]) => url).sort()).toEqual([
      '/api/teammate/order',
      '/api/teammate/queue',
    ]);
    expect(
      calls.every(
        ([, init]) =>
          init?.credentials === 'same-origin' &&
          init.cache === 'no-store' &&
          init.method === 'GET',
      ),
    ).toBe(true);
  });
});

it('refreshes both authoritative reads after success, conflict or expiry, never retries POST', async () => {
  for (const status of [200, 409, 410, 503]) {
    const calls: string[] = [];
    const result = await claimAndRefresh(
      async (url, init) => {
        calls.push(`${init?.method} ${url}`);
        if (init?.method === 'POST')
          return Response.json(
            {
              order: {
                ...order,
                status: 'in_progress',
                current_assignment_id: order.id,
              },
            },
            { status },
          );
        return Response.json(
          url.endsWith('/queue')
            ? { orders: [] }
            : {
                order: {
                  ...order,
                  status: 'in_progress',
                  current_assignment_id: order.id,
                },
              },
        );
      },
      order.id,
      'token',
    );
    expect(calls.filter((call) => call.startsWith('POST'))).toHaveLength(1);
    expect(calls.filter((call) => call.startsWith('GET'))).toHaveLength(
      status === 503 ? 0 : 2,
    );
    if (status !== 503) expect(result.state?.assignment.kind).toBe('ready');
  }
});

it('maps expired sessions and denied staff access without parsing untrusted error messages', async () => {
  for (const [status, kind] of [
    [401, 'signed-out'],
    [403, 'denied'],
    [404, 'denied'],
    [503, 'unavailable'],
  ] as const) {
    const state = await readDesk(
      async () => new Response('not JSON', { status }),
    );
    expect(state.queue).toEqual({ kind });
    expect(state.assignment).toEqual({ kind });
  }
});

it('rejects malformed, mismatched or inactive acceptance successes', async () => {
  for (const payload of [
    {},
    { order },
    {
      order: {
        ...order,
        id: '00000000-0000-4000-8000-000000000001',
        status: 'in_progress',
        current_assignment_id: order.id,
      },
    },
    { order: { ...order, status: 'in_progress' } },
  ]) {
    expect(
      await acceptOrder(async () => Response.json(payload), order.id, 'token'),
    ).toBe('uncertain');
  }
});
