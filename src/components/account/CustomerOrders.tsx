import React, { useEffect, useRef, useState } from 'react';
import type {
  CustomerOrder,
  OrderResponse,
  OrderResponseKind,
} from '../../contracts/orders';
import { euro, orderRequest, orderStatus, PAGE_SIZE } from './customer-orders';
import './customer-orders.css';

export function OrderSummary({ order }: { order: CustomerOrder }) {
  return (
    <article className="co-order">
      <div>
        <span className="co-eyebrow">
          {order.public_reference} · {orderStatus[order.status]}
        </span>
        <h3>{order.title}</h3>
        <p>
          {order.game.toUpperCase()} · {order.service} · {order.units}{' '}
          {order.unit}
          {order.units === 1 ? '' : 's'} · {order.region}
        </p>
        <p>
          {order.teammate
            ? `Teammate: ${order.teammate.name}`
            : 'No teammate assigned'}
        </p>
      </div>
      <a className="co-button co-primary" href={`/queue/${order.id}`}>
        View order <span className="co-sr">{order.public_reference}</span> →
      </a>
    </article>
  );
}
function OrderSection<K extends OrderResponseKind>({
  kind,
  title,
  path,
  loading,
  empty,
  paginated = false,
  render,
}: {
  kind: K;
  title: string;
  path: string;
  loading: string;
  empty: string;
  paginated?: boolean;
  render: (data: OrderResponse<K>) => React.ReactNode;
}) {
  const [data, setData] = useState<OrderResponse<K> | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let live = true;
    setPending(true);
    setError('');
    setData(null);
    orderRequest(
      kind,
      path + (paginated ? `?limit=${PAGE_SIZE}&offset=${offset}` : ''),
    )
      .then((value) => {
        if (live) setData(value);
      })
      .catch((failure: Error) => {
        if (live) setError(failure.message);
      })
      .finally(() => {
        if (live) setPending(false);
      });
    return () => {
      live = false;
    };
  }, [kind, path, paginated, offset, refresh]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const count =
    data &&
    ('orders' in data
      ? data.orders.length
      : 'credits' in data
        ? data.credits.length
        : 'order' in data && data.order
          ? 1
          : 0);
  return (
    <section className="co-card" aria-label={title} aria-busy={pending}>
      <div className="co-heading">
        <h2>{title}</h2>
        <button
          disabled={pending}
          onClick={() => setRefresh((value) => value + 1)}
          aria-label={`Refresh ${title.toLowerCase()}`}
        >
          Refresh
        </button>
      </div>
      {pending && <p role="status">{loading}…</p>}
      {error && (
        <p role="alert" tabIndex={-1} ref={errorRef}>
          {error} Data is unavailable, not an empty result.{' '}
          <a href="/login">Sign in</a> if your session ended.
        </p>
      )}
      {!pending &&
        !error &&
        data &&
        (count ? (
          render(data)
        ) : (
          <div className="co-empty">
            <img
              src="/assets/brand/logo-mascots.webp"
              alt=""
              width="100"
              height="63"
            />
            <p>{empty}</p>
          </div>
        ))}
      {paginated && (
        <nav className="co-pagination" aria-label={`${title} pages`}>
          <button
            disabled={pending || offset === 0}
            onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
          >
            Previous
          </button>
          <span>Page {offset / PAGE_SIZE + 1}</span>
          <button
            disabled={
              pending ||
              !!error ||
              count !== PAGE_SIZE ||
              offset + PAGE_SIZE > 100000
            }
            onClick={() => setOffset((value) => value + PAGE_SIZE)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
// Appearance follows EmptyDashboard and Dashboard; operational transport never imports the preview.
export default function CustomerOrders({ name }: { name: string }) {
  return (
    <div className="customer-orders">
      <header className="co-welcome">
        <div>
          <p className="co-eyebrow">Duoly account</p>
          <h1>Your dashboard</h1>
          <p>
            Welcome, <strong>{name}</strong>.
          </p>
        </div>
        <a className="co-button co-primary" href="/profile">
          Manage your profile
        </a>
      </header>
      <p>
        Refresh each section for the latest state. Booking and payments are not
        available yet.
      </p>
      <OrderSection
        kind="customerActive"
        title="Active order"
        path="/api/orders/active"
        loading="Loading active order"
        empty="No active order."
        render={(data) => data.order && <OrderSummary order={data.order} />}
      />
      <div className="co-grid">
        <OrderSection
          kind="customerHistory"
          title="Order history"
          path="/api/orders/history"
          loading="Loading order history"
          empty="No orders on this page."
          paginated
          render={(data) =>
            data.orders.map((order) => (
              <OrderSummary key={order.id} order={order} />
            ))
          }
        />
        <div>
          <p className="co-credit-note">
            Refund credit postings record queued-order credits. They are not a
            spendable wallet or payment-provider refunds. No aggregate balance
            is shown.
          </p>
          <OrderSection
            kind="refundCredits"
            title="Refund credit postings"
            path="/api/orders/credits"
            loading="Loading refund credit postings"
            empty="No refund credit postings on this page."
            paginated
            render={(data) => (
              <ul className="co-credits">
                {data.credits.map((credit) => (
                  <li key={credit.id}>
                    <strong>{euro(credit.amount_eur_cents)}</strong> ·
                    Queued-order credit
                    <p>
                      <time dateTime={credit.created_at}>
                        {credit.created_at.replace('T', ' ')}
                      </time>
                    </p>
                    <a href={`/queue/${credit.order_id}`}>
                      View credited order
                    </a>
                  </li>
                ))}
              </ul>
            )}
          />
        </div>
      </div>
    </div>
  );
}
