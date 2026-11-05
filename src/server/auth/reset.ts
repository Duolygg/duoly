import { trackRequest } from '../analytics/client';
import type { APIRoute } from 'astro';
import { EmailSchema } from '../../contracts/account';
import { PasswordSchema } from '../../contracts/password';
import { mutation } from './handlers';

/**
 * Sends a Supabase recovery email. Always answers the same way so the form
 * never reveals whether an address has an account.
 */
export const requestReset: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context);
  if (failure || !body) return failure!;
  if (!account.client || !account.config?.providers.email)
    return account.redirect('/reset-password?error=unavailable');
  const email = EmailSchema.safeParse(body.email);
  if (!email.success) return account.redirect('/reset-password?error=email');
  try {
    const result = await account.client.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${account.config.origin}/auth/callback?next=reset`,
    });
    if (!result?.error) trackRequest(context, null, 'password_reset_requested');
  } catch {
    /* Same answer either way. */
  }
  return account.redirect('/reset-password?sent=1');
};

/** Sets a new password for the session opened by the recovery link. */
export const updatePassword: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context);
  if (failure || !body) return failure!;
  if (!account.client)
    return account.redirect('/reset-password?error=unavailable');
  const password = PasswordSchema.safeParse(body.password);
  if (!password.success)
    return account.redirect('/reset-password?step=new&error=password');
  try {
    const identity = await account.identity();
    if (!identity) return account.redirect('/reset-password?error=expired');
    const { error } = await account.client.auth.updateUser({
      password: password.data,
    });
    if (error)
      return account.redirect('/reset-password?step=new&error=password');
    return account.redirect('/dashboard?password=updated');
  } catch {
    return account.redirect('/reset-password?error=unavailable');
  }
};
