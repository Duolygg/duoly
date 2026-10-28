import { z } from 'zod';
import { CustomerReportSchema } from './reports';
import { ReviewSchema } from './reviews';
import { TipSchema } from './tips';

const TimestampSchema = z.iso.datetime({ offset: true });
const AvatarSchema = z
  .string()
  .regex(/^(?:|\/assets\/avatars\/avatar-([1-9]|10)\.png)$/);
const CountrySchema = z.string().regex(/^(?:|[a-z]{2})$/);
const OrderFields = {
  id: z.uuid(),
  public_reference: z.string().regex(/^DL-[0-9]+$/),
  status: z.enum(['queued', 'in_progress', 'completed', 'cancelled']),
  game: z.enum([
    'lol',
    'val',
    'cs2',
    'fn',
    'cod',
    'apex',
    'r6',
    'mr',
    'ow',
    'rl',
    'tft',
    'fc',
    'arc',
    'mc',
    'pu',
  ]),
  service: z.string().min(1).max(64),
  title: z.string().min(1).max(80),
  units: z.number().int().min(1).max(10),
  unit: z.enum(['game', 'hour']),
  gg: z.boolean(),
  rank: z.string().max(40),
  region: z.string().min(2).max(80),
  ign: z.string().min(2).max(40),
  note: z.string().max(200),
  voice: z.boolean(),
};

/** Exact public.order_customer_dto projection, never a raw orders row. */
export const CustomerOrderSchema = z.strictObject({
  ...OrderFields,
  amount_eur_cents: z.number().int().min(99).max(100000),
  created_at: TimestampSchema,
  queued_at: TimestampSchema,
  accepted_at: TimestampSchema.nullable(),
  completed_at: TimestampSchema.nullable(),
  cancelled_at: TimestampSchema.nullable(),
  cancel_reason: z.enum(['queue_expired', 'customer_cancelled']).nullable(),
  rerolls: z.number().int().min(0).max(2),
  current_assignment_id: z.uuid().nullable(),
  teammate: z
    .strictObject({
      name: z.string(),
      image: z.string(),
      country: z.string(),
      // Added by 20261024190000; optional so either side can ship first.
      bio: z.string().max(160).optional(),
      languages: z.array(z.string().max(32)).max(6).optional(),
      // Added by 20261026110000; optional so code can deploy before the migration.
      trust_badge: z
        .strictObject({
          id: z.enum(['trusted', 'legend']),
          name: z.enum(['Trusted', 'Legend']),
        })
        .nullable()
        .optional(),
    })
    .nullable(),
  review: ReviewSchema.nullable(),
  // Added by 20261026100000; optional so code can deploy before the migration.
  tip: TipSchema.nullable().optional(),
  // Added by 20261024220000; optional so code can deploy before the migration.
  reports: z.array(CustomerReportSchema).max(2).optional(),
});

/** Exact privacy-safe public.order_teammate_dto projection. */
export const TeammateOrderSchema = z.strictObject({
  ...OrderFields,
  customer_name: z.string().min(1).max(40),
  customer_image: AvatarSchema,
  customer_country: CountrySchema,
  payout_usd_cents: z.number().int().min(99).max(10000000),
  current_assignment_id: z.uuid().nullable(),
});

export const RefundCreditSchema = z.strictObject({
  id: z.uuid(),
  order_id: z.uuid(),
  kind: z.literal('queued_refund'),
  amount_eur_cents: z.number().int().min(99).max(100000),
  created_at: TimestampSchema,
});

const LoyaltyLevelSchema = z.strictObject({
  index: z.number().int().min(0).max(4),
  id: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']),
  name: z.enum(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']),
  from: z.number().int().min(0).max(1000),
  cashback: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(5),
    z.literal(7),
  ]),
  giftEurCents: z.number().int().min(0).max(10000),
});

export const CustomerRewardsSchema = z.strictObject({
  orders: z.number().int().min(0),
  level: LoyaltyLevelSchema,
  next: LoyaltyLevelSchema.nullable(),
  remaining: z.number().int().min(0),
  percent: z.number().int().min(0).max(100),
  cashback: z.strictObject({
    earnedEurCents: z.number().int(),
    monthEurCents: z.number().int(),
    pendingEurCents: z.number().int().min(0),
    pendingOrders: z.number().int().min(0),
  }),
  gifts: z
    .array(
      z.strictObject({
        level: z.enum(['silver', 'gold', 'platinum', 'diamond']),
        amountEurCents: z.number().int().min(500).max(10000),
        grantedAt: TimestampSchema,
      }),
    )
    .max(4),
  cashbackOrders: z
    .array(
      z.strictObject({
        orderId: z.uuid(),
        state: z.enum([
          'pending',
          'blocked',
          'credited',
          'cancelled',
          'reversed',
        ]),
        percent: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(5),
          z.literal(7),
        ]),
        amountEurCents: z.number().int().min(0),
        creditAt: TimestampSchema,
      }),
    )
    .max(100),
});

/** Public command input; callers translate order_id to the RPC p_order_id. */
export const OrderCommandSchema = z.strictObject({ order_id: z.uuid() });
export const OrderPaginationSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(100000).default(0),
});

export const OrderRpcErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.union([
      z.literal(400),
      z.literal(401),
      z.literal(403),
      z.literal(404),
      z.literal(409),
      z.literal(410),
    ]),
    message: z.string().min(1).max(200),
  }),
});

/** Success envelopes; active reads require an explicit order:null when absent. */
export const OrderResponseSchemas = {
  customerOrder: z.strictObject({ order: CustomerOrderSchema }),
  customerActive: z.strictObject({ order: CustomerOrderSchema.nullable() }),
  customerHistory: z.strictObject({
    orders: z.array(CustomerOrderSchema).max(100),
  }),
  refundCredits: z.strictObject({
    credits: z.array(RefundCreditSchema).max(100),
  }),
  customerRewards: CustomerRewardsSchema,
  teammateOrder: z.strictObject({ order: TeammateOrderSchema }),
  teammateQueue: z.strictObject({
    orders: z.array(TeammateOrderSchema).max(100),
  }),
  teammateAssignment: z.strictObject({ order: TeammateOrderSchema.nullable() }),
} as const;

export type CustomerOrder = z.infer<typeof CustomerOrderSchema>;
export type TeammateOrder = z.infer<typeof TeammateOrderSchema>;
export type RefundCredit = z.infer<typeof RefundCreditSchema>;
export type OrderCommand = z.infer<typeof OrderCommandSchema>;
export type OrderPagination = z.infer<typeof OrderPaginationSchema>;
export type OrderRpcError = z.infer<typeof OrderRpcErrorSchema>;
export type OrderResponseKind = keyof typeof OrderResponseSchemas;
export type OrderResponse<K extends OrderResponseKind> = z.infer<
  (typeof OrderResponseSchemas)[K]
>;
