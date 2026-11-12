import type { APIContext } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { complete, earnings } from '../../src/server/completion/handlers';
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const id = '00000000-0000-4000-8000-000000000001';
const assignment = '00000000-0000-4000-8000-000000000002';
const proof = '00000000-0000-4000-8000-000000000003';
const requestId = '00000000-0000-4000-8000-000000000004';
const csrf = 'a'.repeat(64);
const input = {
  csrf,
  assignment_id: assignment,
  proof_ids: [proof],
  request_id: requestId,
};
export const completion = {
  order_id: id,
  assignment_id: assignment,
  request_id: requestId,
  proof_ids: [proof],
  completed_at: '2026-10-23T12:00:00Z',
  payout_usd_cents: 1005,
  deposit_percent: 10,
  held_usd_cents: 101,
  net_usd_cents: 904,
  trust_tier: 'rookie',
};
const rpc = vi.fn();
const identity = vi.fn();
function context(
  body: unknown = input,
  method = 'POST',
  origin = 'http://localhost',
) {
  const request = new Request(
    `http://localhost/api/teammate/orders/${id}/complete`,
    {
      method,
      headers: { origin, 'content-type': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    },
  );
  return {
    request,
    url: new URL(request.url),
    params: { id },
    cookies: { get: () => ({ value: csrf }) },
  } as unknown as APIContext;
}
beforeEach(() => {
  vi.resetAllMocks();
  identity.mockResolvedValue({ viewer: { role: 'teammate' } });
  rpc.mockResolvedValue({ data: { completion }, error: null });
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
    json: (body: unknown, status = 200) =>
      Response.json(body, {
        status,
        headers: { 'Cache-Control': 'private, no-store' },
      }),
  } as unknown as ReturnType<typeof accountContext>);
});
it('completes with server-derived money and a strict assignment-bound receipt', async () => {
  const response = (await complete(context())) as Response;
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ completion });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(rpc).toHaveBeenCalledExactlyOnceWith('complete_order', {
    p_order_id: id,
    p_assignment_id: assignment,
    p_proof_ids: [proof],
    p_request_id: requestId,
  });
});
it('reads own private earning history through a user-scoped RPC', async () => {
  rpc.mockResolvedValue({ data: { earnings: [completion] }, error: null });
  const response = (await earnings(context(null, 'GET'))) as Response;
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ earnings: [completion] });
  expect(rpc).toHaveBeenCalledExactlyOnceWith('teammate_earnings', {
    p_limit: 20,
    p_offset: 0,
  });
});
it.each([null, 'customer', 'admin'])(
  'rejects %s completion before invoking SQL',
  async (role) => {
    identity.mockResolvedValue(role ? { viewer: { role } } : null);
    expect(((await complete(context())) as Response).status).toBe(
      role ? 403 : 401,
    );
    expect(rpc).not.toHaveBeenCalled();
  },
);
it.each([
  { ...input, proof_ids: [] },
  { ...input, proof_ids: Array(6).fill(proof) },
  { ...input, proof_ids: [proof, proof] },
  { ...input, payout_usd_cents: 1 },
  { ...input, order_id: id },
  { ...input, assignment_id: '../bad' },
  { ...input, request_id: 'bad' },
])('rejects malformed or caller-owned financial fields', async (body) => {
  expect(((await complete(context(body))) as Response).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it('guards method, bounded body, CSRF, origin and query parameters', async () => {
  const get = (await complete(context(null, 'GET'))) as Response;
  expect(get.status).toBe(405);
  expect(get.headers.get('allow')).toBe('POST');
  expect(
    ((await complete(context({ ...input, csrf: 'wrong' }))) as Response).status,
  ).toBe(403);
  expect(
    (
      (await complete(
        context(input, 'POST', 'https://evil.invalid'),
      )) as Response
    ).status,
  ).toBe(403);
  expect(
    (
      (await complete(
        context({ ...input, extra: 'x'.repeat(4096) }),
      )) as Response
    ).status,
  ).toBe(400);
  const query = context();
  query.url.search = '?actor=other';
  expect(((await complete(query)) as Response).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it.each([400, 401, 403, 404, 409, 410])(
  'maps safe SQL failure %s and hides internals',
  async (status) => {
    rpc.mockResolvedValue({
      data: { error: { code: status, message: 'private database details' } },
      error: null,
    });
    let response = (await complete(context())) as Response;
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain('private database');
    rpc.mockResolvedValue({
      data: null,
      error: { code: `PT${status}`, message: 'secret' },
    });
    response = (await complete(context())) as Response;
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain('secret');
  },
);
it.each([
  'Captured settled payment required.',
  'Fill in the match report first: every game with both IGNs and the match link, plus your wins and losses.',
])('names complete_order’s own conflict: %s', async (message) => {
  rpc.mockResolvedValue({
    data: { error: { code: 409, message } },
    error: null,
  });
  const response = (await complete(context())) as Response;
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: message });
});
it.each([
  { ...completion, order_id: proof },
  { ...completion, assignment_id: proof },
  { ...completion, request_id: proof },
  { ...completion, proof_ids: [assignment] },
  { ...completion, proof_ids: [proof, proof] },
  { ...completion, net_usd_cents: 1 },
  { ...completion, storage_key: 'secret' },
])('never confirms a mismatched or invalid receipt', async (result) => {
  rpc.mockResolvedValue({ data: { completion: result }, error: null });
  expect(((await complete(context())) as Response).status).toBe(503);
});
it('sanitizes unexpected SQL and network failures', async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { code: '42501', message: 'private table' },
  });
  expect(((await complete(context())) as Response).status).toBe(503);
  rpc.mockRejectedValue(new Error('private credentials'));
  const response = (await complete(context())) as Response;
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private');
});
it.each([null, 'customer', 'admin'])(
  'rejects %s earning reads',
  async (role) => {
    identity.mockResolvedValue(role ? { viewer: { role } } : null);
    expect(((await earnings(context(null, 'GET'))) as Response).status).toBe(
      role ? 403 : 401,
    );
    expect(rpc).not.toHaveBeenCalled();
  },
);
it.each([
  '?actor_id=other',
  '?limit=0',
  '?limit=101',
  '?limit=2&limit=3',
  '?limit=1.5',
  '?offset=-1',
  '?offset=100001',
])('rejects malformed earnings pagination %s', async (query) => {
  const ctx = context(null, 'GET');
  ctx.url.search = query;
  expect(((await earnings(ctx)) as Response).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it('binds the public entry routes and guards earnings method and upstream failures', async () => {
  const command =
    await import('../../src/pages/api/teammate/orders/[id]/complete');
  const history = await import('../../src/pages/api/teammate/earnings');
  expect(command.prerender).toBe(false);
  expect(history.prerender).toBe(false);
  expect(command.ALL).toBe(complete);
  expect(history.ALL).toBe(earnings);
  const method = (await earnings(context())) as Response;
  expect(method.status).toBe(405);
  expect(method.headers.get('allow')).toBe('GET');
  rpc.mockResolvedValue({
    data: { earnings: [completion, completion] },
    error: null,
  });
  expect(((await earnings(context(null, 'GET'))) as Response).status).toBe(503);
  rpc.mockResolvedValue({
    data: { error: { code: 403, message: 'internal role details' } },
    error: null,
  });
  const denied = (await earnings(context(null, 'GET'))) as Response;
  expect(denied.status).toBe(403);
  expect(await denied.text()).not.toContain('internal');
  rpc.mockRejectedValue(new Error('secret'));
  expect(((await earnings(context(null, 'GET'))) as Response).status).toBe(503);
});
