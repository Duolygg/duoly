import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import {
  TipInputSchema,
  TipPreparedSchema,
  TipStatusSchema,
} from '../../src/contracts/tips';
import {
  createTipIntent,
  tipIntentParams,
} from '../../src/server/tips/handler';
import {
  tipDisputeFacts,
  tipPaymentFacts,
  tipRefundFacts,
} from '../../src/server/payments/webhook';

describe('tip contract', () => {
  it('accepts no tip or 1.00 to 100.00 and rejects browser money outside the rule', () => {
    expect(TipInputSchema.parse({ amount_cents: 0 }).amount_cents).toBe(0);
    expect(TipInputSchema.parse({ amount_cents: 100 }).amount_cents).toBe(100);
    expect(TipInputSchema.parse({ amount_cents: 10_000 }).amount_cents).toBe(
      10_000,
    );
    expect(TipInputSchema.safeParse({ amount_cents: 99 }).success).toBe(false);
    expect(TipInputSchema.safeParse({ amount_cents: 10_001 }).success).toBe(
      false,
    );
    expect(
      TipInputSchema.safeParse({ amount_cents: 500, currency: 'usd' }).success,
    ).toBe(false);
  });

  it('validates prepared and status responses without exposing Stripe secrets', () => {
    const prepared = {
      tipId: '10000000-0000-4000-8000-000000000001',
      amountCents: 500,
      attempt: 0,
      paymentIntentId: null,
      reference: 'DL-42',
      teammate: 'Mika',
      tip: {
        amount: 5,
        currency: 'EUR',
        state: 'pending',
        refunded: 0,
        paidAt: null,
      },
    };
    expect(TipPreparedSchema.parse(prepared)).toEqual(prepared);
    expect(
      TipStatusSchema.parse({
        tip: prepared.tip,
        canTip: true,
        tipUntil: null,
      }),
    ).toBeTruthy();
  });
});

describe('tip PaymentIntent', () => {
  const prepared = {
    tipId: '10000000-0000-4000-8000-000000000001',
    amountCents: 500,
    attempt: 2,
    paymentIntentId: null,
    reference: 'DL-42',
    teammate: 'Mika',
    tip: {
      amount: 5,
      currency: 'EUR' as const,
      state: 'pending' as const,
      refunded: 0,
      paidAt: null,
    },
  };

  it('prices from the database preparation and labels the tip separately', () => {
    expect(tipIntentParams(prepared, 'customer@example.test')).toMatchObject({
      amount: 500,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      description: 'Tip for Mika · DL-42',
      metadata: {
        tip_id: prepared.tipId,
        order_reference: 'DL-42',
      },
      receipt_email: 'customer@example.test',
    });
  });

  it('creates one idempotent intent and attaches the server FX snapshot', async () => {
    const stripe = {
      paymentIntents: {
        create: vi.fn(async () => ({
          id: 'pi_tip123',
          client_secret: 'pi_tip123_secret_test',
        })),
      },
    } as unknown as Stripe;
    const rpc = vi.fn(async () => ({ data: { attached: true }, error: null }));
    const result = await createTipIntent({
      stripe,
      rpc,
      prepared,
      email: null,
      fx: 1.1,
      publishableKey: 'pk_test_12345678901234567890',
    });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500, currency: 'eur' }),
      { idempotencyKey: `tip_${prepared.tipId}_2` },
    );
    expect(rpc).toHaveBeenCalledWith('order_tip_attach', {
      p_tip_id: prepared.tipId,
      p_payment_intent: 'pi_tip123',
      p_amount_cents: 500,
      p_fx: 1.1,
    });
    expect(result).toEqual({
      clientSecret: 'pi_tip123_secret_test',
      publishableKey: 'pk_test_12345678901234567890',
      amount: 5,
      currency: 'EUR',
      teammate: 'Mika',
    });
  });
});

describe('tip webhook facts', () => {
  it('accepts only succeeded EUR tips with matching metadata', () => {
    expect(
      tipPaymentFacts({
        id: 'pi_tip123',
        status: 'succeeded',
        amount_received: 500,
        currency: 'eur',
        metadata: { tip_id: '10000000-0000-4000-8000-000000000001' },
      }),
    ).toEqual({
      paymentIntentId: 'pi_tip123',
      tipId: '10000000-0000-4000-8000-000000000001',
      amountCents: 500,
      currency: 'eur',
    });
    expect(
      tipPaymentFacts({ id: 'pi_bad', status: 'processing', metadata: {} }),
    ).toBeNull();
  });

  it('extracts cumulative tip refunds and tip disputes', () => {
    expect(
      tipRefundFacts({
        payment_intent: 'pi_tip123',
        amount_refunded: 250,
        refunded: false,
      }),
    ).toEqual({ paymentIntentId: 'pi_tip123', refundedCents: 250 });
    expect(
      tipDisputeFacts({
        id: 'dp_tip123',
        payment_intent: 'pi_tip123',
        status: 'lost',
      }),
    ).toEqual({
      disputeId: 'dp_tip123',
      paymentIntentId: 'pi_tip123',
      status: 'lost',
    });
  });
});
