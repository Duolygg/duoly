import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_HUBS } from '../../src/content/game-hubs';

/*
 * The teammates row on a game hub (plan step 4). It is one additive section: nothing else on a
 * hub page moves, the row renders itself away when the launch flag is off or no published
 * profile features that game, and the heading above it never promises more than the cards show.
 */
const hub = readFileSync('src/components/seo/GameHub.astro', 'utf8');
const row = readFileSync('src/components/teammates/TeammatesRow.astro', 'utf8');

describe('the hub keeps its own shape', () => {
  it('adds the row once, after the steps and before the comparison', () => {
    expect(hub.match(/<TeammatesRow /g)).toHaveLength(1);
    expect(hub.indexOf('<TeammatesRow ')).toBeGreaterThan(
      hub.indexOf('</Steps>'),
    );
    expect(hub.indexOf('<TeammatesRow ')).toBeLessThan(
      hub.indexOf('<HubDecide'),
    );
    expect(hub).toContain('<TeammatesRow game={game.id} />');
  });
  it('still carries every section it carried before', () => {
    for (const tag of [
      '<SeoHero',
      '<Prices',
      '<Steps',
      '<HubDecide',
      '<Topics',
      '<Faq',
      '<ClosingCta',
      '<StickyBook',
    ])
      expect(hub).toContain(tag);
  });
  it('reaches every game a teammate can be approved for', () => {
    /* The real roster today is lol, mc, cs2, pu, tft and wow; each one needs a finished hub
       for the row to have a page to sit on. */
    const slugs = GAME_HUBS.map((page) => page.gameSlug);
    for (const slug of [
      'league-of-legends',
      'minecraft',
      'counter-strike-2',
      'pokemon-unite',
      'teamfight-tactics',
      'world-of-warcraft',
    ])
      expect(slugs).toContain(slug);
  });
});

describe('the row itself', () => {
  it('costs nothing and shows nothing before launch', () => {
    expect(row).toContain('publicProfilesEnabled()');
    expect(row).toMatch(
      /publicProfilesEnabled\(\)\s*\?\s*await loadTeammateCards/,
    );
    expect(row).toContain('{cards.length > 0 && (');
  });
  it('asks for at most six cards and links the filtered directory', () => {
    expect(row).toContain('limit: Math.min(6, limit)');
    expect(row).toContain('href={`/teammates?game=${game}`}');
  });
  it('only claims verified ranks when a card carries one', () => {
    expect(row).toContain('cards.some((card) => card.rank)');
    expect(row).toContain('See who is online right now.');
  });
});
