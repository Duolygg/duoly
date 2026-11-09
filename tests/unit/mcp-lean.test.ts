import { expect, it } from 'vitest';
import { callTool } from '../../src/server/mcp/tools';
import { games, services } from '../../src/server/mcp/catalog';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';
const fx = async () => ({
  rate: 1.08,
  source: 'fallback' as const,
  date: '2026-11-07',
  fetchedAt: 0,
});
it('keeps exact discovery lean with explicit quantity savings', async () => {
  const result = await callTool(
    'find_session',
    { game: 'lol', rank: 'Gold', server: 'EUW', quantity: 5 },
    { fx },
  );
  expect(result.content).toHaveLength(1);
  expect(result.content[0]!.text.length).toBeLessThan(1500);
  expect(JSON.stringify(result.structuredContent).length).toBeLessThan(3000);
  expect(result.content[0]!.text).toMatch(/saves EUR .*20% off for 5/);
  expect(result.content[0]!.text).not.toContain('{');
  expect(result._meta).toHaveProperty('gg.duoly/card');
});
it('labels representative quantity savings without inferring a rank', async () => {
  const result = await callTool(
    'find_session',
    { game: 'lol', quantity: 5 },
    { fx },
  );
  const matches = result.structuredContent.matches as Array<
    Record<string, unknown>
  >;
  expect(matches[0]!.representativePrice).toMatchObject({
    rank: 'Gold',
    quantity: 5,
    bundleDiscountPercent: 20,
    savingMinor: 499,
  });
  expect(result.content[0]!.text).toMatch(
    /Example Gold.*saves EUR 4.99, 20% off for 5/,
  );
});
it('distinguishes rank-priced tiers with a calculated typical price', async () => {
  const result = await callTool('list_services', { game: 'lol' });
  const tiers = (
    result.structuredContent.services as Array<Record<string, unknown>>
  ).slice(0, 2);
  for (const s of tiers) {
    expect(s.priceNote).toBe("Price scales with the customer's rank.");
    expect(s.typicalPrice).toMatchObject({
      rank: 'Gold',
      quantity: 1,
      currency: 'EUR',
    });
  }
  expect(tiers[0]!.typicalPrice).not.toEqual(tiers[1]!.typicalPrice);
});
it('excludes every social and gg service across every game catalog and discovery output', async () => {
  for (const game of games()) {
    const excluded = servicesFor(game.id).modes.filter((m: { cat: string }) =>
      ['social', 'gg'].includes(m.cat),
    );
    const results = await Promise.all([
      callTool('list_games', {}),
      callTool(
        'get_availability',
        { game: game.id },
        {
          live: async () => ({
            onlineNow: 0,
            stats: null,
            recentMatches: [],
            teammates: [],
          }),
        },
      ),
      callTool('list_services', { game: game.id }),
      callTool('find_session', { game: game.id }, { fx }),
      ...services(game.id).flatMap((s) => [
        callTool(
          'create_booking_link',
          { game: game.id, service: s.id },
          { fx },
        ),
        callTool(
          'get_quote',
          {
            game: game.id,
            service: s.id,
            quantity: 3,
            currency: 'EUR',
            server: s.regions[0] ?? 'my world',
            ...(s.ranks.length ? { rank: s.ranks[0] } : {}),
            ...(game.id === 'mc' ? { edition: 'Java' } : {}),
          },
          { fx },
        ),
      ]),
    ]);
    for (const mode of excluded) {
      expect(services(game.id).some((s) => s.id === mode.id)).toBe(false);
      for (const result of results) {
        expect(JSON.stringify(result)).not.toContain(`"id":"${mode.id}"`);
        expect(JSON.stringify(result)).not.toContain(mode.title);
      }
      for (const name of ['get_quote', 'create_booking_link'] as const) {
        await expect(
          callTool(
            name,
            {
              game: game.id,
              service: mode.id,
              server: 'EUW',
              quantity: 1,
              currency: 'EUR',
            },
            { fx },
          ),
        ).rejects.toThrow();
      }
    }
  }
});
