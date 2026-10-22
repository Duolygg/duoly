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
export type Viewer = z.infer<typeof ViewerSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
export interface LoginProviders {
  google: boolean;
  discord: boolean;
  email: boolean;
}
