// The Duoly bot's live Discord connection (the "gateway"), port of Fabian's lib/discordBot.js and
// lib/discordAccounts.js. While it is connected the bot shows as online in the server, and it reads the
// general chats for account requests ("need euw account") and replies with @here so whoever has one sees it.
// Runs in one Cloudflare Durable Object (see index.ts), because Vercel functions cannot hold a connection open.
// Needs the Message Content intent in the developer portal; without it the bot stays online without reading.
import { accountRequest } from '../../../src/server/discord/account-request';

// GUILDS + GUILD_MESSAGES + MESSAGE_CONTENT
export const READ_INTENTS = 1 | (1 << 9) | (1 << 15);
export const GATEWAY = 'https://gateway.discord.gg';
const QUERY = '/?v=10&encoding=json';
const API = 'https://discord.com/api/v10';
// Discord closes with these when retrying cannot help
export const FATAL: Record<number, string> = {
  4004: 'the bot token is wrong (reset it and update DISCORD_BOT_TOKEN)',
  4010: 'invalid shard',
  4011: 'sharding required',
  4012: 'invalid API version',
  4013: 'invalid intents',
  4014: 'intents not enabled in the developer portal',
};
export const PER_USER_MS = 10 * 60_000;
export const PER_CHANNEL_MS = 60_000;
const CHANNEL_CACHE_MS = 30 * 60_000;
const PRESENCE = { status: 'online', since: null, afk: false, activities: [] };

export type Socket = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'message', fn: (ev: { data: unknown }) => void): void;
  addEventListener(type: 'close', fn: (ev: { code: number }) => void): void;
  addEventListener(type: 'error', fn: () => void): void;
};

export type GatewayDeps = {
  token: string;
  /** Opens a client WebSocket to the given https URL. */
  open: (url: string) => Promise<Socket>;
  fetch: typeof fetch;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
  random?: () => number;
  log?: (msg: string) => void;
};

type Payload = {
  op: number;
  d?: unknown;
  s?: number | null;
  t?: string | null;
};
export type DiscordMessage = {
  id: string;
  type: number;
  channel_id: string;
  guild_id?: string;
  content?: string;
  author?: { id: string; bot?: boolean };
};

export class Gateway {
  status = 'off';
  user: string | null = null;
  canRead = true;
  connectedAt = 0;
  lastBeatAck = 0;
  private ws: Socket | null = null;
  private seq: number | null = null;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;
  private acked = true;
  private beat: unknown = null;
  private retries = 0;
  private stopped = false;
  private connecting = false;
  private botId: string | null = null;
  private channels = new Map<
    string,
    { name: string; category: string; at: number }
  >();
  private users = new Map<string, number>();
  private lastInChannel = new Map<string, number>();

  constructor(private deps: GatewayDeps) {}

  private now() {
    return (this.deps.now ?? Date.now)();
  }
  private later(fn: () => void, ms: number) {
    return (this.deps.setTimer ?? ((f, m) => setTimeout(f, m)))(fn, ms);
  }
  private log(msg: string) {
    (this.deps.log ?? console.log)('[gateway] ' + msg);
  }

  /** True while a socket is open or being opened; the watchdog calls ensure() when this is false. */
  get alive() {
    return !!this.ws || this.connecting;
  }

  /** Watchdog: connect unless connected, connecting or stopped for good. */
  ensure() {
    if (this.stopped || this.alive) return;
    void this.connect(!!this.sessionId);
  }

  private send(ws: Socket, payload: Payload) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      /* closed; the close handler reconnects */
    }
  }

  async connect(resume: boolean) {
    if (this.connecting) return;
    this.connecting = true;
    this.status = resume ? 'reconnecting' : 'connecting';
    let ws: Socket;
    try {
      ws = await this.deps.open(
        (resume && this.resumeUrl ? this.resumeUrl : GATEWAY) + QUERY,
      );
    } catch (e) {
      this.connecting = false;
      this.log('could not open the connection: ' + String(e));
      this.retry();
      return;
    }
    this.connecting = false;
    this.ws = ws;
    ws.addEventListener('message', (ev) => this.onPayload(ws, ev.data, resume));
    ws.addEventListener('close', (ev) => this.onClose(ws, ev.code));
    ws.addEventListener('error', () => {});
  }

  private onPayload(ws: Socket, data: unknown, resume: boolean) {
    if (this.ws !== ws) return;
    let p: Payload;
    try {
      p = JSON.parse(
        typeof data === 'string'
          ? data
          : new TextDecoder().decode(data as ArrayBuffer),
      );
    } catch {
      return;
    }
    if (p.s != null) this.seq = p.s;
    if (p.op === 10) {
      // Hello: heartbeat on Discord's interval (first one at a random point), then log in or resume
      const every = (p.d as { heartbeat_interval: number }).heartbeat_interval;
      this.acked = true;
      const beat = () => {
        if (this.ws !== ws) return;
        // no answer to the last heartbeat: the connection is dead, reconnect
        if (!this.acked) return ws.close(4900, 'zombie');
        this.acked = false;
        this.send(ws, { op: 1, d: this.seq });
        this.beat = this.later(beat, every);
      };
      this.beat = this.later(
        beat,
        Math.floor(every * (this.deps.random ?? Math.random)()),
      );
      if (resume && this.sessionId)
        this.send(ws, {
          op: 6,
          d: {
            token: this.deps.token,
            session_id: this.sessionId,
            seq: this.seq,
          },
        });
      else
        this.send(ws, {
          op: 2,
          d: {
            token: this.deps.token,
            intents: this.canRead ? READ_INTENTS : 0,
            properties: { os: 'cloudflare', browser: 'duoly', device: 'duoly' },
            presence: PRESENCE,
          },
        });
    } else if (p.op === 11) {
      this.acked = true;
      this.lastBeatAck = this.now();
    } else if (p.op === 1) {
      this.send(ws, { op: 1, d: this.seq }); // Discord asked for a heartbeat right now
    } else if (p.op === 7) {
      ws.close(4900, 'reconnect requested');
    } else if (p.op === 9) {
      // invalid session: start fresh unless Discord says it can be resumed
      if (!p.d) {
        this.sessionId = null;
        this.seq = null;
      }
      this.later(
        () => ws.close(4900, 'invalid session'),
        1000 + (this.deps.random ?? Math.random)() * 4000,
      );
    } else if (p.op === 0 && p.t === 'READY') {
      const d = p.d as {
        session_id: string;
        resume_gateway_url: string;
        user: { id: string; username: string };
      };
      this.sessionId = d.session_id;
      this.resumeUrl = d.resume_gateway_url.replace(/^wss:/, 'https:');
      this.user = d.user.username;
      this.botId = d.user.id;
      this.retries = 0;
      this.status = 'online';
      this.connectedAt = this.now();
      // set the presence again right after login, so an activity from an earlier session is cleared too
      this.send(ws, { op: 3, d: PRESENCE });
      this.log(
        this.user +
          ' is online' +
          (this.canRead ? ' and reading the general chats' : ''),
      );
    } else if (p.op === 0 && p.t === 'RESUMED') {
      this.retries = 0;
      this.status = 'online';
      this.connectedAt = this.now();
    } else if (p.op === 0 && p.t === 'MESSAGE_CREATE') {
      void this.onMessage(p.d as DiscordMessage);
    }
  }

  private onClose(ws: Socket, code: number) {
    if (this.ws !== ws) return;
    this.ws = null;
    (this.deps.clearTimer ?? ((t) => clearTimeout(t as number)))(this.beat);
    // Message Content intent not switched on: stay online without reading messages
    if (code === 4014 && this.canRead) {
      this.canRead = false;
      this.sessionId = null;
      this.log(
        'reading messages is off: switch on "Message Content Intent" in the Discord developer portal',
      );
      this.later(() => void this.connect(false), 500);
      return;
    }
    const fatal = FATAL[code];
    if (fatal) {
      this.status = 'stopped: ' + fatal;
      this.stopped = true;
      this.log('Discord closed the connection: ' + fatal);
      return;
    }
    this.retry();
  }

  private retry() {
    // right away the first time, then wait longer each time (max 60 s)
    const wait = Math.min(
      60_000,
      this.retries ? 1000 * 2 ** this.retries : 500,
    );
    this.retries += 1;
    this.status = 'reconnecting';
    this.later(() => void this.connect(!!this.sessionId), wait);
  }

  private async api(method: string, path: string, body?: unknown) {
    return this.deps.fetch(API + path, {
      method,
      headers: {
        Authorization: 'Bot ' + this.deps.token,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://duoly.gg, 1.0)',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private async channelInfo(id: string) {
    const known = this.channels.get(id);
    if (known && this.now() - known.at < CHANNEL_CACHE_MS) return known;
    const r = await this.api('GET', '/channels/' + id);
    const c = (r.ok ? await r.json() : {}) as {
      name?: string;
      parent_id?: string;
    };
    let category = '';
    if (c.parent_id) {
      const p = await this.api('GET', '/channels/' + c.parent_id);
      category = p.ok ? ((await p.json()) as { name?: string }).name || '' : '';
    }
    const info = { name: c.name || '', category, at: this.now() };
    this.channels.set(id, info);
    return info;
  }

  /** Account requests in the general chats: reply with @here, at most once per person per 10 minutes and per channel per minute. */
  async onMessage(m: DiscordMessage) {
    try {
      if (
        !m ||
        !m.guild_id ||
        !m.content ||
        !m.author ||
        m.author.bot ||
        m.author.id === this.botId
      )
        return;
      if (m.type !== 0 && m.type !== 19) return; // normal messages and replies only
      const req = accountRequest(m.content);
      if (!req) return;
      const ch = await this.channelInfo(m.channel_id);
      if (!/general/i.test(ch.name)) return;
      const now = this.now();
      if (now - (this.users.get(m.author.id) ?? -Infinity) < PER_USER_MS)
        return;
      if (
        now - (this.lastInChannel.get(m.channel_id) ?? -Infinity) <
        PER_CHANNEL_MS
      )
        return;
      this.users.set(m.author.id, now);
      this.lastInChannel.set(m.channel_id, now);
      // the game they named, else the channel's category (for example the League section)
      const game = req.game
        ? ' ' + req.game
        : ch.category && !/text channels|general/i.test(ch.category)
          ? ' ' + ch.category
          : '';
      await this.api('POST', '/channels/' + m.channel_id + '/messages', {
        content:
          '@here <@' +
          m.author.id +
          '> needs' +
          (req.region ? ' an **' + req.region + '**' : ' a') +
          game +
          ' account. Got one to spare? Reply here or DM them.',
        message_reference: {
          message_id: m.id,
          channel_id: m.channel_id,
          fail_if_not_exists: false,
        },
        allowed_mentions: { parse: ['everyone'], replied_user: false },
      });
    } catch {
      /* never let one message break the bot */
    }
  }

  snapshot() {
    return {
      status: this.status,
      user: this.user,
      reading: this.canRead,
      onlineSince: this.connectedAt
        ? new Date(this.connectedAt).toISOString()
        : null,
      lastHeartbeatAck: this.lastBeatAck
        ? new Date(this.lastBeatAck).toISOString()
        : null,
    };
  }
}
