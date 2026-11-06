import { z } from 'zod';
import { ProfileUpdateSchema } from './account';

export const CHAT_LIMIT = 500;
export const CHAT_HISTORY_LIMIT = 200;
export const CHAT_BLOCKED_NOTE =
  'Not sent: keep payments and account details on Duoly. Never ask for logins or outside payments.';
export const chatLength = (value: string): number => Array.from(value).length;
export const ChatUuidSchema = z.uuid();
const date = z.iso.datetime({ offset: true });
const image = ProfileUpdateSchema.shape.image;
const name = z.string().min(1).max(64);
const role = z.enum(['customer', 'teammate']);
const text = z
  .string()
  .refine((s) => chatLength(s) <= CHAT_LIMIT, 'Maximum 500 characters.');
export const ChatParticipantSchema = z.object({ role, name, image }).strict();
export const ChatMessageSchema = z
  .object({
    id: ChatUuidSchema,
    sequence: z.number().int().positive().safe(),
    kind: z.enum(['user', 'system']),
    // 'mate': another teammate of the same team order, copied into this seat's chat
    // (20261106190000_team_orders). Never the viewer, so it always shows as someone else.
    sender: z.enum(['customer', 'teammate', 'mate', 'system']),
    name,
    image,
    body: text.min(1),
    created_at: date,
    request_id: ChatUuidSchema.nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      (v.kind === 'system') !== (v.sender === 'system') ||
      (v.kind === 'system' ? v.request_id !== null : v.request_id === null)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid message author or request binding.',
      });
  });
export const ChatRoomSchema = z
  .object({
    order_id: ChatUuidSchema,
    assignment_id: ChatUuidSchema.nullable(),
    viewer: z.enum(['customer', 'teammate', 'admin']),
    writable: z.boolean(),
    participant: ChatParticipantSchema.nullable(),
    messages: z.array(ChatMessageSchema).max(CHAT_HISTORY_LIMIT),
    typing: z.array(z.object({ role, expires_at: date }).strict()).max(2),
    archives: z
      .array(
        z
          .object({
            assignment_id: ChatUuidSchema,
            label: z.string().min(1).max(100),
          })
          .strict(),
      )
      .max(10),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      (v.viewer === 'teammate' && v.archives.length) ||
      (v.viewer === 'admin' && v.writable) ||
      (v.assignment_id === null &&
        (v.writable || v.messages.length || v.typing.length))
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid chat authority.' });
    const ids = new Set<string>();
    let sequence = 0;
    for (const m of v.messages) {
      if (ids.has(m.id) || m.sequence <= sequence)
        ctx.addIssue({ code: 'custom', message: 'Invalid message ordering.' });
      ids.add(m.id);
      sequence = m.sequence;
    }
  });
export const ChatSendInputSchema = z
  .object({
    assignment_id: ChatUuidSchema,
    request_id: ChatUuidSchema,
    body: z
      .string()
      .trim()
      .min(1)
      .refine((s) => chatLength(s) <= CHAT_LIMIT, 'Maximum 500 characters.'),
  })
  .strict();
export const ChatSendResultSchema = z
  .object({
    order_id: ChatUuidSchema,
    assignment_id: ChatUuidSchema,
    request_id: ChatUuidSchema,
    outcome: z.enum(['sent', 'blocked']),
    message: ChatMessageSchema.nullable(),
    note: z.string().max(200).nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.outcome === 'sent'
        ? !v.message ||
          v.message.kind !== 'user' ||
          v.message.request_id !== v.request_id ||
          v.note !== null
        : v.message !== null || v.note !== CHAT_BLOCKED_NOTE
    )
      ctx.addIssue({ code: 'custom', message: 'Unconfirmed chat result.' });
  });
export const ChatTypingInputSchema = z
  .object({ assignment_id: ChatUuidSchema })
  .strict();
export const ChatTypingResultSchema = z
  .object({
    order_id: ChatUuidSchema,
    assignment_id: ChatUuidSchema,
    ok: z.literal(true),
  })
  .strict();
export const ChatFlagSchema = z
  .object({
    id: ChatUuidSchema,
    order_id: ChatUuidSchema,
    assignment_id: ChatUuidSchema,
    sender_name: name,
    body: text.min(1),
    rule: z.enum([
      'Account access',
      'Moving off Duoly',
      'Off-platform payment',
    ]),
    status: z.enum(['open', 'warned', 'dismissed']),
    created_at: date,
    warning_count: z.number().int().nonnegative().safe(),
  })
  .strict();
export const ChatFlagsSchema = z
  .object({ flags: z.array(ChatFlagSchema).max(50) })
  .strict();
export const ChatFlagResolutionSchema = z
  .object({ status: z.enum(['warned', 'dismissed']) })
  .strict();
export const ChatFlagResultSchema = z.object({ flag: ChatFlagSchema }).strict();
export const ChatRealtimeSchema = z
  .object({
    url: z.url().refine((s) => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(s)),
    publishable_key: z.string().min(1).max(2048),
    access_token: z.string().min(1).max(8192),
    expires_at: z.number().int().positive(),
    topic: z.string().regex(/^order-chat:[0-9a-f-]{36}$/),
  })
  .strict();
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRoom = z.infer<typeof ChatRoomSchema>;
export type ChatSendInput = z.infer<typeof ChatSendInputSchema>;
export type ChatSendResult = z.infer<typeof ChatSendResultSchema>;
export type ChatFlag = z.infer<typeof ChatFlagSchema>;
export type ChatParticipant = z.infer<typeof ChatParticipantSchema>;
