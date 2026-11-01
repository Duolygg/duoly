// Payment methods strip on the homepage (under "three taps"): two rows of official brand badges
// drifting in opposite directions, cards and wallets on top, local methods below. Every method here
// is switched on in Stripe and known to the webhook (server/payments/webhook.ts METHOD_LABELS).
// Badges: public/assets/payments/badges (sources and licences in CREDITS.md there).
// Styles: globals.css (pm-*).
import React from 'react';

const BADGES = '/assets/payments/badges/';

// [name, badge file]
const MAIN = [
  ['Visa', 'visa.svg'],
  ['Mastercard', 'mastercard.svg'],
  ['American Express', 'amex.svg'],
  ['Apple Pay', 'apple-pay.svg'],
  ['Google Pay', 'google-pay.svg'],
  ['PayPal', 'paypal.svg'],
  ['Klarna', 'klarna.svg'],
  ['Revolut Pay', 'revolut-pay.svg'],
  ['Amazon Pay', 'amazon-pay.svg'],
];
const LOCAL = [
  ['iDEAL', 'ideal.svg'],
  ['Bancontact', 'bancontact.svg'],
  ['Alipay', 'alipay.svg'],
  ['EPS', 'eps.svg'],
  ['Przelewy24', 'przelewy24.svg'],
  ['BLIK', 'blik.svg'],
  ['TWINT', 'twint.svg'],
  ['MB WAY', 'mb-way.svg'],
  ['MobilePay', 'mobilepay.svg'],
  ['WeChat Pay', 'wechat-pay.svg'],
  ['Bizum', 'bizum.svg'],
  ['Satispay', 'satispay.svg'],
  ['Wero', 'wero.svg'],
  ['SEPA Direct Debit', 'sepa.svg'],
];

function Tile({ method }) {
  const [name, file] = method;
  return (
    <span className="pm-tile" title={name}>
      <img
        src={BADGES + file}
        alt={name}
        width="120"
        height="80"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

// One loop of a row is at least this many tiles (12 × 108px ≈ the 1240px page width), so a short
// row never shows a gap; the track holds two loops and slides by one.
const LOOP_TILES = 12;

function Row({ methods, label, reverse }) {
  const perLoop = Math.max(1, Math.ceil(LOOP_TILES / methods.length));
  return (
    <div className="pm-row">
      <div className={'pm-track' + (reverse ? ' pm-rev' : '')}>
        <ul className="pm-set" aria-label={label}>
          {methods.map((m) => (
            <li key={m[0]}>
              <Tile method={m} />
            </li>
          ))}
        </ul>
        {/* the copies that fill the loop; screen readers skip them */}
        {Array.from({ length: perLoop * 2 - 1 }, (_, i) => (
          <ul key={i} className="pm-set" aria-hidden="true">
            {methods.map((m) => (
              <li key={m[0]}>
                <Tile method={m} />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export default function PaymentMethods() {
  return (
    <div className="pm" role="region" aria-labelledby="pm-h">
      <div className="pm-head">
        <div id="pm-h" className="pm-title">
          Pay your way
        </div>
        <p className="pm-sub">
          Cards, wallets and local favourites from around the world. You pick on
          the checkout page.
        </p>
      </div>
      <Row methods={MAIN} label="Cards and wallets" />
      <Row methods={LOCAL} label="Local payment methods" reverse />
    </div>
  );
}
