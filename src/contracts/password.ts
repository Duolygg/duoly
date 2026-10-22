import { z } from 'zod';
import { EmailSchema } from './account';

// The password is never trimmed: whitespace may be intentional.
export const PasswordSchema = z.string().min(8).max(128);
export const PasswordCredentialsSchema = z
  .object({
    email: EmailSchema,
    password: PasswordSchema,
  })
  .strict();
export type PasswordCredentials = z.infer<typeof PasswordCredentialsSchema>;
