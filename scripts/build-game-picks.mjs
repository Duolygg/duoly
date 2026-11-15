/*
 * Generates the picker catalogs the settings screen and the server validate against:
 *
 *   scripts/game-picks/<game>.json  ->  src/contracts/game-picks.ts
 *   scripts/game-picks/languages.json -> src/contracts/profile-languages.ts
 *
 * Run it with `pnpm build:game-picks` after editing an input file (a game released a character,
 * a role was renamed). The inputs live in the repository so the generated file can always be
 * rebuilt from a clean checkout; they carry names, roles and aliases only, never artwork.
 *
 * The script refuses to write a catalog that the database would reject later. Pick ids are
 * stored in teammate_game_ranks.picks, which is guarded by teammate_public_labels_valid()
 * (20261112120000_public_teammate_profiles.sql): 1 to 24 characters, no control characters, none
 * of `@ : / \ .`, and no word from the contact and payment deny list. Every rule below is that
 * check, restated, plus the slug shape we chose for ids so they read as ids anywhere they show up
 * in a log. A failure here is a data problem to fix in the input, never something to work around
 * in the reader.
 */
/* global console */
import process from 'node:process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const input = join(here, 'game-picks');
const out = join(root, 'src', 'contracts');

/** teammate_public_labels_valid(): the words a label may not contain, as whole words. */
const DENIED =
  /(?<![a-z0-9_])(pass(word|wort)?|paypal|venmo|cash ?app|iban|crypto|whatsapp|telegram|snapchat|discord)(?![a-z0-9_])/i;
/** teammate_public_labels_valid(): punctuation it rejects outright. */
const PUNCTUATION = /[@:/\\.]/;
/** Our own rule for an id: lowercase words joined by single hyphens. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LABEL_MAX = 24;

const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);

/** Why a value could never be stored, or '' when it could. */
function labelProblem(value) {
  if (typeof value !== 'string' || !value) return 'empty';
  if (value.length > LABEL_MAX)
    return `${value.length} characters, over ${LABEL_MAX}`;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) return 'control characters';
  if (PUNCTUATION.test(value)) return 'punctuation the database rejects';
  if (DENIED.test(value)) return 'a word the database deny list rejects';
  return '';
}

/**
 * The key two spellings of the same thing share: accents folded, everything that is not a letter
 * or a digit dropped. "Dr. Mundo", "dr-mundo" and "drmundo" all land on the same key, which is
 * how a legacy name or an alias resolves to an id. Kept in step with squashLabel() in
 * src/contracts/game-picks-resolve.ts.
 */
const squash = (value) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const SIDE_NAMES = { attack: 'Attack', defense: 'Defense' };

function readGame(file) {
  const data = JSON.parse(readFileSync(join(input, file), 'utf8'));
  const id = data.game;
  const roles = data.roles?.applies ? (data.roles.options ?? []) : [];
  const picks = data.picks?.applies ? (data.picks.options ?? []) : [];
  const roleIds = new Set(roles.map((r) => r.id));

  for (const role of roles) {
    if (!SLUG.test(role.id)) fail(`${id} role ${role.id}`, 'id is not a slug');
    // Role names are what gets stored, so they face the same check as a pick id.
    const problem = labelProblem(role.name);
    if (problem) fail(`${id} role ${role.name}`, problem);
  }
  if (new Set(roles.map((r) => r.id)).size !== roles.length)
    fail(`${id} roles`, 'duplicate ids');

  /* Which key the pick options are filtered by. A game either tags every character with a role
     (Valorant, Overwatch, Rivals, Apex, Unite, WoW), or with a side (Siege attack or defense), or
     with nothing we trust as a filter: League combat classes are not lanes, so League, Wild Rift,
     Dota and Deadlock get search only. */
  const side = picks.some((p) => p.side);
  const filterKey = side ? 'side' : picks.some((p) => p.role) ? 'role' : null;
  const seen = new Set();
  const keys = new Map();
  const options = [];
  for (const option of picks) {
    const problem = labelProblem(option.id);
    if (problem) fail(`${id} pick ${option.id}`, problem);
    if (!SLUG.test(option.id))
      fail(`${id} pick ${option.id}`, 'id is not a slug');
    if (seen.has(option.id)) fail(`${id} pick ${option.id}`, 'duplicate id');
    seen.add(option.id);
    if (!option.name) fail(`${id} pick ${option.id}`, 'no display name');
    const value = option.side ?? option.role ?? null;
    if (filterKey === 'role' && value && !roleIds.has(value))
      fail(
        `${id} pick ${option.id}`,
        `role ${value} is not in the game's role list`,
      );
    if (filterKey === 'side' && value && !SIDE_NAMES[value])
      fail(`${id} pick ${option.id}`, `side ${value} is not attack or defense`);
    /* Every spelling that resolves to this option has to be unique inside the game, or a save
       would have to guess which character a teammate meant. */
    for (const spelling of [
      option.id,
      option.name,
      ...(option.aliases ?? []),
    ]) {
      const key = squash(spelling);
      if (!key) continue;
      const owner = keys.get(key);
      if (owner && owner !== option.id)
        fail(
          `${id} pick ${option.id}`,
          `"${spelling}" also resolves to ${owner}`,
        );
      keys.set(key, option.id);
    }
    options.push({
      id: option.id,
      name: option.name,
      ...(value ? { filter: value } : {}),
      ...(option.aliases?.length
        ? { aliases: [...option.aliases].sort() }
        : {}),
    });
  }
  options.sort((a, b) => a.id.localeCompare(b.id, 'en'));

  /* The filter tabs, in the game's own role order, and only the keys characters actually carry:
     a Fill tab on a character grid would always be empty. */
  const used = new Set(options.map((o) => o.filter).filter(Boolean));
  const filters =
    filterKey === 'side'
      ? ['attack', 'defense']
          .filter((s) => used.has(s))
          .map((s) => ({ id: s, name: SIDE_NAMES[s] }))
      : filterKey === 'role'
        ? roles
            .filter((r) => used.has(r.id))
            .map((r) => ({ id: r.id, name: r.name }))
        : [];
  if (filterKey === 'role' && filters.length !== used.size)
    fail(
      `${id} filters`,
      'a character carries a role that is not in the role list',
    );

  return {
    id,
    name: data.name,
    collectedAt: data.collectedAt,
    roles: roles.map((r) => ({ id: r.id, name: r.name })),
    label: data.picks?.label ?? 'Picks',
    max: data.picks?.max ?? 5,
    filterKey,
    filterLabel: filterKey === 'side' ? 'Side' : 'Role',
    filters,
    options,
  };
}

const games = readdirSync(input)
  .filter((f) => f.endsWith('.json') && f !== 'languages.json')
  .map(readGame)
  .sort((a, b) => a.id.localeCompare(b.id, 'en'));

/* Languages: the id stays the English name already stored in profiles.languages, so this file
   adds the endonym, the ISO 639-1 code and the suggested order and nothing else. */
const languages = JSON.parse(
  readFileSync(join(input, 'languages.json'), 'utf8'),
);
const account = readFileSync(join(out, 'account.ts'), 'utf8');
const contract = (
  account.match(/PROFILE_LANGUAGES = \[([\s\S]*?)\] as const/)?.[1] ?? ''
)
  .split('\n')
  .map((line) => line.match(/'([^']+)'/)?.[1])
  .filter(Boolean);
const ids = languages.languages.map((l) => l.id);
for (const id of contract)
  if (!ids.includes(id))
    fail('languages', `${id} is in PROFILE_LANGUAGES and not in the input`);
for (const id of ids)
  if (!contract.includes(id))
    fail('languages', `${id} is in the input and not in PROFILE_LANGUAGES`);
for (const language of languages.languages) {
  if (!/^[a-z]{2}$/.test(language.iso6391))
    fail(
      `language ${language.id}`,
      'ISO 639-1 code is not two lowercase letters',
    );
  if (!Number.isInteger(language.suggestedOrder))
    fail(`language ${language.id}`, 'suggested order is not a whole number');
}
if (
  new Set(languages.languages.map((l) => l.suggestedOrder)).size !== ids.length
)
  fail('languages', 'two languages share a suggested order');

if (problems.length) {
  console.error('build-game-picks found problems the database would reject:');
  for (const problem of problems) console.error('  ' + problem);
  process.exit(1);
}

/** The newest collection date across the inputs, for the note in the generated file. */
const collectedAt = games
  .map((g) => g.collectedAt)
  .filter(Boolean)
  .sort()
  .at(-1);

const q = (value) => JSON.stringify(value);
const picksFile = `/*
 * GENERATED FILE. Do not edit by hand: run \`pnpm build:game-picks\` instead, which reads
 * scripts/game-picks/*.json and checks every id against the label rules in Postgres.
 *
 * What a teammate plays, per game, as the settings pickers and the server offer it:
 *
 * - \`roles\` are stored as names, because they are already safe labels and they match the roles a
 *   customer picks at booking (src/contracts/roles.ts, read only).
 * - \`options\` are stored as ids, because official names such as "D.Va", "KAY/O", "Soldier: 76",
 *   "Dr. Mundo" and "Mr. Mime" contain punctuation teammate_public_labels_valid() rejects. One
 *   adapter turns ids back into names on every read path, so nothing public shows an id.
 * - \`filter\` is the role or side a character belongs to, for the picker's tabs. League and Wild
 *   Rift combat classes are not lanes, so those games carry no filter and search instead.
 * - \`aliases\` are what players type ("kayo", "mundo", "aff lock"); they are never displayed.
 *
 * A game with no catalog for a field keeps free text for it, which is what every game had before.
 * The lists were collected on ${collectedAt}. A character released after that needs an input
 * update and a rebuild; until then the picker offers a support draft, and a value already stored
 * is never dropped on save.
 */
export type PickFilter = { id: string; name: string };
export type PickOption = {
  id: string;
  name: string;
  /** Role id or side id this character belongs to, when the game assigns one. */
  filter?: string;
  /** Search-only spellings. */
  aliases?: string[];
};
export type GamePickCatalog = {
  /** Display name of the game, for copy the picker writes about it. */
  name: string;
  /** Roles the game offers, or [] when it has no role list. */
  roles: PickFilter[];
  /** What the game calls a character: Champions, Agents, Heroes, Legends, Operators, Pokémon. */
  label: string;
  /** Picks a teammate may feature. */
  max: number;
  /** Whether \`filter\` on an option is a role or a side, or null when there is nothing to filter by. */
  filterKey: 'role' | 'side' | null;
  /** Word for the filter tabs. */
  filterLabel: string;
  /** The filter tabs, in the game's own order. */
  filters: PickFilter[];
  /** Characters, by id, or [] when the game has no character list. */
  options: PickOption[];
};

export const GAME_PICKS: Record<string, GamePickCatalog> = {
${games
  .map(
    (g) => `  ${g.id}: {
    name: ${q(g.name)},
    roles: [${g.roles.map((r) => `{ id: ${q(r.id)}, name: ${q(r.name)} }`).join(', ')}],
    label: ${q(g.label)},
    max: ${g.max},
    filterKey: ${q(g.filterKey)},
    filterLabel: ${q(g.filterLabel)},
    filters: [${g.filters.map((r) => `{ id: ${q(r.id)}, name: ${q(r.name)} }`).join(', ')}],
    options: [
${g.options
  .map(
    (o) =>
      `      { id: ${q(o.id)}, name: ${q(o.name)}${o.filter ? `, filter: ${q(o.filter)}` : ''}${
        o.aliases ? `, aliases: [${o.aliases.map(q).join(', ')}] ` : ' '
      }},`,
  )
  .join('\n')}
    ],
  },`,
  )
  .join('\n')}
};
`;

const sorted = [...languages.languages].sort(
  (a, b) => a.suggestedOrder - b.suggestedOrder,
);
const languagesFile = `/*
 * GENERATED FILE. Do not edit by hand: run \`pnpm build:game-picks\`.
 *
 * The spoken languages picker. \`id\` is the English name already stored in profiles.languages and
 * listed in PROFILE_LANGUAGES, so this file adds display detail only and changes nothing on the
 * wire. \`endonym\` is the language's own name for itself, shown as secondary text when it differs.
 * \`code\` is ISO 639-1, shown as a small badge; a language is never drawn as a country flag,
 * because English, German, French, Portuguese, Arabic and Chinese all cross borders.
 *
 * \`suggested\` is the editorial order of the short Suggested group (an audience hypothesis, not
 * measured demand). It never preselects anything and never implies a main language.
 */
export type ProfileLanguage = {
  id: string;
  endonym: string;
  code: string;
  suggested: number;
};
/** Suggested order first; the picker sorts the full list by name itself. */
export const PROFILE_LANGUAGE_DETAIL: ProfileLanguage[] = [
${sorted
  .map(
    (l) =>
      `  { id: ${q(l.id)}, endonym: ${q(l.endonym)}, code: ${q(l.iso6391.toUpperCase())}, suggested: ${l.suggestedOrder} },`,
  )
  .join('\n')}
];
/** How many of them lead the picker as "Suggested". */
export const LANGUAGES_SUGGESTED = 10;
`;

/* Written through Prettier with the repository's own configuration, so a rebuild never leaves
   `pnpm format:check` failing on a file nobody edited by hand. */
const prettier = await import('prettier');
for (const [name, text] of [
  ['game-picks.ts', picksFile],
  ['profile-languages.ts', languagesFile],
]) {
  const file = join(out, name);
  const config = await prettier.resolveConfig(file);
  writeFileSync(
    file,
    await prettier.format(text, { ...config, filepath: file }),
  );
}
const total = games.reduce((n, g) => n + g.options.length, 0);
console.log(
  `game-picks.ts: ${games.length} games, ${total} characters, ` +
    `${games.filter((g) => g.options.length).length} with a character list, ` +
    `${games.filter((g) => g.roles.length).length} with a role list`,
);
console.log(`profile-languages.ts: ${sorted.length} languages`);
