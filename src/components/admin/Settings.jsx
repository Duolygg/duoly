import React from 'react';
import {
  C,
  DISPLAY,
  card,
  h2,
  th,
  td,
} from '../../design-reference/components/admin/ui';
import { TIERS, RELEASE_DAYS } from '../../design-reference/lib/trust';
import { LEVELS } from '../../design-reference/lib/rewards';
import { CREATOR_RULES } from '../../contracts/creators';

// Port of the original components/admin/Settings.jsx: the rules the platform runs on, read-only.
// Values that changed on the new stack say so instead of quoting the original's files:
// owners come from the server configuration plus the database owner flag (no .env.local),
// payouts and rewards are not live yet, and the referral program shows its live state.
const PLATFORM_FEE = 0.4; // src/server/pricing: teammate gets 60% of the EUR amount at the mid rate

const where = (file) => (
  <code
    style={{
      fontFamily: 'ui-monospace, Consolas, monospace',
      fontSize: '12.5px',
      padding: '2px 6px',
      borderRadius: '6px',
      background: C.bg,
      color: C.accent,
    }}
  >
    {file}
  </code>
);
const note = { margin: '4px 0 10px', fontSize: '13px', color: C.dim };

export default class Settings extends React.Component {
  constructor(props) {
    super(props);
    this.state = { info: null, error: '' };
  }
  async componentDidMount() {
    const r = await this.props.api.get('/api/admin/settings');
    if (r.ok) this.setState({ info: r.data });
    else this.setState({ error: r.error || 'Couldn’t load the live values.' });
  }
  render() {
    const info = this.state.info;
    const fx = info && info.fx;
    const basics = [
      [
        'Platform fee',
        Math.round(PLATFORM_FEE * 100) + '%',
        'Duoly keeps this share of every order; the teammate gets the rest.',
        'src/server/pricing',
      ],
      [
        'Teammate currency',
        'USD',
        'Customers pay in EUR (USD prices are shown for reference). Contractors are always paid in USD.',
        'src/server/payments/checkout.ts',
      ],
      [
        'EUR → USD rate',
        fx ? fx.rate.toFixed(4) : '…',
        fx
          ? fx.live
            ? 'ECB reference rate' +
              (fx.date ? ' for ' + fx.date : '') +
              ', checked every 6 hours. Teammate pay uses it as is; USD customers pay ' +
              fx.customerRate.toFixed(4) +
              ' (+' +
              Math.round(fx.markup * 100) +
              '%). Source: ' +
              fx.source +
              (fx.ageMs == null
                ? '.'
                : ', fetched ' + Math.round(fx.ageMs / 60000) + ' minutes ago.')
            : 'Fallback rate in use because the ECB could not be reached. Source: ' +
              fx.source +
              '.'
          : this.state.error || 'Loading today’s rate…',
        'src/server/fx.ts',
      ],
      [
        'Payout day',
        'Friday',
        'The Vienna payout week runs Friday to Friday. Amounts due are frozen and paid on Friday.',
        'public.payout_week_start',
      ],
      [
        'Deposit release',
        RELEASE_DAYS + ' days',
        'The hourly release job returns held deposits after this many days without an open report or Stripe dispute.',
        'trust-deposit-release cron',
      ],
    ];
    const tiers = CREATOR_RULES.tiers;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <section
          aria-labelledby="st-basics"
          style={{ ...card, padding: '18px' }}
        >
          <h2 id="st-basics" style={h2}>
            Money
          </h2>
          <div
            style={{
              marginTop: '12px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '10px',
            }}
          >
            {basics.map(([label, value, text, file]) => (
              <div
                key={label}
                style={{
                  padding: '14px',
                  borderRadius: '16px',
                  background: C.bg,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '13px', color: C.dim }}>{label}</span>
                <span
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: '24px',
                    fontWeight: '700',
                    color: C.white,
                  }}
                >
                  {value}
                </span>
                <span style={{ fontSize: '13px', color: C.muted }}>{text}</span>
                <span style={{ marginTop: '4px' }}>{where(file)}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="ops-2eq">
          <section
            aria-labelledby="st-trust"
            style={{ ...card, padding: '18px' }}
          >
            <h2 id="st-trust" style={h2}>
              Teammate trust levels
            </h2>
            <p style={note}>
              Security deposit held from each payout, by completed orders.{' '}
              {where('src/design-reference/lib/trust.js → TIERS')}
            </p>
            <div className="ops-table-wrap">
              <table className="ops-table" style={{ minWidth: '380px' }}>
                <thead>
                  <tr>
                    <th style={th}>Level</th>
                    <th style={th}>From</th>
                    <th style={{ ...th, textAlign: 'right' }}>Deposit</th>
                  </tr>
                </thead>
                <tbody>
                  {TIERS.map((t) => (
                    <tr key={t.id}>
                      <td style={{ ...td, fontWeight: '700', color: t.color }}>
                        {t.name}
                      </td>
                      <td style={td}>
                        {t.from.toLocaleString('en-US')} orders
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          fontWeight: '700',
                          color: C.white,
                        }}
                      >
                        {t.deposit}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section
            aria-labelledby="st-rewards"
            style={{ ...card, padding: '18px' }}
          >
            <h2 id="st-rewards" style={h2}>
              Customer reward levels
            </h2>
            <p style={note}>
              Cashback is credited to gifted balance after 14 days. Level gifts
              are granted once when each level is reached.{' '}
              {where('src/design-reference/lib/rewards.js → LEVELS')}
            </p>
            <div className="ops-table-wrap">
              <table className="ops-table" style={{ minWidth: '380px' }}>
                <thead>
                  <tr>
                    <th style={th}>Level</th>
                    <th style={th}>From</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cashback</th>
                    <th style={{ ...th, textAlign: 'right' }}>Gift</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVELS.map((l) => (
                    <tr key={l.id}>
                      <td style={{ ...td, fontWeight: '700', color: l.color }}>
                        {l.name}
                      </td>
                      <td style={td}>
                        {l.from.toLocaleString('en-US')} orders
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          fontWeight: '700',
                          color: C.white,
                        }}
                      >
                        {l.cashback}%
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {l.gift ? '€' + l.gift : 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section
          aria-labelledby="st-creators"
          style={{ ...card, padding: '18px' }}
        >
          <h2 id="st-creators" style={h2}>
            Creator program
          </h2>
          <p style={note}>
            Commission by the orders a creator’s code brings in each month.
            Referred customers count for {CREATOR_RULES.attributionMonths}{' '}
            months from their first order. Commission is recorded in Creators;
            nothing is paid out automatically.{' '}
            {where('src/design-reference/lib/creators.js → CREATOR')}
          </p>
          <div className="ops-2eq">
            <div className="ops-table-wrap">
              <table className="ops-table" style={{ minWidth: '320px' }}>
                <thead>
                  <tr>
                    <th style={th}>Tier</th>
                    <th style={th}>From</th>
                    <th style={{ ...th, textAlign: 'right' }}>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t) => (
                    <tr key={t.id}>
                      <td style={{ ...td, fontWeight: '700', color: C.white }}>
                        {t.name}
                      </td>
                      <td style={td}>
                        {t.from ? t.from + '+ orders a month' : 'Everyone'}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          fontWeight: '700',
                          color: C.white,
                        }}
                      >
                        {t.commission}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul
              style={{
                margin: '0',
                paddingLeft: '18px',
                fontSize: '14px',
                color: '#CFC4EA',
                lineHeight: '1.8',
              }}
            >
              <li>
                Referral links:{' '}
                <strong style={{ color: C.white }}>
                  {info
                    ? info.referralsEnabled
                      ? 'On'
                      : 'Off'
                    : this.state.error
                      ? 'Unknown'
                      : '…'}
                </strong>
                . Links look like duoly.gg/?ref=CODE.
              </li>
              <li>
                Monthly creator payouts from €{CREATOR_RULES.payoutMinEur}, paid
                by hand.
              </li>
              <li>
                {CREATOR_RULES.viewerDiscountPercent}% off a viewer’s first
                order is applied at checkout.
              </li>
              <li>
                A customer keeps the first creator they came with; a later code
                never replaces it.
              </li>
            </ul>
          </div>
        </section>

        <div className="ops-2eq">
          <section
            aria-labelledby="st-safety"
            style={{ ...card, padding: '18px' }}
          >
            <h2 id="st-safety" style={h2}>
              Chat safety filter
            </h2>
            <p style={note}>
              Messages matching these are stopped before they’re sent.{' '}
              {where('order_chat_block_rule')}
            </p>
            <ul
              style={{
                margin: '0',
                paddingLeft: '18px',
                fontSize: '14px',
                color: '#CFC4EA',
                lineHeight: '1.8',
              }}
            >
              <li>Account access: passwords, login or account details</li>
              <li>
                Off-platform payments: PayPal, Venmo, Cash App, IBAN, bank
                transfer, crypto
              </li>
              <li>Moving off Duoly: WhatsApp, Telegram, Snapchat</li>
            </ul>
          </section>
          <section
            aria-labelledby="st-access"
            style={{ ...card, padding: '18px' }}
          >
            <h2 id="st-access" style={h2}>
              Admin access
            </h2>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '14px',
                color: '#CFC4EA',
                lineHeight: '1.6',
              }}
            >
              Admins are the accounts with the admin role in{' '}
              <button
                type="button"
                onClick={() => this.props.go && this.props.go('users')}
                style={{
                  padding: '0',
                  border: 'none',
                  background: 'none',
                  color: C.accent,
                  font: 'inherit',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Users and roles
              </button>
              . Owners are listed in the server configuration on Vercel and
              stored as the owner flag in the database: they are always admin
              and nobody can change their role. The server checks the role on
              every visit to /admin; anyone else gets a “page not found”.
            </p>
            <p style={{ margin: '10px 0 0', fontSize: '13px', color: C.dim }}>
              Owners configured:{' '}
              <strong style={{ color: C.white }}>
                {info ? (info.ownersConfigured ? 'Yes' : 'No') : '…'}
              </strong>
            </p>
            <p style={{ margin: '10px 0 0', fontSize: '13px', color: C.dim }}>
              These settings are read-only here. They change with a reviewed
              code release, never from this page.
            </p>
          </section>
        </div>
      </div>
    );
  }
}
