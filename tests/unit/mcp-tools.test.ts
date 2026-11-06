import { describe, expect, it } from 'vitest';
import { callTool } from '../../src/server/mcp/tools';
import { games, services } from '../../src/server/mcp/catalog';
import { calculateQuote } from '../../src/server/pricing';
const fx = async () => ({
  rate: 1.08,
  source: 'fallback' as const,
  date: '2026-11-06',
  fetchedAt: 0,
});
const live = async () => ({
  onlineNow: 8,
  recentMatches: [],
  teammates: [],
  stats: {
    onlineByGame: { val: 3, social: 5 },
    onlineByRegion: { eu: 8, na: 0, sa: 0, ao: 0 },
    sessions: 10,
    reviews: 3,
    rating: 5,
    matchSeconds: 72,
  },
});
describe('MCP tools', () => {
  it('quotes every bookable service and rank through the unchanged calculator', async () => {
    let count = 0;
    for (const game of games())
      for (const service of services(game.id)) {
        for (const rank of service.ranks.length ? service.ranks : [undefined]) {
          const server = game.id === 'mc' ? 'my world' : service.regions[0]!;
          const selection = {
            gameId: game.id,
            serviceId: service.id,
            units: 1,
            server,
            ...(rank ? { rank } : {}),
            ...(game.id === 'mc' ? { edition: 'Java' as const } : {}),
          };
          const result = await callTool(
            'get_quote',
            {
              game: game.id,
              service: service.id,
              quantity: 1,
              currency: 'EUR',
              server,
              ...(rank ? { rank } : {}),
              ...(game.id === 'mc' ? { edition: 'Java' } : {}),
            },
            { fx },
          );
          expect(result.structuredContent.amountMinor).toBe(
            calculateQuote(selection, { eurToUsd: 1.08 }).customer.amountMinor,
          );
          count++;
        }
      }
    expect(count).toBe(398);
  });
  it('returns games and service structured content', async () => {
    expect(
      (await callTool('list_games', {})).structuredContent.games,
    ).toHaveLength(15);
    expect(
      (await callTool('list_services', { game: 'val' })).structuredContent
        .services,
    ).not.toHaveLength(0);
  });
  it.each(['EUR', 'USD'] as const)(
    'reuses authoritative %s pricing without exposing payout',
    async (currency) => {
      const result = await callTool(
        'get_quote',
        {
          game: 'val',
          service: 'duo2',
          rank: 'Platinum',
          server: 'EU',
          quantity: 3,
          currency,
        },
        { fx },
      );
      const expected = calculateQuote(
        {
          gameId: 'val',
          serviceId: 'duo2',
          rank: 'Platinum',
          server: 'EU',
          units: 3,
        },
        { eurToUsd: 1.08, customerCurrency: currency },
      );
      expect(result.structuredContent).toMatchObject({
        amountMinor: expected.customer.amountMinor,
        amountEurMinor: expected.amountEurMinor,
        notReserved: true,
        basis: 'base price before account perks',
      });
      expect(JSON.stringify(result)).not.toContain('teammateAmount');
    },
  );
  it('reports aggregate online counts with historical context and no Social', async () => {
    const result = await callTool(
      'get_availability',
      { game: 'val' },
      { live },
    );
    expect(result.structuredContent).toMatchObject({
      online: 3,
      medianMatchSeconds: 72,
      medianWindowDays: 30,
    });
    expect(JSON.stringify(result)).toContain('queue');
    const all = await callTool('get_availability', {}, { live });
    expect(JSON.stringify(all)).not.toContain('social');
  });
  it('omits unavailable medians', async () => {
    const result = await callTool(
      'get_availability',
      {},
      { live: async () => ({ ...(await live()), stats: null }) },
    );
    expect(result.structuredContent).not.toHaveProperty('medianWindowDays');
  });
  it('creates only supported deep links with separate claimed-source attribution', async () => {
    const result = await callTool(
      'create_booking_link',
      { game: 'valorant', service: 'vod' },
      { platform: 'claude' },
    );
    expect(result.structuredContent.bookUrl).toBe(
      'https://duoly.gg/?game=val&service=vod&agent=claude#modes-h',
    );
    expect(result.structuredContent.url).toBe(
      'https://duoly.gg/games/valorant/coaching',
    );
  });
  it.each([
    ['list_services', { game: 'social' }],
    ['create_booking_link', { game: 'val', service: 'stack' }],
    [
      'get_quote',
      {
        game: 'val',
        service: 'duo2',
        quantity: 3,
        currency: 'EUR',
        server: 'EU',
      },
    ],
    [
      'get_quote',
      {
        game: 'val',
        service: 'duo2',
        rank: 'Platinum',
        quantity: 0,
        currency: 'EUR',
        server: 'EU',
      },
    ],
  ])('gives actionable errors for %s', async (name, args) => {
    await expect(callTool(name as 'get_quote', args)).rejects.toThrow(
      /list_games|list_services|quantity/,
    );
  });
});
