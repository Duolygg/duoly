import { describe, it, expect, vi } from 'vitest';
import {
  createTeammateFetch,
  toOriginalTeammateOrder,
} from '../../src/components/teammate/teammate-data';
const id = '11111111-1111-4111-8111-111111111111';
const assignment = '22222222-2222-4222-8222-222222222222';
export const order = {
  id,
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
describe('original teammate adapter', () => {
  it('passes validated rating stats through and rejects unexpected fields', async () => {
    const stats = {
      now: 1792843200000,
      me: id,
      stats: {
        completed: 1,
        tier: { name: 'Rookie', deposit: 10 },
        held: 0.6,
        saved: 0,
        rating: 4.5,
        reviews: 2,
        tipsTotal: 0,
        recent: [],
        latestReviews: [
          {
            rating: 5,
            text: 'GG',
            tags: ['Patient'],
            customer: 'Alex',
            game: 'lol',
            at: 1792843200000,
          },
        ],
        adjustments: [],
      },
      leaderboard: {},
    };
    const ok = createTeammateFetch({
      csrf: 'token',
      fetcher: vi.fn(async () => Response.json(stats)),
    });
    const res = await ok('/api/teammate/stats');
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual(stats);
    const leaky = createTeammateFetch({
      csrf: 'token',
      fetcher: vi.fn(async () =>
        Response.json({
          ...stats,
          stats: {
            ...stats.stats,
            latestReviews: [
              { ...stats.stats.latestReviews[0], customerId: id },
            ],
          },
        }),
      ),
    });
    expect((await leaky('/api/teammate/stats')).ok).toBe(false);
  });
  it('accepts only UUID accept commands with CSRF and validates the exact assignment result', async () => {
    const accepted = {
      ...order,
      status: 'in_progress',
      current_assignment_id: assignment,
    };
    const transport = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain('/accept');
      expect(init?.method).toBe('POST');
      return Response.json({ order: accepted });
    });
    const api = createTeammateFetch({ csrf: 'token', fetcher: transport });
    expect(
      (
        await api('/api/orders/' + id, {
          method: 'POST',
          body: JSON.stringify({ action: 'accept' }),
        })
      ).ok,
    ).toBe(true);
    expect(transport.mock.calls[0]![0]).toBe(
      '/api/teammate/orders/' + id + '/accept',
    );
    expect(JSON.parse(String(transport.mock.calls[0]![1]!.body))).toEqual({
      csrf: 'token',
    });
    expect(
      (
        await api('/api/orders/DL-42', {
          method: 'POST',
          body: '{"action":"accept"}',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api('/api/orders/' + id, {
          method: 'POST',
          body: '{"action":"complete"}',
        })
      ).status,
    ).toBe(400);
    expect(transport).toHaveBeenCalledTimes(1);
    const wrong = createTeammateFetch({
      csrf: 'token',
      fetcher: async () =>
        Response.json({ order: { ...accepted, id: assignment } }),
    });
    expect(
      (
        await wrong('/api/orders/' + id, {
          method: 'POST',
          body: '{"action":"accept"}',
        })
      ).status,
    ).toBe(503);
  });
  it('reads queue and assignment in parallel, denies malformed success and preserves authorization errors', async () => {
    const transport = vi.fn(async (url) =>
      Response.json(
        url.endsWith('/queue') ? { orders: [order] } : { order: null },
      ),
    );
    const read = createTeammateFetch({ csrf: 'token', fetcher: transport });
    const response = await read('/api/desk');
    expect(await response.json()).toEqual({
      queue: [toOriginalTeammateOrder(order)],
      mine: null,
    });
    expect(transport.mock.calls.map((c) => c[0])).toEqual([
      '/api/teammate/queue',
      '/api/teammate/order',
    ]);
    expect(
      (
        await createTeammateFetch({
          csrf: 'token',
          fetcher: async () => Response.json({}),
        })('/api/desk')
      ).status,
    ).toBe(503);
    expect(
      (
        await createTeammateFetch({
          csrf: 'token',
          fetcher: async () =>
            Response.json({ error: 'denied' }, { status: 403 }),
        })('/api/desk')
      ).status,
    ).toBe(403);
  });
  it('maps only authoritative privacy-safe fields without invented timestamps or payment', () => {
    expect(toOriginalTeammateOrder(order)).toEqual({
      id,
      publicReference: 'DL-42',
      status: 'queued',
      game: 'lol',
      service: 'duo',
      title: 'Duo queue',
      games: 2,
      unit: 'game',
      gg: false,
      rank: 'Gold',
      region: 'EUW',
      ign: 'Player#EUW',
      note: '',
      voice: false,
      customer: 'Customer',
      customerImage: '',
      flag: 'de',
      payout: 12.34,
      realCustomer: true,
      assignmentId: null,
    });
  });
});
