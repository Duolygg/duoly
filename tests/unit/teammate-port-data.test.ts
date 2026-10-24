import { describe, it, expect, vi } from 'vitest';
import {
  createTeammateFetch,
  newEligibleOrders,
  toOriginalPresence,
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
  it('maps presence timestamps and forced-offline details without inventing state', () => {
    expect(
      toOriginalPresence({
        online: true,
        online_since: '2026-10-24T12:00:00.000Z',
        forced_offline: null,
      }),
    ).toEqual({
      online: true,
      onlineSince: 1792843200000,
      forcedOffline: null,
    });
    expect(
      toOriginalPresence({
        online: false,
        online_since: null,
        forced_offline: { reason: 'AFK / dashboard left open', by: 'Admin' },
      }),
    ).toEqual({
      online: false,
      onlineSince: null,
      forcedOffline: { reason: 'AFK / dashboard left open', by: 'Admin' },
    });
  });
  it('rings only for newly appearing orders the teammate can take', () => {
    const regular = { games: ['lol'], gg: false };
    const gg = { games: [], gg: true };
    const orders = [
      { ...toOriginalTeammateOrder(order), id },
      {
        ...toOriginalTeammateOrder(order),
        id: '33333333-3333-4333-8333-333333333333',
        game: 'val',
      },
      {
        ...toOriginalTeammateOrder(order),
        id: '44444444-4444-4444-8444-444444444444',
        game: 'val',
        gg: true,
      },
    ];
    expect(
      newEligibleOrders([id], orders, regular).map((o: { id: string }) => o.id),
    ).toEqual([]);
    expect(
      newEligibleOrders([], orders, regular).map((o: { id: string }) => o.id),
    ).toEqual([id]);
    expect(
      newEligibleOrders([], orders, gg).map((o: { id: string }) => o.id),
    ).toEqual(['44444444-4444-4444-8444-444444444444']);
    expect(newEligibleOrders(null, orders, regular)).toEqual([]);
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
