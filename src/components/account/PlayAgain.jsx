import React from 'react';
import { track } from '../../client/analytics/track';

// Play again in the order room (docs/product/play-again.md): once the teammate finished the order,
// book the same session again with one tap. The server prices it and pays from the balance first,
// then the card the customer saved at checkout; 3D Secure, if the bank asks, opens right here. No
// saved card, or a declined one: the server answers with the normal payment page instead.
// The same teammate gets the new order alone for a minute, then everyone can take it.

const PINK = '#F0A6FF',
  MUTED = '#A79DC4',
  ACCENT = '#D6BBFF';

const euro = (cents) => '€' + (cents / 100).toFixed(2).replace(/\.00$/, '');
const BRANDS = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  discover: 'Discover',
  jcb: 'JCB',
  diners: 'Diners',
  unionpay: 'UnionPay',
  cartes_bancaires: 'Cartes Bancaires',
};
const brandName = (brand) => BRANDS[brand] || 'Card';

/** Pure: why the button is off, in the customer's words (null = say nothing). */
export function playAgainNote(reason, name) {
  if (reason === 'teammate_busy')
    return (
      name +
      ' is playing another order right now. Play again comes back when they’re free.'
    );
  if (reason === 'teammate_away')
    return (
      name + ' is offline right now. Play again comes back when they’re online.'
    );
  if (reason === 'teammate_unavailable')
    return name + ' can’t take this session right now.';
  if (reason === 'open_order') return 'You already have an open order.';
  return null;
}

/** Pure: what the confirm sheet says the money comes from. */
export function paymentLines(offer) {
  const lines = [];
  if (offer.walletEurCents > 0)
    lines.push(['From your Duoly balance', euro(offer.walletEurCents)]);
  if (offer.cardEurCents > 0)
    lines.push(
      offer.card
        ? [
            brandName(offer.card.brand) + ' •••• ' + offer.card.last4,
            euro(offer.cardEurCents),
          ]
        : ['On the payment page', euro(offer.cardEurCents)],
    );
  return lines;
}

let stripePromise = null;
const loadStripeJs = async (key) => {
  if (!stripePromise)
    stripePromise = import('@stripe/stripe-js').then((m) => m.loadStripe(key));
  return stripePromise;
};

export default class PlayAgain extends React.Component {
  constructor(props) {
    super(props);
    this.state = { offer: null, open: false, busy: false, err: '' };
  }
  componentDidMount() {
    this.load(true);
    // a teammate who was offline or busy may be free again
    this._poll = setInterval(() => {
      if (!this.state.open && !this.state.busy) this.load(false);
    }, 20000);
  }
  componentWillUnmount() {
    clearInterval(this._poll);
  }
  base() {
    return (
      '/api/orders/' + encodeURIComponent(this.props.orderId) + '/play-again'
    );
  }
  async load(first) {
    try {
      const res = await fetch(this.base(), {
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      });
      if (!res.ok) return;
      const offer = await res.json();
      if (typeof offer.available !== 'boolean') return;
      if (first && offer.available)
        track('play_again_viewed', { game: this.props.game || 'unknown' });
      this.setState({ offer });
    } catch (e) {}
  }
  post = async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf: this.props.csrf, ...body }),
    });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, d };
  };
  go(url, path) {
    track('play_again_started', { path });
    window.location.href = url;
  }
  confirm = async () => {
    const offer = this.state.offer;
    if (!offer || this.state.busy) return;
    this.setState({ busy: true, err: '' });
    try {
      const { ok, status, d } = await this.post(this.base(), {
        amountEurCents: offer.amountEurCents,
      });
      if (ok && d.url)
        return this.go(
          d.url,
          d.url.startsWith('/checkout/')
            ? 'checkout'
            : offer.cardEurCents > 0
              ? 'card'
              : 'wallet',
        );
      if (ok && d.clientSecret && d.intentId) return this.secure(d);
      if (status === 409 && Number.isInteger(d.amountEurCents))
        // the price changed: show the new one before charging anything
        await this.load(false);
      this.setState({
        busy: false,
        err: d.error || 'Couldn’t start Play again. Try again.',
      });
    } catch (e) {
      this.setState({
        busy: false,
        err: 'Can’t reach Duoly right now. Try again.',
      });
    }
  };
  // The bank wants 3D Secure: Stripe shows it here, then the server makes the order.
  async secure({ clientSecret, intentId }) {
    try {
      const stripe = this.props.stripeKey
        ? await loadStripeJs(this.props.stripeKey)
        : null;
      if (!stripe) throw new Error('no stripe');
      const result = await stripe.handleNextAction({ clientSecret });
      if (result.error)
        return this.setState({
          busy: false,
          err:
            result.error.message ||
            'Your bank didn’t confirm the payment. Nothing was charged.',
        });
      const { ok, d } = await this.post(this.base() + '/confirm', {
        intentId,
      });
      if (ok && d.url) return this.go(d.url, '3ds');
      this.setState({
        busy: false,
        err: d.error || 'Couldn’t finish Play again. Try again.',
      });
    } catch (e) {
      this.setState({
        busy: false,
        err: 'Couldn’t open your bank’s check. Try again.',
      });
    }
  }
  render() {
    const { offer, open, busy, err } = this.state;
    const name = this.props.name || 'your teammate';
    if (!offer) return null;
    if (!offer.available) {
      const note = playAgainNote(offer.reason, name);
      return note ? (
        <p
          data-play-again-note
          style={{
            margin: '18px auto 0',
            maxWidth: '420px',
            fontSize: '13.5px',
            color: MUTED,
            textAlign: 'center',
          }}
        >
          {note}
        </p>
      ) : null;
    }
    const btn = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      minHeight: '48px',
      padding: '0 20px',
      borderRadius: '14px',
      border: 'none',
      background: ACCENT,
      color: '#17092E',
      fontSize: '15px',
      fontWeight: '700',
      cursor: busy ? 'progress' : 'pointer',
    };
    const lines = paymentLines(offer);
    const pay =
      offer.cardEurCents > 0 && !offer.card
        ? 'Continue to payment'
        : 'Pay ' + euro(offer.amountEurCents) + ' and play again';
    return (
      <div
        data-play-again
        style={{
          marginTop: '22px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {!open ? (
          <button
            type="button"
            style={btn}
            onClick={() => this.setState({ open: true, err: '' })}
          >
            Play again with {name} · {euro(offer.amountEurCents)}
          </button>
        ) : (
          <div
            role="group"
            aria-label={'Play again with ' + name}
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '16px',
              borderRadius: '18px',
              background: '#120B22',
              border: '1px solid rgba(214, 187, 255, .22)',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: '700', color: '#FFFFFF' }}>
              Same session again with {name}
            </div>
            <p style={{ margin: '4px 0 12px', fontSize: '13px', color: MUTED }}>
              {this.props.summary ? this.props.summary + ' · ' : ''}
              {name} gets it first for a minute, then any teammate can take it.
            </p>
            <dl
              style={{
                margin: '0',
                display: 'grid',
                gap: '6px',
                fontSize: '14px',
              }}
            >
              {lines.map(([label, amount]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <dt style={{ color: '#CFC4EA' }}>{label}</dt>
                  <dd
                    style={{ margin: '0', color: '#FFFFFF', fontWeight: '600' }}
                  >
                    {amount}
                  </dd>
                </div>
              ))}
            </dl>
            {this.props.usd ? (
              <p
                style={{ margin: '8px 0 0', fontSize: '12.5px', color: MUTED }}
              >
                Charged in euros, like your tips.
              </p>
            ) : null}
            {err ? (
              <p
                role="alert"
                style={{ margin: '10px 0 0', fontSize: '13.5px', color: PINK }}
              >
                {err}
              </p>
            ) : null}
            <div
              style={{
                marginTop: '14px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <button
                type="button"
                style={btn}
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={this.confirm}
              >
                {busy ? 'Starting…' : pay}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => this.setState({ open: false, err: '' })}
                style={{
                  ...btn,
                  background: 'transparent',
                  color: '#F3EEFF',
                  border: '1px solid rgba(196, 170, 255, .2)',
                }}
              >
                Not now
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}
