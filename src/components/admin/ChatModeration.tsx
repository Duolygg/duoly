import { useEffect, useRef, useState, type ReactNode } from 'react';
import OrderChat from '../chat/OrderChat';
import './chat-moderation.css';
import {
  ChatFlagsSchema,
  ChatFlagResultSchema,
  ChatFlagResolutionSchema,
  type ChatFlag,
} from '../../contracts/chat';
import { ChatError, type ChatFetch } from '../../client/order-chat';

async function request(fetcher: ChatFetch, path: string, init: RequestInit) {
  try {
    const response = await fetcher(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      ...init,
    });
    if (!response.ok) throw new ChatError(response.status);
    const text = await response.text();
    if (text.length > 200000) throw new ChatError(503);
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw error instanceof ChatError ? error : new ChatError(503);
  }
}

export async function readFlags(fetcher: ChatFetch): Promise<ChatFlag[]> {
  const parsed = ChatFlagsSchema.safeParse(
    await request(fetcher, '/api/admin/chat-flags', { method: 'GET' }),
  );
  if (
    !parsed.success ||
    new Set(parsed.data.flags.map((flag) => flag.id)).size !==
      parsed.data.flags.length
  )
    throw new ChatError(503);
  return parsed.data.flags;
}

export interface ModerationState {
  flags: ChatFlag[] | null;
  selected: ChatFlag | null;
  busy: boolean;
  denied: boolean;
  notice: string;
}
const initialState = (): ModerationState => ({
  flags: null,
  selected: null,
  busy: false,
  denied: false,
  notice: '',
});
const sameSource = (a: ChatFlag, b: ChatFlag) =>
  a.id === b.id &&
  a.order_id === b.order_id &&
  a.assignment_id === b.assignment_id;

/** In-memory, serialized moderation. No mutation is confirmed before a bound authoritative reread. */
export function createModeration(
  fetcher: ChatFetch,
  csrf: string,
  changed: (state: ModerationState) => void,
) {
  let state = initialState();
  let disposed = false;
  const alive = () => !disposed && !state.denied;
  const update = (patch: Partial<ModerationState>) => {
    if (!disposed) {
      state = { ...state, ...patch };
      changed(state);
    }
  };
  const deny = () =>
    update({
      flags: null,
      selected: null,
      denied: true,
      busy: false,
      notice:
        'Private moderation is no longer accessible. Reload after signing in with an authorized admin account.',
    });
  async function run(work: () => Promise<ChatFlag[]>) {
    if (state.busy || !alive()) return;
    update({ busy: true, notice: '' });
    try {
      const flags = await work();
      if (alive()) update({ flags });
    } catch (error) {
      if (!alive()) return;
      if (error instanceof ChatError && [401, 403, 404].includes(error.status))
        deny();
      else
        update({
          notice:
            'Update not confirmed. Last confirmed flags are unchanged. Refresh before trying again.',
        });
    } finally {
      if (alive()) update({ busy: false });
    }
  }
  return {
    snapshot: () => state,
    deny,
    dispose: () => {
      disposed = true;
      state = initialState();
    },
    select: (id: string | null) => {
      if (alive())
        update({
          selected: state.flags?.find((flag) => flag.id === id) ?? null,
        });
    },
    refresh: () => run(() => readFlags(fetcher)),
    resolve: (id: string, status: 'warned' | 'dismissed') => {
      const source = state.flags?.find((flag) => flag.id === id);
      if (
        !source ||
        source.status !== 'open' ||
        !csrf ||
        !ChatFlagResolutionSchema.safeParse({ status }).success
      )
        return Promise.resolve();
      return run(async () => {
        const result = ChatFlagResultSchema.safeParse(
          await request(fetcher, `/api/admin/chat-flags/${source.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrf,
            },
            body: JSON.stringify({ status }),
          }),
        );
        if (
          !result.success ||
          !sameSource(source, result.data.flag) ||
          result.data.flag.status !== status
        )
          throw new ChatError(503);
        if (!alive()) throw new ChatError(403);
        const fresh = await readFlags(fetcher);
        const confirmed = fresh.find((flag) => flag.id === source.id);
        if (
          !confirmed ||
          !sameSource(source, confirmed) ||
          confirmed.status !== status
        )
          throw new ChatError(503);
        return fresh;
      });
    },
  };
}

export function ModerationPanel({
  state,
  canResolve,
  onRefresh,
  onResolve,
  onSelect,
  children,
}: {
  state: ModerationState;
  canResolve: boolean;
  onRefresh?: () => void;
  onResolve?: (id: string, status: 'warned' | 'dismissed') => void;
  onSelect?: (id: string | null) => void;
  children?: ReactNode;
}) {
  const flags = state.denied ? null : state.flags;
  return (
    <section
      className="chat-moderation"
      aria-label="Private chat moderation"
      aria-busy={state.busy}
    >
      <header className="cm-heading">
        <div>
          <h2>Chat moderation</h2>
          <p>
            Private admin review · Up to 50 recent flags. Not a total of all
            reports.
          </p>
        </div>
        <button
          type="button"
          disabled={state.busy || state.denied}
          onClick={onRefresh}
        >
          Refresh flags
        </button>
      </header>
      <p className="cm-notice" role="status" aria-live="polite">
        {state.notice ||
          (state.busy
            ? 'Checking flagged messages…'
            : !flags && !state.denied
              ? 'Loading flagged messages…'
              : '')}
      </p>
      {flags && (
        <>
          {flags.length === 0 ? (
            <p>No flagged messages in the current response.</p>
          ) : (
            <ul className="cm-list">
              {flags.map((flag) => (
                <li className="cm-flag" key={flag.id}>
                  <div className="cm-meta">
                    <strong>{flag.sender_name}</strong>
                    <span>{flag.rule}</span>
                    <span className="cm-status">{flag.status}</span>
                    <span>Warnings: {flag.warning_count}</span>
                  </div>
                  <blockquote>{flag.body}</blockquote>
                  <time dateTime={flag.created_at}>
                    {new Date(flag.created_at).toLocaleString('en-GB', {
                      timeZone: 'UTC',
                    })}{' '}
                    UTC
                  </time>
                  <dl className="cm-source">
                    <div>
                      <dt>Order</dt>
                      <dd>{flag.order_id}</dd>
                    </div>
                    <div>
                      <dt>Assignment</dt>
                      <dd>{flag.assignment_id}</dd>
                    </div>
                  </dl>
                  <div
                    className="cm-actions"
                    role="group"
                    aria-label={`Review flag from ${flag.sender_name}`}
                  >
                    <button
                      type="button"
                      disabled={state.busy}
                      aria-pressed={state.selected?.id === flag.id}
                      onClick={() => onSelect?.(flag.id)}
                    >
                      Open read-only chat
                    </button>
                    <button
                      type="button"
                      disabled={
                        state.busy || !canResolve || flag.status !== 'open'
                      }
                      onClick={() => onResolve?.(flag.id, 'warned')}
                    >
                      Warned
                    </button>
                    <button
                      type="button"
                      disabled={
                        state.busy || !canResolve || flag.status !== 'open'
                      }
                      onClick={() => onResolve?.(flag.id, 'dismissed')}
                    >
                      Dismissed
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {state.selected && (
            <div className="cm-investigation">
              <header>
                <h3>Read-only investigation</h3>
                <button type="button" onClick={() => onSelect?.(null)}>
                  Close investigation
                </button>
              </header>
              <p>
                Flagged order {state.selected.order_id} · Assignment{' '}
                {state.selected.assignment_id}. Admins cannot send messages or
                act as players.
              </p>
              {children}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function ChatModeration({ csrf }: { csrf: string }) {
  const [state, setState] = useState<ModerationState>(initialState);
  const model = useRef<ReturnType<typeof createModeration> | null>(null);
  useEffect(() => {
    const active = createModeration(fetch, csrf, setState);
    model.current = active;
    void active.refresh();
    const refresh = () => {
      if (document.visibilityState === 'visible') void active.refresh();
    };
    const interval = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active.dispose();
      model.current = null;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [csrf]);
  return (
    <ModerationPanel
      state={state}
      canResolve={Boolean(csrf)}
      onRefresh={() => {
        void model.current?.refresh();
      }}
      onSelect={(id) => model.current?.select(id)}
      onResolve={(id, status) => {
        void model.current?.resolve(id, status);
      }}
    >
      {state.selected && !state.denied && (
        <OrderChat
          key={`${state.selected.order_id}:${state.selected.assignment_id}`}
          orderId={state.selected.order_id}
          assignmentId={state.selected.assignment_id}
          view="admin"
          csrf={csrf}
          onOrderChanged={() => model.current?.deny()}
        />
      )}
    </ModerationPanel>
  );
}
