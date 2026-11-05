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
  freePro: { eligible: level === 'diamond' },
});

const state = vi.hoisted(() => ({
  body: {} as Record<string, unknown>,
  userCalls: [] as { fn: string; args?: Record<string, unknown> }[],
  adminCalls: [] as { fn: string; args: Record<string, unknown> }[],
  stripeCalls: 0,
  inserted: null as Record<string, unknown> | null,
  perks: null as unknown,
  freeAnswer: null as { data: unknown; error: unknown } | null,
  eligible: true,
  pro: true,
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
      if (fn === 'streamer_checkout_quote')
        return {
          data: { streamerId: SOURCE, name: 'Alpha', rateEurCents: 1500 },
          error: null,
        };
      if (fn === 'checkout_reserve_wallet')
        return {
          data: { wallet_eur_cents: 0, card_eur_cents: 599 },
          error: null,
        };
      if (fn === 'referral_first_order_discount_eligible')
        return { data: state.eligible, error: null };
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
  isProMember: async () => state.pro,
}));

const { createCheckout, buildCheckout, CheckoutRequestSchema } =
  await import('../../src/server/payments/checkout');
const baseAmount = () =>
  buildCheckout(CheckoutRequestSchema.parse(state.body)).row.amount_eur_cents;
const creatorAmount = () => Math.round(baseAmount() / 10);
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
  state.freeAnswer = { data: { order_id: ORDER, created: true }, error: null };
  state.refCode = 'CREATOR1';
  state.eligible = true;
  state.pro = true;
});

describe('typed creator checkout', () => {
  it('ignores typed creator codes on streamer bookings even for PRO members', async () => {
    state.body = {
      ...freeBody,
      freePerk: false,
      serviceId: 'stream',
      streamer: SOURCE,
      creatorCode: 'ALPHA',
    };
    expect((await run()).status).toBe(200);
    expect(state.inserted).toMatchObject({
      amount_eur_cents: 1500,
      first_order_discount_cents: 0,
      streamer_id: SOURCE,
    });
    expect(state.inserted).not.toHaveProperty('ref_code');
    expect(state.inserted).not.toHaveProperty('pro_discount_cents');
    expect(state.adminCalls.map((call) => call.fn)).toEqual([
      'streamer_checkout_quote',
    ]);
  });
  it('ignores typed creator codes on free coaching', async () => {
    state.body = { ...freeBody, creatorCode: 'ALPHA' };
    expect((await run()).status).toBe(200);
    expect(state.inserted).toMatchObject({
      ref_code: null,
      first_order_discount_cents: 0,
    });
    expect(state.stripeCalls).toBe(0);
  });
  it('normalizes typed input over a link and recomputes discounted money on the server', async () => {
    state.body = { ...freeBody, freePerk: false, creatorCode: ' beta ' };
    state.pro = false;
    expect((await run()).status).toBe(200);
    expect(state.inserted).toMatchObject({
      ref_code: 'BETA',
      amount_eur_cents: baseAmount() - creatorAmount(),
      first_order_discount_cents: creatorAmount(),
    });
    expect(
      state.adminCalls.filter(
        (call) => call.fn === 'referral_first_order_discount_eligible',
      ),
    ).toEqual([
      {
        fn: 'referral_first_order_discount_eligible',
        args: {
          p_customer: 'b5000000-0000-4000-8000-000000000001',
          p_code: 'BETA',
        },
      },
    ]);
    // Attribution remains exclusively in the existing paid-order database trigger.
    expect(
      state.adminCalls.some((call) => /attribut|referral_record/.test(call.fn)),
    ).toBe(false);
  });
  it('explicit removal suppresses the link and does not query eligibility', async () => {
    state.body = { ...freeBody, freePerk: false, creatorCode: '' };
    state.pro = false;
    expect((await run()).status).toBe(200);
    expect(state.inserted).not.toHaveProperty('ref_code');
    expect(state.inserted).toMatchObject({
      amount_eur_cents: baseAmount(),
      first_order_discount_cents: 0,
    });
    expect(state.adminCalls).toEqual([]);
  });
  it('a typed code needs no link cookie', async () => {
    state.refCode = null;
    state.body = { ...freeBody, freePerk: false, creatorCode: 'ALPHA' };
    state.pro = false;
    expect((await run()).status).toBe(200);
    expect(state.inserted).toMatchObject({
      ref_code: 'ALPHA',
      first_order_discount_cents: creatorAmount(),
    });
  });
  it('an ineligible code still allows undiscounted checkout', async () => {
    state.body = { ...freeBody, freePerk: false, creatorCode: 'ALPHA' };
    state.pro = false;
    state.eligible = false;
    expect((await run()).status).toBe(200);
    expect(state.inserted).toMatchObject({
      amount_eur_cents: baseAmount(),
      first_order_discount_cents: 0,
    });
  });
  it('does not accept client totals', async () => {
    state.body = {
      ...freeBody,
      freePerk: false,
      creatorCode: 'ALPHA',
      amount_eur_cents: 1,
    };
    expect((await run()).status).toBe(400);
    expect(state.inserted).toBeNull();
  });
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
});

describe('the Diamond pick is gone (20261106170000)', () => {
  const paidBody = {
    gameId: 'lol',
    serviceId: 'duo2',
    units: 1,
    server: 'EUW',
    rank: 'Gold',
    ign: 'Me#EUW',
    voice: true,
    useWallet: false,
  };
  it('refuses a stale page that still sends a pick, before any payment', async () => {
    state.perks = perks('diamond', true);
    state.body = { ...paidBody, pickSource: SOURCE };
    expect((await run()).status).toBe(400);
    state.body = { ...freeBody, pickSource: SOURCE };
    expect((await run()).status).toBe(400);
    expect(state.inserted).toBeNull();
    expect(state.stripeCalls).toBe(0);
  });
  it('sends no perk fields and reads no perks on a paid checkout', async () => {
    state.body = paidBody;
    expect((await run()).status).toBe(200);
    expect(state.inserted).not.toHaveProperty('pick_source_order_id');
    expect(state.userCalls.map((c) => c.fn)).toEqual(['customer_active_order']);
  });
});
