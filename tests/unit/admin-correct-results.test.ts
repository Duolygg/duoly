import { readFileSync } from 'node:fs';
import type { APIContext } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountContext } from '../../src/server/auth/context';
import { matchReports, orderProofs } from '../../src/server/admin/handlers';
import {
  EditMatchReportSchema,
  SetProofRemovedSchema,
} from '../../src/contracts/admin';

// Admins correct win/loss reports and screenshots (migration 20261105140000).
vi.mock('../../src/server/admin/access', async (original) => ({
  ...(await original<typeof import('../../src/server/admin/access')>()),
  adminAccess: vi.fn(async () => ({ owner: true, sections: [] })),
}));
vi.mock('../../src/server/auth/context', () => ({ accountContext: vi.fn() }));
const rpc = vi.fn();
const csrf = 'a'.repeat(64);
const assignmentId = '00000000-0000-4000-8000-0000000000f1';
const orderId = '00000000-0000-4000-8000-0000000000e1';
const proofId = '00000000-0000-4000-8000-00000000aa01';
const games = [
  { teammateIgn: 'T#1', customerIgn: 'Viewer#EUW', link: 'https://x.test/1' },
  { teammateIgn: 'T#1', customerIgn: 'Viewer#EUW', link: 'https://x.test/2' },
];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const call = (path: string, body?: Record<string, unknown>, params = {}) => {
  const request = new Request('http://localhost' + path, {
    method: body ? 'POST' : 'GET',
    headers: body
      ? { origin: 'http://localhost', 'content-type': 'application/json' }
      : {},
    body: body ? JSON.stringify({ csrf, ...body }) : undefined,
  });
  return {
    request,
    url: new URL(request.url),
    params,
    cookies: { get: () => ({ value: csrf }) },
  } as unknown as APIContext;
};
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
  vi.mocked(accountContext).mockReturnValue({
    client: { rpc },
    identity: vi.fn(async () => ({ viewer: { role: 'admin' } })),
    json,
    config: { origin: 'http://localhost' },
    names: { csrf: 'csrf' },
  } as unknown as ReturnType<typeof accountContext>);
});

describe('correcting a report', () => {
  const body = {
    csrf,
    action: 'edit',
    assignmentId,
    games,
    wins: 0,
    losses: 2,
    reason: 'Match history shows 2 losses',
  };
  it('needs games, a reason and wins + losses = games', () => {
    expect(EditMatchReportSchema.safeParse(body).success).toBe(true);
    for (const bad of [
      { ...body, wins: 2 },
      { ...body, reason: '' },
      { ...body, games: [{ ...games[0], link: 'http://x.test' }, games[1]] },
      { ...body, games: [{ ...games[0], teammateIgn: '' }, games[1]] },
    ])
      expect(EditMatchReportSchema.safeParse(bad).success).toBe(false);
  });
  it('sends the correction to the audited RPC', async () => {
    const { csrf: _c, ...rest } = body;
    void _c;
    const response = (await matchReports(
      call('/api/admin/match-reports', rest),
    )) as Response;
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith('admin_edit_match_report', {
      p_assignment_id: assignmentId,
      p_games: games,
      p_wins: 0,
      p_losses: 2,
      p_reason: 'Match history shows 2 losses',
    });
  });
});

describe('screenshots', () => {
  it('lists an order’s screenshots for admins', async () => {
    const response = (await orderProofs(
      call('/api/admin/proofs/' + orderId, undefined, { orderId }),
    )) as Response;
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith('admin_order_proofs', {
      p_order_id: orderId,
    });
  });
  it('removes and shows again through one audited RPC', async () => {
    expect(
      SetProofRemovedSchema.safeParse({ csrf, orderId, proofId, removed: 1 })
        .success,
    ).toBe(false);
    const response = (await orderProofs(
      call(
        '/api/admin/proofs/' + orderId,
        { orderId, proofId, removed: true, reason: 'Not from this match' },
        { orderId },
      ),
    )) as Response;
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith('admin_set_order_proof_removed', {
      p_order_id: orderId,
      p_proof_id: proofId,
      p_removed: true,
      p_reason: 'Not from this match',
    });
  });
});

describe('migration', () => {
  const sql = readFileSync(
    'supabase/migrations/20261105140000_admin_correct_results.sql',
    'utf8',
  );
  it('hides removed screenshots from customers and teammates but not admins', () => {
    expect(
      sql.match(
        /not exists \(select 1 from public\.order_proof_removals x where x\.proof_id = p\.id\)/g,
      )?.length,
    ).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("r.user_id = v_actor and r.role = 'admin'");
  });
  it('keeps the admin finalize server-only and the completion record untouched', () => {
    expect(sql).toContain(
      'grant execute on function public.admin_finalize_order_proof_upload(uuid, text, integer, text) to service_role;',
    );
    expect(sql).not.toMatch(
      /order_completion_proofs\s+(set|where)|delete from public\.order_completion_proofs|update public\.teammate_earning_entries/,
    );
  });
});
