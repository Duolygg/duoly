/*
 * The customer dashboard's first data, read while the page renders. The dashboard used to start
 * with nothing and fill in after its first requests: the balance read $0.00, every count read 0
 * and the open order appeared a moment later. This makes the same reads the browser makes
 * (customer_order_history with limit 100, customer_refund_credits with the endpoint's default
 * page, customer_rewards and customer_active_order), checks them with the same decoder as the
 * API routes, and shapes them with the same pure functions as the browser adapter, so the page
 * starts with exactly what the first poll would have produced.
 *
 * Every part degrades on its own: a failed read leaves that part to the browser, as before.
 */
import type { accountContext } from '../auth/context';
import { decodeOrderRpcResult } from './results';
import {
  toOriginalHistory,
  toOriginalOrder,
  toOriginalRewards,
} from '../../components/account/dashboard-data.js';

type Client = NonNullable<ReturnType<typeof accountContext>['client']>;
/** The rpc bound loosely, as the order handlers do: the shapes are checked by the decoder. */
type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;

export interface DashboardPreload {
  /** What /api/me/history would answer, or null to let the browser load it. */
  history: unknown | null;
  /** The open order as /api/orders would answer it; undefined when it could not be read. */
  live: unknown | null | undefined;
}

export async function loadDashboardPreload(
  client: Client | null | undefined,
  now = Date.now(),
): Promise<DashboardPreload> {
  if (!client) return { history: null, live: undefined };
  const rpc = client.rpc.bind(client) as unknown as Rpc;
  /* Supabase's query builder is a thenable without .catch, so wrap it in a real promise first. */
  const settle = (...call: Parameters<Rpc>) =>
    Promise.resolve()
      .then(() => rpc(...call))
      .catch(() => ({ data: null, error: new Error('unavailable') }));
  const [h, c, r, a] = await Promise.all([
    settle('customer_order_history', { p_limit: 100, p_offset: 0 }),
    settle('customer_refund_credits', { p_limit: 50, p_offset: 0 }),
    settle('customer_rewards'),
    settle('customer_active_order'),
  ]);
  const history = decodeOrderRpcResult('customerHistory', h.data, h.error);
  const credits = decodeOrderRpcResult('refundCredits', c.data, c.error);
  const rewards = decodeOrderRpcResult('customerRewards', r.data, r.error);
  const active = decodeOrderRpcResult('customerActive', a.data, a.error);
  return {
    /* The browser treats credits and rewards as optional, so only the history itself decides. */
    history: history.ok
      ? {
          ...toOriginalHistory(
            (history.payload as { orders?: unknown[] }).orders || [],
            credits.ok ? credits.payload : { credits: [] },
            now,
          ),
          rewards: toOriginalRewards(rewards.ok ? rewards.payload : null),
        }
      : null,
    live: active.ok
      ? (() => {
          const order = (active.payload as { order?: unknown }).order;
          return order ? toOriginalOrder(order) : null;
        })()
      : undefined,
  };
}
