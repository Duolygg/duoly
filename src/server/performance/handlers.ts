import type { APIRoute } from 'astro';
import { z } from 'zod';
import { accountContext } from '../auth/context';
import { adminRoute } from '../admin/handlers';
import { roleSyncConfig } from '../discord/role-sync';
import { OrderRpcErrorSchema } from '../../contracts/orders';
import {
  AdminPerformanceSettingsSchema,
  AdminRecalculateSchema,
  TeammatePerformanceSchema,
} from '../../contracts/performance';
import { syncPerformanceRolesNow } from './roles';

/** GET /api/teammate/performance: the signed-in teammate's own ranking (teammate_performance()). */
export const teammatePerformance: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    if (context.request.method !== 'GET') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET');
      return response;
    }
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json({ error: 'Teammates only.' }, 403);
    const { data, error } = await account.client.rpc(
      'teammate_performance' as never,
    );
    if (error) return account.json({ error: 'Ranking unavailable.' }, 503);
    const refusal = OrderRpcErrorSchema.safeParse(data);
    if (refusal.success)
      return account.json(
        { error: 'Ranking unavailable.' },
        refusal.data.error.code,
      );
    const parsed = TeammatePerformanceSchema.safeParse(data);
    if (!parsed.success)
      return account.json({ error: 'Invalid ranking response.' }, 502);
    return account.json(parsed.data);
  } catch {
    return account.json({ error: 'Ranking unavailable.' }, 503);
  }
};

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{
  data: unknown;
  error: unknown;
}>;
const rpc = (client: unknown) =>
  (client as { rpc: Rpc }).rpc.bind(client) as Rpc;

/**
 * /api/admin/performance. GET: every contractor with scores, ranking, breakdown and Discord status
 * (?user=<id> gives that teammate's ranking history). POST: recalculate now, or change the
 * weights and eligibility. The database re-checks the admin role inside every function.
 */
export const adminPerformance = adminRoute(
  async (client, context) => {
    const user = context.url.searchParams.get('user');
    if (user !== null) {
      if (!z.uuid().safeParse(user).success)
        return {
          data: { error: { code: 400, message: 'Unknown teammate.' } },
          error: null,
        };
      return rpc(client)('admin_performance_history', { p_user: user });
    }
    const reply = await rpc(client)('admin_performance');
    if (
      reply.error ||
      !reply.data ||
      typeof reply.data !== 'object' ||
      'error' in reply.data
    )
      return reply;
    // Lets the page say "Discord sync off" instead of an endless "pending".
    return {
      data: { ...reply.data, discordEnabled: roleSyncConfig() !== null },
      error: null,
    };
  },
  [
    {
      schema: AdminRecalculateSchema,
      call: (client) => rpc(client)('admin_performance_recalculate'),
      after: async () => {
        await syncPerformanceRolesNow();
      },
    },
    {
      schema: AdminPerformanceSettingsSchema as never,
      call: (client, body) =>
        rpc(client)('admin_set_performance_settings', {
          p_w_retention: body.wRetention,
          p_w_satisfaction: body.wSatisfaction,
          p_w_orders: body.wOrders,
          p_w_winrate: body.wWinrate,
          p_window_days: body.windowDays,
          p_min_orders: body.minOrders,
          p_min_reviews: body.minReviews,
          p_min_customers: body.minCustomers,
          p_min_wl_games: body.minWinLossGames,
        }),
    },
  ],
);
