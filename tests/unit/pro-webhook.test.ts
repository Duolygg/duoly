import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';

// Duoly PRO webhook handling through the real signed endpoint (ledger #39).
const secret = 'whsec_test_duoly_pro';
const USER = 'b9000000-0000-4000-8000-000000000001';
const calls = vi.hoisted(() => ({
  rpc: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
  cancel: vi.fn(),
  inserts: [] as unknown[],
  seen: new Set<string>(),
}));

vi.mock('../../src/server/payments/config', async () => {
  const { default: StripeSdk } = await import('stripe');
  const real = new StripeSdk('sk_test_placeholder');
  const stripe = {
    webhooks: real.webhooks,
    subscriptions: {
      retrieve: calls.retrieve,
      update: calls.update,
      cancel: calls.cancel,
    },
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
    paymentsConfig: () => ({ webhookSecret: secret }),
    stripeFor: () => stripe,
    adminFor: () => admin,
  };
});

import { stripeWebhook } from '../../src/server/payments/webhook';

let counter = 0;
const signed = (type: string, object: Record<string, unknown>) => {
  counter += 1;
  const body = JSON.stringify({
    id: `evt_pro_${counter}`,
    object: 'event',
    api_version: '2026-09-30.clover',
    created: 1_800_000_000 + counter,
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
    data: { object },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
  });
  return new Request('https://duoly.gg/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body,
  });
};
const post = async (request: Request) => {
  const response = await stripeWebhook({ request } as never);
  return { status: response.status, body: await response.json() };
};

const subscription = (over: Record<string, unknown> = {}) => ({
  id: 'sub_pro1',
  object: 'subscription',
  customer: 'cus_pro1',
  status: 'trialing',
  metadata: { kind: 'duoly_pro', user_id: USER },
  trial_start: 1_800_000_000,
  trial_end: 1_800_604_800,
  cancel_at_period_end: false,
  cancel_at: null,
  canceled_at: null,
  ended_at: null,
  default_payment_method: { card: { fingerprint: 'fpCardAAAA1111' } },
  items: { data: [{ current_period_end: 1_800_604_800 }] },
  ...over,
});

type RpcResult = { data: unknown; error: unknown };
const rpcAnswers = (answers: Record<string, unknown>) =>
  calls.rpc.mockImplementation(async (fn: string): Promise<RpcResult> => ({
    data: answers[fn] ?? null,
    error: null,
  }));

beforeEach(() => {
  calls.rpc.mockReset();
  calls.retrieve.mockReset();
  calls.update.mockReset();
  calls.cancel.mockReset();
  calls.inserts = [];
  calls.seen.clear();
});

describe('Duoly PRO webhook', () => {
  it('refuses unsigned PRO events', async () => {
    const response = await stripeWebhook({
      request: new Request('https://duoly.gg/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=1,v1=bad' },
        body: '{}',
      }),
    } as never);
    expect(response.status).toBe(400);
    expect(calls.rpc).not.toHaveBeenCalled();
  });

  it('mirrors customer.subscription.created from a fresh Stripe read and claims the trial card', async () => {
    calls.retrieve.mockResolvedValue(subscription());
    rpcAnswers({
      pro_apply_subscription: { status: 'trialing', trial_check_needed: true },
      pro_claim_trial_card: true,
    });
    const result = await post(
      signed('customer.subscription.created', { id: 'sub_pro1' }),
    );
    expect(result).toEqual({
      status: 200,
      body: { received: true, outcome: 'pro_trialing' },
    });
    expect(calls.retrieve).toHaveBeenCalledWith('sub_pro1', {
      expand: ['default_payment_method'],
    });
    expect(calls.rpc).toHaveBeenCalledWith(
      'pro_apply_subscription',
      expect.objectContaining({
        p_subscription: 'sub_pro1',
        p_customer: 'cus_pro1',
        p_status: 'trialing',
        p_metadata_user: USER,
        p_current_period_end: new Date(1_800_604_800_000).toISOString(),
      }),
    );
    expect(calls.rpc).toHaveBeenCalledWith('pro_claim_trial_card', {
      p_subscription: 'sub_pro1',
      p_fingerprint: 'fpCardAAAA1111',
    });
    expect(calls.update).not.toHaveBeenCalled();
  });

  it('ends the trial at once when the card already had one (R4 per card)', async () => {
    calls.retrieve.mockResolvedValue(subscription());
    rpcAnswers({
      pro_apply_subscription: { status: 'trialing', trial_check_needed: true },
      pro_claim_trial_card: false,
    });
    const result = await post(
      signed('customer.subscription.created', { id: 'sub_pro1' }),
    );
    expect(result.body.outcome).toBe('pro_trial_card_reused');
    expect(calls.update).toHaveBeenCalledWith(
      'sub_pro1',
      { trial_end: 'now', proration_behavior: 'none' },
      { idempotencyKey: 'pro_end_trial_sub_pro1' },
    );
  });

  it('waits for the card before the trial check', async () => {
    calls.retrieve.mockResolvedValue(
      subscription({ default_payment_method: null }),
    );
    rpcAnswers({
      pro_apply_subscription: { status: 'trialing', trial_check_needed: true },
    });
    const result = await post(
      signed('customer.subscription.updated', { id: 'sub_pro1' }),
    );
    expect(result.body.outcome).toBe('pro_trial_card_pending');
    expect(calls.rpc).not.toHaveBeenCalledWith(
      'pro_claim_trial_card',
      expect.anything(),
    );
  });

  it('cancels a second live membership for the same account', async () => {
    calls.retrieve.mockResolvedValue(subscription({ id: 'sub_pro2' }));
    rpcAnswers({
      pro_apply_subscription: { status: 'trialing', duplicate: true },
    });
    const result = await post(
      signed('customer.subscription.created', { id: 'sub_pro2' }),
    );
    expect(result.body.outcome).toBe('pro_duplicate_cancelled');
    expect(calls.cancel).toHaveBeenCalledWith(
      'sub_pro2',
      {},
      { idempotencyKey: 'pro_cancel_duplicate_sub_pro2' },
    );
  });

  it('handles customer.subscription.deleted and ignores subscriptions that are not PRO', async () => {
    calls.retrieve.mockResolvedValueOnce(
      subscription({ status: 'canceled', ended_at: 1_800_100_000 }),
    );
    rpcAnswers({ pro_apply_subscription: { status: 'canceled' } });
    const deleted = await post(
      signed('customer.subscription.deleted', { id: 'sub_pro1' }),
    );
    expect(deleted.body.outcome).toBe('pro_canceled');
    expect(calls.rpc).toHaveBeenCalledWith(
      'pro_apply_subscription',
      expect.objectContaining({
        p_status: 'canceled',
        p_ended_at: new Date(1_800_100_000_000).toISOString(),
      }),
    );

    calls.rpc.mockClear();
    calls.retrieve.mockResolvedValueOnce(subscription({ metadata: {} }));
    const other = await post(
      signed('customer.subscription.updated', { id: 'sub_other' }),
    );
    expect(other.body.outcome).toBe('pro_not_ours');
    expect(calls.rpc).not.toHaveBeenCalled();
  });

  it('records invoice.paid and invoice.payment_failed after syncing the subscription (R5, R6)', async () => {
    calls.retrieve.mockResolvedValue(subscription({ status: 'active' }));
    rpcAnswers({
      pro_apply_subscription: { status: 'active' },
      pro_record_invoice: { recorded: true },
    });
    const paid = await post(
      signed('invoice.paid', {
        id: 'in_pro1',
        object: 'invoice',
        amount_paid: 499,
        amount_due: 499,
        currency: 'eur',
        parent: { subscription_details: { subscription: 'sub_pro1' } },
      }),
    );
    expect(paid.body.outcome).toBe('pro_invoice_paid');
    expect(calls.rpc).toHaveBeenCalledWith(
      'pro_record_invoice',
      expect.objectContaining({
        p_invoice: 'in_pro1',
        p_subscription: 'sub_pro1',
        p_state: 'paid',
        p_amount_minor: 499,
        p_currency: 'eur',
      }),
    );

    calls.retrieve.mockResolvedValue(subscription({ status: 'past_due' }));
    rpcAnswers({
      pro_apply_subscription: { status: 'past_due' },
      pro_record_invoice: { recorded: true },
    });
    const failed = await post(
      signed('invoice.payment_failed', {
        id: 'in_pro2',
        object: 'invoice',
        amount_paid: 0,
        amount_due: 499,
        currency: 'eur',
        subscription: 'sub_pro1',
      }),
    );
    expect(failed.body.outcome).toBe('pro_invoice_failed');
    expect(calls.rpc).toHaveBeenCalledWith(
      'pro_apply_subscription',
      expect.objectContaining({ p_status: 'past_due' }),
    );
    // R5: nothing else is written for the fee (no wallet, cashback or loyalty RPCs).
    const fns = calls.rpc.mock.calls.map(([fn]) => fn);
    expect(new Set(fns)).toEqual(
      new Set(['pro_apply_subscription', 'pro_record_invoice']),
    );
  });

  it('is idempotent: a replayed event id is not processed twice', async () => {
    calls.retrieve.mockResolvedValue(subscription({ status: 'active' }));
    rpcAnswers({ pro_apply_subscription: { status: 'active' } });
    const request = signed('customer.subscription.updated', { id: 'sub_pro1' });
    const replay = request.clone();
    expect((await post(request)).body.outcome).toBe('pro_active');
    expect((await post(replay)).body).toEqual({
      received: true,
      duplicate: true,
    });
    expect(calls.retrieve).toHaveBeenCalledTimes(1);
  });

  it('answers 500 so Stripe retries when the database write fails', async () => {
    calls.retrieve.mockResolvedValue(subscription({ status: 'active' }));
    calls.rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    const result = await post(
      signed('customer.subscription.updated', { id: 'sub_pro1' }),
    );
    expect(result.status).toBe(500);
    expect(calls.seen.size).toBe(0);
  });

  it('routes PRO checkout sessions to the subscription sync, not order fulfilment', async () => {
    calls.retrieve.mockResolvedValue(subscription());
    rpcAnswers({
      pro_apply_subscription: { status: 'trialing', trial_check_needed: false },
    });
    const result = await post(
      signed('checkout.session.completed', {
        id: 'cs_pro1',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_pro1',
        metadata: { kind: 'duoly_pro', user_id: USER },
      }),
    );
    expect(result.body.outcome).toBe('pro_trialing');
    expect(calls.retrieve).toHaveBeenCalledWith('sub_pro1', expect.anything());
  });
});
