import type { APIRoute } from 'astro';
import {
  OrderCommandSchema,
  OrderFavoriteInputSchema,
  OrderRpcErrorSchema,
  type CustomerFavorites,
  type OrderFavorite,
} from '../../contracts/orders';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { decodeOrderRpcResult } from '../orders/results';
import { isMissingRpc } from '../perks/handlers';

// Favorite teammates (migration 20261106150000_customer_favorites.sql). Teammate user ids never
// leave the database: an order of the customer's own names the teammate.

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown; status?: number }>;

/** Refusals worded for the customer; anything else falls back to the generic order text. */
const FAVORITE_MESSAGES = new Set([
  'You can favorite your teammate once they accept.',
  'You can have up to 100 favorites. Remove one first.',
]);

const NOT_YET: OrderFavorite = { available: false, favorite: false };
const NONE: CustomerFavorites = { favorites: [] };

function wrongMethod(
  account: ReturnType<typeof accountContext>,
  allow: string,
) {
  const response = account.json({ error: 'Method not allowed.' }, 405);
  response.headers.set('Allow', allow);
  return response;
}

/**
 * GET  /api/orders/:id/favorite -> { available, favorite }
 * POST /api/orders/:id/favorite { csrf, on } -> { available, favorite }
 */
export const orderFavorite: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    const method = context.request.method;
    if (method !== 'GET' && method !== 'POST')
      return wrongMethod(account, 'GET, POST');
    let on: boolean | null = null;
    if (method === 'POST') {
      const prepared = await mutation(context);
      account = prepared.account;
      if (prepared.failure) return prepared.failure;
      const input = OrderFavoriteInputSchema.safeParse(prepared.body);
      if (!input.success)
        return account.json({ error: 'Invalid order request.' }, 400);
      on = input.data.on;
    }
    const command = OrderCommandSchema.safeParse({
      order_id: context.params.id,
    });
    if (!command.success || context.url.search)
      return account.json({ error: 'Invalid order request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'customer')
      return account.json({ error: 'Order access denied.' }, 403);
    const rpc = account.client.rpc.bind(account.client) as unknown as Rpc;
    const answer =
      on === null
        ? await rpc('customer_order_favorite', {
            p_order: command.data.order_id,
          })
        : await rpc('customer_order_favorite_set', {
            p_order: command.data.order_id,
            p_on: on,
          });
    // Before the migration: no heart (GET), and saving is unavailable (POST).
    if (isMissingRpc(answer))
      return on === null
        ? account.json(NOT_YET)
        : account.json({ error: 'Favorites are unavailable right now.' }, 503);
    const result = decodeOrderRpcResult(
      'orderFavorite',
      answer.data,
      answer.error,
    );
    if (!result.ok) {
      const refusal = OrderRpcErrorSchema.safeParse(answer.data);
      if (
        (answer.error === null || answer.error === undefined) &&
        refusal.success &&
        FAVORITE_MESSAGES.has(refusal.data.error.message)
      )
        return account.json(
          { error: refusal.data.error.message },
          result.status,
        );
      return account.json(result.payload, result.status);
    }
    return account.json({
      available: result.payload.available,
      favorite: result.payload.favorite,
    } satisfies OrderFavorite);
  } catch {
    return account.json({ error: 'Order service unavailable.' }, 503);
  }
};

/** GET /api/orders/favorites -> { favorites: [...] } */
export const favorites: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    if (context.request.method !== 'GET') return wrongMethod(account, 'GET');
    if (context.url.search)
      return account.json({ error: 'Invalid order request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'customer')
      return account.json({ error: 'Order access denied.' }, 403);
    const rpc = account.client.rpc.bind(account.client) as unknown as Rpc;
    const answer = await rpc('customer_favorites');
    if (isMissingRpc(answer)) return account.json(NONE);
    const result = decodeOrderRpcResult(
      'customerFavorites',
      answer.data,
      answer.error,
    );
    if (!result.ok) return account.json(result.payload, result.status);
    // Belt and braces: never more than the declared fields.
    return account.json({
      favorites: result.payload.favorites.map((f) => ({
        handle: f.handle,
        name: f.name,
        image: f.image,
        country: f.country,
        game: f.game,
        orders: f.orders,
        status: f.status,
      })),
    } satisfies CustomerFavorites);
  } catch {
    return account.json({ error: 'Order service unavailable.' }, 503);
  }
};
