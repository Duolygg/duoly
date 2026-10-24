import { describe, expect, it } from 'vitest';
import { toRoomOrder } from '../../src/components/account/queue-room-data.js';

const order = {
  id: '11111111-1111-4111-8111-111111111111',
  public_reference: 'DL-1002',
  status: 'in_progress',
  game: 'val',
  service: 'duo',
  title: 'Duo Pro',
  units: 1,
  unit: 'game',
  gg: false,
  rank: '',
  region: 'EU West',
  ign: 'Pay#EUW',
  note: 'chill',
  voice: true,
  amount_eur_cents: 849,
  created_at: '2026-10-23T10:00:00.000Z',
  queued_at: '2026-10-23T10:01:00.000Z',
  accepted_at: '2026-10-23T10:02:00.000Z',
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 1,
  current_assignment_id: '22222222-2222-4222-8222-222222222222',
  teammate: { name: 'Mika Star', image: '', country: 'de' },
  review: null,
};

describe('order room adapter (original QueueRoom.jsx shape)', () => {
  it('counts the queue from queued_at and the reroll window from accept', () => {
    const o = toRoomOrder(order);
    expect(o.createdAt).toBe(Date.parse(order.queued_at));
    expect(o.rerollUntil).toBe(Date.parse(order.accepted_at) + 5 * 60 * 1000);
    expect(o.rerollsLeft).toBe(1);
    expect(o.autoCancelMs).toBe(300000);
    expect(o).toMatchObject({
      ref: 'DL-1002',
      ign: 'Pay#EUW',
      voice: true,
      note: 'chill',
    });
    expect(o.paid).toEqual({
      currency: 'EUR',
      total: 8.49,
      method: 'Stripe checkout',
    });
  });
  it('maps a saved review into the original room shape', () => {
    const review = {
      rating: 5,
      text: 'Great teammate',
      tags: ['Great comms'],
      at: '2026-10-24T12:00:00.000Z',
    };
    expect(
      toRoomOrder({ ...order, status: 'completed', review }).review,
    ).toEqual({
      ...review,
      at: Date.parse(review.at),
    });
  });
  it('shows the teammate bio and languages when the order DTO has them', () => {
    expect(toRoomOrder(order).teammate).toMatchObject({
      name: 'Mika Star',
      bio: '',
      languages: [],
    });
    const mate = {
      name: 'Mika Star',
      image: '',
      country: 'de',
      bio: 'Calm comms',
      languages: ['English', 'German'],
    };
    expect(toRoomOrder({ ...order, teammate: mate }).teammate).toMatchObject({
      bio: 'Calm comms',
      languages: ['English', 'German'],
    });
  });
  it('maps report status into the original room shape', () => {
    const reports = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        reference: 'R-33333333',
        type: 'toxic',
        status: 'approved',
        bounty_eur_cents: 5000,
        created_at: '2026-10-24T12:00:00.000Z',
        decided_at: '2026-10-24T13:00:00.000Z',
        bounty_owed: true,
      },
    ];
    expect(toRoomOrder({ ...order, reports }).reports).toEqual([
      {
        id: 'R-33333333',
        type: 'toxic',
        status: 'approved',
        bounty: 50,
        at: Date.parse(reports[0]!.created_at),
        decidedAt: Date.parse(reports[0]!.decided_at),
        bountyOwed: true,
      },
    ]);
  });
  it('keeps the raw cancel reason so the room can tell who cancelled', () => {
    const o = toRoomOrder({
      ...order,
      status: 'cancelled',
      accepted_at: null,
      teammate: null,
      cancel_reason: 'customer_cancelled',
    });
    expect(o.cancelReason).toBe('customer_cancelled');
    expect(o.rerollUntil).toBeNull();
  });
});
