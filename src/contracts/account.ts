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
export const ProfileSchema = ProfileUpdateSchema.extend({ id: z.uuid() });
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
