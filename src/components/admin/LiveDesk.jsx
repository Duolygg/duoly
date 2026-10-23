import React from 'react';
import { GAME as GAMES } from '../../design-reference/lib/games';
import {
  C,
  DISPLAY,
  card,
  h2,
  pill,
  eur,
  ago,
} from '../../design-reference/components/admin/ui';
import { order } from './api';

// Live desk, read-only first step: the shared queue with each order's 5-minute release
// window, orders being played, and the last 24 hours. Built on /api/admin/orders; cancel,
// refund and handover links come next. Admins never play orders (spec).
const POLL_MS = 5000;
const WINDOW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const CANCEL = {
  queue_expired: 'No teammate in 5 min',
  customer_cancelled: 'Customer cancelled',
};

const mmss = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

export default class LiveDesk extends React.Component {
  constructor(props) {
    super(props);
    this.state = { orders: [], loaded: false, error: '', now: Date.now() };
  }
  componentDidMount() {
    this.load();
    this._poll = setInterval(() => this.load(), POLL_MS);
    this._tick = setInterval(() => this.setState({ now: Date.now() }), 1000);
  }
  componentWillUnmount() {
    clearInterval(this._poll);
    clearInterval(this._tick);
  }
  async load() {
    if (document.hidden) return;
    const res = await this.props.api.get('/api/admin/orders');
    if (!res.ok) return this.setState({ error: res.error, loaded: true });
    this.setState({
      orders: (res.data.orders || []).map(order),
      error: '',
      loaded: true,
      now: Date.now(),
    });
  }
  kpi(label, value, sub, color) {
    return (
      <div style={{ ...card, padding: '18px' }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: '800',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: C.faint,
          }}
        >
          {label}
        </div>
        <div
          style={{
            marginTop: '6px',
            fontFamily: DISPLAY,
            fontSize: '30px',
            fontWeight: '800',
            color: color || C.white,
          }}
        >
          {value}
        </div>
        {sub ? (
          <div style={{ fontSize: '12.5px', color: C.dim }}>{sub}</div>
        ) : null}
      </div>
    );
  }
  line(o, right, extra) {
    const g = GAMES[o.game] || { name: o.game, img: '' };
    return (
      <li
        key={o.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px 14px',
          borderRadius: '16px',
          background: C.bg,
          border: '1px solid ' + C.line,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            minWidth: '0',
          }}
        >
          <img
            src={g.img}
            alt={g.name}
            width="34"
            height="34"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              flex: '0 0 auto',
            }}
          />
          <span style={{ flex: '1', minWidth: '0', lineHeight: '1.3' }}>
            <span
              style={{
                display: 'block',
                fontWeight: '600',
                color: C.white,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {o.service}
              {o.games > 1 ? ' ×' + o.games : ''}
              {o.gg ? ' · Gamer Girl' : ''}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: '12.5px',
                color: C.dim,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {o.id} · {o.customer}
              {o.teammate ? ' with ' + o.teammate : ''} · {o.region}
              {o.rank ? ' · ' + o.rank : ''}
            </span>
          </span>
          <span
            style={{
              flex: '0 0 auto',
              textAlign: 'right',
              fontSize: '13px',
              fontWeight: '700',
              color: C.white,
            }}
          >
            {right}
          </span>
        </div>
        {extra}
      </li>
    );
  }
  column(id, title, list, empty, render) {
    return (
      <section
        aria-labelledby={id}
        style={{ ...card, padding: '18px', minWidth: '0' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <h2 id={id} style={h2}>
            {title}
          </h2>
          <span style={{ fontSize: '13px', fontWeight: '700', color: C.muted }}>
            {list.length}
          </span>
        </div>
        <ul
          style={{
            listStyle: 'none',
            margin: '14px 0 0',
            padding: '0',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {list.map(render)}
          {!list.length ? (
            <li style={{ fontSize: '14px', color: C.dim }}>{empty}</li>
          ) : null}
        </ul>
      </section>
    );
  }
  render() {
    const s = this.state;
    const now = s.now;
    const queued = s.orders
      .filter((o) => o.status === 'Queued')
      .sort((a, b) => a.queuedAt - b.queuedAt);
    const playing = s.orders
      .filter((o) => o.status === 'In progress')
      .sort((a, b) => a.acceptedAt - b.acceptedAt);
    const recent = s.orders
      .filter(
        (o) =>
          (o.status === 'Completed' || o.status === 'Cancelled') &&
          now - (o.completedAt || o.cancelledAt || o.createdAt) < DAY_MS,
      )
      .sort(
        (a, b) =>
          (b.completedAt || b.cancelledAt) - (a.completedAt || a.cancelledAt),
      );
    const today = s.orders.filter((o) => now - o.createdAt < DAY_MS);
    const matched = today.filter((o) => o.acceptedAt);
    const avgWait = matched.length
      ? matched.reduce((t, o) => t + o.waitSec, 0) / matched.length
      : 0;
    const expired = today.filter(
      (o) => o.cancelReason === 'queue_expired',
    ).length;
    if (!s.loaded)
      return <div aria-busy="true" style={{ ...card, height: '120px' }} />;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {s.error ? (
          <p
            role="status"
            style={{ margin: '0', fontSize: '13.5px', color: C.pink }}
          >
            {s.error}
          </p>
        ) : null}
        <div className="ops-kpis">
          {this.kpi(
            'Waiting now',
            queued.length,
            queued.length
              ? 'oldest ' + mmss(now - queued[0].queuedAt)
              : 'queue is empty',
            queued.length ? C.gold : C.white,
          )}
          {this.kpi(
            'Being played',
            playing.length,
            playing.length ? 'live sessions' : 'nobody in game',
          )}
          {this.kpi(
            'Avg wait, 24 h',
            matched.length ? mmss(avgWait * 1000) : '–',
            matched.length + ' matched',
          )}
          {this.kpi(
            'Expired, 24 h',
            expired,
            today.length ? 'of ' + today.length + ' orders' : 'no orders yet',
            expired ? C.red : C.white,
          )}
        </div>
        <div className="ops-3col">
          {this.column(
            'ld-q',
            'Waiting',
            queued,
            'Nobody is waiting. New orders appear here the second they’re paid.',
            (o) => {
              const left = WINDOW_MS - (now - o.queuedAt);
              const pct = Math.min(
                100,
                Math.max(0, ((now - o.queuedAt) / WINDOW_MS) * 100),
              );
              return this.line(
                o,
                left > 0 ? mmss(left) : 'expiring',
                <div
                  aria-label={'Time left ' + mmss(left)}
                  style={{
                    height: '6px',
                    borderRadius: '999px',
                    background: C.raised,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: pct + '%',
                      height: '100%',
                      borderRadius: '999px',
                      background:
                        pct > 80 ? C.red : pct > 50 ? C.gold : C.green,
                      transition: 'width 1s linear',
                    }}
                  />
                </div>,
              );
            },
          )}
          {this.column(
            'ld-p',
            'In game',
            playing,
            'No orders being played right now.',
            (o) => this.line(o, mmss(now - o.acceptedAt)),
          )}
          {this.column(
            'ld-r',
            'Last 24 hours',
            recent,
            'Nothing finished in the last 24 hours.',
            (o) =>
              this.line(
                o,
                eur(o.amount),
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12.5px',
                    color: C.dim,
                  }}
                >
                  <span style={pill(o.status)}>{o.status}</span>
                  {o.status === 'Cancelled'
                    ? CANCEL[o.cancelReason] || 'Cancelled'
                    : 'completed'}{' '}
                  {ago(o.completedAt || o.cancelledAt, now)}
                </div>,
              ),
          )}
        </div>
        <p style={{ margin: '0', fontSize: '13px', color: C.dim }}>
          Updates every 5 seconds. Cancel, refund and handover links to a
          specific teammate come next.
        </p>
      </div>
    );
  }
}
