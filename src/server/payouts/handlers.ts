import { trackRequest } from '../analytics/client';
import type { APIRoute } from 'astro';
import { PayoutDetailsCommandSchema } from '../../contracts/payouts';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { rpcResponse } from '../admin/handlers';

export const payoutDetails: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    const method = context.request.method;
    if (method !== 'GET' && method !== 'POST') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET, POST');
      return response;
    }
    let input: ReturnType<typeof PayoutDetailsCommandSchema.safeParse> | null =
      null;
    if (method === 'POST') {
      const prepared = await mutation(context, 4096);
      account = prepared.account;
      if (prepared.failure) return prepared.failure;
      input = PayoutDetailsCommandSchema.safeParse(prepared.body);
      if (!input.success)
        return account.json(
          { error: 'Check every payout detail and try again.' },
          400,
        );
    } else if (context.url.search) {
      return account.json({ error: 'Invalid payout details request.' }, 400);
    }
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json({ error: 'Payout details access denied.' }, 403);
    const result =
      method === 'GET'
        ? await account.client.rpc('teammate_payout_details')
        : await account.client.rpc('teammate_save_payout_details', {
            p_legal_name: input!.data.legalName,
            p_address: input!.data.address,
            p_country: input!.data.country,
            p_date_of_birth: input!.data.dateOfBirth,
            p_tax_number: input!.data.taxNumber,
            p_method: input!.data.method,
            p_account: input!.data.account,
          });
    const response = rpcResponse(account, result.data, result.error);
    if (method === 'POST' && response.status === 200)
      trackRequest(context, identity.viewer.id, 'payout_setup_completed');
    return response;
  } catch {
    return account.json({ error: 'Payout details service unavailable.' }, 503);
  }
};
