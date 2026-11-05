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
  teammate_pick_changed: { picked: 'bool' },
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
    picked: 'bool',
    mood: 'slug',
    stream: 'bool',
  },
  creator_code_applied: { source: ['typed', 'link'], valid: 'bool' },
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

const CENTS = 'int' as const;
const MINOR = { amount_minor: 'int', currency: 'slug' } as const;
const PRO_STATE = { state: 'slug', prior_state: 'slug' } as const;
export const OUTBOX_EVENT_CATALOGUE = {
  user_signed_up: { method: ['email', 'google', 'discord', 'apple', 'other'] },
  order_funded: {
    funding: ['card', 'wallet', 'mixed', 'free'],
    list_eur_cents: CENTS,
    funded_eur_cents: CENTS,
    card_eur_cents: CENTS,
    wallet_eur_cents: CENTS,
    discount_eur_cents: CENTS,
    free_perk: 'bool',
    game: 'slug',
    service: 'slug',
    units: 'int',
    stream: 'bool',
    payment_state: 'slug',
  },
  payment_captured: {
    card_eur_cents: CENTS,
    charge_minor: 'int',
    charge_currency: 'slug',
  },
  authorization_voided: { card_eur_cents: CENTS },
  order_refunded: { card_eur_cents: CENTS },
  checkout_expired: { game: 'slug', service: 'slug', status: 'slug' },
  checkout_failed_server: { game: 'slug', service: 'slug', status: 'slug' },
  order_matched: {
    game: 'slug',
    service: 'slug',
    wait_seconds: 'int',
    reroll_n: 'int',
  },
  order_expired: { game: 'slug', service: 'slug', wait_seconds: 'int' },
  order_cancelled: { by: 'slug', stage: 'slug' },
  order_rerolled: { reroll_n: 'int' },
  handover_accepted: {},
  order_completed: {
    duration_seconds: 'int',
    games: 'int',
    wins: 'int',
    losses: 'int',
  },
  order_results_corrected: {},
  match_report_saved: { games: 'int' },
  desk_online_changed: { online: 'bool', by: ['self', 'admin'] },
  tip_paid: { amount_eur_cents: CENTS },
  pro_trial_started: PRO_STATE,
  pro_activated: PRO_STATE,
  pro_paused: PRO_STATE,
  pro_resumed: PRO_STATE,
  pro_ended: PRO_STATE,
  pro_cancel_scheduled: {},
  pro_cancel_undone: {},
  pro_invoice_paid: MINOR,
  pro_invoice_failed: MINOR,
  teammate_approved: { game: 'slug', services_count: 'int' },
  payout_sent: { ...MINOR, rail: ['stripe', 'manual', 'creator'] },
  payout_reversed: MINOR,
} as const satisfies Record<string, Record<string, Kind>>;
export type OutboxEventName = keyof typeof OUTBOX_EVENT_CATALOGUE;

export const SERVER_EVENT_CATALOGUE = {
  creator_link_landed: { referral_consent: 'bool' },
  review_submitted: { rating: 'int', tag_count: 'int', has_tip: 'bool' },
  user_logged_in: {
    method: ['password', 'discord', 'google', 'email', 'magic_link', 'other'],
  },
  discord_linked: {},
  discord_unlinked: {},
  password_reset_requested: {},
  teammate_applied: {
    game: 'slug',
    services_count: 'int',
    hours_bucket: ['under_10', '10_20', '20_30', 'over_30'],
    has_video: 'bool',
  },
  order_offer_passed: {},
  handover_created: {},
  streaming_availability_saved: {},
  payout_setup_completed: {},
  support_handoff_requested: {},
  // 7.3 marketplace facts, enqueued by database triggers (analytics_outbox) and sent by the
  // drain. Strings are slugs or enums only; amounts are integer minor units.
  ...OUTBOX_EVENT_CATALOGUE,
} as const satisfies Record<string, Record<string, Kind>>;
export type ServerEventName = keyof typeof SERVER_EVENT_CATALOGUE;

export function serverCatalogueProps(
  name: string,
  props?: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!Object.hasOwn(SERVER_EVENT_CATALOGUE, name)) return null;
  const schema = SERVER_EVENT_CATALOGUE[name as ServerEventName] as Record<
    string,
    Kind
  >;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props ?? {}))
    if (Object.hasOwn(schema, key) && validAnalyticsValue(schema[key]!, value))
      out[key] = value;
  return out;
}

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

export function validAnalyticsValue(kind: Kind, value: unknown): boolean {
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
    if (key in schema && validAnalyticsValue(schema[key]!, value))
      out[key] = value;
  return out;
}
