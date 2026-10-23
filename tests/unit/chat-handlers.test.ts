import type { APIContext, APIRoute } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import * as handlers from '../../src/server/chat/handlers';
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const order = '11111111-1111-4111-8111-111111111111',
  assignment = '22222222-2222-4222-8222-222222222222',
  request = '33333333-3333-4333-8333-333333333333',
  user = '55555555-5555-4555-8555-555555555555',
  csrf = 'a'.repeat(64);
const room = {
  order_id: order,
  assignment_id: assignment,
  viewer: 'customer',
  writable: true,
  participant: { role: 'teammate', name: 'Kairo', image: '' },
  messages: [],
  typing: [],
  archives: [],
};
const body = {
  assignment_id: assignment,
  request_id: request,
  body: 'Hello 🎮',
};
const message = {
  id: '44444444-4444-4444-8444-444444444444',
  sequence: 1,
  kind: 'user',
  sender: 'customer',
  name: 'Sam',
  image: '',
  body: body.body,
  created_at: '2026-10-23T08:00:00Z',
  request_id: request,
};
const sent = {
  order_id: order,
  assignment_id: assignment,
  request_id: request,
  outcome: 'sent',
  message,
  note: null,
};
const rpc = vi.fn(),
  identity = vi.fn(),
  getSession = vi.fn();
const jwt = (role = 'authenticated', sub = user) =>
  'eyJhbGciOiJIUzI1NiJ9.' +
  Buffer.from(
    JSON.stringify({ role, sub, exp: Math.floor(Date.now() / 1000) + 1800 }),
  ).toString('base64url') +
  '.signature';
function ctx(
  method = 'GET',
  payload: unknown = body,
  query = '',
  headers: Record<string, string> = {},
) {
  const req = new Request(
    'http://localhost/api/orders/' + order + '/chat' + query,
    {
      method,
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
        'x-csrf-token': csrf,
        ...headers,
      },
      ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}),
    },
  );
  return {
    request: req,
    url: new URL(req.url),
    params: { id: order },
    cookies: { get: () => ({ value: csrf }) },
  } as unknown as APIContext;
}
const run = async (handler: APIRoute, context = ctx()) =>
  (await handler(context)) as Response;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ORDER_CHAT_ENABLED', 'true');
  identity.mockResolvedValue({ viewer: { id: user, role: 'customer' } });
  rpc.mockResolvedValue({ data: room, error: null });
  getSession.mockResolvedValue({
    data: {
      session: {
        user: { id: user },
        access_token: jwt(),
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      },
    },
    error: null,
  });
  vi.mocked(accountContext).mockReturnValue({
    identity,
    client: { rpc, auth: { getSession } },
    config: {
      origin: 'http://localhost',
      url: 'https://test.supabase.co',
      publishableKey: 'sb_publishable_test',
    },
    names: { csrf: 'csrf' },
    json: (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          'Cache-Control': 'private, no-store',
          'Referrer-Policy': 'no-referrer',
        },
      }),
  } as unknown as ReturnType<typeof accountContext>);
});
it('reads only via caller-scoped RPC and validates exact room binding', async () => {
  const res = await run(handlers.read);
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toContain('no-store');
  expect(rpc).toHaveBeenCalledExactlyOnceWith('get_order_chat', {
    p_order_id: order,
    p_assignment_id: undefined,
  });
  rpc.mockResolvedValue({
    data: { ...room, order_id: assignment },
    error: null,
  });
  expect((await run(handlers.read)).status).toBe(503);
});
it('returns anonymous reads as 404 and writes as 401 without an RPC', async () => {
  identity.mockResolvedValue(null);
  expect((await run(handlers.read)).status).toBe(404);
  expect((await run(handlers.send, ctx('POST'))).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it('rejects duplicate/unexpected queries, malformed ids and forged sender fields', async () => {
  expect(
    (
      await run(
        handlers.read,
        ctx(
          'GET',
          null,
          '?assignment_id=' + assignment + '&assignment_id=' + assignment,
        ),
      )
    ).status,
  ).toBe(400);
  expect((await run(handlers.read, ctx('GET', null, '?other=1'))).status).toBe(
    400,
  );
  expect(
    (await run(handlers.send, ctx('POST', { ...body, sender: 'admin' })))
      .status,
  ).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it('requires same origin and matching CSRF before write RPC', async () => {
  for (const headers of [
    { origin: 'https://attacker.test' },
    { 'x-csrf-token': 'bad' },
  ] as Record<string, string>[])
    expect(
      (await run(handlers.send, ctx('POST', body, '', headers))).status,
    ).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
it('sends only authoritative fields and validates acknowledgement binding', async () => {
  rpc.mockResolvedValue({ data: sent, error: null });
  expect((await run(handlers.send, ctx('POST'))).status).toBe(200);
  expect(rpc).toHaveBeenCalledExactlyOnceWith('send_order_chat_message', {
    p_order_id: order,
    p_assignment_id: assignment,
    p_request_id: request,
    p_body: body.body,
  });
  rpc.mockResolvedValue({
    data: { ...sent, request_id: assignment },
    error: null,
  });
  expect((await run(handlers.send, ctx('POST'))).status).toBe(503);
});
it('preserves known database denial/rate codes without exposing diagnostics', async () => {
  for (const [code, status] of [
    ['PT404', 404],
    ['PT403', 403],
    ['PT409', 409],
    ['PT429', 429],
    ['XX000', 503],
  ] as const) {
    rpc.mockResolvedValue({
      data: null,
      error: { code, message: 'private database internals' },
    });
    const res = await run(handlers.send, ctx('POST'));
    expect(res.status).toBe(status);
    expect(await res.text()).not.toContain('private database');
  }
});
it('maps native SQL error envelopes without reflecting database text', async () => {
  for (const status of [403, 404, 409, 429]) {
    rpc.mockResolvedValue({
      data: { error: { code: status, message: 'private database internals' } },
      error: null,
    });
    const res = await run(handlers.send, ctx('POST'));
    expect(res.status).toBe(status);
    expect(await res.text()).not.toContain('private database');
  }
});
it('keeps realtime credentials in no-store JSON only after room and user authorization', async () => {
  const res = await run(handlers.realtime);
  expect(res.status).toBe(200);
  expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  const data = await res.json();
  expect(data.topic).toBe('order-chat:' + assignment);
  expect(data.access_token).toBe(jwt());
  expect(data.refresh_token).toBeUndefined();
  expect(getSession).toHaveBeenCalledOnce();
});
it('never exposes service, anonymous, cross-user or expired realtime credentials', async () => {
  for (const token of [
    jwt('service_role'),
    jwt('anon'),
    jwt('authenticated', assignment),
    'not-a-jwt',
  ]) {
    getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: user },
          access_token: token,
          expires_at: Math.floor(Date.now() / 1000) + 100,
        },
      },
      error: null,
    });
    const res = await run(handlers.realtime);
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain(token);
  }
  getSession.mockResolvedValue({
    data: {
      session: { user: { id: user }, access_token: jwt(), expires_at: 1 },
    },
    error: null,
  });
  expect((await run(handlers.realtime)).status).toBe(503);
});
it('denies admin moderation to customer without a database call', async () => {
  expect((await run(handlers.flags)).status).toBe(404);
  expect(rpc).not.toHaveBeenCalled();
});
it('gates unactivated chat and rejects methods with Allow', async () => {
  expect((await run(handlers.read, ctx('POST'))).status).toBe(405);
  vi.stubEnv('ORDER_CHAT_ENABLED', 'false');
  expect((await run(handlers.read)).status).toBe(503);
  expect(rpc).not.toHaveBeenCalled();
});
