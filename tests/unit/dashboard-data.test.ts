import { describe, expect, it } from 'vitest';
import {
  toOriginalHistory,
  toOriginalOrder,
  toOriginalRewards,
} from '../../src/components/account/dashboard-data.js';

const base = {
  id: '11111111-1111-4111-8111-111111111111',
  public_reference: 'DL-1001',
  status: 'completed',
  game: 'val',
  service: 'duo',
  title: 'Duo',
  units: 3,
  unit: 'game',
  gg: false,
  rank: '',
  region: 'EU',
  ign: 'Me#EU',
  note: '',
  voice: false,
  amount_eur_cents: 2697,
  created_at: '2026-10-20T10:00:00.000Z',
  queued_at: '2026-10-20T10:00:00.000Z',
  accepted_at: '2026-10-20T10:01:00.000Z',
  completed_at: '2026-10-20T11:00:00.000Z',
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 0,
  current_assignment_id: null,
  teammate: {
    name: 'Mika Star',
    image: '/assets/avatars/avatar-2.png',
    country: 'de',
    trust_badge: { id: 'trusted', name: 'Trusted' },
  },
  review: null,
};

describe('dashboard adapter (original Dashboard.jsx data shape)', () => {
  it('maps an order', () => {
    const o = toOriginalOrder(base);
    expect(o).toMatchObject({
      id: base.id,
      ref: 'DL-1001',
      games: 3,
      amountEur: 26.97,
      teammate: { trustBadge: { id: 'trusted', name: 'Trusted' } },
      review: null,
    });
    expect(o.createdAt).toBe(Date.parse(base.created_at));
  });
  it('maps reviews and computes the customer view of a teammate rating', () => {
    const reviewed = {
      ...base,
      review: {
        rating: 5,
        text: 'Great teammate',
        tags: ['Great comms'],
        at: '2026-10-24T12:00:00.000Z',
      },
    };
    expect(toOriginalOrder(reviewed).review).toEqual({
      ...reviewed.review,
      at: Date.parse(reviewed.review.at),
    });
    expect(
      toOriginalHistory([reviewed], [], Date.parse('2026-10-24T13:00:00.000Z'))
        .mates[0].rating,
    ).toBe(5);
  });
  it('labels cancelled orders as not charged', () => {
    const o = toOriginalOrder({
      ...base,
      status: 'cancelled',
      completed_at: null,
      cancel_reason: 'queue_expired',
    });
    expect(o.cancelReason).toMatch(/not charged/);
  });
  it('computes stats, teammates and wallet from real orders', () => {
    const now = Date.parse('2026-10-22T12:00:00.000Z');
    const h = toOriginalHistory(
      [
        base,
        {
          ...base,
          id: '22222222-2222-4222-8222-222222222222',
          game: 'lol',
          units: 1,
          completed_at: '2026-10-01T10:00:00.000Z',
          created_at: '2026-10-01T09:00:00.000Z',
        },
        {
          ...base,
          id: '33333333-3333-4333-8333-333333333333',
          status: 'cancelled',
          completed_at: null,
          teammate: null,
          cancel_reason: 'customer_cancelled',
        },
      ],
      {
        credits: [{ amount_eur_cents: 500 }],
        balance: {
          total_eur_cents: 6500,
          cashable_eur_cents: 500,
          promo_eur_cents: 6000,
          refunds_eur_cents: 500,
          cashback_eur_cents: 0,
          level_gifts_eur_cents: 0,
          bounty_eur_cents: 5000,
          admin_eur_cents: 1000,
          spent_eur_cents: 0,
        },
      },
      now,
    );
    expect(h.lifetimeOrders).toBe(2);
    expect(h.weekOrders).toBe(1);
    expect(h.gamesPlayed).toBe(4);
    expect(h.mates).toEqual([
      expect.objectContaining({
        name: 'Mika Star',
        orders: 2,
        online: null,
        trustBadge: { id: 'trusted', name: 'Trusted' },
      }),
    ]);
    expect(h.wallet).toBe(65);
    expect(h.walletCashable).toBe(5);
    expect(h.walletPromo).toBe(60);
    expect(h.refunds).toBe(5);
    expect(h.gifted).toBe(10);
    expect(h.orders).toHaveLength(3);
  });

  it('maps the customer rewards RPC into Fabian’s Rewards props', () => {
    expect(
      toOriginalRewards({
        orders: 250,
        level: { id: 'gold', name: 'Gold', cashback: 3 },
        remaining: 250,
        percent: 0,
        cashback: {
          earnedEurCents: 1234,
          monthEurCents: 234,
          pendingEurCents: 99,
          pendingOrders: 2,
        },
        gifts: [
          { level: 'silver', amountEurCents: 500 },
          { level: 'gold', amountEurCents: 1500 },
        ],
      }),
    ).toEqual({
      orders: 250,
      cashbackTotal: 12.34,
      cashbackMonth: 2.34,
      cashbackPending: 0.99,
      pendingOrders: 2,
      gifts: [
        { level: 'silver', amountEurCents: 500 },
        { level: 'gold', amountEurCents: 1500 },
      ],
      giftClaimed: true,
      perks: null,
    });
  });

  it('passes perks through and marks free coaching orders', () => {
    const perks = {
      level: 'platinum',
      freeCoaching: {
        eligible: true,
        used: false,
        available: true,
        month: '2026-10',
      },
      freePro: { eligible: false },
    };
    expect(toOriginalRewards({ orders: 500, perks }).perks).toEqual(perks);
  });
});
