import type { APIContext } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { review } from '../../src/server/reviews/handlers';
import { createTipIntent } from '../../src/server/tips/handler';
import { eurToUsd } from '../../src/server/fx';
import { paidOf } from '../../src/components/account/dashboard-data';
import { tipMoney } from '../../src/components/account/MatchStage.jsx';
import { CustomerOrderSchema } from '../../src/contracts/orders';
import { TipSchema } from '../../src/contracts/tips';

const { adminRpc } = vi.hoisted(() => ({ adminRpc: vi.fn() }));
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
vi.mock('../../src/server/payments/config', () => ({
  paymentsConfig: () => ({ publishableKey: 'pk_test_1' }),
  adminFor: () => ({ rpc: adminRpc }),
  stripeFor: () => ({}),
}));
vi.mock('../../src/server/tips/handler', () => ({
  createTipIntent: vi.fn(async () => ({ clientSecret: 'cs', amount: 4.58 })),
}));
vi.mock('../../src/server/fx', async (real) => ({
  ...(await real<typeof import('../../src/server/fx')>()),
  eurToUsd: vi.fn(),
}));

const rpc = vi.fn();
const token = 'a'.repeat(64);
const id = '00000000-0000-4000-8000-000000000001';
const tipId = '00000000-0000-4000-8000-000000000009';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const post = (body: object) => {
  const request = new Request('http://localhost/api/orders/' + id + '/review', {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: JSON.stringify({
      csrf: token,
      rating: 5,
      text: '',
      tags: [],
      ...body,
    }),
  });
  return review({
    request,
    url: new URL(request.url),
    params: { id },
    cookies: { get: () => ({ value: token }) },
  } as unknown as APIContext) as Promise<Response>;
};
const order = {
  id,
  public_reference: 'DL-1',
  status: 'completed',
  game: 'lol',
  service: 'duo',
  title: 'Duo',
  units: 1,
  unit: 'game',
  gg: false,
  rank: '',
  region: 'EUW',
  ign: 'Player',
  note: '',
  voice: false,
  current_assignment_id: '00000000-0000-4000-8000-000000000002',
  amount_eur_cents: 1000,
  created_at: '2026-10-24T10:00:00Z',
  queued_at: '2026-10-24T10:00:00Z',
  accepted_at: '2026-10-24T10:01:00Z',
  completed_at: '2026-10-24T11:00:00Z',
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 0,
  teammate: { name: 'Mina', image: '', country: 'at' },
  review: { rating: 5, text: '', tags: [], at: '2026-10-24T11:05:00Z' },
};
const tip = (cents: number) => ({
  amount: cents / 100,
  currency: 'EUR' as const,
  state: 'pending' as const,
  refunded: 0,
  paidAt: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(eurToUsd).mockResolvedValue({
    rate: 1.08,
    source: 'ecb',
    date: '2026-11-02',
    fetchedAt: 0,
  });
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity: async () => ({ viewer: { id, role: 'customer', email: null } }),
    json,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
  rpc.mockImplementation(
    async (_name: string, args: { p_amount_cents: number }) => ({
      data: {
        order: { ...order, tip: tip(args.p_amount_cents) },
        tipPrepared: {
          tipId,
          amountCents: args.p_amount_cents,
          attempt: 0,
          paymentIntentId: null,
          reference: 'DL-1',
          teammate: 'Mina',
          tip: tip(args.p_amount_cents),
        },
      },
      error: null,
    }),
  );
  adminRpc.mockResolvedValue({ data: true, error: null });
});

describe('dollar tips', () => {
  it('converts $5 at the customer rate, charges it in EUR and keeps the $5 to show', async () => {
    const res = await post({ tip_cents: 500, tip_currency: 'USD' });
    expect(res.status).toBe(200);
    // ECB 1.08 + 1% = 1.0908 dollars per euro: $5.00 is €4.58
    expect(rpc).toHaveBeenCalledWith(
      'order_review_tip',
      expect.objectContaining({ p_amount_cents: 458 }),
    );
    expect(adminRpc).toHaveBeenCalledWith('order_tip_set_shown', {
      p_tip_id: tipId,
      p_currency: 'USD',
      p_amount_cents: 500,
    });
    expect(createTipIntent).toHaveBeenCalledWith(
      expect.objectContaining({ shown: { currency: 'USD', amount: 5 } }),
    );
    expect((await res.json()).order.tip.shown).toEqual({
      currency: 'USD',
      amount: 5,
    });
  });

  it('euro tips work as before', async () => {
    await post({ tip_cents: 500 });
    expect(rpc).toHaveBeenCalledWith(
      'order_review_tip',
      expect.objectContaining({ p_amount_cents: 500 }),
    );
    expect(adminRpc).not.toHaveBeenCalled();
    expect(createTipIntent).toHaveBeenCalledWith(
      expect.objectContaining({ shown: null }),
    );
  });

  it('refuses dollar tips under $2 or over $100', async () => {
    const low = await post({ tip_cents: 150, tip_currency: 'USD' });
    expect(low.status).toBe(400);
    expect((await low.json()).error).toBe('Tips can be from $2 to $100.');
    // over $100 is already outside the request schema
    const high = await post({ tip_cents: 10100, tip_currency: 'USD' });
    expect(high.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('still opens the payment when the dollar amount cannot be stored yet', async () => {
    adminRpc.mockResolvedValue({ data: null, error: { message: 'missing' } });
    const res = await post({ tip_cents: 500, tip_currency: 'USD' });
    expect(res.status).toBe(200);
    expect(createTipIntent).toHaveBeenCalledWith(
      expect.objectContaining({ shown: null }),
    );
  });

  it('shows the tip as the customer picked it', () => {
    const dollars = { ...tip(458), shown: { currency: 'USD', amount: 5 } };
    expect(tipMoney(dollars)).toBe('$5');
    expect(tipMoney(tip(500))).toBe('€5');
    expect(tipMoney(tip(458))).toBe('€4.58');
    expect(TipSchema.safeParse(dollars).success).toBe(true);
    expect(TipSchema.safeParse(tip(500)).success).toBe(true);
  });
});

describe('what the customer paid', () => {
  const paid = (p: object) => ({
    amount_eur_cents: 1617,
    payment: {
      amount_minor: 1891,
      currency: 'USD',
      method: 'paypal',
      wallet_eur_cents: 0,
      ...p,
    },
  });

  it('a card part charged in USD shows in USD, with the method', () => {
    expect(paidOf(paid({}))).toEqual({
      currency: 'USD',
      total: 18.91,
      method: 'PayPal',
    });
  });

  it('EUR, other currencies and wallet parts show the EUR price', () => {
    expect(
      paidOf(paid({ amount_minor: 1617, currency: 'EUR', method: 'card' })),
    ).toEqual({ currency: 'EUR', total: 16.17, method: 'Card' });
    expect(paidOf(paid({ currency: 'GBP' }))?.currency).toBe('EUR');
    expect(paidOf(paid({ wallet_eur_cents: 500 }))).toEqual({
      currency: 'EUR',
      total: 16.17,
      method: 'PayPal + Duoly balance',
    });
    expect(
      paidOf(
        paid({
          amount_minor: null,
          currency: null,
          method: null,
          wallet_eur_cents: 1617,
        }),
      ),
    ).toEqual({ currency: 'EUR', total: 16.17, method: 'Duoly balance' });
  });

  it('nothing to show before the migration or for a free order', () => {
    expect(paidOf({ amount_eur_cents: 1617 })).toBeNull();
    expect(paidOf({ ...paid({}), free_perk: true })).toBeNull();
  });

  it('the customer order contract accepts the payment or its absence', () => {
    const base = { ...order, review: null };
    expect(CustomerOrderSchema.safeParse(base).success).toBe(true);
    expect(
      CustomerOrderSchema.safeParse({ ...base, payment: paid({}).payment })
        .success,
    ).toBe(true);
  });
});

describe('loyalty gifts in the customer currency', () => {
  it('shows the fixed gift amounts in dollars for USD, like euros', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { default: Rewards } =
      await import('../../src/components/account/Rewards.jsx');
    const render = (props: object) =>
      renderToStaticMarkup(
        React.createElement(Rewards, {
          name: 'Alex',
          orders: 120,
          cashbackTotal: 0,
          cashbackMonth: 0,
          cashbackPending: 0,
          pendingOrders: 0,
          ...props,
        }),
      );
    const usd = render({ sym: '$', money: (n: number) => '$' + n.toFixed(2) });
    for (const n of [5, 15, 40, 100]) expect(usd).toContain('$' + n + ' gift');
    expect(usd).not.toContain('€');
    const eur = render({});
    for (const n of [5, 15, 40, 100]) expect(eur).toContain('€' + n + ' gift');
  });
});
