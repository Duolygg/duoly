/**
 * Privacy filter for everything the analytics SDK sends (POSTHOG-SPEC section 5.1).
 * Pure functions, unit tested. Two layers that must never be mixed:
 *  1. SDK protocol fields (token, distinct_id, $session_id, ...) pass untouched, otherwise
 *     ingestion rejects the event.
 *  2. Every URL-like value is reduced to a route template plus approved campaign parameters;
 *     click ids need marketing consent; titles become the route.
 */

export type SanitizeContext = {
  /** Hostnames that count as Duoly (their paths are templated, others reduced to origin). */
  hosts: ReadonlySet<string>;
  /** Path of the current document and its server route template. */
  currentPath: string;
  route: string;
  marketing: boolean;
  /** False for refusers: no campaign parameters at all, in URLs or as properties. */
  campaign?: boolean;
};

const UTM = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
];
const CLICK_IDS = [
  'gclid',
  'gad_source',
  'gclsrc',
  'dclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'twclid',
  'li_fat_id',
  'mc_cid',
  'igshid',
  'ttclid',
  'rdt_cid',
  'epik',
  'qclid',
  'sccid',
  'irclid',
  '_kx',
];
const SAFE_VALUE = /^[A-Za-z0-9._~ +-]{1,60}$/;
const PREFIXES = ['', '$initial_', '$session_entry_', 'initial_'];

/** Dynamic routes whose segments are ids or secrets. Order matters: first match wins. */
const TEMPLATES: [RegExp, string][] = [
  [/^\/checkout\/return$/, '/checkout/return'],
  [/^\/checkout\/[^/]+$/, '/checkout/:id'],
  [/^\/queue\/[^/]+$/, '/queue/:id'],
  [/^\/claim\/[^/]+$/, '/claim/:token'],
  [/^\/api\/claim\/[^/]+(\/.*)?$/, '/api/claim/:token'],
  [/^\/api\/checkout\/[^/]+\/status$/, '/api/checkout/:id/status'],
  [/^\/api\/proofs\/.*$/, '/api/proofs/:id'],
  [/^\/blog\/[^/]+$/, '/blog/:slug'],
  [/^\/auth(\/.*)?$/, '/auth/*'],
];

function looksLikeId(segment: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment,
    ) ||
    /^[0-9a-f]{16,}$/i.test(segment) ||
    segment.length >= 24 ||
    (segment.length >= 12 && /\d/.test(segment)) ||
    /[@%]/.test(segment)
  );
}

/** /queue/8b1e... -> /queue/:id; unknown id-like segments become :id. */
export function templatePath(path: string): string {
  const clean = (path.split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/';
  for (const [pattern, template] of TEMPLATES)
    if (pattern.test(clean)) return template;
  const orders = /^\/api\/orders\/[^/]+(\/.*)?$/.exec(clean);
  if (orders)
    return '/api/orders/:id' + (orders[1] ? templatePath(orders[1]) : '');
  return clean
    .split('/')
    .map((s) => (s && looksLikeId(s) ? ':id' : s))
    .join('/');
}

function samePath(a: string, b: string): boolean {
  const norm = (p: string) =>
    (p.split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/';
  return norm(a) === norm(b);
}

/** Absolute or relative URL -> safe string, or null when it must be dropped entirely. */
export function templateUrl(
  value: string,
  ctx: SanitizeContext,
): string | null {
  if (value === '$direct') return value;
  let url: URL;
  try {
    url = new URL(value, 'https://' + ([...ctx.hosts][0] ?? 'duoly.gg'));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!ctx.hosts.has(url.hostname)) return url.origin;
  const path = samePath(url.pathname, ctx.currentPath)
    ? ctx.route
    : templatePath(url.pathname);
  const query = new URLSearchParams();
  if (ctx.campaign !== false)
    for (const name of UTM) {
      const v = url.searchParams.get(name);
      if (v && SAFE_VALUE.test(v)) query.set(name, v);
    }
  if (ctx.marketing)
    for (const name of CLICK_IDS) {
      const v = url.searchParams.get(name);
      if (v && /^[A-Za-z0-9._-]{1,200}$/.test(v)) query.set(name, v);
    }
  const q = query.toString();
  return url.origin + path + (q ? '?' + q : '');
}

const URL_KEY = /(url|referrer|pathname|href)$/i;

function baseKey(key: string): string {
  for (const p of PREFIXES)
    if (p && key.startsWith(p)) return key.slice(p.length);
  return key;
}

function cleanValue(
  key: string,
  value: unknown,
  ctx: SanitizeContext,
  depth: number,
): unknown {
  if (depth > 6) return undefined;
  if (typeof value === 'string') {
    const base = baseKey(key);
    if (key === 'title' || key === '$title') return ctx.route;
    if (UTM.includes(base))
      return ctx.campaign !== false && SAFE_VALUE.test(value)
        ? value
        : undefined;
    if (CLICK_IDS.includes(base)) return ctx.marketing ? value : undefined;
    if (URL_KEY.test(key) || key === 'u' || key === 'r') {
      if (value.startsWith('/'))
        return samePath(value, ctx.currentPath)
          ? ctx.route
          : templatePath(value);
      if (/^https?:\/\//i.test(value) || value === '$direct')
        return templateUrl(value, ctx) ?? undefined;
      return value;
    }
    if (/^https?:\/\//i.test(value))
      return templateUrl(value, ctx) ?? undefined;
    return value;
  }
  if (Array.isArray(value))
    return value
      .map((v) => cleanValue(key, v, ctx, depth + 1))
      .filter((v) => v !== undefined);
  if (value && typeof value === 'object' && !(value instanceof Date))
    return cleanObject(value as Record<string, unknown>, ctx, depth + 1);
  return value;
}

export function cleanObject(
  input: Record<string, unknown>,
  ctx: SanitizeContext,
  depth = 0,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const clean = cleanValue(key, value, ctx, depth);
    if (clean !== undefined) out[key] = clean;
  }
  return out;
}

/** Events allowed per consent tier. Anything else is dropped (fail closed). */
export const REFUSED_EVENTS: ReadonlySet<string> = new Set([
  '$pageview',
  '$pageleave',
]);
export const ACCEPTED_EVENTS: ReadonlySet<string> = new Set([
  '$pageview',
  '$pageleave',
  '$web_vitals',
  '$identify',
  '$set',
]);

type Captured = {
  event: string;
  properties: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
};

/**
 * before_send core. analytics=null means no choice yet (nothing may leave the page).
 * Returns null to drop the event.
 */
export function filterEvent<T extends Captured>(
  event: T | null,
  analytics: boolean | null,
  ctx: SanitizeContext,
  extraEvents: ReadonlySet<string> = new Set(),
): T | null {
  if (!event || analytics === null) return null;
  const allowed = analytics
    ? ACCEPTED_EVENTS.has(event.event) || extraEvents.has(event.event)
    : REFUSED_EVENTS.has(event.event);
  if (!allowed) return null;
  const tierCtx = analytics
    ? ctx
    : { ...ctx, marketing: false, campaign: false };
  const out: T = {
    ...event,
    properties: cleanObject(event.properties ?? {}, tierCtx),
  };
  out.properties.route = ctx.route;
  if (!analytics) {
    delete out.$set;
    delete out.$set_once;
    return out;
  }
  if (event.$set) out.$set = cleanObject(event.$set, tierCtx);
  if (event.$set_once) out.$set_once = cleanObject(event.$set_once, tierCtx);
  return out;
}
