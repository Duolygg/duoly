import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import {
  applyCreatorDiscount,
  buildCheckout,
  CheckoutRequestSchema,
  sessionParams,
} from '../../src/server/payments/checkout';
import {
  disputeFacts,
  paymentFacts,
  refundedPaymentIntentId,
} from '../../src/server/payments/webhook';
import { settleOne } from '../../src/server/payments/settle';
import { walletSplit } from '../../src/server/payments/wallet';

const lol = {
  gameId: 'lol',
  serviceId: 'duo2',
  units: 3,
  server: 'EUW',
  rank: 'Platinum',
  ign: 'Tester#EUW',
};

describe('wallet split', () => {
  it('defaults wallet use on and rejects browser money fields', () => {
    expect(CheckoutRequestSchema.parse(lol).useWallet).toBe(true);
    expect(
      CheckoutRequestSchema.safeParse({ ...lol, useWallet: false }).data,
    ).toMatchObject({ useWallet: false });
    expect(
      CheckoutRequestSchema.safeParse({ ...lol, walletEurCents: 999 }).success,
    ).toBe(false);
  });

  it('uses the wallet after pricing while keeping Stripe at its minimum', () => {
    expect(walletSplit(1_000, 2_000)).toEqual({ wallet: 1_000, card: 0 });
    expect(walletSplit(1_000, 700)).toEqual({ wallet: 700, card: 300 });
    expect(walletSplit(1_000, 980)).toEqual({ wallet: 950, card: 50 });
    expect(walletSplit(1_000, 0)).toEqual({ wallet: 0, card: 1_000 });
  });
});

describe('checkout pricing', () => {
  it('prices on the server and ignores anything else the browser sends', () => {
    expect(
      CheckoutRequestSchema.safeParse({ ...lol, total: 0.01 }).success,
    ).toBe(false);
    const built = buildCheckout(CheckoutRequestSchema.parse(lol));
    expect(built.row.amount_eur_cents).toBe(1077); // 3.99 × 3 − 10%
    expect(built.row).toMatchObject({
      game: 'lol',
      service: 'duo2',
      title: 'Duo Pro',
      unit: 'game',
      gg: false,
      region: 'EUW',
    });
    expect(built.row.payout_usd_cents).toBeGreaterThan(0);
    expect(built.productName).toBe('Duo Pro · 3 games');
  });
  it('rejects unknown services, servers and the Teams tab', () => {
    expect(() =>
      buildCheckout(CheckoutRequestSchema.parse({ ...lol, serviceId: 'nope' })),
    ).toThrow();
    expect(() =>
      buildCheckout(CheckoutRequestSchema.parse({ ...lol, server: 'MARS' })),
    ).toThrow();
  });
  it('stores Minecraft server and edition together', () => {
    const built = buildCheckout(
      CheckoutRequestSchema.parse({
        gameId: 'mc',
        serviceId: 'pvp',
        units: 1,
        server: 'Hypixel',
        edition: 'Java',
        ign: 'Steve',
      }),
    );
    expect(built.row.region).toBe('Hypixel · Java');
  });
});

describe('checkout session', () => {
  const params = sessionParams({
    intentId: '5e1a0000-0000-4000-8000-000000000001',
    customerId: 'c',
    email: 'p@example.com',
    origin: 'https://duoly.gg',
    amountEurCents: 1617,
    productName: 'Duo Pro · 3 games',
    description: 'League of Legends · EUW',
    nowSeconds: 1_000_000,
  });
  it('lets Stripe show every enabled method and authorizes where possible', () => {
    expect('payment_method_types' in params).toBe(false);
    expect(params.payment_method_options).toMatchObject({
      card: { capture_method: 'manual' },
      paypal: { capture_method: 'manual' },
    });
    expect(params.ui_mode).toBe('elements');
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(1617);
    expect(params.client_reference_id).toBe(
      '5e1a0000-0000-4000-8000-000000000001',
    );
    expect(params.return_url).toBe(
      'https://duoly.gg/checkout/return?session_id={CHECKOUT_SESSION_ID}',
    );
    expect(params.expires_at! - 1_000_000).toBeGreaterThanOrEqual(30 * 60);
  });
});

describe('webhook facts', () => {
  const session = (over: Partial<Stripe.Checkout.Session> = {}) =>
    ({
      id: 'cs_test_1',
      client_reference_id: '5e1a0000-0000-4000-8000-000000000001',
      currency: 'eur',
      amount_total: 1617,
      currency_conversion: null,
      metadata: {},
      ...over,
    }) as unknown as Stripe.Checkout.Session;
  const intent = (status: string, method = 'card') =>
    ({
      id: 'pi_1',
      status,
      amount: 1617,
      currency: 'eur',
      payment_method_types: [method],
      latest_charge: { payment_method_details: { type: method } },
    }) as unknown as Stripe.PaymentIntent;
  it('maps authorization, capture and async processing', () => {
    expect(paymentFacts(session(), intent('requires_capture'))?.state).toBe(
      'authorized',
    );
    expect(paymentFacts(session(), intent('succeeded', 'eps'))).toMatchObject({
      state: 'captured',
      method: 'eps',
    });
    expect(
      paymentFacts(session(), intent('processing', 'sepa_debit'))?.state,
    ).toBe('processing');
  });
  it('reads the EUR amount behind Adaptive Pricing', () => {
    const facts = paymentFacts(
      session({
        currency: 'usd',
        amount_total: 1890,
        currency_conversion: {
          source_currency: 'eur',
          amount_total: 1617,
        } as Stripe.Checkout.Session.CurrencyConversion,
      }),
      intent('requires_capture'),
    );
    expect(facts?.eurAmountCents).toBe(1617);
  });
  it('rejects sessions without our intent id', () => {
    expect(
      paymentFacts(session({ client_reference_id: null }), intent('succeeded')),
    ).toBeNull();
  });
});

describe('refund webhook facts', () => {
  it('extracts payment intents from succeeded refunds and refunded charges', () => {
    expect(
      refundedPaymentIntentId('refund.updated', {
        status: 'succeeded',
        payment_intent: 'pi_refund',
      }),
    ).toBe('pi_refund');
    expect(
      refundedPaymentIntentId('charge.refunded', {
        refunded: true,
        payment_intent: { id: 'pi_charge' },
      }),
    ).toBe('pi_charge');
  });
  it('ignores refunds that have not succeeded', () => {
    expect(
      refundedPaymentIntentId('refund.updated', {
        status: 'pending',
        payment_intent: 'pi_pending',
      }),
    ).toBeNull();
  });
});

describe('dispute webhook facts', () => {
  it('maps open, won and lost dispute events to deposit actions', () => {
    const base = {
      id: 'dp_123',
      charge: 'ch_123',
      payment_intent: 'pi_123',
      reason: 'fraudulent',
    };
    expect(disputeFacts({ ...base, status: 'needs_response' })).toEqual({
      disputeId: 'dp_123',
      chargeId: 'ch_123',
      paymentIntentId: 'pi_123',
      status: 'needs_response',
      reason: 'fraudulent',
      action: 'block',
    });
    expect(disputeFacts({ ...base, status: 'won' })?.action).toBe('unblock');
    expect(disputeFacts({ ...base, status: 'lost' })?.action).toBe('forfeit');
  });

  it('accepts expanded charge and payment intent objects and rejects malformed events', () => {
    expect(
      disputeFacts({
        id: 'dp_456',
        charge: { id: 'ch_456' },
        payment_intent: { id: 'pi_456' },
        status: 'under_review',
        reason: 'general',
      }),
    ).toMatchObject({ chargeId: 'ch_456', paymentIntentId: 'pi_456' });
    expect(disputeFacts({ id: 'dp_bad', status: 'lost' })).toBeNull();
  });
});

describe('settlement', () => {
  const stripe = (status: string) => {
    const calls: string[] = [];
    const client = {
      paymentIntents: {
        retrieve: vi.fn(async () => ({ id: 'pi_1', status })),
        capture: vi.fn(async () => calls.push('capture')),
        cancel: vi.fn(async () => calls.push('cancel')),
      },
      refunds: { create: vi.fn(async () => calls.push('refund')) },
    } as unknown as Stripe;
    return { client, calls };
  };
  const row = (settle: 'capture' | 'release' | 'refund') => ({
    order_id: 'o1',
    stripe_payment_intent_id: 'pi_1',
    state: 'authorized',
    settle,
  });
  it('captures an authorization on accept', async () => {
    const s = stripe('requires_capture');
    expect(await settleOne(s.client, row('capture'))).toEqual({
      state: 'captured',
    });
    expect(s.calls).toEqual(['capture']);
  });
  it('voids an authorization on cancel, never refunds it', async () => {
    const s = stripe('requires_capture');
    expect((await settleOne(s.client, row('release'))).state).toBe('voided');
    expect(s.calls).toEqual(['cancel']);
  });
  it('refunds only payments that were captured at checkout', async () => {
    const s = stripe('succeeded');
    expect((await settleOne(s.client, row('release'))).state).toBe('refunded');
    expect(s.calls).toEqual(['refund']);
  });
  it('refunds an accepted or completed order with an admin-specific idempotency key', async () => {
    const s = stripe('succeeded');
    expect((await settleOne(s.client, row('refund'))).state).toBe('refunded');
    expect(s.calls).toEqual(['refund']);
    expect(s.client.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_1' }),
      { idempotencyKey: 'admin_refund_o1' },
    );
  });
  it('retries while an async payment is still processing', async () => {
    const s = stripe('processing');
    expect((await settleOne(s.client, row('release'))).state).toBe('retry');
    expect(s.calls).toEqual([]);
  });
});

describe('creator link first-order discount', () => {
  it('takes 10% off the customer price and leaves the teammate payout alone', () => {
    const built = buildCheckout(CheckoutRequestSchema.parse(lol));
    const priced = applyCreatorDiscount(built);
    const amount = built.row.amount_eur_cents;
    expect(priced.discountCents).toBe(Math.round(amount / 10));
    expect(priced.row.amount_eur_cents).toBe(amount - priced.discountCents);
    expect(priced.row.first_order_discount_cents).toBe(priced.discountCents);
    expect(priced.row.payout_usd_cents).toBe(built.row.payout_usd_cents);
  });
  it('never goes below the 0.99 EUR minimum', () => {
    const tiny = { row: { amount_eur_cents: 100 } };
    expect(applyCreatorDiscount(tiny).row.amount_eur_cents).toBe(99);
  });
});
