/**
 * Analytics outbox drain (POSTHOG-SPEC section 8). Called every minute by pg_cron with a
 * bearer secret. Claims queued marketplace facts, decides identity from the consent snapshot
 * at delivery time, and posts one batch to PostHog. Rows are only marked sent after PostHog
 * answered 200; rate limits, outages and network errors release them for the next run, and the
 * database parks a row after 10 attempts. PostHog deduplicates on the row uuid.
 */
import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  OUTBOX_EVENT_CATALOGUE,
  serverCatalogueProps,
} from '../../contracts/analytics-events';
import { uuidv5 } from './client';

type Env = Record<string, string | undefined>;
const read = (env: Env | undefined, name: string): string | undefined => {
  const value: unknown =
    env?.[name] ?? process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

export interface OutboxRow {
  id: number;
  event: string;
  occurred_at: string;
  user_id: string | null;
  properties: Record<string, unknown> | null;
  uuid: string;
}

export interface DrainConfig {
  key: string;
  host: string;
  internalIds: Set<string>;
}

export function drainConfig(env?: Env): DrainConfig | null {
  if (read(env, 'PUBLIC_ANALYTICS_ENABLED') !== 'true') return null;
  const key = read(env, 'PUBLIC_POSTHOG_KEY');
  if (!key) return null;
  return {
    key,
    host: (
      read(env, 'PUBLIC_POSTHOG_HOST') ?? 'https://eu.i.posthog.com'
    ).replace(/\/+$/, ''),
    internalIds: new Set(
      (read(env, 'ANALYTICS_INTERNAL_USER_IDS') ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  };
}

export function drainAuthorized(header: string | null, env?: Env): boolean {
  const secret = read(env, 'ANALYTICS_DRAIN_SECRET');
  if (!secret || secret.length < 32 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** One PostHog batch item, or null when the row is not a catalogued fact. */
export function toCapture(
  row: OutboxRow,
  consented: ReadonlySet<string>,
  internalIds: ReadonlySet<string>,
): Record<string, unknown> | null {
  if (!Object.hasOwn(OUTBOX_EVENT_CATALOGUE, row.event)) return null;
  const properties = serverCatalogueProps(row.event, row.properties ?? {});
  if (!properties) return null;
  const identified = !!row.user_id && consented.has(row.user_id);
  return {
    event: row.event,
    uuid: row.uuid,
    timestamp: row.occurred_at,
    distinct_id: identified ? row.user_id : uuidv5('outbox:' + row.uuid),
    properties: {
      ...properties,
      source: 'outbox',
      $lib: 'duoly-outbox',
      $geoip_disable: true,
      ...(identified ? {} : { $process_person_profile: false }),
      ...(row.user_id && internalIds.has(row.user_id.toLowerCase())
        ? { internal: true }
        : {}),
    },
  };
}

export type DrainResult = {
  claimed: number;
  sent: number;
  dropped: number;
  failed: number;
  status: number | null;
  rateLimited: boolean;
};

type Fetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number }>;

const BATCH = 200;
const MAX_BATCHES = 5;

export async function drainOnce(
  db: SupabaseClient,
  config: DrainConfig,
  fetcher: Fetch = (url, init) => fetch(url, init),
): Promise<DrainResult> {
  const result: DrainResult = {
    claimed: 0,
    sent: 0,
    dropped: 0,
    failed: 0,
    status: null,
    rateLimited: false,
  };
  for (let n = 0; n < MAX_BATCHES; n++) {
    const claim = await db.rpc('analytics_outbox_claim', { p_limit: BATCH });
    if (claim.error) throw new Error('claim failed');
    const rows = (claim.data ?? []) as OutboxRow[];
    if (rows.length === 0) break;
    result.claimed += rows.length;

    const users = [
      ...new Set(rows.map((r) => r.user_id).filter(Boolean)),
    ] as string[];
    const consented = new Set<string>();
    if (users.length) {
      const consent = await db
        .from('analytics_consent')
        .select('user_id, analytics')
        .in('user_id', users);
      // Unknown consent never implies consent: on error everything goes personless.
      if (!consent.error)
        for (const c of (consent.data ?? []) as {
          user_id: string;
          analytics: boolean;
        }[])
          if (c.analytics === true) consented.add(c.user_id);
    }

    const batch: Record<string, unknown>[] = [];
    const ids: number[] = [];
    const dropped: number[] = [];
    for (const row of rows) {
      const item = toCapture(row, consented, config.internalIds);
      if (item) {
        batch.push(item);
        ids.push(row.id);
      } else dropped.push(row.id);
    }
    // Uncatalogued rows are never sent and never retried.
    if (dropped.length) {
      await db.rpc('analytics_outbox_mark_sent', { p_ids: dropped });
      result.dropped += dropped.length;
    }
    if (!batch.length) continue;

    let status: number;
    try {
      const response = await fetcher(`${config.host}/batch/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ api_key: config.key, batch }),
      });
      status = response.status;
    } catch {
      status = 0;
    }
    result.status = status;
    if (status >= 200 && status < 300) {
      const mark = await db.rpc('analytics_outbox_mark_sent', { p_ids: ids });
      if (mark.error) throw new Error('mark sent failed');
      result.sent += ids.length;
      continue;
    }
    // Release the lease so the next run retries; the database parks after 10 attempts.
    const reason = status === 0 ? 'network' : `http ${status}`;
    for (const id of ids)
      await db.rpc('analytics_outbox_mark_failed', {
        p_id: id,
        p_error: reason,
      });
    result.failed += ids.length;
    result.rateLimited = status === 429;
    break;
  }
  return result;
}
