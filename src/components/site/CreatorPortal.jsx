import React from 'react';
import './creator-portal.css';
import { Icon } from './LegalPage.jsx';
import { GAME } from '../../design-reference/lib/games';
import {
  CREATOR_PAYOUT_METHODS,
  CREATOR_RANGES,
  creatorPayoutProgress,
  creatorRefLink,
  creatorShortLink,
  nextCreatorPayoutDate,
  nextCreatorTier,
} from '../../contracts/creator-portal';
import { CREATOR_RULE_LINES } from '../../content/creator-terms';
import { streamKit } from '../../content/creator-kit';

/**
 * /creators/dashboard: what a creator sees about themselves. Everything comes from one read,
 * `GET /api/creators/portal`, which the page already made on the server, so the first paint has
 * the real numbers. No customer ever appears in it: the order rows carry a date, a game, a title
 * and money, and nothing else.
 */

export const eur = (cents) =>
  '€' +
  ((Number(cents) || 0) / 100).toLocaleString('en-IE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const ORDER_STATES = {
  available: 'Available',
  pending: 'Pending',
  paid: 'Paid',
  reversed: 'Reversed',
  open: 'Not finished yet',
  cancelled: 'Cancelled',
};
export const RANGE_LABELS = {
  '7d': '7 days',
  '30d': '30 days',
  all: 'All time',
};

export const dayLabel = (ms) =>
  ms
    ? new Date(Number(ms)).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';
export const monthLabel = (month) => {
  const [year, index] = String(month || '')
    .split('-')
    .map(Number);
  if (!year || !index) return String(month || '');
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};
const gameName = (id) => (GAME[id] || {}).name || id;

function Copy({ value, label }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      className={'cp-copy' + (done ? ' done' : '')}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? 'Copied' : label || 'Copy'}
    </button>
  );
}

function Stat({ label, value, caption, tone }) {
  return (
    <div className={'cp-stat' + (tone ? ' ' + tone : '')}>
      <span>{label}</span>
      <strong>{value}</strong>
      {caption ? <span>{caption}</span> : null}
    </div>
  );
}

function Bar({ percent }) {
  return (
    <div
      className="cp-bar"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i style={{ width: Math.max(2, Math.min(100, percent)) + '%' }} />
    </div>
  );
}

export default function CreatorPortal({ initial, csrf, origin }) {
  const [data, setData] = React.useState(initial || null);
  const [error, setError] = React.useState('');
  const [range, setRange] = React.useState('30d');
  const site = origin || 'https://duoly.gg';

  const load = React.useCallback(async () => {
    try {
      const response = await fetch('/api/creators/portal', {
        credentials: 'same-origin',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        return setError(body.error || 'Could not load your creator dashboard.');
      setData(body);
      setError('');
    } catch {
      setError('Could not reach Duoly. Check your connection and try again.');
    }
  }, []);
  React.useEffect(() => {
    if (!initial) load();
  }, [initial, load]);

  if (error && !data)
    return (
      <section className="cp-sec">
        <div className="cp-card" role="alert">
          <h2>Dashboard unavailable</h2>
          <p className="cp-note">{error}</p>
        </div>
      </section>
    );
  if (!data)
    return (
      <section className="cp-sec">
        <div className="cp-card">
          <p className="cp-note">Loading your creator dashboard…</p>
        </div>
      </section>
    );

  if (data.status !== 'creator') return <Application data={data} />;

  const money = data.money || {};
  const stats = (data.stats || {})[range] || {};
  const month = data.month || {};
  const tier = month.tier || {};
  const next = nextCreatorTier(month.orders || 0);
  const threshold = creatorPayoutProgress(money.availableCents || 0);
  const kit = streamKit(data.creator.code, site);

  return (
    <div className="cp-page">
      <Hero creator={data.creator} site={site} />

      <section className="cp-sec" aria-labelledby="cp-stats-h">
        <div className="cp-card">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2 id="cp-stats-h">Your numbers</h2>
            <div className="cp-ranges" role="group" aria-label="Date range">
              {CREATOR_RANGES.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={'ct-topic' + (range === key ? ' on' : '')}
                  aria-pressed={range === key ? 'true' : 'false'}
                  onClick={() => setRange(key)}
                >
                  {RANGE_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
          <div className="cp-stats" style={{ marginTop: '14px' }}>
            <Stat label="Link clicks" value={stats.clicks ?? 0} />
            <Stat label="Viewers who ordered" value={stats.customers ?? 0} />
            <Stat label="Orders" value={stats.orders ?? 0} />
            <Stat label="Order value" value={eur(stats.revenueCents)} />
            <Stat
              label="Your commission"
              value={eur(stats.commissionCents)}
              tone="good"
            />
          </div>
          <p className="cp-note">
            Clicks, viewers and orders count when they happen. Order value and
            commission count when an order is completed, so a finished month
            never changes again.
          </p>
        </div>
      </section>

      <section className="cp-sec" aria-labelledby="cp-month-h">
        <div className="cp-grid two">
          <div className="cp-card">
            <h2 id="cp-month-h">This month</h2>
            <p className="cp-note">
              {monthLabel(month.month)}, by completion date.
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '14px',
              }}
            >
              <strong
                style={{
                  fontSize: '34px',
                  fontFamily:
                    "'Bricolage Grotesque','Bricolage Fallback',sans-serif",
                  color: '#fff',
                }}
              >
                {month.orders ?? 0}
              </strong>
              <span className={'cr-tier-pill ' + (tier.id || 'rising')}>
                {tier.name} · {tier.commission}%
              </span>
            </div>
            {next ? (
              <>
                <Bar percent={next.percent} />
                <p className="cp-note">
                  {next.remaining} more completed orders this month for{' '}
                  {next.name} at{' '}
                  {(data.rules.tiers.find((t) => t.name === next.name) || {})
                    .commission ?? ''}
                  %.
                </p>
              </>
            ) : (
              <p className="cp-note">
                You are at the top tier this month. Nice work.
              </p>
            )}
          </div>

          <div className="cp-card">
            <h2>Money</h2>
            <p className="cp-note">
              Commission becomes available 30 days after an order is completed.
            </p>
            <div className="cp-stats four" style={{ marginTop: '14px' }}>
              <Stat
                label="Pending"
                value={eur(money.pendingCents)}
                caption={
                  money.openCents
                    ? eur(money.heldCents) +
                      ' in the hold, ' +
                      eur(money.openCents) +
                      ' still being played'
                    : 'in the 30 day hold'
                }
                tone="wait"
              />
              <Stat
                label="Available"
                value={eur(money.availableCents)}
                caption="ready to pay"
                tone="good"
              />
              <Stat
                label="Paid"
                value={eur(money.paidCents)}
                caption="so far"
              />
              <Stat
                label="Reversed"
                value={eur(money.reversedCents)}
                caption="refunded orders"
                tone="off"
              />
            </div>
            {money.openCents ? (
              <p className="cp-note">
                {money.openOrders ?? 0} orders from your code are still being
                played. The {eur(money.openCents)} in them is an estimate at
                this month’s tier: it is earned once those orders are completed,
                and it cannot be paid out before that.
              </p>
            ) : null}
            <Bar percent={threshold.percent} />
            <p className="cp-note">
              {threshold.reached
                ? 'You are over the €50 payout threshold.'
                : `${eur(threshold.remainingCents)} to go to the €50 payout threshold.`}{' '}
              Payouts go out in the first week of each month. Next:{' '}
              {dayLabel(Date.parse(nextCreatorPayoutDate(data.now)))}.
            </p>
          </div>
        </div>
      </section>

      <Orders orders={data.orders || []} />
      <Payouts payouts={data.payouts || []} />
      <PayoutDetails details={data.details} csrf={csrf} onSaved={load} />
      <StreamKit kit={kit} />
      <Rules />
    </div>
  );
}

function Hero({ creator, site }) {
  const short = creatorShortLink(creator.code, site);
  const query = creatorRefLink(creator.code, site);
  return (
    <section className="cp-sec" aria-labelledby="cp-hero-h">
      <div className="cp-card">
        <span className="cr-eyebrow">Creator dashboard</span>
        <h2 id="cp-hero-h" style={{ marginTop: '8px' }}>
          Your code and links
        </h2>
        <div className="cp-code" style={{ marginTop: '12px' }}>
          <b>{creator.code}</b>
          <Copy value={creator.code} label="Copy code" />
          {creator.active ? null : (
            <span className="cp-state cancelled">Paused</span>
          )}
        </div>
        <div className="cp-link">
          <code>{short}</code>
          <Copy value={short} label="Copy link" />
        </div>
        <div className="cp-link">
          <code>{query}</code>
          <Copy value={query} label="Copy link" />
        </div>
        <p className="cp-note">
          Both links do the same thing. The short one is easier to say out loud,
          the other one works where a path is rewritten.
        </p>
        <a
          className="lg-btn ghost"
          style={{ marginTop: '12px' }}
          href="/api/creators/qr.png"
          download={`duoly-${creator.code.toLowerCase()}-qr.png`}
        >
          Download QR code <Icon name="arrow" size={16} stroke={2.4} />
        </a>
      </div>
    </section>
  );
}

function Orders({ orders }) {
  return (
    <section className="cp-sec" aria-labelledby="cp-orders-h">
      <div className="cp-card">
        <h2 id="cp-orders-h">Orders from your code</h2>
        <p className="cp-note">
          The latest 200. We never show you who ordered, only what it means for
          you. Commission here is rounded per order; your monthly total is what
          we pay. An order that is still being played shows an estimate at this
          month’s tier.
        </p>
        {orders.length ? (
          <div className="cp-table-wrap">
            <table className="lg-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Game</th>
                  <th>Service</th>
                  <th style={{ textAlign: 'right' }}>Order</th>
                  <th style={{ textAlign: 'right' }}>Commission</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr key={index}>
                    <td>{dayLabel(order.at)}</td>
                    <td>{gameName(order.game)}</td>
                    <td>{order.title}</td>
                    <td style={{ textAlign: 'right' }}>
                      {eur(order.amountCents)}
                      {order.refundedCents ? (
                        <span
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            color: '#ff9d9d',
                          }}
                        >
                          {eur(order.refundedCents)} refunded
                        </span>
                      ) : null}
                    </td>
                    <td style={{ textAlign: 'right', color: '#fff' }}>
                      {order.state === 'open' && order.estimatedCents
                        ? eur(order.estimatedCents)
                        : eur(order.commissionCents)}
                      {order.state === 'open' && order.estimatedCents ? (
                        <span
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: '#8e84ab',
                          }}
                        >
                          estimate
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={'cp-state ' + order.state}>
                        {ORDER_STATES[order.state] || order.state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="cp-empty">
            No orders from your code yet. Share your link and they show up here.
          </p>
        )}
      </div>
    </section>
  );
}

function Payouts({ payouts }) {
  return (
    <section className="cp-sec" aria-labelledby="cp-payouts-h">
      <div className="cp-card">
        <h2 id="cp-payouts-h">Payout history</h2>
        {payouts.length ? (
          <div className="cp-table-wrap">
            <table className="lg-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.month}>
                    <td>{monthLabel(payout.month)}</td>
                    <td style={{ textAlign: 'right', color: '#fff' }}>
                      {eur(payout.amountCents)}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {payout.method}
                    </td>
                    <td>{payout.reference}</td>
                    <td>{dayLabel(payout.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="cp-empty">
            No payout yet. The first one goes out in the month after your
            available commission reaches €50.
          </p>
        )}
      </div>
    </section>
  );
}

const EMPTY_DETAILS = {
  legalName: '',
  address: '',
  country: '',
  method: 'bank',
  account: '',
  business: false,
  vatId: '',
};

function PayoutDetails({ details, csrf, onSaved }) {
  const [form, setForm] = React.useState({
    ...EMPTY_DETAILS,
    ...(details || {}),
  });
  const [selfBilling, setSelfBilling] = React.useState(
    Boolean(details && details.selfBilling),
  );
  const [state, setState] = React.useState({
    saving: false,
    error: '',
    ok: '',
  });
  const set = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });

  const save = async (event) => {
    event.preventDefault();
    if (state.saving) return;
    setState({ saving: true, error: '', ok: '' });
    try {
      const response = await fetch('/api/creators/payout-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf,
          legalName: form.legalName,
          address: form.address,
          country: form.country,
          method: form.method,
          account: form.account,
          business: Boolean(form.business),
          vatId: form.vatId || '',
          selfBilling: true,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        return setState({
          saving: false,
          error: body.error || 'Could not save that. Please try again.',
          ok: '',
        });
      setState({ saving: false, error: '', ok: 'Saved.' });
      if (onSaved) onSaved();
    } catch {
      setState({
        saving: false,
        error: 'Could not reach Duoly. Try again in a moment.',
        ok: '',
      });
    }
  };

  return (
    <section className="cp-sec" aria-labelledby="cp-details-h">
      <div className="cp-card">
        <h2 id="cp-details-h">Payout details</h2>
        <p className="cp-note">
          We need these before your first payout. Only you and the Duoly team
          can see them.
        </p>
        <form onSubmit={save} noValidate>
          <div className="ct-grid">
            <label className="ct-field">
              <span>Legal name</span>
              <input
                value={form.legalName}
                onChange={set('legalName')}
                maxLength={120}
                autoComplete="name"
                placeholder="Alex Rivera"
              />
            </label>
            <label className="ct-field">
              <span>Country</span>
              <input
                value={form.country}
                onChange={set('country')}
                maxLength={56}
                autoComplete="country-name"
                placeholder="Austria"
              />
            </label>
            <label className="ct-field wide">
              <span>Address</span>
              <input
                value={form.address}
                onChange={set('address')}
                maxLength={300}
                autoComplete="street-address"
                placeholder="Hauptstrasse 1, 1010 Vienna"
              />
            </label>
          </div>
          <fieldset className="ct-topics" style={{ marginTop: '18px' }}>
            <legend>How should we pay you?</legend>
            <div>
              {CREATOR_PAYOUT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  className={'ct-topic' + (form.method === method ? ' on' : '')}
                  aria-pressed={form.method === method ? 'true' : 'false'}
                  onClick={() => setForm({ ...form, method })}
                  style={{ textTransform: 'capitalize' }}
                >
                  {method}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="ct-grid">
            <label className="ct-field wide">
              <span>Account to pay</span>
              <input
                value={form.account}
                onChange={set('account')}
                maxLength={200}
                placeholder="IBAN, Wise, PayPal or Payoneer address"
              />
            </label>
            <label className="ct-field">
              <span>
                VAT ID <em>· optional</em>
              </span>
              <input
                value={form.vatId}
                onChange={set('vatId')}
                maxLength={20}
                placeholder="ATU12345678"
              />
            </label>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginTop: '16px',
            }}
          >
            <label className="cp-check">
              <input
                type="checkbox"
                checked={Boolean(form.business)}
                onChange={(event) =>
                  setForm({ ...form, business: event.target.checked })
                }
              />
              <span>
                I act as a business. Without this we treat you as a private
                person.
              </span>
            </label>
            <label className="cp-check">
              <input
                type="checkbox"
                checked={selfBilling}
                onChange={(event) => setSelfBilling(event.target.checked)}
              />
              <span>
                I agree that Duoly writes the monthly self billing document
                (Gutschrift) for my commission. You can send your own invoice
                instead; tell us in the chat.
              </span>
            </label>
          </div>
          {state.error ? (
            <p className="cp-bad" role="alert" style={{ marginTop: '12px' }}>
              {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p className="cp-ok" role="status" style={{ marginTop: '12px' }}>
              {state.ok}
            </p>
          ) : null}
          <button
            type="submit"
            className="lg-btn"
            style={{ marginTop: '14px' }}
            disabled={state.saving || !selfBilling}
          >
            {state.saving ? 'Saving…' : 'Save payout details'}
          </button>
          {selfBilling ? null : (
            <p className="cp-note">
              Agree to the self billing document to save your details.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

function StreamKit({ kit }) {
  return (
    <section className="cp-sec" aria-labelledby="cp-kit-h">
      <div className="cp-card">
        <h2 id="cp-kit-h">Stream kit</h2>
        <p className="cp-note">
          Copy these into your chat bot, your panels and your description.
        </p>
        <div className="cp-kit">
          <h3>Nightbot command</h3>
          <pre>{kit.nightbot}</pre>
          <Copy value={kit.nightbot} label="Copy command" />
          <h3>StreamElements chat bot command</h3>
          <pre>{kit.streamElements}</pre>
          <Copy value={kit.streamElements} label="Copy command" />
          <h3>Panel text</h3>
          <pre>{kit.panel}</pre>
          <Copy value={kit.panel} label="Copy panel text" />
          <h3>Link in bio</h3>
          <pre>{kit.linkInBio}</pre>
          <Copy value={kit.linkInBio} label="Copy line" />
          <h3>Say that it is advertising</h3>
          {kit.disclosures.map((entry) => (
            <div key={entry.language}>
              <p className="cp-note">{entry.language}</p>
              <pre>{entry.text}</pre>
              <Copy value={entry.text} label="Copy disclosure" />
            </div>
          ))}
          <h3>Brand files</h3>
          <div className="cp-assets">
            {kit.assets.map((asset) => (
              <a
                key={asset.href}
                className="cp-asset"
                href={asset.href}
                download
              >
                <img src={asset.href} alt="" />
                <span>
                  {asset.label}
                  <br />
                  <em style={{ fontStyle: 'normal', color: '#8e84ab' }}>
                    {asset.note}
                  </em>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Rules() {
  return (
    <section className="cp-sec" aria-labelledby="cp-rules-h">
      <div className="cp-card">
        <h2 id="cp-rules-h">The rules, in short</h2>
        <ul className="cp-rules">
          {CREATOR_RULE_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="cp-note">
          The full creator terms are on <a href="/creators#terms">/creators</a>.
          Questions? Use the chat bubble, we answer there.
        </p>
      </div>
    </section>
  );
}

/** Before approval: what the applicant sent, where it stands and what happens next. */
function Application({ data }) {
  const application = data.application;
  const rejected = data.status === 'rejected';
  return (
    <div className="cp-page">
      <section className="cp-sec">
        <div className="cp-card">
          <span className="cr-eyebrow">Creator program</span>
          {!application ? (
            <>
              <h2 style={{ marginTop: '8px' }}>You have not applied yet</h2>
              <p className="cp-note">
                Tell us about your channel and pick the code your viewers will
                use. We reply within a few days.
              </p>
              <a
                className="lg-btn"
                style={{ marginTop: '14px' }}
                href="/creators#apply"
              >
                Apply now <Icon name="arrow" size={16} stroke={2.4} />
              </a>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: '8px' }}>
                {rejected
                  ? 'We could not approve this one'
                  : 'Application received'}
              </h2>
              <p className="cp-note">
                {rejected
                  ? application.reason
                  : 'We reply within a few days, usually faster. You get an email either way.'}
              </p>
              {rejected && data.canReapplyAt ? (
                <p className="cp-note">
                  You can apply again from {dayLabel(data.canReapplyAt)}.
                </p>
              ) : null}
              {rejected && data.canApply ? (
                <a
                  className="lg-btn"
                  style={{ marginTop: '14px' }}
                  href="/creators#apply"
                >
                  Apply again <Icon name="arrow" size={16} stroke={2.4} />
                </a>
              ) : null}
              <div className="cp-table-wrap">
                <table className="lg-table">
                  <tbody>
                    <tr>
                      <th>Sent</th>
                      <td>{dayLabel(application.createdAt)}</td>
                    </tr>
                    <tr>
                      <th>Code you asked for</th>
                      <td>{application.code}</td>
                    </tr>
                    <tr>
                      <th>Channel</th>
                      <td>{application.channel}</td>
                    </tr>
                    <tr>
                      <th>Platform</th>
                      <td>{application.platform}</td>
                    </tr>
                    <tr>
                      <th>Audience</th>
                      <td>{application.audience}</td>
                    </tr>
                    <tr>
                      <th>Main game</th>
                      <td>{gameName(application.game)}</td>
                    </tr>
                    <tr>
                      <th>Country</th>
                      <td>{application.country}</td>
                    </tr>
                    <tr>
                      <th>Email</th>
                      <td>{application.email}</td>
                    </tr>
                    {application.message ? (
                      <tr>
                        <th>Your message</th>
                        <td>{application.message}</td>
                      </tr>
                    ) : null}
                    <tr>
                      <th>Terms accepted</th>
                      <td>
                        Version {application.termsVersion} on{' '}
                        {dayLabel(application.termsAcceptedAt)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
      <Rules />
    </div>
  );
}
