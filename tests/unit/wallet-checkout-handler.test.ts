import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  stripeCalls: 0,
  inserted: null as Record<string, unknown> | null,
}));

vi.mock('../../src/server/auth/handlers', () => ({
  mutation: async () => ({
    account: {
      json: (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status }),
      identity: async () => ({
        viewer: {
          id: 'b4000000-0000-4000-8000-000000000002',
          role: 'customer',
          email: 'wallet@example.invalid',
        },
      }),
      client: { rpc: async () => ({ data: { order: null }, error: null }) },
    },
    body: {
      csrf: 'csrf',
      gameId: 'lol',
      serviceId: 'duo2',
      units: 1,
      server: 'EUW',
      rank: 'Gold',
      ign: 'Wallet#EUW',
      useWallet: true,
    },
    failure: null,
  }),
}));

vi.mock('../../src/server/payments/config', () => {
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      if (fn === 'checkout_reserve_wallet')
        return {
          data: { wallet_eur_cents: 399, card_eur_cents: 0 },
          error: null,
        };
      if (fn === 'create_wallet_order')
        return {
          data: { order_id: 'order-wallet-1', created: true },
          error: null,
        };
      return { data: null, error: null };
    },
    from: (table: string) => {
      if (table === 'customer_blocks')
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      if (table === 'checkout_intents')
        return {
          insert: (row: Record<string, unknown>) => {
            state.inserted = row;
            return {
              select: () => ({
                single: async () => ({
                  data: { id: 'b4200000-0000-4000-8000-000000000001' },
                  error: null,
                }),
              }),
            };
          },
        };
      throw new Error(`unexpected table ${table}`);
    },
  };
  return {
    paymentsConfig: () => ({ origin: 'https://duoly.gg' }),
    adminFor: () => admin,
    stripeFor: () => {
      state.stripeCalls += 1;
      throw new Error('wallet-only checkout must not create Stripe');
    },
    AUTHORIZE_ONLY_METHODS: ['card', 'paypal'],
  };
});

vi.mock('../../src/server/fx', () => ({
  eurToUsd: async () => ({ rate: 1.08 }),
  FALLBACK_EUR_TO_USD: 1.08,
}));

vi.mock('../../src/server/referrals', () => ({
  checkoutRefCode: () => null,
}));

const { createCheckout } = await import('../../src/server/payments/checkout');

describe('wallet checkout handler', () => {
  beforeEach(() => {
    state.rpcCalls = [];
    state.stripeCalls = 0;
    state.inserted = null;
  });

  it('reserves after server pricing and creates a full-wallet order without Stripe', async () => {
    const response = await createCheckout({ cookies: {} } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      order_id: 'order-wallet-1',
      url: '/queue/order-wallet-1',
      wallet_only: true,
    });
    expect(state.inserted?.amount_eur_cents).toBe(399);
    expect(state.inserted).not.toHaveProperty('wallet_eur_cents');
    expect(state.rpcCalls.map((call) => call.fn)).toEqual([
      'checkout_reserve_wallet',
      'create_wallet_order',
    ]);
    expect(state.stripeCalls).toBe(0);
  });
});
