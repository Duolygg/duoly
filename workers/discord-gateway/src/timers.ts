// The timer half of the worker (docs/product/background-work.md). A Durable Object stores one row
// per deadline, keeps a single alarm at the earliest due time, and fires a signed POST at the app.
//
// Everything that decides something lives here as a function over a `TimerStore`, so the whole
// protocol is unit tested in vitest without miniflare; `index.ts` only wires the real SQLite
// storage, the real alarm and the real fetch into these functions.
//
// Two rules carry the design (oai-review F11):
// - A timer is a wake-up, never a decision. Only the app's disposition deletes or re-arms a row; a
//   2xx proves transport and nothing else.
// - Every row carries a version that changes whenever its due time changes, and the alarm applies
//   its delete or re-arm against the version it claimed, so a registration that pulled the wake-up
//   forward while the callback was in flight survives it.
import {
  MIN_SECRET_LENGTH,
  TIMER_KINDS,
  TimerDispositionSchema,
  TimerRequestSchema,
  type TimerDisposition,
  type TimerFire,
  type TimerKind,
  type TimerRequestResult,
  type TimersHealth,
  dispositionOutcome,
  nextFireRetryAt,
  normalizeTimerRequest,
  registrationAcceptable,
  signedRequestHeaders,
} from '../../../src/contracts/background';

/** The app route every fire goes to. Fixed on purpose: no caller ever chooses a destination. */
export const FIRE_PATH = '/api/internal/timer';
/** Due timers handled per alarm. The alarm re-arms at once, so a backlog drains in waves. */
export const MAX_DUE_BATCH = 8;
/** A disposition may not ask for a wake-up sooner than this, so `retry` cannot spin the alarm. */
export const MIN_REARM_MS = 1_000;
/** A fire request that hangs is a failed delivery, not a stuck alarm. */
export const FIRE_TIMEOUT_MS = 10_000;
/** Nothing can be fired without the fire secret; look again later instead of burning attempts. */
export const SECRET_HOLD_MS = 5 * 60_000;
/** Keep-alive read: a little under a day, so a calendar day never passes without one. */
export const KEEPALIVE_INTERVAL_MS = 23 * 60 * 60_000;
/** A failed keep-alive read is retried in an hour, not in a minute. */
export const KEEPALIVE_RETRY_MS = 60 * 60_000;
/** `lastError` is a monitoring string, and the health schema caps it. */
export const MAX_ERROR_LENGTH = 200;

// ---------------------------------------------------------------- storage port

export interface TimerRow {
  key: string;
  kind: TimerKind;
  ref: string;
  epoch: number;
  /** When to fire, epoch milliseconds. */
  at: number;
  /** Delivery attempts already made for this due time. 0 means it has never been sent. */
  attempt: number;
  /** Changes whenever `at` changes; an alarm only acts on the version it claimed. */
  version: number;
}

export interface TimerStats {
  pending: number;
  due: number;
  byKind: Record<TimerKind, number>;
  oldestDueAt: number | null;
}

/**
 * What the logic needs from storage. Synchronous because Durable Object SQLite is synchronous, so
 * a read and the write that depends on it can never interleave with another request.
 */
export interface TimerStore {
  read(key: string): TimerRow | null;
  write(row: TimerRow): void;
  /** Deletes only while the row still carries `version`; false means a registration won the race. */
  remove(key: string, version: number): boolean;
  /** Moves the wake-up only while the row still carries `version`. */
  reschedule(
    key: string,
    version: number,
    at: number,
    attempt: number,
  ): boolean;
  due(now: number, limit: number): TimerRow[];
  earliestAt(): number | null;
  stats(now: number): TimerStats;
  meta(key: string): string | null;
  setMeta(key: string, value: string): void;
}

export interface TimerEnv {
  /** Where fires go, for example https://duoly.gg. A committed var, not a secret. */
  appBaseUrl: string;
  fireSecret: string | undefined;
  keepAliveUrl: string | undefined;
  keepAliveKey: string | undefined;
}

export interface TimerDeps {
  store: TimerStore;
  env: TimerEnv;
  fetch: typeof fetch;
  getAlarm(): Promise<number | null>;
  setAlarm(at: number): Promise<void>;
  clearAlarm(): Promise<void>;
  now?(): number;
  random?(): number;
  log?(message: string): void;
}

const META = {
  lastFireAt: 'last-fire-at',
  lastErrorAt: 'last-error-at',
  lastError: 'last-error',
  dropped: 'dropped',
  keepAliveAt: 'keep-alive-at',
  keepAliveNextAt: 'keep-alive-next-at',
} as const;

const clock = (deps: TimerDeps): number => Math.trunc((deps.now ?? Date.now)());

const log = (deps: TimerDeps, message: string): void =>
  (deps.log ?? console.log)('[timers] ' + message);

const reason = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(
    0,
    MAX_ERROR_LENGTH,
  );

function metaNumber(deps: TimerDeps, key: string): number | null {
  const raw = deps.store.meta(key);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function noteError(deps: TimerDeps, at: number, message: string): void {
  deps.store.setMeta(META.lastErrorAt, String(at));
  deps.store.setMeta(META.lastError, message.slice(0, MAX_ERROR_LENGTH));
  log(deps, message);
}

/** All five kinds, always, so a monitoring dashboard never has to guess a missing key. */
export function emptyByKind(): Record<TimerKind, number> {
  const counts = {} as Record<TimerKind, number>;
  for (const kind of TIMER_KINDS) counts[kind] = 0;
  return counts;
}

const secretUsable = (secret: string | undefined): secret is string =>
  typeof secret === 'string' && secret.trim().length >= MIN_SECRET_LENGTH;

// ---------------------------------------------------------------- the alarm

/**
 * One alarm per object, always at the earliest due time. `notBefore` holds it off when the batch
 * could not be delivered at all. Nothing is written when the alarm is already where it belongs,
 * because `setAlarm` costs a row write.
 */
export async function armAlarm(
  deps: TimerDeps,
  notBefore = 0,
): Promise<number | null> {
  const earliest = deps.store.earliestAt();
  const current = await deps.getAlarm();
  if (earliest === null) {
    if (current !== null) await deps.clearAlarm();
    return null;
  }
  const at = Math.max(earliest, clock(deps), notBefore);
  if (current !== at) await deps.setAlarm(at);
  return at;
}

// ---------------------------------------------------------------- register

export type RegisterAnswer =
  | { status: 200; body: TimerRequestResult }
  | { status: 400; body: { error: string } };

/**
 * `POST /timers`. Idempotent by `<kind>:<ref>:<epoch>`: a key that exists keeps the EARLIEST `at`,
 * so a dependency event (the next team seat, a closed post) can only pull a wake-up forward. A
 * handler that wants a later wake-up answers `retry` or `pending` instead of registering.
 */
export async function registerTimer(
  deps: TimerDeps,
  body: unknown,
): Promise<RegisterAnswer> {
  const parsed = TimerRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 400,
      body: {
        error: `timer refused: ${issue ? `${issue.path.join('.') || 'body'} ${issue.message}` : 'invalid body'}`,
      },
    };
  }
  const wanted = normalizeTimerRequest(parsed.data);
  const now = clock(deps);
  if (!registrationAcceptable(wanted.at, now)) {
    log(deps, `${wanted.key} refused: at=${wanted.at} is outside the window`);
    return {
      status: 200,
      body: { key: wanted.key, at: wanted.at, stored: 'refused' },
    };
  }
  const existing = deps.store.read(wanted.key);
  if (existing && existing.at <= wanted.at)
    return {
      status: 200,
      body: { key: existing.key, at: existing.at, stored: 'kept' },
    };
  // A new due time is a new wake-up, so delivery attempts start again from zero.
  deps.store.write(
    existing
      ? {
          ...existing,
          at: wanted.at,
          attempt: 0,
          version: existing.version + 1,
        }
      : { ...wanted, attempt: 0, version: 1 },
  );
  await armAlarm(deps);
  return {
    status: 200,
    body: { key: wanted.key, at: wanted.at, stored: 'stored' },
  };
}

// ---------------------------------------------------------------- fire

/** A delivery that never reached a disposition: no response, a non-2xx, or an answer we cannot read. */
export interface FireFailure {
  failure: string;
}

export type FireAnswer = TimerDisposition | FireFailure;

const failed = (answer: FireAnswer): answer is FireFailure =>
  'failure' in answer;

export interface FireResolution {
  action: 'forget' | 'rearm' | 'drop';
  /** Only for `rearm`. */
  at: number;
  /** Only for `rearm`: delivery attempts made for that due time. */
  attempt: number;
  note: string;
}

/**
 * What the row should become after one fire. Pure, so every branch is a unit test.
 * A failed delivery backs off 30 s, 2 min, 10 min and is then dropped with a log line, because
 * `public.background_overdue()` finds the work again from source state.
 */
export function fireResolution(
  row: TimerRow,
  answer: FireAnswer,
  now: number,
  jitter?: number,
): FireResolution {
  if (failed(answer)) {
    const sent = row.attempt + 1;
    const retryAt = nextFireRetryAt(sent, now, jitter);
    if (retryAt === null)
      return {
        action: 'drop',
        at: 0,
        attempt: sent,
        note: `dropped after ${sent} failed deliveries (${answer.failure}); the fixer covers it`,
      };
    return {
      action: 'rearm',
      at: retryAt,
      attempt: sent,
      note: `delivery ${sent} failed (${answer.failure}); again at ${retryAt}`,
    };
  }
  const outcome = dispositionOutcome(answer);
  if (outcome.rearmAt === null)
    return {
      action: 'forget',
      at: 0,
      attempt: row.attempt,
      note: `${answer.status}${answer.note ? ` (${answer.note})` : ''}`,
    };
  const at = Math.max(outcome.rearmAt, now + MIN_REARM_MS);
  return {
    action: 'rearm',
    at,
    attempt: 0,
    note: `${answer.status} until ${at}${answer.note ? ` (${answer.note})` : ''}`,
  };
}

/** The body the app sees. `at` is the due time this fire is for, `firedAt` is now. */
export function firePayload(row: TimerRow, now: number): TimerFire {
  return {
    key: row.key,
    kind: row.kind,
    ref: row.ref,
    epoch: row.epoch,
    at: row.at,
    attempt: row.attempt + 1,
    firedAt: now,
  };
}

async function deliver(
  deps: TimerDeps,
  row: TimerRow,
  secret: string,
): Promise<FireAnswer> {
  const now = clock(deps);
  const body = JSON.stringify(firePayload(row, now));
  let response: Response;
  try {
    response = await deps.fetch(deps.env.appBaseUrl + FIRE_PATH, {
      method: 'POST',
      headers: await signedRequestHeaders(secret, body, now),
      body,
      signal: AbortSignal.timeout(FIRE_TIMEOUT_MS),
    });
  } catch (error) {
    return { failure: reason(error) };
  }
  if (!response.ok) return { failure: `answered ${response.status}` };
  let answer: unknown;
  try {
    answer = await response.json();
  } catch (error) {
    return { failure: `unreadable answer (${reason(error)})` };
  }
  const disposition = TimerDispositionSchema.safeParse(answer);
  return disposition.success
    ? disposition.data
    : { failure: 'answer is not a disposition' };
}

async function fireOne(
  deps: TimerDeps,
  row: TimerRow,
  secret: string,
): Promise<FireResolution> {
  const answer = await deliver(deps, row, secret);
  const now = clock(deps);
  const resolution = fireResolution(
    row,
    answer,
    now,
    (deps.random ?? Math.random)(),
  );
  if (failed(answer)) noteError(deps, now, `${row.key}: ${answer.failure}`);
  else deps.store.setMeta(META.lastFireAt, String(now));

  if (resolution.action === 'rearm') {
    if (
      !deps.store.reschedule(
        row.key,
        row.version,
        resolution.at,
        resolution.attempt,
      )
    )
      log(
        deps,
        `${row.key} was re-registered while it fired; kept the newer wake-up`,
      );
    else log(deps, `${row.key} ${resolution.note}`);
    return resolution;
  }
  if (!deps.store.remove(row.key, row.version)) {
    log(
      deps,
      `${row.key} was re-registered while it fired; kept the newer wake-up`,
    );
    return resolution;
  }
  if (resolution.action === 'drop')
    deps.store.setMeta(
      META.dropped,
      String((metaNumber(deps, META.dropped) ?? 0) + 1),
    );
  log(deps, `${row.key} ${resolution.note}`);
  return resolution;
}

/**
 * The alarm. It catches everything: throwing here would hand the schedule to Cloudflare's six
 * built-in retries, which would interleave with our own backoff. Bounded batches plus per-timer
 * backoff mean one poison timer cannot hold up a later deadline.
 */
export async function runAlarm(deps: TimerDeps): Promise<FireResolution[]> {
  let notBefore = 0;
  let resolutions: FireResolution[] = [];
  try {
    const now = clock(deps);
    const due = deps.store.due(now, MAX_DUE_BATCH);
    if (due.length > 0) {
      const secret = deps.env.fireSecret;
      if (!secretUsable(secret)) {
        noteError(
          deps,
          now,
          `BACKGROUND_FIRE_SECRET is missing or too short; ${due.length} timers are waiting`,
        );
        notBefore = now + SECRET_HOLD_MS;
      } else {
        const settled = await Promise.allSettled(
          due.map((row) => fireOne(deps, row, secret)),
        );
        resolutions = settled.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : [],
        );
        for (const result of settled)
          if (result.status === 'rejected')
            noteError(deps, clock(deps), reason(result.reason));
      }
    }
  } catch (error) {
    noteError(deps, clock(deps), reason(error));
  }
  try {
    await armAlarm(deps, notBefore);
  } catch (error) {
    log(deps, `could not set the alarm: ${reason(error)}`);
  }
  return resolutions;
}

// ---------------------------------------------------------------- health

/** `GET /timers/health`: counts, the oldest due time, the last fire, the last error. No secrets. */
export function timersHealth(deps: TimerDeps): TimersHealth {
  const now = clock(deps);
  const stats = deps.store.stats(now);
  return {
    now,
    pending: stats.pending,
    due: stats.due,
    byKind: stats.byKind,
    oldestDueAt: stats.oldestDueAt,
    lastFireAt: metaNumber(deps, META.lastFireAt),
    lastErrorAt: metaNumber(deps, META.lastErrorAt),
    lastError: deps.store.meta(META.lastError),
    dropped: metaNumber(deps, META.dropped) ?? 0,
    keepAliveAt: metaNumber(deps, META.keepAliveAt),
  };
}

// ---------------------------------------------------------------- keep-alive and cron

export type KeepAliveResult = 'skipped' | 'unconfigured' | 'ok' | 'failed';

/**
 * Supabase may pause a Free project that shows low activity over seven days, so once a day the
 * worker makes the cheapest authenticated read there is: `presence_public_count`, the same
 * anon-executable, read-only RPC the homepage calls. Monitoring, not a documented exemption
 * (oai-review F21): the time lands in `/timers/health` so a pause cannot creep up unnoticed.
 */
export async function keepAliveTick(deps: TimerDeps): Promise<KeepAliveResult> {
  const now = clock(deps);
  if (now < (metaNumber(deps, META.keepAliveNextAt) ?? 0)) return 'skipped';
  const { keepAliveUrl, keepAliveKey } = deps.env;
  if (!keepAliveUrl || !keepAliveKey) return 'unconfigured';
  try {
    const response = await deps.fetch(keepAliveUrl, {
      method: 'POST',
      headers: {
        apikey: keepAliveKey,
        authorization: `Bearer ${keepAliveKey}`,
        'content-type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(FIRE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`answered ${response.status}`);
    deps.store.setMeta(META.keepAliveAt, String(now));
    deps.store.setMeta(
      META.keepAliveNextAt,
      String(now + KEEPALIVE_INTERVAL_MS),
    );
    return 'ok';
  } catch (error) {
    noteError(deps, clock(deps), `keep-alive: ${reason(error)}`);
    deps.store.setMeta(META.keepAliveNextAt, String(now + KEEPALIVE_RETRY_MS));
    return 'failed';
  }
}

/**
 * The worker's existing one minute cron, which already wakes the gateway, also wakes this object:
 * it does the daily keep-alive read and puts the alarm back if it ever went missing, so a lost
 * alarm can strand a deadline for a minute rather than forever.
 */
export async function cronTick(deps: TimerDeps): Promise<KeepAliveResult> {
  const keepAlive = await keepAliveTick(deps);
  await armAlarm(deps);
  return keepAlive;
}
