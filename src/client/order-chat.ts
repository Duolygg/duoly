// eslint-disable-next-line no-restricted-imports -- Reviewed public SDK bridge: current-user JWT only, Auth client bypassed.
import { createClient } from '@supabase/supabase-js';
import {
  ChatRoomSchema,
  ChatSendInputSchema,
  ChatSendResultSchema,
  ChatTypingResultSchema,
  ChatRealtimeSchema,
  ChatUuidSchema,
  type ChatRoom,
  type ChatSendInput,
  type ChatSendResult,
} from '../contracts/chat';
export type ChatFetch = (url: string, init?: RequestInit) => Promise<Response>;
export type ChatConnection =
  'connecting' | 'connected' | 'reconnecting' | 'unavailable';
const errors: Record<number, string> = {
  400: 'Check your message and try again.',
  401: 'Sign in again to access this conversation.',
  403: 'You cannot send messages in this conversation.',
  404: 'This conversation is no longer accessible.',
  409: 'This assignment or message has changed. Refresh the conversation.',
  429: 'You are sending messages too quickly. Please wait a moment.',
};
export class ChatError extends Error {
  constructor(readonly status: number) {
    super(
      errors[status] ??
        'Chat service unavailable. Your message was not confirmed.',
    );
    this.name = 'ChatError';
  }
}
function id(value: string) {
  const parsed = ChatUuidSchema.safeParse(value);
  if (!parsed.success) throw new ChatError(400);
  return parsed.data;
}
async function request(
  fetcher: ChatFetch,
  path: string,
  init: RequestInit = {},
) {
  let response: Response;
  try {
    response = await fetcher(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      ...init,
    });
  } catch {
    throw new ChatError(503);
  }
  if (!response.ok)
    throw new ChatError(
      [400, 401, 403, 404, 409, 429].includes(response.status)
        ? response.status
        : 503,
    );
  try {
    const text = await response.text();
    if (text.length > 300000) throw new Error();
    return JSON.parse(text) as unknown;
  } catch {
    throw new ChatError(503);
  }
}
export async function readChat(
  fetcher: ChatFetch,
  orderId: string,
  assignmentId?: string,
): Promise<ChatRoom> {
  const order = id(orderId),
    assignment = assignmentId ? id(assignmentId) : undefined;
  const raw = await request(
    fetcher,
    `/api/orders/${order}/chat${assignment ? `?assignment_id=${assignment}` : ''}`,
  );
  const parsed = ChatRoomSchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.order_id !== order ||
    (assignment && parsed.data.assignment_id !== assignment)
  )
    throw new ChatError(503);
  return parsed.data;
}
export async function sendChat(
  fetcher: ChatFetch,
  orderId: string,
  csrf: string,
  input: ChatSendInput,
): Promise<ChatSendResult> {
  const order = id(orderId),
    parsed = ChatSendInputSchema.safeParse(input);
  if (!parsed.success || !csrf) throw new ChatError(400);
  const raw = await request(fetcher, `/api/orders/${order}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(parsed.data),
  });
  const result = ChatSendResultSchema.safeParse(raw);
  if (
    !result.success ||
    result.data.order_id !== order ||
    result.data.assignment_id !== parsed.data.assignment_id ||
    result.data.request_id !== parsed.data.request_id ||
    (result.data.message && result.data.message.body !== parsed.data.body)
  )
    throw new ChatError(503);
  return result.data;
}
export async function setTyping(
  fetcher: ChatFetch,
  orderId: string,
  csrf: string,
  assignmentId: string,
): Promise<void> {
  const order = id(orderId),
    assignment = id(assignmentId);
  if (!csrf) throw new ChatError(400);
  const raw = await request(fetcher, `/api/orders/${order}/chat/typing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ assignment_id: assignment }),
  });
  const parsed = ChatTypingResultSchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.order_id !== order ||
    parsed.data.assignment_id !== assignment
  )
    throw new ChatError(503);
}
/** Private invalidation only. Database messages always come through fresh HTTP ACLs. */
export async function subscribeChat(
  orderId: string,
  assignmentId: string,
  onChange: () => void,
  onState: (state: ChatConnection) => void,
): Promise<() => void> {
  let disposed = false;
  let closeTransport = () => {};
  let retryTimer: number | undefined;
  let retries = 0;
  const stop = () => {
    disposed = true;
    if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    closeTransport();
  };
  const reconnect = () => {
    if (disposed || retryTimer !== undefined) return;
    closeTransport();
    if (++retries > 5) {
      onState('unavailable');
      return;
    }
    onState('reconnecting');
    retryTimer = window.setTimeout(
      () => {
        retryTimer = undefined;
        void connect();
      },
      Math.min(30000, 1000 * 2 ** (retries - 1)),
    );
  };
  const connect = async () => {
    if (disposed) return;
    if (!retries) onState('connecting');
    try {
      const order = id(orderId),
        assignment = id(assignmentId);
      // Every new connection gets fresh HTTP identity and assignment authorization.
      const bootstrap = ChatRealtimeSchema.parse(
        await request(fetch, `/api/orders/${order}/chat/realtime`),
      );
      if (disposed) return;
      if (
        bootstrap.topic !== `order-chat:${assignment}` ||
        bootstrap.expires_at * 1000 <= Date.now()
      ) {
        onState('unavailable');
        return;
      }
      let token: string | null = bootstrap.access_token;
      bootstrap.access_token = '';
      let current = true;
      // accessToken bypasses the browser Auth client entirely. No refresh state,
      // cookies, URL detection or persistent storage can be initialized here.
      const client = createClient(bootstrap.url, bootstrap.publishable_key, {
        accessToken: async () => (current && !disposed ? token : null),
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      const transport: {
        expires?: number;
        channel?: ReturnType<typeof client.channel>;
      } = {};
      closeTransport = () => {
        if (!current) return;
        current = false;
        token = null;
        window.clearTimeout(transport.expires);
        if (transport.channel)
          void client.removeChannel(transport.channel).catch(() => {});
        client.realtime.disconnect();
        void client.realtime.setAuth().catch(() => {});
      };
      await client.realtime.setAuth();
      if (disposed || !current) {
        closeTransport();
        return;
      }
      transport.channel = client.channel(bootstrap.topic, {
        config: { private: true },
      });
      // Re-bootstrap shortly before expiry, rather than reusing a cached JWT.
      transport.expires = window.setTimeout(
        reconnect,
        Math.max(0, bootstrap.expires_at * 1000 - Date.now() - 15000),
      );
      transport.channel
        .on('broadcast', { event: 'chat_changed' }, () => {
          if (!disposed && current) onChange();
        })
        .subscribe((status) => {
          if (disposed || !current) return;
          if (status === 'SUBSCRIBED') {
            retries = 0;
            onState('connected');
            onChange();
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          )
            reconnect();
        });
    } catch (error) {
      closeTransport();
      if (disposed) return;
      onChange();
      if (
        error instanceof ChatError &&
        [400, 401, 403, 404].includes(error.status)
      )
        onState('unavailable');
      else reconnect();
    }
  };
  await connect();
  return stop;
}
