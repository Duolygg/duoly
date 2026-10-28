import type { APIRoute } from 'astro';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { tickAuthorized } from './role-sync';
import {
  closedPost,
  openPost,
  POST_AFTER_MS,
  POST_GAMES,
  type CloseOutcome,
  type PostOrder,
} from './order-posts';

/**
 * Order posts runner (ledger #41, the original's lib/discordQueue.js run()). Called by pg_cron
 * every 10 seconds: first edits the posts whose order moved on, then posts the orders that have
 * waited 100 seconds. Gated by DISCORD_ORDER_POSTS_ENABLED; Discord errors never throw out.
 */

const API = 'https://discord.com/api/v10';
const CHANNELS_CACHE_MS = 10 * 60_000;
const MAX_RETRY_WAIT_MS = 5_000;
const DISCORD_ID = /^[0-9]{17,20}$/;

type Env = Record<string, string | undefined>;
const read = (env: Env | undefined, name: string): string | undefined => {
  const value: unknown =
    env?.[name] ?? process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

export interface OrderPostsConfig {
  token: string;
  guildId: string;
  supabaseUrl: string;
  supabaseSecretKey: string;
  silent: boolean;
}

export function orderPostsConfig(env?: Env): OrderPostsConfig | null {
  if (read(env, 'DISCORD_ORDER_POSTS_ENABLED') !== 'true') return null;
  const token = read(env, 'DISCORD_BOT_TOKEN');
  const guildId = read(env, 'DISCORD_GUILD_ID');
  const supabaseUrl = read(env, 'SUPABASE_URL');
  const supabaseSecretKey = read(env, 'SUPABASE_SECRET_KEY');
  if (!token || !guildId || !DISCORD_ID.test(guildId)) return null;
  if (!supabaseUrl || !supabaseSecretKey) return null;
  return {
    token,
    guildId,
    supabaseUrl,
    supabaseSecretKey,
    silent: read(env, 'DISCORD_ORDER_POSTS_SILENT') === 'true',
  };
}

// ------------------------------------------------------------------ Discord REST

export type JsonFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<Response>;

const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[discord-orders] ${message}`);
}

export async function discordJson(
  config: Pick<OrderPostsConfig, 'token'>,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body: unknown,
  fetchImpl: JsonFetch = fetch,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<{ status: number; body: unknown }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(API + path, {
      method,
      headers: {
        authorization: `Bot ${config.token}`,
        'user-agent': 'DiscordBot (https://duoly.gg, 1.0)',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const parsed: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (response.status !== 429)
      return { status: response.status, body: parsed };
    const after = Number((parsed as { retry_after?: unknown })?.retry_after);
    await sleep(
      Math.min(
        MAX_RETRY_WAIT_MS,
        Math.ceil((Number.isFinite(after) && after > 0 ? after : 1) * 1000),
      ),
    );
  }
  return { status: 429, body: null };
}

// "League of Legends" = "league-of-legends" = "💬general"; accents and emojis don't count
export const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

interface Channel {
  id: string;
  type: number;
  name: string;
  parent_id?: string | null;
  position?: number;
}

/** game id to text channel id: the "general" channel under the category named after the game. */
export function channelMap(channels: Channel[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const game of Object.values(POST_GAMES)) {
    const names = [norm(game.name), norm(game.short)];
    const category = channels.find(
      (c) => c.type === 4 && names.includes(norm(c.name)),
    );
    if (!category) continue;
    const text = channels
      .filter((c) => c.type === 0 && c.parent_id === category.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const channel =
      text.find((c) => norm(c.name).includes('general')) ?? text[0];
    if (channel) map[game.id] = channel.id;
  }
  return map;
}

let cache: {
  guild: string;
  at: number;
  channels: Record<string, string>;
  teammateRole: string | null;
} | null = null;
export function resetOrderPostsMemory(): void {
  cache = null;
  warned.clear();
}

async function server(
  config: OrderPostsConfig,
  now: number,
  fetchImpl?: JsonFetch,
): Promise<typeof cache> {
  if (
    cache &&
    cache.guild === config.guildId &&
    now - cache.at < CHANNELS_CACHE_MS
  )
    return cache;
  const [channels, roles] = await Promise.all([
    discordJson(
      config,
      'GET',
      `/guilds/${config.guildId}/channels`,
      undefined,
      fetchImpl,
    ),
    discordJson(
      config,
      'GET',
      `/guilds/${config.guildId}/roles`,
      undefined,
      fetchImpl,
    ),
  ]);
  if (channels.status !== 200 || !Array.isArray(channels.body)) {
    warnOnce(
      `channels${channels.status}`,
      `can't read the server channels (${channels.status})`,
    );
    return null;
  }
  const teammate = Array.isArray(roles.body)
    ? (roles.body as { id?: unknown; name?: unknown }[]).find(
        (r) =>
          typeof r.name === 'string' &&
          r.name.trim().toLowerCase() === 'teammate',
      )
    : undefined;
  cache = {
    guild: config.guildId,
    at: now,
    channels: channelMap(channels.body as Channel[]),
    teammateRole: typeof teammate?.id === 'string' ? teammate.id : null,
  };
  return cache;
}

// ------------------------------------------------------------------ storage

interface DueOrder extends Omit<PostOrder, 'queuedAt' | 'cancelsAt'> {
  id: string;
  queuedAt: string;
  cancelsAt: string;
}
interface ToClose {
  post: string;
  channelId: string;
  messageId: string;
  outcome: CloseOutcome;
  reference: string;
  game: string;
  title: string;
  units: number;
  unit: string;
  at: string;
  teammate: string | null;
  waitedMs: number | null;
}

export interface OrderPostStore {
  due(afterSeconds: number): Promise<DueOrder[]>;
  claim(
    order: string,
    queueKey: string,
    channel: string,
  ): Promise<{ post: string; token: string } | null>;
  saved(post: string, message: string): Promise<void>;
  failed(post: string): Promise<void>;
  toClose(): Promise<ToClose[]>;
  closed(post: string, outcome: CloseOutcome | 'gone'): Promise<void>;
}

let client: { key: string; client: SupabaseClient } | null = null;
export function supabaseOrderPostStore(
  config: OrderPostsConfig,
): OrderPostStore {
  if (client?.key !== config.supabaseSecretKey)
    client = {
      key: config.supabaseSecretKey,
      client: createClient(config.supabaseUrl, config.supabaseSecretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  const db = client.client;
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(name as never, args as never);
    if (error) throw new Error(`${name}: ${error.message}`);
    return data as unknown;
  };
  return {
    due: async (afterSeconds) =>
      ((await rpc('discord_order_posts_due', {
        p_after_seconds: afterSeconds,
      })) ?? []) as DueOrder[],
    claim: async (order, queueKey, channel) =>
      ((await rpc('discord_order_post_claim', {
        p_order_id: order,
        p_queue_key: queueKey,
        p_channel_id: channel,
      })) ?? null) as { post: string; token: string } | null,
    saved: async (post, message) => {
      await rpc('discord_order_post_saved', {
        p_post_id: post,
        p_message_id: message,
      });
    },
    failed: async (post) => {
      await rpc('discord_order_post_failed', { p_post_id: post });
    },
    toClose: async () =>
      ((await rpc('discord_order_posts_to_close', {})) ?? []) as ToClose[],
    closed: async (post, outcome) => {
      await rpc('discord_order_post_closed', {
        p_post_id: post,
        p_outcome: outcome,
      });
    },
  };
}

// ------------------------------------------------------------------ the run

export interface OrderPostsResult {
  posted: number;
  closed: number;
  skipped: number;
  failed: number;
}

export async function runOrderPosts(
  config: OrderPostsConfig,
  site: string,
  deps: { store?: OrderPostStore; fetchImpl?: JsonFetch; now?: number } = {},
): Promise<OrderPostsResult> {
  const store = deps.store ?? supabaseOrderPostStore(config);
  const now = deps.now ?? Date.now();
  const result: OrderPostsResult = {
    posted: 0,
    closed: 0,
    skipped: 0,
    failed: 0,
  };

  for (const p of await store.toClose()) {
    const reply = await discordJson(
      config,
      'PATCH',
      `/channels/${p.channelId}/messages/${p.messageId}`,
      closedPost(
        {
          order: {
            reference: p.reference,
            game: p.game,
            title: p.title,
            units: p.units,
            unit: p.unit,
          },
          outcome: p.outcome,
          at: Date.parse(p.at) || now,
          teammate: p.teammate,
          waitedMs: p.waitedMs,
        },
        { site },
      ),
      deps.fetchImpl,
    );
    // deleted by a moderator counts as closed too
    if (reply.status === 200 || reply.status === 404) {
      await store.closed(p.post, reply.status === 404 ? 'gone' : p.outcome);
      result.closed++;
    } else {
      warnOnce(
        `edit${reply.status}`,
        `couldn't edit an order post (${reply.status})`,
      );
      result.failed++;
    }
  }

  const due = await store.due(Math.round(POST_AFTER_MS / 1000));
  if (!due.length) return result;
  const guild = await server(config, now, deps.fetchImpl);
  if (!guild) return { ...result, skipped: result.skipped + due.length };

  for (const o of due) {
    const channel = guild.channels[o.game];
    if (!channel) {
      warnOnce(
        `nochannel${o.game}`,
        `no channel for ${o.game} (make a category named after the game with a "general" channel)`,
      );
      result.skipped++;
      continue;
    }
    const claim = await store.claim(o.id, o.queuedAt, channel);
    if (!claim) {
      result.skipped++;
      continue;
    }
    const claimUrl = new URL(
      `/claim/${encodeURIComponent(claim.token)}`,
      site,
    ).toString();
    const reply = await discordJson(
      config,
      'POST',
      `/channels/${channel}/messages`,
      openPost(
        {
          ...o,
          queuedAt: Date.parse(o.queuedAt),
          cancelsAt: Date.parse(o.cancelsAt),
        },
        claimUrl,
        { site, roleId: guild.teammateRole, silent: config.silent },
      ),
      deps.fetchImpl,
    );
    const id = (reply.body as { id?: unknown } | null)?.id;
    if (reply.status === 200 && typeof id === 'string') {
      await store.saved(claim.post, id);
      result.posted++;
    } else {
      warnOnce(
        `post${reply.status}`,
        `couldn't post an order in ${o.game} (${reply.status})`,
      );
      await store.failed(claim.post);
      result.failed++;
    }
  }
  return result;
}

/** POST /api/discord/orders/tick, called by pg_cron every 10 seconds. */
export const ordersTick: APIRoute = async ({ request }) => {
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
  const config = orderPostsConfig();
  if (!config)
    return new Response(JSON.stringify({ off: true }), {
      status: 200,
      headers,
    });
  try {
    const result = await runOrderPosts(config, new URL(request.url).origin);
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'posts_failed' }), {
      status: 503,
      headers,
    });
  }
};
