/**
 * The two app endpoints of the event-driven background work (docs/product/background-work.md):
 *
 *   POST /api/internal/timer      the worker fires a timer. Signed, 5 minute window, answers one
 *                                 of the five dispositions.
 *   POST /api/internal/reconcile  public.background_fix() found overdue work. Bearer, runs the
 *                                 existing tick handlers unfiltered.
 *
 * Both answer a non-2xx rather than a wrong 2xx when anything is unclear: a 2xx on the fire path
 * is an acknowledgement, so the work has to be finished before it is sent (oai-review F18), and a
 * failed delivery is exactly what the worker's retry schedule and the fixer exist for.
 */
import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  SIGNATURE_HEADER,
  SWITCH_KINDS,
  SwitchKindSchema,
  TIMER_KIND_SWITCH,
  TIMESTAMP_HEADER,
  TimerFireSchema,
  bearerAuthorized,
  verifyBackgroundBody,
  type SwitchKind,
} from '../../contracts/background';
import { supportService } from '../support/store';
import { drainConfig, drainOnce } from '../analytics/drain';
import { orderPostsConfig, runOrderPosts } from '../discord/order-post-tick';
import { roleSyncConfig, syncDiscordRoles } from '../discord/role-sync';
import { runPaymentsSweep } from '../payments/webhook';
import { fireSecret, reconcileSecret } from './config';
import { handleTimerFire, timerPorts } from './handlers';
import { backgroundMode } from './switches';

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });

const methodNotAllowed = () =>
  json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });

const why = (error: unknown): string =>
  error instanceof Error ? error.message.slice(0, 200) : 'unknown error';

// ---------------------------------------------------------------- POST /api/internal/timer

/**
 * A timer came due. The signature is verified over the raw request text before anything is
 * parsed, the switch decides whether this does anything at all, and the handler finishes its
 * bounded work before the answer goes out.
 */
export const timerFire: APIRoute = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();
  const body = await request.text();
  const check = await verifyBackgroundBody({
    secret: fireSecret(),
    signature: request.headers.get(SIGNATURE_HEADER),
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    body,
  });
  if (!check.ok)
    return json({ error: 'unauthorized', reason: check.reason }, 401);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json({ error: 'not json' }, 400);
  }
  const fire = TimerFireSchema.safeParse(parsed);
  if (!fire.success) return json({ error: 'not a timer' }, 400);
  const db = supportService();
  if (!db) return json({ error: 'Database unavailable.' }, 503);
  try {
    const mode = await backgroundMode(db, TIMER_KIND_SWITCH[fire.data.kind]);
    const ports = timerPorts(db, new URL(request.url).origin);
    return json(await handleTimerFire(fire.data, ports, mode));
  } catch (error) {
    // Never a 2xx: the worker keeps the timer, retries on its own schedule, and the fixer is the
    // backstop after that.
    console.warn(`[timer] ${fire.data.key} failed: ${why(error)}`);
    return json({ error: 'timer_failed' }, 503);
  }
};

// ---------------------------------------------------------------- POST /api/internal/reconcile

const ReconcileRequestSchema = z
  .object({
    reason: z.string().max(40).optional(),
    kinds: z.array(SwitchKindSchema).max(SWITCH_KINDS.length).optional(),
  })
  .strict();

/**
 * Runs one kind of legacy tick work, exactly the code the 10 s dispatcher calls. Deliberately not
 * gated by the switch: the fixer is the backstop for every mode, and every one of these handlers
 * is idempotent, so running it while the dispatcher also runs it costs a round trip and nothing
 * else.
 */
async function reconcileKind(kind: SwitchKind, site: string): Promise<string> {
  if (kind === 'orders') {
    const config = orderPostsConfig();
    if (!config) return 'off';
    const result = await runOrderPosts(config, site);
    return `posted ${result.posted}, closed ${result.closed}, failed ${result.failed}`;
  }
  if (kind === 'payments') {
    const result = await runPaymentsSweep();
    return result
      ? `holds ${result.walletHoldsReleased}, settled ${result.settled}`
      : 'off';
  }
  if (kind === 'analytics') {
    const config = drainConfig();
    if (!config) return 'off';
    const db = supportService();
    if (!db) throw new Error('database unavailable');
    const result = await drainOnce(db, config);
    return `sent ${result.sent}, failed ${result.failed}, dropped ${result.dropped}`;
  }
  if (!roleSyncConfig()) return 'off';
  const result = await syncDiscordRoles(null);
  return `checked ${result.checked}, changed ${result.changed}, failed ${result.failed}`;
}

/**
 * The hourly fixer found work, which means a timer was missed. The call is the alert: this line
 * and the `background_fix` warning in the Postgres log are the two places the evidence lands
 * ([What to watch](../../../docs/product/background-work.md)).
 */
export const reconcileTick: APIRoute = async ({ request }) => {
  if (request.method !== 'POST') return methodNotAllowed();
  if (
    !bearerAuthorized(request.headers.get('authorization'), reconcileSecret())
  )
    return json({ error: 'unauthorized' }, 401);
  const raw = (await request.text()).trim();
  let body: unknown = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'not json' }, 400);
    }
  }
  const parsed = ReconcileRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'not a reconcile request' }, 400);
  const kinds = parsed.data.kinds?.length ? parsed.data.kinds : SWITCH_KINDS;
  const reason = parsed.data.reason ?? 'manual';
  console.warn(`[background-fix] reconciling ${kinds.join(', ')} (${reason})`);
  const site = new URL(request.url).origin;
  const ran: Record<string, string> = {};
  let failures = 0;
  for (const kind of kinds) {
    try {
      ran[kind] = await reconcileKind(kind, site);
    } catch (error) {
      failures += 1;
      ran[kind] = `failed: ${why(error)}`;
      console.warn(`[background-fix] ${kind} failed: ${why(error)}`);
    }
  }
  // All of it failing is worth a Vercel error; one kind failing is in the body and the log.
  return json({ reason, ran }, failures === kinds.length ? 503 : 200);
};
