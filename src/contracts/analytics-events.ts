/**
 * Product event catalogue (POSTHOG-SPEC section 7). Browser safe, shared by browser and
 * server producers. Every event declares its properties; anything not declared is
 * dropped before sending, and values must match their declared kind.
 */

/** enum: one of the listed values. slug: ^[a-z0-9_-]{1,40}$. int: safe integer >= 0. */
type Kind = readonly string[] | 'slug' | 'int' | 'bool';

const SURFACE = [
  'home',
  'game',
  'creators',
  'pro',
  'nav',
  'dashboard',
  'queue',
  'streamer',
  'blog',
  'footer',
  'other',
] as const;
const PAY_KIND = ['order', 'pro', 'tip'] as const;

export const EVENT_CATALOGUE = {
  // 7.1 acquisition and browsing
  game_viewed: { game: 'slug' },
  cta_clicked: { cta: 'slug', surface: SURFACE },
  // 7.2 booking funnel
  game_selected: { game: 'slug', surface: SURFACE },
  service_selected: {
    game: 'slug',
    service: 'slug',
    category: 'slug',
    bundle_units: 'int',
  },
  booking_option_changed: { option: 'slug', value: 'slug' },
  wallet_toggled: { enabled: 'bool' },
  perk_toggled: { enabled: 'bool' },
  checkout_login_required: { game: 'slug', service: 'slug' },
  booking_confirm_opened: {
    game: 'slug',
    service: 'slug',
    units: 'int',
    display_total_cents: 'int',
    display_currency: 'slug',
  },
  checkout_started: {
    game: 'slug',
    service: 'slug',
    units: 'int',
    voice: 'bool',
    wallet: 'bool',
    free_perk: 'bool',
    mood: 'slug',
    stream: 'bool',
  },
  checkout_resumed: {},
  checkout_failed: {
    status_bucket: ['4xx', '5xx', 'network'],
    reason_code: 'slug',
  },
  payment_form_ready: { kind: PAY_KIND },
  payment_submitted: { kind: PAY_KIND },
  payment_confirm_failed: {
    kind: PAY_KIND,
    error_type: 'slug',
    error_code: 'slug',
  },
  checkout_returned: {
    outcome: ['paid', 'processing', 'failed', 'cancelled', 'unknown'],
  },
  checkout_abandon_detected: { age_bucket: ['15m', '1h', '1d', 'older'] },
  // 7.4 after the session
  review_confirmation_shown: { rating: 'int' },
  tip_started: { amount_eur_cents: 'int', display_currency: 'slug' },
  trustpilot_clicked: { rating: 'int', source: 'slug' },
  rebook_clicked: { source: 'slug' },
  play_again_viewed: { game: 'slug' },
  play_again_started: { path: ['card', 'wallet', 'checkout', '3ds'] },
  teammate_favorited: { on: 'bool', source: 'slug' },
  queue_room_viewed: { state: 'slug', game: 'slug' },
  match_seen: { game: 'slug', wait_seconds: 'int' },
  // 7.5 accounts
  login_started: {
    method: ['email', 'password', 'discord', 'google', 'magic_link', 'other'],
    surface: SURFACE,
  },
  // 7.6 PRO
  pro_viewed: { surface: SURFACE },
  pro_checkout_started: { kind: 'slug' },
  pro_portal_opened: {},
  // 7.7 support
  support_opened: { surface: SURFACE },
  support_message_sent: { turn_n: 'int' },
} as const satisfies Record<string, Record<string, Kind>>;

export type EventName = keyof typeof EVENT_CATALOGUE;
type ValueOf<K> = K extends readonly (infer V)[]
  ? V
  : K extends 'int'
    ? number
    : K extends 'bool'
      ? boolean
      : string;
export type EventProps<E extends EventName> = {
  [P in keyof (typeof EVENT_CATALOGUE)[E]]?: ValueOf<
    (typeof EVENT_CATALOGUE)[E][P]
  >;
};

export function isCatalogued(name: string): name is EventName {
  return Object.prototype.hasOwnProperty.call(EVENT_CATALOGUE, name);
}

const SLUG = /^[a-z0-9_-]{1,40}$/;

function valid(kind: Kind, value: unknown): boolean {
  if (kind === 'slug') return typeof value === 'string' && SLUG.test(value);
  if (kind === 'int')
    return (
      typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    );
  if (kind === 'bool') return typeof value === 'boolean';
  return (
    typeof value === 'string' && (kind as readonly string[]).includes(value)
  );
}

/** Declared, well-typed properties only. Unknown events return null. */
export function catalogueProps(
  name: string,
  props: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!isCatalogued(name)) return null;
  const schema = EVENT_CATALOGUE[name] as Record<string, Kind>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props ?? {}))
    if (key in schema && valid(schema[key]!, value)) out[key] = value;
  return out;
}
