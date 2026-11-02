import { z } from 'zod';

/** Tip limits (MONEY-RULES T2 and T3, owner approved): 1.00 to 100.00 in the order's currency (EUR). */
export const TIP_MIN_CENTS = 100;
export const TIP_MAX_CENTS = 10000;
/** A US customer picks the tip in dollars ($2 to $100); it is charged in EUR at the customer rate. */
export const TIP_USD_MIN_CENTS = 200;
export const TIP_USD_MAX_CENTS = 10000;

/** What the customer picked in their own currency, when it wasn't EUR (20261102120000). */
export const TipShownSchema = z.strictObject({
  currency: z.literal('USD'),
  amount: z.number().min(1).max(100),
});
export type TipShown = z.infer<typeof TipShownSchema>;

export const TipInputSchema = z.strictObject({
  amount_cents: z.union([
    z.literal(0),
    z.number().int().min(TIP_MIN_CENTS).max(TIP_MAX_CENTS),
  ]),
});

export const TipSchema = z.strictObject({
  amount: z.number().min(1).max(100),
  currency: z.literal('EUR'),
  state: z.enum(['pending', 'paid', 'refunded', 'disputed', 'canceled']),
  refunded: z.number().min(0).max(100),
  paidAt: z.number().int().nullable(),
  // Added by 20261102120000; optional so code can deploy before the migration.
  shown: TipShownSchema.nullable().optional(),
});
export type Tip = z.infer<typeof TipSchema>;

/** order_tip_status(): what the order room shows. */
export const TipStatusSchema = z.strictObject({
  tip: TipSchema.nullable(),
  canTip: z.boolean(),
  tipUntil: z.number().int().nullable(),
});

/** The database-prepared amount; the server attaches the PaymentIntent. */
export const TipPreparedSchema = z.strictObject({
  tipId: z.uuid(),
  amountCents: z.number().int().min(TIP_MIN_CENTS).max(TIP_MAX_CENTS),
  attempt: z.number().int().min(0).max(50),
  paymentIntentId: z
    .string()
    .regex(/^pi_[A-Za-z0-9]+$/)
    .nullable(),
  reference: z.string().min(1).max(40),
  teammate: z.string().min(1).max(200),
  tip: TipSchema,
});
export type TipPrepared = z.infer<typeof TipPreparedSchema>;

export type TipPayment = {
  clientSecret: string;
  publishableKey: string;
  amount: number;
  currency: 'EUR';
  teammate: string;
  /** the amount the customer picked, when it wasn't EUR */
  shown: TipShown | null;
};
