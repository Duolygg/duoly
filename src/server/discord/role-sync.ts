import { timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Discord role sync (ledger #40), a port of the original lib/discordRoles.js.
 *
 * Keeps the "Teammate", "Online" and "In Session" roles in the Duoly Discord server in sync:
 *   Teammate    every teammate with Discord connected (taken away if they stop being a teammate)
 *   Online      the dashboard toggle is on and the dashboard really checks in (20 s presence),
 *               or they're playing an order; suspended teammates are never Online
 *   In Session  they have an order in progress (removed on complete or reroll)
 *   Admins      Online while the admin panel is open, never In Session, and the bot never
 *               touches an admin's Teammate role
 * Only people who connected Discord and are members of the server get roles. Roles are found by
 * name in the server, exactly as in the original, and no other role is ever touched.
 *
 * The original ran every 5 seconds in an always-on process. On Vercel it runs right after the
 * actions that change the wanted roles (src/server/discord/role-hooks.ts) and as a reconcile
 * sweep from pg_cron (POST /api/discord/roles/tick). Only changes are sent to Discord.
 */

const API = 'https://discord.com/api/v10';
export const ROLE_KEYS = ['teammate', 'online', 'session'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
/** Role names in the server (case and surrounding spaces don't matter). */
export const ROLE_NAMES: Record<RoleKey, string> = {
  teammate: 'teammate',
  online: 'online',
  session: 'in session',
};
/** Same window as the dashboards (supabase presence: 20 seconds). */
export const PRESENCE_STALE_MS = 20_000;
/** Original: people who aren't in the server yet are checked again every 2 minutes. */
export const NOT_MEMBER_RECHECK_MS = 2 * 60_000;
/** Re-read a member's roles now and then, so hand-made changes in Discord get corrected. */
export const MEMBER_REFRESH_MS = 10 * 60_000;
/** Original: server roles are looked up again every 10 minutes. */
export const ROLES_CACHE_MS = 10 * 60_000;
const MAX_RETRY_WAIT_MS = 10_000;
const DISCORD_ID = /^[0-9]{17,20}$/;

// ---------------------------------------------------------------- config and gating

export interface RoleSyncConfig {
  token: string;
  guildId: string;
  supabaseUrl: string;
  supabaseSecretKey: string;
}
type Env = Record<string, string | undefined>;
const read = (env: Env | undefined, name: string): string | undefined => {
  const value: unknown =
    env?.[name] ?? process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

/** Null (feature off, every call is a no-op) unless switched on and fully configured. */
export function roleSyncConfig(env?: Env): RoleSyncConfig | null {
  if (read(env, 'DISCORD_ROLE_SYNC_ENABLED') !== 'true') return null;
  const token = read(env, 'DISCORD_BOT_TOKEN');
  const guildId = read(env, 'DISCORD_GUILD_ID');
  const supabaseUrl = read(env, 'SUPABASE_URL');
  const supabaseSecretKey = read(env, 'SUPABASE_SECRET_KEY');
  if (!token || !guildId || !DISCORD_ID.test(guildId)) return null;
  if (!supabaseUrl || !supabaseSecretKey) return null;
  return { token, guildId, supabaseUrl, supabaseSecretKey };
}

/** Bearer check for the pg_cron sweep. A missing or short secret refuses every call. */
export function tickAuthorized(header: string | null, env?: Env): boolean {
  const secret = read(env, 'DISCORD_ROLES_TICK_SECRET');
  if (!secret || secret.length < 32 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ---------------------------------------------------------------- wanted roles (pure)

/** One row of public.discord_role_facts. */
export interface Person {
  user_id: string;
  discord_id: string;
  role: 'teammate' | 'admin';
  suspended: boolean;
  desk_online: boolean;
  /** Last check-in, epoch milliseconds. */
  last_seen: number | null;
  busy: boolean;
}
export interface Want {
  userId: string;
  admin: boolean;
  /** undefined: leave the role alone (an admin's Teammate role is never ours). */
  teammate: boolean | undefined;
  online: boolean;
  session: boolean;
}

export function presenceFresh(person: Person, now: number): boolean {
  return (
    person.desk_online &&
    person.last_seen !== null &&
    now - person.last_seen < PRESENCE_STALE_MS
  );
}

/** Port of wanted() in lib/discordRoles.js plus the suspension rule of our presence. */
export function wantedRoles(person: Person, now: number): Want {
  const fresh = presenceFresh(person, now);
  if (person.role === 'admin')
    return {
      userId: person.user_id,
      admin: true,
      teammate: undefined,
      online: fresh,
      session: false,
    };
  const session = person.busy;
  return {
    userId: person.user_id,
    admin: false,
    teammate: true,
    online: !person.suspended && (session || fresh),
    session,
  };
}

/** Discord id to wanted roles. Unlinked people and customers are simply absent. */
export function wantedMap(people: Person[], now: number): Map<string, Want> {
  const out = new Map<string, Want>();
  for (const person of people) {
    if (!DISCORD_ID.test(person.discord_id)) continue;
    if (person.role !== 'teammate' && person.role !== 'admin') continue;
    out.set(person.discord_id, wantedRoles(person, now));
  }
  return out;
}

// ---------------------------------------------------------------- applied state and planning

/** One row of public.discord_role_sync: what the bot last saw or applied. */
export interface Applied {
  discord_id: string;
  user_id: string | null;
  teammate: boolean;
  online: boolean;
  session: boolean;
  admin: boolean;
  not_member: boolean;
  checked_at: string;
}
export type RoleIds = Partial<Record<RoleKey, string>>;

/** Wanted roles for someone nobody wants anymore: take away what we manage. */
export function releaseWant(current: Applied | undefined): Want {
  return {
    userId: current?.user_id ?? '',
    admin: false,
    teammate: current?.admin ? undefined : false,
    online: false,
    session: false,
  };
}

/** Does the stored state need a fresh read of the member from Discord first? */
export function needsMemberRead(
  current: Applied | undefined,
  now: number,
): boolean {
  if (!current) return true;
  const age = now - Date.parse(current.checked_at);
  if (!Number.isFinite(age)) return true;
  return current.not_member
    ? age > NOT_MEMBER_RECHECK_MS
    : age > MEMBER_REFRESH_MS;
}

/** The role changes to send: only differences, only the three managed roles. */
export function planChanges(
  want: Want,
  current: Pick<Applied, RoleKey>,
  roles: RoleIds,
): { key: RoleKey; add: boolean }[] {
  const changes: { key: RoleKey; add: boolean }[] = [];
  for (const key of ROLE_KEYS) {
    const wanted = want[key];
    if (!roles[key] || wanted === undefined) continue;
    if (wanted === current[key]) continue;
    changes.push({ key, add: wanted });
  }
  return changes;
}

// ---------------------------------------------------------------- Discord REST

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string> },
) => Promise<Response>;
export interface DiscordReply {
  status: number;
  body: unknown;
}

const warned = new Set<string>();
/** Logs a problem once per server instance. Never includes the token. */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[discord-roles] ${message}`);
}
export function resetRoleSyncMemory(): void {
  warned.clear();
  rolesCache = null;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Discord REST call as the bot. Retries a 429 after retry_after, at most 3 tries. */
export async function discordRequest(
  config: Pick<RoleSyncConfig, 'token'>,
  method: 'GET' | 'PUT' | 'DELETE',
  path: string,
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<DiscordReply> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(API + path, {
      method,
      headers: {
        authorization: `Bot ${config.token}`,
        'user-agent': 'DiscordBot (https://duoly.gg, 1.0)',
        'x-audit-log-reason': 'Duoly site activity',
      },
    });
    const body: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (response.status !== 429) return { status: response.status, body };
    const after = Number((body as { retry_after?: unknown })?.retry_after);
    await sleep(
      Math.min(
        MAX_RETRY_WAIT_MS,
        Math.ceil((Number.isFinite(after) && after > 0 ? after : 1) * 1000),
      ),
    );
  }
  return { status: 429, body: null };
}

let rolesCache: { guild: string; roles: RoleIds; at: number } | null = null;

/** The server's Teammate, Online and In Session role ids, found by name (original setup()). */
export async function serverRoles(
  config: RoleSyncConfig,
  now: number,
  fetchImpl?: FetchLike,
  sleep?: (ms: number) => Promise<void>,
): Promise<RoleIds | null> {
  if (
    rolesCache &&
    rolesCache.guild === config.guildId &&
    now - rolesCache.at < ROLES_CACHE_MS
  )
    return rolesCache.roles;
  const reply = await discordRequest(
    config,
    'GET',
    `/guilds/${config.guildId}/roles`,
    fetchImpl,
    sleep,
  );
  if (reply.status !== 200 || !Array.isArray(reply.body)) {
    warnOnce(
      `roles${reply.status}`,
      `can't read the server roles (${reply.status})`,
    );
    return null;
  }
  const list = reply.body as { id?: unknown; name?: unknown }[];
  const find = (name: string) => {
    const role = list.find(
      (entry) =>
        typeof entry.name === 'string' &&
        entry.name.trim().toLowerCase() === name,
    );
    return typeof role?.id === 'string' ? role.id : undefined;
  };
  const roles: RoleIds = {
    teammate: find(ROLE_NAMES.teammate),
    online: find(ROLE_NAMES.online),
    session: find(ROLE_NAMES.session),
  };
  if (!roles.teammate)
    warnOnce(
      'noteammate',
      'no "Teammate" role in the server, so only Online and In Session are synced',
    );
  if (!roles.online || !roles.session) {
    warnOnce(
      'missingroles',
      'create roles named "Online" and "In Session" in the server',
    );
    return null;
  }
  rolesCache = { guild: config.guildId, roles, at: now };
  return roles;
}

// ---------------------------------------------------------------- storage

export interface SyncScope {
  users?: string[];
  order?: string;
}
export interface RoleStore {
  facts(scope: SyncScope | null): Promise<{ now: number; people: Person[] }>;
  /** Every stored row (null) or the rows of these users. */
  applied(userIds: string[] | null): Promise<Applied[]>;
  save(rows: Applied[]): Promise<void>;
  remove(discordIds: string[]): Promise<void>;
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

const APPLIED_COLUMNS =
  'discord_id,user_id,teammate,online,session,admin,not_member,checked_at';

/** Service-role store: facts from the security-definer RPC, applied state from its table. */
export function supabaseRoleStore(config: RoleSyncConfig): RoleStore {
  const db = service(config);
  return {
    async facts(scope) {
      const { data, error } = await db.rpc('discord_role_facts', {
        p_users: scope ? (scope.users ?? []) : null,
        p_order: scope?.order ?? null,
      });
      if (error || !data || typeof data !== 'object')
        throw new Error('discord_role_facts failed');
      const value = data as { now?: unknown; people?: unknown };
      return {
        now: Number(value.now) || Date.now(),
        people: Array.isArray(value.people) ? (value.people as Person[]) : [],
      };
    },
    async applied(userIds) {
      const query = db.from('discord_role_sync').select(APPLIED_COLUMNS);
      if (userIds && !userIds.length) return [];
      const { data, error } = userIds
        ? await query.in('user_id', userIds)
        : await query;
      if (error) throw new Error('discord_role_sync read failed');
      return (data ?? []) as unknown as Applied[];
    },
    async save(rows) {
      if (!rows.length) return;
      const { error } = await db
        .from('discord_role_sync')
        .upsert(rows, { onConflict: 'discord_id' });
      if (error) throw new Error('discord_role_sync write failed');
    },
    async remove(discordIds) {
      if (!discordIds.length) return;
      const { error } = await db
        .from('discord_role_sync')
        .delete()
        .in('discord_id', discordIds);
      if (error) throw new Error('discord_role_sync delete failed');
    },
  };
}

// ---------------------------------------------------------------- the sync

export interface SyncDeps {
  config?: RoleSyncConfig | null;
  store?: RoleStore;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  /** Wall clock for deadlines and checked_at (tests). */
  clock?: () => number;
  /** Stop starting new members after this many milliseconds. */
  budgetMs?: number;
}
export interface SyncResult {
  enabled: boolean;
  ready: boolean;
  checked: number;
  changed: number;
  failed: number;
  deferred: number;
}

/**
 * One sync round, the port of sync() in lib/discordRoles.js. `scope` null is the full
 * reconcile sweep (everyone wanted plus everyone the bot gave roles to); otherwise only
 * the given users and the teammates of the given order.
 */
export async function syncDiscordRoles(
  scope: SyncScope | null,
  deps: SyncDeps = {},
): Promise<SyncResult> {
  const result: SyncResult = {
    enabled: false,
    ready: false,
    checked: 0,
    changed: 0,
    failed: 0,
    deferred: 0,
  };
  const config = deps.config === undefined ? roleSyncConfig() : deps.config;
  if (!config) return result;
  result.enabled = true;
  const clock = deps.clock ?? Date.now;
  const started = clock();
  const deadline = started + (deps.budgetMs ?? 20_000);
  const store = deps.store ?? supabaseRoleStore(config);
  const roles = await serverRoles(config, started, deps.fetch, deps.sleep);
  if (!roles) return result;
  result.ready = true;

  // The applied state is always read before the facts it is compared with, so a parallel
  // sync that already applied newer facts is never undone here with older ones. Wanted
  // people without a stored row are read from Discord itself.
  let users: string[] | null = null;
  if (scope) {
    const set = new Set(scope.users ?? []);
    if (scope.order)
      for (const person of (await store.facts({ order: scope.order })).people)
        set.add(person.user_id);
    users = [...set];
  }
  const appliedRows = await store.applied(users);
  const facts = await store.facts(users ? { users } : null);
  const want = wantedMap(facts.people, facts.now);
  const applied = new Map(appliedRows.map((row) => [row.discord_id, row]));

  const save: Applied[] = [];
  const remove: string[] = [];
  const ids = [...new Set([...want.keys(), ...applied.keys()])];
  for (const did of ids) {
    if (!DISCORD_ID.test(did)) continue;
    if (clock() > deadline) {
      result.deferred++;
      continue;
    }
    const stored = applied.get(did);
    const wanted = want.get(did) ?? releaseWant(stored);
    let current: Applied | undefined = stored ? { ...stored } : undefined;
    let dirty = false;
    const now = clock();
    if (needsMemberRead(current, now)) {
      const reply = await discordRequest(
        config,
        'GET',
        `/guilds/${config.guildId}/members/${did}`,
        deps.fetch,
        deps.sleep,
      );
      if (reply.status === 200) {
        const memberRoles = Array.isArray(
          (reply.body as { roles?: unknown })?.roles,
        )
          ? ((reply.body as { roles: unknown[] }).roles as string[])
          : [];
        current = {
          discord_id: did,
          user_id: wanted.userId || current?.user_id || null,
          teammate: !!roles.teammate && memberRoles.includes(roles.teammate),
          online: !!roles.online && memberRoles.includes(roles.online),
          session: !!roles.session && memberRoles.includes(roles.session),
          admin: current?.admin ?? false,
          not_member: false,
          checked_at: new Date(now).toISOString(),
        };
      } else if (reply.status === 404) {
        current = {
          discord_id: did,
          user_id: wanted.userId || current?.user_id || null,
          teammate: false,
          online: false,
          session: false,
          admin: current?.admin ?? false,
          not_member: true,
          checked_at: new Date(now).toISOString(),
        };
      } else {
        if (reply.status === 403)
          warnOnce(
            'memberperm',
            `can't read server members (${reply.status}): check the bot is still in the server`,
          );
        result.failed++;
        continue;
      }
      dirty = true;
      result.checked++;
    }
    if (!current) continue;
    if (want.has(did)) {
      // Seen as an admin: their Teammate role is left alone even after they leave.
      if (current.admin !== wanted.admin) {
        current.admin = wanted.admin;
        dirty = true;
      }
      if (wanted.userId && current.user_id !== wanted.userId) {
        current.user_id = wanted.userId;
        dirty = true;
      }
    }
    if (!current.not_member) {
      for (const change of planChanges(wanted, current, roles)) {
        const reply = await discordRequest(
          config,
          change.add ? 'PUT' : 'DELETE',
          `/guilds/${config.guildId}/members/${did}/roles/${roles[change.key]}`,
          deps.fetch,
          deps.sleep,
        );
        if (
          reply.status === 204 ||
          (reply.status >= 200 && reply.status < 300)
        ) {
          current[change.key] = change.add;
          dirty = true;
          result.changed++;
        } else if (reply.status === 403) {
          warnOnce(
            'perm',
            'no permission to change roles: give the bot "Manage Roles" and drag its role above Teammate, Online and In Session',
          );
          result.failed++;
        } else if (reply.status === 404) {
          if ((reply.body as { code?: unknown })?.code === 10011) {
            rolesCache = null; // a role was deleted or renamed: look them up again next time
            result.failed++;
            break;
          }
          current.not_member = true;
          current.teammate = current.online = current.session = false;
          current.checked_at = new Date(clock()).toISOString();
          dirty = true;
          break;
        } else result.failed++;
      }
    }
    // Forget people who no longer need anything (unlinked, not a teammate anymore).
    const done =
      !want.has(did) &&
      (current.not_member ||
        (!current.online &&
          !current.session &&
          (current.admin || !current.teammate)));
    if (done) {
      if (stored) remove.push(did);
    } else if (dirty) save.push(current);
  }
  await store.save(save);
  await store.remove(remove);
  return result;
}
