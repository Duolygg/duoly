import { beforeEach, describe, expect, it, vi } from 'vitest';

// Checkout routing for perks: the free order never touches Stripe or the wallet, refusals
// map to customer copy, and a pick source lands on the intent for create_paid_order.
const SOURCE = 'b5000000-0000-4000-8000-0000000000a1';
const ORDER = 'b5000000-0000-4000-8000-0000000000b1';
const INTENT = 'b5000000-0000-4000-8000-0000000000c1';
const perks = (level: string, available: boolean, eligible = true) => ({
  level,
  freeCoaching: {
    eligible,
    used: eligible && !available,
    available,
    month: '2026-10',
  },
  pickTeammate: { eligible: level === 'diamond' },
});

const state = vi.hoisted(() => ({
  body: {} as Record<string, unknown>,
  userCalls: [] as { fn: string; args?: Record<string, unknown> }[],
  adminCalls: [] as { fn: string; args: Record<string, unknown> }[],
  stripeCalls: 0,
  inserted: null as Record<string, unknown> | null,
  perks: null as unknown,
  pickable: null as unknown,
  freeAnswer: null as { data: unknown; error: unknown } | null,
  refCode: null as string | null,
}));

vi.mock('../../src/server/auth/handlers', () => ({
  mutation: async () => ({
    account: {
      json: (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status }),
      identity: async () => ({
        viewer: {
          id: 'b5000000-0000-4000-8000-000000000001',
          role: 'customer',
          email: null,
        },
      }),
      client: {
        rpc: async (fn: string, args?: Record<string, unknown>) => {
          state.userCalls.push({ fn, args });
          if (fn === 'customer_active_order')
            return { data: { order: null }, error: null };
          if (fn === 'customer_perks')
            return { data: state.perks, error: null };
          if (fn === 'customer_pickable_teammates')
            return { data: state.pickable, error: null };
          throw new Error(`unexpected user rpc ${fn}`);
        },
      },
    },
    body: { csrf: 'csrf', ...state.body },
    failure: null,
  }),
}));

vi.mock('../../src/server/payments/config', () => {
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.adminCalls.push({ fn, args });
      if (fn === 'create_free_coaching_order') return state.freeAnswer;
      if (fn === 'checkout_reserve_wallet')
        return {
          data: { wallet_eur_cents: 0, card_eur_cents: 599 },
          error: null,
        };
      if (fn === 'referral_first_order_discount_eligible')
        return { data: true, error: null };
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
                single: async () => ({ data: { id: INTENT }, error: null }),
              }),
            };
          },
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      throw new Error(`unexpected table ${table}`);
    },
  };
  return {
    paymentsConfig: () => ({ origin: 'https://duoly.gg' }),
    adminFor: () => admin,
    stripeFor: () => {
      state.stripeCalls += 1;
      return {
        checkout: {
          sessions: {
            create: async () => ({ id: 'cs_test_1', client_secret: 'secret' }),
            expire: async () => undefined,
          },
        },
      };
    },
    AUTHORIZE_ONLY_METHODS: ['card'],
  };
});
vi.mock('../../src/server/fx', () => ({
  eurToUsd: async () => ({ rate: 1.08 }),
  FALLBACK_EUR_TO_USD: 1.08,
}));
vi.mock('../../src/server/referrals', () => ({
  checkoutRefCode: () => state.refCode,
}));
vi.mock('../../src/server/pro/config', async (original) => ({
  ...(await original<typeof import('../../src/server/pro/config')>()),
  proEnabled: () => true,
}));
vi.mock('../../src/server/pro/status', () => ({
  isProMember: async () => true,
}));

const { createCheckout } = await import('../../src/server/payments/checkout');
const run = () => createCheckout({ cookies: {} } as never) as Promise<Response>;
const freeBody = {
  gameId: 'lol',
  serviceId: 'vod',
  units: 1,
  server: 'EUW',
  ign: 'Me#EUW',
  useWallet: false,
  freePerk: true,
};

beforeEach(() => {
  state.body = { ...freeBody };
  state.userCalls = [];
  state.adminCalls = [];
  state.stripeCalls = 0;
  state.inserted = null;
  state.perks = perks('platinum', true);
  state.pickable = { eligible: true, teammates: [] };
  state.freeAnswer = { data: { order_id: ORDER, created: true }, error: null };
  state.refCode = 'CREATOR1';
});

describe('free coaching checkout', () => {
  it('creates the order through create_free_coaching_order without Stripe, wallet or discounts', async () => {
    const response = await run();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      intent_id: INTENT,
      order_id: ORDER,
      url: `/queue/${ORDER}`,
      free_perk: true,
    });
    expect(state.stripeCalls).toBe(0);
    expect(state.adminCalls.map((c) => c.fn)).toEqual([
      'create_free_coaching_order',
    ]);
    expect(state.adminCalls[0]!.args).toEqual({ p_intent_id: INTENT });
    // Full list price (12.99 EUR Champion pool hour), PRO and creator code ignored.
    expect(state.inserted).toMatchObject({
      free_coaching: true,
      wallet_eur_cents: 0,
      first_order_discount_cents: 0,
      ref_code: null,
      units: 1,
      unit: 'hour',
      gg: false,
    });
    expect(state.inserted).not.toHaveProperty('pro_discount_cents');
    expect(state.inserted).not.toHaveProperty('pick_source_order_id');
    expect(state.inserted!.amount_eur_cents as number).toBeGreaterThanOrEqual(
      99,
    );
  });

  it.each([
    [{ units: 3 }, 400],
    [{ serviceId: 'duo2' }, 400],
    [{ serviceId: 'gg1' }, 400],
    [{ useWallet: true }, 400],
    [{ useWallet: undefined }, 400],
  ])('refuses %o before any intent', async (extra, status) => {
    state.body = { ...freeBody, ...extra };
    if ('useWallet' in extra && extra.useWallet === undefined)
      delete state.body.useWallet;
    const response = await run();
    expect(response.status).toBe(status);
    expect(state.inserted).toBeNull();
    expect(state.adminCalls).toEqual([]);
    expect(state.stripeCalls).toBe(0);
  });

  it.each([
    [perks('gold', false, false), /Platinum/],
    [perks('diamond', false), /already used/],
  ])('refuses when the perk is not available (%#)', async (value, copy) => {
    state.perks = value;
    const response = await run();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(copy);
    expect(state.inserted).toBeNull();
    expect(state.stripeCalls).toBe(0);
  });

  it('refuses with 503 when perks cannot be read (migration missing)', async () => {
    state.perks = { error: { code: 404, message: 'x' } };
    expect((await run()).status).toBe(503);
    expect(state.inserted).toBeNull();
  });

  it.each([
    [
      { data: { error: 'free_perk_unavailable', reason: 'used' }, error: null },
      409,
      /already used/,
    ],
    [{ data: { conflict: true }, error: null }, 409, /open order/],
    [{ data: null, error: { message: 'boom' } }, 503, /unavailable/],
  ])(
    'maps database refusals (%#) and never falls back to Stripe',
    async (answer, status, copy) => {
      state.freeAnswer = answer;
      const response = await run();
      expect(response.status).toBe(status);
      expect((await response.json()).error).toMatch(copy);
      expect(state.stripeCalls).toBe(0);
      expect(state.adminCalls.map((c) => c.fn)).not.toContain(
        'checkout_reserve_wallet',
      );
    },
  );

  it('stores a pick source on the free intent', async () => {
    state.perks = perks('diamond', true);
    state.pickable = {
      eligible: true,
      teammates: [
        { handle: SOURCE, name: 'Ana', image: '', country: 'at', orders: 3 },
      ],
    };
    state.body = { ...freeBody, pickSource: SOURCE };
    expect((await run()).status).toBe(200);
    expect(state.inserted).toMatchObject({
      pick_source_order_id: SOURCE,
      free_coaching: true,
    });
    expect(
      state.userCalls.find((c) => c.fn === 'customer_pickable_teammates')!.args,
    ).toEqual({
      p_game: 'lol',
      p_gg: false,
      p_voice: false,
    });
  });
});

describe('pick a teammate on a paid checkout', () => {
  const paidBody = {
    gameId: 'lol',
    serviceId: 'duo2',
    units: 1,
    server: 'EUW',
    rank: 'Gold',
    ign: 'Me#EUW',
    voice: true,
    useWallet: false,
    pickSource: SOURCE,
  };
  it('passes the pick source to the intent and goes to Stripe as usual', async () => {
    state.perks = perks('diamond', true);
    state.pickable = {
      eligible: true,
      teammates: [
        { handle: SOURCE, name: 'Ana', image: '', country: 'at', orders: 3 },
      ],
    };
    state.body = paidBody;
    const response = await run();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      intent_id: INTENT,
      url: `/checkout/${INTENT}`,
    });
    expect(state.inserted).toMatchObject({ pick_source_order_id: SOURCE });
    expect(state.inserted).not.toHaveProperty('free_coaching');
    // The paid path still applies PRO (the free path above ignores it).
    expect(state.inserted!.pro_discount_cents as number).toBeGreaterThan(0);
    expect(state.stripeCalls).toBe(1);
  });
  it('refuses a pick below Diamond and an unknown teammate', async () => {
    state.body = paidBody;
    state.perks = perks('platinum', true);
    let response = await run();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/Diamond/);
    state.perks = perks('diamond', true);
    state.pickable = { eligible: true, teammates: [] };
    response = await run();
    expect(response.status).toBe(409);
    expect(state.inserted).toBeNull();
    expect(state.stripeCalls).toBe(0);
  });
  it('sends no perk fields and reads no perks without a pick', async () => {
    state.body = { ...paidBody, pickSource: undefined };
    delete state.body.pickSource;
    expect((await run()).status).toBe(200);
    expect(state.inserted).not.toHaveProperty('pick_source_order_id');
    expect(state.userCalls.map((c) => c.fn)).toEqual(['customer_active_order']);
  });
});
