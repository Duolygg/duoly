import { trackRequest } from '../analytics/client';
import { decodeAvatar, storeAvatar } from './avatar';
import { afterLoginPath } from './after-login';
import type { APIContext, APIRoute } from 'astro';
import {
  CurrencySchema,
  ProfileUpdateSchema,
  ProviderSchema,
  normalizeBio,
  normalizeLanguages,
} from '../../contracts/account';
import { accountContext } from './context';
import { readBoundedBody, verifyCsrf } from './security';
import { linkErrorResult } from '../discord/oauth';
import { syncRolesAfter } from '../discord/role-hooks';

export async function mutation(context: APIContext, maxBytes = 4096) {
  const account = accountContext(context.request, context.cookies);
  let body: Record<string, unknown>;
  try {
    body = await readBoundedBody(context.request, maxBytes);
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
  const params = context.url.searchParams;
  const code = params.get('code');
  // Connect Discord returns here with ?next=profile|teammate (identity linking).
  const next = params.get('next');
  const linking = next === 'profile' || next === 'teammate' ? next : null;
  // Password recovery links return here with ?next=reset.
  const recovery = next === 'reset';
  if (linking && (params.has('error') || params.has('error_code')))
    return account.redirect(`/${linking}?discord=${linkErrorResult(params)}`);
  const fail = linking ? `/${linking}?discord=failed` : '/login?error=callback';
  // Google or Discord sign-in of a suspended teammate: Auth sends them back with the ban.
  if (
    !linking &&
    (params.get('error_code') === 'user_banned' ||
      /banned/i.test(params.get('error_description') ?? ''))
  )
    return account.redirect('/login?error=suspended');
  if (
    !account.config ||
    !account.client ||
    !code ||
    code.length > 2048 ||
    context.url.origin !== account.config.origin
  )
    return account.redirect(fail);
  try {
    const { data, error } =
      await account.client.auth.exchangeCodeForSession(code);
    if (error)
      return account.redirect(
        error.code === 'user_banned' && !linking
          ? '/login?error=suspended'
          : fail,
      );
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
    // A Discord link or sign-in can change the server roles of teammates and admins (#40).
    if (identity.viewer.role !== 'customer')
      await syncRolesAfter({ users: [identity.viewer.id] });
    if (linking) {
      trackRequest(context, identity.viewer.id, 'discord_linked');
      return account.redirect(`/${linking}?discord=linked`);
    }
    if (recovery) return account.redirect('/reset-password?step=new');
    trackRequest(context, identity.viewer.id, 'user_logged_in', {
      method: data?.user?.app_metadata?.provider ?? 'other',
    });
    context.cookies.delete(account.names.csrf, account.cookieOptions);
    return account.redirect(afterLoginPath(context.cookies));
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
  // Room for one cropped 256×256 avatar as a data URL.
  const { account, body, failure } = await mutation(context, 160_000);
  if (failure || !body) return failure!;
  if (!account.client)
    return account.json({ error: 'Sign in to update your profile.' }, 401);
  try {
    const identity = await account.identity();
    if (!identity)
      return account.json({ error: 'Sign in to update your profile.' }, 401);
    const { csrf: _csrf, upload, bio, languages, ...input } = body;
    void _csrf;
    // Original api/me/profile: bio and languages are shown to customers, so only
    // teammates have them; for everyone else they are ignored.
    const teammate = identity.viewer.role === 'teammate';
    const extra: { bio?: string; languages?: string[] } = {};
    if (teammate && bio !== undefined) extra.bio = normalizeBio(bio);
    if (teammate && languages !== undefined)
      extra.languages = normalizeLanguages(languages);
    if (upload !== undefined) {
      const avatar = decodeAvatar(upload);
      if (!avatar)
        return account.json(
          { error: 'That picture couldn’t be used. Try a JPG or PNG.' },
          400,
        );
      const url = await storeAvatar(identity.viewer.id, avatar);
      if (!url)
        return account.json(
          { error: 'Your picture couldn’t be uploaded. Please try again.' },
          503,
        );
      input.image = url;
    }
    const update = ProfileUpdateSchema.safeParse(input);
    if (!update.success)
      return account.json(
        { error: 'Choose a valid name, country and avatar.' },
        400,
      );
    const { data, error } = await account.client
      .from('profiles')
      .update({ ...update.data, ...extra })
      .eq('id', identity.viewer.id)
      .select('*')
      .single();
    if (error || !data)
      return account.json(
        { error: 'Your profile could not be saved. Please try again.' },
        503,
      );
    const row = data as Record<string, unknown>;
    return account.json({
      profile: {
        ...ProfileUpdateSchema.parse({
          name: row.name,
          country: row.country,
          image: row.image,
        }),
        bio: typeof row.bio === 'string' ? row.bio : '',
        languages: Array.isArray(row.languages) ? row.languages : [],
      },
    });
  } catch {
    return account.json(
      { error: 'Your profile could not be saved. Please try again.' },
      503,
    );
  }
};
/** Original api/me/currency: saves the display currency on the account. */
export const saveCurrency: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context);
  if (failure || !body) return failure!;
  if (!account.client) return account.json({ error: 'Sign in first.' }, 401);
  const currency = CurrencySchema.safeParse(body.currency);
  if (!currency.success)
    return account.json({ error: 'Unknown currency.' }, 400);
  try {
    const identity = await account.identity();
    if (!identity) return account.json({ error: 'Sign in first.' }, 401);
    const { error } = await account.client
      .from('profiles')
      .update({ currency: currency.data })
      .eq('id', identity.viewer.id);
    if (error)
      return account.json(
        { error: 'Your currency could not be saved. Please try again.' },
        503,
      );
    return account.json({ currency: currency.data });
  } catch {
    return account.json(
      { error: 'Your currency could not be saved. Please try again.' },
      503,
    );
  }
};
export const methodNotAllowed: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
  });
