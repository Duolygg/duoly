import { afterEach, describe, expect, it } from 'vitest';
import {
  closedPost,
  COLORS,
  IS_COMPONENTS_V2,
  openPost,
  POST_GAMES,
  type PostOrder,
} from '../../src/server/discord/order-posts';
import {
  channelMap,
  norm,
  orderPostsConfig,
  resetOrderPostsMemory,
  runOrderPosts,
  type JsonFetch,
  type OrderPostStore,
} from '../../src/server/discord/order-post-tick';

const site = 'https://duoly.gg';
const now = Date.parse('2026-10-28T12:00:00Z');
const order: PostOrder = {
  reference: 'DL-48321',
  game: 'lol',
  title: 'Duo Pro',
  units: 3,
  unit: 'game',
  rank: 'Platinum II',
  region: 'EUW',
  voice: true,
  gg: false,
  payoutUsdCents: 1086,
  queuedAt: now - 100_000,
  cancelsAt: now + 200_000,
};

type Node = { type: number; [key: string]: unknown };
function walk(nodes: unknown[], out: Node[] = []): Node[] {
  for (const n of nodes as Node[]) {
    out.push(n);
    if (Array.isArray(n.components)) walk(n.components, out);
    if (n.accessory) walk([n.accessory], out);
  }
  return out;
}
const texts = (payload: { components: unknown[] }) =>
  walk(payload.components)
    .filter((n) => n.type === 10)
    .map((n) => String(n.content))
    .join('\n');

describe('order post design', () => {
  it('builds a Components V2 open post inside Discord limits', () => {
    const post = openPost(order, `${site}/claim/abcdefghijklmnopqrstuvwx`, {
      site,
      roleId: '1561145577369239592',
    });
    expect(post.flags).toBe(IS_COMPONENTS_V2);
    const all = walk(post.components);
    expect(all.length).toBeLessThanOrEqual(40);
    expect(texts(post).length).toBeLessThan(4000);
    const container = post.components[1] as Node;
    expect(container.type).toBe(17);
    expect(container.accent_color).toBe(COLORS.open);
    const gallery = all.find((n) => n.type === 12) as unknown as {
      items: { media: { url: string } }[];
    };
    expect(gallery.items[0]!.media.url).toBe(
      'https://duoly.gg/discord/orders/lol.webp',
    );
    const thumb = all.find((n) => n.type === 11) as unknown as {
      media: { url: string };
    };
    expect(thumb.media.url).toBe(
      'https://duoly.gg/assets/games/league-of-legends.png',
    );
    const buttons = all.filter((n) => n.type === 2);
    expect(buttons[0]).toMatchObject({
      style: 5,
      label: 'Take this order',
      url: `${site}/claim/abcdefghijklmnopqrstuvwx`,
    });
    for (const b of buttons)
      expect(String(b.label).length).toBeLessThanOrEqual(38);
    expect(post.allowed_mentions).toEqual({
      parse: [],
      roles: ['1561145577369239592'],
    });
    const t = texts(post);
    expect(t).toContain('<@&1561145577369239592>');
    expect(t).toContain('You earn $10.86');
    expect(t).toContain('Duo Pro · 3 games');
    expect(t).toContain(`<t:${(now + 200_000) / 1000}:R>`);
    expect(t).toMatch(/Platinum II/);
  });

  it('pings nobody when silent and paints Gamer Girl orders pink', () => {
    const post = openPost(
      { ...order, gg: true, unit: 'hour', units: 1 },
      `${site}/claim/x`,
      {
        site,
        roleId: '1561145577369239592',
        silent: true,
      },
    );
    expect(post.allowed_mentions.roles).toEqual([]);
    expect((post.components[1] as Node).accent_color).toBe(COLORS.gg);
    expect(texts(post)).toContain('Gamer Girl order');
    expect(texts(post)).toContain('1 hour');
  });

  it('closes compactly with a disabled status button and no ping', () => {
    const post = closedPost(
      {
        order,
        outcome: 'taken',
        at: now,
        teammate: 'Kira',
        waitedMs: 127_000,
      },
      { site },
    );
    expect(post.allowed_mentions).toEqual({ parse: [] });
    const all = walk(post.components);
    expect(all.some((n) => n.type === 12)).toBe(false);
    expect((post.components[0] as Node).accent_color).toBe(COLORS.taken);
    const button = all.find((n) => n.type === 2)!;
    expect(button).toMatchObject({ disabled: true, label: 'Order taken' });
    expect(texts(post)).toContain('**Kira** picked it up');
    expect(texts(post)).toContain('after 2m 7s in the queue');
    for (const outcome of [
      'expired',
      'rerolled',
      'cancelled_customer',
      'cancelled',
    ] as const) {
      const p = closedPost({ order, outcome, at: now }, { site });
      expect((p.components[0] as Node).accent_color).toBe(COLORS.closed);
    }
  });

  it('keeps user-facing copy free of dashes and ampersands', () => {
    const posts = [
      openPost({ ...order, gg: true }, `${site}/claim/x`, { site }),
      ...(
        [
          'taken',
          'expired',
          'rerolled',
          'cancelled_customer',
          'cancelled',
        ] as const
      ).map((outcome) =>
        closedPost({ order, outcome, at: now, teammate: 'Kira' }, { site }),
      ),
    ];
    for (const p of posts) {
      const copy = JSON.stringify(p);
      expect(copy).not.toMatch(/[\u2013\u2014&]/);
    }
  });

  it('escapes markdown in order fields', () => {
    const t = texts(
      openPost({ ...order, rank: '*Gold* _2_' }, `${site}/claim/x`, { site }),
    );
    expect(t).toContain('\\*Gold\\* \\_2\\_');
  });
});

describe('channel lookup', () => {
  it('finds the general channel under each game category', () => {
    const map = channelMap([
      { id: '1', type: 4, name: 'League of Legends' },
      { id: '2', type: 0, name: '👊lfd', parent_id: '1', position: 0 },
      { id: '3', type: 0, name: '💬general', parent_id: '1', position: 1 },
      { id: '4', type: 4, name: 'Pokémon Unite' },
      { id: '5', type: 0, name: '💬general', parent_id: '4', position: 0 },
      { id: '6', type: 4, name: 'EA Sports FC 27' },
      { id: '7', type: 0, name: 'chat', parent_id: '6', position: 0 },
    ]);
    expect(map).toEqual({ lol: '3', pu: '5', fc: '7' });
    expect(norm('Pokémon Unite')).toBe('pokemonunite');
    expect(Object.keys(POST_GAMES)).toHaveLength(15);
  });
});

describe('order posts runner', () => {
  afterEach(() => resetOrderPostsMemory());
  const config = {
    token: 'bot-token',
    guildId: '1561145343943376896',
    supabaseUrl: 'https://x.supabase.co',
    supabaseSecretKey: 'secret',
    silent: false,
  };

  function fakeDiscord(postStatus = 200) {
    const calls: { method: string; url: string; body?: unknown }[] = [];
    const fetchImpl: JsonFetch = async (url, init) => {
      calls.push({
        method: init.method,
        url,
        body: init.body ? JSON.parse(init.body) : undefined,
      });
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status });
      if (url.endsWith('/channels') && init.method === 'GET')
        return json(200, [
          { id: '10', type: 4, name: 'Valorant' },
          {
            id: '11',
            type: 0,
            name: '💬general',
            parent_id: '10',
            position: 0,
          },
        ]);
      if (url.endsWith('/roles'))
        return json(200, [{ id: '1561145577369239592', name: 'Teammate' }]);
      if (init.method === 'POST')
        return json(postStatus, { id: '1564984101792907334' });
      if (init.method === 'PATCH')
        return url.includes('/gone') ? json(404, {}) : json(200, { id: 'm' });
      return json(500, {});
    };
    return { calls, fetchImpl };
  }

  function fakeStore(): OrderPostStore & { log: string[] } {
    const log: string[] = [];
    return {
      log,
      due: async () => [
        {
          id: 'o1',
          reference: 'DL-1',
          game: 'val',
          title: 'Duo Pro',
          units: 1,
          unit: 'game',
          rank: 'Gold 3',
          region: 'EU',
          voice: false,
          gg: false,
          payoutUsdCents: 570,
          queuedAt: '2026-10-28T11:58:20.123456+00:00',
          cancelsAt: '2026-10-28T12:03:20.123456+00:00',
        },
        {
          id: 'o2',
          reference: 'DL-2',
          game: 'zz',
          title: 'Duo',
          units: 1,
          unit: 'game',
          rank: null,
          region: null,
          voice: false,
          gg: false,
          payoutUsdCents: 1,
          queuedAt: '2026-10-28T11:58:20Z',
          cancelsAt: '2026-10-28T12:03:20Z',
        },
      ],
      claim: async (order, key, channel) => {
        log.push(`claim ${order} ${key} ${channel}`);
        return { post: 'p1', token: 'abcdefghijklmnopqrstuvwx' };
      },
      saved: async (post, message) => void log.push(`saved ${post} ${message}`),
      failed: async (post) => void log.push(`failed ${post}`),
      toClose: async () => [
        {
          post: 'c1',
          channelId: '11',
          messageId: '12',
          outcome: 'taken',
          reference: 'DL-0',
          game: 'val',
          title: 'Duo Pro',
          units: 1,
          unit: 'game',
          at: '2026-10-28T11:59:00Z',
          teammate: 'Kira',
          waitedMs: 1000,
        },
        {
          post: 'c2',
          channelId: '11',
          messageId: 'gone',
          outcome: 'expired',
          reference: 'DL-9',
          game: 'val',
          title: 'Duo Pro',
          units: 1,
          unit: 'game',
          at: '2026-10-28T11:59:00Z',
          teammate: null,
          waitedMs: null,
        },
      ],
      closed: async (post, outcome) =>
        void log.push(`closed ${post} ${outcome}`),
    };
  }

  it('closes finished posts, then posts due orders with the bot link', async () => {
    const discord = fakeDiscord();
    const store = fakeStore();
    const result = await runOrderPosts(config, site, {
      store,
      fetchImpl: discord.fetchImpl,
      now,
    });
    expect(result).toEqual({ posted: 1, closed: 2, skipped: 1, failed: 0 });
    expect(store.log).toEqual([
      'closed c1 taken',
      'closed c2 gone',
      'claim o1 2026-10-28T11:58:20.123456+00:00 11',
      'saved p1 1564984101792907334',
    ]);
    const post = discord.calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('https://discord.com/api/v10/channels/11/messages');
    expect(JSON.stringify(post.body)).toContain(
      'https://duoly.gg/claim/abcdefghijklmnopqrstuvwx',
    );
    expect(JSON.stringify(post.body)).toContain('<@&1561145577369239592>');
  });

  it('releases the reservation when Discord refuses the post', async () => {
    const discord = fakeDiscord(400);
    const store = fakeStore();
    store.toClose = async () => [];
    const result = await runOrderPosts(config, site, {
      store,
      fetchImpl: discord.fetchImpl,
      now,
    });
    expect(result.failed).toBe(1);
    expect(store.log).toContain('failed p1');
  });

  it('stays off without the flag or the bot settings', () => {
    expect(orderPostsConfig({})).toBeNull();
    expect(
      orderPostsConfig({
        DISCORD_ORDER_POSTS_ENABLED: 'true',
        DISCORD_BOT_TOKEN: 't',
        DISCORD_GUILD_ID: 'bad',
        SUPABASE_URL: 'u',
        SUPABASE_SECRET_KEY: 'k',
      }),
    ).toBeNull();
    expect(
      orderPostsConfig({
        DISCORD_ORDER_POSTS_ENABLED: 'true',
        DISCORD_ORDER_POSTS_SILENT: 'true',
        DISCORD_BOT_TOKEN: 't',
        DISCORD_GUILD_ID: '1561145343943376896',
        SUPABASE_URL: 'u',
        SUPABASE_SECRET_KEY: 'k',
      }),
    ).toMatchObject({ silent: true });
  });
});
