/**
 * What the server hands the browser analytics bootstrap (JSON data island in SiteLayout).
 * Browser-safe: no secrets, no names or emails, only the opaque account id and role.
 * Pages where analytics must never run get no island at all (see src/server/analytics/boot.ts).
 */
export type AnalyticsBoot = {
  v: 1;
  /** Public project token (PostHog phc_...). Public by design. */
  key: string;
  /** Ingestion host, e.g. https://eu.i.posthog.com, later the managed proxy. */
  host: string;
  /** Hostnames where the SDK may run; anywhere else it stays off (previews, localhost). */
  hosts: string[];
  /** Route template of this page, e.g. /queue/[id]. Replaces the real path in events. */
  route: string;
  /** full: everything the consent allows. no-replay: never record this page. */
  policy: 'full' | 'no-replay';
  /** Supabase account id of the signed-in visitor, or null when signed out. */
  uid: string | null;
  role: 'customer' | 'teammate' | null;
  /** Owner, coworker and teammate accounts: kept out of customer numbers. */
  internal: boolean;
  /** Short commit sha of this deployment, for release breakdowns. */
  release: string | null;
};

export const ANALYTICS_BOOT_ID = 'duoly-analytics';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strict parse of the data island; anything unexpected disables analytics. */
export function parseAnalyticsBoot(raw: unknown): AnalyticsBoot | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (b.v !== 1) return null;
  if (typeof b.key !== 'string' || !/^ph[a-z]_[A-Za-z0-9]{10,80}$/.test(b.key))
    return null;
  if (typeof b.host !== 'string' || !/^https?:\/\/[^/\s]+$/.test(b.host))
    return null;
  if (
    !Array.isArray(b.hosts) ||
    b.hosts.length === 0 ||
    !b.hosts.every((h) => typeof h === 'string' && /^[a-z0-9.-]+$/i.test(h))
  )
    return null;
  if (typeof b.route !== 'string' || !b.route.startsWith('/')) return null;
  if (b.policy !== 'full' && b.policy !== 'no-replay') return null;
  if (b.uid !== null && (typeof b.uid !== 'string' || !UUID.test(b.uid)))
    return null;
  if (b.role !== null && b.role !== 'customer' && b.role !== 'teammate')
    return null;
  if (typeof b.internal !== 'boolean') return null;
  if (
    b.release !== null &&
    (typeof b.release !== 'string' || !/^[0-9a-f]{7,40}$/i.test(b.release))
  )
    return null;
  return {
    v: 1,
    key: b.key,
    host: b.host,
    hosts: b.hosts as string[],
    route: b.route,
    policy: b.policy,
    uid: b.uid as string | null,
    role: b.role as AnalyticsBoot['role'],
    internal: b.internal,
    release: b.release as string | null,
  };
}
