import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { isProPrice, proSessionParams } from '../../src/server/pro/billing';
import {
  PRO_PRICE_LOOKUP_KEY,
  PRO_TRIAL_DAYS,
} from '../../src/server/pro/config';
import { applyOrderDiscounts } from '../../src/server/pro/discounts';
import {
  invoiceSubscriptionId,
  isProCheckoutSession,
  subscriptionFacts,
} from '../../src/server/pro/webhook';
import { termsWithPro } from '../../src/server/pro/terms';
import { proStatusLine, toProView } from '../../src/contracts/pro';
import { toRoomOrder } from '../../src/components/account/queue-room-data';

const price = (over: Record<string, unknown> = {}) =>
  ({
    id: 'price_pro',
    active: true,
    type: 'recurring',
    currency: 'eur',
    unit_amount: 499,
    recurring: { interval: 'month', interval_count: 1 },
    ...over,
  }) as unknown as Stripe.Price;

describe('Duoly PRO catalog and Checkout', () => {
  it('uses the approved lookup key and accepts only the approved monthly price', () => {
    expect(PRO_PRICE_LOOKUP_KEY).toBe('duoly_pro_monthly');
    expect(isProPrice(price())).toBe(true);
    expect(isProPrice(price({ unit_amount: 500 }))).toBe(false);
    expect(isProPrice(price({ currency: 'usd' }))).toBe(false);
    expect(
      isProPrice(price({ recurring: { interval: 'year', interval_count: 1 } })),
    ).toBe(false);
  });

  it('creates an Elements subscription Checkout with card collection and the trial', () => {
    const params = proSessionParams({
      customerId: 'cus_pro',
      userId: '00000000-0000-4000-8000-000000000001',
      priceId: 'price_pro',
      origin: 'https://duoly.gg',
      trial: true,
    });
    expect(params.ui_mode).toBe('elements');
    expect(params.mode).toBe('subscription');
    expect(params.payment_method_collection).toBe('always');
    expect(params.subscription_data?.trial_period_days).toBe(PRO_TRIAL_DAYS);
    expect(params.return_url).toBe(
      'https://duoly.gg/dashboard?pro=welcome#pro',
    );
    expect('success_url' in params).toBe(false);
    expect('cancel_url' in params).toBe(false);
  });
});

describe('Duoly PRO order pricing', () => {
  const built = {
    row: { amount_eur_cents: 1_617, payout_usd_cents: 1_200 },
    productName: 'Duo Pro · 3 games',
  };

  it('takes 10% after the bundle price and leaves teammate pay unchanged', () => {
    const priced = applyOrderDiscounts(
      built,
      { pro: true, creator: false },
      10,
    );
    expect(priced.discountKind).toBe('pro');
    expect(priced.discountCents).toBe(162);
    expect(priced.row.amount_eur_cents).toBe(1_455);
    expect(priced.row.pro_discount_cents).toBe(162);
    expect(priced.row.payout_usd_cents).toBe(1_200);
  });

  it('does not stack creator and PRO discounts and chooses the larger one', () => {
    expect(
      applyOrderDiscounts(built, { pro: true, creator: true }, 10).discountKind,
    ).toBe('pro');
    expect(
      applyOrderDiscounts(built, { pro: true, creator: true }, 15).discountKind,
    ).toBe('creator');
  });
});

describe('Duoly PRO webhook facts', () => {
  const subscription = {
    id: 'sub_pro',
    customer: 'cus_pro',
    status: 'trialing',
    metadata: {
      kind: 'duoly_pro',
      user_id: '00000000-0000-4000-8000-000000000001',
    },
    trial_start: 100,
    trial_end: 200,
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ended_at: null,
    default_payment_method: { card: { fingerprint: 'CardFingerprint1' } },
    items: { data: [{ current_period_end: 200 }] },
  } as unknown as Stripe.Subscription;

  it('recognizes only marked PRO checkout sessions', () => {
    expect(
      isProCheckoutSession({
        mode: 'subscription',
        metadata: { kind: 'duoly_pro' },
      }),
    ).toBe(true);
    expect(isProCheckoutSession({ mode: 'subscription', metadata: {} })).toBe(
      false,
    );
  });

  it('extracts subscription periods, identity and card fingerprint', () => {
    expect(subscriptionFacts(subscription)).toMatchObject({
      subscriptionId: 'sub_pro',
      customerId: 'cus_pro',
      status: 'trialing',
      currentPeriodEnd: new Date(200_000).toISOString(),
      metadataUser: '00000000-0000-4000-8000-000000000001',
      cardFingerprint: 'CardFingerprint1',
    });
  });

  it('supports current and legacy invoice subscription shapes', () => {
    expect(
      invoiceSubscriptionId({
        parent: { subscription_details: { subscription: 'sub_new' } },
      }),
    ).toBe('sub_new');
    expect(invoiceSubscriptionId({ subscription: 'sub_old' })).toBe('sub_old');
  });
});

describe('Duoly PRO terms', () => {
  it('removes the no-subscription conflict and provides an online cancel path', () => {
    const terms = termsWithPro({
      title: 'Terms',
      sections: [
        {
          id: 'payment',
          title: 'Payment',
          blocks: [
            {
              note: 'There is no charge after each game, no subscription and nothing hidden.',
            },
          ],
        },
      ],
    });
    const text = JSON.stringify(terms);
    expect(text).not.toContain('no subscription');
    expect(text).toContain('Manage PRO');
    expect(text).toContain('€4.99 a month');
  });
});

describe('Duoly PRO views', () => {
  const row = (
    subscription: Record<string, unknown> | null,
    member = true,
  ) => ({
    member,
    trial_eligible: false,
    has_customer: true,
    subscription: subscription && {
      trial_end: null,
      current_period_end: null,
      cancel_at_period_end: false,
      grace_until: null,
      ...subscription,
    },
  });

  it('describes trial, renewal, cancel and the 3-day grace (R6)', () => {
    expect(
      proStatusLine(
        toProView(
          row({ status: 'trialing', trial_end: '2026-11-04T10:00:00Z' }),
        ),
      ),
    ).toBe('Free trial until 4 Nov, then €4.99/month. Cancel anytime.');
    expect(
      proStatusLine(
        toProView(
          row({ status: 'active', current_period_end: '2026-12-01T10:00:00Z' }),
        ),
      ),
    ).toBe('Renews on 1 Dec.');
    expect(
      proStatusLine(
        toProView(
          row({
            status: 'active',
            cancel_at_period_end: true,
            current_period_end: '2026-12-01T10:00:00Z',
          }),
        ),
      ),
    ).toBe('PRO ends on 1 Dec.');
    const grace = toProView(
      row({ status: 'past_due', grace_until: '2026-11-03T10:00:00Z' }),
    );
    expect(grace?.manage).toBe(true);
    expect(proStatusLine(grace)).toBe(
      'Your last payment failed. PRO stays on until 3 Nov. Update your card to keep it.',
    );
    expect(proStatusLine(toProView(row({ status: 'past_due' }, false)))).toBe(
      'Your last payment failed. Update your card to switch PRO back on.',
    );
    expect(toProView(row(null, false))?.manage).toBe(false);
    expect(toProView({ member: 'yes' })).toBeNull();
  });

  it('shows unlimited re-rolls for PRO members only (R2)', () => {
    const order = {
      id: 'o1',
      status: 'in_progress',
      rerolls: 5,
      accepted_at: '2026-10-28T10:00:00Z',
      queued_at: '2026-10-28T09:59:00Z',
      created_at: '2026-10-28T09:58:00Z',
      amount_eur_cents: 900,
      game: 'lol',
      service: 'duo2',
      title: 'Duo',
      units: 1,
      unit: 'game',
    };
    expect(toRoomOrder(order, { proMember: true })).toMatchObject({
      rerollsUnlimited: true,
      rerollsLeft: 1,
    });
    expect(toRoomOrder(order)).toMatchObject({
      rerollsUnlimited: false,
      rerollsLeft: 0,
    });
  });
});
