import type { APIContext, APIRoute } from 'astro';
import { ProfileUpdateSchema, ProviderSchema } from '../../contracts/account';
import { accountContext } from './context';
import { readBoundedBody, verifyCsrf } from './security';

export async function mutation(context: APIContext) {
  const account = accountContext(context.request, context.cookies);
  let body: Record<string, unknown>;
  try {
    body = await readBoundedBody(context.request);
  } catch {
    return {
      account,
      body: null,
      failure: account.json({ error: 'Invalid or oversized request.' }, 400),
    };
  }
  const origin = account.config?.origin ?? new URL(context.request.url).origin;
  if (
    !verifyCsrf(
      context.request,
      origin,
      context.cookies.get(account.names.csrf)?.value,
      body.csrf,
    )
  ) {
    return {
      account,
      body: null,
      failure: account.json(
        { error: 'Request could not be verified. Reload and try again.' },
        403,
      ),
    };
  }
  return { account, body, failure: null };
}
export const oauth: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context);
  if (failure || !body) return failure!;
  const provider = ProviderSchema.safeParse(body.provider);
  if (!provider.success)
    return account.json({ error: 'Unsupported provider.' }, 400);
  if (
    !account.config ||
    !account.client ||
    !account.config.providers[provider.data]
  )
    return account.json(
      { error: 'This sign-in method is not configured.' },
      503,
    );
  try {
    const { data, error } = await account.client.auth.signInWithOAuth({
      provider: provider.data,
      options: {
        redirectTo: account.config.origin + '/auth/callback',
        skipBrowserRedirect: true,
        scopes:
          provider.data === 'discord'
            ? 'identify email'
            : 'openid email profile',
      },
    });
    if (error || !data.url) return account.redirect('/login?error=provider');
    const url = new URL(data.url);
    if (
      url.origin !== account.config.url ||
      url.pathname !== '/auth/v1/authorize'
    )
      return account.redirect('/login?error=provider');
    return account.redirect(url.href);
  } catch {
    return account.redirect('/login?error=provider');
  }
};
export const callback: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  const code = context.url.searchParams.get('code');
  if (
    !account.config ||
    !account.client ||
    !code ||
    code.length > 2048 ||
    context.url.origin !== account.config.origin
  )
    return account.redirect('/login?error=callback');
  try {
    const { error } = await account.client.auth.exchangeCodeForSession(code);
    if (error) return account.redirect('/login?error=callback');
    const identity = await account.identity();
    if (!identity) {
      try {
        await account.client.auth.signOut({ scope: 'local' });
      } finally {
        account.clear();
      }
      return account.redirect('/login?error=callback');
    }
    const testEmail = account.config.testEmail;
    if (testEmail && identity.viewer.email?.toLowerCase() !== testEmail) {
      await account.client.auth.signOut({ scope: 'local' });
      account.clear();
      return account.redirect('/login?error=eligibility');
    }
    context.cookies.delete(account.names.csrf, account.cookieOptions);
    return account.redirect('/dashboard');
  } catch {
    account.clear();
    return account.redirect('/login?error=callback');
  }
};
export const logout: APIRoute = async (context) => {
  const { account, failure } = await mutation(context);
  if (failure) return failure;
  try {
    await account.client?.auth.signOut({ scope: 'local' });
  } catch {
    /* Clearing this browser remains necessary if the provider is unavailable. */
  }
  account.clear();
  return account.redirect('/login');
};
export const getProfile: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    const identity = await account.identity();
    return identity
      ? account.json({ profile: identity.profile })
      : account.json({ error: 'Sign in to view your profile.' }, 401);
  } catch {
    return account.json({ error: 'Your account could not be loaded.' }, 503);
  }
};
export const saveProfile: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context);
  if (failure || !body) return failure!;
  if (!account.client)
    return account.json({ error: 'Sign in to update your profile.' }, 401);
  try {
    const identity = await account.identity();
    if (!identity)
      return account.json({ error: 'Sign in to update your profile.' }, 401);
    const { csrf: _csrf, ...input } = body;
    void _csrf;
    const update = ProfileUpdateSchema.safeParse(input);
    if (!update.success)
      return account.json(
        { error: 'Choose a valid name, country and avatar preset.' },
        400,
      );
    const { data, error } = await account.client
      .from('profiles')
      .update(update.data)
      .eq('id', identity.viewer.id)
      .select('id,name,country,image')
      .single();
    if (error || !data)
      return account.json(
        { error: 'Your profile could not be saved. Please try again.' },
        503,
      );
    return account.json({
      profile: ProfileUpdateSchema.parse({
        name: data.name,
        country: data.country,
        image: data.image,
      }),
    });
  } catch {
    return account.json(
      { error: 'Your profile could not be saved. Please try again.' },
      503,
    );
  }
};
export const methodNotAllowed: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
  });
