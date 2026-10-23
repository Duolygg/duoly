import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { ChatRoom, ChatSendInput } from '../../contracts/chat';
import { CHAT_BLOCKED_NOTE } from '../../contracts/chat';
import {
  ChatError,
  readChat,
  sendChat,
  setTyping,
  subscribeChat,
  type ChatConnection,
} from '../../client/order-chat';
import { UPLOADED_AVATAR } from '../../contracts/account';
import {
  canSendDraft,
  codePointLength,
  EMOJI,
  shouldSendOnEnter,
  createRequestGuard,
  makeChatAttempt,
  chatFailure,
  typingDeadline,
  isNearBottom,
} from './emoji';
import './chat.css';

export type { ChatRoom } from '../../contracts/chat';
export interface OrderChatProps {
  orderId: string;
  csrf: string;
  assignmentId?: string;
  view: 'customer' | 'teammate' | 'admin';
  onOrderChanged?: () => void;
}

function Avatar({ name, image }: { name: string; image: string }) {
  const [failed, setFailed] = useState(false);
  const safe =
    /^\/assets\/avatars\/avatar-([1-9]|10)\.png$/.test(image) ||
    UPLOADED_AVATAR.test(image);
  return safe && !failed ? (
    <img
      className="oc-avatar"
      src={image}
      alt=""
      width="40"
      height="40"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="oc-avatar oc-initial" aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

export function ChatTranscript({
  room,
  view,
}: {
  room: ChatRoom;
  view: OrderChatProps['view'];
}) {
  return (
    <>
      {room.messages.map((message, index) => {
        if (message.kind === 'system')
          return (
            <div className="oc-system" key={message.id}>
              {message.body}
            </div>
          );
        const previous = room.messages[index - 1];
        const grouped =
          previous?.kind === 'user' &&
          previous.sender === message.sender &&
          Date.parse(message.created_at) - Date.parse(previous.created_at) <
            180000;
        const own = message.sender === view;
        return (
          <div
            key={message.id}
            className={`oc-message${own ? ' oc-own' : ''}`}
            data-grouped={grouped ? 'true' : 'false'}
          >
            {!own && (
              <span className="oc-message-avatar">
                {!grouped && (
                  <Avatar
                    key={message.image}
                    name={message.name}
                    image={message.image}
                  />
                )}
              </span>
            )}
            <div className="oc-message-content">
              {!grouped && (
                <span className="oc-author">{own ? 'You' : message.name}</span>
              )}
              <div className="oc-bubble">{message.body}</div>
              <time
                dateTime={message.created_at}
                title={
                  new Date(message.created_at).toLocaleString('en-GB', {
                    timeZone: 'UTC',
                  }) + ' UTC'
                }
              >
                {new Date(message.created_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC',
                })}{' '}
                UTC
              </time>
            </div>
          </div>
        );
      })}
    </>
  );
}

type ConversationProps = {
  room: ChatRoom | null;
  view: OrderChatProps['view'];
  connection?: string;
  draft?: string;
  notice?: string;
  pending?: 'sending' | 'uncertain' | 'rate-limited';
  typing?: boolean;
  hasNew?: boolean;
  onDraft?: (text: string) => void;
  onSend?: () => void;
  onRetry?: () => void;
  onArchive?: (id: string) => void;
  onBottom?: () => void;
  onScroll?: () => void;
  listRef?: RefObject<HTMLDivElement | null>;
};

/** Pure DTO-driven view also used by SSR/visual fixtures; never accepts tokens. */
export function ChatConversation({
  room,
  view,
  connection = 'Connecting…',
  draft = '',
  notice = '',
  pending,
  typing = false,
  hasNew = false,
  onDraft,
  onSend,
  onRetry,
  onArchive,
  onBottom,
  onScroll,
  listRef,
}: ConversationProps) {
  const id = useId();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const emojiButton = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const archived = Boolean(
    room?.archives.some(
      (archive) => archive.assignment_id === room.assignment_id,
    ),
  );
  const writable = Boolean(
    room?.writable && room.assignment_id && view !== 'admin' && !archived,
  );
  const disabled = !writable || Boolean(pending);
  const count = codePointLength(draft);
  const closePicker = () => {
    setEmojiOpen(false);
    emojiButton.current?.focus();
  };
  return (
    <section className="order-chat" aria-labelledby={`${id}-title`}>
      <header className="oc-header">
        {room?.participant ? (
          <Avatar key={room.participant.image} {...room.participant} />
        ) : (
          <span className="oc-placeholder" aria-hidden="true">
            ↗
          </span>
        )}
        <div className="oc-heading">
          <span className="oc-eyebrow">Session chat</span>
          <h2 id={`${id}-title`}>
            {room?.participant
              ? `Chat with ${room.participant.name}`
              : 'Your conversation'}
          </h2>
          <p>
            {room?.participant
              ? room.participant.role === 'teammate'
                ? 'Your teammate'
                : 'Your customer'
              : 'Just you and your teammate'}{' '}
            <span aria-hidden="true">·</span> <span>{connection}</span>
          </p>
        </div>
      </header>
      {room && view !== 'teammate' && room.archives.length > 0 && (
        <label className="oc-archive">
          Conversation
          <select
            aria-label="Choose conversation"
            value={archived ? (room.assignment_id ?? '') : ''}
            onChange={(event) => onArchive?.(event.target.value)}
          >
            <option value="">Current conversation</option>
            {room.archives.map((archive) => (
              <option key={archive.assignment_id} value={archive.assignment_id}>
                {archive.label} · read-only archive
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="oc-scroll-wrap">
        <div
          className="oc-transcript"
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-label="Conversation messages"
          aria-live="polite"
          aria-relevant="additions"
          tabIndex={0}
        >
          {!room ? (
            <div className="oc-empty">
              {notice ? 'Conversation unavailable.' : 'Loading conversation…'}
            </div>
          ) : !room.assignment_id ? (
            <div className="oc-empty">
              <strong>Your duo starts here</strong>
              <p>
                Waiting for a teammate to accept your session. Your conversation
                will appear here.
              </p>
            </div>
          ) : room.messages.length === 0 ? (
            <div className="oc-empty">
              <strong>
                {writable ? 'Say hello 👋' : 'No messages in this conversation'}
              </strong>
              {writable && (
                <p>
                  Coordinate your session here. Keep account details and
                  payments on Duoly.
                </p>
              )}
            </div>
          ) : (
            <ChatTranscript room={room} view={view} />
          )}
        </div>
        {hasNew && (
          <button className="oc-new" type="button" onClick={onBottom}>
            New messages ↓
          </button>
        )}
      </div>
      {room && (
        <div className="oc-typing" role="status">
          {typing && room.participant
            ? `${room.participant.name} is typing…`
            : '\u00a0'}
        </div>
      )}
      {notice && (
        <p className="oc-notice" role="status">
          {notice}
        </p>
      )}
      {pending && (
        <div className="oc-delivery" role="status">
          {pending === 'sending'
            ? 'Sending…'
            : pending === 'rate-limited'
              ? 'Too many messages. Wait a moment, then retry.'
              : 'Delivery not confirmed. Your draft is saved here.'}
          {pending !== 'sending' && writable && (
            <button type="button" onClick={onRetry}>
              Retry same message
            </button>
          )}
        </div>
      )}
      {writable ? (
        <form
          className="oc-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled && canSendDraft(draft)) onSend?.();
          }}
        >
          <label className="oc-sr" htmlFor={`${id}-draft`}>
            Message {view === 'customer' ? 'your teammate' : 'your customer'}
          </label>
          <textarea
            id={`${id}-draft`}
            ref={textarea}
            aria-label={`Message ${view === 'customer' ? 'your teammate' : 'your customer'}`}
            aria-describedby={`${id}-help ${id}-count`}
            aria-invalid={count > 500}
            value={draft}
            rows={3}
            placeholder="Say hello, plan your next game…"
            readOnly={Boolean(pending)}
            aria-disabled={Boolean(pending)}
            onChange={(event) => onDraft?.(event.target.value)}
            onKeyDown={(event) => {
              if (
                shouldSendOnEnter({
                  key: event.key,
                  shiftKey: event.shiftKey,
                  isComposing: event.nativeEvent.isComposing,
                  keyCode: event.nativeEvent.keyCode,
                })
              ) {
                event.preventDefault();
                if (!disabled && canSendDraft(draft)) onSend?.();
              }
            }}
          />
          <div className="oc-composer-tools">
            <div className="oc-emoji-anchor">
              <button
                ref={emojiButton}
                type="button"
                className="oc-emoji-trigger"
                aria-label="Choose emoji"
                aria-expanded={emojiOpen}
                aria-controls={`${id}-emoji`}
                disabled={disabled}
                onClick={() => {
                  setEmojiOpen(!emojiOpen);
                  if (!emojiOpen)
                    requestAnimationFrame(() =>
                      picker.current
                        ?.querySelector<HTMLButtonElement>('button')
                        ?.focus(),
                    );
                }}
              >
                ☺
              </button>
              {emojiOpen && (
                <div
                  ref={picker}
                  className="oc-emoji"
                  id={`${id}-emoji`}
                  role="group"
                  aria-label="Choose an emoji"
                  onBlur={(event) => {
                    if (
                      !event.currentTarget.contains(
                        event.relatedTarget as Node,
                      ) &&
                      event.relatedTarget !== emojiButton.current
                    )
                      setEmojiOpen(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      closePicker();
                    } else if (
                      [
                        'ArrowLeft',
                        'ArrowRight',
                        'ArrowUp',
                        'ArrowDown',
                        'Home',
                        'End',
                      ].includes(event.key)
                    ) {
                      event.preventDefault();
                      const buttons = Array.from(
                        event.currentTarget.querySelectorAll('button'),
                      );
                      const index = buttons.indexOf(
                        document.activeElement as HTMLButtonElement,
                      );
                      const next =
                        event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? buttons.length - 1
                            : (index +
                                (event.key === 'ArrowLeft'
                                  ? -1
                                  : event.key === 'ArrowUp'
                                    ? -6
                                    : event.key === 'ArrowDown'
                                      ? 6
                                      : 1) +
                                buttons.length) %
                              buttons.length;
                      buttons[next]?.focus();
                    }
                  }}
                >
                  {EMOJI.map(({ value, label }) => (
                    <button
                      key={label}
                      type="button"
                      aria-label={label}
                      title={label}
                      onClick={() => {
                        const start =
                          textarea.current?.selectionStart ?? draft.length;
                        const end =
                          textarea.current?.selectionEnd ?? draft.length;
                        onDraft?.(
                          draft.slice(0, start) + value + draft.slice(end),
                        );
                        setEmojiOpen(false);
                        requestAnimationFrame(() => {
                          textarea.current?.focus();
                          textarea.current?.setSelectionRange(
                            start + value.length,
                            start + value.length,
                          );
                        });
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span
              id={`${id}-count`}
              className={count > 500 ? 'oc-count oc-over' : 'oc-count'}
            >
              {count} / 500
            </span>
            <button
              className="oc-send"
              type="submit"
              disabled={disabled || !canSendDraft(draft)}
              aria-label="Send message"
            >
              Send <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p id={`${id}-help`} className="oc-help">
            Enter to send · Shift + Enter for a new line
          </p>
        </form>
      ) : (
        room && (
          <p className="oc-readonly">
            {!room.assignment_id
              ? 'Chat opens once your teammate accepts.'
              : view === 'admin'
                ? 'Read-only investigation view. Admins cannot send messages.'
                : 'Read-only conversation. Messages are saved; sending is closed.'}
          </p>
        )
      )}
    </section>
  );
}

type SessionActions = {
  refresh: () => void;
  send: (retry?: boolean) => void;
  draft: (text: string) => void;
};

function ChatSession({
  orderId,
  csrf,
  assignmentId,
  view,
  onOrderChanged,
  onArchive,
}: OrderChatProps & { onArchive: (id: string) => void }) {
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<ConversationProps['pending']>();
  const [connection, setConnection] = useState<ChatConnection>('connecting');
  const [typing, setTypingState] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const actions = useRef<SessionActions | null>(null);
  const changed = useRef(onOrderChanged);
  changed.current = onOrderChanged;

  useEffect(() => {
    const reads = createRequestGuard();
    let disposed = false;
    let denied = false;
    let currentRoom: ChatRoom | null = null;
    let currentDraft = '';
    let attempt: Readonly<ChatSendInput> | null = null;
    let sending = false;
    let assignmentVersion = 0;
    let lastTyping = -Infinity;
    let expires = 0;
    const alive = () => !disposed && !denied;
    const clearPrivate = () => {
      denied = true;
      reads.dispose();
      assignmentVersion++;
      currentRoom = null;
      currentDraft = '';
      attempt = null;
      expires = 0;
      setRoom(null);
      setDraft('');
      setPending(undefined);
      setTypingState(false);
      setHasNew(false);
      setConnection('unavailable');
      setNotice('This conversation is no longer available.');
      changed.current?.();
    };
    const clearAttempt = () => {
      attempt = null;
      sending = false;
      setPending(undefined);
    };
    const refresh = async () => {
      if (!alive()) return;
      const ticket = reads.next();
      try {
        const next = await readChat(fetch, orderId, assignmentId);
        if (!alive() || !reads.isCurrent(ticket)) return;
        // The transport strictly validates the DTO and order/assignment binding.
        if (next.viewer !== view) {
          clearPrivate();
          return;
        }
        if (currentRoom && currentRoom.assignment_id !== next.assignment_id) {
          assignmentVersion++;
          currentDraft = '';
          setDraft('');
          clearAttempt();
          setNotice('');
          nearBottom.current = true;
          changed.current?.();
        } else if (currentRoom && currentRoom.writable !== next.writable)
          changed.current?.();
        if (!currentRoom) setNotice('');
        currentRoom = next;
        setRoom(next);
        if (
          attempt &&
          next.messages.some(
            (message) =>
              message.request_id === attempt?.request_id &&
              message.sender === view,
          )
        ) {
          currentDraft = '';
          setDraft('');
          clearAttempt();
          setNotice('Message sent.');
        }
        expires = Math.max(
          0,
          ...next.typing
            .filter((item) => item.role !== view)
            .map((item) => typingDeadline(item.expires_at, Date.now())),
        );
        setTypingState(next.writable && expires > Date.now());
      } catch (error) {
        if (!alive() || !reads.isCurrent(ticket)) return;
        if (
          chatFailure(error instanceof ChatError ? error.status : 0) ===
          'denied'
        )
          clearPrivate();
        else {
          setConnection('unavailable');
          if (!currentRoom)
            setNotice('Could not load this conversation. Retrying…');
        }
      }
    };
    const send = async (retry = false) => {
      if (
        !alive() ||
        sending ||
        !currentRoom?.writable ||
        !currentRoom.assignment_id ||
        view === 'admin'
      )
        return;
      if (!retry && attempt) return;
      if (!attempt)
        attempt = makeChatAttempt(
          currentDraft,
          currentRoom.assignment_id,
          crypto.randomUUID(),
        );
      if (!attempt) return;
      const submitted = attempt;
      const version = assignmentVersion;
      sending = true;
      setPending('sending');
      setNotice('');
      try {
        // Never publish text to realtime. HTTP is the only message/typing write path.
        const result = await sendChat(fetch, orderId, csrf, submitted);
        if (!alive() || version !== assignmentVersion || attempt !== submitted)
          return;
        if (result.outcome === 'blocked') {
          clearAttempt();
          setNotice(CHAT_BLOCKED_NOTE);
        } else {
          currentDraft = '';
          setDraft('');
          clearAttempt();
          setNotice('Message sent.');
          // Confirmation is server-authored, not an optimistic client bubble.
          const latest = currentRoom;
          if (
            latest &&
            !latest.messages.some(
              (message) => message.id === result.message!.id,
            )
          ) {
            currentRoom = {
              ...latest,
              messages: [...latest.messages, result.message!]
                .sort((a, b) => a.sequence - b.sequence)
                .slice(-200),
            };
            setRoom(currentRoom);
          }
          void refresh();
        }
      } catch (error) {
        if (!alive() || version !== assignmentVersion || attempt !== submitted)
          return;
        sending = false;
        const status = error instanceof ChatError ? error.status : 0;
        const failure = chatFailure(status);
        if (failure === 'denied') clearPrivate();
        else if (failure === 'stale') {
          assignmentVersion++;
          clearAttempt();
          currentRoom = currentRoom
            ? { ...currentRoom, writable: false }
            : null;
          setRoom(currentRoom);
          setNotice('This assignment has changed. Your message was not sent.');
          changed.current?.();
          void refresh();
        } else if (status === 400) {
          clearAttempt();
          setNotice('Message not sent. Check your message and try again.');
        } else
          setPending(failure === 'rate-limited' ? 'rate-limited' : 'uncertain');
      }
    };
    const updateDraft = (text: string) => {
      if (!alive() || attempt) return;
      currentDraft = text;
      setDraft(text);
      setNotice('');
      if (
        !text.trim() ||
        !currentRoom?.writable ||
        !currentRoom.assignment_id ||
        view === 'admin' ||
        Date.now() - lastTyping < 2000
      )
        return;
      lastTyping = Date.now();
      const version = assignmentVersion;
      void setTyping(fetch, orderId, csrf, currentRoom.assignment_id).catch(
        (error: unknown) => {
          if (
            alive() &&
            version === assignmentVersion &&
            chatFailure(error instanceof ChatError ? error.status : 0) ===
              'denied'
          )
            clearPrivate();
        },
      );
    };
    actions.current = {
      refresh: () => {
        void refresh();
      },
      send: (retry) => {
        void send(retry);
      },
      draft: updateDraft,
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    // Authoritative fallback also catches revoked membership when realtime cannot connect.
    const polling = window.setInterval(onVisible, 8000);
    const expiry = window.setInterval(() => {
      if (alive())
        setTypingState(Boolean(currentRoom?.writable && expires > Date.now()));
    }, 250);
    void refresh();
    return () => {
      disposed = true;
      reads.dispose();
      assignmentVersion++;
      actions.current = null;
      currentRoom = null;
      currentDraft = '';
      attempt = null;
      window.clearInterval(polling);
      window.clearInterval(expiry);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [orderId, assignmentId, csrf, view]);

  const activeAssignment = room?.assignment_id;
  useEffect(() => {
    if (!activeAssignment) return;
    let stopped = false;
    let cleanup: (() => void) | undefined;
    // Parent subscription carries only invalidations and keeps credentials in memory.
    void subscribeChat(
      orderId,
      activeAssignment,
      () => {
        if (!stopped) actions.current?.refresh();
      },
      (state) => {
        if (!stopped) setConnection(state);
      },
    )
      .then((stop) => {
        if (stopped) stop();
        else cleanup = stop;
      })
      .catch(() => {
        if (!stopped) setConnection('unavailable');
      });
    return () => {
      stopped = true;
      cleanup?.();
    };
  }, [orderId, activeAssignment]);

  const lastMessageId = room?.messages.at(-1)?.id;
  useLayoutEffect(() => {
    if (!lastMessageId) return;
    if (nearBottom.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
      setHasNew(false);
    } else setHasNew(true);
  }, [lastMessageId]);
  const hasRoom = room !== null;
  useLayoutEffect(() => {
    const transcript = listRef.current;
    if (!transcript || !hasRoom) return;
    let mounted = true;
    const anchor = () => {
      if (mounted && nearBottom.current) {
        transcript.scrollTop = transcript.scrollHeight;
        setHasNew(false);
      }
    };
    const observer = new ResizeObserver(anchor);
    observer.observe(transcript);
    void document.fonts.ready.then(anchor);
    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, [hasRoom]);
  const label = !room
    ? notice
      ? 'Unavailable'
      : 'Connecting…'
    : !room.assignment_id
      ? 'Waiting for acceptance'
      : connection === 'connected'
        ? 'Live updates connected'
        : connection === 'connecting'
          ? 'Connecting updates…'
          : connection === 'reconnecting'
            ? 'Reconnecting · checking for messages'
            : 'Live updates unavailable · checking for messages';
  return (
    <ChatConversation
      room={room}
      view={view}
      connection={label}
      draft={draft}
      notice={notice}
      pending={pending}
      typing={typing}
      hasNew={hasNew}
      listRef={listRef}
      onDraft={(text) => actions.current?.draft(text)}
      onSend={() => actions.current?.send()}
      onRetry={() => actions.current?.send(true)}
      onArchive={onArchive}
      onScroll={() => {
        if (listRef.current) {
          nearBottom.current = isNearBottom(listRef.current);
          if (nearBottom.current) setHasNew(false);
        }
      }}
      onBottom={() => {
        if (listRef.current)
          listRef.current.scrollTop = listRef.current.scrollHeight;
        nearBottom.current = true;
        setHasNew(false);
      }}
    />
  );
}

function OrderChatScope(props: OrderChatProps) {
  const [archive, setArchive] = useState(props.assignmentId);
  return (
    <ChatSession
      key={archive ?? 'current'}
      {...props}
      assignmentId={archive}
      onArchive={(id) => setArchive(id || undefined)}
    />
  );
}

export default function OrderChat(props: OrderChatProps) {
  // Keying the scope prevents even one render of a previous order's private state.
  return (
    <OrderChatScope
      key={`${props.orderId}:${props.assignmentId ?? ''}:${props.view}:${props.csrf}`}
      {...props}
    />
  );
}
