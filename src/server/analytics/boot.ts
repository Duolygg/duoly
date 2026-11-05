/**
 * Decides, per rendered page, whether browser analytics may run and with what context.
 * Returns null (no data island, SDK never starts) when analytics is not configured, on
 * private routes and for admins. POSTHOG-SPEC section 3.
 */
import type { AnalyticsBoot } from '../../contracts/analytics';
import type { Viewer } from '../../contracts/account';
import { templatePath } from '../../client/analytics/sanitize';

type Env = Record<string, string | undefined>;

function read(env: Env | undefined, name: string): string | undefined {
  const value: unknown =
    env?.[name] ?? process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Routes that never load analytics: admin tools, secret links and auth steps. */
const OFF = [
  /^\/admin(\/|$)/,
  /^\/claim(\/|$)/,
  /^\/reset-password(\/|$)/,
  /^\/auth(\/|$)/,
];
/** Pages that send events but are never recorded (spec section 3, owner decision Q4). */
const NO_REPLAY = [
  /^\/teammate(\/|$)/,
  /^\/profile(\/|$)/,
  /^\/dashboard(\/|$)/,
  /^\/checkout(\/|$)/,
];

export function analyticsBoot(input: {
  path: string;
  /** True when the page renders the 404 view (rewrite), so the real path is never sent. */
  notFound?: boolean;
  viewer?: Pick<Viewer, 'id' | 'role'> | null | undefined;
  env?: Env;
}): AnalyticsBoot | null {
  const { path, viewer, env } = input;
  if (read(env, 'PUBLIC_ANALYTICS_ENABLED') !== 'true') return null;
  const key = read(env, 'PUBLIC_POSTHOG_KEY');
  const host = (
    read(env, 'PUBLIC_POSTHOG_HOST') ?? 'https://eu.i.posthog.com'
  ).replace(/\/+$/, '');
  if (!key || !/^ph[a-z]_[A-Za-z0-9]{10,80}$/.test(key)) return null;
  if (!/^https?:\/\/[^/\s]+$/.test(host)) return null;
  if (OFF.some((r) => r.test(path))) return null;
  if (viewer?.role === 'admin') return null;
  const hosts = (read(env, 'ANALYTICS_HOSTS') ?? 'duoly.gg,www.duoly.gg')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[a-z0-9.-]+$/.test(h));
  if (hosts.length === 0) return null;
  const internalIds = new Set(
    (read(env, 'ANALYTICS_INTERNAL_USER_IDS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const sha = read(env, 'VERCEL_GIT_COMMIT_SHA');
  const role =
    viewer?.role === 'teammate' ? 'teammate' : viewer ? 'customer' : null;
  return {
    v: 1,
    key,
    host,
    hosts,
    route: input.notFound ? '/404' : templatePath(path),
    policy: NO_REPLAY.some((r) => r.test(path)) ? 'no-replay' : 'full',
    uid: viewer?.id ?? null,
    role,
    internal:
      !!viewer &&
      (role === 'teammate' || internalIds.has(viewer.id.toLowerCase())),
    release: sha && /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 12) : null,
  };
}

/** JSON for a script data island: escape < so the content can never close the tag. */
export function bootJson(boot: AnalyticsBoot): string {
  return JSON.stringify(boot).replace(/</g, '\\u003c');
}
