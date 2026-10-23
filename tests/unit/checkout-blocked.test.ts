import { beforeEach, describe, expect, it, vi } from 'vitest';

// Blocked customers (admin Customers screen) must be refused before any Stripe session exists.
const state = vi.hoisted(() => ({
  blocked: null as null | { user_id: string },
  blockError: null as null | { message: string },
  stripeCalls: 0,
}));

vi.mock('../../src/server/auth/handlers', () => ({
  mutation: async () => ({
    account: {
      json: (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status }),
      identity: async () => ({ viewer: { id: 'u1', role: 'customer' } }),
      client: { rpc: async () => ({ data: { order: null }, error: null }) },
    },
    body: {
      csrf: 'x',
      gameId: 'lol',
      serviceId: 'duo2',
      units: 3,
      server: 'EUW',
      rank: 'Platinum',
      ign: 'Me#EUW',
    },
    failure: null,
  }),
}));

vi.mock('../../src/server/payments/config', () => ({
  paymentsConfig: () => ({ origin: 'http://x' }),
  adminFor: () => ({
    from: (table: string) => {
      expect(table).toBe('customer_blocks');
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: state.blocked,
              error: state.blockError,
            }),
          }),
        }),
      };
    },
  }),
  stripeFor: () => {
    state.stripeCalls += 1;
    throw new Error('stripe must not be reached in this test');
  },
}));

vi.mock('../../src/server/fx', () => ({
  eurToUsd: async () => ({ rate: 1.08 }),
  FALLBACK_EUR_TO_USD: 1.08,
}));

const { createCheckout, buildCheckout } =
  await import('../../src/server/payments/checkout');

describe('checkout refuses blocked customers', () => {
  beforeEach(() => {
    state.blocked = null;
    state.blockError = null;
    state.stripeCalls = 0;
  });

  it('returns 403 for a blocked customer and never touches Stripe', async () => {
    state.blocked = { user_id: 'u1' };
    const res = await createCheckout({} as never);
    expect(res.status).toBe(403);
    expect(await res.text()).toContain('can’t book');
    expect(state.stripeCalls).toBe(0);
  });

  it('fails closed (503) when the block lookup errors', async () => {
    state.blockError = { message: 'down' };
    const res = await createCheckout({} as never);
    expect(res.status).toBe(503);
    expect(state.stripeCalls).toBe(0);
  });

  it('lets an unblocked customer through to Stripe', async () => {
    void buildCheckout;
    const res = await createCheckout({} as never).catch(() => null);
    expect(res === null || res.status !== 403).toBe(true);
    expect(state.stripeCalls).toBe(1);
  });
});
