import React, { useEffect, useRef, useState } from 'react';
import type { CustomerOrder } from '../../contracts/orders';
import {
  canReroll,
  euro,
  orderCommand,
  orderRequest,
  orderStatus,
} from './customer-orders';
import PrivateProofs from '../proofs/PrivateProofs';
import './customer-orders.css';

// QueueRoom's purple card language, without prototype chat/payment/polling behavior.
export default function CustomerOrderRoom({
  initialOrder,
  csrf,
}: {
  initialOrder: CustomerOrder;
  csrf: string;
}): React.ReactElement {
  const [order, setOrder] = useState(initialOrder);
  const [pending, setPending] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(0);
  const locked = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const current = Date.now();
    setNow(current);
    if (!canReroll(order, current) || !order.accepted_at) return;
    // Local affordance expiry only: no status polling or automatic command.
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Date.parse(order.accepted_at) + 300001 - current,
    );
    return () => window.clearTimeout(timer);
  }, [order]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function refresh() {
    const data = await orderRequest('customerOrder', `/api/orders/${order.id}`);
    if (data.order.id !== initialOrder.id)
      throw new Error('Invalid order response.');
    setOrder(data.order);
    setStale(false);
    setNow(Date.now());
  }
  async function run(action?: 'cancel' | 'reroll') {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError('');
    setNotice('');
    let actionError = '';
    try {
      if (action) {
        // Re-check the local affordance; the server still decides atomically.
        if (
          (action === 'cancel' && order.status !== 'queued') ||
          (action === 'reroll' && !canReroll(order, Date.now()))
        ) {
          actionError =
            'This action is no longer available. Latest state requested.';
        } else {
          try {
            await orderCommand(order.id, action, csrf);
          } catch (failure) {
            actionError =
              failure instanceof Error
                ? failure.message
                : 'Order action unavailable.';
          }
        }
      }
      try {
        await refresh();
        setNotice(
          action
            ? actionError
              ? 'Latest order loaded. The action was not confirmed.'
              : 'Action confirmed by the server. Latest order loaded.'
            : 'Latest order loaded.',
        );
      } catch {
        setStale(true);
        setError(
          'Could not refresh this order. Displayed information may be stale. Refresh before taking another action.',
        );
      }
      if (actionError)
        setError((value) => [actionError, value].filter(Boolean).join(' '));
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  const eligible = now > 0 && canReroll(order, now);
  return (
    <div className="customer-orders">
      <a href="/dashboard">← Back to dashboard</a>
      <header className="co-welcome">
        <div>
          <p className="co-eyebrow">{order.public_reference}</p>
          <h1>Your order</h1>
        </div>
        <button
          disabled={pending}
          onClick={() => void run()}
          aria-label="Refresh order"
        >
          {pending ? 'Checking…' : 'Refresh order'}
        </button>
      </header>
      <p>
        Use manual refresh for the latest status. Updates are not automatic.
      </p>
      {error && (
        <p className="co-error" role="alert" tabIndex={-1} ref={errorRef}>
          {error} <a href="/login">Sign in</a> if your session ended.
        </p>
      )}
      <p role="status" aria-live="polite">
        {pending ? 'Checking the server…' : notice}
      </p>
      {stale && (
        <p className="co-error">
          Stale order details — actions disabled until a successful refresh.
        </p>
      )}
      <div className="co-grid">
        <section
          className="co-card"
          aria-label="Order details"
          aria-busy={pending}
        >
          <p className="co-eyebrow">{orderStatus[order.status]}</p>
          <h2>{order.title}</h2>
          <dl className="co-details">
            <dt>Game</dt>
            <dd>{order.game.toUpperCase()}</dd>
            <dt>Service</dt>
            <dd>{order.service}</dd>
            <dt>Units</dt>
            <dd>
              {order.units} {order.unit}
              {order.units === 1 ? '' : 's'}
            </dd>
            <dt>Order amount</dt>
            <dd>{euro(order.amount_eur_cents)}</dd>
            <dt>Created</dt>
            <dd>
              <time dateTime={order.created_at}>
                {order.created_at.replace('T', ' ')}
              </time>
            </dd>
            <dt>Region</dt>
            <dd>{order.region}</dd>
            <dt>Rank</dt>
            <dd>{order.rank || 'Not specified'}</dd>
            <dt>Your in-game name</dt>
            <dd>{order.ign}</dd>
            <dt>Your note</dt>
            <dd>{order.note || 'No note'}</dd>
            <dt>Voice preference</dt>
            <dd>{order.voice ? 'Voice requested' : 'No voice requested'}</dd>
            <dt>GG service</dt>
            <dd>{order.gg ? 'Yes' : 'No'}</dd>
            <dt>Rerolls used</dt>
            <dd>{order.rerolls} / 2</dd>
          </dl>
          {order.cancel_reason && (
            <p>
              Cancellation:{' '}
              {order.cancel_reason === 'queue_expired'
                ? 'Queue expired'
                : 'Customer cancelled'}
              . Any refund credit posting is listed on your dashboard; this is
              not a provider refund.
            </p>
          )}
          <div className="co-actions">
            {order.status === 'queued' && (
              <button
                disabled={pending || stale}
                onClick={() => void run('cancel')}
              >
                Cancel queued order
              </button>
            )}
            {eligible && (
              <button
                disabled={pending || stale}
                onClick={() => void run('reroll')}
              >
                Switch teammate
              </button>
            )}
          </div>
          <p>
            Cancellation is available only while queued. Switching teammates is
            limited to two rerolls, within five minutes of acceptance. Server
            eligibility is final.
          </p>
        </section>
        <aside className="co-card">
          <p className="co-eyebrow">Your teammate</p>
          <h2>{order.teammate?.name ?? 'Waiting for assignment'}</h2>
          {order.teammate ? (
            <p>Country: {order.teammate.country || 'Not specified'}</p>
          ) : (
            <>
              <img
                src="/assets/brand/logo-mascots.webp"
                alt=""
                width="160"
                height="101"
              />
              <p>
                {order.status === 'queued'
                  ? 'Your order is queued. Refresh to check for a teammate.'
                  : 'No teammate assigned.'}
              </p>
            </>
          )}
          <p>
            Chat, reviews, tips and completion actions are not available here.
          </p>
          {!pending && !stale && (
            <PrivateProofs
              orderId={order.id}
              assignmentId={order.current_assignment_id ?? undefined}
              mode="customer"
            />
          )}
        </aside>
      </div>
    </div>
  );
}
