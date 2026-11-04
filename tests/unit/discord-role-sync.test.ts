import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import {
  MEMBER_REFRESH_MS,
  NOT_MEMBER_RECHECK_MS,
  PRESENCE_STALE_MS,
  needsMemberRead,
  planChanges,
  discordRequest,
  releaseWant,
  resetRoleSyncMemory,
  roleSyncConfig,
  serverRoles,
  syncDiscordRoles,
  tickAuthorized,
  wantedMap,
  wantedRoles,
  type Applied,
  type FetchLike,
  type Person,
  type RoleStore,
  type RoleSyncConfig,
  type SyncScope,
} from '../../src/server/discord/role-sync';
import { rolesTick, syncRolesAfter } from '../../src/server/discord/role-hooks';

const NOW = Date.parse('2026-10-25T12:00:00Z');
const TOKEN = 'bot-token-that-must-never-leak';
const GUILD = '100000000000000001';
const ROLE = {
  teammate: '200000000000000001',
  online: '200000000000000002',
  session: '200000000000000003',
};
/** Roles Fabian manages by hand: the bot must never touch these. */
const OTHER: [string, string, string] = [
  '300000000000000001',
  '300000000000000002',
  '300000000000000003',
];
const config: RoleSyncConfig = {
  token: TOKEN,
  guildId: GUILD,
  supabaseUrl: 'https://example.supabase.co',
  supabaseSecretKey: 'sb_secret_test',
};
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const did = (n: number) => `4000000000000000${String(n).padStart(2, '0')}`;

function person(n: number, patch: Partial<Person> = {}): Person {
  return {
    user_id: uid(n),
    discord_id: did(n),
    role: 'teammate',
    suspended: false,
    desk_online: false,
    last_seen: null,
    busy: false,
    ...patch,
  };
}
function applied(n: number, patch: Partial<Applied> = {}): Applied {
  return {
    discord_id: did(n),
    user_id: uid(n),
    teammate: false,
    online: false,
    session: false,
    admin: false,
    not_member: false,
    checked_at: new Date(NOW - 1000).toISOString(),
    ...patch,
  };
}

// ---------------------------------------------------------------- in-memory store and Discord

function memoryStore(
  people: Person[],
  rows: Applied[] = [],
  removed: 'suspended' | 'busy' | 'ignored' = 'suspended',
) {
  const table = new Map(rows.map((row) => [row.discord_id, { ...row }]));
  const calls: string[] = [];
  const store: RoleStore & { table: typeof table; calls: string[] } = {
    table,
    calls,
    async facts(scope: SyncScope | null) {
      calls.push('facts');
      if (!scope) return { now: NOW, people };
      if (scope.order) return { now: NOW, people: people.slice(0, 1) };
      return {
        now: NOW,
        people: people.filter((p) => scope.users?.includes(p.user_id)),
      };
    },
    async applied(userIds) {
      calls.push('applied');
      const all = [...table.values()];
      return userIds
        ? all.filter((row) => row.user_id && userIds.includes(row.user_id))
        : all;
    },
    async save(list) {
      for (const row of list) table.set(row.discord_id, { ...row });
    },
    async remove(ids) {
      for (const id of ids) table.delete(id);
    },
    async teammateRoleRemoved(id) {
      calls.push('removed:' + id);
      return removed;
    },
  };
  return store;
}

type Member = { roles: string[] };
function discord(
  members: Record<string, Member>,
  options: {
    roles?: { id: string; name: string }[];
    status?: (method: string, path: string) => number | undefined;
    body?: (method: string, path: string) => unknown;
  } = {},
) {
  const requests: { method: string; path: string; auth: string }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const path = url.replace('https://discord.com/api/v10', '');
    requests.push({
      method: init.method,
      path,
      auth: init.headers.authorization ?? '',
    });
    const forced = options.status?.(init.method, path);
    if (forced)
      return Response.json(options.body?.(init.method, path) ?? {}, {
        status: forced,
      });
    if (path === `/guilds/${GUILD}/roles`)
      return Response.json(
        options.roles ?? [
          { id: ROLE.teammate, name: 'Teammate' },
          { id: ROLE.online, name: 'Online' },
          { id: ROLE.session, name: ' In Session ' },
          ...OTHER.map((id, i) => ({ id, name: `Game role ${i}` })),
          { id: '300000000000000009', name: 'Admin' },
        ],
      );
    const member = path.match(/^\/guilds\/\d+\/members\/(\d+)$/);
    if (member && init.method === 'GET') {
      const m = members[member[1] ?? ''];
      return m
        ? Response.json({ roles: m.roles })
        : Response.json({ code: 10007 }, { status: 404 });
    }
    const role = path.match(/^\/guilds\/\d+\/members\/(\d+)\/roles\/(\d+)$/);
    if (role) {
      const m = members[role[1] ?? ''];
      const roleId = role[2] ?? '';
      if (!m) return Response.json({ code: 10007 }, { status: 404 });
      if (init.method === 'PUT' && !m.roles.includes(roleId))
        m.roles.push(roleId);
      if (init.method === 'DELETE')
        m.roles = m.roles.filter((r: string) => r !== roleId);
      return new Response(null, { status: 204 });
    }
    return Response.json({}, { status: 500 });
  };
  const changes = () =>
    requests.filter((r) => r.method === 'PUT' || r.method === 'DELETE');
  return { fetchImpl, requests, changes };
}

const run = (
  scope: SyncScope | null,
  store: RoleStore,
  fetchImpl: FetchLike,
  extra: { clock?: () => number; budgetMs?: number } = {},
) =>
  syncDiscordRoles(scope, {
    config,
    store,
    fetch: fetchImpl,
    sleep: async () => undefined,
    clock: extra.clock ?? (() => NOW),
    budgetMs: extra.budgetMs,
  });

let warn: MockInstance<typeof console.warn>;
beforeEach(() => {
  resetRoleSyncMemory();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------- rules

describe('wanted roles (lib/discordRoles.js rules)', () => {
  const fresh = { desk_online: true, last_seen: NOW - 5000 };
  it('gives a teammate Teammate, and Online only while the desk is on and checking in', () => {
    expect(wantedRoles(person(1), NOW)).toMatchObject({
      teammate: true,
      online: false,
      session: false,
      admin: false,
    });
    expect(wantedRoles(person(1, fresh), NOW)).toMatchObject({
      teammate: true,
      online: true,
      session: false,
    });
  });
  it('drops Online once the check-ins are older than 20 seconds', () => {
    const stale = person(1, {
      desk_online: true,
      last_seen: NOW - PRESENCE_STALE_MS,
    });
    expect(wantedRoles(stale, NOW).online).toBe(false);
    expect(
      wantedRoles({ ...stale, last_seen: NOW - PRESENCE_STALE_MS + 1 }, NOW)
        .online,
    ).toBe(true);
    expect(
      wantedRoles(person(1, { desk_online: false, last_seen: NOW }), NOW)
        .online,
    ).toBe(false);
  });
  it('gives In Session and Online while an order is in progress, even with the desk off', () => {
    expect(wantedRoles(person(1, { busy: true }), NOW)).toMatchObject({
      teammate: true,
      online: true,
      session: true,
    });
  });
  it('gives suspended teammates neither Teammate nor Online', () => {
    expect(wantedRoles(person(1, { suspended: true, ...fresh }), NOW)).toEqual(
      expect.objectContaining({ teammate: false, online: false }),
    );
    expect(
      wantedRoles(person(1, { suspended: true, busy: true }), NOW).online,
    ).toBe(false);
  });
  it('gives admins Online while the panel checks in, never In Session, and leaves Teammate alone', () => {
    const admin = person(1, { role: 'admin', ...fresh, busy: true });
    expect(wantedRoles(admin, NOW)).toEqual({
      userId: uid(1),
      admin: true,
      teammate: undefined,
      online: true,
      session: false,
    });
    expect(wantedRoles({ ...admin, last_seen: NOW - 60_000 }, NOW).online).toBe(
      false,
    );
  });
  it('wants nothing for people without a valid linked Discord id', () => {
    const map = wantedMap(
      [person(1), person(2, { discord_id: 'not-linked' })],
      NOW,
    );
    expect([...map.keys()]).toEqual([did(1)]);
  });
  it('takes everything managed away from people nobody wants, except an admin Teammate role', () => {
    expect(releaseWant(applied(1, { teammate: true }))).toMatchObject({
      teammate: false,
      online: false,
      session: false,
    });
    expect(releaseWant(applied(1, { admin: true })).teammate).toBeUndefined();
  });
});

describe('diff planning', () => {
  const want = wantedRoles(person(1, { busy: true }), NOW);
  it('plans only the roles that differ', () => {
    expect(
      planChanges(want, { teammate: true, online: false, session: true }, ROLE),
    ).toEqual([{ key: 'online', add: true }]);
    expect(
      planChanges(want, { teammate: true, online: true, session: true }, ROLE),
    ).toEqual([]);
  });
  it("never plans an admin's Teammate role and skips roles missing in the server", () => {
    const admin = wantedRoles(person(1, { role: 'admin' }), NOW);
    expect(
      planChanges(
        admin,
        { teammate: true, online: true, session: false },
        ROLE,
      ),
    ).toEqual([{ key: 'online', add: false }]);
    expect(
      planChanges(
        want,
        { teammate: false, online: true, session: true },
        { online: ROLE.online, session: ROLE.session },
      ),
    ).toEqual([]);
  });
  it('rechecks non-members every 2 minutes and members every 10 minutes', () => {
    const at = (ms: number) => new Date(NOW - ms).toISOString();
    expect(needsMemberRead(undefined, NOW)).toBe(true);
    expect(
      needsMemberRead(
        applied(1, { not_member: true, checked_at: at(60_000) }),
        NOW,
      ),
    ).toBe(false);
    expect(
      needsMemberRead(
        applied(1, {
          not_member: true,
          checked_at: at(NOT_MEMBER_RECHECK_MS + 1),
        }),
        NOW,
      ),
    ).toBe(true);
    expect(
      needsMemberRead(
        applied(1, { checked_at: at(MEMBER_REFRESH_MS - 1) }),
        NOW,
      ),
    ).toBe(false);
    expect(
      needsMemberRead(
        applied(1, { checked_at: at(MEMBER_REFRESH_MS + 1) }),
        NOW,
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------- Discord client

describe('Discord REST client', () => {
  it('waits retry_after on 429 and retries', async () => {
    const sleep = vi.fn(async () => undefined);
    const replies = [
      Response.json({ retry_after: 1.2 }, { status: 429 }),
      new Response(null, { status: 204 }),
    ];
    const fetchImpl = vi.fn<FetchLike>(async () => replies.shift()!);
    const reply = await discordRequest(config, 'PUT', '/x', fetchImpl, sleep);
    expect(reply.status).toBe(204);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(1200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1].headers.authorization).toBe(
      `Bot ${TOKEN}`,
    );
  });
  it('gives up after three rate-limited tries and caps the wait', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async () =>
      Response.json({ retry_after: 600 }, { status: 429 }),
    );
    expect(
      (await discordRequest(config, 'GET', '/x', fetchImpl, sleep)).status,
    ).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(10_000);
  });
  it('finds the three roles by name, case-insensitive, and pauses when Online or In Session is missing', async () => {
    const d = discord({});
    expect(await serverRoles(config, NOW, d.fetchImpl)).toEqual(ROLE);
    resetRoleSyncMemory();
    const missing = discord(
      {},
      { roles: [{ id: ROLE.teammate, name: 'TEAMMATE' }] },
    );
    expect(await serverRoles(config, NOW, missing.fetchImpl)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------- sync rounds

describe('sync', () => {
  it('gives a new member only the missing roles and keeps every other role', async () => {
    const members = { [did(1)]: { roles: [...OTHER, ROLE.session] } };
    const d = discord(members);
    const store = memoryStore([
      person(1, { desk_online: true, last_seen: NOW - 1000 }),
    ]);
    const result = await run(null, store, d.fetchImpl);
    expect(result).toMatchObject({ enabled: true, ready: true, changed: 3 });
    expect(d.changes().map((r) => [r.method, r.path.split('/').pop()])).toEqual(
      [
        ['PUT', ROLE.teammate],
        ['PUT', ROLE.online],
        ['DELETE', ROLE.session],
      ],
    );
    expect(members[did(1)]!.roles.sort()).toEqual(
      [...OTHER, ROLE.teammate, ROLE.online].sort(),
    );
    expect(store.table.get(did(1))).toMatchObject({
      teammate: true,
      online: true,
      session: false,
      not_member: false,
    });
    for (const request of d.requests) {
      expect(request.auth).toBe(`Bot ${TOKEN}`);
      if (request.method !== 'GET')
        expect(Object.values(ROLE)).toContain(request.path.split('/').pop());
    }
  });

  it('suspends a teammate whose Teammate role an admin took away in Discord', async () => {
    // the bot had given the role; the next member read finds it gone
    const d = discord({ [did(1)]: { roles: [ROLE.online] } });
    const store = memoryStore(
      [person(1, { desk_online: true, last_seen: NOW - 1000 })],
      [
        applied(1, {
          teammate: true,
          online: true,
          checked_at: new Date(NOW - MEMBER_REFRESH_MS - 1).toISOString(),
        }),
      ],
    );
    const result = await run(null, store, d.fetchImpl);
    expect(store.calls).toContain('removed:' + did(1));
    expect(result.suspended).toBe(1);
    // not given back, and Online goes too
    expect(d.changes()).toEqual([
      expect.objectContaining({
        method: 'DELETE',
        path: `/guilds/${GUILD}/members/${did(1)}/roles/${ROLE.online}`,
      }),
    ]);
    expect(store.table.get(did(1))).toMatchObject({
      teammate: false,
      online: false,
    });
  });

  it('waits until the order is finished when the teammate is playing', async () => {
    const d = discord({ [did(1)]: { roles: [ROLE.online, ROLE.session] } });
    const store = memoryStore(
      [person(1, { busy: true })],
      [
        applied(1, {
          teammate: true,
          online: true,
          session: true,
          checked_at: new Date(NOW - MEMBER_REFRESH_MS - 1).toISOString(),
        }),
      ],
      'busy',
    );
    const result = await run(null, store, d.fetchImpl);
    expect(result.suspended).toBe(0);
    // the role is not given back, and the stored state still says "had it" so the next read asks again
    expect(d.changes().some((r) => r.path.endsWith(ROLE.teammate))).toBe(false);
    expect(store.table.get(did(1))).toMatchObject({ teammate: true });
  });

  it('does not suspend new members or people who never had the role from the bot', async () => {
    const d = discord({ [did(1)]: { roles: [] } });
    const store = memoryStore([person(1)]);
    await run(null, store, d.fetchImpl);
    expect(store.calls.some((c) => c.startsWith('removed:'))).toBe(false);
    expect(d.changes()).toEqual([
      expect.objectContaining({
        method: 'PUT',
        path: `/guilds/${GUILD}/members/${did(1)}/roles/${ROLE.teammate}`,
      }),
    ]);
  });

  it('sends nothing to Discord when the stored state already matches', async () => {
    const d = discord({ [did(1)]: { roles: [ROLE.teammate] } });
    const store = memoryStore([person(1)], [applied(1, { teammate: true })]);
    const result = await run(null, store, d.fetchImpl);
    expect(result.changed).toBe(0);
    expect(d.requests.map((r) => r.path)).toEqual([`/guilds/${GUILD}/roles`]);
  });

  it('removes Online when presence goes stale, and only Online', async () => {
    const d = discord({ [did(1)]: { roles: [ROLE.teammate, ROLE.online] } });
    const store = memoryStore(
      [person(1, { desk_online: true, last_seen: NOW - 25_000 })],
      [applied(1, { teammate: true, online: true })],
    );
    await run(null, store, d.fetchImpl);
    expect(d.changes()).toEqual([
      expect.objectContaining({
        method: 'DELETE',
        path: `/guilds/${GUILD}/members/${did(1)}/roles/${ROLE.online}`,
      }),
    ]);
  });

  it('removes In Session and Online after complete or reroll', async () => {
    const d = discord({
      [did(1)]: { roles: [ROLE.teammate, ROLE.online, ROLE.session] },
    });
    const store = memoryStore(
      [person(1)],
      [applied(1, { teammate: true, online: true, session: true })],
    );
    await run({ order: 'o' }, store, d.fetchImpl);
    expect(d.changes().map((r) => r.path.split('/').pop())).toEqual([
      ROLE.online,
      ROLE.session,
    ]);
  });

  it('takes the managed roles from an unlinked teammate and forgets them', async () => {
    const members = {
      [did(1)]: { roles: [OTHER[0], ROLE.teammate, ROLE.online] },
    };
    const d = discord(members);
    const store = memoryStore(
      [],
      [applied(1, { teammate: true, online: true })],
    );
    await run({ users: [uid(1)] }, store, d.fetchImpl);
    expect(members[did(1)]!.roles).toEqual([OTHER[0]]);
    expect(store.table.has(did(1))).toBe(false);
  });

  it("never touches an admin's Teammate role, even after they leave", async () => {
    const members = {
      [did(1)]: { roles: [ROLE.teammate, ROLE.online] },
      [did(2)]: { roles: [ROLE.teammate] },
    };
    const d = discord(members);
    const store = memoryStore(
      [person(1, { role: 'admin', busy: true })],
      [
        applied(1, { teammate: true, online: true }),
        applied(2, { teammate: true, admin: true }),
      ],
    );
    await run(null, store, d.fetchImpl);
    expect(members[did(1)]!.roles).toEqual([ROLE.teammate]);
    expect(members[did(2)]!.roles).toEqual([ROLE.teammate]);
    expect(d.changes().some((r) => r.path.endsWith(ROLE.teammate))).toBe(false);
    expect(store.table.get(did(1))?.admin).toBe(true);
    expect(store.table.has(did(2))).toBe(false);
  });

  it('gives nothing to people who are not in the server and rechecks them after 2 minutes', async () => {
    const d = discord({});
    const store = memoryStore([person(1, { busy: true })]);
    await run(null, store, d.fetchImpl);
    expect(d.changes()).toEqual([]);
    expect(store.table.get(did(1))).toMatchObject({ not_member: true });
    d.requests.length = 0;
    await run(null, store, d.fetchImpl, { clock: () => NOW + 60_000 });
    expect(d.requests.filter((r) => r.path.includes('/members/'))).toEqual([]);
    await run(null, store, d.fetchImpl, {
      clock: () => NOW + NOT_MEMBER_RECHECK_MS + 2000,
    });
    expect(
      d.requests.filter(
        (r) => r.method === 'GET' && r.path.includes('/members/'),
      ),
    ).toHaveLength(1);
  });

  it('marks a member who left (404 on a role change) as not a member', async () => {
    const d = discord({});
    const store = memoryStore([person(1, { busy: true })], [applied(1)]);
    await run(null, store, d.fetchImpl);
    expect(d.changes()).toHaveLength(1);
    expect(store.table.get(did(1))).toMatchObject({ not_member: true });
  });

  it('logs a missing permission (403) once and keeps the stored state', async () => {
    const d = discord(
      {
        [did(1)]: { roles: [] },
        [did(2)]: { roles: [] },
      },
      { status: (method) => (method === 'PUT' ? 403 : undefined) },
    );
    const store = memoryStore([person(1), person(2)]);
    const result = await run(null, store, d.fetchImpl);
    expect(result.failed).toBe(2);
    const perm = warn.mock.calls.filter((c) =>
      String(c[0]).includes('Manage Roles'),
    );
    expect(perm).toHaveLength(1);
    expect(store.table.get(did(1))?.teammate).toBe(false);
    for (const call of warn.mock.calls)
      expect(String(call[0])).not.toContain(TOKEN);
  });

  it('looks the roles up again when Discord says a role is unknown', async () => {
    const d = discord(
      { [did(1)]: { roles: [] } },
      {
        status: (method) => (method === 'PUT' ? 404 : undefined),
        body: () => ({ code: 10011 }),
      },
    );
    const store = memoryStore([person(1)]);
    await run(null, store, d.fetchImpl);
    await run(null, store, d.fetchImpl);
    expect(
      d.requests.filter((r) => r.path === `/guilds/${GUILD}/roles`),
    ).toHaveLength(2);
    expect(store.table.get(did(1))?.not_member).toBe(false);
  });

  it('pauses without touching members when the Online or In Session role is missing', async () => {
    const d = discord(
      { [did(1)]: { roles: [] } },
      { roles: [{ id: ROLE.teammate, name: 'Teammate' }] },
    );
    const result = await run(null, memoryStore([person(1)]), d.fetchImpl);
    expect(result).toMatchObject({ enabled: true, ready: false });
    expect(d.requests).toHaveLength(1);
  });

  it('reads the applied state before the facts', async () => {
    const d = discord({ [did(1)]: { roles: [] } });
    const store = memoryStore([person(1)]);
    await run({ users: [uid(1)] }, store, d.fetchImpl);
    expect(store.calls).toEqual(['applied', 'facts']);
    store.calls.length = 0;
    await run({ order: 'o' }, store, d.fetchImpl);
    expect(store.calls).toEqual(['facts', 'applied', 'facts']);
  });

  it('defers the rest to the next sweep when the time budget is used up', async () => {
    const d = discord({ [did(1)]: { roles: [] }, [did(2)]: { roles: [] } });
    let t = NOW;
    const result = await run(
      null,
      memoryStore([person(1), person(2)]),
      d.fetchImpl,
      {
        clock: () => (t += 600),
        budgetMs: 1000,
      },
    );
    expect(result.deferred).toBe(1);
  });
});

// ---------------------------------------------------------------- gating

describe('gating', () => {
  const full = {
    DISCORD_ROLE_SYNC_ENABLED: 'true',
    DISCORD_BOT_TOKEN: TOKEN,
    DISCORD_GUILD_ID: GUILD,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
  };
  it('is on only with the switch, bot token, guild id and Supabase secret', () => {
    expect(roleSyncConfig(full)).toEqual(config);
    for (const [name, value] of <[string, string][]>[
      ['DISCORD_ROLE_SYNC_ENABLED', 'false'],
      ['DISCORD_ROLE_SYNC_ENABLED', ''],
      ['DISCORD_BOT_TOKEN', ''],
      ['DISCORD_GUILD_ID', ''],
      ['DISCORD_GUILD_ID', 'duoly.gg'],
      ['SUPABASE_SECRET_KEY', ''],
    ]) {
      vi.stubEnv(name, '');
      expect(roleSyncConfig({ ...full, [name]: value })).toBeNull();
    }
  });
  it('does nothing at all when switched off', async () => {
    const fetchImpl = vi.fn();
    const store = memoryStore([person(1)]);
    expect(
      await syncDiscordRoles(null, { config: null, store, fetch: fetchImpl }),
    ).toMatchObject({ enabled: false });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(store.calls).toEqual([]);
    vi.stubEnv('DISCORD_ROLE_SYNC_ENABLED', '');
    const global = vi.spyOn(globalThis, 'fetch');
    await syncRolesAfter({ users: [uid(1)] });
    expect(global).not.toHaveBeenCalled();
    global.mockRestore();
  });
  it('accepts the sweep only with the configured tick secret', () => {
    const secret = 's'.repeat(40);
    expect(
      tickAuthorized(`Bearer ${secret}`, { DISCORD_ROLES_TICK_SECRET: secret }),
    ).toBe(true);
    expect(
      tickAuthorized(`Bearer ${secret}x`, {
        DISCORD_ROLES_TICK_SECRET: secret,
      }),
    ).toBe(false);
    expect(tickAuthorized(null, { DISCORD_ROLES_TICK_SECRET: secret })).toBe(
      false,
    );
    vi.stubEnv('DISCORD_ROLES_TICK_SECRET', '');
    expect(
      tickAuthorized('Bearer short', { DISCORD_ROLES_TICK_SECRET: 'short' }),
    ).toBe(false);
    expect(tickAuthorized('Bearer ', {})).toBe(false);
  });
  it('tick endpoint refuses strangers and is a no-op while switched off', async () => {
    const secret = 't'.repeat(40);
    vi.stubEnv('DISCORD_ROLES_TICK_SECRET', secret);
    vi.stubEnv('DISCORD_ROLE_SYNC_ENABLED', '');
    const call = (method: string, auth?: string) =>
      rolesTick({
        request: new Request('http://localhost/api/discord/roles/tick', {
          method,
          headers: auth ? { authorization: auth } : {},
        }),
      } as Parameters<typeof rolesTick>[0]) as Promise<Response>;
    expect((await call('GET')).status).toBe(405);
    expect((await call('POST')).status).toBe(401);
    expect((await call('POST', 'Bearer wrong')).status).toBe(401);
    const ok = await call('POST', `Bearer ${secret}`);
    expect(ok.status).toBe(200);
    const body = await ok.text();
    expect(JSON.parse(body)).toMatchObject({ enabled: false });
    expect(body).not.toContain(secret);
  });
});
