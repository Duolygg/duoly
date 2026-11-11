import React from 'react';
import { GAME as GAMES } from '../../design-reference/lib/games';
import {
  C,
  DISPLAY,
  card,
  h2,
  chip,
  btn,
  eur,
  usd,
  ago,
} from '../../design-reference/components/admin/ui';
import { signed } from '../../contracts/priority';
import { order } from './api';
import WaitingForOrders from '../shared/WaitingForOrders';

// Port of the original components/admin/LiveDesk.jsx and the admin mode of the original
// Teammate desk it embeds: "Order desk" (desk status, available orders with the 5:00 countdown
// and handover links, being played right now, auto-cancelled) above "Online right now" with the
// Waiting / In a game / Idle filters and Set offline. Built on /api/admin/orders,
// /api/admin/presence and /api/admin/priority. Admins never play orders (spec). Auto-cancelled
// orders release the card authorization, so that list says "not charged" instead of the
// original's wallet credit.
const POLL_MS = 5000;
const PRIO_EVERY = 6; // priority badges refresh every 6th poll (30 s)
const WINDOW_MS = 5 * 60 * 1000;
const IDLE_MIN = 15;
const GREEN = C.green;
// idle first (needs attention), then waiting, then in a game
const RANK = { idle: 0, waiting: 1, game: 2 };
const toMs = (v) => (v ? Date.parse(v) : null);

const mmss = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
const since = (ts, now) => {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
};
const units = (n, unit) => n + ' ' + (unit || 'game') + (n === 1 ? '' : 's');
const tag = (bg, color) => ({
  fontSize: '10.5px',
  fontWeight: '800',
  padding: '1px 6px',
  borderRadius: '6px',
  background: bg,
  color,
});
const sub = { fontSize: '13px', color: C.dim };

export default class LiveDesk extends React.Component {
  constructor(props) {
    super(props);
    const now = Date.now();
    this.state = {
      orders: [],
      online: [],
      prio: {},
      loaded: false,
      error: '',
      now,
      watchingSince: now,
      filter: 'All',
      actionBusy: '',
      handovers: {},
      copied: '',
    };
    this._polls = 0;
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
    if (document.hidden && this.state.loaded) return;
    const withPrio = this._polls++ % PRIO_EVERY === 0;
    const [orders, presence, priority] = await Promise.all([
      this.props.api.get('/api/admin/orders'),
      this.props.api.get('/api/admin/presence'),
      withPrio
        ? this.props.api.get('/api/admin/priority')
        : Promise.resolve(null),
    ]);
    if (priority && priority.ok)
      this.setState({
        prio: Object.fromEntries(
          (priority.data.accounts || []).map((a) => [a.id, a]),
        ),
      });
    if (!orders.ok || !presence.ok)
      return this.setState({
        error: orders.ok
          ? presence.error
          : orders.status
            ? orders.error
            : 'Can’t reach Duoly right now. Retrying…',
        loaded: true,
      });
    this.setState({
      orders: (orders.data.orders || []).map(order),
      online: presence.data.online || [],
      error: '',
      loaded: true,
      now: Number(presence.data.now) || Date.now(),
    });
  }
  async setOffline(person, reason) {
    const result = await this.props.api.post('/api/admin/presence', {
      action: 'set-offline',
      userId: person.id,
      reason,
    });
    if (!result.ok) return this.props.toast(result.error, 'warn');
    this.props.toast(
      person.name +
        ' set offline · their dashboard switches off within a few seconds',
    );
    this.props.log();
    this.load();
  }
  async command(o, action, reason = '') {
    this.setState({ actionBusy: action + ':' + o.orderId });
    const res = await this.props.api.post('/api/admin/orders', {
      action,
      orderId: o.orderId,
      ...(reason ? { reason } : {}),
    });
    this.setState({ actionBusy: '' });
    if (!res.ok) return this.props.toast(res.error, 'warn');
    if (action === 'handover') {
      const url = new URL(
        '/claim/' + encodeURIComponent(res.data.token),
        window.location.origin,
      ).toString();
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {}
      this.setState({
        handovers: { ...this.state.handovers, [o.orderId]: url },
        copied: copied ? o.orderId : '',
      });
      return this.props.toast(
        'Handover link for ' + o.id + ' copied. Send it to a teammate.',
      );
    }
    this.props.toast(
      action === 'cancel'
        ? 'Order ' + o.id + ' cancelled. The payment release is processing.'
        : 'Full refund for ' + o.id + ' is processing.',
    );
    await this.load();
  }
  copyOrCreate(o) {
    const url = this.state.handovers[o.orderId];
    if (!url) return this.command(o, 'handover');
    return navigator.clipboard
      .writeText(url)
      .then(() => {
        this.setState({ copied: o.orderId });
        this.props.toast('Handover link copied.');
      })
      .catch(() =>
        this.props.toast('Copy failed. Select the link below.', 'warn'),
      );
  }
  askCancel(o) {
    this.props.ask({
      title: 'Cancel ' + o.id + '?',
      body: 'The order stops and the payment authorization is released. To give it to another teammate instead, send a handover link.',
      confirm: 'Cancel order',
      kind: 'danger',
      field: {
        label: 'Reason (shown in the audit log)',
        placeholder: 'e.g. customer asked to cancel',
        required: true,
      },
      onConfirm: (reason) => this.command(o, 'cancel', reason),
    });
  }
  askRefund(o) {
    this.props.ask({
      title: 'Refund ' + eur(o.amount) + '?',
      body:
        o.customer +
        ' gets the full amount back through Stripe. Refunds are exceptional and audited.',
      confirm: 'Refund ' + eur(o.amount),
      kind: 'danger',
      field: {
        label: 'Reason (shown in the audit log)',
        placeholder: 'e.g. teammate left mid-game',
        required: true,
      },
      onConfirm: (reason) => this.command(o, 'refund', reason),
    });
  }

  // New-order bell and popup (they come from AdminApp, on every admin page): turn on / test.
  renderAlerts() {
    const al = this.props.alerts;
    if (!al) return null;
    const bellIcon = (
      <svg
        aria-hidden="true"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
    );
    return (
      <span
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          marginTop: '10px',
        }}
      >
        {al.notif === 'default' ? (
          <button
            type="button"
            onClick={al.ask}
            style={{ ...btn(), color: '#D6BBFF' }}
          >
            {bellIcon}
            Turn on notifications
          </button>
        ) : null}
        <button type="button" onClick={al.test} style={btn()}>
          Test sound and popup
        </button>
        {al.notif === 'denied' ? (
          <span style={{ fontSize: '12.5px', color: C.dim }}>
            Notifications are blocked for this site: allow them in your
            browser’s site settings. The bell still plays.
          </span>
        ) : al.notif === 'granted' ? (
          <span style={{ fontSize: '12.5px', color: C.dim }}>
            New orders ring a bell and pop up on any admin page.
          </span>
        ) : null}
      </span>
    );
  }
  renderStatus(waiting) {
    const a = this.props.admin || {};
    const s = this.state;
    return (
      <section
        aria-label="Your desk status"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px 16px',
          padding: '16px 18px',
          borderRadius: '20px',
          background:
            'radial-gradient(60% 140% at 0% 50%, rgba(94, 234, 168, .12), transparent 70%), #120B22',
          border: '1px solid rgba(94, 234, 168, .3)',
        }}
      >
        <span
          style={{
            position: 'relative',
            width: '44px',
            height: '44px',
            flex: '0 0 auto',
          }}
        >
          <img
            src={a.image || '/assets/avatars/avatar-1.png'}
            alt=""
            width="44"
            height="44"
            referrerPolicy="no-referrer"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: '-1px',
              bottom: '-1px',
              width: '13px',
              height: '13px',
              borderRadius: '50%',
              background: GREEN,
              animation: 'dlpulse 1.6s ease-in-out infinite',
            }}
          />
        </span>
        <span style={{ flex: '1 1 240px', minWidth: '0', lineHeight: '1.35' }}>
          <span
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '700',
              color: C.white,
            }}
          >
            Watching the queue
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'rgba(94, 234, 168, .12)',
                color: GREEN,
              }}
            >
              <svg
                aria-hidden="true"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="11" width="14" height="10" rx="2.5" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              Admin · always on
            </span>
          </span>
          <span
            style={{ display: 'block', fontSize: '13.5px', color: C.muted }}
          >
            Admins don’t play. Get each order to a teammate with a handover link
            before it hits 5:00 and is cancelled. Watching for{' '}
            {since(s.watchingSince, s.now)}.
          </span>
          {this.renderAlerts()}
        </span>
        <span style={{ display: 'flex', gap: '8px' }}>
          {[
            [waiting, 'waiting', waiting ? C.gold : GREEN],
            [Object.keys(s.handovers).length, 'links sent', C.white],
          ].map(([n, label, color]) => (
            <span
              key={label}
              style={{
                padding: '8px 14px',
                borderRadius: '14px',
                background: C.bg,
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontFamily: DISPLAY,
                  fontSize: '22px',
                  fontWeight: '700',
                  color,
                  lineHeight: '1.1',
                }}
              >
                {n}
              </span>
              <span
                style={{ display: 'block', fontSize: '11.5px', color: C.dim }}
              >
                {label}
              </span>
            </span>
          ))}
        </span>
      </section>
    );
  }

  renderAvailable(queued) {
    const s = this.state;
    const now = s.now;
    const busy = !!s.actionBusy;
    return (
      <section
        aria-labelledby="ld-orders-h"
        style={{ ...card, padding: '24px' }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          <h2 id="ld-orders-h" style={h2}>
            Available orders
          </h2>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: C.muted,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: GREEN,
                animation: 'dlpulse 1.4s ease-in-out infinite',
              }}
            />
            Live · every order, right away
          </span>
        </div>
        {s.error ? (
          <p
            role="status"
            style={{ margin: '0 0 12px', fontSize: '13.5px', color: C.pink }}
          >
            {s.error}
          </p>
        ) : null}
        {!queued.length && s.loaded ? (
          <WaitingForOrders text="Nobody is waiting. New orders appear here the second they’re paid." />
        ) : !queued.length ? (
          <p
            style={{
              margin: '0',
              padding: '18px',
              borderRadius: '16px',
              background: C.bg,
              color: C.dim,
              fontSize: '14px',
              textAlign: 'center',
            }}
          >
            Loading the queue…
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: '0',
              padding: '0',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {queued.map((o) => {
              const g = GAMES[o.game] || { name: o.game, img: '' };
              const waited = now - o.queuedAt;
              const left = WINDOW_MS - waited;
              const pct = Math.min(
                100,
                Math.max(0, (waited / WINDOW_MS) * 100),
              );
              const urgent = left < 60 * 1000;
              const url = s.handovers[o.orderId];
              return (
                <li
                  key={o.id}
                  aria-label={'Order ' + o.id}
                  style={{
                    padding: '16px',
                    borderRadius: '18px',
                    background: C.bg,
                    border: '1px solid rgba(214, 187, 255, .16)',
                  }}
                >
                  <div className="tm-order">
                    <img
                      src={g.img}
                      alt={g.name}
                      width="52"
                      height="52"
                      style={{
                        width: '100%',
                        maxWidth: '52px',
                        height: 'auto',
                        borderRadius: '14px',
                      }}
                    />
                    <div style={{ minWidth: '0' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '6px 8px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: DISPLAY,
                            fontSize: '18px',
                            fontWeight: '700',
                            color: C.white,
                          }}
                        >
                          {o.service}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '7px',
                            background: 'rgba(214, 187, 255, .1)',
                            color: C.accent,
                          }}
                        >
                          {units(o.games, o.unit)}
                        </span>
                        {o.gg ? (
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              padding: '2px 8px',
                              borderRadius: '7px',
                              background: 'rgba(240, 166, 255, .12)',
                              color: C.pink,
                            }}
                          >
                            Gamer Girl
                          </span>
                        ) : null}
                        {o.voice ? (
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              padding: '2px 8px',
                              borderRadius: '7px',
                              background: 'rgba(94, 234, 168, .1)',
                              color: GREEN,
                            }}
                          >
                            Voice
                          </span>
                        ) : null}
                      </div>
                      <div
                        style={{
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13.5px',
                          color: C.muted,
                          minWidth: '0',
                        }}
                      >
                        <img
                          src={o.customerAv}
                          alt=""
                          width="22"
                          height="22"
                          referrerPolicy="no-referrer"
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flex: '0 0 auto',
                          }}
                        />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <b style={{ color: C.text, fontWeight: '600' }}>
                            {o.customer}
                          </b>
                          {' · ' + o.id + ' · ' + o.region}
                          {o.rank ? ' · ' + o.rank : ''}
                        </span>
                      </div>
                    </div>
                    <div
                      className="tm-order-cta"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <div style={{ textAlign: 'right', marginRight: '4px' }}>
                        <div
                          style={{
                            fontFamily: DISPLAY,
                            fontSize: '22px',
                            fontWeight: '700',
                            color: GREEN,
                            lineHeight: '1.1',
                          }}
                        >
                          {usd(o.payoutUsd)}
                        </div>
                        <div style={{ fontSize: '11.5px', color: C.dim }}>
                          teammate rate
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => this.copyOrCreate(o)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          minHeight: '44px',
                          padding: '0 16px',
                          borderRadius: '12px',
                          border: 'none',
                          background: s.copied === o.orderId ? GREEN : C.accent,
                          color: s.copied === o.orderId ? '#062A1B' : C.ink,
                          fontSize: '14px',
                          fontWeight: '700',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                        </svg>
                        {url
                          ? s.copied === o.orderId
                            ? 'Copied'
                            : 'Copy link'
                          : 'Handover link'}
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <div
                      aria-label={'Time left ' + mmss(left)}
                      style={{
                        flex: '1',
                        height: '4px',
                        borderRadius: '999px',
                        background: 'rgba(196, 170, 255, .1)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: pct + '%',
                          height: '100%',
                          borderRadius: '999px',
                          background:
                            pct > 80 ? C.red : pct > 50 ? C.gold : GREEN,
                          transition: 'width 1s linear',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: urgent ? '700' : '400',
                        color: urgent ? C.red : C.dim,
                        minWidth: '64px',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {left > 0 ? mmss(left) + ' left' : 'expiring'}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      style={{
                        ...btn(),
                        minHeight: '32px',
                        fontSize: '12.5px',
                      }}
                      onClick={() => this.askCancel(o)}
                    >
                      Cancel
                    </button>
                  </div>
                  {url ? (
                    <div
                      style={{
                        marginTop: '12px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px',
                        borderRadius: '14px',
                        background: 'rgba(214, 187, 255, .06)',
                        border: '1px dashed rgba(214, 187, 255, .3)',
                      }}
                    >
                      <label
                        style={{
                          position: 'absolute',
                          width: '1px',
                          height: '1px',
                          overflow: 'hidden',
                          clip: 'rect(0 0 0 0)',
                        }}
                        htmlFor={'ho-' + o.orderId}
                      >
                        Handover link for {o.id}
                      </label>
                      <input
                        id={'ho-' + o.orderId}
                        readOnly
                        value={url}
                        onFocus={(e) => e.target.select()}
                        style={{
                          flex: '1 1 220px',
                          minWidth: '0',
                          minHeight: '38px',
                          padding: '0 10px',
                          borderRadius: '10px',
                          background: C.bg,
                          border: '1px solid rgba(196, 170, 255, .16)',
                          color: C.white,
                          fontSize: '13px',
                          fontFamily: 'ui-monospace, Consolas, monospace',
                        }}
                      />
                      <span
                        style={{
                          flexBasis: '100%',
                          fontSize: '12px',
                          color: C.dim,
                        }}
                      >
                        Send it to a teammate. Works until the order is taken or
                        auto-cancels; it stays in the queue meanwhile, so
                        whoever grabs it first gets it.
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  renderPlaying(playing) {
    const s = this.state;
    return (
      <section aria-labelledby="ld-live-h" style={{ ...card, padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          <h2 id="ld-live-h" style={h2}>
            Being played right now
          </h2>
          <span style={sub}>{playing.length} in progress</span>
        </div>
        {playing.length ? (
          <ul
            style={{
              listStyle: 'none',
              margin: '0',
              padding: '0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {playing.map((o) => {
              const g = GAMES[o.game] || { name: o.game, img: '' };
              return (
                <li
                  key={o.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '10px 14px',
                    padding: '12px 14px',
                    borderRadius: '16px',
                    background: C.bg,
                    border: '1px solid rgba(158, 230, 255, .14)',
                  }}
                >
                  <img
                    src={g.img}
                    alt={g.name}
                    width="36"
                    height="36"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                    }}
                  />
                  <span
                    style={{
                      flex: '1 1 200px',
                      minWidth: '0',
                      lineHeight: '1.35',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        fontWeight: '600',
                        color: C.white,
                      }}
                    >
                      {o.id} · {o.service}
                      {o.games > 1 ? ' ×' + o.games : ''} for {o.customer}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '12.5px',
                        color: C.muted,
                      }}
                    >
                      {units(o.games, o.unit)} · started{' '}
                      {since(o.acceptedAt, s.now)} ago
                    </span>
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: 'rgba(158, 230, 255, .1)',
                      color: C.cyan,
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: C.cyan,
                      }}
                    />
                    {o.teammate || 'Teammate'}
                  </span>
                  {/* refunding to the card needs the Orders permission (20261105130000) */}
                  {o.payment &&
                  o.payment.state !== 'refunded' &&
                  (!this.props.can || this.props.can('orders')) ? (
                    <button
                      type="button"
                      disabled={!!s.actionBusy}
                      style={{
                        ...btn('danger'),
                        minHeight: '32px',
                        fontSize: '12.5px',
                      }}
                      onClick={() => this.askRefund(o)}
                    >
                      Refund
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ margin: '0', fontSize: '14px', color: C.dim }}>
            Nobody is playing an order right now.
          </p>
        )}
      </section>
    );
  }

  renderCancelled(cancelled) {
    const s = this.state;
    return (
      <section
        aria-labelledby="ld-cancel-h"
        style={{ ...card, padding: '24px' }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          <h2 id="ld-cancel-h" style={h2}>
            Auto-cancelled
          </h2>
          <span style={sub}>last {cancelled.length}</span>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '13.5px', color: C.dim }}>
          Nobody took these within 5 minutes. The card authorization was
          released, so the customer paid nothing.
        </p>
        {cancelled.length ? (
          <ul
            style={{
              listStyle: 'none',
              margin: '0',
              padding: '0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {cancelled.map((o) => {
              const g = GAMES[o.game] || { name: o.game, img: '' };
              return (
                <li
                  key={o.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '10px 14px',
                    padding: '12px 14px',
                    borderRadius: '16px',
                    background: C.bg,
                    border: '1px solid rgba(255, 138, 155, .18)',
                  }}
                >
                  <img
                    src={g.img}
                    alt={g.name}
                    width="36"
                    height="36"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      filter: 'grayscale(.6)',
                    }}
                  />
                  <span
                    style={{
                      flex: '1 1 200px',
                      minWidth: '0',
                      lineHeight: '1.35',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        fontWeight: '600',
                        color: C.white,
                      }}
                    >
                      {o.id} · {o.service}
                      {o.games > 1 ? ' ×' + o.games : ''} for {o.customer}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '12.5px',
                        color: C.muted,
                      }}
                    >
                      Cancelled {ago(o.cancelledAt, s.now)} · {o.region}
                    </span>
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: 'rgba(94, 234, 168, .1)',
                      color: GREEN,
                    }}
                  >
                    {o.refund
                      ? '+' + eur(o.refund) + ' credited'
                      : 'Not charged'}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ margin: '0', fontSize: '14px', color: C.dim }}>
            None yet. Every order has been taken in time.
          </p>
        )}
      </section>
    );
  }

  renderOnline() {
    const s = this.state;
    const now = s.now;
    const people = s.online
      .map((p) => {
        const lastActive = toMs(p.lastActive) || now;
        const idle =
          !p.admin && !p.playing && now - lastActive > IDLE_MIN * 60000;
        const pr = s.prio[p.id];
        return {
          ...p,
          lastActive,
          since: toMs(p.since),
          state: p.playing ? 'game' : idle ? 'idle' : 'waiting',
          prio: pr ? pr.effective : null,
          basePrio: pr ? pr.prio : null,
          adj: pr ? pr.adj : null,
          penalty: pr ? pr.penalty : 0,
          missed: pr ? pr.missed : 0,
        };
      })
      .sort(
        (a, b) =>
          RANK[a.state] - RANK[b.state] ||
          (a.admin ? 1 : 0) - (b.admin ? 1 : 0) ||
          a.lastActive - b.lastActive,
      );
    const teammates = people.filter((p) => !p.admin);
    const counts = {
      All: people.length,
      Waiting: teammates.filter((p) => p.state === 'waiting').length,
      'In a game': people.filter((p) => p.state === 'game').length,
      Idle: teammates.filter((p) => p.state === 'idle').length,
    };
    const f = s.filter;
    const shown = people.filter(
      (p) =>
        f === 'All' ||
        (f === 'Waiting' && p.state === 'waiting' && !p.admin) ||
        (f === 'In a game' && p.state === 'game') ||
        (f === 'Idle' && p.state === 'idle'),
    );
    const stateLabel = {
      waiting: 'Waiting for orders',
      game: 'In a game',
      idle: 'AFK?',
    };
    const stateColor = { waiting: GREEN, game: C.cyan, idle: C.pink };
    return (
      <section
        aria-labelledby="ld-online-h"
        style={{ ...card, padding: '18px' }}
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
          <div>
            <h2 id="ld-online-h" style={h2}>
              Online right now
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '13.5px', color: C.dim }}>
              Everyone with a teammate dashboard or the admin desk open. Idle =
              waiting with no activity for {IDLE_MIN}+ minutes.
            </p>
          </div>
          <div
            role="group"
            aria-label="Filter"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
          >
            {Object.keys(counts).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={f === k ? 'true' : 'false'}
                onClick={() => this.setState({ filter: k })}
                style={chip(f === k)}
              >
                {k === 'Idle' ? (
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: C.pink,
                    }}
                  />
                ) : null}
                {k}
                <span style={{ opacity: '.65', fontWeight: '500' }}>
                  {counts[k]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <ul
          className="ops-cards"
          style={{
            listStyle: 'none',
            margin: '14px 0 0',
            padding: '0',
            gridTemplateColumns:
              'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
          }}
        >
          {shown.map((p) => (
            <li
              key={p.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '14px',
                borderRadius: '16px',
                background: C.bg,
                border:
                  '1px solid ' +
                  (p.state === 'idle' ? 'rgba(240, 166, 255, .35)' : C.line),
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
                <span
                  style={{
                    position: 'relative',
                    width: '40px',
                    height: '40px',
                    flex: '0 0 auto',
                  }}
                >
                  <img
                    src={p.image || '/assets/avatars/avatar-1.png'}
                    alt=""
                    width="40"
                    height="40"
                    referrerPolicy="no-referrer"
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      opacity: p.state === 'idle' ? '.6' : '1',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '-1px',
                      bottom: '-1px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: stateColor[p.state],
                    }}
                  />
                </span>
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
                    {p.name}
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '3px',
                    }}
                  >
                    {p.admin ? (
                      <span style={tag('rgba(255, 138, 155, .14)', C.red)}>
                        ADMIN
                      </span>
                    ) : null}
                    {!p.admin && p.prio != null ? (
                      <span
                        title={
                          'Priority: seconds before new orders show up for them' +
                          (p.adj || p.penalty
                            ? ' (base ' +
                              p.basePrio +
                              ' s' +
                              (p.adj
                                ? ', ' +
                                  signed(p.adj.points) +
                                  ' ' +
                                  (p.adj.points > 0 ? 'buff' : 'nerf')
                                : '') +
                              (p.penalty
                                ? ', −' + p.penalty + ' missed orders'
                                : '') +
                              ')'
                            : '')
                        }
                        style={tag('rgba(214, 187, 255, .12)', C.accent)}
                      >
                        PRIO {p.prio}
                      </span>
                    ) : null}
                    {p.adj ? (
                      <span
                        title={p.adj.reason || 'Set on the Priority page'}
                        style={tag(
                          p.adj.points > 0
                            ? 'rgba(94, 234, 168, .12)'
                            : 'rgba(240, 166, 255, .14)',
                          p.adj.points > 0 ? GREEN : C.pink,
                        )}
                      >
                        {signed(p.adj.points)}
                      </span>
                    ) : null}
                    {p.missed ? (
                      <span
                        title={
                          'Let ' +
                          p.missed +
                          (p.missed === 1 ? ' order' : ' orders') +
                          ' time out while online in the last 7 days'
                        }
                        style={tag('rgba(255, 138, 155, .14)', C.red)}
                      >
                        {p.missed} MISSED
                      </span>
                    ) : null}
                  </span>
                </span>
                <span
                  style={{
                    flex: '0 0 auto',
                    alignSelf: 'flex-start',
                    whiteSpace: 'nowrap',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    background: stateColor[p.state] + '1f',
                    color: stateColor[p.state],
                  }}
                >
                  {p.admin && p.state !== 'game'
                    ? 'Always on'
                    : stateLabel[p.state]}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {(p.games || []).map((g) =>
                  GAMES[g] ? (
                    <img
                      key={g}
                      src={GAMES[g].img}
                      alt={GAMES[g].name}
                      title={GAMES[g].name}
                      width="22"
                      height="22"
                      style={{
                        width: '22px',
                        height: '22px',
                        flex: '0 0 auto',
                        borderRadius: '6px',
                      }}
                    />
                  ) : null,
                )}
                {!(p.games || []).length ? (
                  <span style={{ fontSize: '12px', color: C.dim }}>
                    {p.admin ? 'All games' : 'No games on'}
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px 12px',
                  fontSize: '12.5px',
                  color: C.muted,
                }}
              >
                <span>
                  {p.since ? 'Online ' + since(p.since, now) : 'Just online'}
                </span>
                <span
                  style={{
                    color: p.state === 'idle' ? C.pink : C.muted,
                    fontWeight: p.state === 'idle' ? '700' : '400',
                  }}
                >
                  {p.state === 'idle'
                    ? 'No activity for ' + since(p.lastActive, now)
                    : 'Active ' + ago(p.lastActive, now)}
                </span>
                {p.order ? (
                  <span style={{ color: C.cyan, fontWeight: '600' }}>
                    {p.order.id} · playing {units(p.order.games, p.order.unit)}
                  </span>
                ) : null}
              </div>
              {p.admin ? (
                <span style={{ fontSize: '12.5px', color: C.faint }}>
                  Admins can’t go offline.
                </span>
              ) : p.playing ? (
                <span style={{ fontSize: '12.5px', color: C.faint }}>
                  Playing an order. It has to be finished before they can go
                  offline.
                </span>
              ) : (
                <button
                  type="button"
                  style={{
                    ...btn(p.state === 'idle' ? 'danger' : undefined),
                    alignSelf: 'flex-start',
                  }}
                  onClick={() =>
                    this.props.ask({
                      title: 'Set ' + p.name + ' offline?',
                      body: 'Their dashboard switches off within a few seconds and shows that an admin set them offline. They can go online again when they’re back.',
                      confirm: 'Set offline',
                      kind: 'danger',
                      field: {
                        label: 'Reason',
                        options: [
                          'AFK / dashboard left open',
                          'Not answering orders',
                          'Asked to be set offline',
                          'Other',
                        ],
                        value:
                          p.state === 'idle'
                            ? 'AFK / dashboard left open'
                            : 'Not answering orders',
                      },
                      onConfirm: (reason) => this.setOffline(p, reason),
                    })
                  }
                >
                  Set offline
                </button>
              )}
            </li>
          ))}
          {s.loaded && !shown.length ? (
            <li style={{ color: C.dim, fontSize: '14px' }}>
              {f === 'Idle'
                ? 'Nobody idle. Everyone online is active.'
                : f === 'All'
                  ? 'Nobody else is online right now. Teammates appear here as soon as they go online on their dashboard.'
                  : 'Nobody here right now.'}
            </li>
          ) : null}
        </ul>
      </section>
    );
  }

  render() {
    const s = this.state;
    const queued = s.orders
      .filter((o) => o.status === 'Queued')
      .sort((a, b) => b.queuedAt - a.queuedAt);
    const playing = s.orders
      .filter((o) => o.status === 'In progress')
      .sort((a, b) => a.acceptedAt - b.acceptedAt);
    const cancelled = s.orders
      .filter(
        (o) => o.status === 'Cancelled' && o.cancelReason === 'queue_expired',
      )
      .sort((a, b) => b.cancelledAt - a.cancelledAt)
      .slice(0, 10);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <section aria-labelledby="ld-desk-h">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            <h2 id="ld-desk-h" style={{ ...h2, fontSize: '22px' }}>
              Order desk
            </h2>
            <span style={sub}>
              Every order as it comes in, newest first. Teammates see each one
              after their priority delay
            </span>
          </div>
          {this.renderStatus(queued.length)}
          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {this.renderAvailable(queued)}
            {this.renderPlaying(playing)}
            {this.renderCancelled(cancelled)}
          </div>
        </section>
        {this.renderOnline()}
      </div>
    );
  }
}
