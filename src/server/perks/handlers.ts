import type { APIRoute } from 'astro';
import { accountContext } from '../auth/context';
import { decodeOrderRpcResult } from '../orders/results';
import type { CustomerPerks } from '../../contracts/orders';

type RpcAnswer = { data: unknown; error: unknown; status?: number };
type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<RpcAnswer>;

/**
 * Pure: the perks RPCs answer 404 (PostgREST PGRST202, function not found) until migration
 * 20261026160000 is applied. The UI treats that as "no perk".
 */
export function isMissingRpc(answer: RpcAnswer): boolean {
  const code = (answer.error as { code?: unknown } | null | undefined)?.code;
  return answer.status === 404 || code === 'PGRST202' || code === '42883';
}

function getOnly(
  context: Parameters<APIRoute>[0],
  account: ReturnType<typeof accountContext>,
) {
  if (context.request.method === 'GET') return null;
  const response = account.json({ error: 'Method not allowed.' }, 405);
  response.headers.set('Allow', 'GET');
  return response;
}

/** GET /api/orders/perks -> { perks: CustomerPerks | null } (null before the migration). */
export const perks: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    const wrongMethod = getOnly(context, account);
    if (wrongMethod) return wrongMethod;
    if ([...context.url.searchParams].length)
      return account.json({ error: 'Invalid order request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'customer')
      return account.json({ error: 'Order access denied.' }, 403);
    const rpc = account.client.rpc.bind(account.client) as unknown as Rpc;
    const answer = await rpc('customer_perks');
    if (isMissingRpc(answer))
      return account.json({ perks: null satisfies CustomerPerks | null });
    const result = decodeOrderRpcResult(
      'customerPerks',
      answer.data,
      answer.error,
    );
    if (!result.ok) return account.json(result.payload, result.status);
    return account.json({ perks: result.payload });
  } catch {
    return account.json({ error: 'Order service unavailable.' }, 503);
  }
};
