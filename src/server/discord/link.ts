import { trackRequest } from '../analytics/client';
import type { APIRoute } from 'astro';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { discordReturn, isDiscordAuthorizeUrl } from './oauth';
import { syncRolesAfter } from './role-hooks';

/**
 * Connect Discord (port of the original app/api/discord/link routes).
 *
 * The original exchanged the OAuth code itself and stored the Discord id. Here Supabase Auth does
 * the exchange through manual identity linking, so the verified Discord identity lives in
 * auth.identities and a database trigger mirrors it into public.discord_accounts and teammate
 * queue access. The site never accepts a Discord id from the browser.
 */
export const connect: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context);
  const back = discordReturn(body?.next);
  if (failure || !body) return account.redirect(`/${back}?discord=failed`);
  if (!account.config?.providers.discord || !account.client)
    return account.redirect(`/${back}?discord=unavailable`);
  try {
    const identity = await account.identity();
    if (!identity) return account.redirect('/?signin=1');
    const { data, error } = await account.client.auth.linkIdentity({
      provider: 'discord',
      options: {
        redirectTo: `${account.config.origin}/auth/callback?next=${back}`,
        skipBrowserRedirect: true,
        scopes: 'identify',
      },
    });
    if (
      error ||
      !data?.url ||
      !isDiscordAuthorizeUrl(data.url, account.config.url)
    )
      return account.redirect(`/${back}?discord=failed`);
    return account.redirect(data.url);
  } catch {
    return account.redirect(`/${back}?discord=failed`);
  }
};

export const TEAMMATE_STAYS_CONNECTED =
  'Teammates stay connected to Discord. Ask an admin if you need to change your Discord account.';

export const disconnect: APIRoute = async (context) => {
  const { account, failure } = await mutation(context);
  if (failure) return failure;
  if (!account.client)
    return account.json({ error: 'Sign in to manage Discord.' }, 401);
  try {
    const identity = await account.identity();
    if (!identity)
      return account.json({ error: 'Sign in to manage Discord.' }, 401);
    // Teammates work through the Duoly Discord (roles, order posts, handovers), so only an
    // admin's or a customer's Discord can be disconnected here.
    if (identity.viewer.role === 'teammate')
      return account.json({ error: TEAMMATE_STAYS_CONNECTED }, 403);
    const { data, error } = await account.client.auth.getUserIdentities();
    if (error || !data)
      return account.json(
        { error: 'Couldn’t disconnect. Please try again.' },
        503,
      );
    const discord = data.identities.find(
      (entry) => entry.provider === 'discord',
    );
    if (!discord) return account.json({ ok: true });
    if (data.identities.length < 2)
      return account.json(
        {
          error:
            'You sign in with Discord, so it stays connected. Add another sign-in method first.',
        },
        409,
      );
    const result = await account.client.auth.unlinkIdentity(discord);
    if (result.error)
      return account.json(
        { error: 'Couldn’t disconnect. Please try again.' },
        503,
      );
    // The bot takes its roles back from the Discord account that was just disconnected (#40).
    await syncRolesAfter({ users: [identity.viewer.id] });
    trackRequest(context, identity.viewer.id, 'discord_unlinked');
    return account.json({ ok: true });
  } catch {
    return account.json(
      { error: 'Couldn’t disconnect. Please try again.' },
      503,
    );
  }
};

/** Read-only state for islands that refresh without a full page load. */
export const status: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    const identity = await account.identity();
    if (!identity) return account.json({ error: 'Sign in first.' }, 401);
    return account.json({ discord: identity.discord });
  } catch {
    return account.json({ error: 'Your account could not be loaded.' }, 503);
  }
};
