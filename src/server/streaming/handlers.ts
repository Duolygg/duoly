import type { APIRoute } from 'astro';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { accountContext } from '../auth/context';
import { authConfig } from '../auth/config';
import { mutation } from '../auth/handlers';
import { UPLOADED_AVATAR } from '../../contracts/account';
import {
  PublicStreamerSchema,
  StreamerDeskCommandSchema,
  StreamerDeskResponseSchema,
  type PublicStreamer,
} from '../../contracts/streaming';

/**
 * Twitch streaming (migration 20261105100000_twitch_streaming.sql).
 * GET/POST /api/teammate/streaming: the streamer's own panel.
 * GET /api/home/streamers: public list of streamers bookable right now.
 */

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
const untyped = (client: SupabaseClient) =>
  client.rpc.bind(client) as unknown as Rpc;

export const teammateStreaming: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (!['GET', 'POST'].includes(context.request.method)) {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET, POST');
      return response;
    }
    let command: ReturnType<typeof StreamerDeskCommandSchema.parse> | null =
      null;
    if (context.request.method === 'POST') {
      const prepared = await mutation(context, 2048);
      account = prepared.account;
      if (prepared.failure) return prepared.failure;
      const parsed = StreamerDeskCommandSchema.safeParse(prepared.body);
      if (!parsed.success)
        return account.json(
          { error: 'Check your rate, hours and Twitch username.' },
          400,
        );
      command = parsed.data;
    }
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json({ error: 'Teammates only.' }, 403);
    const rpc = untyped(account.client as unknown as SupabaseClient);
    const { data, error } = command
      ? await rpc('streamer_desk_save', {
          p_online: command.online,
          p_rate_eur_cents: command.rateEurCents,
          p_durations: command.durations,
          p_twitch: command.twitch,
        })
      : await rpc('streamer_desk');
    if (error || !data || typeof data !== 'object')
      return account.json({ error: 'Streaming is unavailable.' }, 503);
    const refusal = (data as { error?: { code?: unknown; message?: unknown } })
      .error;
    if (refusal) {
      const code = Number(refusal.code);
      return account.json(
        {
          error:
            typeof refusal.message === 'string'
              ? refusal.message
              : 'Could not save your streaming settings.',
        },
        code >= 400 && code < 600 ? code : 400,
      );
    }
    const parsed = StreamerDeskResponseSchema.safeParse(data);
    return parsed.success
      ? account.json(parsed.data)
      : account.json({ error: 'Streaming is unavailable.' }, 503);
  } catch {
    return account.json({ error: 'Streaming is unavailable.' }, 503);
  }
};

const AVATAR = /^\/assets\/avatars\/avatar-([1-9]|10)\.png$/;

/** Maps home_streamers() rows; anything malformed is dropped. */
export function mapStreamers(raw: unknown): PublicStreamer[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicStreamer[] = [];
  for (const row of raw.slice(0, 50)) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const image =
      typeof r.image === 'string' &&
      (AVATAR.test(r.image) || UPLOADED_AVATAR.test(r.image))
        ? r.image
        : null;
    const rating = r.rating == null ? null : Number(r.rating);
    const parsed = PublicStreamerSchema.safeParse({
      ...r,
      image,
      rating: rating != null && Number.isFinite(rating) ? rating : null,
      twitch: typeof r.twitch === 'string' ? r.twitch : null,
    });
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export const HOME_STREAMERS_CACHE_CONTROL =
  'public, max-age=5, s-maxage=10, stale-while-revalidate=20';

let publicDb: { key: string; client: SupabaseClient } | null = null;
function publicClient(): SupabaseClient | null {
  const config = authConfig();
  if (!config) return null;
  const key = `${config.url} ${config.publishableKey}`;
  if (publicDb?.key !== key)
    publicDb = {
      key,
      client: createClient(config.url, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  return publicDb.client;
}

export async function homeStreamers(
  load: () => PromiseLike<{ data: unknown; error: unknown }> = () => {
    const db = publicClient();
    return db
      ? untyped(db)('home_streamers')
      : Promise.resolve({ data: [], error: null });
  },
): Promise<{ streamers: PublicStreamer[] }> {
  try {
    const { data, error } = await load();
    return { streamers: error ? [] : mapStreamers(data) };
  } catch {
    return { streamers: [] };
  }
}

/** Public: short CDN cache, because "online now" must stay current. */
export const homeStreamersRoute: APIRoute = async () =>
  new Response(JSON.stringify(await homeStreamers()), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': HOME_STREAMERS_CACHE_CONTROL,
    },
  });
