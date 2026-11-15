/*
 * Server check on the roles and picks a teammate saves (DESIGN decision 4).
 *
 * The settings screen offers controlled pickers, and this is the same rule applied where it
 * counts: a request that did not come from our form faces the shipped catalog too. What it does,
 * per game:
 *
 * - a role is stored as its name, normalized to the game's own spelling ("jungle" -> "Jungle");
 * - a pick is stored as its catalog id, resolved from the id, the official name or an alias, so
 *   "Dr. Mundo", "drmundo" and "mundo" all save as `dr-mundo`;
 * - a value the catalog does not know is kept when it is already stored for that game, and
 *   refused when it is new, which is how the handful of rows written before the catalog existed
 *   survive a save untouched while nobody can invent a champion;
 * - a game we ship no catalog for (Fortnite, Minecraft, Social) keeps free text, as every game
 *   did before;
 * - duplicates collapse and the caps hold.
 *
 * The database check stays the backstop: it is the thing a direct RPC caller cannot route around,
 * and it is what guarantees a stored label is safe to print. This function makes the error useful
 * before that happens.
 */
import {
  PROFILE_PICKS_MAX,
  PROFILE_ROLES_MAX,
  type PublicProfileSettings,
} from '../../contracts/teammate-profile';
import {
  GAME_PICKS,
  hasPickCatalog,
  hasRoleCatalog,
  picksLabel,
  resolvePick,
  resolveRole,
  squashLabel,
} from '../../contracts/game-picks-resolve';

/** What a teammate already has stored for a game, as the settings read hands it back. */
export type StoredGame = { game: string; roles: string[]; picks: string[] };
export type GamesCheck =
  | { ok: true; games: PublicProfileSettings['games'] }
  | { ok: false; error: string };

const gameName = (game: string) => GAME_PICKS[game]?.name ?? game;

/** The values already stored for this game and field, as resolution keys. */
function storedKeys(
  before: readonly StoredGame[] | null,
  game: string,
  field: 'roles' | 'picks',
): Set<string> | null {
  if (!before) return null;
  const row = before.find((g) => g.game === game);
  return new Set((row?.[field] ?? []).map(squashLabel));
}

/**
 * One field of one game. `known` turns a value into what should be stored, or null when the
 * catalog has never heard of it; `stored` is what the teammate already has, or null when the read
 * that would have told us failed. With no way to tell a legacy value from a new one we keep the
 * value, which is exactly what saving did before this check existed, and let the database decide.
 */
function checkField(
  values: readonly string[],
  cap: number,
  known: ((value: string) => string | null) | null,
  stored: Set<string> | null,
  reject: (value: string) => string,
): { ok: true; values: string[] } | { ok: false; error: string } {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = String(raw ?? '').trim();
    if (!value) continue;
    let keep: string | null = known ? known(value) : value;
    if (keep === null) {
      const key = squashLabel(value);
      if (stored && !stored.has(key))
        return { ok: false, error: reject(value) };
      keep = value;
    }
    const key = squashLabel(keep);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(keep);
    if (out.length === cap) break;
  }
  return { ok: true, values: out };
}

/**
 * Checks and normalizes every game on a save. `before` is what the settings read returned for
 * this teammate a moment ago, or null when it could not be read.
 */
export function checkProfileGames(
  games: readonly StoredGame[],
  before: readonly StoredGame[] | null,
): GamesCheck {
  const out: PublicProfileSettings['games'] = [];
  for (const entry of games) {
    const game = entry.game;
    const name = gameName(game);
    const roles = checkField(
      entry.roles,
      PROFILE_ROLES_MAX,
      hasRoleCatalog(game) ? (value) => resolveRole(game, value) : null,
      storedKeys(before, game, 'roles'),
      (value) =>
        `${name} does not list "${value}" as one of its roles. Pick from the list and save again.`,
    );
    if (!roles.ok) return roles;
    const picks = checkField(
      entry.picks,
      PROFILE_PICKS_MAX,
      hasPickCatalog(game)
        ? (value) => resolvePick(game, value)?.id ?? null
        : null,
      storedKeys(before, game, 'picks'),
      (value) =>
        `${name} does not list "${value}" under ${picksLabel(game)}. Pick from the list and save again.`,
    );
    if (!picks.ok) return picks;
    out.push({ game, roles: roles.values, picks: picks.values });
  }
  return { ok: true, games: out };
}
