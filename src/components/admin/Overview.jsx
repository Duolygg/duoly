import React from 'react';
import { GAME as GAMES } from '../../design-reference/lib/games';
import {
  C,
  DISPLAY,
  card,
  h2,
  chip,
  btn,
  pill,
  eur,
  usd,
  eur0,
  num,
  ago,
  dateTime,
} from '../../design-reference/components/admin/ui';
import { allAdminPages, order } from './api';

// Port of the original components/admin/Overview.jsx. Data: /api/admin/orders, applications
// and (when order chat is on) chat flags. Improvement on the original: Duoly's earnings are the
// real margin per order (paid amount minus the teammate payout at the booked rate) instead of a
// flat 40%. Reports and payouts still show a dash.
const DAY = 86400000;
const POLL_MS = 30000;

const sum = (list, k) => list.reduce((a, x) => a + x[k], 0);

// Charged orders only: cancelled ones were released or refunded, never kept.
const fee = (o) => Math.max(0, o.amount - o.payoutUsd / (Number(o.fx) || 1));
function daily(orders, now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 59; i >= 0; i--) {
    const ts = start.getTime() - i * DAY;
    days.push({ ts, revenue: 0, fee: 0, orders: 0 });
  }
  const first = days[0].ts;
  for (const o of orders) {
    if (o.status === 'Cancelled' || o.createdAt < first) continue;
    const d = days[Math.min(59, Math.floor((o.createdAt - first) / DAY))];
    d.revenue += o.amount;
    d.fee += fee(o);
    d.orders += 1;
  }
  return days;
}

export default class Overview extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      range: 30,
      metric: 'revenue',
      hover: null,
      data: null,
      now: Date.now(),
    };
  }
  componentDidMount() {
    this.load();
    this._t = setInterval(() => this.load(), POLL_MS);
  }
  componentWillUnmount() {
    clearInterval(this._t);
  }
  async load() {
    const { api, chatEnabled } = this.props;
    const [o, a, p, f, summary] = await Promise.all([
      allAdminPages(api, '/api/admin/orders', 'orders'),
      allAdminPages(api, '/api/admin/applications', 'applications'),
      api.get('/api/admin/presence'),
      chatEnabled ? api.get('/api/admin/chat-flags') : Promise.resolve(null),
      api.get('/api/admin/overview'),
    ]);
    if (!o.ok) return this.setState({ error: o.error });
    const now = Date.now();
    const orders = (o.data.orders || []).map(order);
    const week = orders.filter(
      (x) => x.acceptedAt && now - x.acceptedAt < 7 * DAY,
    );
    this.setState({
      now,
      error: '',
      data: {
        orders,
        daily: daily(orders, now),
        live: {
          queue: orders.filter((x) => x.status === 'Queued').length,
          online: p.ok
            ? (p.data.online || []).filter((person) => !person.admin).length
            : null,
          avgWait: week.length
            ? Math.round(week.reduce((t, x) => t + x.waitSec, 0) / week.length)
            : null,
        },
        applications: a.ok
          ? (a.data.applications || []).map((x) => ({
              status: x.status === 'pending' ? 'Pending' : x.status,
            }))
          : [],
        flags:
          f && f.ok
            ? (f.data.flags || []).map((x) => ({
                status: x.status === 'open' ? 'Open' : x.status,
              }))
            : null,
        reportsOpen: summary.ok ? Number(summary.data.reportsOpen) || 0 : null,
        payouts: summary.ok ? Number(summary.data.payoutsDue) || 0 : null,
        payoutsTotal: summary.ok
          ? (Number(summary.data.payoutsDueUsdCents) || 0) / 100
          : null,
      },
    });
  }
  kpis() {
    const data = this.state.data;
    const n = this.state.range;
    const cur = data.daily.slice(-n),
      prev = data.daily.slice(-2 * n, -n);
    // no numbers in the period before → no % change to show (null)
    const delta = (a, b) => (b ? (a - b) / b : null);
    const rev = sum(cur, 'revenue'),
      revP = sum(prev, 'revenue');
    const ord = sum(cur, 'orders'),
      ordP = sum(prev, 'orders');
    const fee = sum(cur, 'fee'),
      feeP = sum(prev, 'fee');
    const aov = ord ? rev / ord : 0,
      aovP = ordP ? revP / ordP : 0;
    // customers who booked (and didn't cancel) in the period, from the real orders
    const paidOrders = data.orders.filter((o) => o.status !== 'Cancelled');
    const uniq = (from, to) =>
      new Set(
        paidOrders
          .filter((o) => o.createdAt >= from && o.createdAt < to)
          .map((o) => o.customerId),
      ).size;
    const end = cur.length ? cur[cur.length - 1].ts + 86400000 : 0;
    const cust = cur.length ? uniq(cur[0].ts, end) : 0,
      custP = prev.length ? uniq(prev[0].ts, cur[0].ts) : 0;
    return [
      {
        label: 'Revenue',
        value: eur0(rev),
        delta: delta(rev, revP),
        spark: cur.map((x) => x.revenue),
        hint: 'What customers paid',
      },
      {
        label: 'Duoly earnings',
        value: eur0(fee),
        delta: delta(fee, feeP),
        spark: cur.map((x) => x.fee),
        hint: 'What Duoly keeps after teammate pay, per order at its booked rate',
      },
      {
        label: 'Orders',
        value: num(ord),
        delta: delta(ord, ordP),
        spark: cur.map((x) => x.orders),
        hint: 'Paid orders',
      },
      {
        label: 'Avg. order',
        value: eur(aov),
        delta: delta(aov, aovP),
        spark: cur.map((x) => (x.orders ? x.revenue / x.orders : 0)),
        hint: 'Revenue ÷ orders',
      },
      {
        label: 'Active customers',
        value: num(cust),
        delta: delta(cust, custP),
        spark: cur.map((x) => uniq(x.ts, x.ts + 86400000)),
        hint: 'Booked at least once in this period',
      },
    ];
  }
  render() {
    const { go, audit } = this.props;
    const s = this.state;
    const data = s.data;
    const now = s.now;
    if (!data)
      return s.error ? (
        <p role="status" style={{ margin: 0, color: C.pink }}>
          {s.error}
        </p>
      ) : (
        <div aria-busy="true" style={{ ...card, height: '160px' }} />
      );
    const days = data.daily.slice(-s.range);
    const key = s.metric;
    const max =
      Math.max.apply(
        null,
        days.map((x) => x[key]),
      ) || 1;
    // real teammates online right now (from their dashboards' check-ins)
    const online = data.live.online == null ? '–' : data.live.online;
    const inProgress = data.orders.filter(
      (o) => o.status === 'In progress',
    ).length;
    const queued = data.orders.filter((o) => o.status === 'Queued').length;
    const openReports = data.reportsOpen;
    const openFlags = data.flags
      ? data.flags.filter((x) => x.status === 'Open').length
      : null;
    const pendingApps = data.applications.filter(
      (x) => x.status === 'Pending',
    ).length;
    // orders per game in the selected range (cancelled ones were refunded, so they don't count)
    const inRange = data.orders.filter(
      (o) =>
        o.status !== 'Cancelled' && days.length && o.createdAt >= days[0].ts,
    );
    const byGame = {};
    inRange.forEach((o) => {
      byGame[o.game] = (byGame[o.game] || 0) + 1;
    });
    const games = Object.keys(byGame)
      .filter((g) => GAMES[g])
      .map((g) => ({
        id: g,
        ...GAMES[g],
        orders: byGame[g],
        share: byGame[g] / inRange.length,
      }))
      .sort((a, b) => b.orders - a.orders);
    const hover = s.hover != null ? days[s.hover] : null;
    const attention = [
      {
        n: queued,
        label: 'Unclaimed orders',
        text: 'Live: customers waiting for a teammate',
        to: 'live',
        color: C.gold,
      },
      {
        n: openReports,
        label: 'Customer reports',
        text: 'Waiting on a decision (bounty)',
        to: 'safety',
        color: C.red,
      },
      {
        n: openFlags,
        label: 'Flagged chats',
        text: 'Messages the safety filter stopped',
        to: 'safety',
        color: C.pink,
      },
      {
        n: pendingApps,
        label: 'Applications',
        text: 'New teammates to review',
        to: 'applications',
        color: C.gold,
      },
      {
        n: data.payouts,
        label: 'Payouts due',
        text:
          data.payoutsTotal == null
            ? 'Teammates to pay on Friday'
            : usd(data.payoutsTotal) + ' due this Friday',
        to: 'payouts',
        color: C.cyan,
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            role="group"
            aria-label="Time range"
            style={{ display: 'flex', gap: '6px' }}
          >
            {[
              [7, 'Last 7 days'],
              [30, 'Last 30 days'],
            ].map(([n, label]) => (
              <button
                key={n}
                type="button"
                aria-pressed={s.range === n ? 'true' : 'false'}
                onClick={() => this.setState({ range: n, hover: null })}
                style={chip(s.range === n)}
              >
                {label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '13px', color: C.dim }}>
            compared with the {s.range} days before
          </span>
        </div>

        <section aria-label="Key numbers" className="ops-kpis">
          {this.kpis().map((k) => {
            const up = k.delta >= 0;
            const mx = Math.max.apply(null, k.spark),
              mn = Math.min.apply(null, k.spark);
            const pts = k.spark
              .map(
                (y, i) =>
                  ((i / (k.spark.length - 1)) * 100).toFixed(1) +
                  ',' +
                  (28 - ((y - mn) / (mx - mn || 1)) * 24).toFixed(1),
              )
              .join(' ');
            return (
              <div
                key={k.label}
                style={{
                  ...card,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: '0',
                }}
              >
                <span style={{ fontSize: '13px', color: C.dim }} title={k.hint}>
                  {k.label}
                </span>
                <span
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: '28px',
                    fontWeight: '700',
                    letterSpacing: '-.03em',
                    color: C.white,
                    lineHeight: '1.1',
                  }}
                >
                  {k.value}
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  {k.delta == null ? (
                    <span
                      title="Nothing to compare with in the period before"
                      style={{
                        fontSize: '12.5px',
                        fontWeight: '700',
                        color: C.faint,
                      }}
                    >
                      –
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '12.5px',
                        fontWeight: '700',
                        whiteSpace: 'nowrap',
                        color: up ? C.green : C.red,
                      }}
                    >
                      {up ? '▲' : '▼'} {Math.abs(k.delta * 100).toFixed(1)}%
                    </span>
                  )}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 100 30"
                    preserveAspectRatio="none"
                    style={{
                      flex: '0 1 84px',
                      minWidth: '0',
                      width: '84px',
                      height: '28px',
                    }}
                  >
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={k.delta == null ? C.accent : up ? C.green : C.red}
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </div>
            );
          })}
        </section>

        <div className="ops-2col">
          <section
            aria-labelledby="ov-chart-h"
            style={{ ...card, padding: '20px' }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <h2 id="ov-chart-h" style={h2}>
                {key === 'revenue' ? 'Revenue' : 'Orders'} per day
              </h2>
              <div
                role="group"
                aria-label="Chart metric"
                style={{ display: 'flex', gap: '6px' }}
              >
                {[
                  ['revenue', 'Revenue'],
                  ['orders', 'Orders'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={key === id ? 'true' : 'false'}
                    onClick={() => this.setState({ metric: id })}
                    style={chip(key === id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: '8px', minHeight: '40px' }}>
              {hover ? (
                <div>
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: '24px',
                      fontWeight: '700',
                      color: C.white,
                    }}
                  >
                    {key === 'revenue'
                      ? eur(hover.revenue)
                      : num(hover.orders) + ' orders'}
                  </span>
                  <span
                    style={{
                      marginLeft: '10px',
                      fontSize: '13px',
                      color: C.dim,
                    }}
                  >
                    {new Date(hover.ts).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                    {hover === days[days.length - 1] ? ' · today so far' : ''}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: '13px', color: C.dim }}>
                  Hover or tap a bar for the day’s numbers. Today is still
                  running.
                </span>
              )}
            </div>
            {days.every((x) => !x[key]) ? (
              <p
                style={{
                  margin: '10px 0 0',
                  height: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '14px',
                  border: '1px dashed ' + C.line2,
                  fontSize: '13.5px',
                  color: C.dim,
                }}
              >
                No paid orders in the last {s.range} days yet. Cancelled orders
                aren’t counted.
              </p>
            ) : (
              <div
                role="img"
                aria-label={
                  (key === 'revenue' ? 'Revenue' : 'Orders') +
                  ' per day for the last ' +
                  s.range +
                  ' days'
                }
                onMouseLeave={() => this.setState({ hover: null })}
                style={{
                  marginTop: '10px',
                  height: '200px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: s.range > 7 ? '3px' : '10px',
                }}
              >
                {days.map((x, i) => {
                  const today = i === days.length - 1;
                  const active = s.hover === i;
                  return (
                    <span
                      key={x.ts}
                      onMouseEnter={() => this.setState({ hover: i })}
                      onClick={() => this.setState({ hover: i })}
                      style={{
                        flex: '1',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          width: '100%',
                          height: Math.max(2, (x[key] / max) * 100) + '%',
                          borderRadius: '6px 6px 2px 2px',
                          transition: 'background-color .15s, height .3s',
                          background: active
                            ? C.white
                            : today
                              ? 'repeating-linear-gradient(135deg, rgba(214, 187, 255, .55) 0 4px, rgba(214, 187, 255, .25) 4px 8px)'
                              : 'rgba(214, 187, 255, .55)',
                        }}
                      />
                    </span>
                  );
                })}
              </div>
            )}
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                color: C.faint,
              }}
            >
              <span>
                {new Date(days[0].ts).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <span>Today</span>
            </div>
          </section>

          <section
            aria-labelledby="ov-live-h"
            style={{ ...card, padding: '20px' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 id="ov-live-h" style={h2}>
                Live right now
              </h2>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  color: C.green,
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: C.green,
                    animation: 'dlpulse 1.4s ease-in-out infinite',
                  }}
                />
                Live
              </span>
            </div>
            <div
              style={{
                marginTop: '14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
              }}
            >
              {[
                [queued + data.live.queue, 'in the queue', C.gold],
                [
                  data.live.avgWait == null
                    ? '–'
                    : Math.floor(data.live.avgWait / 60) +
                      'm ' +
                      (data.live.avgWait % 60) +
                      's',
                  'avg. wait, 7 days',
                  C.white,
                ],
                [
                  online,
                  data.live.online == null
                    ? 'teammates online (not tracked yet)'
                    : 'teammates online',
                  C.green,
                ],
                [inProgress, 'games in progress', C.cyan],
              ].map(([v, l, color]) => (
                <div
                  key={l}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '14px',
                    background: C.bg,
                  }}
                >
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: '24px',
                      fontWeight: '700',
                      color,
                    }}
                  >
                    {v}
                  </div>
                  <div style={{ fontSize: '12.5px', color: C.dim }}>{l}</div>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: '16px',
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: C.faint,
              }}
            >
              Latest orders
            </div>
            <ul
              style={{
                listStyle: 'none',
                margin: '8px 0 0',
                padding: '0',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {!data.orders.length ? (
                <li
                  style={{
                    padding: '14px 4px',
                    fontSize: '13.5px',
                    color: C.dim,
                  }}
                >
                  No orders yet. New bookings show up here the moment they're
                  placed.
                </li>
              ) : null}
              {data.orders.slice(0, 6).map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => go('orders', { order: o.id })}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 4px',
                      border: 'none',
                      borderBottom: '1px solid ' + C.line,
                      background: 'transparent',
                      color: C.text,
                      textAlign: 'left',
                      transform: 'none',
                    }}
                  >
                    <img
                      src={(GAMES[o.game] || {}).img}
                      alt=""
                      width="28"
                      height="28"
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        flex: '0 0 auto',
                      }}
                    />
                    <span
                      style={{ flex: '1', minWidth: '0', lineHeight: '1.3' }}
                    >
                      <span
                        style={{
                          display: 'block',
                          fontSize: '13.5px',
                          fontWeight: '600',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {o.customer} · {o.service}
                        {o.games > 1 ? ' ×' + o.games : ''}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          color: C.dim,
                        }}
                      >
                        {ago(o.createdAt, now)} · {eur(o.amount)}
                      </span>
                    </span>
                    <span style={pill(o.status)}>{o.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="ops-2col">
          <section
            aria-labelledby="ov-attn-h"
            style={{ ...card, padding: '20px' }}
          >
            <h2 id="ov-attn-h" style={h2}>
              Needs your attention
            </h2>
            <div
              style={{
                marginTop: '14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '10px',
              }}
            >
              {attention.map((x) => (
                <button
                  key={x.label}
                  type="button"
                  onClick={() => go(x.to)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px',
                    borderRadius: '16px',
                    border: '1px solid ' + (x.n ? x.color + '44' : C.line),
                    background: x.n ? x.color + '0f' : C.bg,
                    color: C.text,
                    textAlign: 'left',
                    transform: 'none',
                  }}
                >
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: '30px',
                      fontWeight: '800',
                      color: x.n ? x.color : C.faint,
                      minWidth: '34px',
                      textAlign: 'center',
                    }}
                  >
                    {x.n == null ? '–' : x.n}
                  </span>
                  <span style={{ minWidth: '0', lineHeight: '1.35' }}>
                    <span
                      style={{
                        display: 'block',
                        fontWeight: '600',
                        color: C.white,
                      }}
                    >
                      {x.label}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '12.5px',
                        color: C.dim,
                      }}
                    >
                      {x.n == null
                        ? 'Not connected yet'
                        : x.n
                          ? x.text
                          : 'All clear'}
                    </span>
                  </span>
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={C.dim}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginLeft: 'auto', flex: '0 0 auto' }}
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="ov-games-h"
            style={{ ...card, padding: '20px' }}
          >
            <h2 id="ov-games-h" style={h2}>
              Orders by game
            </h2>
            <ul
              style={{
                listStyle: 'none',
                margin: '14px 0 0',
                padding: '0',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {!games.length ? (
                <li style={{ fontSize: '13.5px', color: C.dim }}>
                  No orders in the last {s.range} days yet.
                </li>
              ) : null}
              {games.map((g) => (
                <li
                  key={g.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <img
                    src={g.img}
                    alt=""
                    width="28"
                    height="28"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      flex: '0 0 auto',
                    }}
                  />
                  <span style={{ flex: '1', minWidth: '0' }}>
                    <span
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '8px',
                        fontSize: '13.5px',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: '600',
                          color: C.white,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {g.name}
                      </span>
                      <span style={{ color: C.muted }}>
                        {num(g.orders)} · {Math.round(g.share * 100)}%
                      </span>
                    </span>
                    <span
                      style={{
                        display: 'block',
                        marginTop: '6px',
                        height: '6px',
                        borderRadius: '999px',
                        background: 'rgba(196, 170, 255, .08)',
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          height: '100%',
                          width:
                            (g.share /
                              Math.max.apply(
                                null,
                                games.map((x) => x.share),
                              )) *
                              100 +
                            '%',
                          borderRadius: '999px',
                          background: C.accent,
                        }}
                      />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section
          aria-labelledby="ov-audit-h"
          style={{ ...card, padding: '20px' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <h2 id="ov-audit-h" style={h2}>
              Recent admin actions
            </h2>
            <button type="button" onClick={() => go('audit')} style={btn()}>
              Full audit log
            </button>
          </div>
          {audit.length ? (
            <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: '0' }}>
              {audit.slice(0, 5).map((x) => (
                <li
                  key={x.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px 12px',
                    padding: '10px 0',
                    borderBottom: '1px solid ' + C.line,
                    fontSize: '14px',
                  }}
                >
                  <span style={{ fontWeight: '600', color: C.white }}>
                    {x.action}
                  </span>
                  <span style={{ color: C.accent }}>{x.target}</span>
                  {x.detail ? (
                    <span style={{ color: C.muted }}>{x.detail}</span>
                  ) : null}
                  <span
                    style={{
                      marginLeft: 'auto',
                      color: C.faint,
                      fontSize: '12.5px',
                    }}
                  >
                    {x.who} · {dateTime(x.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: '12px 0 0', fontSize: '14px', color: C.dim }}>
              Nothing yet. Refunds, approvals, payouts and other actions show up
              here with who did them.
            </p>
          )}
        </section>
      </div>
    );
  }
}
