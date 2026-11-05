import { describe, expect, it, vi } from 'vitest';
import {
  freeCoachingFits,
  freeCoachingStatus,
  monthName,
} from '../../src/components/shared/perks';
import {
  createTeammateFetch,
  newEligibleOrders,
  toOriginalTeammateOrder,
} from '../../src/components/teammate/teammate-data';
import { toOriginalOrder } from '../../src/components/account/dashboard-data';
import { toRoomOrder } from '../../src/components/account/queue-room-data';

const order = {
  id: '11111111-1111-4111-8111-111111111111',
  public_reference: 'DL-42',
  status: 'queued',
  game: 'lol',
  service: 'duo',
  title: 'Duo queue',
  units: 2,
  unit: 'game',
  gg: false,
  rank: 'Gold',
  region: 'EUW',
  ign: 'Player#EUW',
  note: '',
  voice: false,
  customer_name: 'Customer',
  customer_image: '',
  customer_country: 'de',
  payout_usd_cents: 1234,
  current_assignment_id: null,
};

const perks = (available: boolean, eligible = true) => ({
  level: 'platinum',
  freeCoaching: { eligible, used: !available, available, month: '2026-10' },
  freePro: { eligible: false },
});

describe('perks UI helpers', () => {
  it('free coaching fits any coaching service with exactly one unit', () => {
    expect(freeCoachingFits({ cat: 'training', units: 1 })).toBe(true);
    expect(freeCoachingFits({ cat: 'training', units: 3 })).toBe(false);
    expect(freeCoachingFits({ cat: 'duo', units: 1 })).toBe(false);
    expect(freeCoachingFits({ cat: 'gg', units: 1 })).toBe(false);
    expect(
      freeCoachingFits({ cat: 'training', units: 1, bundle: 'Starter' }),
    ).toBe(false);
  });

  it('words this month’s free coaching status', () => {
    expect(monthName('2026-10')).toBe('October');
    expect(freeCoachingStatus(perks(true))).toBe(
      'Your free coaching session for October is ready',
    );
    expect(freeCoachingStatus(perks(false))).toBe(
      'Used for October. Back on the 1st.',
    );
    expect(freeCoachingStatus(perks(false, false))).toBe('');
    expect(freeCoachingStatus(null)).toBe('');
  });

  it('marks free perk orders and shows no price for them', () => {
    const dto = {
      id: '11111111-1111-4111-8111-111111111111',
      public_reference: 'DL-1',
      status: 'queued',
      game: 'lol',
      title: 'Play & Learn',
      units: 1,
      unit: 'game',
      region: 'EUW',
      rerolls: 0,
      teammate: null,
      review: null,
      created_at: '2026-10-28T10:00:00Z',
      queued_at: '2026-10-28T10:00:00Z',
      completed_at: null,
      accepted_at: null,
      amount_eur_cents: 649,
      cancel_reason: null,
      free_perk: true,
    };
    expect(toOriginalOrder(dto).freePerk).toBe(true);
    expect(
      toOriginalOrder({ ...dto, free_perk: undefined }),
    ).not.toHaveProperty('freePerk');
    expect(toRoomOrder(dto).paid).toEqual({
      currency: 'EUR',
      total: 0,
      method: 'Free with your perk',
    });
  });
});

describe('picked for you on the teammate desk', () => {
  const pickedId = '55555555-5555-4555-8555-555555555555';
  it('maps picked_for_you and rings for a new picked order', () => {
    const picked = toOriginalTeammateOrder({
      ...order,
      id: pickedId,
      picked_for_you: true,
    });
    expect(picked.pickedForYou).toBe(true);
    expect(toOriginalTeammateOrder(order)).not.toHaveProperty('pickedForYou');
    expect(
      newEligibleOrders(
        [order.id],
        [toOriginalTeammateOrder(order), picked],
        { games: ['lol'], gg: false },
        { enabledGames: ['lol'], voiceOptIn: false },
      ).map((o: { id: string }) => o.id),
    ).toEqual([pickedId]);
  });

  it('passes through POST /api/teammate/orders/<id>/pass with the csrf token', async () => {
    const fetcher = vi.fn<
      (url: string, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(JSON.stringify({ passed: true }), { status: 200 }),
    );
    const desk = createTeammateFetch({ csrf: 'token', fetcher });
    const response = await desk('/api/orders/' + pickedId, {
      method: 'POST',
      body: JSON.stringify({ action: 'pass' }),
    });
    expect(await response.json()).toEqual({ passed: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const call = fetcher.mock.calls[0]!;
    const url = call[0];
    const init = call[1];
    expect(url).toBe('/api/teammate/orders/' + pickedId + '/pass');
    expect(JSON.parse(String(init?.body))).toEqual({ csrf: 'token' });
  });
});
