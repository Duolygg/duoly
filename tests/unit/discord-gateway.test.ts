import { describe, expect, it } from 'vitest';
import { accountRequest } from '../../src/server/discord/account-request';
import {
  Gateway,
  READ_INTENTS,
  type GatewayDeps,
  type Socket,
} from '../../workers/discord-gateway/src/gateway';

describe('account requests (port of lib/accountRequest.js)', () => {
  it.each([
    ['need euw account', { region: 'EUW', game: '' }],
    ['need pokemon unite acc', { region: '', game: 'Pokémon Unite' }],
    ['anyone has an acc?', { region: '', game: '' }],
    ['need a lvl 30 Pokémon Unite acc', { region: '', game: 'Pokémon Unite' }],
    [
      'can someone lend me a valorant account pls',
      { region: '', game: 'Valorant' },
    ],
    ['lf na league smurf', { region: 'NA', game: 'League of Legends' }],
    ['acc pls', { region: '', game: '' }],
  ])('asks: %s', (text, want) => {
    expect(accountRequest(text)).toEqual(want);
  });

  it.each([
    'need help with my account',
    'need to make an acc',
    'my account got banned',
    'connected my discord account',
    'I have an account',
    'you need an account to book',
    'selling euw acc',
    'need an account? ' + 'x'.repeat(260),
    '',
  ])('ignores: %s', (text) => {
    expect(accountRequest(text)).toBeNull();
  });
});

class FakeSocket implements Socket {
  sent: { op: number; d?: unknown }[] = [];
  closed: number | null = null;
  private on: Record<string, ((ev: never) => void)[]> = {};
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close(code = 1000) {
    this.closed = code;
    this.emit('close', { code });
  }
  addEventListener(type: string, fn: (ev: never) => void) {
    (this.on[type] ??= []).push(fn);
  }
  emit(type: string, ev: unknown) {
    for (const fn of this.on[type] ?? []) fn(ev as never);
  }
  msg(p: unknown) {
    this.emit('message', { data: JSON.stringify(p) });
  }
}

function setup(over: Partial<GatewayDeps> = {}) {
  const sockets: FakeSocket[] = [];
  const urls: string[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const posts: { url: string; body: unknown }[] = [];
  let t = 1_000_000;
  const deps: GatewayDeps = {
    token: 'tok',
    open: async (url) => {
      urls.push(url);
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    fetch: (async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push({ url, body: JSON.parse(String(init.body)) });
        return new Response('{}');
      }
      if (url.endsWith('/channels/c1'))
        return Response.json({ name: '💬general', parent_id: 'cat' });
      if (url.endsWith('/channels/c2'))
        return Response.json({ name: 'lfd', parent_id: 'cat' });
      if (url.endsWith('/channels/cat'))
        return Response.json({ name: 'Valorant' });
      return new Response('{}', { status: 404 });
    }) as typeof fetch,
    now: () => t,
    setTimer: (fn, ms) => timers.push({ fn, ms }),
    clearTimer: () => {},
    random: () => 0,
    log: () => {},
    ...over,
  };
  const g = new Gateway(deps);
  return {
    g,
    sockets,
    urls,
    timers,
    posts,
    tick: (ms: number) => (t += ms),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const ready = {
  op: 0,
  t: 'READY',
  s: 1,
  d: {
    session_id: 's1',
    resume_gateway_url: 'wss://resume.discord.gg',
    user: { id: 'bot1', username: 'Duoly' },
  },
};

describe('gateway connection', () => {
  it('identifies with the read intents, heartbeats and goes online', async () => {
    const { g, sockets, urls, timers } = setup();
    g.ensure();
    await flush();
    expect(urls[0]).toBe('https://gateway.discord.gg/?v=10&encoding=json');
    const ws = sockets[0]!;
    ws.msg({ op: 10, d: { heartbeat_interval: 41250 } });
    expect(ws.sent[0]).toMatchObject({
      op: 2,
      d: {
        token: 'tok',
        intents: READ_INTENTS,
        presence: { status: 'online' },
      },
    });
    ws.msg(ready);
    expect(g.status).toBe('online');
    expect(ws.sent.at(-1)).toMatchObject({ op: 3 });
    timers[0]!.fn();
    expect(ws.sent.at(-1)).toEqual({ op: 1, d: 1 });
    // no ack before the next beat: zombie connection, reconnect and resume
    timers.at(-1)!.fn();
    expect(ws.closed).toBe(4900);
    timers.at(-1)!.fn();
    await flush();
    expect(urls[1]).toBe('https://resume.discord.gg/?v=10&encoding=json');
    sockets[1]!.msg({ op: 10, d: { heartbeat_interval: 41250 } });
    expect(sockets[1]!.sent[0]).toEqual({
      op: 6,
      d: { token: 'tok', session_id: 's1', seq: 1 },
    });
  });

  it('stays online without reading when the intent is off, and stops on a bad token', async () => {
    const { g, sockets, timers } = setup();
    g.ensure();
    await flush();
    sockets[0]!.emit('close', { code: 4014 });
    expect(g.canRead).toBe(false);
    timers.at(-1)!.fn();
    await flush();
    sockets[1]!.msg({ op: 10, d: { heartbeat_interval: 1000 } });
    expect(sockets[1]!.sent[0]).toMatchObject({ op: 2, d: { intents: 0 } });
    sockets[1]!.emit('close', { code: 4004 });
    expect(g.status).toMatch(/^stopped: the bot token is wrong/);
    g.ensure();
    await flush();
    expect(sockets).toHaveLength(2);
  });

  it('the watchdog does not open a second connection', async () => {
    const { g, sockets } = setup();
    g.ensure();
    g.ensure();
    await flush();
    g.ensure();
    expect(sockets).toHaveLength(1);
  });
});

describe('account request replies', () => {
  const msg = (over: Record<string, unknown> = {}) => ({
    id: 'm1',
    type: 0,
    channel_id: 'c1',
    guild_id: 'g',
    content: 'need euw acc',
    author: { id: 'u1' },
    ...over,
  });

  it('replies with @here in general chats, rate limited per user and channel', async () => {
    const { g, posts, tick } = setup();
    await g.onMessage(msg());
    expect(posts).toHaveLength(1);
    expect(posts[0]!.url).toBe(
      'https://discord.com/api/v10/channels/c1/messages',
    );
    expect(posts[0]!.body).toEqual({
      content:
        '@here <@u1> needs an **EUW** Valorant account. Got one to spare? Reply here or DM them.',
      message_reference: {
        message_id: 'm1',
        channel_id: 'c1',
        fail_if_not_exists: false,
      },
      allowed_mentions: { parse: ['everyone'], replied_user: false },
    });
    tick(30_000);
    await g.onMessage(msg({ author: { id: 'u2' } }));
    expect(posts).toHaveLength(1); // channel waits a minute
    tick(31_000);
    await g.onMessage(msg({ author: { id: 'u1' } }));
    expect(posts).toHaveLength(1); // same person waits 10 minutes
    await g.onMessage(
      msg({ author: { id: 'u2' }, content: 'need pokemon unite acc' }),
    );
    expect(posts.at(-1)!.body).toMatchObject({
      content: expect.stringContaining('needs a Pokémon Unite account'),
    });
  });

  it('ignores bots, other channels and talk about accounts', async () => {
    const { g, posts } = setup();
    await g.onMessage(msg({ author: { id: 'u1', bot: true } }));
    await g.onMessage(msg({ channel_id: 'c2' }));
    await g.onMessage(msg({ content: 'my account got banned' }));
    await g.onMessage(msg({ guild_id: undefined }));
    await g.onMessage(msg({ type: 7 }));
    expect(posts).toHaveLength(0);
  });
});
