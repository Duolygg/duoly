import type { APIContext } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { customers } from '../../src/server/admin/handlers';

vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const rpc = vi.fn();
const identity = vi.fn();
const csrf = 'a'.repeat(64);
const userId = '00000000-0000-4000-8000-000000000001';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
function context(body: Record<string, unknown>) {
  const request = new Request('http://localhost/api/admin/customers', {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: JSON.stringify({ csrf, ...body }),
  });
  return {
    request,
    url: new URL(request.url),
    cookies: { get: () => ({ value: csrf }) },
  } as unknown as APIContext;
}
beforeEach(() => {
  vi.resetAllMocks();
  identity.mockResolvedValue({ viewer: { role: 'admin' } });
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity,
    json,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
});

it('sends a validated integer-cent wallet adjustment to the admin RPC', async () => {
  const response = (await customers(
    context({
      action: 'adjustWallet',
      userId,
      amountCents: -500,
      reason: 'Remove abuse credit',
    }),
  )) as Response;
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledExactlyOnceWith('admin_wallet_adjust', {
    p_user_id: userId,
    p_amount_eur_cents: -500,
    p_reason: 'Remove abuse credit',
  });
});

it('rejects malformed wallet adjustments before the RPC', async () => {
  const response = (await customers(
    context({ action: 'adjustWallet', userId, amountCents: 0, reason: '' }),
  )) as Response;
  expect(response.status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
