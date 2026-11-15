import { signInMessage, signInPath } from '../../site/sign-in';
import { afterLogin } from './after-login';
import { trackRequest } from '../analytics/client';
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

// The sign-in popup asks for a JSON answer so it can show the message in place; a plain
// form post (no JavaScript) is redirected to the homepage popup with the same outcome.
const POPUP_MESSAGES: Record<string, { error?: string; notice?: string }> = {
  [signInPath({ error: 'credentials' })]: signInMessage(
    new URLSearchParams('error=credentials'),
  ),
  [signInPath({ error: 'eligibility' })]: signInMessage(
    new URLSearchParams('error=eligibility'),
  ),
  // Registering an address that already exists is an error in the popup.
  [signInPath({ notice: 'registered' })]: {
    error: signInMessage(new URLSearchParams('notice=registered')).notice,
  },
  [signInPath({ notice: 'confirmation' })]: signInMessage(
    new URLSearchParams('notice=confirmation'),
  ),
};
function responder(
  context: Parameters<APIRoute>[0],
  account: {
    redirect: (path: string) => Response;
    json: (body: unknown, status?: number) => Response;
  },
) {
  const popup = context.request.headers.get('x-duoly-auth') === 'popup';
  return (path: string) => {
    if (!popup) return account.redirect(path);
    const message = POPUP_MESSAGES[path];
    if (message?.error) return account.json({ error: message.error }, 400);
    if (message?.notice) return account.json({ notice: message.notice });
    return account.json({ redirect: path });
  };
}

export const loginPassword: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context);
  if (failure || !body) return failure!;
  const done = responder(context, account);
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
    // A suspended teammate (banned in Auth) gets told why; everything else stays generic.
    if (error)
      return done(
        error.code === 'user_banned'
          ? signInPath({ error: 'suspended' })
          : signInPath({ error: 'credentials' }),
      );
    const identity = await account.identity();
    const testEmail = account.config.testEmail;
    if (!identity) {
      try {
        await account.client.auth.signOut({ scope: 'local' });
      } catch {
        /* Local session cookies are cleared below regardless. */
      }
      account.clear();
      return done(signInPath({ error: 'credentials' }));
    }
    if (testEmail && identity.viewer.email?.toLowerCase() !== testEmail) {
      try {
        await account.client.auth.signOut({ scope: 'local' });
      } catch {
        /* Local session cookies are cleared below regardless. */
      }
      account.clear();
      return done(signInPath({ error: 'eligibility' }));
    }
    context.cookies.delete(account.names.csrf, account.cookieOptions);
    trackRequest(context, identity.viewer.id, 'user_logged_in', {
      method: 'password',
    });
    return done(
      await afterLogin(context.cookies, identity.viewer.role, account.client),
    );
  } catch {
    account.clear();
    return done(signInPath({ error: 'credentials' }));
  }
};

export const registerPassword: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context);
  if (failure || !body) return failure!;
  const done = responder(context, account);
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
      return done(signInPath({ notice: 'registered' }));
    }
    if (error || !data?.session)
      return done(signInPath({ notice: 'confirmation' }));
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
      return done(signInPath({ notice: 'confirmation' }));
    }
    context.cookies.delete(account.names.csrf, account.cookieOptions);
    return done(
      await afterLogin(context.cookies, identity.viewer.role, account.client),
    );
  } catch {
    account.clear();
    return done(signInPath({ notice: 'confirmation' }));
  }
};
