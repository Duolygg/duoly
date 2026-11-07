import { z } from 'zod';

const state = z.enum(['queued', 'in_progress', 'completed', 'cancelled']);
const time = z.iso.datetime({ offset: true });
const member = z.strictObject({
  status: state,
  name: z.string().max(80).nullable(),
  thisSeat: z.boolean(),
});
export const OrderStatusSchema = z.strictObject({
  status: state,
  game: z.string().min(1).max(32),
  service: z.string().min(1).max(64),
  title: z.string().min(1).max(80),
  quantity: z.strictObject({
    value: z.number().int().min(1).max(10),
    unit: z.enum(['game', 'hour']),
  }),
  rank: z.string().max(40),
  region: z.string().max(80),
  paidEurMinor: z.number().int().min(0).max(100000),
  accepted: z.boolean(),
  teammateDisplayName: z.string().max(80).nullable(),
  bookedAt: time,
  searchingAt: time,
  acceptedAt: time.nullable(),
  completedAt: time.nullable(),
  team: z
    .strictObject({
      status: z.enum(['waiting', 'started', 'done', 'cancelled']),
      seats: z.number().int().min(2).max(5),
      filled: z.number().int().min(0).max(5),
      members: z.array(member).min(2).max(5),
    })
    .nullable(),
  nextStep: z.string(),
  updatedAt: time,
});
export const StoredOrderStatusSchema = OrderStatusSchema.omit({
  nextStep: true,
  updatedAt: true,
})
  .extend({
    roomUrl: z
      .string()
      .regex(
        /^https:\/\/duoly\.gg\/queue\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
  })
  .superRefine((s, ctx) => {
    if (
      (!s.accepted &&
        (s.teammateDisplayName !== null || s.acceptedAt !== null)) ||
      s.accepted !== (s.status === 'in_progress' || s.status === 'completed')
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Inconsistent current assignment',
      });
    if (
      s.team &&
      (s.team.filled > s.team.seats ||
        s.team.members.length !== s.team.seats ||
        s.team.members.filter((m) => m.thisSeat).length !== 1 ||
        s.team.members.some(
          (m) =>
            !['in_progress', 'completed'].includes(m.status) && m.name !== null,
        ))
    )
      ctx.addIssue({ code: 'custom', message: 'Inconsistent team' });
  });
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
