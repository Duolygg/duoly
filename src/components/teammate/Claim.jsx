'use client';

import React from 'react';
import { GAME as GAMES } from '../../design-reference/lib/games';

const claimOrder = (order) =>
  order
    ? {
        ...order,
        id: order.public_reference,
        games: order.units,
        payout: Number(order.payout_usd_cents || 0) / 100,
        customer: order.customer_name,
        customerImage: order.customer_image,
        // the customer's rank for this order
        from: order.rank || '',
      }
    : null;

const DISPLAY = "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif";
const GREEN = '#5EEAA8';
const money = (n) => '$' + Number(n).toFixed(2);

// The page behind an admin's handover link: shows the order and lets the teammate grab it.
export default class Claim extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      state: 'loading',
      order: null,
      by: '',
      expiresAt: 0,
      error: '',
      busy: false,
      now: 0,
    };
  }
  componentDidMount() {
    this.load();
    this._t = setInterval(() => this.setState({ now: Date.now() }), 1000);
  }
  componentWillUnmount() {
    clearInterval(this._t);
  }
  async load() {
    try {
      const res = await fetch(
        '/api/claim/' + encodeURIComponent(this.props.token),
      );
      const d = await res.json();
      if (!res.ok)
        return this.setState({
          state: 'error',
          error: d.error || 'Something went wrong.',
        });
      this.setState({
        state: d.state,
        order: claimOrder(d.order),
        by: d.by || '',
        // 'teammate': a teammate hands over an order they're playing (20261102150000)
        kind: d.kind || '',
        expiresAt: d.expiresAt ? Date.parse(d.expiresAt) : 0,
        now: Date.now(),
        error: d.reason || '',
      });
    } catch (e) {
      this.setState({
        state: 'error',
        error: 'Can’t reach Duoly right now. Try again.',
      });
    }
  }
  accept = async () => {
    this.setState({ busy: true, error: '' });
    try {
      const res = await fetch(
        '/api/claim/' + encodeURIComponent(this.props.token),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csrf: this.props.csrf }),
        },
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok)
        return this.setState({
          busy: false,
          error: d.error || 'Couldn’t accept this order.',
          state:
            res.status === 409 && /already took/.test(d.error || '')
              ? 'taken'
              : this.state.state,
        });
      this.setState({ state: 'claimed' });
      setTimeout(() => {
        window.location.href = '/teammate';
      }, 1200);
    } catch (e) {
      this.setState({
        busy: false,
        error: 'Can’t reach Duoly right now. Try again.',
      });
    }
  };
  render() {
    const s = this.state;
    const o = s.order;
    const g = o ? GAMES[o.game] || GAMES.lol : null;
    const left =
      s.expiresAt && s.now
        ? Math.max(0, Math.round((s.expiresAt - s.now) / 60000))
        : null;
    const msg = {
      loading: ['Loading the order…', ''],
      claimed: [
        'It’s yours!',
        'Taking you to your dashboard to start the order…',
      ],
      taken: [
        'Someone already took this order',
        'No problem, it’s taken care of. Keep an eye on your dashboard for the next one.',
      ],
      cancelled: [
        'This order was cancelled',
        'The payment authorization was released, or the payment was refunded. Keep an eye on your dashboard for new orders.',
      ],
      expired: [
        'This link has expired',
        'Handover links work until the order auto-cancels. Ask an admin for a new one, or grab orders from your dashboard.',
      ],
      invalid: [
        'This link isn’t valid',
        'Check you copied the whole link, or ask the admin to send it again.',
      ],
      blocked: ['This order isn’t for you', s.error],
      error: ['Something went wrong', s.error],
    }[s.state];
    return (
      <div
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(214, 187, 255, .12), transparent 70%), #090414',
          color: '#F3EEFF',
          fontFamily: 'Geist, system-ui, sans-serif',
          fontSize: '15px',
          lineHeight: '1.5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 16px 60px',
        }}
      >
        <a
          href="/teammate"
          aria-label="Duoly teammate dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            marginBottom: '40px',
          }}
        >
          <img
            src="/assets/brand/logo-wordmark.webp"
            alt="Duoly"
            width="104"
            height="39"
            style={{ width: '104px', height: '39px', display: 'block' }}
          />
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: '700',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              padding: '3px 9px',
              borderRadius: '8px',
              background: 'rgba(214, 187, 255, .12)',
              color: '#D6BBFF',
            }}
          >
            Teammate
          </span>
        </a>
        <main
          style={{
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            borderRadius: '28px',
            background: '#120B22',
            border: '1px solid rgba(214, 187, 255, .16)',
            boxShadow: '0 40px 100px rgba(0, 0, 0, .5)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#D6BBFF',
            }}
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
            </svg>
            Handover{s.by ? ' from ' + s.by : ''}
          </div>
          <h1
            style={{
              margin: '8px 0 0',
              fontFamily: DISPLAY,
              fontWeight: '800',
              fontSize: '32px',
              lineHeight: '1.05',
              letterSpacing: '-.03em',
              color: '#FFFFFF',
            }}
          >
            {s.state === 'open' ? 'An order for you' : msg[0]}
          </h1>
          {s.state === 'open' ? (
            <p style={{ margin: '8px 0 0', color: '#A79DC4' }}>
              {s.kind === 'teammate'
                ? 'Hi ' +
                  this.props.user.name.split(' ')[0] +
                  ', ' +
                  (s.by || 'a teammate') +
                  ' is handing you an order they’re playing. The customer asked for you. Accept it and it’s yours, with the chat.'
                : 'Hi ' +
                  this.props.user.name.split(' ')[0] +
                  ', an admin passed this order to you. Accept it and it’s yours.'}
            </p>
          ) : msg[1] ? (
            <p style={{ margin: '8px 0 0', color: '#A79DC4' }}>{msg[1]}</p>
          ) : null}

          {o ? (
            <div
              style={{
                marginTop: '20px',
                padding: '16px',
                borderRadius: '18px',
                background: '#090414',
                border: '1px solid rgba(214, 187, 255, .14)',
                opacity:
                  s.state === 'open' || s.state === 'claimed' ? '1' : '.55',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <img
                  src={g.img}
                  alt={g.name}
                  width="52"
                  height="52"
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                  }}
                />
                <div style={{ flex: '1', minWidth: '0', lineHeight: '1.3' }}>
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: '19px',
                      fontWeight: '700',
                      color: '#FFFFFF',
                    }}
                  >
                    {o.title}
                    {o.games > 1 ? ' ×' + o.games : ''}
                  </div>
                  <div style={{ fontSize: '13px', color: '#A79DC4' }}>
                    {g.name} · {o.id}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: '22px',
                      fontWeight: '700',
                      color: GREEN,
                    }}
                  >
                    {money(o.payout)}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#8E84AB' }}>
                    before deposit
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13.5px',
                  color: '#A79DC4',
                }}
              >
                <img
                  src={
                    o.customerImage || '/assets/avatars/avatar-' + o.av + '.png'
                  }
                  alt=""
                  width="24"
                  height="24"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
                <span>
                  <b style={{ color: '#F3EEFF', fontWeight: '600' }}>
                    {o.customer}
                  </b>
                  {o.from ? ' · ' + o.from : ''} · {o.region}
                  {o.voice ? ' · Voice' : ' · Text only'}
                </span>
              </div>
              {o.note ? (
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '13px',
                    color: '#8E84AB',
                  }}
                >
                  “{o.note}”
                </div>
              ) : null}
            </div>
          ) : null}

          {s.error && s.state !== 'error' && s.state !== 'blocked' ? (
            <p
              role="alert"
              style={{
                margin: '14px 0 0',
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'rgba(240, 166, 255, .1)',
                border: '1px solid rgba(240, 166, 255, .3)',
                fontSize: '13.5px',
                color: '#F7D6FF',
              }}
            >
              {s.error}
            </p>
          ) : null}

          {s.state === 'open' ? (
            <>
              <button
                type="button"
                onClick={this.accept}
                disabled={s.busy}
                style={{
                  marginTop: '18px',
                  width: '100%',
                  minHeight: '54px',
                  borderRadius: '14px',
                  border: 'none',
                  background: '#D6BBFF',
                  color: '#17092E',
                  fontSize: '16px',
                  fontWeight: '700',
                  opacity: s.busy ? '.7' : '1',
                }}
              >
                {s.busy ? 'Accepting…' : 'Accept order'}
              </button>
              <p
                style={{
                  margin: '10px 0 0',
                  textAlign: 'center',
                  fontSize: '12.5px',
                  color: '#8E84AB',
                }}
              >
                {s.kind === 'teammate'
                  ? (s.by || 'Your teammate') + ' keeps it until you accept.'
                  : 'The order is still in the shared queue, so be quick.'}
              </p>
            </>
          ) : s.state === 'claimed' ? (
            <div
              role="status"
              style={{
                marginTop: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                minHeight: '54px',
                borderRadius: '14px',
                background: 'rgba(94, 234, 168, .12)',
                color: GREEN,
                fontWeight: '700',
              }}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Accepted. Opening your dashboard…
            </div>
          ) : s.state !== 'loading' ? (
            <a
              href="/teammate"
              style={{
                marginTop: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '50px',
                borderRadius: '14px',
                border: '1px solid rgba(214, 187, 255, .25)',
                color: '#F3EEFF',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              Go to my dashboard
            </a>
          ) : null}
        </main>
      </div>
    );
  }
}
