import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
const state = vi.hoisted(() => ({
  enabled: true,
  body: {} as Record<string, unknown>,
  rpc: vi.fn(),
  prior: vi.fn(),
  track: vi.fn(),
}));
const account = {
  client: { rpc: state.rpc },
  identity: async () => ({ viewer: { id: 'verified-user', role: 'teammate' } }),
  json: (body: unknown, status = 200) => Response.json(body, { status }),
};
vi.mock('../../src/server/auth/context', () => ({
  accountContext: () => account,
}));
vi.mock('../../src/server/auth/handlers', () => ({
  mutation: async () => ({ account, body: state.body, failure: null }),
}));
vi.mock('../../src/server/analytics/client', () => ({
  trackRequest: state.track,
  serverAnalyticsEnabled: () => state.enabled,
}));
vi.mock('../../src/server/discord/role-hooks', () => ({
  syncRolesInBackground: vi.fn(),
}));
vi.mock('../../src/server/support/store', () => ({
  supportService: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: state.prior }) }),
    }),
  }),
}));
import { matchReport } from '../../src/server/match-reports/handlers';
import { teammatePresence } from '../../src/server/presence/handlers';
const context = () =>
  ({
    request: new Request('https://duoly.gg/api/test', { method: 'POST' }),
    cookies: {},
    params: { id: '019a1234-1234-7123-8123-123456789abc' },
    url: new URL('https://duoly.gg/api/test'),
  }) as unknown as APIContext;
const report = {
  games: [
    {
      teammateIgn: 'PRIVATE',
      customerIgn: 'PRIVATE',
      link: 'https://private.example',
    },
  ],
  wins: 1,
  losses: 0,
};
beforeEach(() => {
  state.enabled = true;
  vi.clearAllMocks();
  state.rpc.mockReset();
  state.prior.mockReset();
});
describe('direct server success predicates', () => {
  it('disabled analytics adds no report pre-read', async () => {
    state.enabled = false;
    state.body = { csrf: 'token', ...report };
    state.rpc.mockResolvedValue({ data: { report }, error: null });
    expect((await matchReport(context())).status).toBe(200);
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc.mock.calls[0]![0]).toBe('teammate_save_match_report');
    expect(state.track).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'match report emits only first saves (first %s)',
    async (first) => {
      state.body = { csrf: 'token', ...report };
      state.rpc
        .mockResolvedValueOnce({
          data: { report: first ? null : report },
          error: null,
        })
        .mockResolvedValueOnce({ data: { report }, error: null });
      const ctx = context();
      expect((await matchReport(ctx)).status).toBe(200);
      if (first)
        expect(state.track).toHaveBeenCalledWith(
          ctx,
          'verified-user',
          'match_report_saved',
        );
      else expect(state.track).not.toHaveBeenCalled();
    },
  );
  it('unknown previous match report state never implies first save', async () => {
    state.body = { csrf: 'token', ...report };
    state.rpc
      .mockRejectedValueOnce(new Error('lookup unavailable'))
      .mockResolvedValueOnce({ data: { report }, error: null });
    expect((await matchReport(context())).status).toBe(200);
    expect(state.track).not.toHaveBeenCalled();
  });
  it.each([
    [false, true],
    [true, false],
    [true, true],
    [false, false],
  ])('desk counts state transitions %s -> %s only', async (before, after) => {
    state.body = { csrf: 'token', action: 'set', online: after };
    state.prior.mockResolvedValue({ data: { online: before }, error: null });
    state.rpc.mockResolvedValue({ data: { online: after }, error: null });
    const ctx = context();
    expect((await teammatePresence(ctx)).status).toBe(200);
    if (before !== after)
      expect(state.track).toHaveBeenCalledWith(
        ctx,
        'verified-user',
        'desk_online_changed',
        { online: after },
      );
    else expect(state.track).not.toHaveBeenCalled();
  });
  it('desk heartbeats never emit transition events or read prior state', async () => {
    state.body = { csrf: 'token', action: 'check-in' };
    state.rpc.mockResolvedValue({ data: { online: true }, error: null });
    expect((await teammatePresence(context())).status).toBe(200);
    expect(state.prior).not.toHaveBeenCalled();
    expect(state.track).not.toHaveBeenCalled();
  });
  it('failed business writes never emit transitions', async () => {
    state.body = { csrf: 'token', action: 'set', online: true };
    state.prior.mockResolvedValue({ data: { online: false }, error: null });
    state.rpc.mockResolvedValue({
      data: null,
      error: new Error('write failed'),
    });
    expect((await teammatePresence(context())).status).toBe(503);
    expect(state.track).not.toHaveBeenCalled();
  });
});
