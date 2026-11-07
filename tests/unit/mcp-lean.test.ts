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
it('keeps exact discovery lean with explicit bundle savings', async () => {
  const result = await callTool(
    'find_session',
    { game: 'lol', rank: 'Gold', server: 'EUW', quantity: 3 },
    { fx },
  );
  expect(result.content).toHaveLength(1);
  expect(result.content[0]!.text.length).toBeLessThan(1500);
  expect(JSON.stringify(result.structuredContent).length).toBeLessThan(3000);
  expect(result.content[0]!.text).toMatch(/saves EUR .*10% bundle discount/);
  expect(result.content[0]!.text).not.toContain('{');
  expect(result._meta).toHaveProperty('gg.duoly/card');
});
it('excludes every social and gg service across every game catalog and discovery output', async () => {
  for (const game of games()) {
    const excluded = servicesFor(game.id).modes.filter((m: { cat: string }) =>
      ['social', 'gg'].includes(m.cat),
    );
    const results = await Promise.all([
      callTool('list_services', { game: game.id }),
      callTool('find_session', { game: game.id }, { fx }),
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
