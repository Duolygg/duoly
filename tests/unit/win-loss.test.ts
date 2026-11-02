import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  tracksWinLoss,
  WL_SERVICES,
  winrateLabel,
} from '../../src/design-reference/lib/winloss.js';
import {
  MatchReportCommandSchema,
  MatchReportResponseSchema,
} from '../../src/contracts/match-reports';
import { TeammateStatsResponseSchema } from '../../src/contracts/reviews';
import { createTeammateFetch } from '../../src/components/teammate/teammate-data';

// Winrate from match reports on win/loss orders (migration 20261102160000).
const sql = readFileSync(
  'supabase/migrations/20261102160000_win_loss.sql',
  'utf8',
);
const id = '11111111-1111-4111-8111-111111111111';
const game = {
  teammateIgn: 'Mina#EUW',
  customerIgn: 'Alex#EUW',
  link: 'https://op.gg/lol/summoners/euw/Mina-EUW/matches/1',
};

describe('which orders get a match report', () => {
  it('per-game duo and fill services in the eight win/loss games', () => {
    expect(tracksWinLoss({ game: 'lol', service: 'duo2', gg: false })).toBe(
      true,
    );
    expect(tracksWinLoss({ game: 'val', service: 'premier', gg: false })).toBe(
      true,
    );
    expect(tracksWinLoss({ game: 'cs2', service: 'wing', gg: false })).toBe(
      true,
    );
  });

  it('never coaching, fun modes, Gamer Girl, Social, hourly games, placements or draws', () => {
    for (const order of [
      { game: 'lol', service: 'vod' }, // coaching
      { game: 'lol', service: 'aram' }, // fun mode
      { game: 'lol', service: 'arena' }, // placement
      { game: 'lol', service: 'duo2', gg: true }, // Gamer Girl
      { game: 'social', service: 'chat', gg: true },
      { game: 'fn', service: 'duo2' }, // hourly
      { game: 'tft', service: 'duo2' }, // placement
      { game: 'fc', service: 'duo2' }, // draws
    ])
      expect(tracksWinLoss({ gg: false, ...order })).toBe(false);
  });

  it('the database uses exactly the same list', () => {
    const m = /in \(values (.+?)\);/.exec(sql);
    const fromSql = [
      ...(m?.[1] ?? '').matchAll(/\('([a-z0-9]+)','([a-z0-9]+)'\)/g),
    ]
      .map((x) => x[1] + ':' + x[2])
      .sort();
    const fromCode = Object.entries(WL_SERVICES)
      .flatMap(([g, ids]) => (ids as string[]).map((s) => g + ':' + s))
      .sort();
    expect(fromSql).toEqual(fromCode);
    expect(fromSql.length).toBeGreaterThan(30);
  });
});

describe('match reports', () => {
  it('needs both IGNs and an https match link for every game', () => {
    const ok = { csrf: 'x', games: [game, game], wins: 1, losses: 1 };
    expect(MatchReportCommandSchema.safeParse(ok).success).toBe(true);
    for (const bad of [
      { ...game, link: 'op.gg/match/1' },
      { ...game, link: 'http://op.gg/match/1' },
      { ...game, teammateIgn: '  ' },
      { ...game, customerIgn: '' },
    ])
      expect(
        MatchReportCommandSchema.safeParse({ ...ok, games: [bad, game] })
          .success,
      ).toBe(false);
  });

  it('is required to finish and only counts completed orders', () => {
    expect(sql).toContain(
      'Fill in the match report first: every game with both IGNs and the match link, plus your wins and losses.',
    );
    expect(sql).toContain("a.end_reason = 'completed'");
    expect(sql).toContain(
      'check (wins + losses = pg_catalog.jsonb_array_length(games))',
    );
  });

  it('shows the winrate', () => {
    expect(winrateLabel(31, 19)).toBe('62% · 31W 19L');
    expect(winrateLabel(0, 0)).toBe('');
    expect(
      TeammateStatsResponseSchema.shape.stats.shape.winLoss.safeParse({
        wins: 3,
        losses: 1,
      }).success,
    ).toBe(true);
  });

  it('the desk keeps the server’s message when a save is refused', async () => {
    const transport = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('/api/teammate/orders/' + id + '/match-report');
      if (init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          csrf: 'token',
          games: [game],
          wins: 1,
          losses: 1,
        });
        return Response.json(
          { error: 'Wins and losses need to add up to 1 games.' },
          { status: 400 },
        );
      }
      return Response.json({ report: { games: [game], wins: 1, losses: 0 } });
    });
    const api = createTeammateFetch({ csrf: 'token', fetcher: transport });
    const read = await api('/api/orders/' + id + '/match-report');
    expect(
      MatchReportResponseSchema.parse(await read.json()).report?.wins,
    ).toBe(1);
    const save = await api('/api/orders/' + id + '/match-report', {
      method: 'POST',
      body: JSON.stringify({ games: [game], wins: 1, losses: 1 }),
    });
    expect(save.status).toBe(400);
    expect((await save.json()).error).toBe(
      'Wins and losses need to add up to 1 games.',
    );
  });
});
