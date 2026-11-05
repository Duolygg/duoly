import type { APIContext, APIRoute } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import * as orders from '../../src/server/orders/handlers';
import { perks } from '../../src/server/perks/handlers';

// Perk endpoints: auth and role checks, strict queries, schema parsing with a mocked Supabase
// client, missing RPC (before the migration) treated as "no perk", no teammate ids leaking.
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
vi.mock('../../src/server/discord/role-hooks', () => ({
  withRoleSync: (handler: APIRoute) => handler,
}));
const rpc = vi.fn();
const identity = vi.fn();
const token = 'a'.repeat(64);
const id = '00000000-0000-4000-8000-000000000001';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
function context(path: string, method = 'GET', body?: string) {
  const request = new Request('http://localhost' + path, {
    method,
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
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
const PERKS = {
  level: 'diamond',
  freeCoaching: {
    eligible: true,
    used: false,
    available: true,
    month: '2026-10',
  },
  freePro: { eligible: true },
};
const missing = {
  data: null,
  error: { code: 'PGRST202', message: 'Could not find the function' },
  status: 404,
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

describe('GET /api/orders/perks', () => {
  const ctx = () => context('/api/orders/perks');
  it('returns the parsed perks of a customer', async () => {
    rpc.mockResolvedValue({ data: PERKS, error: null });
    const response = await run(perks, ctx());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ perks: PERKS });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('customer_perks');
  });
  it('treats a missing RPC as no perks', async () => {
    rpc.mockResolvedValue(missing);
    const response = await run(perks, ctx());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ perks: null });
  });
  it('requires a signed-in customer and GET only', async () => {
    identity.mockResolvedValue(null);
    expect((await run(perks, ctx())).status).toBe(401);
    identity.mockResolvedValue({ viewer: { role: 'teammate' } });
    expect((await run(perks, ctx())).status).toBe(403);
    identity.mockResolvedValue({ viewer: { role: 'customer' } });
    expect(
      (await run(perks, context('/api/orders/perks', 'POST', '{}'))).status,
    ).toBe(405);
    expect((await run(perks, context('/api/orders/perks?x=1'))).status).toBe(
      400,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects malformed or extra keys and hides transport errors', async () => {
    rpc.mockResolvedValue({ data: { ...PERKS, secret: 1 }, error: null });
    expect((await run(perks, ctx())).status).toBe(502);
    rpc.mockResolvedValue({ data: null, error: { message: 'SQL secret' } });
    const response = await run(perks, ctx());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/SQL/);
    rpc.mockResolvedValue({
      data: { error: { code: 403, message: 'Customer role required.' } },
      error: null,
    });
    expect((await run(perks, ctx())).status).toBe(403);
  });
});

describe('POST /api/teammate/orders/[id]/pass', () => {
  const post = (body: unknown) =>
    context(`/api/teammate/orders/${id}/pass`, 'POST', JSON.stringify(body));
  it('passes the picked order as the teammate with CSRF', async () => {
    identity.mockResolvedValue({ viewer: { role: 'teammate' } });
    rpc.mockResolvedValue({ data: { passed: true }, error: null });
    const response = await run(orders.passPicked, post({ csrf: token }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ passed: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('teammate_pass_picked_order', {
      p_order_id: id,
    });
  });
  it('refuses a bad CSRF token, extra fields, GET and customers', async () => {
    identity.mockResolvedValue({ viewer: { role: 'teammate' } });
    expect(
      (await run(orders.passPicked, post({ csrf: 'b'.repeat(64) }))).status,
    ).toBe(403);
    expect(
      (await run(orders.passPicked, post({ csrf: token, x: 1 }))).status,
    ).toBe(400);
    expect(
      (await run(orders.passPicked, context(`/api/teammate/orders/${id}/pass`)))
        .status,
    ).toBe(405);
    identity.mockResolvedValue({ viewer: { role: 'customer' } });
    expect((await run(orders.passPicked, post({ csrf: token }))).status).toBe(
      404,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it('maps a not-picked order to 404', async () => {
    identity.mockResolvedValue({ viewer: { role: 'teammate' } });
    rpc.mockResolvedValue({
      data: { error: { code: 404, message: 'Order not found.' } },
      error: null,
    });
    expect((await run(orders.passPicked, post({ csrf: token }))).status).toBe(
      404,
    );
  });
});

describe('perk keys pass through existing endpoints', () => {
  const order = {
    id,
    public_reference: 'DL-1001',
    status: 'queued',
    game: 'lol',
    service: 'vod',
    title: 'VOD Review',
    units: 1,
    unit: 'hour',
    gg: false,
    rank: '',
    region: 'EUW',
    ign: 'Me#EUW',
    note: '',
    voice: false,
  };
  const customerFields = {
    amount_eur_cents: 1299,
    created_at: '2026-10-28T10:00:00Z',
    queued_at: '2026-10-28T10:00:00Z',
    accepted_at: null,
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    rerolls: 0,
    current_assignment_id: null,
  };
  it('teammate queue keeps picked_for_you', async () => {
    identity.mockResolvedValue({ viewer: { role: 'teammate' } });
    const row = {
      ...order,
      current_assignment_id: null,
      customer_name: 'Player',
      customer_image: '',
      customer_country: '',
      payout_usd_cents: 840,
      picked_for_you: true,
    };
    rpc.mockResolvedValue({ data: { orders: [row] }, error: null });
    const response = await run(orders.queue, context('/api/teammate/queue'));
    expect(response.status).toBe(200);
    expect((await response.json()).orders[0].picked_for_you).toBe(true);
  });
  it('customer order keeps free_perk', async () => {
    rpc.mockResolvedValue({
      data: {
        order: {
          ...order,
          ...customerFields,
          teammate: null,
          review: null,
          free_perk: true,
        },
      },
      error: null,
    });
    const response = await run(orders.active, context('/api/orders/active'));
    expect(response.status).toBe(200);
    expect((await response.json()).order.free_perk).toBe(true);
  });
  it('rewards accept perks', async () => {
    const level = {
      index: 4,
      id: 'diamond',
      name: 'Diamond',
      from: 1000,
      cashback: 7,
      giftEurCents: 10000,
    };
    rpc.mockResolvedValue({
      data: {
        orders: 1000,
        level,
        next: null,
        remaining: 0,
        percent: 100,
        cashback: {
          earnedEurCents: 0,
          monthEurCents: 0,
          pendingEurCents: 0,
          pendingOrders: 0,
        },
        gifts: [],
        cashbackOrders: [],
        perks: PERKS,
      },
      error: null,
    });
    const response = await run(orders.rewards, context('/api/orders/rewards'));
    expect(response.status).toBe(200);
    expect((await response.json()).perks).toEqual(PERKS);
  });
});
