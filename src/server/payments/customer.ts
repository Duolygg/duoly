import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

// One Stripe customer per Duoly account (pro_billing_customers, 20261026120000_pro_subscription.sql).
// Duoly PRO bills it, and since Play again (20261106180000) checkout attaches it too, so a card the
// customer chooses to save lands on it. The idempotency key is the one PRO always used, so an
// account that already has a customer never gets a second one.

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
// bound: supabase-js rpc reads `this`, so a detached `client.rpc` throws before any request
const rpcOf = (client: SupabaseClient) =>
  client.rpc.bind(client) as unknown as Rpc;

/** The account's Stripe customer id, created on first use. null when the database is unavailable. */
export async function billingCustomer(
  stripe: Stripe,
  admin: SupabaseClient,
  user: { id: string; email: string | null },
): Promise<string | null> {
  const rpc = rpcOf(admin);
  const existing = await rpc('pro_billing_customer', { p_user: user.id });
  if (existing.error) return null;
  if (typeof existing.data === 'string' && existing.data) return existing.data;
  const customer = await stripe.customers.create(
    {
      ...(user.email ? { email: user.email } : {}),
      metadata: { user_id: user.id },
    },
    { idempotencyKey: `pro_customer_${user.id}` },
  );
  const linked = await rpc('pro_link_customer', {
    p_user: user.id,
    p_customer: customer.id,
  });
  if (linked.error || typeof linked.data !== 'string') return null;
  return linked.data;
}

/** Only the existing customer id, never creating one (reads for the order room). */
export async function existingBillingCustomer(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const found = await rpcOf(admin)('pro_billing_customer', { p_user: userId });
  return !found.error && typeof found.data === 'string' && found.data
    ? found.data
    : null;
}
