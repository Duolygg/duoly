import type { APIRoute } from 'astro';
import type { AccountContext } from '../auth/context';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { decodeOrderRpcResult } from './results';
import { settleSoon } from '../payments/webhook';
import {
  OrderCommandSchema,
  OrderPaginationSchema,
  type OrderResponseKind,
} from '../../contracts/orders';

type Client = NonNullable<AccountContext['client']>;
type Input = { p_order_id: string; p_limit: number; p_offset: number };
type Options = {
  role?: 'customer' | 'teammate';
  input?: 'id' | 'pagination';
  method?: 'POST';
};
function route(
  kind: OrderResponseKind,
  call: (
    client: Client,
    input: Input,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
  options: Options = {},
): APIRoute {
  return async (context) => {
    let account = accountContext(context.request, context.cookies);
    try {
      const method = options.method ?? 'GET';
      if (context.request.method !== method) {
        const response = account.json({ error: 'Method not allowed.' }, 405);
        response.headers.set('Allow', method);
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
          return account.json({ error: 'Invalid order request.' }, 400);
      }
      const identity = await account.identity();
      if (!identity || !account.client)
        return account.json({ error: 'Authentication required.' }, 401);
      const role = options.role ?? 'customer';
      if (identity.viewer.role !== role)
        return account.json(
          {
            error:
              role === 'teammate' ? 'Order not found.' : 'Order access denied.',
          },
          role === 'teammate' ? 404 : 403,
        );
      const query: Record<string, number> = {};
      for (const [key, value] of context.url.searchParams) {
        if (
          options.input !== 'pagination' ||
          !['limit', 'offset'].includes(key) ||
          Object.hasOwn(query, key) ||
          !/^[0-9]+$/.test(value)
        )
          return account.json({ error: 'Invalid order request.' }, 400);
        query[key] = Number(value);
      }
      const pagination = OrderPaginationSchema.safeParse(query);
      const command = OrderCommandSchema.safeParse({
        order_id: context.params.id,
      });
      if (!pagination.success || (options.input === 'id' && !command.success))
        return account.json({ error: 'Invalid order request.' }, 400);
      const { data, error } = await call(account.client, {
        p_order_id: command.success ? command.data.order_id : '',
        p_limit: pagination.data.limit,
        p_offset: pagination.data.offset,
      });
      const result = decodeOrderRpcResult(kind, data, error);
      return account.json(result.payload, result.status);
    } catch {
      return account.json({ error: 'Order service unavailable.' }, 503);
    }
  };
}
export const active = route('customerActive', (client) =>
  client.rpc('customer_active_order'),
);
export const history = route(
  'customerHistory',
  (client, { p_limit, p_offset }) =>
    client.rpc('customer_order_history', { p_limit, p_offset }),
  { input: 'pagination' },
);
export const credits = route(
  'refundCredits',
  (client, { p_limit, p_offset }) =>
    client.rpc('customer_refund_credits', { p_limit, p_offset }),
  { input: 'pagination' },
);
export const detail = route(
  'customerOrder',
  (client, { p_order_id }) => client.rpc('customer_order', { p_order_id }),
  { input: 'id' },
);
export const queue = route(
  'teammateQueue',
  (client) => client.rpc('teammate_order_queue'),
  { role: 'teammate' },
);
/** Accept captures and cancel releases the payment right away; the tick is the backstop. */
function withSettlement(handler: APIRoute): APIRoute {
  return async (context) => {
    const response = await handler(context);
    if (response.status === 200) await settleSoon().catch(() => undefined);
    return response;
  };
}
export const cancel = withSettlement(
  route(
    'customerOrder',
    (client, { p_order_id }) =>
      client.rpc('cancel_queued_order', { p_order_id }),
    { input: 'id', method: 'POST' },
  ),
);
export const reroll = route(
  'customerOrder',
  (client, { p_order_id }) => client.rpc('reroll_order', { p_order_id }),
  { input: 'id', method: 'POST' },
);
export const accept = withSettlement(
  route(
    'teammateOrder',
    (client, { p_order_id }) => client.rpc('accept_order', { p_order_id }),
    { input: 'id', method: 'POST', role: 'teammate' },
  ),
);
export const assignment = route(
  'teammateAssignment',
  (client) => client.rpc('teammate_current_assignment'),
  { role: 'teammate' },
);
