import type { APIRoute } from 'astro';
import { z } from 'zod';
import { mutation } from '../auth/handlers';
import { createStatusToken, statusTokenHash } from './status-token';
import { statusRpc } from './status-storage';
const issued = z.strictObject({ expiresAt: z.iso.datetime({ offset: true }) });
const revoked = z.strictObject({ revoked: z.literal(true) });
export const aiStatusToken: APIRoute = async (context) => {
  if (!['POST', 'DELETE'].includes(context.request.method))
    return new Response(null, {
      status: 405,
      headers: { Allow: 'POST, DELETE', 'Cache-Control': 'no-store' },
    });
  const { account, body, failure } = await mutation(context, 1024);
  if (failure) return failure;
  const reply = (data: unknown, status = 200) => {
    const response = account.json(data, status);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
  if (!body || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'csrf'))
    return reply({ error: 'Invalid request.' }, 400);
  try {
    const identity = await account.identity();
    if (!identity) return reply({ error: 'Sign in first.' }, 401);
    if (
      identity.viewer.role !== 'customer' ||
      !z.uuid().safeParse(context.params.id).success
    )
      return reply({ error: 'Order not found.' }, 404);
    const issue = context.request.method === 'POST';
    const token = issue ? createStatusToken() : null;
    const { data, error } = await statusRpc()(
      issue ? 'issue_order_status_token' : 'revoke_order_status_token',
      {
        p_order_id: context.params.id,
        p_customer_id: identity.viewer.id,
        ...(token ? { p_token_hash: await statusTokenHash(token) } : {}),
      },
    );
    if (error) throw new Error('Unavailable');
    if (
      data &&
      typeof data === 'object' &&
      'error' in data &&
      data.error === 'not_found'
    )
      return reply({ error: 'Order not found.' }, 404);
    return issue
      ? reply({ token, ...issued.parse(data) })
      : reply(revoked.parse(data));
  } catch {
    return reply({ error: 'Order code service unavailable.' }, 503);
  }
};
