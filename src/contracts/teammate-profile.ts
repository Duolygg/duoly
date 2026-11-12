/**
 * Public teammate profiles (docs/product/public-profiles.md, plan PUBLIC-PROFILES-PLAN.md).
 *
 * Shared contract between the database read functions, the server module and the pages.
 * Teammate user ids never appear here: a public profile is addressed by its slug only.
 * Stats below their sample minimum are null, never 0, so pages hide them instead of showing a
 * weak number.
 */
import { z } from 'zod';

/** Curated accent colours a teammate can pick. Keys are stored; hex values live here only. */
export const PROFILE_ACCENTS = {
  violet: '#B794FF',
  lavender: '#D6BBFF',
  cyan: '#7FE3FF',
  mint: '#7CF2C2',
  pink: '#FF9ED8',
  coral: '#FF9F8A',
  gold: '#FFD27A',
  ice: '#CFE6FF',
} as const;
export type ProfileAccent = keyof typeof PROFILE_ACCENTS;
export const PROFILE_ACCENT_KEYS = Object.keys(
  PROFILE_ACCENTS,
) as ProfileAccent[];
export const DEFAULT_ACCENT: ProfileAccent = 'lavender';

/** Curated banner patterns (CSS only, drawn by the page). */
export const PROFILE_BANNERS = ['grid', 'slash', 'pulse', 'orbit'] as const;
export type ProfileBanner = (typeof PROFILE_BANNERS)[number];
export const DEFAULT_BANNER: ProfileBanner = 'slash';

/** Vibe tags a teammate can feature (up to VIBE_TAGS_MAX). */
export const VIBE_TAGS = [
  'Chill',
  'Shotcaller',
  'Teaches as we play',
  'Tryhard',
  'Patient',
  'Funny',
  'Quiet focus',
  'Night owl',
  'Strategy nerd',
  'Mechanics first',
] as const;
export type VibeTag = (typeof VIBE_TAGS)[number];
export const VIBE_TAGS_MAX = 3;

/** Trust tiers, same ids and thresholds as src/design-reference/lib/trust.js. */
export const TRUST_TIERS = [
  'rookie',
  'trusted',
  'veteran',
  'elite',
  'legend',
] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

/** Sample minimums: below these the stat is null and not shown. */
export const MIN_REVIEWS_FOR_RATING = 5;
export const MIN_GAMES_FOR_WINRATE = 20;
/** Quality rule for indexing (plan section 5). */
export const INDEX_MIN_BIO_CHARS = 60;
export const INDEX_MIN_SESSIONS = 5;
export const PROFILE_REVIEWS_MAX = 6;
export const RELATED_MAX = 3;
export const GAME_SECTION_MAX = 6;

/** Slugs: lowercase letters, digits and single hyphens, 3 to 24 characters. */
export const SLUG_PATTERN = /^(?=.{3,24}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'duoly',
  'support',
  'help',
  'teammates',
  'teammate',
  'login',
  'signin',
  'signup',
  'settings',
  'profile',
  'staff',
  'team',
  'official',
  'moderator',
  'mod',
  'null',
  'undefined',
  'new',
  'edit',
] as const;

export function slugFromName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '');
}

export function slugValid(slug: string): boolean {
  return (
    SLUG_PATTERN.test(slug) &&
    !(RESERVED_SLUGS as readonly string[]).includes(slug)
  );
}

/** One game on a profile. rank and peakRank are set by an admin only; verified means an admin checked them. */
export type PublicProfileGame = {
  game: string; // game id from src/design-reference/lib/games.js
  rank: string | null;
  peakRank: string | null;
  verified: boolean;
  roles: string[];
  picks: string[]; // agents, champions, heroes or legends
};

export type PublicProfileReview = {
  rating: 1 | 2 | 3 | 4 | 5;
  /** Empty when the review was written before the public-profile notice existed. */
  text: string;
  game: string;
  month: string; // YYYY-MM
};

export type PublicTeammateProfile = {
  slug: string;
  name: string;
  avatar: string; // site path of the preset avatar
  country: string | null; // only when the teammate chose to show it
  languages: string[];
  bio: string;
  accent: ProfileAccent;
  banner: ProfileBanner;
  vibeTags: VibeTag[];
  featuredGame: string;
  coaching: boolean;
  online: boolean;
  memberSince: string; // YYYY-MM
  sessions: number;
  tier: TrustTier;
  rating: { average: number; count: number } | null;
  reviewTags: { tag: string; count: number }[];
  winRate: { percent: number; games: number } | null;
  games: PublicProfileGame[];
  reviews: PublicProfileReview[];
  updatedAt: string; // ISO timestamp, sitemap lastmod
};

/** Small card used on game pages, in the directory and for related teammates. */
export type PublicTeammateCard = {
  slug: string;
  name: string;
  avatar: string;
  accent: ProfileAccent;
  tier: TrustTier;
  online: boolean;
  game: string;
  rank: string | null;
  rating: { average: number; count: number } | null;
};

/** Plan section 5: index only real, substantial profiles. */
export function profileIndexable(p: PublicTeammateProfile): boolean {
  const verifiedRank = p.games.some((g) => g.verified && g.rank);
  return (
    verifiedRank &&
    (p.bio.trim().length >= INDEX_MIN_BIO_CHARS ||
      p.sessions >= INDEX_MIN_SESSIONS)
  );
}

/** What a teammate can save from the settings block. Ranks are not here: admins set them. */
export const publicProfileSettingsSchema = z.object({
  published: z.boolean(),
  slug: z
    .string()
    .refine(slugValid, 'Pick 3 to 24 letters, numbers or hyphens.'),
  accent: z.enum(PROFILE_ACCENT_KEYS as [ProfileAccent, ...ProfileAccent[]]),
  banner: z.enum(PROFILE_BANNERS),
  featuredGame: z.string().min(2).max(8),
  vibeTags: z.array(z.enum(VIBE_TAGS)).max(VIBE_TAGS_MAX),
  showCountry: z.boolean(),
  coaching: z.boolean(),
  games: z
    .array(
      z.object({
        game: z.string().min(2).max(8),
        roles: z.array(z.string().min(1).max(24)).max(3),
        picks: z.array(z.string().min(1).max(24)).max(5),
      }),
    )
    .max(16),
});
export type PublicProfileSettings = z.infer<typeof publicProfileSettingsSchema>;
