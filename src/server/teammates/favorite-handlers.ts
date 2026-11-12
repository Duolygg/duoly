import type { APIRoute } from 'astro';
import { z } from 'zod';
import { slugValid } from '../../contracts/teammate-profile';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { isMissingRpc } from '../perks/handlers';
import { publicProfilesEnabled } from './public-profiles';

/**
 * POST /api/favorites/by-slug { csrf, slug } -> { favorite, slug, game }
 *
 * "Book with <Name>" and the Save heart on a public profile. Both add the teammate to the
 * customer's favorites, which is what makes the promise on the page true: a favorite sees the
 * order the moment it reaches the public queue with no priority delay
 * (order_visible_at, 20261106150000_customer_favorites.sql).
 *
 * The existing favorites endpoint names a teammate by one of the customer's own orders, which a
 * visitor who never played with them does not have. This one names them by their public slug, and
 * customer_favorite_add_by_slug() in 20261112130000 applies the same customer role check, the same
 * 100 favorite cap and the same locking. Teammate user ids still never leave the database.
 *
 * Adding only: removing a favorite stays on the dashboard, where the customer can see the whole
 * list rather than one profile at a time.
 */
const InputSchema = z.strictObject({
  slug: z.string().refine(slugValid),
});
/** Worded for the customer; anything else falls back to the generic text. */
const PASS_THROUGH = new Set([
  'You can have up to 100 favorites. Remove one first.',
  'That teammate profile is not available.',
]);
const AnswerSchema = z.strictObject({
  favorite: z.literal(true),
  slug: z.string(),
  game: z.string(),
});
const RefusalSchema = z.object({
  error: z.object({ code: z.coerce.number(), message: z.string() }),
});

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown; status?: number }>;

export const favoriteBySlug: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (!publicProfilesEnabled())
      return account.json({ error: 'Not found.' }, 404);
    if (context.request.method !== 'POST') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'POST');
      return response;
    }
    const prepared = await mutation(context);
    account = prepared.account;
    if (prepared.failure) return prepared.failure;
    const body = { ...prepared.body };
    delete body.csrf;
    const input = InputSchema.safeParse(body);
    if (!input.success || context.url.search)
      return account.json({ error: 'Invalid profile request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'customer')
      return account.json({ error: 'Customer role required.' }, 403);
    const rpc = account.client.rpc.bind(account.client) as unknown as Rpc;
    const answer = await rpc('customer_favorite_add_by_slug', {
      p_slug: input.data.slug,
    });
    // Before the migration is applied, saving is simply unavailable.
    if (isMissingRpc(answer))
      return account.json(
        { error: 'Favorites are unavailable right now.' },
        503,
      );
    const refusal = RefusalSchema.safeParse(answer.data);
    if (!answer.error && refusal.success) {
      const { code, message } = refusal.data.error;
      return account.json(
        { error: PASS_THROUGH.has(message) ? message : 'Saving failed.' },
        [400, 401, 403, 404, 409].includes(code) ? code : 503,
      );
    }
    const ok = AnswerSchema.safeParse(answer.data);
    if (answer.error || !ok.success)
      return account.json(
        { error: 'Favorites are unavailable right now.' },
        503,
      );
    return account.json(ok.data);
  } catch {
    return account.json({ error: 'Favorites are unavailable right now.' }, 503);
  }
};
