import { z } from 'zod';

const csrf = z.string().min(1).max(128);
export const TeammatePresenceSchema = z.discriminatedUnion('action', [
  z.object({ csrf, action: z.literal('set'), online: z.boolean() }).strict(),
  z
    .object({
      csrf,
      action: z.literal('check-in'),
      lastActive: z.number().int().nonnegative().optional(),
    })
    .strict(),
]);

export const AdminPresenceSchema = z.discriminatedUnion('action', [
  z
    .object({ csrf, action: z.literal('check-in'), online: z.boolean() })
    .strict(),
  z
    .object({
      csrf,
      action: z.literal('set-offline'),
      userId: z.uuid(),
      reason: z.enum([
        'AFK / dashboard left open',
        'Not answering orders',
        'Asked to be set offline',
        'Other',
      ]),
    })
    .strict(),
]);
