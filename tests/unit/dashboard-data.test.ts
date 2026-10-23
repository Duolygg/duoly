import { describe, expect, it } from 'vitest';
import {
  toOriginalHistory,
  toOriginalOrder,
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
  },
};

describe('dashboard adapter (original Dashboard.jsx data shape)', () => {
  it('maps an order', () => {
    const o = toOriginalOrder(base);
    expect(o).toMatchObject({
      id: base.id,
      ref: 'DL-1001',
      games: 3,
      amountEur: 26.97,
      review: null,
    });
    expect(o.createdAt).toBe(Date.parse(base.created_at));
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
      [{ amount_eur_cents: 500 }],
      now,
    );
    expect(h.lifetimeOrders).toBe(2);
    expect(h.weekOrders).toBe(1);
    expect(h.gamesPlayed).toBe(4);
    expect(h.mates).toEqual([
      expect.objectContaining({ name: 'Mika Star', orders: 2, online: null }),
    ]);
    expect(h.wallet).toBe(5);
    expect(h.orders.map((o) => o.status)).toHaveLength(3);
  });
});
