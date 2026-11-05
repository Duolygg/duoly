import type { APIRoute } from 'astro';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import {
  MatchReportCommandSchema,
  MatchReportResponseSchema,
} from '../../contracts/match-reports';
import { OrderCommandSchema } from '../../contracts/orders';

// GET / POST /api/teammate/orders/:id/match-report: the teammate playing a win/loss order reads or
// saves its match report (20261102160000). The database checks the order, the games and the totals.
function resultResponse(
  account: ReturnType<typeof accountContext>,
  data: unknown,
  error: unknown,
) {
  if (error || !data || typeof data !== 'object')
    return account.json({ error: 'Match report unavailable.' }, 503);
  const refusal = (data as { error?: { code?: unknown; message?: unknown } })
    .error;
  if (refusal) {
    const code = Number(refusal.code);
    return account.json(
      {
        error:
          typeof refusal.message === 'string'
            ? refusal.message
            : 'Could not save the match report.',
      },
      code >= 400 && code < 600 ? code : 400,
    );
  }
  const parsed = MatchReportResponseSchema.safeParse(data);
  return parsed.success
    ? account.json(parsed.data)
    : account.json({ error: 'Match report unavailable.' }, 503);
}

export const matchReport: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (!['GET', 'POST'].includes(context.request.method)) {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET, POST');
      return response;
    }
    const order = OrderCommandSchema.safeParse({ order_id: context.params.id });
    if (!order.success)
      return account.json({ error: 'Invalid order request.' }, 400);
    let command: ReturnType<typeof MatchReportCommandSchema.parse> | null =
      null;
    if (context.request.method === 'POST') {
      const prepared = await mutation(context, 16384);
      account = prepared.account;
      if (prepared.failure) return prepared.failure;
      const parsed = MatchReportCommandSchema.safeParse(prepared.body);
      if (!parsed.success)
        return account.json(
          {
            error:
              'Every game needs your IGN, the customer’s IGN and a match link starting with https://.',
          },
          400,
        );
      command = parsed.data;
    }
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json({ error: 'Order not found.' }, 404);
    const rpc = account.client.rpc.bind(account.client) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
    const result = command
      ? await rpc('teammate_save_match_report', {
          p_order_id: order.data.order_id,
          p_games: command.games,
          p_wins: command.wins,
          p_losses: command.losses,
        })
      : await rpc('teammate_match_report', {
          p_order_id: order.data.order_id,
        });
    return resultResponse(account, result.data, result.error);
  } catch {
    return account.json({ error: 'Match report unavailable.' }, 503);
  }
};
