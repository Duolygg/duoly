import type { APIRoute } from 'astro';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { handoverTokenHash, validHandoverToken } from './handover';
import { settleSoon } from '../payments/webhook';

function result(
  account: ReturnType<typeof accountContext>,
  data: unknown,
  error: unknown,
): Response {
  if (error || !data || typeof data !== 'object')
    return account.json({ error: 'Handover service unavailable.' }, 503);
  const refusal = (data as { error?: { code?: unknown; message?: unknown } })
    .error;
  if (!refusal) return account.json(data);
  const status = Number(refusal.code);
  return account.json(
    {
      error:
        typeof refusal.message === 'string'
          ? refusal.message
          : 'That did not work.',
    },
    status >= 400 && status < 600 ? status : 400,
  );
}

export const claim: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    const method = context.request.method;
    if (method !== 'GET' && method !== 'POST') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET, POST');
      return response;
    }
    if (method === 'POST') {
      const prepared = await mutation(context);
      account = prepared.account;
      if (prepared.failure) return prepared.failure;
      if (
        !prepared.body ||
        Object.keys(prepared.body).length !== 1 ||
        !Object.hasOwn(prepared.body, 'csrf')
      )
        return account.json({ error: 'Invalid handover request.' }, 400);
    }
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Please log in.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json(
        { error: 'Only teammates can use handover links.' },
        403,
      );
    const token = context.params.token ?? '';
    if (!validHandoverToken(token)) {
      if (method === 'GET') return account.json({ state: 'invalid' });
      return account.json({ error: 'This handover link is not valid.' }, 404);
    }
    const hash = await handoverTokenHash(token);
    const { data, error } = await account.client.rpc(
      method === 'GET' ? 'handover_info' : 'accept_handover',
      { p_token_hash: hash },
    );
    const response = result(account, data, error);
    if (method === 'POST' && response.status === 200)
      await settleSoon().catch(() => undefined);
    return response;
  } catch {
    return account.json({ error: 'Handover service unavailable.' }, 503);
  }
};
