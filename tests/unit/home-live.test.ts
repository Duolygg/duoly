import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '../../src/components/home/Home.jsx';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HOME_LIVE_CACHE_CONTROL,
  HOME_LIVE_TTL_MS,
  formatMatchTime,
  homeLive,
  mapRecentMatches,
  resetHomeLiveCache,
} from '../../src/server/home/live';

afterEach(() => resetHomeLiveCache());

describe('home live: recent matches mapping', () => {
  it('formats time to match like the original ticker', () => {
    expect(formatMatchTime(58)).toBe('58s');
    expect(formatMatchTime(68)).toBe('1m 08s');
    expect(formatMatchTime(123)).toBe('2m 03s');
    expect(formatMatchTime(3900)).toBe('1h 05m');
    expect(formatMatchTime(-5)).toBe('0s');
  });

  it('maps database rows into his [game, who, what, time] shape plus rating', () => {
    expect(
      mapRecentMatches([
        {
          game: 'val',
          name: 'Zelda',
          title: 'Duo Pro',
          units: 3,
          matchSeconds: 58,
          rating: 4,
        },
        {
          game: 'cs2',
          name: null,
          title: 'Rank Rush ×5',
          units: 5,
          matchSeconds: 68,
          rating: null,
        },
      ]),
    ).toEqual([
      { game: 'val', who: 'Zelda', what: 'Duo Pro ×3', time: '58s', rating: 4 },
      {
        game: 'cs2',
        who: 'A player',
        what: 'Rank Rush ×5',
        time: '1m 08s',
        rating: null,
      },
    ]);
  });

  it('drops malformed rows and never passes on email-like names or bad ratings', () => {
    expect(mapRecentMatches(null)).toEqual([]);
    expect(
      mapRecentMatches([
        { game: 'unknown', title: 'Duo', matchSeconds: 1 },
        { game: 'lol', title: '', matchSeconds: 1 },
        { game: 'lol', title: 'Duo', matchSeconds: 'x' },
        'junk',
        {
          game: 'lol',
          name: 'me@mail.test',
          title: 'Duo',
          units: 1,
          matchSeconds: 1,
          rating: 9,
        },
      ]),
    ).toEqual([
      { game: 'lol', who: 'A player', what: 'Duo', time: '1s', rating: null },
    ]);
    expect(
      mapRecentMatches(
        Array.from({ length: 30 }, () => ({
          game: 'lol',
          title: 'Duo',
          matchSeconds: 1,
        })),
      ),
    ).toHaveLength(20);
  });
});

describe('home live: cache', () => {
  it('reads the database at most once per TTL and shares an in-flight read', async () => {
    const load = vi.fn(async () => ({
      online: 7,
      matches: [{ game: 'lol', name: 'Sam', title: 'Duo', matchSeconds: 5 }],
    }));
    const [a, b] = await Promise.all([homeLive(load, 0), homeLive(load, 0)]);
    expect(a).toEqual(b);
    expect(a.onlineNow).toBe(7);
    expect(a.recentMatches[0]?.who).toBe('Sam');
    await homeLive(load, HOME_LIVE_TTL_MS - 1);
    expect(load).toHaveBeenCalledTimes(1);
    await homeLive(load, HOME_LIVE_TTL_MS + 1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps the last good figures when a read fails or the RPC is missing', async () => {
    await homeLive(
      async () => ({
        online: 3,
        matches: [{ game: 'lol', name: 'Sam', title: 'Duo', matchSeconds: 5 }],
      }),
      0,
    );
    const failed = await homeLive(async () => {
      throw new Error('down');
    }, HOME_LIVE_TTL_MS + 1);
    expect(failed.onlineNow).toBe(3);
    const missing = await homeLive(
      async () => ({ online: null, matches: null }),
      3 * HOME_LIVE_TTL_MS,
    );
    expect(missing.onlineNow).toBe(3);
    expect(missing.recentMatches).toHaveLength(1);
  });

  it('starts at zero and no matches without any data', async () => {
    expect(
      await homeLive(async () => {
        throw new Error('down');
      }, 0),
    ).toEqual({ onlineNow: 0, recentMatches: [] });
  });
});

describe('home live: wiring', () => {
  const read = (path: string) => readFileSync(path, 'utf8');

  it('serves a small public JSON endpoint with a CDN cache header', () => {
    expect(HOME_LIVE_CACHE_CONTROL).toMatch(/s-maxage=\d+/);
    expect(HOME_LIVE_CACHE_CONTROL).toMatch(/^public/);
    const route = read('src/pages/api/home/live.ts');
    expect(route).toContain('HOME_LIVE_CACHE_CONTROL');
    expect(route).not.toMatch(/cookies|accountContext/);
  });

  it('feeds Home.jsx from the cached reader, and the ticker keeps his samples until real matches exist', () => {
    const page = read('src/pages/index.astro');
    expect(page).toContain('homeLive()');
    expect(page).not.toContain("rpc('presence_public_count')");
    const home = read('src/components/home/Home.jsx');
    expect(home).toContain('this.props.recentMatches');
    expect(home).toContain('live.length ? live : tk');
    expect(read('src/components/account/LiveHome.tsx')).toContain(
      "fetch('/api/home/live'",
    );
  });

  it('migration exposes only public fields and grants anon execute', () => {
    const sql = read('supabase/migrations/20261024180000_home_live.sql');
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toMatch(
      /grant execute on function public\.home_recent_matches\(\) to anon, authenticated/,
    );
    for (const field of [
      'ign',
      'note',
      'region',
      'amount_eur_cents',
      'customer_id',
      'email',
    ])
      expect(sql).not.toMatch(new RegExp(`'${field}'`));
  });
});

describe('home live: Home.jsx ticker render', () => {
  const ticker = (html: string) =>
    /aria-label="Recent matches"[\s\S]*?<\/div><\/div>/.exec(html)?.[0] ?? '';

  it('shows his sample rows when there are no real matches', () => {
    const html = renderToStaticMarkup(
      React.createElement(Home, { onlineNow: 2, recentMatches: [] }),
    );
    expect(ticker(html)).toContain('Jonas');
    expect(html).toContain('2 teammates');
  });

  it('replaces the samples with real matches, repeated to fill the strip, with the rating', () => {
    const html = renderToStaticMarkup(
      React.createElement(Home, {
        onlineNow: 1,
        recentMatches: [
          {
            game: 'val',
            who: 'Zelda',
            what: 'Duo Pro',
            time: '58s',
            rating: 4,
          },
          { game: 'xx', who: 'Ghost', what: 'Duo', time: '1s', rating: null },
        ],
      }),
    );
    const strip = ticker(html);
    expect(strip).toContain('Zelda');
    expect(strip).not.toContain('Jonas');
    expect(strip).not.toContain('Ghost');
    expect(strip.match(/Zelda/g)?.length).toBeGreaterThanOrEqual(10);
    expect(strip).toContain('Rated 4 out of 5');
    expect(html).toContain('1 teammate online');
  });
});
