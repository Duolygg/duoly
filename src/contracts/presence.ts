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
  /**
   * The last Duoly tab of this browser is going away (`pagehide`, sent with `navigator.sendBeacon`).
   * It writes nothing: `pagehide` also fires on an ordinary navigation and on closing one of
   * several tabs, so a persistent offline write would be a visible regression
   * (docs/product/background-work.md, oai-review F5). It only asks for a presence-check timer, and
   * the 20 s heartbeat staleness rule stays the only thing that decides who is online.
   */
  z.object({ csrf, action: z.literal('leaving') }).strict(),
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
