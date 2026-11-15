import { describe, expect, it } from 'vitest';
import { GAME_PICKS } from '../../src/contracts/game-picks';
import {
  hasPickCatalog,
  hasRoleCatalog,
  pickDisplayName,
  pickDisplayNames,
  pickMonogram,
  picksLabel,
  resolvePick,
  resolveRole,
  searchPicks,
  squashLabel,
} from '../../src/contracts/game-picks-resolve';
import { GAME_IDS } from '../../src/design-reference/lib/games';

/*
 * The catalog is generated (scripts/build-game-picks.mjs) and the generator refuses to write a
 * file that breaks these rules. The point of repeating them here is that the shipped file is what
 * the application loads: a hand edit, a bad merge or a rebuild from a changed input all have to
 * fail a test rather than reach teammate_game_ranks and be rejected by Postgres at save time.
 */
const games = Object.entries(GAME_PICKS);
/** teammate_public_labels_valid(), restated: this is what the database will accept. */
const DENIED =
  /(?<![a-z0-9_])(pass(word|wort)?|paypal|venmo|cash ?app|iban|crypto|whatsapp|telegram|snapchat|discord)(?![a-z0-9_])/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('the generated character catalog', () => {
  it('covers every game on Duoly and nothing that is not one', () => {
    const social = GAME_IDS.filter((id: string) => id !== 'social');
    expect(Object.keys(GAME_PICKS).sort()).toEqual([...social].sort());
  });
  it('ships ids Postgres will store: slug shaped, 24 characters or fewer, no denied word', () => {
    for (const [game, catalog] of games)
      for (const option of catalog.options) {
        expect(option.id, `${game} ${option.id}`).toMatch(SLUG);
        expect(option.id.length, `${game} ${option.id}`).toBeLessThanOrEqual(
          24,
        );
        expect(DENIED.test(option.id), `${game} ${option.id}`).toBe(false);
        expect(option.name.length, `${game} ${option.id}`).toBeGreaterThan(0);
      }
  });
  /* Apex Legends has a Legend called Crypto, and "crypto" is on the database deny list, so that
     one id is spelled past it while the name a visitor reads stays "Crypto". */
  it('spells Apex past the deny list without changing what a visitor reads', () => {
    expect(resolvePick('apex', 'crypto')?.id).toBe('cryptolegend');
    expect(pickDisplayName('apex', 'cryptolegend')).toBe('Crypto');
  });
  it('stores roles as names the database will take', () => {
    for (const [game, catalog] of games)
      for (const role of catalog.roles) {
        expect(role.id, `${game} ${role.id}`).toMatch(SLUG);
        expect(role.name.length, `${game} ${role.name}`).toBeLessThanOrEqual(
          24,
        );
        expect(DENIED.test(role.name), `${game} ${role.name}`).toBe(false);
        expect(role.name).not.toMatch(/[@:/\\.]/);
      }
  });
  it('gives every id and every resolvable spelling to exactly one character per game', () => {
    for (const [game, catalog] of games) {
      const ids = catalog.options.map((o) => o.id);
      expect(new Set(ids).size, game).toBe(ids.length);
      const owner = new Map<string, string>();
      for (const option of catalog.options)
        for (const spelling of [
          option.id,
          option.name,
          ...(option.aliases ?? []),
        ]) {
          const key = squashLabel(spelling);
          expect(owner.get(key) ?? option.id, `${game} ${spelling}`).toBe(
            option.id,
          );
          owner.set(key, option.id);
        }
    }
  });
  it('points every character at a filter the game actually offers', () => {
    for (const [game, catalog] of games) {
      const filters = new Set(catalog.filters.map((f) => f.id));
      for (const option of catalog.options)
        if (option.filter)
          expect(filters.has(option.filter), `${game} ${option.id}`).toBe(true);
      /* A role filter has to be one of the game's own roles, so a tab and a role chip can never
         disagree about what Sentinel means. */
      if (catalog.filterKey === 'role') {
        const roles = new Set(catalog.roles.map((r) => r.id));
        for (const filter of catalog.filters)
          expect(roles.has(filter.id), `${game} ${filter.id}`).toBe(true);
      }
      if (catalog.filterKey === null) expect(catalog.filters).toEqual([]);
    }
  });
  it('knows which games have lists and which keep free text', () => {
    for (const game of [
      'lol',
      'wr',
      'val',
      'ow',
      'mr',
      'wow',
      'dota',
      'dl',
      'apex',
      'r6',
      'pu',
    ])
      expect(hasPickCatalog(game), game).toBe(true);
    for (const game of [
      'tft',
      'fn',
      'cod',
      'pubg',
      'rl',
      'arc',
      'mc',
      'cs2',
      'fc',
    ])
      expect(hasPickCatalog(game), game).toBe(false);
    for (const game of [
      'lol',
      'wr',
      'val',
      'cs2',
      'r6',
      'ow',
      'mr',
      'apex',
      'pu',
      'fc',
      'dota',
      'wow',
    ])
      expect(hasRoleCatalog(game), game).toBe(true);
    for (const game of ['dl', 'tft', 'fn', 'cod', 'pubg', 'rl', 'arc', 'mc'])
      expect(hasRoleCatalog(game), game).toBe(false);
    /* Social is not in the catalog at all: no lanes, no characters. */
    expect(hasPickCatalog('social')).toBe(false);
    expect(hasRoleCatalog('social')).toBe(false);
  });
  it('uses the word the game itself uses for a character', () => {
    expect(picksLabel('lol')).toBe('Champions');
    expect(picksLabel('val')).toBe('Agents');
    expect(picksLabel('ow')).toBe('Heroes');
    expect(picksLabel('apex')).toBe('Legends');
    expect(picksLabel('r6')).toBe('Operators');
    expect(picksLabel('pu')).toBe('Pokémon');
    expect(picksLabel('wow')).toBe('Classes and specs');
    expect(picksLabel('mc')).toBe('Mains');
  });
  it('files Siege by side and League by nothing, because combat classes are not lanes', () => {
    expect(GAME_PICKS.r6!.filterKey).toBe('side');
    expect(GAME_PICKS.r6!.filters.map((f) => f.name)).toEqual([
      'Attack',
      'Defense',
    ]);
    expect(GAME_PICKS.lol!.filterKey).toBe(null);
    expect(GAME_PICKS.wr!.filterKey).toBe(null);
    expect(GAME_PICKS.wow!.filters.map((f) => f.id)).toEqual([
      'tank',
      'healer',
      'dps',
    ]);
  });
});

describe('searching the way a player types', () => {
  const found = (game: string, query: string) =>
    searchPicks(game, query).map((o) => o.name);
  it('ignores punctuation and case', () => {
    expect(found('val', 'kayo')).toEqual(['KAY/O']);
    expect(found('val', 'KAY/O')).toEqual(['KAY/O']);
    expect(found('ow', 'soldier')).toEqual(['Soldier: 76']);
    expect(found('ow', 'dva')).toEqual(['D.Va']);
    expect(found('pu', 'mr mime')).toEqual(['Mr. Mime']);
  });
  it('finds a character by the nickname players use', () => {
    expect(found('lol', 'mundo')).toEqual(['Dr. Mundo']);
    expect(found('lol', 'wukong')).toEqual(['Wukong']);
    expect(found('lol', 'monkey king')).toEqual(['Wukong']);
    expect(found('wow', 'aff lock')).toEqual(['Affliction Warlock']);
    expect(found('apex', 'crypto')).toEqual(['Crypto']);
  });
  it('puts what the query starts before what merely contains it', () => {
    const names = found('lol', 'vi');
    expect(names.slice(0, 3)).toEqual(['Vi', 'Viego', 'Viktor']);
    /* Anivia and Sivir hold "vi" in the middle, so they come after the three that open with it. */
    expect(names.indexOf('Anivia')).toBeGreaterThan(names.indexOf('Viktor'));
  });
  it('returns the whole list for an empty query and filters without deselecting', () => {
    expect(searchPicks('val', '')).toHaveLength(GAME_PICKS.val!.options.length);
    const sentinels = searchPicks('val', '', 'sentinel');
    expect(sentinels.length).toBeGreaterThan(0);
    for (const option of sentinels) expect(option.filter).toBe('sentinel');
    /* The filter is a view of the list; nothing about it touches a selection. */
    expect(searchPicks('val', 'jett', 'sentinel')).toEqual([]);
  });
  it('never crosses games, so a League id is not a Siege operator', () => {
    expect(resolvePick('r6', 'ahri')).toBe(null);
    expect(resolvePick('lol', 'ahri')?.id).toBe('ahri');
    /* League and Wild Rift do share ids, and looking up by game is what makes that safe. */
    expect(resolvePick('wr', 'ahri')?.name).toBe('Ahri');
  });
});

describe('the display adapter', () => {
  it('turns an id into a name', () => {
    expect(pickDisplayName('lol', 'dr-mundo')).toBe('Dr. Mundo');
    expect(pickDisplayName('ow', 'soldier-76')).toBe('Soldier: 76');
    expect(pickDisplayName('val', 'kayo')).toBe('KAY/O');
  });
  /* The four rows in production hold display names written before the catalog existed. */
  it('leaves a legacy name reading exactly as it did', () => {
    for (const name of [
      'Hecarim',
      'Milio',
      'Nami',
      'Nidalee',
      'Taliyah',
      'Yuumi',
    ])
      expect(pickDisplayName('lol', name)).toBe(name);
    expect(pickDisplayName('wow', 'Holy Priest')).toBe('Holy Priest');
    expect(resolveRole('lol', 'Jungle')).toBe('Jungle');
    expect(resolveRole('wow', 'Healer')).toBe('Healer');
  });
  it('resolves an alias and tidies the spelling of a name', () => {
    expect(pickDisplayName('lol', 'heca')).toBe('Hecarim');
    expect(pickDisplayName('lol', 'DRMUNDO')).toBe('Dr. Mundo');
    expect(resolveRole('lol', 'jungle')).toBe('Jungle');
  });
  it('shows a value it does not know as the text it is, never an empty space', () => {
    expect(pickDisplayName('lol', 'Some Old Pick')).toBe('Some Old Pick');
    expect(pickDisplayName('mc', 'Redstone')).toBe('Redstone');
    expect(resolveRole('lol', 'Shotcaller')).toBe(null);
    expect(resolveRole('mc', 'Builder')).toBe(null);
  });
  it('keeps the order of a list it rewrites', () => {
    expect(
      pickDisplayNames('lol', ['yuumi', 'hecarim', 'Not A Champion']),
    ).toEqual(['Yuumi', 'Hecarim', 'Not A Champion']);
  });
});

describe('the mark on a tile', () => {
  it('reads two letters, so ten champions beginning with A are ten different tiles', () => {
    expect(pickMonogram('lol', 'Aatrox')).toBe('Aa');
    /* Naafiri is earlier in the roster and took Na, so Nami reads Nam. */
    expect(pickMonogram('lol', 'Naafiri')).toBe('Na');
    expect(pickMonogram('lol', 'Nami')).toBe('Nam');
    expect(pickMonogram('lol', 'Ahri')).toBe('Ah');
    expect(pickMonogram('lol', 'Akali')).toBe('Ak');
    expect(pickMonogram('lol', 'Dr. Mundo')).toBe('DM');
    expect(pickMonogram('ow', 'Soldier: 76')).toBe('S7');
    expect(pickMonogram('val', 'KAY/O')).toBe('KO');
    expect(pickMonogram('wow', 'Affliction Warlock')).toBe('AW');
    expect(pickMonogram('lol', 'Vi')).toBe('Vi');
  });
  /* Two tiles reading Br said nothing about either of them, so the second one grows a letter. */
  it('grows a letter rather than repeating one, by id or by name', () => {
    expect(pickMonogram('val', 'breach')).toBe('Br');
    expect(pickMonogram('val', 'Brimstone')).toBe('Bri');
  });
  /* Ashe as As and Aurelion Sol as AS are one mark in a grid, so case does not make two. */
  it('tells every character in a game apart, whatever the case', () => {
    for (const [game, catalog] of games) {
      const marks = catalog.options.map((o) =>
        pickMonogram(game, o.id).toLowerCase(),
      );
      expect(new Set(marks).size, game).toBe(marks.length);
    }
  });
  it('stays two or three letters, whatever the name is made of', () => {
    for (const [game, catalog] of games)
      for (const option of catalog.options) {
        const mark = pickMonogram(game, option.id);
        expect(mark.length, `${game} ${option.name}`).toBeGreaterThan(1);
        expect(mark.length, `${game} ${option.name}`).toBeLessThan(4);
      }
  });
  /* A name whose first word is one letter still gets a mark of two: K alone said nothing. */
  it('reads a one letter first word with the word after it', () => {
    expect(pickMonogram('lol', "K'Sante")).toBe('KSa');
    expect(pickMonogram('lol', 'Aurelion Sol')).toBe('ASo');
  });
  /* A value stored before the catalog existed is still a tile somebody has to recognise. */
  it('marks a value the catalog has never heard of from its own text', () => {
    expect(pickMonogram('lol', 'Some Old Pick')).toBe('SP');
    expect(pickMonogram('lol', 'Zephyr')).toBe('Ze');
  });
});
