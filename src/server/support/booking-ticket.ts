// The booking ticket a Sparky message carries (support_messages.metadata.booking). Kept apart
// from booking.ts so the message store can re-check tickets without loading the MCP tools.
import { z } from 'zod';

const option = z.object({
  quantity: z.number().int().min(1).max(5),
  amountMinor: z.number().int().nonnegative(),
  fullMinor: z.number().int().nonnegative(),
  discountPercent: z.number().int().min(0).max(100),
  // Same-site path only, so a stored ticket can never send anyone off Duoly.
  href: z
    .string()
    .max(600)
    .regex(/^\/[^/\\]/),
});

/** What a bot message stores (support_messages.metadata.booking) and the chat renders. */
export const ticketSchema = z.object({
  v: z.literal(1),
  game: z.object({
    id: z.string().max(40),
    name: z.string().max(60),
    img: z
      .string()
      .max(120)
      .regex(/^\/assets\/[a-z0-9/_.-]+$/)
      .nullable(),
  }),
  service: z.object({
    id: z.string().max(64),
    name: z.string().max(80),
    category: z.string().max(24),
    unit: z.enum(['game', 'hour']),
  }),
  rank: z.string().max(40).nullable(),
  region: z.string().max(60).nullable(),
  voice: z.boolean().nullable(),
  currency: z.literal('EUR'),
  selected: z.number().int().min(1).max(5),
  options: z.array(option).min(1).max(4),
  online: z.number().int().positive().nullable(),
});
export type BookingTicket = z.infer<typeof ticketSchema>;

/** Re-checks a stored ticket before it reaches the browser; anything off is dropped. */
export function readTicket(value: unknown): BookingTicket | null {
  const parsed = ticketSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
