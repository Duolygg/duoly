import type { APIRoute } from 'astro';
import {
  publicProfileSettingsSchema,
  slugValid,
} from '../../contracts/teammate-profile';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { publicProfilesEnabled } from './public-profiles';
import { pingProfileChanges } from './indexnow';

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
export const publicProfileSettings: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (!publicProfilesEnabled())
      return account.json({ error: 'Not found.' }, 404);
    const method = context.request.method;
    if (method !== 'GET' && method !== 'POST') {
      const res = account.json({ error: 'Method not allowed.' }, 405);
      res.headers.set('Allow', 'GET, POST');
      return res;
    }
    const slug = context.url.searchParams.get('slug');
    if (
      context.url.search &&
      (method !== 'GET' ||
        !slug ||
        !slugValid(slug) ||
        [...context.url.searchParams.keys()].some((k) => k !== 'slug'))
    )
      return account.json({ error: 'Invalid profile request.' }, 400);
    let settings = null;
    if (method === 'POST') {
      const prepared = await mutation(context, 16384);
      account = prepared.account;
      if (prepared.failure) return prepared.failure;
      const body = { ...prepared.body };
      delete body.csrf;
      const result = publicProfileSettingsSchema.strict().safeParse(body);
      if (!result.success)
        return account.json(
          { error: 'Check your public profile settings.' },
          400,
        );
      settings = result.data;
    }
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json({ error: 'Teammate role required.' }, 403);
    const rpc = account.client.rpc.bind(account.client) as unknown as Rpc;
    if (slug) {
      const result = await rpc('teammate_public_slug_available', {
        p_slug: slug,
      });
      if (
        result.error ||
        !result.data ||
        typeof result.data !== 'object' ||
        !('available' in result.data)
      )
        return account.json(
          { error: 'Link availability is unavailable.' },
          503,
        );
      return account.json({ available: result.data.available === true });
    }
    const old = settings ? await rpc('teammate_public_profile_get') : null;
    const answer = settings
      ? await rpc('teammate_public_profile_save', { p_settings: settings })
      : await rpc('teammate_public_profile_get');
    if (answer.error || !answer.data || typeof answer.data !== 'object')
      return account.json(
        { error: 'Public profiles are unavailable right now.' },
        503,
      );
    const data = answer.data as {
      error?: { code?: unknown; message?: unknown };
      settings?: { slug?: string; published?: boolean };
    };
    if (data.error) {
      const code = Number(data.error.code);
      const message =
        code === 409
          ? 'That profile link is unavailable.'
          : code === 400
            ? 'Check your public profile settings. Remove contact details and links from your bio.'
            : 'Public profile access denied.';
      return account.json(
        { error: message },
        [400, 401, 403, 404, 409].includes(code) ? code : 503,
      );
    }
    if (!data.settings)
      return account.json(
        { error: 'Public profiles are unavailable right now.' },
        503,
      );
    if (settings) {
      const before =
        old && !old.error && old.data && typeof old.data === 'object'
          ? ((old.data as { settings?: { slug?: string; published?: boolean } })
              .settings ?? null)
          : null;
      pingProfileChanges(before, settings);
    }
    return account.json(answer.data);
  } catch {
    return account.json(
      { error: 'Public profiles are unavailable right now.' },
      503,
    );
  }
};
