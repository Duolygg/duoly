/*
 * Reading and searching the generated catalog (src/contracts/game-picks.ts).
 *
 * Browser and server safe: no node imports, no dynamic import, no fetch. The settings pickers,
 * the server validation and the display adapter all go through these functions, so a stored value
 * means the same thing in all three places.
 *
 * Storage, in one sentence: a role is stored as its name, a pick as its catalog id, and a value
 * from before the catalog existed still resolves by name or alias. Nothing public ever shows an
 * id, because every read path calls pickDisplayName().
 */
import {
  GAME_PICKS,
  type GamePickCatalog,
  type PickOption,
} from './game-picks';

export { GAME_PICKS };
export type { GamePickCatalog, PickOption };

/**
 * The key two spellings of the same thing share: accents folded, then everything that is not a
 * letter or a digit dropped. "Dr. Mundo", "dr-mundo" and "DRMUNDO" all land on "drmundo", which
 * is how a legacy name or a typed alias finds its id. Kept in step with squash() in
 * scripts/build-game-picks.mjs, which fails the build if two characters in one game collide here.
 */
export function squashLabel(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** The catalog for a game, or null when we ship none for it (Fortnite, Minecraft, Social). */
export function pickCatalog(game: string): GamePickCatalog | null {
  return GAME_PICKS[game] ?? null;
}
/** True when this game offers a character list, so the picker replaces free text. */
export const hasPickCatalog = (game: string): boolean =>
  (GAME_PICKS[game]?.options.length ?? 0) > 0;
/** True when this game offers a role list, so role chips replace free text. */
export const hasRoleCatalog = (game: string): boolean =>
  (GAME_PICKS[game]?.roles.length ?? 0) > 0;
/**
 * What this game calls a character: Champions, Agents, Heroes, Legends, Operators, Pokémon,
 * classes and specs. A game with no character list has no word of its own for one, so it gets
 * "Mains", which is what a player would say.
 */
export const picksLabel = (game: string): string =>
  hasPickCatalog(game) ? GAME_PICKS[game]!.label : 'Mains';

/* One index per game, built the first time something asks and then kept. Every spelling of a
   character (its id, its official name, each alias) points at the one option. */
const indexes = new Map<string, Map<string, PickOption>>();
function pickIndex(game: string): Map<string, PickOption> {
  let index = indexes.get(game);
  if (index) return index;
  index = new Map();
  for (const option of GAME_PICKS[game]?.options ?? [])
    for (const spelling of [
      option.id,
      option.name,
      ...(option.aliases ?? []),
    ]) {
      const key = squashLabel(spelling);
      if (key && !index.has(key)) index.set(key, option);
    }
  indexes.set(game, index);
  return index;
}

/**
 * The catalog character a stored or typed value means, or null when the catalog has never heard
 * of it. Scoped by game on purpose: League and Wild Rift share ids, and a League id on a Siege
 * profile is a mistake rather than a match.
 */
export function resolvePick(game: string, value: string): PickOption | null {
  const key = squashLabel(String(value ?? ''));
  return key ? (pickIndex(game).get(key) ?? null) : null;
}
/**
 * What a visitor reads for a stored pick: the catalog name for an id or a legacy name, and the
 * stored text itself for anything the catalog does not know, which is what the page showed before
 * this catalog existed. Never an id.
 */
export function pickDisplayName(game: string, value: string): string {
  return resolvePick(game, value)?.name ?? value;
}
/** pickDisplayName() over a whole list, keeping its order. */
export const pickDisplayNames = (
  game: string,
  values: readonly string[],
): string[] => values.map((value) => pickDisplayName(game, value));

/* The same index for roles, which are stored as names. "jungle" and "Jungle" are the same role. */
const roleIndexes = new Map<string, Map<string, string>>();
function roleIndex(game: string): Map<string, string> {
  let index = roleIndexes.get(game);
  if (index) return index;
  index = new Map();
  for (const role of GAME_PICKS[game]?.roles ?? []) {
    index.set(squashLabel(role.name), role.name);
    index.set(squashLabel(role.id), role.name);
  }
  roleIndexes.set(game, index);
  return index;
}
/** The role name this game spells that way, or null when the game does not offer the role. */
export function resolveRole(game: string, value: string): string | null {
  const key = squashLabel(String(value ?? ''));
  return key ? (roleIndex(game).get(key) ?? null) : null;
}

/**
 * Search inside one game, the way a player types: punctuation and case are ignored, so "kayo"
 * finds KAY/O, "soldier" finds Soldier: 76, "mundo" finds Dr. Mundo and "aff lock" finds
 * Affliction Warlock. Names that start with what was typed come first, which is what makes a
 * three-letter query land on the character the teammate meant.
 *
 * `filter` keeps only characters of that role or side; an empty query with no filter is the whole
 * list in catalog order. Filtering is a view: it never changes what is selected.
 */
export function searchPicks(
  game: string,
  query: string,
  filter: string | null = null,
): PickOption[] {
  const all = GAME_PICKS[game]?.options ?? [];
  const inFilter = filter ? all.filter((o) => o.filter === filter) : all;
  const key = squashLabel(query ?? '');
  if (!key) return inFilter;
  const starts: PickOption[] = [];
  const contains: PickOption[] = [];
  for (const option of inFilter) {
    let best = -1;
    for (const spelling of [
      option.name,
      option.id,
      ...(option.aliases ?? []),
    ]) {
      const at = squashLabel(spelling).indexOf(key);
      if (at < 0) continue;
      best = best < 0 ? at : Math.min(best, at);
      if (best === 0) break;
    }
    if (best === 0) starts.push(option);
    else if (best > 0) contains.push(option);
  }
  return [...starts, ...contains];
}

/**
 * The mark on a character tile, and no two in one game alike.
 *
 * Two letters, because one would leave ten League champions sharing an "A" and identifying none
 * of them: the initials of a name made of several words, so "Dr. Mundo" reads DM and "KAY/O"
 * reads KO, and the first two letters of a single word, so "Aatrox" reads Aa. Where that would
 * repeat a mark already taken in the same game the name grows a third letter, which is how
 * Valorant gets Br and Bri rather than two tiles reading Br. Taken is case insensitive, because
 * Ashe as As and Aurelion Sol as AS are one mark in a grid and not two.
 *
 * Every spelling comes out of the character's own name, so the mark is deterministic: the same
 * catalog always produces the same marks, in catalog order, and tests/unit/game-picks-catalog
 * holds every game to the uniqueness.
 */
const upper = (letters: string[]): string => letters.join('').toUpperCase();
const titled = (letters: string[]): string =>
  (letters[0] ?? '').toUpperCase() + letters.slice(1).join('').toLowerCase();

/** The marks this name would take, best first. */
function monogramCandidates(name: string): string[] {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const out: string[] = [];
  const add = (mark: string) => {
    /* One letter identifies nothing, and K'Sante would otherwise get it. */
    if (mark.length > 1 && !out.includes(mark)) out.push(mark);
  };
  const first = [...(words[0] ?? name)];
  const last = [...(words[words.length - 1] ?? '')];
  /* The whole name without its punctuation, for a first word of one letter. */
  const joined = [...(words.join('') || name)];
  if (words.length > 1) {
    /* Several words: their initials, which is the spelling a player would write themselves. */
    add(upper([first[0] ?? '', last[0] ?? '']));
    add(upper([first[0] ?? '', last[0] ?? '']) + (last[1] ?? '').toLowerCase());
  }
  add(titled(first.slice(0, 2)));
  add(titled(first.slice(0, 3)));
  add(titled(joined.slice(0, 2)));
  add(titled(joined.slice(0, 3)));
  /* Still taken: the first letter with each later one, which is where Karma and Karthus end up
     once the prefixes are spoken for. */
  for (let at = 2; at < first.length; at++)
    add(titled([first[0] ?? '', first[at] ?? '']));
  if (words.length > 1) add(upper(last.slice(0, 2)));
  add(titled(joined.slice(0, 4)));
  return out.length ? out : [([...name][0] ?? '').toUpperCase()];
}

const marks = new Map<string, Map<string, string>>();
/** Every mark in one game, by option id, assigned in catalog order. */
function gameMonograms(game: string): Map<string, string> {
  let byId = marks.get(game);
  if (byId) return byId;
  byId = new Map();
  /* Compared without case: As and AS side by side in a grid of 173 is one mark, not two. */
  const taken = new Set<string>();
  for (const option of GAME_PICKS[game]?.options ?? []) {
    const candidates = monogramCandidates(option.name);
    const mark =
      candidates.find((candidate) => !taken.has(candidate.toLowerCase())) ??
      candidates[0]!;
    taken.add(mark.toLowerCase());
    byId.set(option.id, mark);
  }
  marks.set(game, byId);
  return byId;
}

/**
 * The mark for one stored or catalog value. A value the catalog has never heard of is marked
 * from its own text, because it is still a tile a teammate has to recognise.
 */
export function pickMonogram(game: string, value: string): string {
  const option = resolvePick(game, value);
  if (option) {
    const mark = gameMonograms(game).get(option.id);
    if (mark) return mark;
  }
  return monogramCandidates(String(value ?? ''))[0] ?? '';
}
