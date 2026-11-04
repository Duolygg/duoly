import type { APIRoute } from 'astro';
import { accountContext } from '../../../server/auth/context';
import { verifyCsrf } from '../../../server/auth/security';
import { consentFromCookies } from '../../../server/consent';
import { supportService } from '../../../server/support/store';
import { recordAnalyticsConsent } from '../../../server/analytics/consent-sync';

export const prerender = false;

export const ALL: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  if (context.request.method !== 'POST') {
    const response = account.json({ error: 'Method not allowed.' }, 405);
    response.headers.set('Allow', 'POST');
    return response;
  }
  const origin = account.config?.origin ?? new URL(context.request.url).origin;
  if (
    !verifyCsrf(
      context.request,
      origin,
      context.cookies.get(account.names.csrf)?.value,
      context.request.headers.get('x-csrf-token'),
    )
  )
    return account.json(
      { error: 'Request could not be verified. Reload and try again.' },
      403,
    );

  try {
    const identity = await account.identity();
    if (!identity)
      return account.json({ error: 'Authentication required.' }, 401);
    const state = consentFromCookies(context.cookies);
    if (state)
      await recordAnalyticsConsent(supportService(), identity.viewer.id, state);
  } catch {
    // Analytics failures must never disrupt the page or an account action.
    console.error('Analytics consent sync failed.');
  }
  return new Response(null, { status: 204, headers: account.headers });
};
