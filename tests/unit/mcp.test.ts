import { describe, expect, it } from 'vitest';
import { games, services } from '../../src/server/mcp/catalog';

describe('MCP catalog', () => {
  it('lists real games with canonical links and excludes Social', () => {
    expect(games()).toHaveLength(20);
    expect(games().some((g) => g.id === 'social')).toBe(false);
    expect(games().find((g) => g.id === 'val')).toMatchObject({
      slug: 'valorant',
      url: 'https://duoly.gg/games/valorant',
    });
  });
  it('returns the quote requirements for pricing-supported services', () => {
    expect(services('val').find((s) => s.id === 'duo2')).toMatchObject({
      unit: 'game',
      regions: expect.arrayContaining(['EU']),
      ranks: expect.arrayContaining(['Platinum']),
      requiredInputs: expect.arrayContaining(['rank', 'server']),
    });
    expect(() => services('social')).toThrow(/list_games/);
  });
});
