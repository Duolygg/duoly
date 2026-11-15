import { describe, expect, it } from 'vitest';
import {
  GAMES,
  GAME_OWNERS,
  GAME_OWNERS_TEXT,
} from '../../src/design-reference/lib/games.js';

// The footer and Terms "not affiliated with" disclaimers are built from each game's owners,
// so a game added without its owners would silently drop out of them.
describe('game owners for the legal disclaimers', () => {
  it('names the owners of every game Duoly sells', () => {
    for (const game of GAMES as { id: string; owners?: string[] }[]) {
      if (game.id === 'social') continue;
      expect(game.owners?.length, game.id).toBeGreaterThan(0);
    }
  });
  it('lists each owner once, including the newer games', () => {
    expect(new Set(GAME_OWNERS).size).toBe(GAME_OWNERS.length);
    for (const owner of ['Psyonix', 'KRAFTON', 'Embark Studios', 'Marvel'])
      expect(GAME_OWNERS_TEXT).toContain(owner);
  });
});
