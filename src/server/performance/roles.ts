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
  BRACKET_COLORS,
  bracketRoleName,
  type Bracket,
  type SyncStatus,
} from '../../contracts/performance';

/**
 * Performance roles in the Duoly Discord server (migration 20261030120000).
 *
 * Each ranked teammate has exactly one "Performance | TOP X%" role; everyone else has none. The
 * five roles are found by exact name and created with their colour when missing. Only these five
 * roles are ever added or removed here. Runs after every recalculation: pg_cron every 12 hours
 * (POST /api/performance/sync with the roles tick secret) and an admin's manual recalculation.
 * Uses the same switch and bot as the Teammate, Online and In Session sync (DISCORD_ROLE_SYNC_ENABLED).
 */

export interface PerformanceTarget {
  userId: string;
  discordId: string | null;
  bracket: Bracket | null;
}
export interface PerformanceSyncRow {
  userId: string;
  status: SyncStatus;
  detail: string;
}
export interface PerformanceStore {
  targets(): Promise<PerformanceTarget[]>;
  save(rows: PerformanceSyncRow[]): Promise<void>;
}
export type RoleIdsByBracket = Record<Bracket, string>;

const DISCORD_ID = /^[0-9]{17,20}$/;
const sameName = (a: unknown, b: string) =>
  typeof a === 'string' && a.trim().toLowerCase() === b.toLowerCase();

/** The five role ids, creating any that are missing. Null when Discord refuses. */
export async function performanceRoleIds(
  config: RoleSyncConfig,
  fetchImpl?: FetchLike,
  sleep?: (ms: number) => Promise<void>,
): Promise<RoleIdsByBracket | null> {
  const reply = await discordRequest(
    config,
    'GET',
    `/guilds/${config.guildId}/roles`,
    fetchImpl,
    sleep,
  );
  if (reply.status !== 200 || !Array.isArray(reply.body)) return null;
  const list = reply.body as { id?: unknown; name?: unknown }[];
  const ids: Partial<RoleIdsByBracket> = {};
  for (const bracket of BRACKETS) {
    const name = bracketRoleName(bracket);
    const found = list.find((role) => sameName(role.name, name));
    if (typeof found?.id === 'string') {
      ids[bracket] = found.id;
      continue;
    }
    const created = await discordRequest(
      config,
      'POST',
      `/guilds/${config.guildId}/roles`,
      fetchImpl,
      sleep,
      {
        name,
        color: Number.parseInt(BRACKET_COLORS[bracket].slice(1), 16),
        hoist: false,
        mentionable: false,
        permissions: '0',
      },
    );
    const id = (created.body as { id?: unknown } | null)?.id;
    if (created.status !== 200 || typeof id !== 'string') return null;
    ids[bracket] = id;
  }
  return ids as RoleIdsByBracket;
}

/** Pure: which performance roles to add and remove so the member holds exactly the wanted one. */
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
  if (!ids) {
    await store.save(
      targets.map((t) => ({
        userId: t.userId,
        status: 'error',
        detail:
          'Could not read or create the performance roles (the bot needs Manage Roles)',
      })),
    );
    return { ...result, errors: targets.length };
  }
  const rows: PerformanceSyncRow[] = [];
  for (const t of targets) {
    if (!t.discordId || !DISCORD_ID.test(t.discordId)) {
      rows.push({ userId: t.userId, status: 'no_discord', detail: '' });
      result.skipped++;
      continue;
    }
    const base = `/guilds/${config.guildId}/members/${t.discordId}`;
    const member = await discordRequest(config, 'GET', base, fetchImpl, sleep);
    if (member.status === 404) {
      rows.push({ userId: t.userId, status: 'not_member', detail: '' });
      result.skipped++;
      continue;
    }
    const roles = (member.body as { roles?: unknown } | null)?.roles;
    if (member.status !== 200 || !Array.isArray(roles)) {
      rows.push({
        userId: t.userId,
        status: 'error',
        detail: `Discord answered ${member.status} reading the member`,
      });
      result.errors++;
      continue;
    }
    const plan = planPerformanceRoles(
      roles.filter((r): r is string => typeof r === 'string'),
      ids,
      t.bracket,
    );
    let failed = '';
    for (const [method, list] of [
      ['DELETE', plan.remove],
      ['PUT', plan.add],
    ] as const)
      for (const role of list) {
        const reply = await discordRequest(
          config,
          method,
          `${base}/roles/${role}`,
          fetchImpl,
          sleep,
        );
        if (reply.status !== 204 && reply.status !== 200)
          failed = `Discord answered ${reply.status} changing a role (is the bot's role above the performance roles?)`;
      }
    rows.push({
      userId: t.userId,
      status: failed ? 'error' : 'synced',
      detail: failed,
    });
    if (failed) result.errors++;
    else result.synced++;
  }
  await store.save(rows);
  return result;
}

// ---------------------------------------------------------------- storage (service key)

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
      return (data as Record<string, unknown>[])
        .filter((row) => typeof row.userId === 'string')
        .map((row) => ({
          userId: row.userId as string,
          discordId: typeof row.discordId === 'string' ? row.discordId : null,
          bracket: (BRACKETS as readonly unknown[]).includes(row.bracket)
            ? (row.bracket as Bracket)
            : null,
        }));
    },
    async save(rows) {
      if (!rows.length) return;
      const { error } = await db.rpc('performance_set_sync', { p_rows: rows });
      if (error) throw new Error('performance_set_sync failed');
    },
  };
}

/** Runs the sync when Discord is switched on; never throws (callers are cron and admin actions). */
export async function syncPerformanceRolesNow(): Promise<PerformanceSyncResult> {
  const config = roleSyncConfig();
  if (!config) return { off: true, synced: 0, skipped: 0, errors: 0 };
  try {
    return await syncPerformanceRoles(config, supabasePerformanceStore(config));
  } catch {
    return { synced: 0, skipped: 0, errors: 1 };
  }
}

/** POST /api/performance/sync: called by pg_cron right after the 12-hourly recalculation. */
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
