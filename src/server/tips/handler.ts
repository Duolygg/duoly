import type Stripe from 'stripe';
import type { TipPayment, TipPrepared } from '../../contracts/tips';

export type { TipPayment };

export function tipIntentParams(
  prepared: TipPrepared,
  email: string | null,
): Stripe.PaymentIntentCreateParams {
  return {
    amount: prepared.amountCents,
    currency: 'eur',
    automatic_payment_methods: { enabled: true },
    description: `Tip for ${prepared.teammate} · ${prepared.reference}`,
    metadata: {
      tip_id: prepared.tipId,
      order_reference: prepared.reference,
    },
    ...(email ? { receipt_email: email } : {}),
  };
}

export async function createTipIntent(input: {
  stripe: Stripe;
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  prepared: TipPrepared;
  email: string | null;
  fx: number;
  publishableKey: string;
}): Promise<TipPayment> {
  const intent = await input.stripe.paymentIntents.create(
    tipIntentParams(input.prepared, input.email),
    { idempotencyKey: `tip_${input.prepared.tipId}_${input.prepared.attempt}` },
  );
  if (!intent.client_secret) throw new Error('tip intent has no client secret');
  const attached = await input.rpc('order_tip_attach', {
    p_tip_id: input.prepared.tipId,
    p_payment_intent: intent.id,
    p_amount_cents: input.prepared.amountCents,
    p_fx: input.fx,
  });
  if (
    attached.error ||
    !(attached.data as { attached?: boolean } | null)?.attached
  )
    throw new Error('tip intent was not attached');
  return {
    clientSecret: intent.client_secret,
    publishableKey: input.publishableKey,
    amount: input.prepared.amountCents / 100,
    currency: 'EUR',
    teammate: input.prepared.teammate,
  };
}
