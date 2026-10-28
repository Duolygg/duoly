// Cloudflare Worker that keeps the Duoly Discord bot online (ledger #27 and #38).
// One Durable Object ("bot") holds the gateway connection. An alarm every 30 seconds and a cron trigger every
// minute both wake it and reconnect if needed, so it comes back after any restart.
// GET /status shows the connection state (no secrets). Everything else answers 404.
import { Gateway, type Socket } from './gateway';

type Env = {
  DISCORD_BOT_TOKEN: string;
  BOT: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(input: string): Promise<Response> };
  };
};
type State = {
  storage: {
    setAlarm(at: number): Promise<void>;
    getAlarm(): Promise<number | null>;
  };
};

const WATCHDOG_MS = 30_000;

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

const bot = (env: Env) => env.BOT.get(env.BOT.idFromName('bot'));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/status')
      return bot(env).fetch('https://bot/status');
    return new Response('Not found', { status: 404 });
  },
  async scheduled(
    _event: unknown,
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    ctx.waitUntil(bot(env).fetch('https://bot/status'));
  },
};
