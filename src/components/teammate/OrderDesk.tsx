import { useEffect, useRef, useState } from 'react';
import PrivateProofs from '../proofs/PrivateProofs';
import OrderChat from '../chat/OrderChat';
import './order-desk.css';
import type { Completion } from '../../contracts/completion';
import { matchesCompletion, readEarnings } from './completion-client';
import { CompletionReceipt, RecentEarnings } from './completion-ui';
import {
  OrderCommandSchema,
  OrderResponseSchemas,
  type TeammateOrder,
} from '../../contracts/orders';

export type ReadState<T> =
  | { kind: 'loading' | 'denied' | 'signed-out' | 'unavailable' }
  | { kind: 'ready'; value: T };
export type DeskState = {
  queue: ReadState<TeammateOrder[]>;
  assignment: ReadState<TeammateOrder | null>;
};
export type AcceptResult =
  | 'accepted'
  | 'conflict'
  | 'expired'
  | 'denied'
  | 'signed-out'
  | 'uncertain'
  | 'unavailable';
export async function acceptOrder(
  fetcher: DeskFetch,
  id: string,
  csrf: string,
): Promise<AcceptResult> {
  if (!OrderCommandSchema.safeParse({ order_id: id }).success || !csrf)
    return 'unavailable';
  try {
    const response = await fetcher(`/api/teammate/orders/${id}/accept`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf }),
    });
    if (response.status === 409) return 'conflict';
    if (response.status === 410) return 'expired';
    if (response.status === 401) return 'signed-out';
    if (response.status === 403 || response.status === 404) return 'denied';
    if (!response.ok) return 'uncertain';
    const { order } = OrderResponseSchemas.teammateOrder.parse(
      await response.json(),
    );
    return order.id === id &&
      order.status === 'in_progress' &&
      order.current_assignment_id !== null
      ? 'accepted'
      : 'uncertain';
  } catch {
    return 'uncertain';
  }
}
export type DeskFetch = (url: string, init?: RequestInit) => Promise<Response>;
export const loadingDesk: DeskState = {
  queue: { kind: 'loading' },
  assignment: { kind: 'loading' },
};

async function read<T>(
  fetcher: DeskFetch,
  url: string,
  parse: (data: unknown) => T,
): Promise<ReadState<T>> {
  try {
    const response = await fetcher(url, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (response.status === 401) return { kind: 'signed-out' };
    if (response.status === 403 || response.status === 404)
      return { kind: 'denied' };
    if (!response.ok) return { kind: 'unavailable' };
    return { kind: 'ready', value: parse(await response.json()) };
  } catch {
    return { kind: 'unavailable' };
  }
}
export async function readDesk(fetcher: DeskFetch): Promise<DeskState> {
  const [queue, assignment] = await Promise.all([
    read(
      fetcher,
      '/api/teammate/queue',
      (data) => OrderResponseSchemas.teammateQueue.parse(data).orders,
    ),
    read(
      fetcher,
      '/api/teammate/order',
      (data) => OrderResponseSchemas.teammateAssignment.parse(data).order,
    ),
  ]);
  return { queue, assignment };
}

export async function claimAndRefresh(
  fetcher: DeskFetch,
  id: string,
  csrf: string,
): Promise<{ result: AcceptResult; state?: DeskState }> {
  const result = await acceptOrder(fetcher, id, csrf);
  if (result === 'accepted' || result === 'conflict' || result === 'expired')
    return { result, state: await readDesk(fetcher) };
  return { result };
}

const readMessages = {
  loading: 'Loading eligible orders…',
  denied:
    'Queue access requires server approval and linked Discord. Your teammate role alone does not grant access. Manage your profile or contact support about approval.',
  'signed-out': 'Your session is no longer available. Sign in again.',
  unavailable:
    'Order service unavailable. Refresh the desk to try reading again.',
};

function ReadNotice({
  state,
  assignment = false,
}: {
  state: ReadState<unknown>;
  assignment?: boolean;
}) {
  if (state.kind === 'ready') return null;
  const message =
    assignment && state.kind === 'loading'
      ? 'Loading your assignment…'
      : assignment && state.kind === 'denied'
        ? 'Your current assignment cannot be accessed. Refresh or contact support.'
        : readMessages[state.kind];
  return (
    <p
      role={
        state.kind === 'unavailable' || state.kind === 'denied'
          ? 'alert'
          : 'status'
      }
      className="td-notice"
    >
      {message} {state.kind === 'signed-out' && <a href="/login">Sign in</a>}
      {state.kind === 'denied' && <a href="/profile">Manage profile</a>}
    </p>
  );
}

function OrderCard({
  order,
  active,
  disabled,
  onAccept,
}: {
  order: TeammateOrder;
  active?: boolean;
  disabled: boolean;
  onAccept?: (id: string) => void;
}) {
  return (
    <article className={`td-card${active ? ' td-active' : ''}`}>
      <div className="td-card-top">
        <span className="td-label">{order.public_reference}</span>
        <span className="td-payout">
          ${(order.payout_usd_cents / 100).toFixed(2)} USD
        </span>
      </div>
      <h3>{order.title}</h3>
      <p className="td-muted">
        {order.game.toUpperCase()} · {order.service}
        {order.gg ? ' · Gamer Girl' : ''}
      </p>
      <div className="td-customer">
        <img
          src={order.customer_image || '/assets/avatars/avatar-1.png'}
          alt=""
          width="36"
          height="36"
        />
        <span>
          {order.customer_name}
          {order.customer_country && (
            <span className="td-muted">
              {' '}
              · {order.customer_country.toUpperCase()}
            </span>
          )}
        </span>
      </div>
      <dl>
        <div>
          <dt>Session</dt>
          <dd>
            {order.units} {order.unit}
            {order.units === 1 ? '' : 's'}
          </dd>
        </div>
        <div>
          <dt>Region</dt>
          <dd>{order.region}</dd>
        </div>
        <div>
          <dt>Rank</dt>
          <dd>{order.rank || 'Not specified'}</dd>
        </div>
        <div>
          <dt>Voice</dt>
          <dd>{order.voice ? 'Requested' : 'Not requested'}</dd>
        </div>
      </dl>
      {active ? (
        <>
          <p className="td-assigned">Assigned to you</p>
          <dl>
            <div>
              <dt>In-game name</dt>
              <dd>{order.ign}</dd>
            </div>
          </dl>
          <p className="td-note">
            <strong>Customer note</strong>
            <br />
            {order.note || 'No note provided.'}
          </p>
        </>
      ) : (
        <button
          className="td-accept"
          type="button"
          disabled={disabled}
          onClick={() => onAccept?.(order.id)}
          aria-label={`Accept ${order.public_reference}`}
        >
          Accept order
        </button>
      )}
    </article>
  );
}

export function DeskView({
  state,
  pending,
  canAccept,
  onAccept,
  csrf = '',
  chatEnabled = false,
  onCompleted,
  onCompletionBusyChange,
  completionBusy = false,
}: {
  state: DeskState;
  pending: boolean;
  canAccept: boolean;
  onAccept?: (id: string) => void;
  csrf?: string;
  chatEnabled?: boolean;
  onCompleted?: (entry: Completion) => void | Promise<void>;
  onCompletionBusyChange?: (busy: boolean) => void;
  completionBusy?: boolean;
}) {
  return (
    <div
      className={`td-columns${chatEnabled ? ' td-chat-enabled' : ''}`}
      aria-busy={pending}
    >
      <section className="td-panel" aria-labelledby="td-assignment">
        <h2 id="td-assignment">Your assignment</h2>
        <ReadNotice state={state.assignment} assignment />
        {state.assignment.kind === 'ready' &&
          (state.assignment.value ? (
            <div className={chatEnabled ? 'td-assignment-layout' : undefined}>
              <OrderCard order={state.assignment.value} active disabled />
              <div className={chatEnabled ? 'td-conversation' : undefined}>
                {chatEnabled &&
                  !pending &&
                  state.assignment.value.status === 'in_progress' &&
                  state.assignment.value.current_assignment_id && (
                    <OrderChat
                      key={`chat:${state.assignment.value.id}:${state.assignment.value.current_assignment_id}`}
                      orderId={state.assignment.value.id}
                      assignmentId={
                        state.assignment.value.current_assignment_id
                      }
                      csrf={csrf}
                      view="teammate"
                    />
                  )}
                {!pending &&
                  state.assignment.value.status === 'in_progress' &&
                  state.assignment.value.current_assignment_id && (
                    <PrivateProofs
                      orderId={state.assignment.value.id}
                      key={`${state.assignment.value.id}:${state.assignment.value.current_assignment_id}`}
                      assignmentId={
                        state.assignment.value.current_assignment_id
                      }
                      mode="teammate"
                      csrf={csrf}
                      onCompleted={onCompleted}
                      onCompletionBusyChange={onCompletionBusyChange}
                    />
                  )}
              </div>
            </div>
          ) : (
            <p className="td-notice" role="status">
              No current assignment.
            </p>
          ))}
        <p className="td-muted td-limits">
          {!onCompleted &&
            (chatEnabled
              ? 'Completion and payout withdrawals are unavailable. '
              : 'Completion, chat and payout withdrawals are unavailable. ')}
          Withdrawals and deposit releases are not available yet.
        </p>
      </section>
      <section className="td-panel" aria-labelledby="td-queue">
        <h2 id="td-queue">Eligible orders</h2>
        <p className="td-muted">
          Only orders the server allows you to accept appear here. Refresh
          manually for the latest availability.
        </p>
        <ReadNotice state={state.queue} />
        {state.queue.kind === 'ready' &&
          (state.queue.value.length ? (
            <div className="td-orders">
              {state.queue.value.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  disabled={pending || completionBusy || !canAccept}
                  onAccept={onAccept}
                />
              ))}
            </div>
          ) : (
            <div className="td-empty" role="status">
              <h3>No eligible orders right now</h3>
              <p>
                Refresh later to check again. This is not a count of all orders.
              </p>
            </div>
          ))}
      </section>
    </div>
  );
}

const acceptMessages: Record<AcceptResult, string> = {
  accepted:
    'Acceptance confirmed. The refreshed assignment below shows the order assigned to you.',
  conflict:
    'This order could not be accepted. Another teammate may have won it, or you may already have an assignment. The desk has been refreshed; your assignment below is authoritative.',
  expired: 'This order is no longer available. The desk has been refreshed.',
  denied:
    'Acceptance denied. Server approval and linked Discord are required. Refresh to check access; no order was removed locally.',
  'signed-out': 'Your session ended. Sign in again before accepting orders.',
  uncertain:
    'Acceptance could not be confirmed. It may have reached the server. Refresh to check your current assignment before trying again. This request will not be retried automatically.',
  unavailable:
    'Acceptance is unavailable. Refresh or sign in again before trying.',
};

export default function OrderDesk({
  csrf,
  chatEnabled = false,
}: {
  csrf: string;
  chatEnabled?: boolean;
}) {
  const [state, setState] = useState<DeskState>(loadingDesk);
  const [pending, setPending] = useState(true);
  const [notice, setNotice] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [receipt, setReceipt] = useState<Completion | null>(null);
  const [earnings, setEarnings] = useState<ReadState<Completion[]>>({
    kind: 'loading',
  });
  const mounted = useRef(true);
  const busy = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void readEarnings(fetch).then((next) => {
      if (!cancelled) setEarnings(next);
    });
    void readDesk(fetch).then((next) => {
      if (!cancelled) {
        setState(next);
        setPending(false);
        busy.current = false;
      }
    });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);

  async function refresh() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setState(loadingDesk);
    setNotice('');
    setReceipt(null);
    setEarnings({ kind: 'loading' });
    const [next, records] = await Promise.all([
      readDesk(fetch),
      readEarnings(fetch),
    ]);
    if (!mounted.current) return;
    setEarnings(records);
    setState(next);
    setBlocked(false);
    setPending(false);
    busy.current = false;
  }
  const canAccept =
    !!csrf &&
    !completionBusy &&
    !blocked &&
    state.queue.kind === 'ready' &&
    state.assignment.kind === 'ready' &&
    state.assignment.value === null;
  async function accept(id: string) {
    if (busy.current || !canAccept) return;
    busy.current = true;
    setPending(true);
    setNotice('Accepting order…');
    const { result, state: next } = await claimAndRefresh(fetch, id, csrf);
    setBlocked(true);
    if (next) {
      const confirmed =
        result !== 'accepted' ||
        (next.assignment.kind === 'ready' && next.assignment.value?.id === id);
      setState(next);
      setBlocked(!confirmed);
      setNotice(
        confirmed
          ? acceptMessages[result]
          : 'Acceptance confirmed, but your current assignment could not be verified. Refresh before taking any further action.',
      );
    } else {
      setNotice(acceptMessages[result]);
    }
    setPending(false);
    busy.current = false;
  }
  return (
    <div className="teammate-desk">
      <div className="td-heading">
        <div>
          <span className="td-label">TEAMMATE DESK</span>
          <h1>Your next session starts here.</h1>
          <p className="td-muted">
            Your eligible queue and current assignment, straight from the order
            service.
          </p>
        </div>
        <button
          type="button"
          disabled={pending || completionBusy}
          onClick={() => void refresh()}
        >
          Refresh desk
        </button>
      </div>
      <noscript>
        <p className="td-notice">
          JavaScript is required to load live orders and accept an assignment.
          No orders have been loaded.
        </p>
      </noscript>
      <p role="status" aria-live="polite" className="td-status">
        {notice ||
          (pending
            ? 'Reading the order service…'
            : 'Desk loaded. Use Refresh desk to check for changes.')}
      </p>
      {!canAccept &&
        !pending &&
        state.assignment.kind === 'ready' &&
        state.assignment.value && (
          <p className="td-notice">
            Finish your current assignment before accepting another order.
          </p>
        )}
      <DeskView
        state={state}
        pending={pending}
        canAccept={canAccept}
        csrf={csrf}
        chatEnabled={chatEnabled}
        onAccept={(id) => void accept(id)}
        completionBusy={completionBusy}
        onCompletionBusyChange={(locked) => {
          busy.current = locked;
          setCompletionBusy(locked);
        }}
        onCompleted={async (entry) => {
          if (
            !mounted.current ||
            state.assignment.kind !== 'ready' ||
            state.assignment.value?.id !== entry.order_id ||
            state.assignment.value.current_assignment_id !== entry.assignment_id
          )
            return;
          setReceipt(entry);
          setBlocked(true);
          setNotice('Completion recorded. Reading your current assignment...');
          const [next, records] = await Promise.all([
            readDesk(fetch),
            readEarnings(fetch),
          ]);
          if (!mounted.current) return;
          setState(next);
          setEarnings(records);
          const clear =
            next.assignment.kind === 'ready' && next.assignment.value === null;
          setBlocked(!clear);
          setNotice(
            clear
              ? 'Completion recorded. Your assignment is finished.'
              : 'Completion recorded, but the current assignment is not confirmed clear. Refresh the desk before accepting another order.',
          );
          busy.current = false;
          setCompletionBusy(false);
        }}
      />
      {receipt &&
        !(
          earnings.kind === 'ready' &&
          earnings.value.some((entry) => matchesCompletion(entry, receipt))
        ) && (
          <div className="td-completion-notice" role="status">
            <CompletionReceipt entry={receipt} />
          </div>
        )}
      <RecentEarnings state={earnings} />
    </div>
  );
}
