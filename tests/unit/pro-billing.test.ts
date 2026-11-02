import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/pro/checkout and /api/pro/portal (ledger #39).
const state = vi.hoisted(() => ({
  role: 'customer',
  enabled: true,
  status: {
    member: false,
    trial_eligible: true,
    subscription: null,
  } as Record<string, unknown>,
  customer: 'cus_pro1' as string | null,
  currency: null as string | null,
  rpc: [] as [string, unknown][],
  sessions: [] as Record<string, unknown>[],
  subscriptions: [] as [Record<string, unknown>, unknown][],
  portal: [] as Record<string, unknown>[],
}));

vi.mock('../../src/server/auth/handlers', () => ({
  mutation: async () => ({
    account: {
      json: (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status }),
      identity: async () => ({
        viewer: { id: 'u-pro', role: state.role, email: 'pro@duoly.gg' },
        profile: { currency: state.currency },
      }),
    },
    body: { csrf: 'x' },
    failure: null,
  }),
}));

vi.mock('../../src/server/pro/config', async (original) => ({
  ...(await original<typeof import('../../src/server/pro/config')>()),
  proEnabled: () => state.enabled,
  proPortalConfiguration: () => 'bpc_test1',
}));

// a fixed rate, so no test asks the ECB: 1.12 + 1% = 1.1312 dollars per euro
vi.mock('../../src/server/fx', async (original) => ({
  ...(await original<typeof import('../../src/server/fx')>()),
  eurToUsd: async () => ({
    rate: 1.12,
    source: 'ecb',
    date: '2026-11-02',
    fetchedAt: 0,
  }),
}));

vi.mock('../../src/server/payments/config', () => ({
  paymentsConfig: () => ({ origin: 'https://duoly.gg' }),
  adminFor: () => ({
    rpc: async (fn: string, args: unknown) => {
      state.rpc.push([fn, args]);
      if (fn === 'pro_status_dto') return { data: state.status, error: null };
      if (fn === 'pro_billing_customer')
        return { data: state.customer, error: null };
      if (fn === 'pro_apply_subscription')
        return { data: { status: 'trialing' }, error: null };
      return { data: null, error: null };
    },
  }),
  stripeFor: () => ({
    prices: {
      list: async () => ({
        data: [
          {
            id: 'price_pro',
            active: true,
            type: 'recurring',
            currency: 'eur',
            unit_amount: 999,
            product: 'prod_pro',
            recurring: { interval: 'month', interval_count: 1 },
          },
        ],
      }),
    },
    subscriptions: {
      create: async (params: Record<string, unknown>, options: unknown) => {
        state.subscriptions.push([params, options]);
        return { id: 'sub_pro1' };
      },
      retrieve: async () => ({
        id: 'sub_pro1',
        customer: 'cus_pro1',
        status: 'trialing',
        metadata: { kind: 'duoly_pro', user_id: 'u-pro' },
        items: { data: [] },
      }),
    },
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          state.sessions.push(params);
          return { id: 'cs_pro', client_secret: 'cs_pro_secret_x', url: null };
        },
      },
    },
    billingPortal: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          state.portal.push(params);
          return { url: 'https://billing.stripe.com/p/session/test_x' };
        },
      },
    },
  }),
}));

const { proCheckout, proPortal } = await import('../../src/server/pro/billing');
const call = async (handler: typeof proCheckout) => {
  const res = await handler({ cookies: { get: () => undefined } } as never);
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  state.role = 'customer';
  state.enabled = true;
  state.status = { member: false, trial_eligible: true, subscription: null };
  state.customer = 'cus_pro1';
  state.currency = null;
  state.rpc = [];
  state.sessions = [];
  state.subscriptions = [];
  state.portal = [];
});

describe('PRO checkout handler', () => {
  it('starts the 7-day trial without a card for a first-time customer and records it', async () => {
    const result = await call(proCheckout);
    expect(result).toEqual({
      status: 200,
      body: { started: true, trial: true },
    });
    expect(state.sessions).toHaveLength(0);
    expect(state.subscriptions[0]).toEqual([
      {
        customer: 'cus_pro1',
        items: [{ price: 'price_pro', quantity: 1 }],
        trial_period_days: 7,
        trial_settings: { end_behavior: { missing_payment_method: 'pause' } },
        payment_settings: { save_default_payment_method: 'on_subscription' },
        metadata: { kind: 'duoly_pro', user_id: 'u-pro' },
      },
      { idempotencyKey: 'pro_trial_u-pro' },
    ]);
    expect(state.rpc.map(([fn]) => fn)).toContain('pro_apply_subscription');
  });

  it('charges a USD customer the euro equivalent of $9.99', async () => {
    state.currency = 'USD';
    await call(proCheckout);
    const [params] = state.subscriptions[0]!;
    expect('currency' in params).toBe(false);
    const item = (
      params.items as { price_data: Record<string, unknown> }[]
    )[0]!;
    expect(item.price_data.currency).toBe('eur');
    expect(item.price_data.product).toBe('prod_pro');
    // $9.99 at 1.1312 dollars per euro is €8.83
    expect(item.price_data.unit_amount).toBe(883);
  });

  it('gives no second trial (R4 per customer)', async () => {
    state.status = {
      member: false,
      trial_eligible: false,
      subscription: { status: 'canceled' },
    };
    const result = await call(proCheckout);
    expect(result).toEqual({
      status: 200,
      body: { client_secret: 'cs_pro_secret_x', trial: false },
    });
    expect(state.subscriptions).toHaveLength(0);
    expect(state.sessions[0]).toMatchObject({
      ui_mode: 'elements',
      mode: 'subscription',
      customer: 'cus_pro1',
      payment_method_collection: 'always',
      line_items: [{ price: 'price_pro', quantity: 1 }],
      metadata: { kind: 'duoly_pro', user_id: 'u-pro' },
    });
    const data = state.sessions[0]!.subscription_data as Record<
      string,
      unknown
    >;
    expect(data.trial_period_days).toBeUndefined();
  });

  it('refuses members, past-due memberships, teammates and a switched-off PRO', async () => {
    state.status = { member: true, trial_eligible: false, subscription: null };
    expect((await call(proCheckout)).status).toBe(409);
    state.status = {
      member: false,
      trial_eligible: false,
      subscription: { status: 'past_due' },
    };
    expect((await call(proCheckout)).status).toBe(409);
    state.status = { member: false, trial_eligible: true, subscription: null };
    state.role = 'teammate';
    expect((await call(proCheckout)).status).toBe(403);
    state.role = 'customer';
    state.enabled = false;
    expect((await call(proCheckout)).status).toBe(404);
    expect(state.sessions).toHaveLength(0);
  });
});

describe('PRO portal handler', () => {
  it('opens the Customer Portal with the PRO configuration', async () => {
    const result = await call(proPortal);
    expect(result).toEqual({
      status: 200,
      body: { url: 'https://billing.stripe.com/p/session/test_x' },
    });
    expect(state.portal[0]).toEqual({
      customer: 'cus_pro1',
      return_url: 'https://duoly.gg/dashboard#pro',
      configuration: 'bpc_test1',
    });
  });

  it('404s for customers without a Stripe customer', async () => {
    state.customer = null;
    expect((await call(proPortal)).status).toBe(404);
    expect(state.portal).toHaveLength(0);
  });
});
