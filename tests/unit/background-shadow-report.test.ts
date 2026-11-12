/**
 * The shadow watch report (scripts/background-shadow-report.mjs). Everything the report decides is
 * a pure function over a log export, a database answer and a worker answer, so the fixtures in
 * tests/fixtures/background-shadow are a whole watch window: six orders queued inside it, one from
 * the day before, a streaming booking, an order a priority pick was still holding, one whose
 * order-post registration never reached the worker, and one whose expiry is past the end of the
 * export.
 *
 * The constants are mirrored out of src/contracts/background.ts because a script cannot import
 * TypeScript; the first test is what keeps the mirror honest.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ORDER_EXPIRE_DELAY_MS as CONTRACT_EXPIRE,
  ORDER_POST_DELAY_MS as CONTRACT_POST,
  PRESENCE_CHECK_INTERVAL_MS as CONTRACT_PRESENCE,
  SWITCH_KINDS as CONTRACT_SWITCH_KINDS,
  TIMER_KINDS as CONTRACT_TIMER_KINDS,
  TIMER_KIND_SWITCH as CONTRACT_TIMER_KIND_SWITCH,
} from '../../src/contracts/background';
import {
  FIRE_TOLERANCE_MS,
  ORDER_EXPIRE_DELAY_MS,
  ORDER_POST_DELAY_MS,
  PRESENCE_CHECK_INTERVAL_MS,
  SETTLE_ATTEMPT_CAP,
  SWITCH_KINDS,
  TIMER_KINDS,
  TIMER_KIND_SWITCH,
  attributeLine,
  buildSql,
  connectionUrl,
  grade,
  judgedBounds,
  matchOrder,
  parseArgs,
  parseLogLine,
  parseLogs,
  parseShadowMessage,
  parseSqlOutput,
  readTimestamp,
  rearmChecks,
  realPost,
  renderReport,
  reportedNow,
  run,
} from '../../scripts/background-shadow-report.mjs';

/*
 * The script is plain JavaScript, so these are the shapes this suite reads back out of it. They
 * are the report's own vocabulary: a check, a verdict per kind, and the two legs of an order.
 */
interface Check {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'note';
  detail: string;
}
interface KindVerdict {
  mode: string;
  verdict: 'PASS' | 'FAIL';
  checks: Check[];
  ready: string;
  flip: string | null;
}
interface Leg {
  decision: string;
  judged: boolean;
  lines: number;
  delay: number | null;
  firedAt: number | null;
  intendedAt: number;
  would: string[];
  note: string | null;
  shadowActs: boolean;
  real: boolean;
  realWhy: string;
  why?: string;
}
interface OrderRow {
  id: string;
  reference: string;
  streaming: boolean;
  picked: boolean;
  post: Leg;
  expire: Leg;
}
interface Entry {
  ts: number | null;
  marker: string;
  message: string;
  kind?: string;
  ref?: string;
  would?: string;
  action?: string;
  at?: number;
  note?: string;
}
interface Window {
  from: number;
  to: number;
}
interface Logs {
  entries: Entry[];
  counts: Record<string, number>;
  lines: number;
  untimed: number;
  malformed: number;
  other: number;
  window: Window | null;
}
interface Database {
  errors: string[];
  session: { now_ms: number; read_only: string };
  switches: { kind: string; mode: string; updated_at: string }[];
  overdue: Record<string, boolean>;
  orders: unknown[];
  outbox: Record<string, number | string | null>;
  wallet_holds: unknown[];
  settlements: { claimable: number; exhausted: unknown[] };
}

const dir = 'tests/fixtures/background-shadow';
const read = (name: string) => readFileSync(`${dir}/${name}`, 'utf8');
const database = JSON.parse(read('database.json')) as Database;
const health = { source: 'fixture', data: JSON.parse(read('health.json')) };
const logs = parseLogs(read('vercel-logs.jsonl')) as Logs;
const window = logs.window as Window;
const NOW = Date.parse('2026-11-12T11:01:00Z');
const ORDER_A = 'b1a77e3c-0f2a-4a6e-9c21-9e4f0a1d3b55';
const ORDER_D = '4a8b0c16-2e5d-4c9b-9f31-7a0e5b2c8d41';
const ORDER_E = '6e3f9a20-8b14-4d7c-a052-3c9f1e6b7a82';

const bounds = judgedBounds(logs, database.switches);
const orders = database.orders.map(
  (order: unknown) => matchOrder(order, logs.entries, bounds) as OrderRow,
);
type Kind = 'orders' | 'payments' | 'analytics' | 'roles';
const KINDS = SWITCH_KINDS as Kind[];
const verdicts = (state: Record<string, unknown>) =>
  grade(state) as Record<Kind, KindVerdict>;
const windows = (state: unknown, switches: unknown) =>
  judgedBounds(state, switches) as Record<Kind, Window | null>;
const graded = verdicts({
  db: database,
  logs,
  health,
  orders,
  rearm: rearmChecks(logs.entries),
  bounds,
  now: NOW,
});
const order = (reference: string) =>
  orders.find((row) => row.reference === reference) as OrderRow;
const failing = (kind: KindVerdict) =>
  kind.checks.filter((check) => check.status === 'fail').map((c) => c.name);

describe('the contract mirror', () => {
  it('matches src/contracts/background.ts', () => {
    expect(ORDER_POST_DELAY_MS).toBe(CONTRACT_POST);
    expect(ORDER_EXPIRE_DELAY_MS).toBe(CONTRACT_EXPIRE);
    expect(PRESENCE_CHECK_INTERVAL_MS).toBe(CONTRACT_PRESENCE);
    expect(TIMER_KINDS).toStrictEqual([...CONTRACT_TIMER_KINDS]);
    expect(SWITCH_KINDS).toStrictEqual([...CONTRACT_SWITCH_KINDS]);
    expect(TIMER_KIND_SWITCH).toStrictEqual(CONTRACT_TIMER_KIND_SWITCH);
    // The acceptance rule for a fire: the owner's 2 s, end to end.
    expect(FIRE_TOLERANCE_MS).toBe(2_000);
  });

  it('keeps the settle cap the claim path uses', () => {
    const sql = readFileSync('src/server/background/plan.ts', 'utf8');
    expect(sql).toContain(`SETTLE_ATTEMPT_CAP = ${SETTLE_ATTEMPT_CAP}`);
  });
});

describe('reading a timestamp', () => {
  it('takes milliseconds, seconds and both printed shapes', () => {
    expect(readTimestamp(1794452400000)).toBe(1794452400000);
    expect(readTimestamp(1794452400)).toBe(1794452400000);
    expect(readTimestamp('1794452400000')).toBe(1794452400000);
    expect(readTimestamp('2026-11-12T10:00:00.000Z')).toBe(
      Date.parse('2026-11-12T10:00:00Z'),
    );
    // A postgres-style stamp with an offset keeps its offset.
    expect(readTimestamp('2026-11-12 11:00:00+01')).toBe(
      Date.parse('2026-11-12T10:00:00Z'),
    );
  });

  it('reads a stamp with no zone as UTC, which is what Vercel prints', () => {
    expect(readTimestamp('2026-11-12 10:00:00.250 [info] hello')).toBe(
      Date.parse('2026-11-12T10:00:00.250Z'),
    );
  });

  it('answers null for anything else', () => {
    expect(readTimestamp('no time here')).toBeNull();
    expect(readTimestamp(null)).toBeNull();
    expect(readTimestamp(Number.NaN)).toBeNull();
  });
});

describe('parsing one line', () => {
  it('reads a `vercel logs --json` object', () => {
    expect(
      parseLogLine(
        '{"timestampInMs":1794452400000,"requestId":"req_1","message":"[timers] hi"}',
      ),
    ).toStrictEqual({
      ts: 1794452400000,
      message: '[timers] hi',
      requestId: 'req_1',
    });
  });

  it('reads a nested payload and a seconds timestamp', () => {
    expect(
      parseLogLine('{"timestamp":1794452400,"payload":{"text":"[timers] hi"}}'),
    ).toStrictEqual({ ts: 1794452400000, message: '[timers] hi' });
  });

  it('keeps an unreadable object as text rather than throwing', () => {
    const parsed = parseLogLine('{"message": broken') as {
      malformed?: string;
    };
    expect(parsed?.malformed).toBe('unreadable JSON');
  });

  it('skips a blank line', () => {
    expect(parseLogLine('   ')).toBeNull();
  });
});

describe('parsing a shadow line', () => {
  it('reads kind, ref, would and the note', () => {
    expect(
      parseShadowMessage(
        `[timer-shadow] order-post ${ORDER_A} would=stale (order is in_progress)`,
      ),
    ).toStrictEqual({
      marker: 'timer-shadow',
      kind: 'order-post',
      ref: ORDER_A,
      would: 'stale',
      action: 'stale',
      note: 'order is in_progress',
    });
  });

  it('reads the instant a pending or retry line names', () => {
    expect(
      parseShadowMessage(
        '[timer-shadow] presence-check desk would=retry@1794452400000',
      ),
    ).toMatchObject({ action: 'retry', at: 1794452400000, ref: 'desk' });
  });

  it('reads an event hook line, whose first word is a switch kind', () => {
    expect(
      parseShadowMessage('[event-shadow] analytics outbox would=drain'),
    ).toStrictEqual({
      marker: 'event-shadow',
      kind: 'analytics',
      ref: 'outbox',
      would: 'drain',
      action: 'drain',
    });
  });

  it('refuses a kind that is not in the contract', () => {
    expect(
      parseShadowMessage('[timer-shadow] order-pest abc would=post'),
    ).toBeNull();
    expect(parseShadowMessage('[background] a hook failed: nope')).toBeNull();
  });
});

describe('parsing a whole export', () => {
  it('counts every marker and finds the window', () => {
    expect(logs.counts).toStrictEqual({
      'timer-shadow': 18,
      'event-shadow': 9,
      'background-fix': 1,
      background: 0,
      timers: 1,
    });
    expect(logs.window).toStrictEqual({
      from: Date.parse('2026-11-11T10:30:00.400Z'),
      to: Date.parse('2026-11-12T11:00:30Z'),
    });
    const stamps = logs.entries.map((entry) => entry.ts ?? 0);
    expect(stamps).toStrictEqual([...stamps].sort((a, b) => a - b));
  });

  it('reads the plain text export, request lines and all', () => {
    const text = parseLogs(read('vercel-logs.txt')) as Logs;
    expect(text.entries).toHaveLength(7);
    expect(text.other).toBe(2);
    // The one line with no timestamp is kept and counted, because it still carries a decision.
    expect(text.untimed).toBe(1);
    expect(text.entries.find((entry) => entry.ts === null)).toMatchObject({
      kind: 'presence-check',
      action: 'sync',
    });
  });

  it('reads an export that is one JSON array', () => {
    const array = parseLogs(
      JSON.stringify([
        { timestampInMs: 1794452400000, message: '[timers] one' },
        { timestampInMs: 1794452401000, message: 'a request line' },
      ]),
    ) as Logs;
    expect(array.entries).toHaveLength(1);
    expect(array.other).toBe(1);
  });

  it('prefers the longer marker so [background-fix] is never [background]', () => {
    const one = parseLogs(
      '2026-11-12T10:00:00Z [background-fix] reconciling roles (overdue)',
    ) as Logs;
    expect(one.counts['background-fix']).toBe(1);
    expect(one.counts.background).toBe(0);
  });
});

describe('attributing a loose line to a switch', () => {
  it('follows the timer kind it names', () => {
    expect(
      attributeLine(
        `[timers] refusing to register order-post:${ORDER_E}: bad request`,
      ),
    ).toStrictEqual(['orders']);
    expect(
      attributeLine('[background] 2 order posts would not close'),
    ).toStrictEqual(['orders']);
    expect(
      attributeLine('[background] the wallet hold of abc would not release'),
    ).toStrictEqual(['payments']);
    expect(
      attributeLine(
        '[background-fix] reconciling analytics, roles (overdue)',
      ).sort(),
    ).toStrictEqual(['analytics', 'roles']);
  });

  it('names no kind when the line names none, which means all four', () => {
    expect(
      attributeLine('[timers] could not reach the worker: timeout'),
    ).toStrictEqual([]);
  });
});

describe('matching an order to its timers', () => {
  it('agrees when shadow would post and the dispatcher posted', () => {
    const row = order('DL-9001');
    expect(row.post).toMatchObject({
      judged: true,
      decision: 'agrees',
      delay: 214,
      shadowActs: true,
      real: true,
    });
    expect(row.expire).toMatchObject({ decision: 'agrees', real: false });
  });

  it('agrees when shadow would expire and the dispatcher expired it', () => {
    expect(order('DL-9002').expire).toMatchObject({
      decision: 'agrees',
      delay: 421,
      shadowActs: true,
      realWhy: 'the dispatcher expired it',
    });
  });

  it('agrees on a streaming booking, which has no public post at all', () => {
    const row = order('DL-9003');
    expect(row.streaming).toBe(true);
    expect(row.post).toMatchObject({
      decision: 'agrees',
      shadowActs: false,
      real: false,
      note: 'streaming booking, no public post',
    });
  });

  it('defers an order the due predicate was still holding', () => {
    const row = order('DL-9004');
    expect(row.picked).toBe(true);
    expect(row.post.decision).toBe('deferred');
    expect(row.post.why).toContain('which shadow does not re-arm');
    expect(row.post.why).toContain('the dispatcher posted');
  });

  it('calls out an order that never got its timer', () => {
    expect(order('DL-9005').post).toMatchObject({
      decision: 'missing',
      lines: 0,
      judged: true,
    });
  });

  it('does not judge a deadline past the end of the export', () => {
    expect(order('DL-9006').expire).toMatchObject({
      decision: 'not judged',
      judged: false,
    });
    expect(order('DL-9006').post.judged).toBe(true);
  });

  it('calls a real disagreement a disagreement', () => {
    const queuedAt = Date.parse('2026-11-12T10:00:00Z');
    const entries = parseLogs(
      `{"timestampInMs":${queuedAt + ORDER_POST_DELAY_MS + 300},"message":"[timer-shadow] order-post ${ORDER_A} would=stale (too late to post)"}`,
    ).entries;
    const row = matchOrder(
      {
        id: ORDER_A,
        reference: 'DL-9100',
        status: 'queued',
        queued_at: '2026-11-12 10:00:00+00',
        queued_at_ms: queuedAt,
        public_queued_at: '2026-11-12 10:00:00+00',
        streaming: false,
        posts: [
          {
            same_epoch: true,
            state: 'open',
            opened: true,
            created_at_ms: queuedAt + 103_000,
          },
        ],
      },
      entries,
      { orders: { from: queuedAt, to: queuedAt + 600_000 }, payments: null },
    ) as OrderRow;
    expect(row.post.decision).toBe('differs');
    expect(row.post.why).toBe(
      'shadow would not post, but the dispatcher posted (open)',
    );
  });

  it('reads what the dispatcher did off the post rows for this queue epoch', () => {
    expect(
      realPost({
        posts: [
          {
            same_epoch: false,
            state: 'closed',
            opened: true,
            created_at_ms: 1,
          },
        ],
      }),
    ).toMatchObject({ posted: false, claimed: false });
    expect(
      realPost({
        posts: [
          {
            same_epoch: true,
            state: 'posting',
            opened: false,
            created_at_ms: 7,
          },
        ],
      }),
    ).toMatchObject({ posted: false, claimed: true, at: 7 });
  });
});

describe('the judged window', () => {
  it('starts at the later of the export and the last switch change', () => {
    const changed = Date.parse('2026-11-12T10:30:00Z');
    const narrowed = windows(logs, [
      { kind: 'orders', mode: 'shadow', updated_at: '2026-11-12 10:30:00+00' },
    ]);
    expect(narrowed.orders).toStrictEqual({ from: changed, to: window.to });
  });

  it('judges nothing for a kind that is legacy or has no row', () => {
    expect(
      windows(logs, [
        {
          kind: 'orders',
          mode: 'legacy',
          updated_at: '2026-11-12 10:30:00+00',
        },
      ]).orders,
    ).toBeNull();
    expect(windows(logs, []).payments).toBeNull();
    expect(windows({ window: null }, database.switches).orders).toBeNull();
  });
});

describe('re-arm punctuality', () => {
  it('pairs a retry with the line that answered it', () => {
    const entries = parseLogs(
      [
        '{"timestampInMs":1794452400000,"message":"[timer-shadow] presence-check desk would=retry@1794452420000"}',
        '{"timestampInMs":1794452420900,"message":"[timer-shadow] presence-check desk would=retry@1794452440000"}',
        '{"timestampInMs":1794452445000,"message":"[timer-shadow] presence-check desk would=done (nobody online)"}',
      ].join('\n'),
    ).entries as Entry[];
    expect(rearmChecks(entries)).toStrictEqual([
      {
        kind: 'presence-check',
        ref: 'desk',
        expectedAt: 1794452420000,
        firedAt: 1794452420900,
        delay: 900,
        status: 'ok',
      },
      {
        kind: 'presence-check',
        ref: 'desk',
        expectedAt: 1794452440000,
        firedAt: 1794452445000,
        delay: 5000,
        status: 'late',
      },
    ]);
  });

  it('leaves a wake-up with no answer open, which shadow mode always does', () => {
    expect(rearmChecks(logs.entries)).toStrictEqual([
      {
        kind: 'order-post',
        ref: ORDER_D,
        expectedAt: Date.parse('2026-11-12T10:32:40.205Z'),
        firedAt: null,
        status: 'open',
      },
    ]);
  });
});

describe('the verdict per kind', () => {
  it('passes the three kinds whose evidence is clean', () => {
    expect(graded.analytics.verdict).toBe('PASS');
    expect(graded.roles.verdict).toBe('PASS');
    expect(graded.payments.verdict).toBe('PASS');
  });

  it('fails orders on the missing timer and the registration that was refused', () => {
    expect(graded.orders.verdict).toBe('FAIL');
    expect(
      graded.orders.checks
        .filter((check) => check.status === 'fail')
        .map((check) => check.name),
    ).toStrictEqual(['order-post coverage', 'registrations']);
    expect(graded.orders.ready).toBe('no: order-post coverage, registrations');
  });

  it('writes the UPDATE only for a kind that passed from shadow', () => {
    expect(graded.payments.flip).toBe(
      "update public.background_switches set mode = 'live', updated_at = now() where kind = 'payments';",
    );
    expect(graded.orders.flip).toBeNull();
    expect(graded.payments.ready).toBe('yes');
  });

  it('fails every kind on an overdue predicate, a drop and a missing health read', () => {
    const angry = verdicts({
      db: {
        ...database,
        overdue: { orders: true, payments: true, analytics: true, roles: true },
      },
      logs,
      health: { data: { ...health.data, dropped: 3 } },
      orders,
      rearm: [],
      bounds,
      now: NOW,
    });
    for (const kind of KINDS) {
      const names = angry[kind].checks
        .filter((check) => check.status === 'fail')
        .map((check) => check.name);
      expect(names).toContain('overdue');
      expect(names).toContain('worker drops');
      expect(angry[kind].verdict).toBe('FAIL');
    }
    expect(
      verdicts({
        db: database,
        logs,
        health: null,
        orders,
        rearm: [],
        bounds,
        now: NOW,
      }).roles.checks,
    ).toContainEqual({
      name: 'worker drops',
      status: 'fail',
      detail: 'no /timers/health answer, so drops are unknown',
    });
  });

  it('fails a kind whose switch is still legacy, because nothing is registered', () => {
    const legacy = verdicts({
      db: {
        ...database,
        switches: database.switches.map((row) =>
          row.kind === 'roles' ? { ...row, mode: 'legacy' } : row,
        ),
      },
      logs,
      health,
      orders,
      rearm: [],
      bounds,
      now: NOW,
    });
    expect(legacy.roles.verdict).toBe('FAIL');
    expect(legacy.roles.checks[0]?.detail).toContain('legacy');
  });

  it('fails the two kinds with no order of their own when nothing shows them firing', () => {
    const quiet = parseLogs(
      `{"timestampInMs":${NOW - 60_000},"message":"[timer-shadow] order-post ${ORDER_A} would=post"}`,
    ) as Logs;
    const blind = verdicts({
      db: database,
      logs: quiet,
      health,
      orders,
      rearm: [],
      bounds,
      now: NOW,
    });
    expect(failing(blind.roles)).toStrictEqual(['evidence']);
    expect(failing(blind.analytics)).toStrictEqual(['evidence']);
    // An order kind's evidence is its orders, which this export still has none of.
    expect(failing(blind.orders)).toContain('order-post coverage');
  });

  it('accepts an event hook line as evidence when no retry timer was needed', () => {
    const hooksOnly = parseLogs(
      `{"timestampInMs":${NOW - 60_000},"message":"[event-shadow] analytics outbox would=drain"}`,
    ) as Logs;
    const seen = verdicts({
      db: database,
      logs: hooksOnly,
      health,
      orders,
      rearm: [],
      bounds,
      now: NOW,
    });
    expect(failing(seen.analytics)).toStrictEqual([]);
    expect(
      seen.analytics.checks.find((check) => check.name === 'evidence'),
    ).toMatchObject({
      status: 'pass',
      detail: '0 timer lines and 1 event line in the export',
    });
  });

  it('fails analytics on a parked fact, which the doc calls an alert', () => {
    const parked = verdicts({
      db: { ...database, outbox: { ...database.outbox, parked: 2 } },
      logs,
      health,
      orders,
      rearm: [],
      bounds,
      now: NOW,
    });
    expect(parked.analytics.verdict).toBe('FAIL');
  });

  it('warns on a stale wallet hold and on an exhausted settlement without failing', () => {
    const warned = verdicts({
      db: {
        ...database,
        wallet_holds: [{ id: 'i1', status: 'open', stripe_session_id: null }],
        settlements: {
          claimable: 0,
          exhausted: [
            {
              order_id: ORDER_A,
              settle: 'capture',
              attempts: 21,
              state: 'authorized',
              updated_at: '2026-11-12 09:00:00+00',
              last_error: 'card declined',
            },
          ],
        },
      },
      logs,
      health,
      orders,
      rearm: [],
      bounds,
      now: NOW,
    });
    expect(warned.payments.verdict).toBe('PASS');
    expect(warned.payments.ready).toContain('after reading the warnings');
    expect(
      warned.payments.checks
        .filter((check) => check.status === 'warn')
        .map((check) => check.name),
    ).toStrictEqual(['stale wallet holds', 'exhausted settlements']);
  });

  it('fails a settle-retry line for an order past the attempt cap', () => {
    const capped = verdicts({
      db: {
        ...database,
        settlements: {
          claimable: 0,
          exhausted: [
            {
              order_id: '2f6c1d84-77aa-4a1e-bb0e-5d2c2f0f1a90',
              settle: 'release',
              attempts: 20,
              state: 'authorized',
              updated_at: '2026-11-12 10:15:36+00',
              last_error: '',
            },
          ],
        },
      },
      logs,
      health,
      orders,
      rearm: [],
      bounds,
      now: NOW,
    });
    expect(
      capped.payments.checks.find((check) => check.name === 'settle-retry cap'),
    ).toMatchObject({ status: 'fail' });
  });

  it('asks for 24 h of logs before it calls a kind ready', () => {
    const midnight = Date.parse('2026-11-12T00:00:00Z');
    const short = parseLogs(
      read('vercel-logs.jsonl')
        .split('\n')
        .filter(
          (line) => line.trim() && JSON.parse(line).timestampInMs > midnight,
        )
        .join('\n'),
    );
    const quick = verdicts({
      db: database,
      logs: short,
      health,
      orders: database.orders.map((row: unknown) =>
        matchOrder(row, short.entries, judgedBounds(short, database.switches)),
      ),
      rearm: rearmChecks(short.entries),
      bounds: judgedBounds(short, database.switches),
      now: NOW,
    });
    expect(quick.roles.verdict).toBe('PASS');
    expect(quick.roles.ready).toBe(
      'not yet: 7.98 h of logs, the doc asks for 24 h per kind (2 to 3 days before the first flip)',
    );
  });
});

describe('the SQL', () => {
  const sql = buildSql(24);

  it('is read only before it reads anything', () => {
    const statements = sql
      .split('\n')
      .filter((line) => !line.startsWith('--') && !line.startsWith('\\'));
    expect(statements[0]).toBe('begin;');
    expect(statements[1]).toBe('set transaction read only;');
    expect(sql).toContain("set local statement_timeout = '10s';");
    expect(sql.trimEnd().endsWith('rollback;')).toBe(true);
  });

  it('contains no statement that could write', () => {
    // Word boundaries, so `updated_at` and the `schedule` column stay readable.
    for (const word of [
      'insert',
      'update',
      'delete',
      'truncate',
      'create',
      'drop',
      'alter',
      'grant',
      'revoke',
      'commit',
      'for update',
      'for share',
      'nextval',
      'setval',
    ])
      expect(sql.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`));
    for (const call of [
      'cron.schedule',
      'cron.alter_job',
      'cron.unschedule',
      'net.http_post',
      'background_fix',
      'background_finalize',
      'background_rollback',
      'background_register_timer',
    ])
      expect(sql).not.toContain(call);
  });

  it('asks for every section the report renders', () => {
    for (const name of [
      'session',
      'switches',
      'overdue',
      'cron_jobs',
      'cron_runs',
      'orders',
      'outbox',
      'wallet_holds',
      'settlements',
    ])
      expect(sql).toContain(`select '@@${name}';`);
    // The watch queries the doc names, called rather than copied.
    expect(sql).toContain('public.background_overdue()');
    expect(sql).toContain('public.checkout_stale_wallet_holds(20)');
    expect(sql).toContain(`attempts >= ${SETTLE_ATTEMPT_CAP}`);
    expect(sql).toContain('cron.job_run_details');
  });

  it('reads the outbox by the column the table really has', () => {
    const table = readFileSync(
      'supabase/migrations/20261106110000_analytics_outbox.sql',
      'utf8',
    );
    expect(table).toContain('occurred_at timestamptz');
    expect(sql).toContain('min(occurred_at)');
  });

  it('takes the window as whole hours and refuses anything else', () => {
    expect(buildSql(1)).toContain("interval '1 hours'");
    expect(() => buildSql(0)).toThrow('1 to 168');
    expect(() => buildSql(1.5)).toThrow('1 to 168');
    expect(() => buildSql(200)).toThrow('1 to 168');
  });

  it('reads the sections back, names the ones that failed and keeps psql complaints', () => {
    const parsed = parseSqlOutput(
      [
        '@@session',
        'session\t{"now_ms":1}',
        '@@switches',
        'switches\tnull',
        '@@overdue',
      ].join('\n'),
      'ERROR:  permission denied for schema cron\npsql:<stdin>:12: ERROR:  nope\nSET',
    ) as unknown as { session: unknown; switches: unknown; errors: string[] };
    expect(parsed.session).toStrictEqual({ now_ms: 1 });
    expect(parsed.switches).toBeNull();
    expect(parsed.errors).toContain('overdue: no answer (the query failed)');
    expect(parsed.errors).toContain('orders: no answer');
    expect(parsed.errors).toContain(
      'ERROR:  permission denied for schema cron',
    );
    expect(parsed.errors).not.toContain('SET');
  });
});

describe('the command', () => {
  it('needs a log export', () => {
    expect(() => parseArgs([])).toThrow('Usage:');
    expect(() => parseArgs(['--logs'])).toThrow('needs a value');
    expect(() => parseArgs(['--nope', '1'])).toThrow('Unknown argument');
    expect(parseArgs(['--print-sql']).sqlOnly).toBe(true);
  });

  it('builds a libpq URL with no password in it', () => {
    expect(
      connectionUrl({
        dbHost: 'db.example.supabase.co',
        dbUser: 'postgres',
        dbName: 'postgres',
        dbPort: 5432,
      }),
    ).toBe('postgresql://postgres@db.example.supabase.co:5432/postgres');
    expect(connectionUrl({ dbUrl: 'postgresql://host/db' })).toBe(
      'postgresql://host/db',
    );
    expect(connectionUrl({ dbUrl: 'postgresql://postgres@host/db' })).toBe(
      'postgresql://postgres@host/db',
    );
    expect(connectionUrl({})).toBeNull();
  });

  it('refuses a URL that carries the password, which `ps` would show', () => {
    expect(() =>
      connectionUrl({ dbUrl: 'postgresql://postgres:hunter2@host:5432/db' }),
    ).toThrow('pass it as PW instead');
  });

  it('judges a replayed answer as of the moment it was captured', () => {
    expect(reportedNow({ dbJson: 'x' }, database, { now: () => 42 })).toBe(
      database.session.now_ms,
    );
    expect(reportedNow({ now: '2026-11-12T11:01:00Z' }, null, {})).toBe(NOW);
    expect(reportedNow({}, null, { now: () => 42 })).toBe(42);
    expect(() => reportedNow({ now: 'yesterday' }, null, {})).toThrow('--now');
  });

  it('never opens a connection without both a host and a password', async () => {
    const calls: string[] = [];
    const { report } = await run(['--logs', `${dir}/vercel-logs.jsonl`], {
      spawn: (command: string) => {
        calls.push(command);
        return { stdout: '', stderr: '' };
      },
      now: () => NOW,
    });
    expect(calls).toStrictEqual([]);
    expect(report).toContain('| database | skipped: no connection');
    expect(report).toContain('| worker | skipped: no HS');
  });

  it('passes the password through the environment, never through the arguments', async () => {
    process.env.PW = 'a-password-nobody-should-see';
    const seen: {
      args: string[];
      env: Record<string, string>;
      input: string;
    }[] = [];
    try {
      await run(
        ['--logs', `${dir}/vercel-logs.jsonl`, '--db-host', 'db.example.co'],
        {
          spawn: (
            _command: string,
            args: string[],
            options: { env: Record<string, string>; input: string },
          ) => {
            seen.push({ args, env: options.env, input: options.input });
            return { stdout: 'session\t{"read_only":"on"}', stderr: '' };
          },
          now: () => NOW,
        },
      );
    } finally {
      delete process.env.PW;
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]?.args.join(' ')).toBe(
      '-X -q -At postgresql://postgres@db.example.co:5432/postgres',
    );
    expect(seen[0]?.env.PGPASSWORD).toBe('a-password-nobody-should-see');
    expect(seen[0]?.env.PGSSLMODE).toBe('require');
    expect(seen[0]?.input).toContain('set transaction read only;');
  });
});

describe('the rendered report', () => {
  const report = renderReport({
    db: database,
    dbSource: 'one read-only psql connection to db.example.supabase.co',
    logs,
    health,
    now: NOW,
    options: { hours: 24, logs: `${dir}/vercel-logs.jsonl` },
  });

  it('leads with a PASS or FAIL and a ready-to-flip line per kind', () => {
    expect(report).toContain('| analytics | shadow | **PASS** | yes |');
    expect(report).toContain(
      '| orders | shadow | **FAIL** | no: order-post coverage, registrations |',
    );
    for (const kind of KINDS)
      expect(report).toMatch(new RegExp(`### ${kind}: (PASS|FAIL)`));
    expect(report.match(/- ready to flip: /g)).toHaveLength(4);
  });

  it('says the read was read only', () => {
    expect(report).toContain('transaction_read_only=on');
    expect(report).toContain(
      'Read only: nothing here writes, schedules or flips anything.',
    );
  });

  it('prints every order with its two fire times and what the dispatcher did', () => {
    expect(report).toContain(
      '| DL-9001 | 2026-11-12 10:00:00.000+00 | +214 ms | post | the dispatcher posted (closed) | +180 ms | stale | a teammate accepted it |',
    );
    expect(report).toContain(
      '| DL-9005 | 2026-11-12 10:40:00.000+00 | **missing** |',
    );
    expect(report).toContain('DL-9003 (streaming)');
    expect(report).toContain('DL-9004 (picked)');
    // The instant a pending line names is printed as a time, not as 13 digits.
    expect(report).toContain('pending@2026-11-12T10:32:40.205Z');
  });

  it('prints the three watch queries the doc asks for', () => {
    expect(report).toContain(
      '| duoly-dispatch | 8637 | 8637 | 0 | 0 | 43185 |',
    );
    expect(report).toContain('| 3 | 3 | 0 | 0 | 1241 |');
    expect(report).toContain('Stale wallet holds past the 10 min grace');
    expect(report).toContain('Past 20 attempts: 0.');
  });

  it('prints the worker fields the brief asks for', () => {
    for (const field of [
      'due',
      'oldestDueAt',
      'dropped',
      'lastError',
      'keepAliveAt',
    ])
      expect(report).toContain(`| ${field} |`);
    expect(report).toContain('| keepAliveAt | 2026-11-12T10:31:00.000Z |');
  });

  it('quotes every loose line verbatim', () => {
    expect(report).toContain(
      `2026-11-12T10:40:00.900Z  [timers] refusing to register order-post:${ORDER_E}: bad request`,
    );
    expect(report).toContain('[background-fix] reconciling roles (overdue)');
  });

  it('says what it cannot see', () => {
    expect(report).toContain('## What this report cannot see');
    expect(report).toContain('forgets the timer rather than re-arming it');
  });

  it('says so instead of guessing when a source is missing', () => {
    const blind = renderReport({
      db: null,
      dbSkipped: 'no connection',
      logs,
      health: { skipped: 'no HS' },
      now: NOW,
      options: { hours: 24, logs: 'x' },
    });
    expect(blind).toContain('| database | skipped: no connection |');
    expect(blind).toContain('Not read: no HS.');
    for (const kind of KINDS) expect(blind).toContain(`### ${kind}: FAIL`);
  });
});
