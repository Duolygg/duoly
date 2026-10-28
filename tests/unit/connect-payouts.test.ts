import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';

// Stripe Connect payouts (M9, ledger #14 phase 2): pure helpers, the admin Pay via Stripe
// route, the teammate onboarding route and both signed webhook endpoints, with Stripe mocked.
const secret = 'whsec_test_duoly_platform';
const connectSecret = 'whsec_test_duoly_connect';
const LINE = '7c000000-0000-4000-8000-0000000000a1';
const ROW = '7c000000-0000-4000-8000-0000000000b1';
const ADMIN = '7c000000-0000-4000-8000-000000000009';
const TEAMMATE = '7c000000-0000-4000-8000-000000000001';

const calls = vi.hoisted(() => ({
  rpc: vi.fn(),
  userRpc: vi.fn(),
  transfersCreate: vi.fn(),
  transfersList: vi.fn(),
  accountsCreate: vi.fn(),
  accountsRetrieve: vi.fn(),
  accountLinksCreate: vi.fn(),
  fx: vi.fn(),
  seen: new Set<string>(),
  inserts: [] as unknown[],
  role: 'admin' as string,
  body: {} as Record<string, unknown>,
  secretKey: 'sk_test_placeholder',
}));

vi.mock('../../src/server/payments/config', async () => {
  const { default: StripeSdk } = await import('stripe');
  const real = new StripeSdk('sk_test_placeholder');
  const stripe = {
    webhooks: real.webhooks,
    transfers: { create: calls.transfersCreate, list: calls.transfersList },
    accounts: {
      create: calls.accountsCreate,
      retrieve: calls.accountsRetrieve,
    },
    accountLinks: { create: calls.accountLinksCreate },
  };
  const admin = {
    rpc: calls.rpc,
    from: (table: string) => {
      let id = '';
      const chain = {
        select: () => chain,
        eq: (_column: string, value: string) => {
          id = value;
          return chain;
        },
        maybeSingle: async () => ({
          data: table === 'stripe_events' && calls.seen.has(id) ? { id } : null,
          error: null,
        }),
        insert: async (row: { id: string }) => {
          calls.inserts.push({ table, row });
          if (table === 'stripe_events') calls.seen.add(row.id);
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };
  return {
    paymentsConfig: () => ({
      secretKey: calls.secretKey,
      publishableKey: 'pk_test_x',
      webhookSecret: secret,
      supabaseUrl: 'https://x.supabase.co',
      supabaseSecretKey: 'sb_secret_x',
      origin: 'https://duoly.gg',
    }),
    stripeFor: () => stripe,
    adminFor: () => admin,
  };
});

vi.mock('../../src/server/fx', () => ({ eurToUsd: calls.fx }));

const fakeAccount = () => ({
  json: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status }),
  identity: async () => ({
    viewer: {
      id: calls.role === 'admin' ? ADMIN : TEAMMATE,
      name: 'Tester',
      email: 'tester@example.invalid',
      image: '',
      provider: 'email',
      role: calls.role,
    },
  }),
  client: { rpc: calls.userRpc },
});
vi.mock('../../src/server/auth/context', () => ({
  accountContext: () => fakeAccount(),
}));
vi.mock('../../src/server/auth/handlers', () => ({
  mutation: async () => ({
    account: fakeAccount(),
    body: calls.body,
    failure: null,
  }),
}));

import { stripeWebhook } from '../../src/server/payments/webhook';
import {
  adminPayoutStripe,
  connectCountryFor,
  stripeConnectWebhook,
  teammateConnect,
} from '../../src/server/connect/handlers';
import {
  accountCreateParams,
  accountFacts,
  preparedTransfer,
  transferErrorKind,
  transferFacts,
  transferParams,
} from '../../src/server/connect/stripe';
import { connectConfig } from '../../src/server/connect/config';

const prepared = (over: Record<string, unknown> = {}) => ({
  transfer: {
    id: ROW,
    lineId: LINE,
    accountId: 'acct_m9one',
    currency: 'eur',
    amountMinor: 1818,
    amountUsdCents: 2000,
    idempotencyKey: `duoly-payout-${LINE}-1`,
    teammate: 'Connect 01',
    week: '2026-10-23',
    resumed: false,
    ...over,
  },
});
const transfer = (over: Record<string, unknown> = {}) => ({
  id: 'tr_m9one',
  object: 'transfer',
  amount: 1818,
  currency: 'eur',
  destination: 'acct_m9one',
  amount_reversed: 0,
  metadata: {
    kind: 'duoly_payout',
    payout_line_id: LINE,
    payout_transfer_id: ROW,
    amount_usd_cents: '2000',
  },
  ...over,
});

let counter = 0;
const signed = (
  url: string,
  key: string,
  type: string,
  object: Record<string, unknown>,
  account?: string,
) => {
  counter += 1;
  const body = JSON.stringify({
    id: `evt_m9_${counter}`,
    object: 'event',
    api_version: '2026-09-30.clover',
    created: 1_800_000_000 + counter,
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
    ...(account ? { account } : {}),
    data: { object },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: key,
  });
  return new Request(`https://duoly.gg${url}`, {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body,
  });
};
const platform = (type: string, object: Record<string, unknown>) =>
  signed('/api/webhooks/stripe', secret, type, object);
const connect = (
  type: string,
  object: Record<string, unknown>,
  account?: string,
) =>
  signed('/api/webhooks/stripe-connect', connectSecret, type, object, account);
const call = async (
  handler: (context: never) => Promise<Response> | Response,
  request: Request,
) => {
  const response = await handler({
    request,
    url: new URL(request.url),
    cookies: {},
  } as never);
  return { status: response.status, body: await response.json() };
};
const adminPost = () =>
  call(
    adminPayoutStripe as never,
    new Request('https://duoly.gg/api/admin/payout-stripe', { method: 'POST' }),
  );

const ok = (data: unknown) => ({ data, error: null });

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('CONNECT_PAYOUTS_ENABLED', 'true');
  vi.stubEnv('STRIPE_CONNECT_WEBHOOK_SECRET', connectSecret);
  vi.stubEnv('CONNECT_TRANSFER_CURRENCY', '');
  for (const fn of [
    calls.rpc,
    calls.userRpc,
    calls.transfersCreate,
    calls.transfersList,
    calls.accountsCreate,
    calls.accountsRetrieve,
    calls.accountLinksCreate,
    calls.fx,
  ])
    fn.mockReset();
  calls.inserts = [];
  calls.role = 'admin';
  calls.body = { csrf: 't', payoutId: LINE };
  calls.secretKey = 'sk_test_placeholder';
  calls.fx.mockResolvedValue({ rate: 1.1, source: 'ecb' });
  calls.userRpc.mockResolvedValue(ok({ payouts: [] }));
});

describe('connect config', () => {
  it('is off unless CONNECT_PAYOUTS_ENABLED is true', () => {
    vi.stubEnv('CONNECT_PAYOUTS_ENABLED', '');
    expect(connectConfig()).toBeNull();
    vi.stubEnv('CONNECT_PAYOUTS_ENABLED', '1');
    expect(connectConfig()).toBeNull();
    vi.stubEnv('CONNECT_PAYOUTS_ENABLED', 'true');
    expect(connectConfig()?.transferCurrency).toBe('eur');
    vi.stubEnv('CONNECT_TRANSFER_CURRENCY', 'usd');
    expect(connectConfig()?.transferCurrency).toBe('usd');
  });
  it('refuses live keys', () => {
    calls.secretKey = 'sk_live_placeholder';
    expect(connectConfig()).toBeNull();
  });
});

describe('connect helpers', () => {
  it('derives account facts from Stripe', () => {
    expect(
      accountFacts({
        id: 'acct_1',
        details_submitted: true,
        payouts_enabled: true,
        capabilities: { transfers: 'active' },
        requirements: {
          currently_due: ['a'],
          past_due: ['a', 'b'],
          disabled_reason: null,
        },
      }),
    ).toEqual({
      accountId: 'acct_1',
      detailsSubmitted: true,
      payoutsEnabled: true,
      transfersActive: true,
      disabledReason: null,
      requirementsDue: 2,
    });
    expect(accountFacts({ id: 'cus_1' })).toBeNull();
    expect(accountFacts(null)).toBeNull();
  });
  it('creates individual Express accounts with transfers only', () => {
    const params = accountCreateParams({
      teammateId: TEAMMATE,
      email: null,
      country: 'AT',
    });
    expect(params).toMatchObject({
      type: 'express',
      country: 'AT',
      business_type: 'individual',
      capabilities: { transfers: { requested: true } },
      metadata: { teammate_id: TEAMMATE },
    });
    expect(params).not.toHaveProperty('email');
  });
  it('validates the prepared transfer and builds the Transfer', () => {
    const p = preparedTransfer(prepared())!;
    expect(p.amountMinor).toBe(1818);
    expect(transferParams(p)).toMatchObject({
      amount: 1818,
      currency: 'eur',
      destination: 'acct_m9one',
      transfer_group: `payout_line_${LINE}`,
      metadata: { kind: 'duoly_payout', payout_transfer_id: ROW },
    });
    for (const over of [
      { amountMinor: -5 },
      { amountMinor: 0 },
      { amountUsdCents: 999 },
      { currency: 'gbp' },
      { idempotencyKey: 'other' },
      { accountId: 'cus_1' },
    ])
      expect(preparedTransfer(prepared(over))).toBeNull();
    expect(preparedTransfer({ error: { code: 409 } })).toBeNull();
  });
  it('only treats clear Stripe refusals as refused', () => {
    expect(
      transferErrorKind({ type: 'StripeInvalidRequestError', statusCode: 400 }),
    ).toBe('refused');
    for (const e of [
      { type: 'StripeConnectionError' },
      { type: 'StripeAPIError', statusCode: 500 },
      { type: 'StripeIdempotencyError', statusCode: 400 },
      { type: 'StripeInvalidRequestError', statusCode: 429 },
      new Error('timeout'),
    ])
      expect(transferErrorKind(e)).toBe('unknown');
  });
  it('reads only Duoly payout transfers', () => {
    expect(transferFacts(transfer())).toMatchObject({
      transferId: 'tr_m9one',
      rowId: ROW,
      destination: 'acct_m9one',
    });
    expect(transferFacts(transfer({ metadata: {} }))).toBeNull();
    expect(transferFacts({ id: 'po_1' })).toBeNull();
  });
  it('maps payout detail countries to Connect countries', () => {
    expect(connectCountryFor('Austria')).toBe('AT');
    expect(connectCountryFor('de')).toBe('DE');
    expect(connectCountryFor('Philippines')).toBeNull();
    expect(connectCountryFor(undefined)).toBeNull();
  });
});

describe('Pay via Stripe', () => {
  it('prepares at the ECB rate, sends with the line idempotency key and records', async () => {
    calls.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'payout_stripe_prepare') return ok(prepared());
      if (fn === 'payout_stripe_record') return ok({ recorded: true });
      throw new Error(fn);
    });
    calls.transfersCreate.mockResolvedValue(transfer());
    const res = await adminPost();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      transferId: 'tr_m9one',
      recorded: true,
    });
    expect(calls.rpc).toHaveBeenCalledWith('payout_stripe_prepare', {
      p_line_id: LINE,
      p_actor: ADMIN,
      p_currency: 'eur',
      p_fx: 1.1,
      p_fx_source: 'ecb',
    });
    expect(calls.transfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1818,
        currency: 'eur',
        destination: 'acct_m9one',
      }),
      { idempotencyKey: `duoly-payout-${LINE}-1` },
    );
    expect(calls.rpc).toHaveBeenCalledWith('payout_stripe_record', {
      p_transfer_id: ROW,
      p_stripe_transfer_id: 'tr_m9one',
      p_destination: 'acct_m9one',
      p_amount_minor: 1818,
      p_currency: 'eur',
    });
  });
  it('never pays at the fallback rate', async () => {
    calls.fx.mockResolvedValue({ rate: 1.08, source: 'fallback' });
    const res = await adminPost();
    expect(res.status).toBe(503);
    expect(calls.rpc).not.toHaveBeenCalled();
  });
  it('passes USD without a rate when configured', async () => {
    vi.stubEnv('CONNECT_TRANSFER_CURRENCY', 'usd');
    calls.rpc.mockResolvedValue(
      ok({ error: { code: 409, message: 'Release the hold first.' } }),
    );
    const res = await adminPost();
    expect(res).toEqual({
      status: 409,
      body: { error: 'Release the hold first.' },
    });
    expect(calls.fx).not.toHaveBeenCalled();
    expect(calls.rpc).toHaveBeenCalledWith(
      'payout_stripe_prepare',
      expect.objectContaining({
        p_currency: 'usd',
        p_fx: null,
        p_fx_source: null,
      }),
    );
    expect(calls.transfersCreate).not.toHaveBeenCalled();
  });
  it('records a clear refusal so the line stays scheduled', async () => {
    calls.rpc.mockImplementation(async (fn: string) =>
      fn === 'payout_stripe_prepare' ? ok(prepared()) : ok({ updated: true }),
    );
    calls.transfersCreate.mockRejectedValue({
      type: 'StripeInvalidRequestError',
      statusCode: 400,
      code: 'balance_insufficient',
      message: 'Insufficient funds',
    });
    const res = await adminPost();
    expect(res.status).toBe(409);
    expect(calls.rpc).toHaveBeenCalledWith('payout_stripe_fail', {
      p_transfer_id: ROW,
      p_error: 'balance_insufficient: Insufficient funds',
    });
  });
  it('keeps the transfer pending when Stripe does not answer', async () => {
    calls.rpc.mockResolvedValue(ok(prepared()));
    calls.transfersCreate.mockRejectedValue({ type: 'StripeConnectionError' });
    const res = await adminPost();
    expect(res.status).toBe(502);
    expect(calls.rpc).not.toHaveBeenCalledWith(
      'payout_stripe_fail',
      expect.anything(),
    );
  });
  it('a resumed press finds the transfer Stripe already made instead of sending again', async () => {
    calls.rpc.mockImplementation(async (fn: string) =>
      fn === 'payout_stripe_prepare'
        ? ok(prepared({ resumed: true }))
        : ok({ recorded: true }),
    );
    calls.transfersList.mockResolvedValue({ data: [transfer()] });
    const res = await adminPost();
    expect(res.status).toBe(200);
    expect(calls.transfersList).toHaveBeenCalledWith({
      transfer_group: `payout_line_${LINE}`,
      limit: 20,
    });
    expect(calls.transfersCreate).not.toHaveBeenCalled();
  });
  it('is admin only and off without the flag', async () => {
    calls.role = 'teammate';
    expect((await adminPost()).status).toBe(404);
    calls.role = 'admin';
    vi.stubEnv('CONNECT_PAYOUTS_ENABLED', 'false');
    expect((await adminPost()).status).toBe(404);
    calls.body = { csrf: 't', payoutId: 'accruing:x' };
    vi.stubEnv('CONNECT_PAYOUTS_ENABLED', 'true');
    expect((await adminPost()).status).toBe(400);
    expect(calls.rpc).not.toHaveBeenCalled();
  });
});

describe('teammate onboarding', () => {
  const get = (query = '') =>
    call(
      teammateConnect as never,
      new Request(`https://duoly.gg/api/teammate/connect${query}`),
    );
  const post = () =>
    call(
      teammateConnect as never,
      new Request('https://duoly.gg/api/teammate/connect', { method: 'POST' }),
    );
  beforeEach(() => {
    calls.role = 'teammate';
  });
  it('reports disabled without the flag', async () => {
    vi.stubEnv('CONNECT_PAYOUTS_ENABLED', '');
    expect(await get()).toEqual({ status: 200, body: { enabled: false } });
    calls.body = { csrf: 't', action: 'onboard' };
    expect((await post()).status).toBe(404);
    expect(calls.accountsCreate).not.toHaveBeenCalled();
  });
  it('creates one Express account, links it and returns an onboarding link', async () => {
    calls.body = { csrf: 't', action: 'onboard' };
    calls.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'connect_account_for') return ok(null);
      if (fn === 'connect_account_link') return ok({ linked: true });
      if (fn === 'connect_account_sync')
        return ok({ updated: true, status: 'not_started' });
      throw new Error(fn);
    });
    calls.userRpc.mockResolvedValue(ok({ details: { country: 'Austria' } }));
    calls.accountsCreate.mockResolvedValue({ id: 'acct_new1' });
    calls.accountsRetrieve.mockResolvedValue({
      id: 'acct_new1',
      details_submitted: false,
      payouts_enabled: false,
      capabilities: { transfers: 'inactive' },
      requirements: { currently_due: ['individual.dob.day'] },
    });
    calls.accountLinksCreate.mockResolvedValue({
      url: 'https://connect.stripe.com/setup/e/x',
    });
    const res = await post();
    expect(res).toEqual({
      status: 200,
      body: { url: 'https://connect.stripe.com/setup/e/x' },
    });
    expect(calls.accountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'express', country: 'AT' }),
      { idempotencyKey: `duoly-connect-account-${TEAMMATE}-AT` },
    );
    expect(calls.rpc).toHaveBeenCalledWith('connect_account_link', {
      p_teammate: TEAMMATE,
      p_account_id: 'acct_new1',
      p_country: 'AT',
    });
    expect(calls.accountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        account: 'acct_new1',
        type: 'account_onboarding',
        return_url: 'https://duoly.gg/teammate?connect=return#payouts',
        refresh_url: 'https://duoly.gg/teammate?connect=refresh#payouts',
      }),
    );
  });
  it('keeps unsupported countries on the manual rail', async () => {
    calls.body = { csrf: 't', action: 'onboard' };
    calls.rpc.mockResolvedValue(ok(null));
    calls.userRpc.mockResolvedValue(
      ok({ details: { country: 'Philippines' } }),
    );
    const res = await post();
    expect(res.status).toBe(409);
    expect(calls.accountsCreate).not.toHaveBeenCalled();
  });
  it('refresh reuses the existing account and syncs its status', async () => {
    calls.body = { csrf: 't', action: 'refresh' };
    calls.rpc.mockImplementation(async (fn: string) =>
      fn === 'connect_account_for'
        ? ok({ accountId: 'acct_old1' })
        : ok({ updated: true, status: 'pending' }),
    );
    calls.accountsRetrieve.mockResolvedValue({
      id: 'acct_old1',
      details_submitted: true,
      payouts_enabled: false,
      capabilities: { transfers: 'pending' },
      requirements: { disabled_reason: 'requirements.pending_verification' },
    });
    calls.accountLinksCreate.mockResolvedValue({
      url: 'https://connect.stripe.com/setup/e/y',
    });
    const res = await post();
    expect(res.status).toBe(200);
    expect(calls.accountsCreate).not.toHaveBeenCalled();
    expect(calls.rpc).toHaveBeenCalledWith('connect_account_sync', {
      p_account_id: 'acct_old1',
      p_details_submitted: true,
      p_payouts_enabled: false,
      p_transfers_active: false,
      p_disabled_reason: 'requirements.pending_verification',
      p_requirements_due: 0,
    });
  });
  it('is teammate only', async () => {
    calls.role = 'customer';
    expect((await get()).status).toBe(403);
  });
  it('returns the status with the supported countries', async () => {
    calls.rpc.mockResolvedValue(ok(null));
    calls.userRpc.mockResolvedValue(
      ok({ connect: { status: 'not_started' }, details: true }),
    );
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      enabled: true,
      connect: { status: 'not_started' },
    });
    expect(res.body.countries).toContain('AT');
  });
});

describe('platform webhook transfer events', () => {
  it('records a created transfer and a reversal, once per event', async () => {
    calls.rpc.mockImplementation(async (fn: string) =>
      fn === 'payout_stripe_record'
        ? ok({ recorded: false, reason: 'already_recorded' })
        : ok({ updated: true }),
    );
    const created = await call(
      stripeWebhook as never,
      platform('transfer.created', transfer()),
    );
    expect(created).toEqual({
      status: 200,
      body: { received: true, outcome: 'transfer_seen' },
    });
    const request = platform(
      'transfer.reversed',
      transfer({ amount_reversed: 909 }),
    );
    const replay = request.clone();
    const reversed = await call(stripeWebhook as never, request);
    expect(reversed.body.outcome).toBe('transfer_reversal_recorded');
    expect(calls.rpc).toHaveBeenCalledWith('payout_stripe_reversal', {
      p_stripe_transfer_id: 'tr_m9one',
      p_reversed_minor: 909,
    });
    const again = await call(stripeWebhook as never, replay);
    expect(again.body).toEqual({ received: true, duplicate: true });
  });
  it('ignores transfers that are not Duoly payouts', async () => {
    const res = await call(
      stripeWebhook as never,
      platform('transfer.created', transfer({ metadata: {} })),
    );
    expect(res.body.outcome).toBe('transfer_ignored');
    expect(calls.rpc).not.toHaveBeenCalled();
  });
  it('lets Stripe retry when recording fails', async () => {
    calls.rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    const res = await call(
      stripeWebhook as never,
      platform('transfer.created', transfer()),
    );
    expect(res.status).toBe(500);
  });
});

describe('Connect webhook endpoint', () => {
  it('refuses bad signatures and the platform secret', async () => {
    const bad = signed(
      '/api/webhooks/stripe-connect',
      secret,
      'account.updated',
      { id: 'acct_1' },
    );
    expect((await call(stripeConnectWebhook as never, bad)).status).toBe(400);
  });
  it('is not configured without the flag or secret', async () => {
    vi.stubEnv('STRIPE_CONNECT_WEBHOOK_SECRET', '');
    expect(
      (
        await call(
          stripeConnectWebhook as never,
          connect('account.updated', { id: 'acct_1' }),
        )
      ).status,
    ).toBe(503);
  });
  it('syncs account.updated', async () => {
    calls.rpc.mockResolvedValue(ok({ updated: true, status: 'ready' }));
    const res = await call(
      stripeConnectWebhook as never,
      connect(
        'account.updated',
        {
          id: 'acct_m9one',
          object: 'account',
          details_submitted: true,
          payouts_enabled: true,
          capabilities: { transfers: 'active' },
          requirements: { currently_due: [], past_due: [] },
        },
        'acct_m9one',
      ),
    );
    expect(res.body).toEqual({
      received: true,
      outcome: 'connect_account_synced',
    });
    expect(calls.rpc).toHaveBeenCalledWith('connect_account_sync', {
      p_account_id: 'acct_m9one',
      p_details_submitted: true,
      p_payouts_enabled: true,
      p_transfers_active: true,
      p_disabled_reason: null,
      p_requirements_due: 0,
    });
  });
  it('records payout.failed on the connected account', async () => {
    calls.rpc.mockResolvedValue(ok({ updated: true }));
    const res = await call(
      stripeConnectWebhook as never,
      connect(
        'payout.failed',
        { id: 'po_m9fail', object: 'payout', failure_code: 'account_closed' },
        'acct_m9one',
      ),
    );
    expect(res.body.outcome).toBe('payout_failure_recorded');
    expect(calls.rpc).toHaveBeenCalledWith('connect_payout_failed', {
      p_account_id: 'acct_m9one',
      p_payout_id: 'po_m9fail',
      p_failure: 'account_closed',
    });
  });
  it('ignores other events', async () => {
    const res = await call(
      stripeConnectWebhook as never,
      connect('capability.updated', { id: 'transfers' }, 'acct_m9one'),
    );
    expect(res.body.outcome).toBe('ignored');
  });
});
