/* global fetch, AbortSignal, console */
/**
 * The shadow watch report for event-driven background work
 * (docs/product/background-work.md, deploy order step 7).
 *
 * Three independent sources, one Markdown report with a PASS or FAIL per switch kind:
 *   1. the database, strictly read only: switches, background_overdue(), cron runs and run-log
 *      writes per job, every order queued in the window with its Discord post, its expiry or
 *      accept time and its settlement state, the analytics outbox by state, stale wallet holds
 *      and settlements the claim path has given up on,
 *   2. a Vercel log export, for the shadow lines the handlers and hooks write, matched back to
 *      the orders so a fire time can be compared with the time the timer was registered for and
 *      a shadow decision with what the 10 s dispatcher actually did,
 *   3. GET /timers/health on the worker, for due, oldestDueAt, dropped, lastError and keepAliveAt.
 *
 * It only reads. The database part opens one connection, says `set transaction read only` before
 * any query and keeps a 10 s statement timeout, so the worst a mistake in here can do is time out.
 * It writes nothing, schedules nothing and flips no switch: flipping a kind stays an owner UPDATE
 * in the SQL editor, and this report's job is to say whether that UPDATE is safe yet.
 *
 * Run it (the owner, from their own machine):
 *   vercel logs <deployment> --json > /tmp/vercel.jsonl
 *   PW=<database password> HS=<BACKGROUND_HEALTH_SECRET> \
 *     node scripts/background-shadow-report.mjs --logs /tmp/vercel.jsonl \
 *       --db-host db.<project>.supabase.co --out /tmp/shadow-report.md
 *
 * Without PW the database part is skipped, without HS the worker part is skipped, and
 * `--db-json` / `--health-json` replay a captured answer instead of connecting, which is how the
 * unit tests and the sample report in the PR are produced.
 */
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------- the contract, mirrored

/*
 * These five values are the contract (src/contracts/background.ts). A script cannot import the
 * TypeScript module without a build step, so they are mirrored here and
 * tests/unit/background-shadow-report.test.ts fails if the mirror ever drifts.
 */
/** A public order posts to Discord exactly 100 s after it becomes publicly queued. */
export const ORDER_POST_DELAY_MS = 100_000;
/** An order expires at queued_at + 5 min. */
export const ORDER_EXPIRE_DELAY_MS = 5 * 60_000;
/** Presence is rechecked every 20 s while anyone is online. */
export const PRESENCE_CHECK_INTERVAL_MS = 20_000;
export const TIMER_KINDS = [
  'order-post',
  'order-expire',
  'settle-retry',
  'analytics-retry',
  'presence-check',
];
export const SWITCH_KINDS = ['orders', 'payments', 'analytics', 'roles'];
export const TIMER_KIND_SWITCH = {
  'order-post': 'orders',
  'order-expire': 'payments',
  'settle-retry': 'payments',
  'analytics-retry': 'analytics',
  'presence-check': 'roles',
};
/** The claim path stops at 20 attempts and so does the timer; those rows are a watch query. */
export const SETTLE_ATTEMPT_CAP = 20;

/**
 * How late a fire may be and still pass. A timer is due at an exact instant and the line we read
 * is written by the app after the worker's alarm, the fire request and the handler's own reads, so
 * this budget covers the whole hop rather than the alarm alone.
 */
export const FIRE_TOLERANCE_MS = 2_000;
/** The doc asks for 24 h of clean watching per kind before that kind is flipped. */
export const READY_EVIDENCE_MS = 24 * 60 * 60_000;
/** `/timers/health` is healthy at due 0 or 1 with the oldest due time inside a minute. */
export const DUE_ALERT_MS = 60_000;
/** The keep-alive read runs every 23 h; a day without one is worth seeing. */
export const KEEPALIVE_MAX_AGE_MS = 24 * 60 * 60_000;
/** The recommended flip order: lowest customer impact first, money and the Discord post last. */
export const FLIP_ORDER = ['analytics', 'roles', 'payments', 'orders'];

export const MARKERS = [
  'timer-shadow',
  'event-shadow',
  'background-fix',
  'background',
  'timers',
];

const WORKER_BASE = 'https://duoly-discord-gateway.duoly.workers.dev';

// ---------------------------------------------------------------- the read-only database part

/**
 * One statement per section, each printing `<name><tab><json>`, so a section that cannot run (a
 * table that does not exist yet, a grant that is missing) leaves its line out instead of killing
 * the run: ON_ERROR_ROLLBACK keeps the transaction alive over a failed statement and the error
 * text lands on stderr, where readDatabase picks it up.
 */
export function buildSql(hours) {
  if (!Number.isInteger(hours) || hours < 1 || hours > 168)
    throw new Error('--hours takes a whole number of hours, 1 to 168');
  const since = `now() - interval '${hours} hours'`;
  const section = (name, body) =>
    `select '@@${name}';\nselect '${name}' || E'\\t' || coalesce((${body})::text, 'null');`;
  return [
    '-- Generated by scripts/background-shadow-report.mjs. Read only, one connection.',
    '\\set ON_ERROR_STOP off',
    '\\set ON_ERROR_ROLLBACK on',
    '\\pset pager off',
    'begin;',
    'set transaction read only;',
    "set local statement_timeout = '10s';",
    "set local lock_timeout = '2s';",
    "set local idle_in_transaction_session_timeout = '60s';",
    section(
      'session',
      `select jsonb_build_object(
      'now', now(), 'now_ms', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
      'window_hours', ${hours}, 'database', current_database(), 'user', current_user,
      'read_only', current_setting('transaction_read_only'),
      'statement_timeout', current_setting('statement_timeout'),
      'server_version', current_setting('server_version'))`,
    ),
    section(
      'switches',
      `select jsonb_agg(jsonb_build_object('kind', s.kind, 'mode', s.mode, 'updated_at', s.updated_at)
         order by s.kind) from public.background_switches s`,
    ),
    section('overdue', 'select public.background_overdue()'),
    section(
      'cron_jobs',
      `select jsonb_agg(jsonb_build_object('jobname', j.jobname, 'schedule', j.schedule,
         'active', j.active) order by j.jobname) from cron.job j`,
    ),
    section(
      'cron_runs',
      `select jsonb_agg(q.x order by (q.x->>'runs')::bigint desc) from (
         select jsonb_build_object(
           'jobname', coalesce(j.jobname, 'jobid ' || d.jobid),
           'runs', count(*),
           'succeeded', count(*) filter (where d.status = 'succeeded'),
           'failed', count(*) filter (where d.status = 'failed'),
           'other', count(*) filter (where d.status not in ('succeeded', 'failed')),
           'run_log_writes_estimate', count(*) * 5,
           'first_start', min(d.start_time), 'last_start', max(d.start_time)) as x
         from cron.job_run_details d left join cron.job j on j.jobid = d.jobid
         where d.start_time > ${since}
         group by coalesce(j.jobname, 'jobid ' || d.jobid)) q`,
    ),
    section(
      'orders',
      `select jsonb_agg(q.x order by q.x->>'queued_at') from (
         select jsonb_build_object(
           'id', o.id, 'reference', o.public_reference, 'status', o.status, 'game', o.game,
           'queued_at', o.queued_at,
           'queued_at_ms', floor(extract(epoch from o.queued_at) * 1000)::bigint,
           'public_queued_at', public.order_public_queued_at(o)::text,
           'streaming', exists (select 1 from public.order_streamer_bookings b
             where b.order_id = o.id),
           'accepted_at', o.accepted_at, 'cancelled_at', o.cancelled_at,
           'cancel_reason', o.cancel_reason,
           'expired', o.status = 'cancelled' and o.cancel_reason = 'queue_expired',
           'posts', coalesce((select jsonb_agg(jsonb_build_object(
               'queue_key', p.queue_key, 'same_epoch', p.queue_key = o.queued_at,
               'state', p.state, 'outcome', p.outcome, 'created_at', p.created_at,
               'created_at_ms', floor(extract(epoch from p.created_at) * 1000)::bigint,
               'opened', p.message_id is not null, 'closed_at', p.closed_at) order by p.created_at)
             from public.discord_order_posts p where p.order_id = o.id), '[]'::jsonb),
           'payment', (select jsonb_build_object('state', m.state, 'settle', m.settle,
               'attempts', m.attempts, 'updated_at', m.updated_at,
               'last_error', left(coalesce(m.last_error, ''), 120))
             from public.order_payments m where m.order_id = o.id)) as x
         from public.orders o where o.queued_at > ${since}) q`,
    ),
    section(
      'outbox',
      `select jsonb_build_object(
         'pending', count(*) filter (where sent_at is null and failed_at is null),
         'eligible', count(*) filter (where sent_at is null and failed_at is null
           and (claimed_until is null or claimed_until <= now())),
         'leased', count(*) filter (where sent_at is null and failed_at is null
           and claimed_until > now()),
         'parked', count(*) filter (where failed_at is not null),
         'sent', count(*) filter (where sent_at is not null),
         'oldest_pending', min(occurred_at) filter (where sent_at is null and failed_at is null))
       from public.analytics_outbox`,
    ),
    section('wallet_holds', 'select public.checkout_stale_wallet_holds(20)'),
    section(
      'settlements',
      `select jsonb_build_object(
         'claimable', count(*) filter (where settle <> 'none' and attempts < ${SETTLE_ATTEMPT_CAP}),
         'exhausted', coalesce(jsonb_agg(jsonb_build_object('order_id', order_id,
             'settle', settle, 'attempts', attempts, 'state', state, 'updated_at', updated_at,
             'last_error', left(coalesce(last_error, ''), 120)) order by updated_at)
           filter (where settle <> 'none' and attempts >= ${SETTLE_ATTEMPT_CAP}), '[]'::jsonb))
       from public.order_payments`,
    ),
    'rollback;',
    '',
  ].join('\n');
}

/** `<name><tab><json>` lines back into one object, with the sections that failed named. */
export function parseSqlOutput(stdout, stderr = '') {
  const data = { errors: [] };
  let at = null;
  const seen = [];
  for (const line of stdout.split('\n')) {
    if (line.startsWith('@@')) {
      at = line.slice(2).trim();
      continue;
    }
    const tab = line.indexOf('\t');
    if (tab < 1) continue;
    const name = line.slice(0, tab);
    seen.push(name);
    try {
      data[name] = JSON.parse(line.slice(tab + 1));
    } catch {
      data.errors.push(`${name}: unreadable answer`);
    }
  }
  const expected = [
    'session',
    'switches',
    'overdue',
    'cron_jobs',
    'cron_runs',
    'orders',
    'outbox',
    'wallet_holds',
    'settlements',
  ];
  for (const name of expected)
    if (!seen.includes(name))
      data.errors.push(
        `${name}: no answer${at === name ? ' (the query failed)' : ''}`,
      );
  const complaints = stderr
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(ERROR|FATAL|WARNING|psql:)/.test(line));
  if (complaints.length) data.errors.push(...complaints);
  return data;
}

/** The libpq URL, password left out: it travels in PGPASSWORD so it never reaches a process list. */
export function connectionUrl(options) {
  if (options.dbUrl) {
    // A URL with the password in it would show up in `ps` for anyone on the machine. PW exists.
    if (/^[a-z+]+:\/\/[^/@]+:[^/@]*@/.test(options.dbUrl))
      throw new Error(
        '--db-url carries a password; take it out of the URL and pass it as PW instead',
      );
    return options.dbUrl;
  }
  if (!options.dbHost) return null;
  const user = encodeURIComponent(options.dbUser ?? 'postgres');
  const name = encodeURIComponent(options.dbName ?? 'postgres');
  return `postgresql://${user}@${options.dbHost}:${options.dbPort ?? 5432}/${name}`;
}

function readDatabase(options, run = spawnSync) {
  if (options.dbJson)
    return {
      source: `replayed from ${options.dbJson}`,
      data: JSON.parse(readFileSync(options.dbJson, 'utf8')),
    };
  const url = connectionUrl(options);
  if (!url || !options.password)
    return {
      source: null,
      skipped:
        'no connection: set PW and --db-host (or --db-url), or pass --db-json',
    };
  const sql = buildSql(options.hours);
  const result = run('psql', ['-X', '-q', '-At', url], {
    input: sql,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      PGPASSWORD: options.password,
      PGSSLMODE: process.env.PGSSLMODE ?? 'require',
      PGCONNECT_TIMEOUT: '15',
      // Belt as well as braces: the transaction says read only, and so does the session, which a
      // connection pooler in transaction mode may refuse. Set PGOPTIONS yourself to drop it.
      PGOPTIONS: process.env.PGOPTIONS ?? '-c default_transaction_read_only=on',
      PGAPPNAME: 'background-shadow-report',
    },
  });
  if (result.error || result.stdout === undefined)
    return {
      source: null,
      skipped: `psql did not run: ${result.error?.message ?? 'no output'}`,
    };
  return {
    source: `one read-only psql connection to ${options.dbHost ?? 'the given URL'}`,
    data: parseSqlOutput(result.stdout, result.stderr ?? ''),
  };
}

// ---------------------------------------------------------------- the log part (pure)

const MARKER = new RegExp(`\\[(${MARKERS.join('|')})\\]`);
const ISO =
  /(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)(Z|[+-]\d{2}(?::?\d{2})?)?/;

/** Epoch milliseconds out of whatever the export put in front of the message. */
export function readTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value))
    // Vercel writes milliseconds; a plain `date` export writes seconds.
    return value > 1e11 ? Math.trunc(value) : Math.trunc(value * 1000);
  if (typeof value !== 'string') return null;
  const digits = value.trim();
  if (/^\d{10}$/.test(digits)) return Number(digits) * 1000;
  if (/^\d{13}$/.test(digits)) return Number(digits);
  const match = ISO.exec(value);
  if (!match) return null;
  // No offset in the export means UTC: Vercel and `vercel logs` both print Z. Postgres prints
  // `+00` and `+0100`, neither of which Date.parse takes, so both are padded to `+01:00`.
  const zone = (match[3] ?? 'Z').replace(
    /^([+-])(\d{2}):?(\d{2})?$/,
    (_, sign, hours, minutes) => `${sign}${hours}:${minutes ?? '00'}`,
  );
  const parsed = Date.parse(`${match[1]}T${match[2]}${zone}`);
  return Number.isFinite(parsed) ? parsed : null;
}

const TIME_KEYS = [
  'timestampInMs',
  'timestampMs',
  'timestamp',
  'time',
  'date',
  'createdAt',
  'created',
  'ts',
];
const TEXT_KEYS = ['message', 'text', 'msg', 'line', 'log', 'body'];

/** The two shapes `vercel logs` writes: a JSON object per line, or a line of text. */
export function parseLogLine(line) {
  const text = line.trim();
  if (!text) return null;
  if (text.startsWith('{')) {
    try {
      return fromObject(JSON.parse(text));
    } catch {
      return { ts: null, message: text, malformed: 'unreadable JSON' };
    }
  }
  return { ts: readTimestamp(text), message: text };
}

function fromObject(object) {
  const nested =
    [object.payload, object.data, object.event].find(
      (value) => value && typeof value === 'object',
    ) ?? {};
  const pick = (keys, source) => {
    for (const key of keys)
      if (source[key] !== undefined && source[key] !== null) return source[key];
    return undefined;
  };
  const message = pick(TEXT_KEYS, object) ?? pick(TEXT_KEYS, nested) ?? '';
  const stamp = pick(TIME_KEYS, object) ?? pick(TIME_KEYS, nested);
  return {
    ts: readTimestamp(stamp ?? ''),
    message: typeof message === 'string' ? message : JSON.stringify(message),
    ...(object.requestId ? { requestId: object.requestId } : {}),
    ...(object.source ? { source: object.source } : {}),
  };
}

const SHADOW =
  /\[timer-shadow\] (\S+) (\S+) would=([^\s)(]+)(?: \((.*)\))?\s*$/;
const EVENT = /\[event-shadow\] (\S+) (\S+) would=([^\s)(]+)\s*$/;

/** `retry@1793005300000` into an action and the instant it names. */
const would = (value) => {
  const [action, at] = value.split('@');
  return {
    would: value,
    action,
    ...(at !== undefined && /^\d+$/.test(at) ? { at: Number(at) } : {}),
  };
};

/** `[timer-shadow] <kind> <ref> would=<would> (<note>)`, exactly as plan.ts writes it. */
export function parseShadowMessage(message) {
  const timer = SHADOW.exec(message);
  if (timer && TIMER_KINDS.includes(timer[1]))
    return {
      marker: 'timer-shadow',
      kind: timer[1],
      ref: timer[2],
      ...would(timer[3]),
      ...(timer[4] ? { note: timer[4] } : {}),
    };
  const event = EVENT.exec(message);
  if (event && SWITCH_KINDS.includes(event[1]))
    return {
      marker: 'event-shadow',
      kind: event[1],
      ref: event[2],
      ...would(event[3]),
    };
  return null;
}

/**
 * Which switch a loose `[timers]` or `[background]` line belongs to, if it names one. An empty
 * answer means the line names no kind ("could not reach the worker"), which touches all four.
 */
export function attributeLine(message) {
  const kinds = new Set();
  for (const kind of TIMER_KINDS)
    if (message.includes(kind)) kinds.add(TIMER_KIND_SWITCH[kind]);
  for (const kind of SWITCH_KINDS)
    if (new RegExp(`\\b${kind}\\b`).test(message)) kinds.add(kind);
  if (message.includes('order posts')) kinds.add('orders');
  if (message.includes('wallet hold')) kinds.add('payments');
  return [...kinds];
}

/**
 * A whole export into timestamped entries. Anything without one of the five markers is counted
 * and dropped: a Vercel export is mostly request lines, and this report is about the shadow ones.
 */
export function parseLogs(text) {
  const entries = [];
  const counts = Object.fromEntries(MARKERS.map((name) => [name, 0]));
  let lines = 0;
  let untimed = 0;
  let malformed = 0;
  let other = 0;
  const trimmed = text.trim();
  const raw = trimmed.startsWith('[')
    ? JSON.parse(trimmed).map((value) =>
        typeof value === 'string' ? value : JSON.stringify(value),
      )
    : text.split('\n');
  for (const line of raw) {
    if (!line.trim()) continue;
    lines += 1;
    const parsed = parseLogLine(line);
    if (!parsed) continue;
    if (parsed.malformed) malformed += 1;
    const marker = MARKER.exec(parsed.message);
    if (!marker) {
      other += 1;
      continue;
    }
    const message = parsed.message.slice(marker.index).trim();
    counts[marker[1]] += 1;
    if (parsed.ts === null) untimed += 1;
    entries.push({
      ts: parsed.ts,
      marker: marker[1],
      message,
      ...(parsed.requestId ? { requestId: parsed.requestId } : {}),
      ...(parseShadowMessage(message) ?? {}),
    });
  }
  entries.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  const stamps = entries.map((e) => e.ts).filter((ts) => ts !== null);
  return {
    entries,
    counts,
    lines,
    untimed,
    malformed,
    other,
    window: stamps.length
      ? { from: Math.min(...stamps), to: Math.max(...stamps) }
      : null,
  };
}

// ---------------------------------------------------------------- matching (pure)

const first = (list) => list.find((entry) => entry.ts !== null) ?? null;

/**
 * Every wake-up a handler asked for against the line that answered it. A `retry` or `pending`
 * names the instant it wants, so the next line for the same kind and ref is the fire that instant
 * was for: that is the fire delay for the singleton kinds, where there is no queued order to
 * measure against.
 */
export function rearmChecks(entries) {
  const shadow = entries.filter(
    (entry) => entry.marker === 'timer-shadow' && entry.ts !== null,
  );
  const checks = [];
  for (const [index, entry] of shadow.entries()) {
    if (entry.at === undefined) continue;
    const next = shadow
      .slice(index + 1)
      .find((other) => other.kind === entry.kind && other.ref === entry.ref);
    if (!next) {
      checks.push({
        kind: entry.kind,
        ref: entry.ref,
        expectedAt: entry.at,
        firedAt: null,
        status: 'open',
      });
      continue;
    }
    const delay = next.ts - entry.at;
    checks.push({
      kind: entry.kind,
      ref: entry.ref,
      expectedAt: entry.at,
      firedAt: next.ts,
      delay,
      status: Math.abs(delay) <= FIRE_TOLERANCE_MS ? 'ok' : 'late',
    });
  }
  return checks;
}

/** What the dispatcher actually did with an order's public post, from the post rows. */
export function realPost(order) {
  const post = (order.posts ?? []).find((row) => row.same_epoch);
  return {
    posted: Boolean(post && (post.opened || post.state !== 'posting')),
    claimed: Boolean(post),
    at: post?.created_at_ms ?? null,
    state: post?.state ?? null,
    outcome: post?.outcome ?? null,
  };
}

/**
 * One order's two timers: the lines that fired for them, how late the first fire was, and whether
 * the shadow decision says what the dispatcher then did.
 *
 * `post` and `expire` are the only two acts a line can claim here, so the comparison is a boolean
 * either way: shadow said it would post and a post row for this queue epoch exists, or shadow said
 * stale and no post row does.
 *
 * A `pending` or `retry` line decides nothing, and in `shadow` it never gets a second chance: the
 * handler answers `disabled`, which tells the worker to forget the timer rather than re-arm it. So
 * an order the due predicate was still holding (a priority pick, an earlier team seat) ends with
 * one `pending` line and no decision at all. That is the mode working as designed, not a
 * disagreement, so it is reported as `deferred` and graded as neither.
 */
export function matchOrder(order, entries, bounds) {
  const lines = (kind) =>
    entries.filter(
      (entry) =>
        entry.marker === 'timer-shadow' &&
        entry.kind === kind &&
        entry.ref === order.id,
    );
  const real = realPost(order);
  // order_public_queued_at returns infinity for a streaming booking and `greatest(queued_at, ...)`
  // for an order a priority pick still holds, which is why its post can legitimately be pending.
  const publicAt = readTimestamp(order.public_queued_at ?? '');
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    queuedAtMs: order.queued_at_ms,
    queuedAt: order.queued_at,
    streaming: order.streaming,
    picked: publicAt !== null && publicAt - order.queued_at_ms > 1_000,
    post: leg({
      kind: 'order-post',
      reference: order.reference,
      intendedAt: order.queued_at_ms + ORDER_POST_DELAY_MS,
      lines: lines('order-post'),
      act: 'post',
      real: real.posted,
      realAt: real.at,
      realWhy: real.posted
        ? `the dispatcher posted (${real.state})`
        : real.claimed
          ? 'a claim exists but no message'
          : 'no post for this queue epoch',
      bounds: bounds['orders'],
    }),
    expire: leg({
      kind: 'order-expire',
      reference: order.reference,
      intendedAt: order.queued_at_ms + ORDER_EXPIRE_DELAY_MS,
      lines: lines('order-expire'),
      act: 'expire',
      real: Boolean(order.expired),
      realAt: order.cancelled_at ?? null,
      realWhy: order.expired
        ? 'the dispatcher expired it'
        : order.accepted_at
          ? 'a teammate accepted it'
          : order.cancelled_at
            ? `cancelled (${order.cancel_reason})`
            : `still ${order.status}`,
      bounds: bounds['payments'],
    }),
  };
}

function leg(input) {
  const bounds = input.bounds ?? null;
  const judged =
    bounds !== null &&
    input.intendedAt >= bounds.from &&
    input.intendedAt <= bounds.to;
  const fired = first(input.lines);
  const acted = input.lines.some((entry) => entry.action === input.act);
  const stale = input.lines.some((entry) => entry.action === 'stale');
  const decided = acted || stale;
  const result = {
    kind: input.kind,
    reference: input.reference,
    intendedAt: input.intendedAt,
    judged,
    lines: input.lines.length,
    firedAt: fired?.ts ?? null,
    delay: fired === null ? null : fired.ts - input.intendedAt,
    would: input.lines.map((entry) => entry.would),
    note: fired?.note ?? null,
    shadowActs: acted,
    real: input.real,
    realAt: input.realAt,
    realWhy: input.realWhy,
  };
  if (!input.lines.length)
    return { ...result, decision: judged ? 'missing' : 'not judged' };
  if (!decided)
    return {
      ...result,
      decision: 'deferred',
      why: `${result.would.join(', ')}, which shadow does not re-arm, and ${input.realWhy}`,
    };
  if (acted === input.real) return { ...result, decision: 'agrees' };
  return {
    ...result,
    decision: 'differs',
    why: acted
      ? `shadow would ${input.act}, but ${input.realWhy}`
      : `shadow would not ${input.act}, but ${input.realWhy}`,
  };
}

// ---------------------------------------------------------------- grading (pure)

const plural = (count, word) => (count === 1 ? word : `${word}s`);
const pass = (name, detail) => ({ name, status: 'pass', detail });
const fail = (name, detail) => ({ name, status: 'fail', detail });
const warn = (name, detail) => ({ name, status: 'warn', detail });
const note = (name, detail) => ({ name, status: 'note', detail });

const percentile = (values, fraction) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(fraction * (sorted.length - 1)))
  ];
};

/**
 * The judged window per kind: the part of the log export in which that kind's timers were really
 * being registered. A switch that changed inside the export means the orders before the change
 * were a different régime, so they are reported and not graded.
 */
export function judgedBounds(logs, switches) {
  const bounds = {};
  const from = logs?.window?.from ?? null;
  const to = logs?.window?.to ?? null;
  for (const kind of SWITCH_KINDS) {
    const row = (switches ?? []).find((s) => s.kind === kind);
    const changed = row ? readTimestamp(row.updated_at) : null;
    if (!row || row.mode === 'legacy' || from === null) {
      bounds[kind] = null;
      continue;
    }
    bounds[kind] = { from: Math.max(from, changed ?? from), to };
  }
  return bounds;
}

/** Every check for one kind, in the order a reader wants them. */
function kindChecks(kind, state) {
  const { db, logs, health, orders, rearm, now } = state;
  const row = (db?.switches ?? []).find((s) => s.kind === kind) ?? null;
  const checks = [];
  if (!db)
    checks.push(fail('switch', 'no database read, so nothing is judged'));
  else if (!row)
    checks.push(
      fail(
        'switch',
        'no row: the migration is not applied, so this kind reads as legacy',
      ),
    );
  else
    checks.push(
      row.mode === 'legacy'
        ? fail(
            'switch',
            'legacy: no timers are registered, so there is nothing to compare',
          )
        : note('switch', `${row.mode} since ${row.updated_at}`),
    );
  if (db?.overdue)
    checks.push(
      db.overdue[kind] === false
        ? pass('overdue', 'false')
        : fail('overdue', `${db.overdue[kind]}: the fixer would find work`),
    );
  else if (db)
    checks.push(fail('overdue', 'background_overdue() did not answer'));

  const kindTimers = TIMER_KINDS.filter((t) => TIMER_KIND_SWITCH[t] === kind);
  for (const timer of kindTimers) {
    const legName = timer === 'order-post' ? 'post' : 'expire';
    if (timer === 'order-post' || timer === 'order-expire') {
      const legs = orders
        .map((order) => order[legName])
        .filter((item) => item.judged);
      const missing = legs.filter((item) => item.decision === 'missing');
      const delays = legs
        .map((item) => item.delay)
        .filter((value) => value !== null);
      const late = delays.filter(
        (value) => value < -FIRE_TOLERANCE_MS || value > FIRE_TOLERANCE_MS,
      );
      const differs = legs.filter((item) => item.decision === 'differs');
      if (!legs.length)
        checks.push(
          fail(
            `${timer} coverage`,
            'no order in the judged window: there is no evidence for this kind yet',
          ),
        );
      else
        checks.push(
          missing.length === 0
            ? pass(
                `${timer} coverage`,
                `all ${legs.length} ${plural(legs.length, 'order')} in the judged window got the timer`,
              )
            : fail(
                `${timer} coverage`,
                `${missing.length} of ${legs.length} orders have no ${timer} line: ${missing
                  .map((item) => item.reference ?? item.kind)
                  .slice(0, 8)
                  .join(', ')}`,
              ),
        );
      if (delays.length)
        checks.push(
          late.length === 0
            ? pass(
                `${timer} fire time`,
                `median ${percentile(delays, 0.5)} ms, p95 ${percentile(delays, 0.95)} ms, worst ${Math.max(...delays)} ms, all inside ${FIRE_TOLERANCE_MS} ms`,
              )
            : fail(
                `${timer} fire time`,
                `${late.length} of ${delays.length} outside ${FIRE_TOLERANCE_MS} ms (worst ${Math.max(...delays.map(Math.abs))} ms)`,
              ),
        );
      if (legs.length)
        checks.push(
          differs.length === 0
            ? pass(
                `${timer} decisions`,
                `${legs.filter((item) => item.decision === 'agrees').length} agree with the dispatcher, ${legs.filter((item) => item.decision === 'deferred').length} deferred`,
              )
            : fail(
                `${timer} decisions`,
                differs
                  .map((item) => `${item.reference}: ${item.why}`)
                  .slice(0, 5)
                  .join('; '),
              ),
        );
    }
    const mine = rearm.filter((check) => check.kind === timer);
    const answered = mine.filter((check) => check.status !== 'open');
    const lateRearm = mine.filter((check) => check.status === 'late');
    if (answered.length)
      checks.push(
        lateRearm.length === 0
          ? pass(
              `${timer} re-arms`,
              `${answered.length} fired within ${FIRE_TOLERANCE_MS} ms of the instant they asked for`,
            )
          : fail(
              `${timer} re-arms`,
              `${lateRearm.length} of ${answered.length} missed their instant (worst ${Math.max(...lateRearm.map((c) => Math.abs(c.delay)))} ms)`,
            ),
      );
    else if (mine.length)
      checks.push(
        note(
          `${timer} re-arms`,
          `${mine.length} ${plural(mine.length, 'line')} asked for a later recheck; a shadow fire answers disabled, so the worker forgets the timer instead of re-arming it`,
        ),
      );
    if (timer !== 'order-post' && timer !== 'order-expire') {
      // These three have no row anywhere that says what the dispatcher did with them, so the
      // lines themselves are the evidence. None at all is judged once per kind, below.
      const lines = logs.entries.filter(
        (entry) => entry.marker === 'timer-shadow' && entry.kind === timer,
      );
      if (lines.length)
        checks.push(
          note(
            `${timer} lines`,
            `${lines.length} in the export (${[...new Set(lines.map((entry) => entry.action))].join(', ')})`,
          ),
        );
    }
    if (timer === 'settle-retry') {
      const exhausted = new Set(
        (db?.settlements?.exhausted ?? []).map((row2) => row2.order_id),
      );
      const bad = logs.entries.filter(
        (entry) =>
          entry.kind === 'settle-retry' &&
          entry.action === 'settle' &&
          exhausted.has(entry.ref),
      );
      if (bad.length)
        checks.push(
          fail(
            'settle-retry cap',
            `${bad.length} lines would settle an order past ${SETTLE_ATTEMPT_CAP} attempts`,
          ),
        );
    }
  }

  const events = logs.entries.filter(
    (entry) => entry.marker === 'event-shadow' && entry.kind === kind,
  );
  if (kind === 'analytics' || kind === 'roles') {
    // Neither kind is tied to an order, so "it fires at all" is the question, and either a timer
    // line or an event hook line answers it. A clean week can legitimately have no retry timer.
    const fires = logs.entries.filter(
      (entry) =>
        entry.marker === 'timer-shadow' &&
        TIMER_KIND_SWITCH[entry.kind] === kind,
    ).length;
    checks.push(
      fires + events.length > 0
        ? pass(
            'evidence',
            `${fires} timer ${plural(fires, 'line')} and ${events.length} event ${plural(events.length, 'line')} in the export`,
          )
        : fail(
            'evidence',
            'no timer line and no [event-shadow] line: nothing in the export shows this kind firing',
          ),
    );
  }
  if (kind === 'analytics' && db?.outbox) {
    const { parked, pending, eligible, oldest_pending: oldest } = db.outbox;
    checks.push(
      parked === 0
        ? pass(
            'analytics outbox',
            `${pending} pending, ${eligible} eligible, 0 parked`,
          )
        : fail(
            'analytics outbox',
            `${parked} parked facts: an alert threshold in the doc`,
          ),
    );
    const age = oldest ? now - Date.parse(oldest) : 0;
    if (age > 10 * 60_000)
      checks.push(
        warn(
          'analytics backlog',
          `the oldest pending fact is ${Math.round(age / 60_000)} min old`,
        ),
      );
  }
  if (kind === 'payments' && db) {
    const holds = db.wallet_holds ?? [];
    checks.push(
      holds.length === 0
        ? pass('stale wallet holds', 'none')
        : warn(
            'stale wallet holds',
            `${holds.length} past the 10 min grace: the fixer's job, and a latency change the owner accepted`,
          ),
    );
    const exhausted = db.settlements?.exhausted ?? [];
    if (exhausted.length)
      checks.push(
        warn(
          'exhausted settlements',
          `${exhausted.length} with attempts >= ${SETTLE_ATTEMPT_CAP} (outside the overdue predicate on purpose)`,
        ),
      );
  }

  if (events.length)
    checks.push(
      note(
        'event hooks',
        `${events.length} [event-shadow] lines (${[...new Set(events.map((entry) => entry.would))].join(', ')})`,
      ),
    );
  const registration = logs.entries.filter(
    (entry) =>
      entry.marker === 'timers' &&
      (attributeLine(entry.message).includes(kind) ||
        !attributeLine(entry.message).length),
  );
  if (registration.length)
    checks.push(
      fail(
        'registrations',
        `${registration.length} [timers] ${plural(registration.length, 'line')}: a registration did not reach the worker`,
      ),
    );
  const hooks = logs.entries.filter(
    (entry) =>
      entry.marker === 'background' &&
      (attributeLine(entry.message).includes(kind) ||
        !attributeLine(entry.message).length),
  );
  const fixes = logs.entries.filter(
    (entry) =>
      entry.marker === 'background-fix' &&
      entry.message.includes('reconciling') &&
      attributeLine(entry.message).includes(kind),
  );
  if (fixes.length)
    checks.push(
      // The doc's threshold is the fixer finding work twice in a row, because finding work means
      // a timer was missed. One line is worth reading; two are worth acting on.
      fixes.length > 1
        ? warn(
            'the fixer',
            `found ${kind} work ${fixes.length} times, the last at ${stamp(fixes.at(-1).ts)}`,
          )
        : note(
            'the fixer',
            `found ${kind} work once, at ${stamp(fixes[0].ts)}`,
          ),
    );
  if (hooks.length)
    checks.push(
      warn(
        'hooks',
        `${hooks.length} [background] ${plural(hooks.length, 'line')}: a hook acted and failed`,
      ),
    );
  if (health?.data)
    checks.push(
      health.data.dropped === 0
        ? pass('worker drops', '0')
        : fail('worker drops', `${health.data.dropped} timers dropped`),
    );
  else
    checks.push(
      fail('worker drops', 'no /timers/health answer, so drops are unknown'),
    );
  return {
    row,
    checks,
    mode: db ? (row ? row.mode : 'legacy (no row)') : 'not read',
  };
}

/** PASS or FAIL per kind, plus the one line that says whether the owner may flip it. */
export function grade(state) {
  const kinds = {};
  for (const kind of SWITCH_KINDS) {
    const { row, checks, mode } = kindChecks(kind, state);
    const failed = checks.filter((check) => check.status === 'fail');
    const warned = checks.filter((check) => check.status === 'warn');
    const verdict = failed.length ? 'FAIL' : 'PASS';
    const covered = state.logs.window
      ? state.logs.window.to - state.logs.window.from
      : 0;
    const hours = Math.round(covered / 36_000) / 100;
    let ready;
    if (row?.mode === 'live')
      ready = `already live; keep watching (${verdict})`;
    else if (verdict === 'FAIL')
      ready = `no: ${failed.map((check) => check.name).join(', ')}`;
    else if (covered < READY_EVIDENCE_MS)
      ready = `not yet: ${hours} h of logs, the doc asks for 24 h per kind (2 to 3 days before the first flip)`;
    else if (warned.length)
      ready = `yes, after reading the warnings: ${warned.map((check) => check.name).join(', ')}`;
    else ready = 'yes';
    kinds[kind] = {
      mode,
      verdict,
      checks,
      ready,
      flip:
        verdict === 'PASS' && row?.mode === 'shadow'
          ? `update public.background_switches set mode = 'live', updated_at = now() where kind = '${kind}';`
          : null,
    };
  }
  return kinds;
}

// ---------------------------------------------------------------- the worker part

async function readHealth(options, request = fetch) {
  if (options.healthJson)
    return {
      source: `replayed from ${options.healthJson}`,
      data: JSON.parse(readFileSync(options.healthJson, 'utf8')),
    };
  if (!options.healthSecret)
    return { skipped: 'no HS: set it to the worker BACKGROUND_HEALTH_SECRET' };
  const url = `${options.worker.replace(/\/+$/, '')}/timers/health`;
  try {
    const response = await request(url, {
      headers: { authorization: `Bearer ${options.healthSecret}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      return { skipped: `${url} answered ${response.status}`, source: url };
    return { source: url, data: await response.json() };
  } catch (error) {
    return {
      source: url,
      skipped: `could not reach the worker: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

/** The worker's own acceptance: nothing due for long, nothing dropped, a fresh keep-alive. */
export function healthChecks(health, now) {
  if (!health?.data) return [];
  const data = health.data;
  const checks = [
    data.dropped === 0
      ? pass('dropped', '0')
      : fail('dropped', `${data.dropped}`),
    data.lastError
      ? warn('lastError', `${data.lastError} (at ${stamp(data.lastErrorAt)})`)
      : pass('lastError', 'null'),
  ];
  const due = data.oldestDueAt === null ? 0 : now - data.oldestDueAt;
  checks.push(
    data.due <= 1 && due <= DUE_ALERT_MS
      ? pass(
          'due',
          `${data.due} due, oldest ${data.oldestDueAt === null ? 'none' : `${due} ms ago`}`,
        )
      : fail(
          'due',
          `${data.due} due, the oldest for ${due} ms (the doc alerts past ${DUE_ALERT_MS} ms)`,
        ),
  );
  const age = data.keepAliveAt === null ? null : now - data.keepAliveAt;
  checks.push(
    age !== null && age <= KEEPALIVE_MAX_AGE_MS
      ? pass(
          'keepAliveAt',
          `${stamp(data.keepAliveAt)} (${Math.round(age / 3_600_000)} h ago)`,
        )
      : warn(
          'keepAliveAt',
          age === null
            ? 'never: the Supabase keep-alive read has not run'
            : `${stamp(data.keepAliveAt)}, older than 24 h`,
        ),
  );
  return checks;
}

// ---------------------------------------------------------------- the report (pure)

const stamp = (ms) =>
  ms === null || ms === undefined || !Number.isFinite(ms)
    ? 'none'
    : new Date(ms).toISOString();
const signed = (ms) =>
  ms === null || ms === undefined ? '-' : `${ms > 0 ? '+' : ''}${ms} ms`;
const ICON = { pass: 'PASS', fail: 'FAIL', warn: 'WARN', note: 'note' };
const table = (head, rows) =>
  [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');

/** The whole report. Pure: everything it needs is already read. */
export function renderReport(input) {
  const { db, logs, health, now, options } = input;
  const bounds = judgedBounds(logs, db?.switches);
  const orders = (db?.orders ?? []).map((order) =>
    matchOrder(order, logs.entries, bounds),
  );
  const rearm = rearmChecks(logs.entries);
  const kinds = grade({ db, logs, health, orders, rearm, bounds, now });
  const out = [];
  const say = (...lines) => out.push(...lines, '');

  say(
    '# Background shadow report',
    '',
    `As of ${stamp(now)}, window ${options.hours} h, by \`scripts/background-shadow-report.mjs\`.`,
    'Read only: nothing here writes, schedules or flips anything.',
    '',
    table(
      ['Source', 'What'],
      [
        [
          'database',
          db
            ? `${input.dbSource} (${db.errors.length ? `${db.errors.length} complaint${db.errors.length === 1 ? '' : 's'}, see the end` : 'all sections answered'}${db.session ? `, transaction_read_only=${db.session.read_only}, statement_timeout=${db.session.statement_timeout}` : ''})`
            : `skipped: ${input.dbSkipped}`,
        ],
        [
          'logs',
          `${options.logs} (${logs.lines} lines, ${logs.entries.length} background lines${logs.window ? `, ${stamp(logs.window.from)} to ${stamp(logs.window.to)}` : ', no timestamps found'})`,
        ],
        [
          'worker',
          health?.data
            ? `${health.source}`
            : `skipped: ${health?.skipped ?? 'not asked'}`,
        ],
      ],
    ),
  );

  say(
    '## Verdict per kind',
    '',
    table(
      ['Kind', 'Mode', 'Verdict', 'Ready to flip'],
      FLIP_ORDER.map((kind) => [
        kind,
        kinds[kind].mode,
        `**${kinds[kind].verdict}**`,
        kinds[kind].ready,
      ]),
    ),
    '',
    "The flip order is the doc's: analytics, roles, payments, orders, one a day with 24 h of watching each.",
  );

  for (const kind of FLIP_ORDER) {
    const result = kinds[kind];
    say(
      `### ${kind}: ${result.verdict}`,
      '',
      ...result.checks.map(
        (check) => `- ${ICON[check.status]} ${check.name}: ${check.detail}`,
      ),
      `- ready to flip: ${result.ready}`,
      ...(result.flip && result.ready === 'yes'
        ? ['', '```sql', result.flip, '```']
        : []),
    );
  }

  say(
    '## Worker health',
    '',
    health?.data
      ? [
          table(
            ['Field', 'Value'],
            [
              ['due', String(health.data.due)],
              ['oldestDueAt', stamp(health.data.oldestDueAt)],
              ['dropped', String(health.data.dropped)],
              ['lastError', health.data.lastError ?? 'null'],
              ['keepAliveAt', stamp(health.data.keepAliveAt)],
              ['pending', String(health.data.pending)],
              [
                'byKind',
                Object.entries(health.data.byKind ?? {})
                  .map(([kind, count]) => `${kind} ${count}`)
                  .join(', ') || 'none',
              ],
              ['lastFireAt', stamp(health.data.lastFireAt)],
            ],
          ),
          '',
          ...healthChecks(health, now).map(
            (check) => `- ${ICON[check.status]} ${check.name}: ${check.detail}`,
          ),
        ].join('\n')
      : `Not read: ${health?.skipped ?? 'not asked'}. Drops and backlog are therefore unknown, which is why every kind above fails its worker check.`,
  );

  if (db) {
    say(
      '## Switches',
      '',
      db.switches
        ? table(
            ['Kind', 'Mode', 'Changed'],
            db.switches.map((row) => [row.kind, row.mode, row.updated_at]),
          )
        : 'No `public.background_switches` rows: every kind reads as `legacy` and the migration is not applied.',
    );
    say(
      '## Overdue right now',
      '',
      db.overdue
        ? table(
            ['Kind', 'Overdue'],
            SWITCH_KINDS.map((kind) => [kind, String(db.overdue[kind])]),
          )
        : '`public.background_overdue()` did not answer.',
      '',
      'All false is the healthy answer. A predicate that errors reads as overdue on purpose.',
    );
    say(
      `## Cron runs and run-log writes, last ${options.hours} h`,
      '',
      db.cron_runs?.length
        ? table(
            [
              'Job',
              'Runs',
              'Succeeded',
              'Failed',
              'Other',
              'Run-log writes (est.)',
              'Last start',
            ],
            db.cron_runs.map((row) => [
              row.jobname,
              String(row.runs),
              String(row.succeeded),
              String(row.failed),
              String(row.other),
              String(row.run_log_writes_estimate),
              row.last_start ?? '-',
            ]),
          )
        : 'No rows in `cron.job_run_details` for the window.',
      '',
      'Run-log writes are the nominal figure from the doc (one insert plus about four updates per run), not a measurement: Postgres does not count updates per row.',
      ...(db.cron_jobs
        ? [
            '',
            table(
              ['Job', 'Schedule', 'Active'],
              db.cron_jobs.map((row) => [
                row.jobname,
                row.schedule,
                String(row.active),
              ]),
            ),
          ]
        : []),
    );

    say(
      `## Orders queued in the last ${options.hours} h (${orders.length})`,
      '',
      orders.length
        ? table(
            [
              'Order',
              'Queued',
              'order-post fire',
              'would',
              'Dispatcher',
              'order-expire fire',
              'would',
              'Dispatcher',
            ],
            orders.map((order) => [
              `${order.reference}${order.streaming ? ' (streaming)' : ''}${order.picked ? ' (picked)' : ''}`,
              order.queuedAt,
              legCell(order.post),
              readable(order.post.would.join(', ')) || '-',
              order.post.realWhy,
              legCell(order.expire),
              readable(order.expire.would.join(', ')) || '-',
              order.expire.realWhy,
            ]),
          )
        : 'No order entered the queue in the window, so the order kinds have no evidence.',
      '',
      "\"fire\" is the log line's time minus the instant the timer was registered for (`queued_at` plus 100 s, and plus 5 min). It covers the worker's alarm, the signed fire request and the handler's own reads, so it is the end to end delay rather than the alarm's.",
    );

    say(
      '## Analytics outbox',
      '',
      db.outbox
        ? table(
            [
              'Pending',
              'Eligible now',
              'Leased',
              'Parked',
              'Sent',
              'Oldest pending',
            ],
            [
              [
                String(db.outbox.pending),
                String(db.outbox.eligible),
                String(db.outbox.leased),
                String(db.outbox.parked),
                String(db.outbox.sent),
                db.outbox.oldest_pending ?? 'none',
              ],
            ],
          )
        : 'The outbox did not answer.',
    );
    say(
      '## Stale wallet holds and exhausted settlements',
      '',
      `Stale wallet holds past the 10 min grace (\`checkout_stale_wallet_holds(20)\`): ${(db.wallet_holds ?? []).length}.`,
      ...((db.wallet_holds ?? []).length
        ? [
            '',
            table(
              ['Intent', 'Status', 'Stripe session'],
              db.wallet_holds.map((row) => [
                row.id,
                row.status,
                row.stripe_session_id ?? 'none',
              ]),
            ),
          ]
        : []),
      '',
      `Settlements the claim path can still take: ${db.settlements?.claimable ?? '?'}. Past ${SETTLE_ATTEMPT_CAP} attempts: ${(db.settlements?.exhausted ?? []).length}.`,
      ...((db.settlements?.exhausted ?? []).length
        ? [
            '',
            table(
              ['Order', 'Settle', 'Attempts', 'State', 'Last error'],
              db.settlements.exhausted.map((row) => [
                row.order_id,
                row.settle,
                String(row.attempts),
                row.state,
                row.last_error || '-',
              ]),
            ),
          ]
        : []),
    );
    if (db.errors.length)
      say(
        '## Database sections that did not answer, and what psql said',
        '',
        ...db.errors.map((error) => `- ${error}`),
      );
  }

  const loose = logs.entries.filter((entry) =>
    ['timers', 'background', 'background-fix'].includes(entry.marker),
  );
  say(
    '## Log lines',
    '',
    table(
      ['Marker', 'Lines'],
      MARKERS.map((marker) => [`[${marker}]`, String(logs.counts[marker])]),
    ),
    '',
    `${logs.other} lines carried none of the five markers, ${logs.untimed} background lines had no timestamp and ${logs.malformed} could not be read.`,
    ...(loose.length
      ? [
          '',
          'Every `[timers]`, `[background]` and `[background-fix]` line in the export, verbatim:',
          '',
          '```',
          ...loose
            .slice(0, 50)
            .map((entry) => `${stamp(entry.ts)}  ${entry.message}`),
          ...(loose.length > 50 ? [`... ${loose.length - 50} more`] : []),
          '```',
        ]
      : []),
  );

  say(
    '## What this report cannot see',
    '',
    '- Shadow against reality is machine-checked for `order-post` and `order-expire` only, because those two have a row in the database that says what the dispatcher did. `settle-retry`, `analytics-retry` and `presence-check` are judged on their own punctuality, the outbox and hold counts, and `background_overdue()`.',
    '- A shadow fire answers `disabled`, so the worker forgets the timer rather than re-arming it. An order the due predicate was still holding therefore ends with one `pending` line and no decision, which this report calls `deferred` and does not grade either way.',
    '- A Vercel export only covers what it covers. Orders whose timer was due outside the export window, or before a switch last changed, are listed and not graded.',
    "- Run-log writes per job are the doc's nominal figure, not a measurement.",
    '- The post time is `discord_order_posts.created_at`, which is the claim the dispatcher wrote right before it posted, so it is the posting instant to within one request.',
    '- Cloudflare duration and row budgets are a dashboard read the doc asks for separately.',
  );

  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

const legCell = (item) =>
  item.decision === 'not judged'
    ? 'not judged'
    : item.decision === 'missing'
      ? '**missing**'
      : `${signed(item.delay)}${item.decision === 'differs' ? ' **differs**' : ''}${item.lines > 1 ? ` (${item.lines} lines)` : ''}`;

/** `pending@1794479560205` is what the log says; a reader wants the instant it names. */
const readable = (value) =>
  value.replace(/@(\d{13})\b/g, (_, digits) => `@${stamp(Number(digits))}`);

// ---------------------------------------------------------------- the command

export function parseArgs(argv) {
  const options = {
    hours: 24,
    worker: process.env.WORKER_URL || WORKER_BASE,
    logs: null,
    out: null,
    dbUrl: process.env.DB_URL || null,
    dbHost: process.env.DB_HOST || null,
    dbUser: process.env.DB_USER || 'postgres',
    dbName: process.env.DB_NAME || 'postgres',
    dbPort: Number(process.env.DB_PORT || 5432),
    dbJson: null,
    healthJson: null,
    password: process.env.PW || null,
    healthSecret: process.env.HS || null,
    now: null,
    sqlOnly: false,
  };
  const flags = {
    '--logs': 'logs',
    '--out': 'out',
    '--hours': 'hours',
    '--worker': 'worker',
    '--db-url': 'dbUrl',
    '--db-host': 'dbHost',
    '--db-user': 'dbUser',
    '--db-name': 'dbName',
    '--db-port': 'dbPort',
    '--db-json': 'dbJson',
    '--health-json': 'healthJson',
    '--now': 'now',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--print-sql') {
      options.sqlOnly = true;
      continue;
    }
    const key = flags[flag];
    if (!key) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    options[key] = key === 'hours' || key === 'dbPort' ? Number(value) : value;
    index += 1;
  }
  if (!options.sqlOnly && !options.logs)
    throw new Error(
      'Usage: PW=... HS=... node scripts/background-shadow-report.mjs --logs <vercel log export> [--db-host <host> | --db-url <url> | --db-json <file>] [--health-json <file>] [--hours 24] [--now <iso>] [--out report.md] [--print-sql]',
    );
  return options;
}

/** `--now`, else the instant a replayed database answer was captured, else the clock. */
export function reportedNow(options, data, deps = {}) {
  if (options.now) {
    const parsed = Date.parse(options.now);
    if (!Number.isFinite(parsed)) throw new Error(`--now: ${options.now}?`);
    return parsed;
  }
  if (options.dbJson && Number.isFinite(data?.session?.now_ms))
    return data.session.now_ms;
  return deps.now ? deps.now() : Date.now();
}

/** Read the three sources and render. Returns the options too, so main knows where to write. */
export async function run(argv, deps = {}) {
  const options = parseArgs(argv);
  if (options.sqlOnly) return { options, report: buildSql(options.hours) };
  const logs = parseLogs((deps.readFile ?? readFileSync)(options.logs, 'utf8'));
  const database = readDatabase(options, deps.spawn);
  const health = await readHealth(options, deps.request);
  return {
    options,
    report: renderReport({
      db: database.data ?? null,
      dbSource: database.source,
      dbSkipped: database.skipped,
      logs,
      health,
      // A replayed answer is judged as of the moment it was captured, not as of today, so a
      // report rendered twice from the same files reads the same both times.
      now: reportedNow(options, database.data, deps),
      options,
    }),
  };
}

async function main() {
  const { options, report } = await run(process.argv.slice(2));
  if (options.out) writeFileSync(options.out, report);
  console.log(report);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
