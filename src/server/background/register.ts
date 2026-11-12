/**
 * Registers a timer with the Cloudflare worker: the app side of POST /timers
 * (docs/product/background-work.md). The database trigger covers everything that enters the order
 * queue through SQL; this module covers the deadlines only app code knows about (a failed
 * settlement, a failed analytics drain, a desk that went offline) and is used by the event hooks.
 *
 * Rules it keeps:
 * - Signed, never bearer: `v1=hex(HMAC_SHA256(secret, timestamp + "." + body))` over the exact
 *   bytes that go on the wire, valid for 5 minutes.
 * - Never throws and never blocks the caller's own work. Everything that can go wrong (no
 *   configuration, a refused window, a timeout, a 401) is an outcome, logged once per kind.
 * - Registering an existing key keeps the EARLIEST `at`, so a second registration can only pull a
 *   wake-up forward. A handler that wants a later wake-up answers `retry` or `pending` instead.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TIMER_KIND_SWITCH,
  TimerRequestResultSchema,
  TimerRequestSchema,
  registrationAcceptable,
  signedRequestHeaders,
  timerKey,
  type TimerKind,
} from '../../contracts/background';
import { registerTarget, type RegisterTarget } from './config';
import { backgroundMode } from './switches';

/** How long the app waits for the worker before giving up; the fixer is the backstop. */
export const REGISTER_TIMEOUT_MS = 5_000;

export interface TimerRegistration {
  kind: TimerKind;
  ref: string;
  /** Milliseconds of the committed state that asks for the timer; 0 for a recurring singleton. */
  epoch: number;
  at: number;
}

export type RegisterOutcome =
  /** The worker stored it, or kept an earlier wake-up for the same key. */
  | 'stored'
  | 'kept'
  /** The worker refused the requested time (outside 7 days back to 90 days ahead). */
  | 'refused'
  /** No worker URL or register secret configured: the deploy window and local runs. */
  | 'skipped'
  /** This kind's switch is 'legacy', so nothing new happens. */
  | 'legacy'
  /** The request would not have passed the contract schema; nothing was sent. */
  | 'invalid'
  /** Sent, but the worker said no or never answered. The fixer covers the work. */
  | 'failed';

export interface RegisterDeps {
  target?: RegisterTarget | null;
  fetchImpl?: typeof fetch;
  now?: number;
  log?: (line: string) => void;
}

const warned = new Set<string>();
const warnOnce = (
  log: (line: string) => void,
  key: string,
  line: string,
): void => {
  if (warned.has(key)) return;
  warned.add(key);
  log(line);
};

export function resetRegisterMemory(): void {
  warned.clear();
}

/**
 * One registration. Returns what happened instead of throwing, so a caller in `waitUntil` can log
 * it and move on.
 */
export async function registerTimer(
  timer: TimerRegistration,
  deps: RegisterDeps = {},
): Promise<RegisterOutcome> {
  const log = deps.log ?? ((line: string) => console.warn(line));
  const now = deps.now ?? Date.now();
  const at = Math.trunc(timer.at);
  const request = TimerRequestSchema.safeParse({ ...timer, at });
  if (!request.success) {
    log(
      `[timers] refusing to register ${timer.kind}:${timer.ref}: bad request`,
    );
    return 'invalid';
  }
  if (!registrationAcceptable(at, now)) {
    log(
      `[timers] refusing to register ${timerKey(request.data)}: ${at} is outside the window`,
    );
    return 'invalid';
  }
  const target = deps.target === undefined ? registerTarget() : deps.target;
  if (!target) {
    warnOnce(
      log,
      'unconfigured',
      '[timers] no BACKGROUND_TIMERS_URL or BACKGROUND_REGISTER_SECRET; not registering timers',
    );
    return 'skipped';
  }
  const body = JSON.stringify({
    kind: request.data.kind,
    ref: request.data.ref,
    epoch: request.data.epoch,
    at: request.data.at,
  });
  try {
    const response = await (deps.fetchImpl ?? fetch)(target.url, {
      method: 'POST',
      headers: await signedRequestHeaders(target.secret, body, now),
      body,
      signal: AbortSignal.timeout(REGISTER_TIMEOUT_MS),
    });
    if (!response.ok) {
      warnOnce(
        log,
        `status${response.status}`,
        `[timers] the worker answered ${response.status} to a registration`,
      );
      return 'failed';
    }
    const answer = TimerRequestResultSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!answer.success) return 'failed';
    return answer.data.stored;
  } catch (error) {
    warnOnce(
      log,
      'unreachable',
      `[timers] could not reach the worker: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return 'failed';
  }
}

/**
 * Registers only while this kind's switch is not 'legacy', which is what every event hook wants:
 * in 'legacy' nothing new happens at all, in 'shadow' the timer fires and the handler only logs.
 */
export async function registerTimerIfEnabled(
  db: SupabaseClient,
  timer: TimerRegistration,
  deps: RegisterDeps = {},
): Promise<RegisterOutcome> {
  const mode = await backgroundMode(db, TIMER_KIND_SWITCH[timer.kind]);
  if (mode === 'legacy') return 'legacy';
  return registerTimer(timer, deps);
}

/** Several timers at once; they are independent, so one failure never hides another. */
export async function registerTimersIfEnabled(
  db: SupabaseClient,
  timers: readonly TimerRegistration[],
  deps: RegisterDeps = {},
): Promise<RegisterOutcome[]> {
  return Promise.all(
    timers.map((timer) => registerTimerIfEnabled(db, timer, deps)),
  );
}
