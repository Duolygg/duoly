import type { APIRoute } from 'astro';
import {
  CompletionInputSchema,
  CompletionResponseSchema,
  EarningsResponseSchema,
} from '../../contracts/completion';
import { OrderPaginationSchema } from '../../contracts/orders';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { proofRpcData } from '../proofs/results';
import { ProofFailure } from '../proofs/storage';
import { withRoleSync } from '../discord/role-hooks';

/** complete_order's 409 messages (20261112144155_complete_wallet_orders.sql), shown as they are. */
const COMPLETION_CONFLICTS = new Set([
  'Completion already recorded with another request or proof set.',
  'Assignment unavailable.',
  'Your team starts once every seat is taken.',
  'Fill in the match report first: every game with both IGNs and the match link, plus your wins and losses.',
  'Captured settled payment required.',
]);

const completeOrder: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  // A 409 names what is missing ("Fill in the match report first…") when it is one of
  // complete_order's own reasons; anything else keeps the fixed wording, so no database
  // detail ever reaches the browser.
  const fail = (status: number, reason?: string) =>
    account.json(
      {
        error:
          status === 503
            ? 'Completion service unavailable.'
            : status === 409 && reason && COMPLETION_CONFLICTS.has(reason)
              ? reason
              : 'Order could not be completed.',
      },
      status,
    );
  try {
    if (context.request.method !== 'POST') {
      const response = fail(405);
      response.headers.set('Allow', 'POST');
      return response;
    }
    const prepared = await mutation(context);
    account = prepared.account;
    if (prepared.failure || !prepared.body) return prepared.failure!;
    const identity = await account.identity();
    if (!identity || !account.client) return fail(401);
    if (identity.viewer.role !== 'teammate') return fail(403);
    const { csrf: _csrf, ...body } = prepared.body;
    void _csrf;
    const input = CompletionInputSchema.safeParse({
      ...body,
      order_id: context.params.id,
    });
    if (!input.success || Object.hasOwn(body, 'order_id') || context.url.search)
      return fail(400);
    const result = CompletionResponseSchema.parse(
      proofRpcData(
        await account.client.rpc('complete_order', {
          p_order_id: input.data.order_id,
          p_assignment_id: input.data.assignment_id,
          p_proof_ids: input.data.proof_ids,
          p_request_id: input.data.request_id,
        }),
      ),
    );
    const entry = result.completion;
    if (
      entry.order_id !== input.data.order_id ||
      entry.assignment_id !== input.data.assignment_id ||
      entry.request_id !== input.data.request_id ||
      entry.proof_ids.length !== input.data.proof_ids.length ||
      entry.proof_ids.some((id) => !input.data.proof_ids.includes(id))
    )
      return fail(503);
    return account.json(result);
  } catch (error) {
    return error instanceof ProofFailure
      ? fail(error.status, error.reason)
      : fail(503);
  }
};

/** In Session goes away (and Online follows the desk toggle) right after completion (#40). */
export const complete = withRoleSync(completeOrder, (context) =>
  context.params.id ? { order: context.params.id } : null,
);

export const earnings: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  const fail = (status: number) =>
    account.json(
      {
        error:
          status === 503
            ? 'Earnings service unavailable.'
            : status === 401
              ? 'Authentication required.'
              : 'Earnings could not be loaded.',
      },
      status,
    );
  try {
    if (context.request.method !== 'GET') {
      const response = fail(405);
      response.headers.set('Allow', 'GET');
      return response;
    }
    const identity = await account.identity();
    if (!identity || !account.client) return fail(401);
    if (identity.viewer.role !== 'teammate') return fail(403);
    const query: Record<string, number> = {};
    for (const [key, value] of context.url.searchParams) {
      if (
        !['limit', 'offset'].includes(key) ||
        Object.hasOwn(query, key) ||
        !/^[0-9]+$/.test(value)
      )
        return fail(400);
      query[key] = Number(value);
    }
    const pagination = OrderPaginationSchema.safeParse({ limit: 20, ...query });
    if (!pagination.success) return fail(400);
    const result = EarningsResponseSchema.parse(
      proofRpcData(
        await account.client.rpc('teammate_earnings', {
          p_limit: pagination.data.limit,
          p_offset: pagination.data.offset,
        }),
      ),
    );
    if (
      result.earnings.length > pagination.data.limit ||
      new Set(result.earnings.map((entry) => entry.order_id)).size !==
        result.earnings.length
    )
      return fail(503);
    return account.json(result);
  } catch (error) {
    return fail(error instanceof ProofFailure ? error.status : 503);
  }
};
