import { z } from 'zod';

const csrf = z.string().min(1).max(128);
const message = z.string().trim().min(1).max(500);

export const SupportMessageSchema = z
  .object({ csrf, text: message, chip: z.boolean().optional() })
  .strict();
export const SupportHumanSchema = z
  .object({ csrf, action: z.literal('human'), text: message.optional() })
  .strict();
export const SupportCloseSchema = z
  .object({ csrf, action: z.literal('close') })
  .strict();
export const SupportPostSchema = z.union([
  SupportMessageSchema,
  SupportHumanSchema,
  SupportCloseSchema,
]);

export const AdminSupportSchema = z
  .object({
    csrf,
    id: z.uuid(),
    action: z.enum(['reply', 'claim', 'bot', 'close', 'seen']),
    text: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((value) => value.action !== 'reply' || !!value.text, {
    message: 'Write a reply first.',
    path: ['text'],
  });
