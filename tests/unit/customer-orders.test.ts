import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CustomerOrders from '../../src/components/account/CustomerOrders';
import CustomerOrderRoom from '../../src/components/account/CustomerOrderRoom';
import type { CustomerOrder } from '../../src/contracts/orders';
import {
  canReroll,
  orderCommand,
  orderRequest,
} from '../../src/components/account/customer-orders';

it('strictly parses customer envelopes and hides transport diagnostics', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ order: null })));
  await expect(
    orderRequest('customerActive', '/api/orders/active', undefined, fetcher),
  ).resolves.toEqual({ order: null });
  fetcher.mockResolvedValue(
    new Response(JSON.stringify({ order: null, secret: 'SQL' })),
  );
  await expect(
    orderRequest('customerActive', '/api/orders/active', undefined, fetcher),
  ).rejects.toThrow('Invalid order response.');
  fetcher.mockResolvedValue(
    new Response('<html>SQL secret</html>', { status: 503 }),
  );
  await expect(
    orderRequest('customerActive', '/api/orders/active', undefined, fetcher),
  ).rejects.toThrow('Order service unavailable.');
});
const order: CustomerOrder = {
  id: '00000000-0000-4000-8000-000000000001',
  public_reference: 'DL-1',
  status: 'queued',
  game: 'lol',
  service: 'duo',
  title: 'Duo session',
  units: 2,
  unit: 'game',
  gg: false,
  rank: 'Gold',
  region: 'EU',
  ign: 'Player',
  note: '<script>secret</script>',
  voice: true,
  amount_eur_cents: 999,
  created_at: '2026-10-22T10:00:00Z',
  queued_at: '2026-10-22T10:00:00Z',
  accepted_at: null,
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 0,
  current_assignment_id: null,
  teammate: null,
};
it('renders distinct initial loading states, not empty orders or fabricated totals', () => {
  const html = renderToStaticMarkup(
    createElement(CustomerOrders, { name: 'Player' }),
  );
  expect(html).toContain('Loading active order');
  expect(html).toContain('Loading order history');
  expect(html).toContain('Loading refund credit postings');
  expect(html).not.toMatch(/No active order|wallet balance|Book a duo/);
});
it('renders own order safely and only offers queued cancellation', () => {
  const html = renderToStaticMarkup(
    createElement(CustomerOrderRoom, {
      initialOrder: order,
      csrf: 'safe-csrf',
    }),
  );
  expect(html).toContain('DL-1');
  expect(html).toContain('Cancel queued order');
  expect(html).not.toContain('Switch teammate');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>secret');
  for (const status of ['completed', 'cancelled'] as const) {
    const final = renderToStaticMarkup(
      createElement(CustomerOrderRoom, {
        initialOrder: { ...order, status },
        csrf: '',
      }),
    );
    expect(final).not.toContain('Cancel queued order');
  }
});
it('limits reroll affordance to assigned in-progress orders within five minutes and two rerolls', () => {
  const now = Date.parse('2026-10-22T10:02:00Z');
  const active = {
    ...order,
    status: 'in_progress' as const,
    accepted_at: order.created_at,
    current_assignment_id: order.id,
  };
  expect(canReroll(active, now)).toBe(true);
  expect(canReroll({ ...active, rerolls: 2 }, now)).toBe(false);
  expect(canReroll(active, now + 300001)).toBe(false);
  expect(canReroll(order, now)).toBe(false);
});
it('does not confirm a command for a different order or an unchanged state', async () => {
  const cases = [
    { action: 'cancel' as const, response: order },
    {
      action: 'cancel' as const,
      response: {
        ...order,
        id: '22222222-2222-4222-8222-222222222222',
        status: 'cancelled',
        cancelled_at: order.created_at,
        cancel_reason: 'customer_cancelled',
      },
    },
    {
      action: 'reroll' as const,
      response: {
        ...order,
        status: 'in_progress',
        accepted_at: order.created_at,
        current_assignment_id: order.id,
      },
    },
    {
      action: 'reroll' as const,
      response: { ...order, rerolls: 1, current_assignment_id: order.id },
    },
  ];
  for (const { action, response } of cases) {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ order: response })));
    vi.stubGlobal('fetch', fetcher);
    try {
      await expect(
        orderCommand(order.id, action, 'csrf-token'),
      ).rejects.toThrow('Order action could not be confirmed.');
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  }
});
it('posts only CSRF to the existing command path once, including conflict and expiry', async () => {
  const cancelled = {
    ...order,
    status: 'cancelled' as const,
    cancelled_at: order.created_at,
    cancel_reason: 'customer_cancelled' as const,
  };
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ order: cancelled })));
  vi.stubGlobal('fetch', fetcher);
  try {
    await expect(
      orderCommand(order.id, 'cancel', 'csrf-token'),
    ).resolves.toEqual({ order: cancelled });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      `/api/orders/${order.id}/cancel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf: 'csrf-token' }),
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      },
    );
    for (const status of [409, 410]) {
      fetcher.mockClear();
      fetcher.mockResolvedValue(
        new Response('SQL private diagnostics', { status }),
      );
      await expect(
        orderCommand(order.id, 'reroll', 'csrf-token'),
      ).rejects.toThrow(
        status === 409
          ? 'Order changed or action unavailable.'
          : 'Order expired or cancelled.',
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  } finally {
    vi.unstubAllGlobals();
  }
});
it('confirms a reroll only after the server returns the same queued, unassigned order', async () => {
  const queued = { ...order, rerolls: 1 };
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ order: queued })));
  vi.stubGlobal('fetch', fetcher);
  try {
    await expect(
      orderCommand(order.id, 'reroll', 'csrf-token'),
    ).resolves.toEqual({ order: queued });
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
it('rejects malformed successful detail and unknown response fields', async () => {
  for (const data of [
    { order: null },
    { order: { ...order, access_token: 'secret' } },
    { order, balance: 100 },
  ]) {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(data)));
    await expect(
      orderRequest(
        'customerOrder',
        '/api/orders/' + order.id,
        undefined,
        fetcher,
      ),
    ).rejects.toThrow('Invalid order response.');
  }
});
