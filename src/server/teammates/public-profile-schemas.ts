import { z } from 'zod';
import {
  PROFILE_ACCENT_KEYS,
  PROFILE_BANNERS,
  TRUST_TIERS,
  VIBE_TAGS,
  slugValid,
} from '../../contracts/teammate-profile';
const slug = z.string().refine(slugValid);
const count = z.number().int().nonnegative();
const rating = z
  .object({ average: z.number().min(1).max(5), count: count.min(5) })
  .nullable();
const game = z.object({
  game: z.string(),
  rank: z.string().nullable(),
  peakRank: z.string().nullable(),
  verified: z.boolean(),
  roles: z.array(z.string()).max(3),
  picks: z.array(z.string()).max(5),
});
const common = {
  slug,
  name: z.string(),
  avatar: z
    .string()
    .regex(
      /^\/assets\/avatars\/(?:avatar-(?:[1-9]|10)\.png|[a-zA-Z0-9/_-]+\.(?:webp|png|jpg))$/,
    ),
  accent: z.enum(PROFILE_ACCENT_KEYS),
  tier: z.enum(TRUST_TIERS),
  online: z.boolean(),
  rating,
};
export const publicCardSchema = z.object({
  ...common,
  game: z.string(),
  rank: z.string().nullable(),
});
export const publicProfileSchema = z.object({
  ...common,
  country: z.string().nullable(),
  languages: z.array(z.string()),
  bio: z.string().max(160),
  banner: z.enum(PROFILE_BANNERS),
  vibeTags: z.array(z.enum(VIBE_TAGS)).max(3),
  featuredGame: z.string(),
  coaching: z.boolean(),
  memberSince: z.string().regex(/^\d{4}-\d{2}$/),
  sessions: count,
  reviewTags: z.array(z.object({ tag: z.string(), count })),
  winRate: z
    .object({ percent: z.number().min(0).max(100), games: count.min(20) })
    .nullable(),
  games: z.array(game),
  reviews: z
    .array(
      z.object({
        rating: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(5),
        ]),
        text: z.string(),
        game: z.string(),
        month: z.string().regex(/^\d{4}-\d{2}$/),
      }),
    )
    .max(6),
  updatedAt: z.iso.datetime({ offset: true }),
});
export const publicLookupSchema = z.union([
  publicProfileSchema.transform((profile) => ({
    status: 'ok' as const,
    profile,
  })),
  z.object({ status: z.literal('moved'), slug }),
  z.object({ status: z.enum(['gone', 'missing']) }),
]);
export const indexableSchema = z.array(
  z.object({ slug, updatedAt: z.iso.datetime({ offset: true }) }),
);
