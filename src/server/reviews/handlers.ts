import type { APIRoute } from 'astro';
import {
  ReviewInputSchema,
  TeammateStatsResponseSchema,
} from '../../contracts/reviews';
import {
  OrderCommandSchema,
  OrderRpcErrorSchema,
} from '../../contracts/orders';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { decodeOrderRpcResult } from '../orders/results';

// Original customer copy from lib/orders.js review() (lines 278 to 282). Any other
// backend message falls back to the generic order boundary text.
const REVIEW_MESSAGES = new Set([
  'You can rate your teammate once the order is done.',
  'You already rated this order. Thank you!',
  'Pick 1 to 5 stars.',
]);

export const review: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (context.request.method !== 'POST') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'POST');
      return response;
    }
    const prepared = await mutation(context);
    account = prepared.account;
    if (prepared.failure) return prepared.failure;
    const input = ReviewInputSchema.safeParse(prepared.body);
    if (!input.success)
      return account.json({ error: 'Invalid order request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'customer')
      return account.json({ error: 'Order access denied.' }, 403);
    const command = OrderCommandSchema.safeParse({
      order_id: context.params.id,
    });
    if (!command.success || context.url.search)
      return account.json({ error: 'Invalid order request.' }, 400);
    const { data, error } = await account.client.rpc('order_review', {
      p_order_id: command.data.order_id,
      p_rating: input.data.rating,
      p_text: input.data.text,
      p_tags: input.data.tags,
    });
    const result = decodeOrderRpcResult('customerOrder', data, error);
    if (!result.ok && (error === null || error === undefined)) {
      const refusal = OrderRpcErrorSchema.safeParse(data);
      if (refusal.success && REVIEW_MESSAGES.has(refusal.data.error.message))
        return account.json(
          { error: refusal.data.error.message },
          result.status,
        );
    }
    return account.json(result.payload, result.status);
  } catch {
    return account.json({ error: 'Order service unavailable.' }, 503);
  }
};

export const stats: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    if (context.request.method !== 'GET') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET');
      return response;
    }
    if (context.url.search)
      return account.json({ error: 'Invalid stats request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json({ error: 'Stats access denied.' }, 403);
    const { data, error } = await account.client.rpc('teammate_stats');
    if (error !== null && error !== undefined)
      return account.json({ error: 'Stats service unavailable.' }, 503);
    const refusal = OrderRpcErrorSchema.safeParse(data);
    if (refusal.success)
      return account.json(
        { error: 'Stats unavailable.' },
        refusal.data.error.code,
      );
    const parsed = TeammateStatsResponseSchema.safeParse(data);
    if (!parsed.success)
      return account.json({ error: 'Invalid stats service response.' }, 502);
    return account.json(parsed.data);
  } catch {
    return account.json({ error: 'Stats service unavailable.' }, 503);
  }
};
