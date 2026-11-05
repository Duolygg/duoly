import { readFileSync } from 'node:fs';
import type { APIContext, APIRoute } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { favorites, orderFavorite } from '../../src/server/favorites/handlers';
import {
  CustomerFavoritesSchema,
  OrderResponseSchemas,
} from '../../src/contracts/orders';
import { EVENT_CATALOGUE } from '../../src/contracts/analytics-events';
import { rebookHref } from '../../src/components/account/Favorites.jsx';
import { toOriginalHistory } from '../../src/components/account/dashboard-data';

// Favorite teammates (migration 20261106150000_customer_favorites.sql): endpoints with a mocked
// Supabase client, the contract, the migration's access rules and the dashboard/rebook glue.
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const rpc = vi.fn();
const identity = vi.fn();
const token = 'a'.repeat(64);
const id = '00000000-0000-4000-8000-000000000001';
const handle = '00000000-0000-4000-8000-0000000000a1';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
function context(path: string, method = 'GET', body?: string, origin?: string) {
  const request = new Request('http://localhost' + path, {
    method,
    headers: {
      origin: origin ?? 'http://localhost',
      'content-type': 'application/json',
    },
    body,
  });
  return {
    request,
    url: new URL(request.url),
    params: { id },
    cookies: { get: () => ({ value: token }) },
  } as unknown as APIContext;
}
const run = async (handler: APIRoute, ctx: APIContext) =>
  (await handler(ctx)) as Response;
const post = (body: unknown, origin?: string) =>
  context(`/api/orders/${id}/favorite`, 'POST', JSON.stringify(body), origin);
const missing = {
  data: null,
  error: { code: 'PGRST202', message: 'Could not find the function' },
  status: 404,
};
const FAV = {
  handle,
  name: 'Alex Rivera',
  image: '/assets/avatars/avatar-2.png',
  country: 'de',
  game: 'lol',
  orders: 3,
  status: 'online',
};

beforeEach(() => {
  vi.resetAllMocks();
  identity.mockResolvedValue({ viewer: { role: 'customer' } });
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity,
    json,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
});

describe('GET /api/orders/:id/favorite', () => {
  const ctx = () => context(`/api/orders/${id}/favorite`);
  it('answers the heart for the teammate on that order', async () => {
    rpc.mockResolvedValue({
      data: { available: true, favorite: true },
      error: null,
    });
    const response = await run(orderFavorite, ctx());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: true, favorite: true });
    expect(rpc).toHaveBeenCalledWith('customer_order_favorite', {
      p_order: id,
    });
  });
  it('shows no heart before the migration', async () => {
    rpc.mockResolvedValue(missing);
    expect(await (await run(orderFavorite, ctx())).json()).toEqual({
      available: false,
      favorite: false,
    });
  });
  it('needs a signed-in customer and a clean request', async () => {
    identity.mockResolvedValueOnce(null);
    expect((await run(orderFavorite, ctx())).status).toBe(401);
    identity.mockResolvedValueOnce({ viewer: { role: 'teammate' } });
    expect((await run(orderFavorite, ctx())).status).toBe(403);
    expect(
      (await run(orderFavorite, context(`/api/orders/${id}/favorite?x=1`)))
        .status,
    ).toBe(400);
    expect(
      (await run(orderFavorite, context(`/api/orders/${id}/favorite`, 'PUT')))
        .status,
    ).toBe(405);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('hides backend detail on other orders and odd answers', async () => {
    rpc.mockResolvedValueOnce({
      data: { error: { code: 404, message: 'Order not found.' } },
      error: null,
    });
    expect((await run(orderFavorite, ctx())).status).toBe(404);
    rpc.mockResolvedValueOnce({
      data: { available: true, favorite: true, teammateId: id },
      error: null,
    });
    expect((await run(orderFavorite, ctx())).status).toBe(502);
  });
});

describe('POST /api/orders/:id/favorite', () => {
  it('saves the heart', async () => {
    rpc.mockResolvedValue({
      data: { available: true, favorite: false },
      error: null,
    });
    const response = await run(orderFavorite, post({ csrf: token, on: false }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: true, favorite: false });
    expect(rpc).toHaveBeenCalledWith('customer_order_favorite_set', {
      p_order: id,
      p_on: false,
    });
  });
  it('refuses a missing or wrong CSRF token, other origins and bad bodies', async () => {
    expect((await run(orderFavorite, post({ on: true }))).status).toBe(403);
    expect(
      (
        await run(
          orderFavorite,
          post({ csrf: token, on: true }, 'http://evil.test'),
        )
      ).status,
    ).toBe(403);
    expect(
      (await run(orderFavorite, post({ csrf: token, on: 'yes' }))).status,
    ).toBe(400);
    expect(
      (await run(orderFavorite, post({ csrf: token, on: true, x: 1 }))).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('passes the customer-worded refusals through, and only those', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        error: {
          code: 409,
          message: 'You can have up to 100 favorites. Remove one first.',
        },
      },
      error: null,
    });
    let response = await run(orderFavorite, post({ csrf: token, on: true }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(
      'You can have up to 100 favorites. Remove one first.',
    );
    rpc.mockResolvedValueOnce({
      data: { error: { code: 409, message: 'internal detail' } },
      error: null,
    });
    response = await run(orderFavorite, post({ csrf: token, on: true }));
    expect((await response.json()).error).toBe('Order action unavailable.');
  });
  it('says saving is unavailable before the migration', async () => {
    rpc.mockResolvedValue(missing);
    expect(
      (await run(orderFavorite, post({ csrf: token, on: true }))).status,
    ).toBe(503);
  });
});

describe('GET /api/orders/favorites', () => {
  const ctx = () => context('/api/orders/favorites');
  it('lists favorites with status, never a teammate id', async () => {
    rpc.mockResolvedValue({
      data: { favorites: [FAV] },
      error: null,
    });
    const response = await run(favorites, ctx());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      favorites: [FAV],
    });
    expect(rpc).toHaveBeenCalledWith('customer_favorites');
  });
  it('refuses extra fields from the database', async () => {
    rpc.mockResolvedValue({
      data: { favorites: [{ ...FAV, teammateId: id }] },
      error: null,
    });
    expect((await run(favorites, ctx())).status).toBe(502);
  });
  it('is empty before the migration', async () => {
    rpc.mockResolvedValue(missing);
    expect(await (await run(favorites, ctx())).json()).toEqual({
      favorites: [],
    });
  });
  it('is GET only, for customers', async () => {
    expect(
      (await run(favorites, context('/api/orders/favorites', 'POST', '{}')))
        .status,
    ).toBe(405);
    identity.mockResolvedValueOnce({ viewer: { role: 'admin' } });
    expect((await run(favorites, ctx())).status).toBe(403);
  });
});

describe('contract', () => {
  it('registers both answers and knows the three statuses', () => {
    expect(OrderResponseSchemas.orderFavorite).toBeDefined();
    expect(OrderResponseSchemas.customerFavorites).toBe(
      CustomerFavoritesSchema,
    );
    for (const status of ['online', 'busy', 'offline'])
      expect(
        CustomerFavoritesSchema.safeParse({
          favorites: [{ ...FAV, status }],
        }).success,
      ).toBe(true);
    expect(
      CustomerFavoritesSchema.safeParse({
        favorites: [{ ...FAV, status: 'away' }],
      }).success,
    ).toBe(false);
  });
  it('tracks hearts with a known event', () => {
    expect(EVENT_CATALOGUE.teammate_favorited).toEqual({
      on: 'bool',
      source: 'slug',
    });
  });
});

describe('migration', () => {
  const sql = readFileSync(
    'supabase/migrations/20261106150000_customer_favorites.sql',
    'utf8',
  );
  it('locks the table and grants only the three customer functions', () => {
    expect(sql).toContain(
      'alter table public.customer_favorites enable row level security;',
    );
    expect(sql).toMatch(
      /revoke all on table public\.customer_favorites from public, anon, authenticated, service_role;/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.customer_order_favorite\(uuid\), public\.customer_order_favorite_set\(uuid,boolean\),\s+public\.customer_favorites\(\) to authenticated;/,
    );
    expect(sql).not.toMatch(/grant [^;]*customer_favorite_order/);
  });
  it('only lets customers favorite the teammate on their own played orders', () => {
    expect(sql).toContain('where o.id = p_order and o.customer_id = p_actor');
    expect(sql).toContain("v.status not in ('in_progress', 'completed')");
    expect(sql).toContain("r.role = 'customer'");
  });
  it('sends handles, never teammate ids, and no Diamond pick', () => {
    const list = sql.slice(
      sql.indexOf('create function public.customer_favorites()'),
    );
    expect(list).toContain("'handle', x.handle");
    expect(list).not.toMatch(/'(teammate|user)_?[iI]d'/);
    expect(sql).not.toContain('canPick');
    // the latest completed, not refunded order with them
    expect(list).toContain(
      "order by (o.status = 'completed' and o.admin_refunded_at is null) desc, o.completed_at desc nulls last, o.id",
    );
  });
});

describe('dashboard and rebook', () => {
  it('rebooks on their game, with no teammate in the link', () => {
    expect(rebookHref({ game: 'val', handle })).toBe('/?rebook=val#checkout');
  });
  it('gives each teammate their latest order as the handle to heart', () => {
    const order = (oid: string, created: string) => ({
      id: oid,
      public_reference: 'DL-1',
      status: 'completed',
      game: 'lol',
      title: 'Duo',
      units: 1,
      region: 'EUW',
      rerolls: 0,
      teammate: { name: 'Alex', image: '/a.png', country: 'de' },
      review: null,
      created_at: created,
      queued_at: created,
      accepted_at: created,
      completed_at: created,
      amount_eur_cents: 500,
    });
    const history = toOriginalHistory(
      [
        order('00000000-0000-4000-8000-0000000000b1', '2026-11-01T10:00:00Z'),
        order('00000000-0000-4000-8000-0000000000b2', '2026-11-03T10:00:00Z'),
      ],
      [],
    );
    expect(history.mates).toHaveLength(1);
    expect(history.mates[0].handle).toBe(
      '00000000-0000-4000-8000-0000000000b2',
    );
  });
});

describe('queue: favorites see their customer’s orders without a delay', () => {
  const sql = readFileSync(
    'supabase/migrations/20261106150000_customer_favorites.sql',
    'utf8',
  );
  const fn = (name: string) => {
    const start = sql.indexOf(
      'create or replace function public.' + name + '(',
    );
    return sql.slice(start, sql.indexOf('end $$;', start));
  };
  it('a favorite sees it when it goes public, after the streamer and Diamond pick rules', () => {
    const visible = fn('order_visible_at');
    const streamer = visible.indexOf('order_streamer_bookings');
    const pick = visible.indexOf('order_teammate_picks');
    const fav = visible.indexOf(
      'customer_favorite_of(p_order.customer_id, p_access.user_id)',
    );
    expect(streamer).toBeGreaterThan(0);
    expect(pick).toBeGreaterThan(streamer);
    expect(fav).toBeGreaterThan(pick);
    // no priority delay, but never before the order is public (a Diamond pick window stays exclusive)
    expect(visible.slice(fav).replace(/\s+/g, ' ')).toContain(
      'then return public.order_public_queued_at(p_order); end if; return public.order_public_queued_at(p_order) + pg_catalog.make_interval(secs => public.teammate_priority_delay(',
    );
  });
  it('keeps Twitch bookings streamer-only and plus-only duo levels; skips only the Apex wait', () => {
    const tier = fn('order_tier_open_at');
    const streamer = tier.indexOf('if v_streamer is not null then');
    const plusOnly = tier.indexOf("p_access.duo_level = 'plus_only'");
    const fav = tier.indexOf(
      'customer_favorite_of(p_order.customer_id, p_access.user_id)',
    );
    expect(streamer).toBeGreaterThan(0);
    expect(plusOnly).toBeGreaterThan(streamer);
    expect(fav).toBeGreaterThan(plusOnly);
    expect(tier).toContain(
      'return case when v_streamer = p_access.user_id then p_order.queued_at end;',
    );
    expect(tier.slice(fav)).toContain("+ interval '100 seconds'");
  });
  it('keeps the helper private', () => {
    expect(sql).toContain(
      'revoke all on function public.customer_favorite_of(uuid,uuid) from public, anon, authenticated, service_role;',
    );
    expect(sql).not.toMatch(/grant [^;]*customer_favorite_of/);
  });
  it('still keeps streamer bookings out of Discord posts', () => {
    const twitch = readFileSync(
      'supabase/migrations/20261105100000_twitch_streaming.sql',
      'utf8',
    );
    expect(twitch).toMatch(
      /order_public_queued_at[\s\S]*order_streamer_bookings[\s\S]*return 'infinity'::timestamptz;/,
    );
    const posts = readFileSync(
      'supabase/migrations/20261101120000_order_moods.sql',
      'utf8',
    );
    expect(posts).toContain(
      'public.order_public_queued_at(o) <= pg_catalog.clock_timestamp()',
    );
  });
});
