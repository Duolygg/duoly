import { describe, expect, it } from 'vitest';
import {
  checkProfileGames,
  type StoredGame,
} from '../../src/server/teammates/settings-games';

/*
 * The server check behind the pickers (src/server/teammates/settings-games.ts). The pickers only
 * offer what the catalog holds, so these cases are about a request that did not come from them,
 * and about the handful of rows written before the catalog existed.
 */
const check = (games: StoredGame[], before: StoredGame[] | null = []) =>
  checkProfileGames(games, before);
const ok = (games: StoredGame[], before: StoredGame[] | null = []) => {
  const result = check(games, before);
  if (!result.ok) throw new Error('expected a pass, got: ' + result.error);
  return result.games;
};
const failure = (games: StoredGame[], before: StoredGame[] | null = []) => {
  const result = check(games, before);
  if (result.ok) throw new Error('expected a failure');
  return result.error;
};

describe('saving roles and picks', () => {
  it('stores a pick as its catalog id and a role as the spelling the game uses', () => {
    expect(
      ok([
        {
          game: 'lol',
          roles: ['jungle', 'SUPPORT'],
          picks: ['Hecarim', 'yuumi'],
        },
      ]),
    ).toEqual([
      {
        game: 'lol',
        roles: ['Jungle', 'Support'],
        picks: ['hecarim', 'yuumi'],
      },
    ]);
  });
  it('takes an official name, an alias and an id as the same character', () => {
    expect(
      ok([{ game: 'val', roles: [], picks: ['KAY/O', 'brim', 'cypher'] }])[0]!
        .picks,
    ).toEqual(['kayo', 'brimstone', 'cypher']);
    expect(ok([{ game: 'ow', roles: [], picks: ['D.Va'] }])[0]!.picks).toEqual([
      'dva',
    ]);
    expect(
      ok([{ game: 'wow', roles: ['healer'], picks: ['Holy Priest'] }])[0],
    ).toEqual({
      game: 'wow',
      roles: ['Healer'],
      picks: ['holy-priest'],
    });
  });
  it('refuses a character from the wrong game and names the value', () => {
    const error = failure([{ game: 'r6', roles: [], picks: ['ahri'] }]);
    expect(error).toContain('Rainbow Six Siege X');
    expect(error).toContain('"ahri"');
    expect(error).toContain('Operators');
    /* The same id on the game that does have it is fine, which is what scoping by game buys. */
    expect(ok([{ game: 'lol', roles: [], picks: ['ahri'] }])[0]!.picks).toEqual(
      ['ahri'],
    );
  });
  it('refuses a role the game does not offer and names the value', () => {
    const error = failure([{ game: 'val', roles: ['Jungle'], picks: [] }]);
    expect(error).toContain('Valorant');
    expect(error).toContain('"Jungle"');
    expect(error).toContain('roles');
  });
  it('refuses a value nobody has ever stored, however safe it looks', () => {
    expect(
      failure([{ game: 'lol', roles: [], picks: ['Brand New Champion'] }]),
    ).toContain('"Brand New Champion"');
  });
  /* The rows written before the catalog existed have to survive a save untouched. */
  it('keeps a value that is already stored for that game', () => {
    const before: StoredGame[] = [
      { game: 'lol', roles: ['Shotcaller'], picks: ['Some Old Pick'] },
    ];
    expect(
      ok(
        [
          {
            game: 'lol',
            roles: ['Shotcaller', 'jungle'],
            picks: ['Some Old Pick', 'nami'],
          },
        ],
        before,
      )[0],
    ).toEqual({
      game: 'lol',
      roles: ['Shotcaller', 'Jungle'],
      picks: ['Some Old Pick', 'nami'],
    });
    /* Stored for one game is not stored for another. */
    expect(
      failure([{ game: 'val', roles: [], picks: ['Some Old Pick'] }], before),
    ).toContain('"Some Old Pick"');
  });
  it('behaves as saving did before when it cannot tell old from new', () => {
    expect(
      ok(
        [{ game: 'lol', roles: ['Shotcaller'], picks: ['Some Old Pick'] }],
        null,
      )[0],
    ).toEqual({ game: 'lol', roles: ['Shotcaller'], picks: ['Some Old Pick'] });
  });
  it('keeps free text for a game we ship no list for', () => {
    expect(
      ok([{ game: 'mc', roles: ['Builder'], picks: ['Redstone'] }])[0],
    ).toEqual({
      game: 'mc',
      roles: ['Builder'],
      picks: ['Redstone'],
    });
    /* Counter-Strike has roles and no characters, so one side is checked and the other is not. */
    expect(ok([{ game: 'cs2', roles: ['awper'], picks: ['Any'] }])[0]).toEqual({
      game: 'cs2',
      roles: ['AWPer'],
      picks: ['Any'],
    });
  });
  it('collapses duplicates, however they were spelled', () => {
    expect(
      ok([
        {
          game: 'lol',
          roles: ['Jungle', 'jungle'],
          picks: ['Nami', 'nami', 'NAMI'],
        },
      ])[0],
    ).toEqual({ game: 'lol', roles: ['Jungle'], picks: ['nami'] });
    expect(
      ok([{ game: 'mc', roles: [], picks: ['Redstone', 'redstone'] }])[0]!
        .picks,
    ).toEqual(['Redstone']);
  });
  it('holds the caps and keeps the first of each', () => {
    expect(
      ok([
        {
          game: 'lol',
          roles: ['Top', 'Jungle', 'Mid', 'ADC'],
          picks: ['ahri', 'nami', 'vi', 'thresh', 'yuumi', 'hecarim'],
        },
      ])[0],
    ).toEqual({
      game: 'lol',
      roles: ['Top', 'Jungle', 'Mid'],
      picks: ['ahri', 'nami', 'vi', 'thresh', 'yuumi'],
    });
  });
  it('drops blank labels instead of storing them', () => {
    expect(
      ok([{ game: 'lol', roles: ['', '  '], picks: [' nami '] }])[0],
    ).toEqual({
      game: 'lol',
      roles: [],
      picks: ['nami'],
    });
  });
  it('leaves every other game alone and keeps the order it was given', () => {
    expect(
      ok([
        { game: 'val', roles: [], picks: ['omen'] },
        { game: 'lol', roles: [], picks: ['nami'] },
      ]).map((g) => g.game),
    ).toEqual(['val', 'lol']);
  });
  it('accepts Social with nothing on it', () => {
    expect(ok([{ game: 'social', roles: [], picks: [] }])[0]).toEqual({
      game: 'social',
      roles: [],
      picks: [],
    });
  });
});
