import { afterLoginPath } from './after-login';
import type { APIRoute } from 'astro';
import { PasswordCredentialsSchema } from '../../contracts/password';
import { mutation } from './handlers';

function parseCredentials(
  account: {
    json: (body: unknown, status?: number) => Response;
  },
  body: Record<string, unknown>,
) {
  // The strict schema rejects unknown keys; the verified CSRF token is stripped first.
  const { csrf: _csrf, ...input } = body;
  void _csrf;
  const credentials = PasswordCredentialsSchema.safeParse(input);
  if (!credentials.success)
    return {
      credentials: null,
      failure: account.json(
        {
          error:
            'Enter a valid email address and a password of 8 to 128 characters.',
        },
        400,
      ),
    };
  return { credentials: credentials.data, failure: null };
}

export const loginPassword: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context);
  if (failure || !body) return failure!;
  if (!account.client || !account.config?.providers.email)
    return account.json({ error: 'Email sign-in is not configured.' }, 503);
  const parsed = parseCredentials(account, body);
  if (parsed.failure || !parsed.credentials) return parsed.failure!;
  try {
    // Never reveal whether the address exists or which check failed.
    const { error } = await account.client.auth.signInWithPassword({
      email: parsed.credentials.email,
      password: parsed.credentials.password,
    });
    if (error) return account.redirect('/login?error=credentials');
    const identity = await account.identity();
    const testEmail = account.config.testEmail;
    if (!identity) {
      try {
        await account.client.auth.signOut({ scope: 'local' });
      } catch {
        /* Local session cookies are cleared below regardless. */
      }
      account.clear();
      return account.redirect('/login?error=credentials');
    }
    if (testEmail && identity.viewer.email?.toLowerCase() !== testEmail) {
      try {
        await account.client.auth.signOut({ scope: 'local' });
      } catch {
        /* Local session cookies are cleared below regardless. */
      }
      account.clear();
      return account.redirect('/login?error=eligibility');
    }
    context.cookies.delete(account.names.csrf, account.cookieOptions);
    return account.redirect(afterLoginPath(context.cookies));
  } catch {
    account.clear();
    return account.redirect('/login?error=credentials');
  }
};

export const registerPassword: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context);
  if (failure || !body) return failure!;
  if (!account.client || !account.config?.providers.email)
    return account.json({ error: 'Email sign-in is not configured.' }, 503);
  if (!account.config.signup)
    return account.json({ error: 'Registration is not available.' }, 503);
  const parsed = parseCredentials(account, body);
  if (parsed.failure || !parsed.credentials) return parsed.failure!;
  const testEmail = account.config.testEmail;
  if (testEmail && parsed.credentials.email !== testEmail)
    return account.json(
      {
        error: 'This environment is restricted to its approved test account.',
      },
      403,
    );
  try {
    const { data, error } = await account.client.auth.signUp({
      email: parsed.credentials.email,
      password: parsed.credentials.password,
      options: { emailRedirectTo: account.config.origin + '/auth/callback' },
    });
    // Owner decision: tell people when an address is already registered.
    // Supabase hides it by returning a user without identities (or a 422
    // when confirmations are off), and sends no email in that case.
    const alreadyRegistered = error
      ? /already registered|already exists/i.test(error.message ?? '')
      : !!data?.user && (data.user.identities?.length ?? 1) === 0;
    if (alreadyRegistered) {
      // Short-lived, httpOnly: lets /login prefill the address once.
      context.cookies.set(account.names.pending, parsed.credentials.email, {
        ...account.cookieOptions,
        maxAge: 300,
      });
      return account.redirect('/login?notice=registered');
    }
    if (error || !data?.session)
      return account.redirect('/login?notice=confirmation');
    const identity = await account.identity();
    if (
      !identity ||
      (testEmail && identity.viewer.email?.toLowerCase() !== testEmail)
    ) {
      try {
        await account.client.auth.signOut({ scope: 'local' });
      } catch {
        /* Local session cookies are cleared below regardless. */
      }
      account.clear();
      return account.redirect('/login?notice=confirmation');
    }
    context.cookies.delete(account.names.csrf, account.cookieOptions);
    return account.redirect(afterLoginPath(context.cookies));
  } catch {
    account.clear();
    return account.redirect('/login?notice=confirmation');
  }
};
