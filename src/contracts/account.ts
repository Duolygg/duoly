import { z } from 'zod';
import { COUNTRIES } from '../design-reference/lib/countries.js';

const countryCodes = new Set(COUNTRIES.map((entry) => entry[0]));
export const RoleSchema = z.enum(['customer', 'teammate', 'admin']);
export const ProviderSchema = z.enum(['google', 'discord']);
export const EmailSchema = z
  .string()
  .trim()
  .max(254)
  .toLowerCase()
  .pipe(z.email());
/** Avatars uploaded through /api/me/profile (public Supabase Storage bucket). */
export const UPLOADED_AVATAR =
  /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/avatars\/[0-9a-f-]{36}\/[0-9a-f]{16}\.(webp|jpg)$/;
export const ProfileUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .refine((value) =>
        [...value].every(
          (character) =>
            character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
        ),
      ),
    country: z
      .string()
      .refine((value) => value === '' || countryCodes.has(value)),
    image: z.union([
      z.literal(''),
      z.string().regex(/^\/assets\/avatars\/avatar-([1-9]|10)\.png$/),
      z.string().regex(UPLOADED_AVATAR),
    ]),
  })
  .strict();
/** Original lib/roles.js LANGUAGES, in his order, plus the rest of Europe before Arabic. */
export const PROFILE_LANGUAGES = [
  'English',
  'German',
  'French',
  'Spanish',
  'Portuguese',
  'Italian',
  'Dutch',
  'Polish',
  'Swedish',
  'Turkish',
  'Russian',
  'Ukrainian',
  'Greek',
  'Czech',
  'Slovak',
  'Hungarian',
  'Romanian',
  'Bulgarian',
  'Croatian',
  'Serbian',
  'Slovenian',
  'Bosnian',
  'Albanian',
  'Macedonian',
  'Danish',
  'Norwegian',
  'Finnish',
  'Icelandic',
  'Estonian',
  'Latvian',
  'Lithuanian',
  'Catalan',
  'Arabic',
  'Japanese',
  'Korean',
  'Chinese',
] as const;
export const BIO_MAX = 160;
export const LANGUAGES_MAX = 6;
export const CurrencySchema = z.enum(['EUR', 'USD']);
export type Currency = z.infer<typeof CurrencySchema>;
/**
 * Original saveProfile: control characters other than line breaks are dropped,
 * then the text is trimmed and cut to 160 characters.
 */
export function normalizeBio(value: unknown): string {
  const clean = String(value ?? '').replace(
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g,
    '',
  );
  return Array.from(clean.trim()).slice(0, BIO_MAX).join('').trim();
}
/** Original saveProfile: known languages only, up to six (duplicates dropped). */
export function normalizeLanguages(value: unknown): string[] {
  const known = new Set<string>(PROFILE_LANGUAGES);
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.filter((l): l is string => known.has(l)))].slice(
    0,
    LANGUAGES_MAX,
  );
}
export const ProfileSchema = ProfileUpdateSchema.extend({
  id: z.uuid(),
  bio: z.string().max(BIO_MAX).default(''),
  languages: z.array(z.enum(PROFILE_LANGUAGES)).max(LANGUAGES_MAX).default([]),
  currency: CurrencySchema.nullable().default(null),
});
export const ViewerSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.email().nullable(),
    image: z.string(),
    provider: z.enum(['google', 'discord', 'email']),
    role: RoleSchema,
  })
  .strict();
export const DiscordLinkSchema = z
  .object({
    id: z.string().regex(/^[0-9]{17,20}$/),
    username: z.string().max(64),
    /** Signs in with Discord only, so the link cannot be removed. */
    auto: z.boolean(),
  })
  .strict();
export type DiscordLink = z.infer<typeof DiscordLinkSchema>;
export const DiscordResultSchema = z.enum([
  'linked',
  'cancelled',
  'taken',
  'failed',
  'unavailable',
]);
export type DiscordResult = z.infer<typeof DiscordResultSchema>;
export type Viewer = z.infer<typeof ViewerSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
export interface LoginProviders {
  google: boolean;
  discord: boolean;
  email: boolean;
}
