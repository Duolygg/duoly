// Cloudflare Worker that keeps the Duoly Discord bot online (ledger #27 and #38) and runs the
// background timers (docs/product/background-work.md).
// Two Durable Object classes, each with its own alarm, so neither can stall the other:
//   DiscordGateway ("bot") holds the gateway connection. An alarm every 30 seconds and a cron trigger
//   every minute both wake it and reconnect if needed, so it comes back after any restart.
//   Timers ("timers") stores one row per deadline in SQLite and fires a signed POST at the app.
// GET /status shows the connection state (no secrets). POST /timers registers a timer (HMAC signed),
// GET /timers/health reports the queue (bearer). Everything else answers 404.
import { Gateway, type Socket } from './gateway';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  bearerAuthorized,
  verifyBackgroundBody,
} from '../../../src/contracts/background';
import {
  cronTick,
  emptyByKind,
  registerTimer,
  runAlarm,
  timersHealth,
  type TimerDeps,
  type TimerRow,
  type TimerStats,
  type TimerStore,
} from './timers';

type Stub = { fetch(input: Request | string): Promise<Response> };
type Namespace = { idFromName(name: string): unknown; get(id: unknown): Stub };

type Env = {
  DISCORD_BOT_TOKEN: string;
  /** Committed var, not a secret: where a timer fire goes. */
  APP_BASE_URL?: string;
  /** Signs POST /timers (the database trigger and the app register with it). */
  BACKGROUND_REGISTER_SECRET?: string;
  /** Signs the fire request to /api/internal/timer. A different value on purpose. */
  BACKGROUND_FIRE_SECRET?: string;
  /** Bearer for GET /timers/health. */
  BACKGROUND_HEALTH_SECRET?: string;
  SUPABASE_KEEPALIVE_URL?: string;
  SUPABASE_KEEPALIVE_KEY?: string;
  BOT: Namespace;
  TIMERS: Namespace;
};
type State = {
  storage: {
    setAlarm(at: number): Promise<void>;
    getAlarm(): Promise<number | null>;
  };
};

const WATCHDOG_MS = 30_000;
const NO_STORE = { 'Cache-Control': 'no-store' };

async function openSocket(url: string): Promise<Socket> {
  const r = await fetch(url, { headers: { Upgrade: 'websocket' } });
  const ws = (
    r as Response & { webSocket?: (Socket & { accept(): void }) | null }
  ).webSocket;
  if (!ws)
    throw new Error('Discord did not accept the WebSocket (' + r.status + ')');
  ws.accept();
  return ws;
}

export class DiscordGateway {
  private gateway: Gateway | null = null;

  constructor(
    private state: State,
    private env: Env,
  ) {}

  private start() {
    if (!this.env.DISCORD_BOT_TOKEN) return null;
    if (!this.gateway)
      this.gateway = new Gateway({
        token: this.env.DISCORD_BOT_TOKEN,
        open: openSocket,
        fetch: (i, o) => fetch(i, o),
      });
    this.gateway.ensure();
    return this.gateway;
  }

  private async keepAlarm() {
    const at = await this.state.storage.getAlarm();
    if (!at || at < Date.now())
      await this.state.storage.setAlarm(Date.now() + WATCHDOG_MS);
  }

  async fetch(): Promise<Response> {
    const g = this.start();
    await this.keepAlarm();
    return Response.json(
      g ? g.snapshot() : { status: 'off: DISCORD_BOT_TOKEN is not set' },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  async alarm() {
    this.start();
    await this.state.storage.setAlarm(Date.now() + WATCHDOG_MS);
  }
}

// ---------------------------------------------------------------- timers

/** The slice of Durable Object SQLite storage the timer store uses. */
type Cursor<T> = { toArray(): T[] };
type Sql = {
  exec<T = Record<string, unknown>>(
    query: string,
    ...bindings: unknown[]
  ): Cursor<T>;
};
type TimersState = {
  storage: {
    sql: Sql;
    setAlarm(at: number): Promise<void>;
    getAlarm(): Promise<number | null>;
    deleteAlarm(): Promise<void>;
  };
};

const int = (value: unknown): number => Number(value ?? 0);

/** `TimerStore` over Durable Object SQLite. Every statement is synchronous, so a read and the write
 * that depends on it cannot interleave with another request. */
class SqlTimerStore implements TimerStore {
  constructor(private sql: Sql) {
    sql.exec(
      'create table if not exists timers (key text primary key, kind text not null, ref text not null, epoch integer not null, at integer not null, attempt integer not null, version integer not null)',
    );
    sql.exec('create index if not exists timers_at on timers (at)');
    sql.exec(
      'create table if not exists meta (k text primary key, v text not null)',
    );
  }

  private rows(query: string, ...bindings: unknown[]): TimerRow[] {
    return this.sql
      .exec<Record<string, unknown>>(query, ...bindings)
      .toArray()
      .map((row) => ({
        key: String(row.key),
        kind: row.kind as TimerRow['kind'],
        ref: String(row.ref),
        epoch: int(row.epoch),
        at: int(row.at),
        attempt: int(row.attempt),
        version: int(row.version),
      }));
  }

  read(key: string): TimerRow | null {
    return this.rows('select * from timers where key = ?', key)[0] ?? null;
  }

  write(row: TimerRow): void {
    this.sql.exec(
      'insert into timers (key, kind, ref, epoch, at, attempt, version) values (?, ?, ?, ?, ?, ?, ?) on conflict(key) do update set at = excluded.at, attempt = excluded.attempt, version = excluded.version',
      row.key,
      row.kind,
      row.ref,
      row.epoch,
      row.at,
      row.attempt,
      row.version,
    );
  }

  remove(key: string, version: number): boolean {
    const row = this.read(key);
    if (!row || row.version !== version) return false;
    this.sql.exec('delete from timers where key = ?', key);
    return true;
  }

  reschedule(
    key: string,
    version: number,
    at: number,
    attempt: number,
  ): boolean {
    const row = this.read(key);
    if (!row || row.version !== version) return false;
    this.sql.exec(
      'update timers set at = ?, attempt = ?, version = ? where key = ?',
      at,
      attempt,
      version + 1,
      key,
    );
    return true;
  }

  due(now: number, limit: number): TimerRow[] {
    return this.rows(
      'select * from timers where at <= ? order by at limit ?',
      now,
      limit,
    );
  }

  earliestAt(): number | null {
    const first = this.sql
      .exec<{ at: number | null }>('select min(at) as at from timers')
      .toArray()[0];
    return first && first.at !== null ? int(first.at) : null;
  }

  stats(now: number): TimerStats {
    const byKind = emptyByKind();
    let pending = 0;
    for (const row of this.sql
      .exec<{
        kind: string;
        n: number;
      }>('select kind, count(*) as n from timers group by kind')
      .toArray()) {
      pending += int(row.n);
      if (row.kind in byKind) byKind[row.kind as TimerRow['kind']] = int(row.n);
    }
    const overdue = this.sql
      .exec<{ n: number; oldest: number | null }>(
        'select count(*) as n, min(at) as oldest from timers where at <= ?',
        now,
      )
      .toArray()[0];
    return {
      pending,
      due: int(overdue?.n),
      byKind,
      oldestDueAt:
        overdue && overdue.oldest !== null ? int(overdue.oldest) : null,
    };
  }

  meta(key: string): string | null {
    const row = this.sql
      .exec<{ v: string }>('select v from meta where k = ?', key)
      .toArray()[0];
    return row ? String(row.v) : null;
  }

  setMeta(key: string, value: string): void {
    this.sql.exec(
      'insert into meta (k, v) values (?, ?) on conflict(k) do update set v = excluded.v',
      key,
      value,
    );
  }
}

/**
 * One object holds every timer: a single alarm, a single SQLite table, serialized writes.
 * Routes are internal (`/register`, `/health`, `/cron`); the public worker verifies the caller
 * before any of them wakes this object.
 */
export class Timers {
  private store: SqlTimerStore;

  constructor(
    private state: TimersState,
    private env: Env,
  ) {
    this.store = new SqlTimerStore(state.storage.sql);
  }

  private deps(): TimerDeps {
    const storage = this.state.storage;
    return {
      store: this.store,
      env: {
        appBaseUrl: this.env.APP_BASE_URL || 'https://duoly.gg',
        fireSecret: this.env.BACKGROUND_FIRE_SECRET,
        keepAliveUrl: this.env.SUPABASE_KEEPALIVE_URL,
        keepAliveKey: this.env.SUPABASE_KEEPALIVE_KEY,
      },
      fetch: (i, o) => fetch(i, o),
      getAlarm: () => storage.getAlarm(),
      setAlarm: (at) => storage.setAlarm(at),
      clearAlarm: () => storage.deleteAlarm(),
    };
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/register' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const answer = await registerTimer(this.deps(), body);
      return Response.json(answer.body, {
        status: answer.status,
        headers: NO_STORE,
      });
    }
    if (path === '/health')
      return Response.json(timersHealth(this.deps()), { headers: NO_STORE });
    if (path === '/cron')
      return Response.json(
        { keepAlive: await cronTick(this.deps()) },
        { headers: NO_STORE },
      );
    return new Response('Not found', { status: 404 });
  }

  async alarm() {
    await runAlarm(this.deps());
  }
}

const bot = (env: Env) => env.BOT.get(env.BOT.idFromName('bot'));
const timers = (env: Env) => env.TIMERS.get(env.TIMERS.idFromName('timers'));

const refused = (reason: string) =>
  Response.json({ error: 'unauthorized', reason }, { status: 401 });

/**
 * The signature is checked here, at the edge, so an unsigned call never wakes the Durable Object.
 * It is verified over the exact request text, which is then forwarded unchanged (oai-review F9).
 */
async function register(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const check = await verifyBackgroundBody({
    secret: env.BACKGROUND_REGISTER_SECRET,
    signature: request.headers.get(SIGNATURE_HEADER),
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    body,
  });
  if (!check.ok) return refused(check.reason);
  return timers(env).fetch(
    new Request('https://timers/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/status')
      return bot(env).fetch('https://bot/status');
    if (request.method === 'POST' && url.pathname === '/timers')
      return register(request, env);
    if (request.method === 'GET' && url.pathname === '/timers/health')
      return bearerAuthorized(
        request.headers.get('authorization'),
        env.BACKGROUND_HEALTH_SECRET,
      )
        ? timers(env).fetch('https://timers/health')
        : refused('bearer');
    return new Response('Not found', { status: 404 });
  },
  async scheduled(
    _event: unknown,
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    ctx.waitUntil(bot(env).fetch('https://bot/status'));
    ctx.waitUntil(timers(env).fetch('https://timers/cron'));
  },
};
