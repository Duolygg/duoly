import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import {
  buildCheckout,
  CheckoutRequestSchema,
  sessionParams,
} from '../../src/server/payments/checkout';
import { paymentFacts } from '../../src/server/payments/webhook';
import { settleOne } from '../../src/server/payments/settle';

const lol = {
  gameId: 'lol',
  serviceId: 'duo2',
  units: 3,
  server: 'EUW',
  rank: 'Platinum',
  ign: 'Tester#EUW',
};

describe('checkout pricing', () => {
  it('prices on the server and ignores anything else the browser sends', () => {
    expect(
      CheckoutRequestSchema.safeParse({ ...lol, total: 0.01 }).success,
    ).toBe(false);
    const built = buildCheckout(CheckoutRequestSchema.parse(lol));
    expect(built.row.amount_eur_cents).toBe(1617); // 5.99 × 3 − 10%
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
  const input = {
    intentId: '5e1a0000-0000-4000-8000-000000000001',
    customerId: 'c',
    email: 'p@example.com',
    origin: 'https://duoly.gg',
    amountEurCents: 1617,
    productName: 'Duo Pro · 3 games',
    description: 'League of Legends · EUW',
    nowSeconds: 1_000_000,
  };
  const params = sessionParams({ ...input, taxAndInvoices: false });
  it('leaves tax and invoices off unless asked (live mode)', () => {
    expect(params.automatic_tax).toBeUndefined();
    expect(params.invoice_creation).toBeUndefined();
    expect(params.tax_id_collection).toBeUndefined();
    expect(params.line_items?.[0]?.price_data?.tax_behavior).toBeUndefined();
  });
  it('adds Stripe Tax and invoices without changing what the customer pays', () => {
    const taxed = sessionParams({ ...input, taxAndInvoices: true });
    expect(taxed.automatic_tax).toEqual({ enabled: true });
    expect(taxed.tax_id_collection).toEqual({ enabled: true });
    expect(taxed.invoice_creation).toMatchObject({
      enabled: true,
      invoice_data: { metadata: { intent_id: input.intentId } },
    });
    const price = taxed.line_items?.[0]?.price_data;
    expect(price?.unit_amount).toBe(1617);
    expect(price?.tax_behavior).toBe('inclusive');
    expect(price?.product_data?.tax_code).toBe('txcd_20030000');
  });
  it('lets Stripe show every enabled method and authorizes where possible', () => {
    expect('payment_method_types' in params).toBe(false);
    expect(params.payment_method_options).toMatchObject({
      card: { capture_method: 'manual' },
      paypal: { capture_method: 'manual' },
    });
    expect(params.ui_mode).toBe('embedded_page');
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
  const row = (settle: 'capture' | 'release') => ({
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
  it('retries while an async payment is still processing', async () => {
    const s = stripe('processing');
    expect((await settleOne(s.client, row('release'))).state).toBe('retry');
    expect(s.calls).toEqual([]);
  });
});
