import { z } from 'zod';
import type { APIRoute } from 'astro';
import { accountContext } from '../auth/context';
import { readBoundedBody, verifyCsrf } from '../auth/security';
import { orderChatEnabled } from './config';
import {
  ChatRoomSchema,
  ChatSendInputSchema,
  ChatSendResultSchema,
  ChatTypingInputSchema,
  ChatTypingResultSchema,
  ChatFlagsSchema,
  ChatFlagResolutionSchema,
  ChatFlagResultSchema,
  ChatRealtimeSchema,
  ChatUuidSchema,
} from '../../contracts/chat';
type Kind = 'read' | 'send' | 'typing' | 'realtime' | 'flags' | 'resolve';
const statusCode = (error: unknown) => {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    const match = /^PT(400|401|403|404|409|429)$/.exec(error.code);
    if (match) return Number(match[1]);
  }
  return 503;
};
const RpcFailureSchema = z
  .object({
    error: z
      .object({
        code: z.union([
          z.literal(400),
          z.literal(401),
          z.literal(403),
          z.literal(404),
          z.literal(409),
          z.literal(429),
        ]),
        message: z.string(),
      })
      .strict(),
  })
  .strict();
function rpcFailure(data: unknown, error: unknown): number | null {
  if (error) return statusCode(error);
  if (data && typeof data === 'object' && 'error' in data) {
    const parsed = RpcFailureSchema.safeParse(data);
    return parsed.success ? parsed.data.error.code : 503;
  }
  return null;
}
const errorText = (status: number) =>
  status === 404
    ? 'Conversation not found.'
    : status === 429
      ? 'Please wait before sending another message.'
      : status === 401
        ? 'Authentication required.'
        : status === 403
          ? 'Chat access denied.'
          : status === 409
            ? 'Conversation changed. Refresh and try again.'
            : status === 400
              ? 'Invalid chat request.'
              : 'Chat service unavailable.';
function route(kind: Kind): APIRoute {
  return async (context) => {
    const account = accountContext(context.request, context.cookies);
    const failure = (status: number) =>
      account.json({ error: errorText(status) }, status);
    try {
      const method =
        kind === 'send' || kind === 'typing' || kind === 'resolve'
          ? 'POST'
          : 'GET';
      if (context.request.method !== method) {
        const result = failure(405);
        result.headers.set('Allow', method);
        return result;
      }
      if (!orderChatEnabled() || !account.config || !account.client)
        return failure(503);
      const identity = await account.identity();
      if (!identity) return failure(method === 'GET' ? 404 : 401);
      const admin = kind === 'flags' || kind === 'resolve';
      if (admin && identity.viewer.role !== 'admin') return failure(404);
      const identifier =
        kind === 'flags' ? null : ChatUuidSchema.safeParse(context.params.id);
      if (identifier && !identifier.success) return failure(400);
      const id = identifier?.data ?? '';
      let assignment: string | undefined;
      const queries = [...context.url.searchParams];
      if (queries.length) {
        if (
          kind !== 'read' ||
          queries.length !== 1 ||
          queries[0]?.[0] !== 'assignment_id'
        )
          return failure(400);
        const parsed = ChatUuidSchema.safeParse(queries[0][1]);
        if (!parsed.success) return failure(400);
        assignment = parsed.data;
      }
      const client = account.client;
      if (kind === 'read' || kind === 'realtime') {
        const { data, error } = await client.rpc('get_order_chat', {
          p_order_id: id,
          p_assignment_id: assignment,
        });
        const denied = rpcFailure(data, error);
        if (denied) return failure(denied);
        const room = ChatRoomSchema.safeParse(data);
        if (
          !room.success ||
          room.data.order_id !== id ||
          room.data.viewer !== identity.viewer.role ||
          (assignment && room.data.assignment_id !== assignment)
        )
          return failure(503);
        if (kind === 'read') return account.json(room.data);
        if (!room.data.assignment_id) return failure(404);
        // getUser-backed identity and freshly authorized room precede cookie-session access.
        // Expose only the current short-lived user access credential, never refresh state.
        const { data: sessionData, error: sessionError } =
          await client.auth.getSession();
        const session = sessionData.session;
        if (
          sessionError ||
          !session ||
          session.user.id !== identity.viewer.id ||
          !session.expires_at ||
          session.expires_at <= Math.floor(Date.now() / 1000)
        )
          return failure(503);
        let claims: unknown;
        try {
          const parts = session.access_token.split('.');
          if (parts.length !== 3) return failure(503);
          claims = JSON.parse(
            Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'),
          );
        } catch {
          return failure(503);
        }
        if (
          !claims ||
          typeof claims !== 'object' ||
          !('role' in claims) ||
          claims.role !== 'authenticated' ||
          !('sub' in claims) ||
          claims.sub !== identity.viewer.id ||
          !('exp' in claims) ||
          typeof claims.exp !== 'number' ||
          claims.exp <= Date.now() / 1000
        )
          return failure(503);
        const bootstrap = ChatRealtimeSchema.safeParse({
          url: account.config.url,
          publishable_key: account.config.publishableKey,
          access_token: session.access_token,
          expires_at: Math.min(session.expires_at, claims.exp),
          topic: `order-chat:${room.data.assignment_id}`,
        });
        return bootstrap.success ? account.json(bootstrap.data) : failure(503);
      }
      if (kind === 'flags') {
        const { data, error } = await client.rpc('list_order_chat_flags');
        const denied = rpcFailure(data, error);
        if (denied) return failure(denied);
        const parsed = ChatFlagsSchema.safeParse(data);
        return parsed.success ? account.json(parsed.data) : failure(503);
      }
      if (
        !verifyCsrf(
          context.request,
          account.config.origin,
          context.cookies.get(account.names.csrf)?.value,
          context.request.headers.get('x-csrf-token'),
        )
      )
        return failure(403);
      let body: unknown;
      try {
        if (
          context.request.headers.get('content-type')?.split(';')[0]?.trim() !==
          'application/json'
        )
          return failure(400);
        body = await readBoundedBody(context.request, 4096);
      } catch {
        return failure(400);
      }
      if (kind === 'send') {
        const input = ChatSendInputSchema.safeParse(body);
        if (!input.success) return failure(400);
        const { data, error } = await client.rpc('send_order_chat_message', {
          p_order_id: id,
          p_assignment_id: input.data.assignment_id,
          p_request_id: input.data.request_id,
          p_body: input.data.body,
        });
        const denied = rpcFailure(data, error);
        if (denied) return failure(denied);
        const parsed = ChatSendResultSchema.safeParse(data);
        if (
          !parsed.success ||
          parsed.data.order_id !== id ||
          parsed.data.assignment_id !== input.data.assignment_id ||
          parsed.data.request_id !== input.data.request_id ||
          (parsed.data.message &&
            (parsed.data.message.body !== input.data.body ||
              parsed.data.message.sender !== identity.viewer.role))
        )
          return failure(503);
        return account.json(parsed.data);
      }
      if (kind === 'typing') {
        const input = ChatTypingInputSchema.safeParse(body);
        if (!input.success) return failure(400);
        const { data, error } = await client.rpc('set_order_chat_typing', {
          p_order_id: id,
          p_assignment_id: input.data.assignment_id,
        });
        const denied = rpcFailure(data, error);
        if (denied) return failure(denied);
        const parsed = ChatTypingResultSchema.safeParse(data);
        return parsed.success &&
          parsed.data.order_id === id &&
          parsed.data.assignment_id === input.data.assignment_id
          ? account.json(parsed.data)
          : failure(503);
      }
      const input = ChatFlagResolutionSchema.safeParse(body);
      if (!input.success) return failure(400);
      const { data, error } = await client.rpc('resolve_order_chat_flag', {
        p_flag_id: id,
        p_status: input.data.status,
      });
      const denied = rpcFailure(data, error);
      if (denied) return failure(denied);
      const parsed = ChatFlagResultSchema.safeParse(data);
      return parsed.success &&
        parsed.data.flag.id === id &&
        parsed.data.flag.status === input.data.status
        ? account.json(parsed.data)
        : failure(503);
    } catch {
      return failure(503);
    }
  };
}
export const read = route('read');
export const send = route('send');
export const typing = route('typing');
export const realtime = route('realtime');
export const flags = route('flags');
export const resolve = route('resolve');
