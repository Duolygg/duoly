import { describe, expect, it } from 'vitest';
import {
  AdminPayoutCommandSchema,
  PayoutDetailsCommandSchema,
} from '../../src/contracts/payouts';
import { AdminCreatorCommandSchema } from '../../src/contracts/creators';
import { TeammateStatsResponseSchema } from '../../src/contracts/reviews';

const id = '6d000000-0000-4000-8000-0000000000a1';

describe('admin payout commands', () => {
  it('accepts plus or minus adjustments up to 1000 USD with a reason', () => {
    for (const amountCents of [1, -1, 100000, -100000])
      expect(
        AdminPayoutCommandSchema.safeParse({
          csrf: 't',
          action: 'adjust',
          teammateId: id,
          amountCents,
          reason: 'Bonus',
        }).success,
      ).toBe(true);
  });
  it('refuses zero, oversized, fractional or reasonless adjustments', () => {
    for (const patch of [
      { amountCents: 0 },
      { amountCents: 100001 },
      { amountCents: -100001 },
      { amountCents: 1.5 },
      { reason: '  ' },
      { reason: 'x'.repeat(201) },
    ])
      expect(
        AdminPayoutCommandSchema.safeParse({
          csrf: 't',
          action: 'adjust',
          teammateId: id,
          amountCents: 500,
          reason: 'Bonus',
          ...patch,
        }).success,
      ).toBe(false);
  });
  it('requires a method and reference to pay, and a reason to hold', () => {
    expect(
      AdminPayoutCommandSchema.safeParse({
        csrf: 't',
        action: 'pay',
        payoutId: id,
        method: 'wise',
        reference: 'W-1',
      }).success,
    ).toBe(true);
    expect(
      AdminPayoutCommandSchema.safeParse({
        csrf: 't',
        action: 'pay',
        payoutId: id,
        method: 'stripe',
        reference: 'W-1',
      }).success,
    ).toBe(false);
    expect(
      AdminPayoutCommandSchema.safeParse({
        csrf: 't',
        action: 'payAll',
        method: 'bank',
        reference: '',
      }).success,
    ).toBe(false);
    expect(
      AdminPayoutCommandSchema.safeParse({
        csrf: 't',
        action: 'hold',
        payoutId: id,
        reason: '',
      }).success,
    ).toBe(false);
    expect(
      AdminPayoutCommandSchema.safeParse({
        csrf: 't',
        action: 'release',
        payoutId: id,
        extra: true,
      }).success,
    ).toBe(false);
  });
});

describe('payout details and creator payouts', () => {
  const details = {
    csrf: 't',
    legalName: 'Legal Name',
    address: 'Test Street 1, Vienna',
    country: 'Austria',
    dateOfBirth: '1990-01-02',
    taxNumber: 'ATU1',
    method: 'paypal',
    account: 'me@example.invalid',
  };
  it('validates the private payout details form', () => {
    expect(PayoutDetailsCommandSchema.safeParse(details).success).toBe(true);
    expect(
      PayoutDetailsCommandSchema.safeParse({
        ...details,
        dateOfBirth: '02.01.1990',
      }).success,
    ).toBe(false);
    expect(
      PayoutDetailsCommandSchema.safeParse({ ...details, method: 'other' })
        .success,
    ).toBe(false);
  });
  it('marks a creator month paid only with month, method and reference', () => {
    const pay = {
      csrf: 't',
      action: 'pay',
      creatorId: id,
      month: '2026-09',
      method: 'bank',
      reference: 'B-1',
    };
    expect(AdminCreatorCommandSchema.safeParse(pay).success).toBe(true);
    expect(
      AdminCreatorCommandSchema.safeParse({ ...pay, month: '2026-13' }).success,
    ).toBe(false);
    expect(
      AdminCreatorCommandSchema.safeParse({ ...pay, reference: ' ' }).success,
    ).toBe(false);
  });
  it('teammate stats accept the payout summary and adjustment rows', () => {
    const parsed = TeammateStatsResponseSchema.safeParse({
      now: 1,
      me: '6d000000-0000-4000-8000-0000000000f1',
      stats: {
        completed: 2,
        tier: { name: 'Rookie', deposit: 10 },
        held: 0,
        released: 0,
        forfeited: 0,
        saved: 0,
        progress: { current: 2, next: 100, remaining: 98, percent: 2 },
        rating: null,
        reviews: 0,
        tipsTotal: 0,
        recent: [
          {
            orderId: null,
            at: 1,
            net: -2.5,
            tip: 0,
            game: null,
            adjustment: true,
          },
        ],
        latestReviews: [],
        adjustments: [{ amount: -2.5, reason: 'Late', at: 1 }],
        payout: {
          weekStart: 1,
          weekEnd: 2,
          due: -2.5,
          carried: 0,
          held: 0,
          minimum: 10,
          details: false,
          owed: 0,
          history: [
            { start: 1, end: 2, total: 5, status: 'Carried', paidAt: null },
          ],
        },
      },
      leaderboard: {},
    });
    expect(parsed.success).toBe(true);
  });
});
