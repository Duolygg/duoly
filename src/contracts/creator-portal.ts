import { z } from 'zod';
import { CREATOR_RULES, REF_CODE } from './creators';
import { GAME_IDS } from './admin';
import { CREATOR_TERMS_VERSION } from '../content/creator-terms';

/**
 * The creator portal contract, shared by /creators, /creators/dashboard, the API routes and the
 * tests. Every number here comes from `CREATOR_RULES` (Fabian's original lib/creators.js), so the
 * public page, the dashboard, the admin screen and the database say the same thing.
 *
 * Browser safe: no node imports, no secrets. Money is always integer euro cents.
 */

/** Completed orders wait this long before their commission can be paid (24b section 4). */
export const CREATOR_HOLD_DAYS = 30;
/** A rejected applicant can apply again after this many days. */
export const CREATOR_APPLY_COOLDOWN_DAYS = 30;

export const CREATOR_PLATFORMS = [
  'Twitch',
  'YouTube',
  'TikTok',
  'Kick',
  'Instagram',
  'Other',
] as const;
export const CREATOR_AUDIENCES = [
  'Under 1K',
  '1K to 10K',
  '10K to 100K',
  '100K+',
] as const;
/** Same manual rails as teammate payouts (20261111130000 added Payoneer). */
export const CREATOR_PAYOUT_METHODS = [
  'bank',
  'wise',
  'paypal',
  'payoneer',
] as const;
/** The dashboard's stat ranges. */
export const CREATOR_RANGES = ['7d', '30d', 'all'] as const;
export type CreatorRange = (typeof CREATOR_RANGES)[number];

/** Games a creator can name as their main game: every bookable game plus Social. */
export const CREATOR_GAME_IDS = [...GAME_IDS, 'social'] as const;

/**
 * Words the site answers itself. duoly.gg/CODE only redirects on a path no page answers, so a code
 * like "blog" would be a dead link. The database holds the same list in
 * `public.creator_reserved_code()`; tests/unit/creator-portal-migration.test.ts keeps them equal.
 */
export const RESERVED_CREATOR_CODES = [
  'admin',
  'ai',
  'api',
  'apply',
  'auth',
  'blog',
  'checkout',
  'claim',
  'coaching',
  'compare',
  'contact',
  'creators',
  'dashboard',
  'dev',
  'developers',
  'games',
  'how',
  'imprint',
  'index',
  'login',
  'mcp',
  'press',
  'pricing',
  'privacy',
  'pro',
  'profile',
  'queue',
  'reports',
  'reset',
  'robots',
  'rules',
  'sitemap',
  'teammate',
  'teammates',
  'terms',
  'trust',
] as const;

/** The reason a code cannot be used, for live feedback while typing, or null when it looks fine. */
export function creatorCodeIssue(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (!REF_CODE.test(code)) return 'Codes are 3 to 20 letters or numbers.';
  if (
    (RESERVED_CREATOR_CODES as readonly string[]).includes(code.toLowerCase())
  )
    return 'That word belongs to a Duoly page. Pick another code.';
  return null;
}

const csrf = z.string().min(1).max(128);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CHANNEL = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;

const code = z
  .string()
  .trim()
  .max(40)
  .transform((value) => value.toUpperCase())
  .refine((value) => REF_CODE.test(value), {
    message: 'Codes are 3 to 20 letters or numbers.',
  });

/** POST /api/creators/apply: the application form on /creators, for a signed-in account. */
export const CreatorApplySchema = z
  .object({
    csrf,
    name: z.string().trim().min(2).max(60),
    email: z.string().trim().max(120).regex(EMAIL),
    platform: z.enum(CREATOR_PLATFORMS),
    channel: z.string().trim().min(3).max(160).regex(CHANNEL),
    audience: z.enum(CREATOR_AUDIENCES),
    game: z.enum(CREATOR_GAME_IDS),
    country: z.string().trim().min(2).max(56),
    code,
    message: z.string().trim().max(1200).default(''),
    adult: z.literal(true),
    terms: z.literal(CREATOR_TERMS_VERSION),
    /** Honeypot, like the contact form: bots fill it in. */
    website: z.string().max(200).default(''),
  })
  .strict();
export type CreatorApply = z.infer<typeof CreatorApplySchema>;

/** POST /api/creators/code: the live availability check next to the code field. */
export const CreatorCodeCheckSchema = z.object({ csrf, code }).strict();

/**
 * POST /api/creators/payout-details. Same shape as `teammate_payout_details` plus what a creator
 * invoice needs: business or private, an optional VAT ID and the self billing agreement
 * (Gutschrift, UStG section 11(7) to (8), see 24b). No date of birth: the application already
 * carries the 18 or older confirmation.
 */
export const CreatorPayoutDetailsSchema = z
  .object({
    csrf,
    legalName: z.string().trim().min(2).max(120),
    address: z.string().trim().min(5).max(300),
    country: z.string().trim().min(2).max(56),
    method: z.enum(CREATOR_PAYOUT_METHODS),
    account: z.string().trim().min(3).max(200),
    business: z.boolean(),
    vatId: z.string().trim().max(20).default(''),
    selfBilling: z.literal(true),
  })
  .strict();
export type CreatorPayoutDetails = z.infer<typeof CreatorPayoutDetailsSchema>;

export const CreatorPortalRangeSchema = z.enum(CREATOR_RANGES);

export type CreatorTierView = {
  id: string;
  name: string;
  from: number;
  commission: number;
};

/** The tier for a month's completed orders. Mirrors the database's `creator_tier()`. */
export function creatorTierFor(orders: number): CreatorTierView {
  return CREATOR_RULES.tiers.reduce<CreatorTierView>(
    (best, tier) => (orders >= tier.from ? tier : best),
    CREATOR_RULES.tiers[0]!,
  );
}

/** Progress from the current tier to the next one, or null at the top tier. */
export function nextCreatorTier(orders: number): {
  name: string;
  at: number;
  remaining: number;
  percent: number;
} | null {
  const current = creatorTierFor(orders);
  const next = CREATOR_RULES.tiers.find((tier) => tier.from > current.from);
  if (!next) return null;
  const span = next.from - current.from;
  return {
    name: next.name,
    at: next.from,
    remaining: next.from - orders,
    percent: Math.max(
      0,
      Math.min(100, Math.floor((100 * (orders - current.from)) / span)),
    ),
  };
}

/** Progress of available commission towards the EUR 50 payout threshold. */
export function creatorPayoutProgress(availableCents: number): {
  percent: number;
  remainingCents: number;
  reached: boolean;
} {
  const minimum = CREATOR_RULES.payoutMinEur * 100;
  const available = Math.max(0, Math.trunc(availableCents));
  return {
    percent: Math.min(100, Math.floor((100 * available) / minimum)),
    remainingCents: Math.max(0, minimum - available),
    reached: available >= minimum,
  };
}

/**
 * Payouts go out in the first week of each month, so the next payout date a creator can count on
 * is the first of the next month (UTC, like the commission months).
 */
export function nextCreatorPayoutDate(now: number = Date.now()): string {
  const at = new Date(now);
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

/** duoly.gg/yourcode: the short link the QR code points at. */
export function creatorShortLink(code: string, origin = 'https://duoly.gg') {
  return `${origin}/${code.toUpperCase().toLowerCase()}`;
}
/** duoly.gg/?ref=YOURCODE: the query link, for places that rewrite paths. */
export function creatorRefLink(code: string, origin = 'https://duoly.gg') {
  return `${origin}/?ref=${code.toUpperCase()}`;
}
