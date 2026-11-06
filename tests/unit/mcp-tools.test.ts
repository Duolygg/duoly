import { describe, expect, it } from 'vitest';
import { callTool, INSTRUCTIONS } from '../../src/server/mcp/tools';
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
  it('puts complete bookable service data in the text the model reads', async () => {
    const result = await callTool('list_services', { game: 'lol' });
    const text = result.content[0]!.text;
    expect(text).toContain('"id":"duo2"');
    expect(text).toContain('"ranks":');
    expect(text).toContain('EUW');
    expect(text).toContain(
      '"bookUrl":"https://duoly.gg/?game=lol&service=duo2',
    );
    expect(text).toContain('Share bookUrl');
    expect(
      new TextEncoder().encode(JSON.stringify(result)).byteLength,
    ).toBeLessThanOrEqual(65536);
  });
  it('describes every service from catalog copy with the cheapest calculated EUR unit price', async () => {
    for (const g of games()) {
      const result = await callTool('list_services', { game: g.id });
      for (const s of result.structuredContent.services as ReturnType<
        typeof services
      >) {
        expect(s.description.length).toBeGreaterThan(15);
        expect(s.description).not.toMatch(/[&\u2013\u2014]/);
        const amounts = (s.ranks.length ? s.ranks : [undefined]).map(
          (rank) =>
            calculateQuote(
              {
                gameId: g.id,
                serviceId: s.id,
                units: 1,
                server: s.regions[0] ?? 'my world',
                ...(rank ? { rank } : {}),
                ...(g.id === 'mc' ? { edition: 'Java' } : {}),
              },
              { eurToUsd: 1 },
            ).amountEurMinor,
        );
        expect(s.fromPrice).toEqual({
          amountMinor: Math.min(...amounts),
          currency: 'EUR',
          unit: s.unit,
          quantity: 1,
          basis: 'base price before account perks',
        });
        expect(result.content[0]!.text).toContain(s.description);
      }
    }
    const lol = services('lol');
    expect(lol.find((s) => s.id === 'duo1')!.description).toContain('Diamond');
    expect(lol.find((s) => s.id === 'duo2')!.description).toContain('Master');
    expect(lol.find((s) => s.id === 'duo3')!.description).toContain(
      'Grandmaster',
    );
  });
  it('finds three ranked League sessions with exact prices and booking links', async () => {
    const result = await callTool(
      'find_session',
      {
        game: 'lol',
        goal: 'ranked',
        rank: 'Gold',
        region: 'EUW',
        quantity: 3,
        currency: 'EUR',
      },
      { fx, platform: 'claude' },
    );
    const data = result.structuredContent;
    expect(data.missingInputs).toEqual([]);
    const matches = data.matches as Array<Record<string, unknown>>;
    expect(matches).toHaveLength(3);
    for (const m of matches) {
      expect(m.priceKind).toBe('exact');
      expect(m.amountMinor).toBe(
        calculateQuote(
          {
            gameId: 'lol',
            serviceId: m.id,
            rank: 'Gold',
            server: 'EUW',
            units: 3,
          },
          { eurToUsd: 1.08 },
        ).amountEurMinor,
      );
      expect(m.bookUrl).toContain('agent=claude');
      expect(result.content[0]!.text).toContain(m.bookUrl as string);
    }
  });
  it('reports missing inputs without guessing a user rank or currency', async () => {
    const result = await callTool(
      'find_session',
      { game: 'lol', goal: 'ranked' },
      { fx },
    );
    expect(result.structuredContent.missingInputs).toEqual(
      expect.arrayContaining(['rank', 'server', 'quantity', 'currency']),
    );
    expect(
      (result.structuredContent.matches as Array<{ priceKind: string }>).every(
        (s) => s.priceKind === 'from',
      ),
    ).toBe(true);
    expect(result.content[0]!.text).not.toContain('online');
  });
  it('finds Valorant coaching under a total budget, including flat-priced rank context', async () => {
    const result = await callTool(
      'find_session',
      {
        game: 'val',
        goal: 'coaching',
        rank: 'Gold',
        server: 'EU',
        quantity: 1,
        budget: 15,
        currency: 'EUR',
      },
      { fx },
    );
    const matches = result.structuredContent.matches as Array<
      Record<string, unknown>
    >;
    expect(matches).toHaveLength(3);
    expect(
      matches.every(
        (s) =>
          s.category === 'training' &&
          Number(s.amountMinor) === 1299 &&
          s.priceKind === 'exact',
      ),
    ).toBe(true);
    expect(result.structuredContent.missingInputs).toEqual([]);
    expect(result.structuredContent.budgetApplied).toBe(true);
    const none = await callTool(
      'find_session',
      { game: 'val', goal: 'coaching', budget: 1, currency: 'EUR' },
      { fx },
    );
    expect(none.structuredContent.matches).toEqual([]);
    expect(none.structuredContent.missingInputs).toContain('quantity');
    const noCurrency = await callTool(
      'find_session',
      { game: 'val', goal: 'coaching', budget: 1 },
      { fx },
    );
    expect(noCurrency.structuredContent.budgetApplied).toBe(false);
    expect(noCurrency.structuredContent.missingInputs).toContain('currency');
  });
  it.each([
    [{ game: 'League' }, /lol.*league-of-legends/],
    [{ game: 'lol', goal: 'boost' }, /duo.*coaching.*ranked/],
    [{ game: 'lol', rank: 'gold' }, /Gold/],
    [{ game: 'lol', region: 'Europe' }, /EUW/],
    [{ game: 'lol', currency: 'GBP' }, /EUR.*USD/],
    [{ game: 'lol', quantity: 0 }, /quantity/],
    [{ game: 'lol', region: 'EUW', server: 'NA' }, /same token/],
  ])(
    'corrects invalid discovery input %j with valid tokens',
    async (args, error) => {
      await expect(callTool('find_session', args, { fx })).rejects.toThrow(
        error,
      );
    },
  );
  it('exposes bookUrls and all structured data in every tool text', async () => {
    for (const [name, args] of [
      ['list_games', {}],
      ['get_availability', { game: 'lol' }],
      ['create_booking_link', { game: 'lol', service: 'duo2' }],
      [
        'get_quote',
        {
          game: 'lol',
          service: 'duo2',
          rank: 'Gold',
          quantity: 3,
          currency: 'EUR',
          server: 'EUW',
        },
      ],
    ] as const) {
      const result = await callTool(name, args, { fx, live });
      expect(result.content[0]!.text).toContain(
        JSON.stringify(result.structuredContent),
      );
      expect(result.content[0]!.text).toContain('"bookUrl":"https://duoly.gg/');
      if (result.structuredContent.bookUrl) {
        const link = new URL(String(result.structuredContent.bookUrl));
        expect(
          [...link.searchParams.keys()].every((key) =>
            ['game', 'service', 'agent', 'rank', 'region', 'qty'].includes(key),
          ),
        ).toBe(true);
        expect(link.hash).toBe('#modes-h');
      }
    }
  });
  it('compares USD budgets against converted totals and keeps exact cent boundaries', async () => {
    const exact = await callTool(
      'find_session',
      {
        game: 'val',
        goal: 'coaching',
        budget: 12.99,
        currency: 'EUR',
        quantity: 1,
        server: 'EU',
      },
      { fx },
    );
    expect(exact.structuredContent.matches).toHaveLength(3);
    const usd = await callTool(
      'find_session',
      {
        game: 'val',
        goal: 'coaching',
        budget: 14,
        currency: 'USD',
        quantity: 1,
        server: 'EU',
      },
      { fx },
    );
    expect(usd.structuredContent.matches).toEqual([]);
    const mc = await callTool(
      'find_session',
      { game: 'mc', goal: 'coaching' },
      { fx },
    );
    expect(mc.structuredContent.missingInputs).toContain('edition');
    for (const game of games()) {
      const result = await callTool('find_session', { game: game.id }, { fx });
      expect(
        (result.structuredContent.matches as Array<{ category: string }>).some(
          (s) => s.category === 'gg',
        ),
      ).toBe(false);
    }
  });
  it('bounds structured tool output to 64 KiB', async () => {
    await expect(
      callTool(
        'get_quote',
        {
          game: 'val',
          service: 'duo2',
          rank: 'Platinum',
          server: 'EU',
          quantity: 1,
          currency: 'EUR',
        },
        { fx: async () => ({ ...(await fx()), date: 'x'.repeat(65536) }) },
      ),
    ).rejects.toThrow('Tool response exceeds the size limit.');
  });
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
    expect(count).toBeGreaterThanOrEqual(398);
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
  it('leads with finding and booking a teammate or coach', () => {
    expect(INSTRUCTIONS).toContain('Call find_session first');
    expect(INSTRUCTIONS).toContain('Share bookUrl');
    expect(INSTRUCTIONS).not.toMatch(/[&\u2013\u2014]/);
  });
  it('omits zero online counts in both text and structured content', async () => {
    const result = await callTool(
      'get_availability',
      { game: 'lol' },
      {
        live: async () => ({
          ...(await live()),
          stats: { ...(await live()).stats, onlineByGame: { lol: 0, val: 3 } },
        }),
      },
    );
    expect(result.structuredContent).not.toHaveProperty('online');
    expect(result.structuredContent).not.toHaveProperty('onlineByGame');
    expect(result.structuredContent).not.toHaveProperty('label');
    expect(result.content[0]!.text).not.toContain('online');
    expect(result.content[0]!.text).not.toMatch(/nobody|"online":0|"lol":0/);
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
