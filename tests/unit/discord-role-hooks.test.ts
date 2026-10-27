import type { APIContext, APIRoute } from 'astro';
import { beforeEach, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import {
  roleSyncConfig,
  syncDiscordRoles,
} from '../../src/server/discord/role-sync';
import * as orders from '../../src/server/orders/handlers';
import { complete } from '../../src/server/completion/handlers';
import { claim } from '../../src/server/orders/claim';
import * as admin from '../../src/server/admin/handlers';
import {
  adminPresence,
  adminPresenceChanged,
  teammatePresence,
} from '../../src/server/presence/handlers';

vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
vi.mock('../../src/server/payments/webhook', () => ({
  settleSoon: vi.fn(async () => undefined),
}));
vi.mock('../../src/server/discord/role-sync', () => ({
  roleSyncConfig: vi.fn(),
  syncDiscordRoles: vi.fn(),
}));

const csrf = 'a'.repeat(64);
const order = '00000000-0000-4000-8000-0000000000aa';
const viewerId = '00000000-0000-4000-8000-0000000000bb';
const target = '00000000-0000-4000-8000-0000000000cc';
const rpc = vi.fn();
const identity = vi.fn();
const sync = vi.mocked(syncDiscordRoles);

function context(
  path: string,
  body: Record<string, unknown> = {},
  params: Record<string, string> = { id: order },
) {
  const request = new Request('http://localhost' + path, {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: JSON.stringify({ csrf, ...body }),
  });
  return {
    request,
    url: new URL(request.url),
    params,
    cookies: { get: () => ({ value: csrf }) },
  } as unknown as APIContext;
}
const run = async (handler: APIRoute, ctx: APIContext) =>
  (await handler(ctx)) as Response;
const as = (role: string) =>
  identity.mockResolvedValue({ viewer: { id: viewerId, role } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(roleSyncConfig).mockReturnValue({
    token: 't',
    guildId: '100000000000000001',
    supabaseUrl: 'https://example.supabase.co',
    supabaseSecretKey: 'k',
  });
  sync.mockResolvedValue({
    enabled: true,
    ready: true,
    checked: 0,
    changed: 0,
    failed: 0,
    deferred: 0,
  });
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
    json: (body: unknown, status = 200) => Response.json(body, { status }),
  } as unknown as ReturnType<typeof accountContext>);
});

const selection = {
  id: order,
  public_reference: 'DL-1',
  status: 'in_progress',
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
const teammateOrder = {
  ...selection,
  customer_name: 'Player',
  customer_image: '',
  customer_country: '',
  payout_usd_cents: 399,
};
const customerOrder = {
  ...selection,
  status: 'queued',
  amount_eur_cents: 599,
  created_at: '2026-10-22T09:30:00Z',
  queued_at: '2026-10-22T09:30:00Z',
  accepted_at: null,
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 1,
  teammate: null,
  review: null,
};

it('syncs the order teammates after accept and reroll succeed, never after a refusal', async () => {
  as('teammate');
  rpc.mockResolvedValue({
    data: { error: { code: 409, message: 'Taken.' } },
    error: null,
  });
  expect(
    (await run(orders.accept, context(`/api/teammate/orders/${order}/accept`)))
      .status,
  ).toBe(409);
  expect(sync).not.toHaveBeenCalled();

  rpc.mockResolvedValue({ data: { order: teammateOrder }, error: null });
  const accepted = await run(
    orders.accept,
    context(`/api/teammate/orders/${order}/accept`),
  );
  expect(accepted.status).toBe(200);
  expect(sync).toHaveBeenLastCalledWith(
    { users: [], order },
    expect.objectContaining({ budgetMs: expect.any(Number) }),
  );

  sync.mockClear();
  as('customer');
  rpc.mockResolvedValue({ data: { order: customerOrder }, error: null });
  const rerolled = await run(
    orders.reroll,
    context(`/api/orders/${order}/reroll`),
  );
  expect(rerolled.status).toBe(200);
  expect(sync).toHaveBeenCalledExactlyOnceWith(
    { users: [], order },
    expect.anything(),
  );
});

it('syncs after complete and keeps the response when Discord fails', async () => {
  as('teammate');
  const assignment = '00000000-0000-4000-8000-000000000002';
  const proof = '00000000-0000-4000-8000-000000000003';
  const requestId = '00000000-0000-4000-8000-000000000004';
  const completion = {
    order_id: order,
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
  rpc.mockResolvedValue({ data: { completion }, error: null });
  sync.mockRejectedValue(new Error('discord down'));
  const response = await run(
    complete,
    context(`/api/teammate/orders/${order}/complete`, {
      assignment_id: assignment,
      proof_ids: [proof],
      request_id: requestId,
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ completion });
  expect(sync).toHaveBeenCalledWith({ users: [], order }, expect.anything());
});

it('syncs the teammate who claimed a handover link', async () => {
  as('teammate');
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
  const response = await run(
    claim,
    context('/api/claim/x', {}, { token: 'A'.repeat(24) }),
  );
  expect(response.status).toBe(200);
  expect(sync).toHaveBeenCalledWith({ users: [viewerId] }, expect.anything());
});

it('syncs the target after an admin role change, suspension and set-offline', async () => {
  as('admin');
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
  expect(
    (
      await run(
        admin.users,
        context('/api/admin/users', { userId: target, role: 'customer' }),
      )
    ).status,
  ).toBe(200);
  expect(sync).toHaveBeenLastCalledWith({ users: [target] }, expect.anything());
  sync.mockClear();
  expect(
    (
      await run(
        admin.teammates,
        context('/api/admin/teammates', {
          userId: target,
          suspended: true,
          reason: 'No shows',
        }),
      )
    ).status,
  ).toBe(200);
  expect(sync).toHaveBeenLastCalledWith({ users: [target] }, expect.anything());
  sync.mockClear();
  expect(
    (
      await run(
        adminPresence,
        context('/api/admin/presence', {
          action: 'set-offline',
          userId: target,
          reason: 'Other',
        }),
      )
    ).status,
  ).toBe(200);
  expect(sync).toHaveBeenLastCalledWith({ users: [target] }, expect.anything());
});

it('syncs the order after an admin cancel or handover link', async () => {
  as('admin');
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
  await run(
    admin.orders,
    context('/api/admin/orders', {
      action: 'cancel',
      orderId: order,
      reason: 'Customer asked to cancel',
    }),
  );
  await run(
    admin.orders,
    context('/api/admin/orders', { action: 'handover', orderId: order }),
  );
  expect(sync.mock.calls.map((call) => call[0])).toEqual([
    { users: [], order },
    { users: [], order },
  ]);
});

it('syncs when a teammate turns the desk on or off, not on every check-in', async () => {
  as('teammate');
  rpc.mockResolvedValue({ data: { online: true }, error: null });
  await run(
    teammatePresence,
    context('/api/teammate/presence', { action: 'set', online: true }),
  );
  expect(sync).toHaveBeenCalledExactlyOnceWith(
    { users: [viewerId] },
    expect.anything(),
  );
  sync.mockClear();
  await run(
    teammatePresence,
    context('/api/teammate/presence', { action: 'check-in' }),
  );
  expect(sync).not.toHaveBeenCalled();
});

it('syncs an admin only when the panel opens or closes', async () => {
  const now = Date.parse('2026-10-25T12:00:00Z');
  expect(adminPresenceChanged(false, {}, now)).toBe(true);
  expect(
    adminPresenceChanged(
      true,
      { online: true, online_since: new Date(now - 1000).toISOString() },
      now,
    ),
  ).toBe(true);
  expect(
    adminPresenceChanged(
      true,
      { online: true, online_since: new Date(now - 60_000).toISOString() },
      now,
    ),
  ).toBe(false);
  expect(adminPresenceChanged(true, null, now)).toBe(false);

  as('admin');
  rpc.mockResolvedValue({
    data: { online: true, online_since: new Date().toISOString() },
    error: null,
  });
  await run(
    adminPresence,
    context('/api/admin/presence', { action: 'check-in', online: true }),
  );
  expect(sync).toHaveBeenCalledExactlyOnceWith(
    { users: [viewerId] },
    expect.anything(),
  );
});

it('skips every hook while the feature is switched off', async () => {
  vi.mocked(roleSyncConfig).mockReturnValue(null);
  as('teammate');
  rpc.mockResolvedValue({ data: { online: true }, error: null });
  const response = await run(
    teammatePresence,
    context('/api/teammate/presence', { action: 'set', online: false }),
  );
  expect(response.status).toBe(200);
  expect(sync).not.toHaveBeenCalled();
});
