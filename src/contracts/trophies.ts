import { z } from 'zod';
import { TROPHY_ART } from './trophy-art';

/**
 * The trophy case: achievements a teammate proved to Duoly staff, shown on the public profile.
 * Verification is manual (proof image or link, admin approval) for every game, so this file is
 * the whole per-game knowledge: which ladders exist, their tiers in order and how rare each
 * tier is. Rarity decides the material on the page, so a Gold or Platinum trophy still gets a
 * polished card and the top tiers get the loud treatment.
 */
export const TROPHY_KINDS = ['rank', 'leaderboard', 'tournament', 'title'] as const;
export type TrophyKind = (typeof TROPHY_KINDS)[number];

/** When a rank was held. Peak and season end are history; current is re-checked each season. */
export const RANK_MOMENTS = ['peak', 'season_end', 'current'] as const;
export type RankMoment = (typeof RANK_MOMENTS)[number];
export const RANK_MOMENT_LABEL: Record<RankMoment, string> = {
  peak: 'Peak rank',
  season_end: 'Season end',
  current: 'Current rank',
};

export const RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
] as const;
export type Rarity = (typeof RARITIES)[number];
export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};
export const rarityRank = (r: Rarity) => RARITIES.indexOf(r);

export interface TrophyTier {
  key: string;
  name: string;
  rarity: Rarity;
  /** Divisions inside the tier, lowest first (for example IV, III, II, I). */
  divisions?: readonly string[];
}
export interface TrophyLadder {
  id: string;
  label: string;
  tiers: readonly TrophyTier[];
  /** What the optional number on a rank means (LP, RR, rating). */
  value?: string;
}
export interface TrophyGame {
  ladders: readonly TrophyLadder[];
  /** Name of the public leaderboard, when the game has one. */
  leaderboard?: string;
  /** Emblem file for a leaderboard spot (Overwatch Top 500), when the game has one. */
  leaderboardArt?: string;
}

const C = 'common',
  U = 'uncommon',
  R = 'rare',
  E = 'epic',
  L = 'legendary',
  M = 'mythic';
const ROMAN4 = ['IV', 'III', 'II', 'I'] as const;
const ROMAN3 = ['III', 'II', 'I'] as const;
const ARABIC3 = ['1', '2', '3'] as const;
const ARABIC5 = ['5', '4', '3', '2', '1'] as const;
const kebab = (s: string) =>
  s
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
/** Tiers from [name, rarity, divisions?, key?] rows, lowest first. The key names the emblem file. */
const tiers = (
  rows: [string, Rarity, (readonly string[] | null)?, string?][],
): TrophyTier[] =>
  rows.map(([name, rarity, divisions, key]) => ({
    key: key ?? kebab(name),
    name,
    rarity,
    ...(divisions ? { divisions } : {}),
  }));

const riotPc = (apex: string): TrophyLadder => ({
  id: 'rank',
  label: 'Ranked',
  value: 'LP',
  tiers: tiers([
    ['Iron', C, ROMAN4],
    ['Bronze', C, ROMAN4],
    ['Silver', C, ROMAN4],
    ['Gold', U, ROMAN4],
    ['Platinum', U, ROMAN4],
    ['Emerald', R, ROMAN4],
    ['Diamond', E, ROMAN4],
    ['Master', E],
    ['Grandmaster', L],
    [apex, M],
  ]),
});

export const TROPHY_GAMES: Record<string, TrophyGame> = {
  lol: { ladders: [riotPc('Challenger')], leaderboard: 'Ladder' },
  tft: { ladders: [riotPc('Challenger')], leaderboard: 'Ladder' },
  wr: {
    ladders: [
      {
        id: 'rank',
        label: 'Ranked',
        tiers: tiers([
          ['Iron', C, ROMAN4],
          ['Bronze', C, ROMAN4],
          ['Silver', C, ROMAN4],
          ['Gold', U, ROMAN4],
          ['Platinum', U, ROMAN4],
          ['Emerald', R, ROMAN4],
          ['Diamond', R, ROMAN4],
          ['Master', E],
          ['Grandmaster', E],
          ['Challenger', L],
          ['Sovereign', M],
        ]),
      },
      {
        id: 'legendary',
        label: 'Legendary Queue',
        tiers: tiers([['Legend', L]]),
      },
    ],
  },
  val: {
    ladders: [
      {
        id: 'rank',
        label: 'Competitive',
        value: 'RR',
        tiers: tiers([
          ['Iron', C, ARABIC3],
          ['Bronze', C, ARABIC3],
          ['Silver', C, ARABIC3],
          ['Gold', U, ARABIC3],
          ['Platinum', U, ARABIC3],
          ['Diamond', R, ARABIC3],
          ['Ascendant', E, ARABIC3],
          ['Immortal', L, ARABIC3],
          ['Radiant', M],
        ]),
      },
    ],
    leaderboard: 'Leaderboard',
  },
  dota: {
    ladders: [
      {
        id: 'rank',
        label: 'Ranked',
        value: 'MMR',
        tiers: tiers([
          ['Herald', C, ARABIC5],
          ['Guardian', C, ARABIC5],
          ['Crusader', C, ARABIC5],
          ['Archon', U, ARABIC5],
          ['Legend', U, ARABIC5],
          ['Ancient', R, ARABIC5],
          ['Divine', E, ARABIC5],
          ['Immortal', L],
        ]),
      },
    ],
    leaderboard: 'Immortal leaderboard',
  },
  cs2: {
    ladders: [
      {
        id: 'premier',
        label: 'Premier',
        value: 'rating',
        tiers: tiers([
          ['Premier 0+', C],
          ['Premier 5,000+', C],
          ['Premier 10,000+', U],
          ['Premier 15,000+', R],
          ['Premier 20,000+', E],
          ['Premier 25,000+', L],
          ['Premier 30,000+', M],
        ]),
      },
      {
        id: 'faceit',
        label: 'FACEIT',
        value: 'Elo',
        tiers: tiers([
          ['FACEIT Level 1', C, null, 'faceit-1'],
          ['FACEIT Level 2', C, null, 'faceit-2'],
          ['FACEIT Level 3', C, null, 'faceit-3'],
          ['FACEIT Level 4', C, null, 'faceit-4'],
          ['FACEIT Level 5', U, null, 'faceit-5'],
          ['FACEIT Level 6', U, null, 'faceit-6'],
          ['FACEIT Level 7', R, null, 'faceit-7'],
          ['FACEIT Level 8', R, null, 'faceit-8'],
          ['FACEIT Level 9', E, null, 'faceit-9'],
          ['FACEIT Level 10', L, null, 'faceit-10'],
          ['FACEIT Challenger', M],
        ]),
      },
      {
        id: 'competitive',
        label: 'Competitive',
        tiers: tiers([
          ['Silver I', C],
          ['Silver II', C],
          ['Silver III', C],
          ['Silver IV', C],
          ['Silver Elite', C],
          ['Silver Elite Master', C],
          ['Gold Nova I', C],
          ['Gold Nova II', C],
          ['Gold Nova III', U],
          ['Gold Nova Master', U],
          ['Master Guardian I', U],
          ['Master Guardian II', U],
          ['Master Guardian Elite', R],
          ['Distinguished Master Guardian', R],
          ['Legendary Eagle', E],
          ['Legendary Eagle Master', E],
          ['Supreme Master First Class', L],
          ['The Global Elite', M, null, 'global-elite'],
        ]),
      },
    ],
    leaderboard: 'Premier leaderboard',
  },
  r6: {
    ladders: [
      {
        id: 'rank',
        label: 'Ranked',
        value: 'RP',
        tiers: tiers([
          ['Copper', C, ARABIC5],
          ['Bronze', C, ARABIC5],
          ['Silver', C, ARABIC5],
          ['Gold', U, ARABIC5],
          ['Platinum', U, ARABIC5],
          ['Emerald', R, ARABIC5],
          ['Diamond', E, ARABIC5],
          ['Champion', L],
        ]),
      },
    ],
    leaderboard: 'Champions leaderboard',
  },
  cod: {
    ladders: [
      {
        id: 'rank',
        label: 'Ranked Play',
        value: 'SR',
        tiers: tiers([
          ['Bronze', C, ROMAN3],
          ['Silver', C, ROMAN3],
          ['Gold', U, ROMAN3],
          ['Platinum', U, ROMAN3],
          ['Diamond', R, ROMAN3],
          ['Crimson', E, ROMAN3],
          ['Iridescent', L],
          ['Top 250', M],
        ]),
      },
    ],
    leaderboard: 'Top 250',
  },
  pubg: {
    ladders: [
      {
        id: 'rank',
        label: 'Ranked',
        value: 'RP',
        tiers: tiers([
          ['Bronze', C, ARABIC5],
          ['Silver', C, ARABIC5],
          ['Gold', U, ARABIC5],
          ['Platinum', U, ARABIC5],
          ['Crystal', R, ARABIC5],
          ['Diamond', E, ARABIC5],
          ['Master', L],
          ['Survivor', M],
        ]),
      },
    ],
    leaderboard: 'Leaderboard',
  },
  dl: {
    ladders: [
      {
        id: 'rank',
        label: 'Ranked',
        tiers: tiers([
          ['Initiate', C, ['1', '2', '3', '4', '5', '6']],
          ['Seeker', C, ['1', '2', '3', '4', '5', '6']],
          ['Alchemist', C, ['1', '2', '3', '4', '5', '6']],
          ['Arcanist', U, ['1', '2', '3', '4', '5', '6']],
          ['Ritualist', U, ['1', '2', '3', '4', '5', '6']],
          ['Emissary', R, ['1', '2', '3', '4', '5', '6']],
          ['Archon', R, ['1', '2', '3', '4', '5', '6']],
          ['Oracle', E, ['1', '2', '3', '4', '5', '6']],
          ['Phantom', E, ['1', '2', '3', '4', '5', '6']],
          ['Ascendant', L, ['1', '2', '3', '4', '5', '6']],
          ['Eternus', M, ['1', '2', '3', '4', '5', '6']],
        ]),
      },
    ],
    leaderboard: 'Leaderboard',
  },
  ow: {
    ladders: [
      {
        id: 'rank',
        label: 'Competitive',
        tiers: tiers([
          ['Bronze', C, ARABIC5],
          ['Silver', C, ARABIC5],
          ['Gold', U, ARABIC5],
          ['Platinum', U, ARABIC5],
          ['Emerald', R, ARABIC5],
          ['Diamond', R, ARABIC5],
          ['Master', E, ARABIC5],
          ['Grandmaster', L, ARABIC5],
          ['Champion', M, ARABIC5],
        ]),
      },
    ],
    leaderboard: 'Top 500',
    leaderboardArt: 'top-500',
  },
  mr: {
    ladders: [
      {
        id: 'rank',
        label: 'Competitive',
        tiers: tiers([
          ['Bronze', C, ROMAN3],
          ['Silver', C, ROMAN3],
          ['Gold', U, ROMAN3],
          ['Platinum', U, ROMAN3],
          ['Diamond', R, ROMAN3],
          ['Grandmaster', E, ROMAN3],
          ['Celestial', E, ROMAN3],
          ['Eternity', L],
          ['One Above All', M],
        ]),
      },
    ],
    leaderboard: 'Top 500',
  },
  apex: {
    ladders: [
      {
        id: 'rank',
        label: 'Ranked',
        value: 'RP',
        tiers: tiers([
          ['Rookie', C, ROMAN4],
          ['Bronze', C, ROMAN4],
          ['Silver', C, ROMAN4],
          ['Gold', U, ROMAN4],
          ['Platinum', U, ROMAN4],
          ['Diamond', R, ROMAN4],
          ['Master', E],
          ['Apex Predator', M],
        ]),
      },
    ],
    leaderboard: 'Predator leaderboard',
  },
  fn: {
    ladders: [
      {
        id: 'rank',
        label: 'Ranked',
        tiers: tiers([
          ['Bronze', C, ROMAN3],
          ['Silver', C, ROMAN3],
          ['Gold', U, ROMAN3],
          ['Platinum', U, ROMAN3],
          ['Diamond', R, ROMAN3],
          ['Elite', E],
          ['Champion', L],
          ['Unreal', M],
        ]),
      },
    ],
    leaderboard: 'Unreal leaderboard',
  },
  rl: {
    ladders: [
      {
        id: 'rank',
        label: 'Competitive',
        value: 'MMR',
        tiers: tiers([
          ['Bronze', C, ROMAN3],
          ['Silver', C, ROMAN3],
          ['Gold', C, ROMAN3],
          ['Platinum', U, ROMAN3],
          ['Diamond', U, ROMAN3],
          ['Champion', R, ROMAN3],
          ['Grand Champion', L, ROMAN3],
          ['Supersonic Legend', M],
        ]),
      },
    ],
    leaderboard: 'Leaderboard',
  },
  wow: {
    ladders: [
      {
        id: 'pvp',
        label: 'Rated PvP',
        value: 'rating',
        tiers: tiers([
          ['Combatant', C],
          ['Challenger', U],
          ['Rival', R],
          ['Duelist', E],
          ['Elite', L],
          ['Gladiator', M],
        ]),
      },
      {
        id: 'mythic-plus',
        label: 'Mythic+',
        value: 'rating',
        tiers: tiers([
          ['Keystone Explorer', C],
          ['Keystone Conqueror', U],
          ['Keystone Master', R],
          ['Keystone Hero', E],
          ['Keystone Legend', L],
        ]),
      },
    ],
    leaderboard: 'Title cutoff',
  },
  fc: {
    ladders: [
      {
        id: 'division',
        label: 'Division Rivals',
        tiers: tiers([
          ['Division 10', C],
          ['Division 9', C],
          ['Division 8', C],
          ['Division 7', C],
          ['Division 6', U],
          ['Division 5', U],
          ['Division 4', U],
          ['Division 3', R],
          ['Division 2', R],
          ['Division 1', E],
          ['Elite', L],
        ]),
      },
    ],
    leaderboard: 'Champions leaderboard',
  },
  pu: {
    ladders: [
      {
        id: 'rank',
        label: 'Ranked',
        tiers: tiers([
          ['Beginner', C],
          ['Great', C],
          ['Expert', U],
          ['Veteran', R],
          ['Ultra', E],
          ['Master', L],
          ['Legend', M],
        ]),
        value: 'rating',
      },
    ],
    leaderboard: 'Master leaderboard',
  },
  arc: {
    ladders: [
      {
        id: 'trials',
        label: 'Trials',
        tiers: tiers([
          ['Rookie I', C],
          ['Rookie II', C],
          ['Rookie III', C],
          ['Tryhard I', U],
          ['Tryhard II', U],
          ['Tryhard III', U],
          ['Wildcard I', R],
          ['Wildcard II', R],
          ['Wildcard III', R],
          ['Daredevil I', E],
          ['Daredevil II', E],
          ['Daredevil III', E],
          ['Hotshot', L],
          ['Cantina Legend', M],
        ]),
      },
    ],
    leaderboard: 'Trials leaderboard',
  },
  mc: { ladders: [], leaderboard: 'Server leaderboard' },
};

/** Minecraft has no ranked ladder: leaderboard, tournament and title only. */
export const trophyGame = (game: string): TrophyGame | undefined =>
  TROPHY_GAMES[game];
export const trophyLadder = (game: string, ladder: string) =>
  TROPHY_GAMES[game]?.ladders.find((l) => l.id === ladder);
export const trophyTier = (game: string, ladder: string, tier: string) =>
  trophyLadder(game, ladder)?.tiers.find((t) => t.key === tier);

/** Emblem path for a tier, or null when no official emblem is on file. */
export function trophyArt(
  game: string,
  tier: string,
  size: 128 | 256 = 256,
): string | null {
  return TROPHY_ART[game]?.includes(tier)
    ? `/trophies/${game}/${tier}-${size}.webp`
    : null;
}

/** Leaderboard placings: the smaller the number the louder the trophy. */
export function leaderboardRarity(position: number): Rarity {
  if (position <= 10) return M;
  if (position <= 100) return L;
  if (position <= 1000) return E;
  return R;
}
/** Tournament placings: a default the admin can raise or lower for the size of the event. */
export function tournamentRarity(placement: number): Rarity {
  if (placement === 1) return L;
  if (placement <= 3) return E;
  if (placement <= 8) return R;
  return U;
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !/[\u0000-\u001f\u007f<>]/.test(s), 'Plain text only.');
const optionalText = (max: number) =>
  z
    .union([text(max), z.literal('').transform(() => null), z.null()])
    .optional()
    .transform((v) => v ?? null);
export const ProofUrlSchema = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine((u) => /^https:\/\//i.test(u), 'Use an https link.');

/** What a teammate submits. Proof is an image upload, a link, or both. */
export const TrophySubmissionSchema = z
  .strictObject({
    game: z.string().min(2).max(8),
    kind: z.enum(TROPHY_KINDS),
    ladder: optionalText(24),
    tier: optionalText(40),
    division: optionalText(8),
    value: z.number().int().min(0).max(1_000_000).nullable().optional(),
    moment: z.enum(RANK_MOMENTS).nullable().optional(),
    season: optionalText(40),
    region: optionalText(32),
    position: z.number().int().min(1).max(1_000_000).nullable().optional(),
    event: optionalText(80),
    title: optionalText(60),
    achievedOn: z.iso.date().nullable().optional(),
    proofUrl: z
      .union([ProofUrlSchema, z.literal('').transform(() => null), z.null()])
      .optional(),
    note: optionalText(400),
  })
  .superRefine((t, ctx) => {
    const fail = (message: string, path: string) =>
      ctx.addIssue({ code: 'custom', message, path: [path] });
    const game = TROPHY_GAMES[t.game];
    if (!game) return fail('Unknown game.', 'game');
    if (t.kind === 'rank') {
      const tier =
        t.ladder && t.tier ? trophyTier(t.game, t.ladder, t.tier) : undefined;
      if (!tier) return fail('Pick a rank.', 'tier');
      if (t.division && !tier.divisions?.includes(t.division))
        fail('Pick a division from the list.', 'division');
      if (!t.moment) fail('Say when you held the rank.', 'moment');
      if (!t.season) fail('Add the season.', 'season');
    } else if (t.kind === 'leaderboard') {
      if (!t.position) fail('Add your leaderboard position.', 'position');
      if (!t.season) fail('Add the season.', 'season');
    } else if (t.kind === 'tournament') {
      if (!t.event) fail('Add the tournament name.', 'event');
      if (!t.position) fail('Add your placement.', 'position');
    } else if (!t.title) fail('Add the title.', 'title');
  });
export type TrophySubmission = z.infer<typeof TrophySubmissionSchema>;

/** The rarity a submission starts with. Staff can change it when they approve. */
export function defaultRarity(t: TrophySubmission): Rarity {
  if (t.kind === 'rank')
    return trophyTier(t.game, t.ladder ?? '', t.tier ?? '')?.rarity ?? C;
  if (t.kind === 'leaderboard') return leaderboardRarity(t.position ?? 1e6);
  if (t.kind === 'tournament') return tournamentRarity(t.position ?? 99);
  return R;
}

export const TROPHY_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const MAX_TROPHIES = 24;

/** One approved trophy as the public profile receives it. */
export const PublicTrophySchema = z.strictObject({
  id: z.uuid(),
  game: z.string(),
  kind: z.enum(TROPHY_KINDS),
  ladder: z.string().nullable(),
  tier: z.string().nullable(),
  division: z.string().nullable(),
  value: z.number().int().nullable(),
  moment: z.enum(RANK_MOMENTS).nullable(),
  season: z.string().nullable(),
  region: z.string().nullable(),
  position: z.number().int().nullable(),
  event: z.string().nullable(),
  title: z.string().nullable(),
  achievedOn: z.string().nullable(),
  proofUrl: z.string().nullable(),
  rarity: z.enum(RARITIES),
  verifiedAt: z.string(),
});
export type PublicTrophy = z.infer<typeof PublicTrophySchema>;

/** The teammate's own view adds status and the staff note. */
export const OwnTrophySchema = PublicTrophySchema.extend({
  status: z.enum(TROPHY_STATUSES),
  reviewNote: z.string().nullable(),
  hasImage: z.boolean(),
  createdAt: z.string(),
  verifiedAt: z.string().nullable(),
});
export type OwnTrophy = z.infer<typeof OwnTrophySchema>;
