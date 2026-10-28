import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accountFacts, transferFacts, type AccountFacts } from './stripe';

/** Webhook side of Connect payouts. Imported by the platform webhook, so no route imports here. */

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
const rpcOf = (client: SupabaseClient) =>
  client.rpc.bind(client) as unknown as Rpc;

/** Stores Stripe's view of an account. Unknown accounts are a no-op. */
export async function syncAccount(
  admin: SupabaseClient,
  facts: AccountFacts,
): Promise<string> {
  const result = await rpcOf(admin)('connect_account_sync', {
    p_account_id: facts.accountId,
    p_details_submitted: facts.detailsSubmitted,
    p_payouts_enabled: facts.payoutsEnabled,
    p_transfers_active: facts.transfersActive,
    p_disabled_reason: facts.disabledReason,
    p_requirements_due: facts.requirementsDue,
  });
  if (result.error) throw new Error('connect_account_sync failed');
  const data = result.data as { updated?: boolean; status?: string } | null;
  return data?.updated ? 'connect_account_synced' : 'connect_account_unknown';
}

/**
 * Platform events for payout transfers (from /api/webhooks/stripe). Returns null for events
 * that are not about payout transfers. Every step is idempotent.
 */
export async function handleTransferEvent(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<string | null> {
  if (
    event.type !== 'transfer.created' &&
    event.type !== 'transfer.updated' &&
    event.type !== 'transfer.reversed'
  )
    return null;
  const facts = transferFacts(event.data.object);
  if (!facts) return 'transfer_ignored';
  let outcome = 'transfer_seen';
  if (facts.rowId) {
    const recorded = await rpcOf(admin)('payout_stripe_record', {
      p_transfer_id: facts.rowId,
      p_stripe_transfer_id: facts.transferId,
      p_destination: facts.destination,
      p_amount_minor: facts.amount,
      p_currency: facts.currency,
    });
    if (recorded.error) throw new Error('payout_stripe_record failed');
    if ((recorded.data as { recorded?: boolean } | null)?.recorded)
      outcome = 'transfer_recorded';
  }
  if (facts.amountReversed > 0) {
    const reversed = await rpcOf(admin)('payout_stripe_reversal', {
      p_stripe_transfer_id: facts.transferId,
      p_reversed_minor: facts.amountReversed,
    });
    if (reversed.error) throw new Error('payout_stripe_reversal failed');
    if ((reversed.data as { updated?: boolean } | null)?.updated)
      outcome = 'transfer_reversal_recorded';
  }
  return outcome;
}

/** Connected-account events (account.updated, payout.failed). Null when not handled. */
export async function handleConnectEvent(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<string | null> {
  if (event.type === 'account.updated') {
    const facts = accountFacts(event.data.object);
    if (!facts) return 'account_ignored';
    return syncAccount(admin, facts);
  }
  if (event.type === 'payout.failed') {
    const payout = event.data.object as Stripe.Payout;
    if (!event.account) return 'payout_ignored';
    const result = await rpcOf(admin)('connect_payout_failed', {
      p_account_id: event.account,
      p_payout_id: payout.id,
      p_failure: payout.failure_code ?? payout.failure_message ?? 'unknown',
    });
    if (result.error) throw new Error('connect_payout_failed failed');
    return (result.data as { updated?: boolean } | null)?.updated
      ? 'payout_failure_recorded'
      : 'connect_account_unknown';
  }
  return null;
}
