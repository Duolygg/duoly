import { afterEach, describe, expect, it, vi } from 'vitest';
import { BRACKETS, bracketRoleName } from '../../src/contracts/performance';
import {
  configuredPerformanceRoleIds,
  performanceRoleIds,
  syncPerformanceRoles,
  type PerformanceTarget,
  type PerformanceSyncRow,
} from '../../src/server/performance/roles';

const config = {
  token: 'bot',
  guildId: '1561145343943376896',
  supabaseUrl: 'https://x.supabase.co',
  supabaseSecretKey: 'secret',
};
const ids = {
  1: '1565507645937426492',
  5: '1565507844198109254',
  10: '1565507887353176064',
  25: '1565507887365890078',
  50: '1565507894974095531',
};
const guildRoles = () =>
  BRACKETS.map((b) => ({
    id: ids[b],
    name: bracketRoleName(b),
    permissions: '0',
    managed: false,
  }));
const oldId = '911000000000000001';
const newId = '922000000000000002';
const target = (): PerformanceTarget => ({
  userId: 'user',
  discordId: newId,
  bracket: 10,
  version: 'snapshot',
  cleanup: [{ discordId: oldId, token: 'generation' }],
});
afterEach(() => vi.unstubAllEnvs());

function fixture(
  options: {
    cleanupFailure?: boolean;
    missingOld?: boolean;
    unlink?: boolean;
  } = {},
) {
  vi.stubEnv('PERFORMANCE_ROLE_IDS', JSON.stringify(ids));
  const members: Record<string, Set<string>> = {
    [oldId]: new Set(['unrelated', ids[50]]),
    [newId]: new Set(['unrelated', ids[25]]),
  };
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string, init: { method: string }) => {
    calls.push(init.method + ' ' + url);
    if (url.endsWith('/roles') && init.method === 'GET')
      return Response.json(guildRoles());
    const match = /members\/(\d+)(?:\/roles\/(\d+))?$/.exec(url);
    if (!match) throw new Error('Unexpected Discord mutation');
    const who = match[1]!;
    const role = match[2];
    if (options.missingOld && who === oldId)
      return new Response(null, { status: 404 });
    if (init.method === 'GET')
      return Response.json({ roles: [...members[who]!] });
    if (options.cleanupFailure && who === oldId)
      return new Response(null, { status: 403 });
    if (init.method === 'PUT') members[who]!.add(role!);
    else if (init.method === 'DELETE') members[who]!.delete(role!);
    else throw new Error('Provisioning is forbidden');
    return new Response(null, { status: 204 });
  });
  const t = target();
  if (options.unlink) t.discordId = null;
  const saved: PerformanceSyncRow[] = [];
  const store = {
    targets: async () => [t],
    save: async (rows: PerformanceSyncRow[]) => {
      saved.push(...rows);
    },
  };
  return { members, calls, fetchImpl, store, saved };
}

describe('canonical performance roles', () => {
  it.each([
    undefined,
    '',
    '{',
    '[]',
    'null',
    '{}',
    JSON.stringify({ ...ids, 50: ids[1] }),
    JSON.stringify({ ...ids, 50: 'wrong' }),
    JSON.stringify({ ...ids, extra: ids[1] }),
  ])('fails closed for malformed config %s', async (raw) => {
    expect(configuredPerformanceRoleIds(raw)).toBeNull();
    const fetchImpl = vi.fn();
    expect(
      await performanceRoleIds(config, fetchImpl, undefined, raw ?? ''),
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each(['missing', 'name', 'permissions', 'managed'])(
    'fails closed for invalid guild role %s without name adoption',
    async (kind) => {
      const roles = guildRoles();
      if (kind === 'missing') roles[0]!.id = '999000000000000001';
      if (kind === 'name') roles[0]!.name = ' performance | top 1% ';
      if (kind === 'permissions') roles[0]!.permissions = '8';
      if (kind === 'managed') roles[0]!.managed = true;
      const fetchImpl = vi.fn(async () => Response.json(roles));
      expect(
        await performanceRoleIds(
          config,
          fetchImpl as never,
          undefined,
          JSON.stringify(ids),
        ),
      ).toBeNull();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );
  it('reports an unreadable guild without making any member mutations', async () => {
    vi.stubEnv('PERFORMANCE_ROLE_IDS', JSON.stringify(ids));
    const saved: PerformanceSyncRow[] = [];
    const fetchImpl = vi.fn(async () => new Response(null, { status: 403 }));
    const store = {
      targets: async () => [target()],
      save: async (rows: PerformanceSyncRow[]) => {
        saved.push(...rows);
      },
    };
    expect(
      (await syncPerformanceRoles(config, store, fetchImpl as never)).errors,
    ).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(saved[0]).toMatchObject({
      status: 'error',
      cleaned: [],
      applied: false,
    });
  });
  it('uses configured IDs even when duplicate names exist and never mutates other roles', async () => {
    const roles = [
      ...guildRoles(),
      { ...guildRoles()[0]!, id: '999000000000000001' },
    ];
    expect(
      await performanceRoleIds(
        config,
        (async () => Response.json(roles)) as never,
        undefined,
        JSON.stringify(ids),
      ),
    ).toEqual(ids);
  });
});
describe('identity cleanup before assignment', () => {
  it('removes former roles before assigning current and retains unrelated roles', async () => {
    const f = fixture();
    expect(
      await syncPerformanceRoles(config, f.store, f.fetchImpl as never),
    ).toEqual({ synced: 1, skipped: 0, errors: 0 });
    expect([...f.members[oldId]!]).toEqual(['unrelated']);
    expect([...f.members[newId]!]).toEqual(['unrelated', ids[10]]);
    const writes = f.calls.filter((s) => /^(DELETE|PUT)/.test(s));
    expect(writes.map((s) => s.split('/members/')[1])).toEqual([
      `${oldId}/roles/${ids[50]}`,
      `${newId}/roles/${ids[25]}`,
      `${newId}/roles/${ids[10]}`,
    ]);
    expect(f.saved[0]).toMatchObject({
      ...target(),
      applied: true,
      cleaned: target().cleanup,
      status: 'synced',
    });
  });
  it('does not assign new identity after failed cleanup and succeeds on retry', async () => {
    const f = fixture({ cleanupFailure: true });
    expect(
      (await syncPerformanceRoles(config, f.store, f.fetchImpl as never))
        .errors,
    ).toBe(1);
    expect(f.calls.some((s) => s.includes('/members/' + newId))).toBe(false);
    expect(f.saved[0]).toMatchObject({
      applied: false,
      cleaned: [],
      status: 'error',
    });
    const retry = fixture();
    expect(
      (
        await syncPerformanceRoles(
          config,
          retry.store,
          retry.fetchImpl as never,
        )
      ).synced,
    ).toBe(1);
  });
  it('cleans an unlinked account without making an assignment', async () => {
    const f = fixture({ unlink: true });
    await syncPerformanceRoles(config, f.store, f.fetchImpl as never);
    expect([...f.members[oldId]!]).toEqual(['unrelated']);
    expect(f.saved[0]).toMatchObject({
      status: 'no_discord',
      applied: false,
      cleaned: target().cleanup,
    });
    expect(f.calls.some((s) => s.startsWith('PUT'))).toBe(false);
  });
  it('treats a former guild member 404 as successful cleanup', async () => {
    const f = fixture({ missingOld: true });
    await syncPerformanceRoles(config, f.store, f.fetchImpl as never);
    expect(f.saved[0]).toMatchObject({
      status: 'synced',
      cleaned: target().cleanup,
    });
  });
  it('concurrent reconciliation is idempotent with no role provisioning', async () => {
    const f = fixture();
    await Promise.all([
      syncPerformanceRoles(config, f.store, f.fetchImpl as never),
      syncPerformanceRoles(config, f.store, f.fetchImpl as never),
    ]);
    expect([...f.members[newId]!]).toEqual(['unrelated', ids[10]]);
    expect(f.calls.some((s) => s.startsWith('POST'))).toBe(false);
    expect(f.saved).toHaveLength(2);
  });
  it('replays a sync without additional role mutations', async () => {
    const f = fixture();
    await syncPerformanceRoles(config, f.store, f.fetchImpl as never);
    const writes = f.calls.filter((s) => /^(PUT|DELETE)/.test(s)).length;
    await syncPerformanceRoles(config, f.store, f.fetchImpl as never);
    expect(f.calls.filter((s) => /^(PUT|DELETE)/.test(s))).toHaveLength(writes);
  });
});
