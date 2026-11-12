/**
 * Event-driven background work: the one contract the app, the Cloudflare worker and the database
 * all follow. Written for docs/product/background-work.md; read that first for the why.
 *
 * Two directions, both authenticated with a timestamped HMAC over the exact request body, so no
 * reusable bearer ever sits in the pg_net queue (oai-review F9):
 *   register: database trigger or app -> worker `POST /timers`
 *   fire:     worker -> app `POST /api/internal/timer`
 *
 * Rules that the rest of the build depends on:
 * - Every time in here is an integer of epoch milliseconds, UTC. No seconds, no Date objects, no
 *   `Infinity` (a streaming booking has no post deadline, so it simply gets no post timer).
 * - A timer is a wake-up, not a decision. The handler re-reads the current state and deadline and
 *   answers with a disposition; only that disposition decides whether the row is deleted or re-armed.
 * - The key `<kind>:<ref>:<epoch>` is the whole idempotency story. `epoch` is the millisecond stamp
 *   of the committed state that asked for the timer (an order's `queued_at`, for example), so a
 *   rerolled or re-queued order gets a new key and the old timer can only answer `stale`.
 * - Web Crypto only: this module is imported by Cloudflare Workers, Vercel functions and vitest, so
 *   it must not import `node:*` and must not reach for `Buffer`.
 */
import { z } from 'zod';

// ---------------------------------------------------------------- switches

/** One switch per legacy dispatcher kind (public.background_switches, public.duoly_dispatch). */
export const SWITCH_KINDS = [
  'orders',
  'payments',
  'analytics',
  'roles',
] as const;
export type SwitchKind = (typeof SWITCH_KINDS)[number];
export const SwitchKindSchema = z.enum(SWITCH_KINDS);

/**
 * legacy: nothing new happens; the 10 s dispatcher owns the work.
 * shadow: timers fire and handlers only log what they would do; the dispatcher still owns the work.
 * live:   timers act and the dispatcher skips this kind.
 */
export const SWITCH_MODES = ['legacy', 'shadow', 'live'] as const;
export type SwitchMode = (typeof SWITCH_MODES)[number];
export const SwitchModeSchema = z.enum(SWITCH_MODES);

/** A row of public.background_switches. */
export const BackgroundSwitchSchema = z
  .object({
    kind: SwitchKindSchema,
    mode: SwitchModeSchema,
    updated_at: z.string().min(1),
  })
  .strict();
export type BackgroundSwitch = z.infer<typeof BackgroundSwitchSchema>;

// ---------------------------------------------------------------- timer kinds

export const TIMER_KINDS = [
  'order-post',
  'order-expire',
  'settle-retry',
  'analytics-retry',
  'presence-check',
] as const;
export type TimerKind = (typeof TIMER_KINDS)[number];
export const TimerKindSchema = z.enum(TIMER_KINDS);

/**
 * Which switch gates each kind: the switch names the legacy dispatcher that does this work today,
 * so turning a kind live never leaves two owners for the same work.
 * Order expiry and settlement both live in the payments tick (`order_sweep`, `settlePending`).
 */
export const TIMER_KIND_SWITCH: Readonly<Record<TimerKind, SwitchKind>> = {
  'order-post': 'orders',
  'order-expire': 'payments',
  'settle-retry': 'payments',
  'analytics-retry': 'analytics',
  'presence-check': 'roles',
};

// ---------------------------------------------------------------- timings (owner decisions)

/** Discord posts a public order exactly 100 s after it becomes publicly queued. */
export const ORDER_POST_DELAY_MS = 100_000;
/** Accepting already fails after queued_at + 5 min (team_orders.sql:725-732); expiry matches it. */
export const ORDER_EXPIRE_DELAY_MS = 5 * 60_000;
/** Settlement retries after a failed settle, then the hourly fixer. */
export const SETTLE_RETRY_DELAYS_MS = [
  30_000,
  2 * 60_000,
  10 * 60_000,
] as const;
/** Analytics drain retries after a failed drain, same shape as settlement. */
export const ANALYTICS_RETRY_DELAYS_MS = [
  30_000,
  2 * 60_000,
  10 * 60_000,
] as const;
/** Presence freshness window shared with the desk and role sync (20 s). */
export const PRESENCE_CHECK_INTERVAL_MS = 20_000;
/** A timer whose fire request never succeeded: 30 s, 2 min, 10 min, then drop and let the fixer fix. */
export const FIRE_RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000] as const;
/** Attempt numbers the worker may send: the first try plus one per retry delay. */
export const MAX_FIRE_ATTEMPTS = FIRE_RETRY_DELAYS_MS.length + 1;
/** Both directions accept a signature for 5 minutes either side of now (clock skew included). */
export const SIGNATURE_WINDOW_MS = 5 * 60_000;
/** Signed bodies are tiny on purpose; anything larger is refused before any crypto work. */
export const MAX_SIGNED_BODY_BYTES = 2048;
/** Shorter secrets are treated as unset, like the existing tick secrets. */
export const MIN_SECRET_LENGTH = 32;
/** A registration may not ask for a wake-up further out than this. */
export const REGISTER_HORIZON_MS = 90 * 24 * 60 * 60_000;
/** A registration may be this far in the past (backfill of an existing order); it fires at once. */
export const REGISTER_BACKDATE_MS = 7 * 24 * 60 * 60_000;

// ---------------------------------------------------------------- keys

/** `:` is the key separator, so a ref may not contain one. Order ids and short slugs both fit. */
const REF = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const TimerRefSchema = z
  .string()
  .regex(REF, 'ref must be 1 to 64 letters, digits, hyphens or underscores');

/** Epoch milliseconds of the committed state behind the timer. 0 means a recurring singleton. */
export const EpochMsSchema = z.number().int().min(0).max(4_102_444_800_000);
/** A wall-clock instant: 2026-01-01 through 2100-01-01, integer milliseconds. */
export const InstantMsSchema = z
  .number()
  .int()
  .min(1_767_225_600_000)
  .max(4_102_444_800_000);

export const MAX_TIMER_KEY_LENGTH = 96;

export interface TimerIdentity {
  kind: TimerKind;
  ref: string;
  epoch: number;
}

/** The idempotency key: `<kind>:<ref>:<epoch>`. */
export function timerKey(timer: TimerIdentity): string {
  return `${timer.kind}:${timer.ref}:${timer.epoch}`;
}

/** Null for anything that is not a key this build could have written. */
export function parseTimerKey(key: string): TimerIdentity | null {
  if (key.length > MAX_TIMER_KEY_LENGTH) return null;
  const parts = key.split(':');
  if (parts.length !== 3) return null;
  const [kind, ref, epoch] = parts;
  const parsed = z
    .object({
      kind: TimerKindSchema,
      ref: TimerRefSchema,
      epoch: EpochMsSchema,
    })
    .safeParse({
      kind,
      ref,
      epoch:
        epoch !== undefined && /^[0-9]{1,16}$/.test(epoch)
          ? Number(epoch)
          : Number.NaN,
    });
  return parsed.success ? parsed.data : null;
}

const keyMatchesIdentity = (
  value: { key?: string; kind: TimerKind; ref: string; epoch: number },
  ctx: z.RefinementCtx,
) => {
  if (value.key !== undefined && value.key !== timerKey(value))
    ctx.addIssue({
      code: 'custom',
      path: ['key'],
      message: 'key must be `<kind>:<ref>:<epoch>` of the same timer',
    });
};

// ---------------------------------------------------------------- register: POST /timers

/**
 * The database trigger posts this once per timer (twice per queued order). `key` may be left out,
 * which keeps the SQL short; when it is sent it has to agree with the other fields.
 * Registering an existing key keeps the EARLIEST `at` (a dependency event may only pull a wake-up
 * forward); a handler that wants a later wake-up answers `retry` or `pending` instead.
 */
export const TimerRequestSchema = z
  .object({
    key: z.string().max(MAX_TIMER_KEY_LENGTH).optional(),
    kind: TimerKindSchema,
    ref: TimerRefSchema,
    epoch: EpochMsSchema,
    at: InstantMsSchema,
  })
  .strict()
  .superRefine(keyMatchesIdentity);
export type TimerRequest = z.infer<typeof TimerRequestSchema>;

export interface StoredTimer extends TimerIdentity {
  key: string;
  at: number;
}

/** The request with its key filled in, which is what the worker stores. */
export function normalizeTimerRequest(request: TimerRequest): StoredTimer {
  return {
    key: timerKey(request),
    kind: request.kind,
    ref: request.ref,
    epoch: request.epoch,
    at: request.at,
  };
}

/** Bounds a registration in time so a leaked or buggy caller cannot park work forever. */
export function registrationAcceptable(at: number, now: number): boolean {
  return at >= now - REGISTER_BACKDATE_MS && at <= now + REGISTER_HORIZON_MS;
}

export const TimerRequestResultSchema = z
  .object({
    key: z.string().max(MAX_TIMER_KEY_LENGTH),
    at: InstantMsSchema,
    /** stored: new row; kept: an earlier or equal `at` already existed; refused: outside the window. */
    stored: z.enum(['stored', 'kept', 'refused']),
  })
  .strict();
export type TimerRequestResult = z.infer<typeof TimerRequestResultSchema>;

// ---------------------------------------------------------------- fire: POST /api/internal/timer

/** What the worker sends when a timer comes due. `at` is the due time it fired for, not now. */
export const TimerFireSchema = z
  .object({
    key: z.string().max(MAX_TIMER_KEY_LENGTH),
    kind: TimerKindSchema,
    ref: TimerRefSchema,
    epoch: EpochMsSchema,
    at: InstantMsSchema,
    attempt: z.number().int().min(1).max(MAX_FIRE_ATTEMPTS),
    firedAt: InstantMsSchema,
  })
  .strict()
  .superRefine(keyMatchesIdentity);
export type TimerFire = z.infer<typeof TimerFireSchema>;

const note = z.string().max(200).optional();

/**
 * The handler's answer. Transport success is not business completion (oai-review F11), so the
 * worker only ever acts on this:
 *   done     the work is finished; forget the timer
 *   stale    this key no longer describes reality (newer epoch, order gone, streaming booking)
 *   disabled the switch is legacy or shadow; nothing was done (shadow logged what it would do)
 *   retry    the same work has to run again at `at` (a deadline moved later, or a provider said wait)
 *   pending  the work waits on something else (an earlier team seat owns the post); recheck at `at`
 */
export const TimerDispositionSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('done'), note }).strict(),
  z.object({ status: z.literal('stale'), note }).strict(),
  z
    .object({
      status: z.literal('disabled'),
      mode: SwitchModeSchema,
      note,
    })
    .strict(),
  z.object({ status: z.literal('retry'), at: InstantMsSchema, note }).strict(),
  z
    .object({ status: z.literal('pending'), at: InstantMsSchema, note })
    .strict(),
]);
export type TimerDisposition = z.infer<typeof TimerDispositionSchema>;

/**
 * How the worker stores the answer. The delete or the re-arm has to be applied against the version
 * the alarm claimed, so a registration that arrived during the callback is never overwritten.
 */
export function dispositionOutcome(disposition: TimerDisposition): {
  forget: boolean;
  rearmAt: number | null;
} {
  return disposition.status === 'retry' || disposition.status === 'pending'
    ? { forget: false, rearmAt: disposition.at }
    : { forget: true, rearmAt: null };
}

/**
 * When a fire request itself failed (no response, 5xx, unparsable body): the next attempt, with
 * plus or minus 10% jitter so a cold app does not get every overdue timer at the same instant.
 * Null means give up and log; `background_overdue()` finds the work from source state.
 */
export function nextFireRetryAt(
  attempt: number,
  now: number,
  jitter: number = Math.random(),
): number | null {
  const base = FIRE_RETRY_DELAYS_MS[attempt - 1];
  if (base === undefined) return null;
  return (
    now + Math.round(base * (0.9 + 0.2 * Math.min(Math.max(jitter, 0), 1)))
  );
}

// ---------------------------------------------------------------- health: GET /timers/health

export const TimersHealthSchema = z
  .object({
    now: InstantMsSchema,
    /** Rows stored right now, and of those the ones already due. */
    pending: z.number().int().min(0),
    due: z.number().int().min(0),
    byKind: z.record(TimerKindSchema, z.number().int().min(0)),
    oldestDueAt: InstantMsSchema.nullable(),
    lastFireAt: InstantMsSchema.nullable(),
    lastErrorAt: InstantMsSchema.nullable(),
    lastError: z.string().max(200).nullable(),
    /** Timers dropped after the last retry since the object was created. */
    dropped: z.number().int().min(0),
    /** Last Supabase keep-alive read, so an inactivity pause cannot creep up unnoticed. */
    keepAliveAt: InstantMsSchema.nullable(),
  })
  .strict();
export type TimersHealth = z.infer<typeof TimersHealthSchema>;

// ---------------------------------------------------------------- signing

export const SIGNATURE_HEADER = 'x-duoly-signature';
export const TIMESTAMP_HEADER = 'x-duoly-timestamp';
export const SIGNATURE_VERSION = 'v1';

const encoder = new TextEncoder();
const SIGNATURE = /^v1=([0-9a-f]{64})$/;

const usable = (secret: string | undefined): secret is string =>
  typeof secret === 'string' && secret.trim().length >= MIN_SECRET_LENGTH;

function hmacKey(secret: string) {
  return globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

const hex = (mac: ArrayBuffer): string =>
  Array.from(new Uint8Array(mac), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

/** Constant-time for equal lengths; both inputs here are fixed-length hex or a shared secret. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `v1=<hex>` of HMAC-SHA-256 over `<timestamp>.<body>`, the exact bytes that get sent. */
export async function signBackgroundBody(
  secret: string,
  timestamp: number,
  body: string,
): Promise<string> {
  if (!usable(secret))
    throw new Error('background secret is missing or under 32 characters');
  const mac = await globalThis.crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret.trim()),
    encoder.encode(`${timestamp}.${body}`),
  );
  return `${SIGNATURE_VERSION}=${hex(mac)}`;
}

/** Everything a signed POST needs, ready to spread into `fetch`. */
export async function signedRequestHeaders(
  secret: string,
  body: string,
  now: number = Date.now(),
): Promise<Record<string, string>> {
  const timestamp = Math.trunc(now);
  return {
    'content-type': 'application/json',
    [TIMESTAMP_HEADER]: String(timestamp),
    [SIGNATURE_HEADER]: await signBackgroundBody(secret, timestamp, body),
  };
}

export type VerifyFailure =
  'secret' | 'body-too-large' | 'timestamp' | 'window' | 'signature';
export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailure };

/**
 * Verify against the raw request text, never a re-serialized object. A missing secret refuses
 * every call, like the existing tick secrets, so a half-configured deployment does nothing.
 */
export async function verifyBackgroundBody(input: {
  secret: string | undefined;
  signature: string | null;
  timestamp: string | null;
  body: string;
  now?: number;
}): Promise<VerifyResult> {
  if (!usable(input.secret)) return { ok: false, reason: 'secret' };
  if (encoder.encode(input.body).byteLength > MAX_SIGNED_BODY_BYTES)
    return { ok: false, reason: 'body-too-large' };
  if (!input.timestamp || !/^[0-9]{10,16}$/.test(input.timestamp))
    return { ok: false, reason: 'timestamp' };
  const timestamp = Number(input.timestamp);
  const now = input.now ?? Date.now();
  if (Math.abs(now - timestamp) > SIGNATURE_WINDOW_MS)
    return { ok: false, reason: 'window' };
  if (!input.signature || !SIGNATURE.test(input.signature))
    return { ok: false, reason: 'signature' };
  const expected = await signBackgroundBody(
    input.secret,
    timestamp,
    input.body,
  );
  return sameString(expected, input.signature)
    ? { ok: true }
    : { ok: false, reason: 'signature' };
}

/**
 * Bearer check for the two callers that cannot sign: `background_fix()` posting to
 * /api/internal/reconcile (a bearer there grants only "run the existing reconcile handlers", the
 * same narrow capability the live ticks already enqueue) and a human curling /timers/health.
 */
export function bearerAuthorized(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!usable(secret) || !header) return false;
  return sameString(`Bearer ${secret.trim()}`, header);
}
