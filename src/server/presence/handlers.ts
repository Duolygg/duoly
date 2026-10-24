import type { APIContext, APIRoute } from 'astro';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import {
  AdminPresenceSchema,
  TeammatePresenceSchema,
} from '../../contracts/presence';

function rpcResponse(
  account: ReturnType<typeof accountContext>,
  data: unknown,
  error: unknown,
) {
  if (error || !data || typeof data !== 'object')
    return account.json({ error: 'Presence service unavailable.' }, 503);
  const refusal = (data as { error?: { code?: unknown; message?: unknown } })
    .error;
  if (!refusal) return account.json(data);
  const code = Number(refusal.code);
  return account.json(
    {
      error:
        typeof refusal.message === 'string'
          ? refusal.message
          : 'That didn’t work.',
    },
    code >= 400 && code < 600 ? code : 400,
  );
}

export const teammatePresence: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (context.request.method !== 'POST') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'POST');
      return response;
    }
    const prepared = await mutation(context, 2048);
    account = prepared.account;
    if (prepared.failure) return prepared.failure;
    const parsed = TeammatePresenceSchema.safeParse(prepared.body);
    if (!parsed.success)
      return account.json({ error: 'Invalid presence request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json({ error: 'Teammates only.' }, 403);
    const result =
      parsed.data.action === 'set'
        ? await account.client.rpc('desk_set_online', {
            p_online: parsed.data.online,
          })
        : await account.client.rpc('desk_check_in', {
            p_last_active: parsed.data.lastActive
              ? new Date(parsed.data.lastActive).toISOString()
              : undefined,
          });
    return rpcResponse(account, result.data, result.error);
  } catch {
    return account.json({ error: 'Presence service unavailable.' }, 503);
  }
};

export const adminPresence: APIRoute = async (context: APIContext) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (context.request.method !== 'GET' && context.request.method !== 'POST') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET, POST');
      return response;
    }
    let body: unknown = null;
    if (context.request.method === 'POST') {
      const prepared = await mutation(context, 2048);
      account = prepared.account;
      if (prepared.failure) return prepared.failure;
      body = prepared.body;
    }
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'admin')
      return account.json({ error: 'Not found.' }, 404);
    if (context.request.method === 'GET') {
      const result = await account.client.rpc('admin_presence');
      return rpcResponse(account, result.data, result.error);
    }
    const parsed = AdminPresenceSchema.safeParse(body);
    if (!parsed.success)
      return account.json({ error: 'Invalid presence request.' }, 400);
    const result =
      parsed.data.action === 'check-in'
        ? await account.client.rpc('admin_presence_check_in', {
            p_online: parsed.data.online,
          })
        : await account.client.rpc('admin_set_teammate_offline', {
            p_user: parsed.data.userId,
            p_reason: parsed.data.reason,
          });
    return rpcResponse(account, result.data, result.error);
  } catch {
    return account.json({ error: 'Presence service unavailable.' }, 503);
  }
};
