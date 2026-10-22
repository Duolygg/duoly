import type { APIContext, APIRoute } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import * as handlers from '../../src/server/orders/handlers';

vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const rpc = vi.fn();
const identity = vi.fn();
const token = 'a'.repeat(64);
const id = '00000000-0000-4000-8000-000000000001';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
      'Set-Cookie': 'refreshed=yes',
    },
  });
function context(
  path = '/api/orders/active',
  method = 'GET',
  body?: string,
  origin = 'http://localhost',
) {
  const request = new Request('http://localhost' + path, {
    method,
    headers: { origin, 'content-type': 'application/json' },
    body,
  });
  return {
    request,
    url: new URL(request.url),
    params: { id },
    cookies: { get: () => ({ value: token }) },
  } as unknown as APIContext;
}
async function run(handler: APIRoute, ctx = context()) {
  return (await handler(ctx)) as Response;
}
beforeEach(() => {
  vi.resetAllMocks();
  identity.mockResolvedValue(null);
  rpc.mockResolvedValue({ data: { order: null }, error: null });
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity,
    json,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
});
it('reads active orders using only the scoped RPC and rejects wrong roles', async () => {
  identity.mockResolvedValue({ viewer: { role: 'customer' } });
  expect((await run(handlers.active)).status).toBe(200);
  expect(rpc).toHaveBeenCalledExactlyOnceWith('customer_active_order');
  rpc.mockClear();
  identity.mockResolvedValue({ viewer: { role: 'admin' } });
  expect((await run(handlers.active)).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
it.each(['?actor=x', '?limit=1', '?limit=1&limit=2'])(
  'rejects active query %s',
  async (query) => {
    identity.mockResolvedValue({ viewer: { role: 'customer' } });
    expect(
      (await run(handlers.active, context('/api/orders/active' + query)))
        .status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  },
);
it.each(['identity', 'rpc', 'transport', 'privacy'])(
  'sanitizes %s failure',
  async (failure) => {
    identity.mockResolvedValue({ viewer: { role: 'customer' } });
    if (failure === 'identity')
      identity.mockRejectedValue(new Error('SQL secret'));
    if (failure === 'rpc') rpc.mockRejectedValue(new Error('SQL secret'));
    if (failure === 'transport')
      rpc.mockResolvedValue({ data: null, error: { message: 'SQL secret' } });
    if (failure === 'privacy')
      rpc.mockResolvedValue({
        data: { order: null, customer_id: id },
        error: null,
      });
    const response = await run(handlers.active);
    expect(response.status).toBe(failure === 'privacy' ? 502 : 503);
    expect(await response.text()).not.toMatch(/SQL|secret|customer_id/);
  },
);
it('rejects unsupported methods without RPC', async () => {
  const response = await run(
    handlers.active,
    context('/api/orders/active', 'POST', '{}'),
  );
  expect(response.status).toBe(405);
  expect(response.headers.get('allow')).toBe('GET');
  expect(rpc).not.toHaveBeenCalled();
});
it.each([
  ['history', 'customer_order_history', 'orders'],
  ['credits', 'customer_refund_credits', 'credits'],
] as const)(
  'reads paginated %s with bounded defaults and explicit args',
  async (name, procedure, key) => {
    identity.mockResolvedValue({ viewer: { role: 'customer' } });
    rpc.mockResolvedValue({ data: { [key]: [] }, error: null });
    expect((await run(handlers[name])).status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith(procedure, {
      p_limit: 50,
      p_offset: 0,
    });
    expect(
      (await run(handlers[name], context('/?limit=100&offset=100000'))).status,
    ).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith(procedure, {
      p_limit: 100,
      p_offset: 100000,
    });
  },
);
it.each([
  'limit=0',
  'limit=101',
  'offset=-1',
  'offset=100001',
  'limit=1.5',
  'limit=1e1',
  'limit=',
  'limit=Infinity',
  'limit=1&limit=2',
  'offset=0&offset=1',
  'actor=x',
  'offset=%20',
  'limit=%2B1',
])('rejects pagination %s', async (query) => {
  identity.mockResolvedValue({ viewer: { role: 'customer' } });
  expect((await run(handlers.history, context('/?' + query))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it.each(['queue', 'assignment'] as const)(
  'hides teammate %s from every nonteammate',
  async (name) => {
    for (const role of [null, 'customer', 'admin', 'owner']) {
      identity.mockResolvedValue(role ? { viewer: { role } } : null);
      expect((await run(handlers[name])).status).toBe(role ? 404 : 401);
    }
    expect(rpc).not.toHaveBeenCalled();
    identity.mockResolvedValue({ viewer: { role: 'teammate' } });
    rpc.mockResolvedValue({
      data: name === 'queue' ? { orders: [] } : { order: null },
      error: null,
    });
    expect((await run(handlers[name])).status).toBe(200);
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      name === 'queue' ? 'teammate_order_queue' : 'teammate_current_assignment',
    );
  },
);
it('validates path UUID and uses customer detail response kind', async () => {
  identity.mockResolvedValue({ viewer: { role: 'customer' } });
  const ctx = context();
  ctx.params.id = 'bad';
  expect((await run(handlers.detail, ctx)).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
  expect((await run(handlers.detail)).status).toBe(502); // null is only valid for active reads
  expect(rpc).toHaveBeenCalledExactlyOnceWith('customer_order', {
    p_order_id: id,
  });
});
it.each(['cancel', 'reroll', 'accept'] as const)(
  'guards %s mutations with real body/CSRF helper and fresh identity',
  async (name) => {
    const handler = handlers[name];
    const role = name === 'accept' ? 'teammate' : 'customer';
    identity.mockResolvedValue({ viewer: { role } });
    for (const [body, origin, status] of [
      ['{}', 'http://localhost', 403],
      [JSON.stringify({ csrf: token }), 'http://evil.test', 403],
      ['{', 'http://localhost', 400],
      [
        JSON.stringify({ csrf: token, note: 'x'.repeat(4096) }),
        'http://localhost',
        400,
      ],
      ...[
        'actor',
        'order_id',
        'p_order_id',
        'bypass',
        'price',
        'role',
        'p_limit',
      ].map((key): [string, string, number] => [
        JSON.stringify({ csrf: token, [key]: id }),
        'http://localhost',
        400,
      ]),
    ] as const) {
      expect(
        (await run(handler, context('/api/orders/' + id, 'POST', body, origin)))
          .status,
      ).toBe(status);
    }
    expect(rpc).not.toHaveBeenCalled();
    const valid = () =>
      context('/api/orders/' + id, 'POST', JSON.stringify({ csrf: token }));
    identity.mockResolvedValue(null);
    expect((await run(handler, valid())).status).toBe(401);
    identity.mockResolvedValue({ viewer: { role: 'admin' } });
    expect((await run(handler, valid())).status).toBe(
      name === 'accept' ? 404 : 403,
    );
    expect(rpc).not.toHaveBeenCalled();
    identity.mockResolvedValue({ viewer: { role } });
    const badId = valid();
    badId.params.id = 'invalid';
    expect((await run(handler, badId)).status).toBe(400);
    const badQuery = valid();
    badQuery.url.search = '?bypass=true';
    expect((await run(handler, badQuery)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({
      data: { error: { code: 409, message: 'secret SQL' } },
      error: null,
    });
    const response = await run(handler, valid());
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain('secret');
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      name === 'accept'
        ? 'accept_order'
        : name === 'cancel'
          ? 'cancel_queued_order'
          : 'reroll_order',
      { p_order_id: id },
    );
    rpc.mockResolvedValue({ data: { order: null }, error: null });
    expect((await run(handler, valid())).status).toBe(502);
    expect((await run(handler)).status).toBe(405);
  },
);
const selection = {
  id,
  public_reference: 'DL-1',
  status: 'queued',
  game: 'lol',
  service: 'duo',
  title: 'Duo',
  units: 1,
  unit: 'game',
  gg: false,
  rank: '',
  region: 'EUW',
  ign: 'Player',
  note: '',
  voice: false,
  current_assignment_id: null,
};
const customer = {
  ...selection,
  amount_eur_cents: 599,
  created_at: '2026-10-22T09:30:00Z',
  queued_at: '2026-10-22T09:30:00Z',
  accepted_at: null,
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 0,
  teammate: null,
};
const teammate = {
  ...selection,
  customer_name: 'Player',
  customer_image: '',
  customer_country: '',
  payout_usd_cents: 399,
};
it.each([
  'active',
  'history',
  'credits',
  'detail',
  'queue',
  'assignment',
  'cancel',
  'reroll',
  'accept',
] as const)(
  '%s requires fresh identity and rejects unsupported methods',
  async (name) => {
    const post = ['cancel', 'reroll', 'accept'].includes(name);
    const ctx = () =>
      post ? context('/', 'POST', JSON.stringify({ csrf: token })) : context();
    expect((await run(handlers[name], ctx())).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    identity.mockResolvedValue({
      viewer: {
        role:
          name === 'queue' || name === 'assignment' || name === 'accept'
            ? 'customer'
            : 'teammate',
      },
    });
    expect((await run(handlers[name], ctx())).status).toBe(
      ['queue', 'assignment', 'accept'].includes(name) ? 404 : 403,
    );
    expect(rpc).not.toHaveBeenCalled();
    expect((await run(handlers[name], context('/', 'DELETE'))).status).toBe(
      405,
    );
  },
);
it.each([
  'active',
  'history',
  'detail',
  'queue',
  'assignment',
  'cancel',
  'reroll',
  'accept',
] as const)('%s accepts only its privacy-safe success DTO', async (name) => {
  const isTeammate = ['queue', 'assignment', 'accept'].includes(name);
  const order = isTeammate ? teammate : customer;
  const payload =
    name === 'queue' || name === 'history' ? { orders: [order] } : { order };
  const post = ['cancel', 'reroll', 'accept'].includes(name);
  const ctx = () =>
    post ? context('/', 'POST', JSON.stringify({ csrf: token })) : context();
  identity.mockResolvedValue({
    viewer: { role: isTeammate ? 'teammate' : 'customer' },
  });
  rpc.mockResolvedValue({ data: payload, error: null });
  const response = await run(handlers[name], ctx());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(payload);
  const leaked = { ...order, customer_id: id, priority: 10 };
  rpc.mockResolvedValue({
    data:
      name === 'queue' || name === 'history'
        ? { orders: [leaked] }
        : { order: leaked },
    error: null,
  });
  const rejected = await run(handlers[name], ctx());
  expect(rejected.status).toBe(502);
  expect(await rejected.text()).not.toMatch(/customer_id|priority/);
});
it('accepts form CSRF and rejects duplicate form fields using real helpers', async () => {
  identity.mockResolvedValue({ viewer: { role: 'customer' } });
  rpc.mockResolvedValue({ data: { order: customer }, error: null });
  const form = (body: string) => {
    const ctx = context('/', 'POST', body);
    ctx.request.headers.set(
      'content-type',
      'application/x-www-form-urlencoded',
    );
    return ctx;
  };
  expect((await run(handlers.cancel, form('csrf=' + token))).status).toBe(200);
  rpc.mockClear();
  expect(
    (await run(handlers.cancel, form('csrf=' + token + '&csrf=' + token)))
      .status,
  ).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it('denies anonymous active reads without reaching RPC and preserves account headers', async () => {
  const response = await run(handlers.active);
  expect(response.status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('set-cookie')).toBe('refreshed=yes');
});
