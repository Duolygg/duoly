import type { APIRoute } from 'astro';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  discordRequest,
  roleSyncConfig,
  tickAuthorized,
  type FetchLike,
  type RoleSyncConfig,
} from '../discord/role-sync';
import {
  BRACKETS,
  bracketRoleName,
  type Bracket,
  type SyncStatus,
} from '../../contracts/performance';

/** Canonical roles are provisioned by an operator, never discovered by name or created here. */
export type RoleIdsByBracket = Record<Bracket, string>;
export interface CleanupIdentity {
  discordId: string;
  token: string;
}
export interface PerformanceTarget {
  userId: string;
  discordId: string | null;
  bracket: Bracket | null;
  version: string;
  cleanup: CleanupIdentity[];
}
export interface PerformanceSyncRow extends PerformanceTarget {
  status: SyncStatus;
  detail: string;
  cleaned: CleanupIdentity[];
  applied: boolean;
}
export interface PerformanceStore {
  targets(): Promise<PerformanceTarget[]>;
  save(rows: PerformanceSyncRow[]): Promise<void>;
}
const DISCORD_ID = /^[0-9]{17,20}$/;

export function configuredPerformanceRoleIds(
  raw: string | undefined,
): RoleIdsByBracket | null {
  try {
    const value: unknown = JSON.parse(raw ?? '');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const ids = value as Record<string, unknown>;
    if (Object.keys(ids).length !== BRACKETS.length) return null;
    if (
      !BRACKETS.every(
        (b) => typeof ids[b] === 'string' && DISCORD_ID.test(ids[b] as string),
      )
    )
      return null;
    if (new Set(Object.values(ids)).size !== BRACKETS.length) return null;
    return ids as RoleIdsByBracket;
  } catch {
    return null;
  }
}

/** Validate every configured ID against the guild. No mutation or name adoption on any failure. */
export async function performanceRoleIds(
  config: RoleSyncConfig,
  fetchImpl?: FetchLike,
  sleep?: (ms: number) => Promise<void>,
  raw = process.env.PERFORMANCE_ROLE_IDS ??
    import.meta.env?.PERFORMANCE_ROLE_IDS,
): Promise<RoleIdsByBracket | null> {
  const ids = configuredPerformanceRoleIds(raw);
  if (!ids) return null;
  const reply = await discordRequest(
    config,
    'GET',
    `/guilds/${config.guildId}/roles`,
    fetchImpl,
    sleep,
  );
  if (reply.status !== 200 || !Array.isArray(reply.body)) return null;
  const roles = reply.body as {
    id?: unknown;
    name?: unknown;
    permissions?: unknown;
    managed?: unknown;
  }[];
  for (const bracket of BRACKETS) {
    const role = roles.find((r) => r.id === ids[bracket]);
    if (
      !role ||
      role.name !== bracketRoleName(bracket) ||
      role.permissions !== '0' ||
      role.managed !== false
    )
      return null;
  }
  return ids;
}

export function planPerformanceRoles(
  memberRoles: string[],
  ids: RoleIdsByBracket,
  bracket: Bracket | null,
): { add: string[]; remove: string[] } {
  const want = bracket ? ids[bracket] : null;
  const ours = new Set(Object.values(ids));
  return {
    add: want && !memberRoles.includes(want) ? [want] : [],
    remove: memberRoles.filter((id) => ours.has(id) && id !== want),
  };
}
export interface PerformanceSyncResult {
  off?: true;
  synced: number;
  skipped: number;
  errors: number;
}

/** Snapshots reserve identities before HTTP. Acks cannot overwrite newer identity or ranking state. */
export async function syncPerformanceRoles(
  config: RoleSyncConfig,
  store: PerformanceStore,
  fetchImpl?: FetchLike,
  sleep?: (ms: number) => Promise<void>,
): Promise<PerformanceSyncResult> {
  const targets = await store.targets();
  const result: PerformanceSyncResult = { synced: 0, skipped: 0, errors: 0 };
  if (!targets.length) return result;
  const ids = await performanceRoleIds(config, fetchImpl, sleep);
  for (const target of targets) {
    const row: PerformanceSyncRow = {
      ...target,
      status: 'error',
      detail: '',
      cleaned: [],
      applied: false,
    };
    try {
      if (!ids)
        throw new Error(
          'Invalid PERFORMANCE_ROLE_IDS or unsafe guild roles. Operator inspection required.',
        );
      // All former identities must be clean before the current identity can gain a role.
      for (const former of target.cleanup) {
        const status = await reconcile(former.discordId, null, ids);
        if (status === 'synced' || status === 'not_member')
          row.cleaned.push(former);
      }
      if (!target.discordId) row.status = 'no_discord';
      else {
        row.status = await reconcile(target.discordId, target.bracket, ids);
        row.applied = row.status === 'synced';
      }
    } catch (error) {
      row.status = 'error';
      row.detail =
        error instanceof Error
          ? error.message.slice(0, 200)
          : 'Discord role sync failed.';
    }
    // Persist each result immediately, including partial cleanup. Reserved IDs survive a crashed run.
    await store.save([row]);
    if (row.status === 'error') result.errors++;
    else if (row.status === 'synced') result.synced++;
    else result.skipped++;
  }
  return result;

  async function reconcile(
    discordId: string,
    bracket: Bracket | null,
    roleIds: RoleIdsByBracket,
  ): Promise<'synced' | 'not_member'> {
    if (!DISCORD_ID.test(discordId))
      throw new Error('Invalid Discord identity.');
    const base = `/guilds/${config.guildId}/members/${discordId}`;
    const member = await discordRequest(config, 'GET', base, fetchImpl, sleep);
    if (member.status === 404) return 'not_member';
    const roles = (member.body as { roles?: unknown } | null)?.roles;
    if (member.status !== 200 || !Array.isArray(roles))
      throw new Error(`Discord answered ${member.status} reading the member.`);
    const plan = planPerformanceRoles(
      roles.filter((r): r is string => typeof r === 'string'),
      roleIds,
      bracket,
    );
    for (const [method, list] of [
      ['DELETE', plan.remove],
      ['PUT', plan.add],
    ] as const) {
      for (const role of list) {
        const reply = await discordRequest(
          config,
          method,
          `${base}/roles/${role}`,
          fetchImpl,
          sleep,
        );
        if (reply.status !== 204 && reply.status !== 200)
          throw new Error(
            `Discord answered ${reply.status} changing a role. Check the bot role hierarchy.`,
          );
      }
    }
    return 'synced';
  }
}

let serviceClient: { key: string; client: SupabaseClient } | null = null;
function service(config: RoleSyncConfig): SupabaseClient {
  if (serviceClient?.key !== config.supabaseSecretKey)
    serviceClient = {
      key: config.supabaseSecretKey,
      client: createClient(config.supabaseUrl, config.supabaseSecretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  return serviceClient.client;
}
export function supabasePerformanceStore(
  config: RoleSyncConfig,
): PerformanceStore {
  const db = service(config);
  return {
    async targets() {
      const { data, error } = await db.rpc('performance_role_targets');
      if (error || !Array.isArray(data))
        throw new Error('performance_role_targets failed');
      return (data as Record<string, unknown>[]).map((row) => {
        if (
          typeof row.userId !== 'string' ||
          typeof row.version !== 'string' ||
          !Array.isArray(row.cleanup)
        )
          throw new Error('Invalid performance snapshot');
        return {
          userId: row.userId,
          discordId: typeof row.discordId === 'string' ? row.discordId : null,
          bracket: (BRACKETS as readonly unknown[]).includes(row.bracket)
            ? (row.bracket as Bracket)
            : null,
          version: row.version,
          cleanup: row.cleanup.map((item: unknown) => {
            const identity = item as Record<string, unknown>;
            if (
              !identity ||
              typeof identity.discordId !== 'string' ||
              typeof identity.token !== 'string'
            )
              throw new Error('Invalid cleanup snapshot');
            return { discordId: identity.discordId, token: identity.token };
          }),
        };
      });
    },
    async save(rows) {
      if (!rows.length) return;
      const { error } = await db.rpc('performance_set_sync', { p_rows: rows });
      if (error) throw new Error('performance_set_sync failed');
    },
  };
}
export async function syncPerformanceRolesNow(): Promise<PerformanceSyncResult> {
  const config = roleSyncConfig();
  if (!config) return { off: true, synced: 0, skipped: 0, errors: 0 };
  try {
    return await syncPerformanceRoles(config, supabasePerformanceStore(config));
  } catch {
    return { synced: 0, skipped: 0, errors: 1 };
  }
}
export const performanceSync: APIRoute = async ({ request }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  if (request.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...headers, Allow: 'POST' },
    });
  if (!tickAuthorized(request.headers.get('authorization')))
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers,
    });
  const result = await syncPerformanceRolesNow();
  return new Response(JSON.stringify(result), {
    status: result.errors && !result.synced ? 503 : 200,
    headers,
  });
};
