import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ mutation: vi.fn(), rpc: vi.fn() }));
vi.mock('../../src/server/auth/handlers', () => ({ mutation: mocks.mutation }));
vi.mock('../../src/server/orders/status-storage', () => ({
  statusRpc: () => mocks.rpc,
}));
import { aiStatusToken } from '../../src/server/orders/status-api';
const owner = '00000000-0000-4000-8000-000000000001';
const order = '00000000-0000-4000-8000-000000000002';
const context = (method = 'POST') =>
  ({
    request: new Request(
      'https://duoly.gg/api/orders/' + order + '/ai-status-token',
      { method },
    ),
    params: { id: order },
  }) as unknown as Parameters<typeof aiStatusToken>[0];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutation.mockResolvedValue({
    failure: null,
    body: { csrf: 'verified' },
    account: {
      identity: async () => ({ viewer: { id: owner, role: 'customer' } }),
      json: (body: unknown, status = 200) =>
        Response.json(body, {
          status,
          headers: { 'Cache-Control': 'no-store' },
        }),
    },
  });
});
describe('owner-only AI status capability API', () => {
  it('issues a code once using only verified session ownership and stores only its hash', async () => {
    mocks.rpc.mockResolvedValue({
      data: { expiresAt: '2026-11-14T10:00:00Z' },
      error: null,
    });
    const r = await aiStatusToken(context());
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.token).toMatch(/^dos_[A-Za-z0-9_-]{43}$/);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.rpc).toHaveBeenCalledWith('issue_order_status_token', {
      p_order_id: order,
      p_customer_id: owner,
      p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(body.token);
  });
  it.each(['POST', 'DELETE'])(
    'returns 404 for other customers / missing orders on %s',
    async (method) => {
      mocks.rpc.mockResolvedValue({
        data: { error: 'not_found' },
        error: null,
      });
      expect((await aiStatusToken(context(method))).status).toBe(404);
    },
  );
  it('propagates Origin/CSRF rejection without calling storage', async () => {
    mocks.mutation.mockResolvedValue({
      failure: new Response(null, { status: 403 }),
    });
    expect((await aiStatusToken(context())).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects caller-supplied ownership', async () => {
    const prepared = await mocks.mutation();
    prepared.body.customer_id = 'other';
    expect((await aiStatusToken(context())).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('revokes by order and session, without accepting a bearer code', async () => {
    mocks.rpc.mockResolvedValue({ data: { revoked: true }, error: null });
    expect((await aiStatusToken(context('DELETE'))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('revoke_order_status_token', {
      p_order_id: order,
      p_customer_id: owner,
    });
  });
});
