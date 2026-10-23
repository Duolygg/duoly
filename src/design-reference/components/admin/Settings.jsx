'use client';

import { previewFetch as fetch } from '../../../design-preview/preview-transport';


import React from 'react';
import { PLATFORM_FEE, PAYOUT_DAY } from '../../lib/adminData';
import { TIERS, RELEASE_DAYS } from '../TrustScore';
import { LEVELS } from '../Rewards';
import { C, DISPLAY, card, h2, th, td } from './ui';

const where = (file) => <code style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: "12.5px", padding: "2px 6px", borderRadius: "6px", background: C.bg, color: C.accent }}>{file}</code>;

export default class Settings extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fx: null };
  }
  async componentDidMount() {
    try { this.setState({ fx: await (await fetch('/api/fx')).json() }); } catch (e) {}
  }
  render() {
    const fx = this.state.fx;
    const basics = [
      ['Platform fee', Math.round(PLATFORM_FEE * 100) + '%', 'Duoly keeps this share of every order; the teammate gets the rest.', 'lib/adminData.js → PLATFORM_FEE'],
      ['Teammate currency', 'USD', 'Customers pay in EUR (or USD). Contractors are always paid in USD.', 'components/Teammate.jsx'],
      ['EUR → USD sample rate', fx ? fx.customerRate.toFixed(4) : '…', 'Illustrative fixture only. No live exchange feed is connected.', 'src/design-preview/sample-data.ts'],
      ['Payout day', PAYOUT_DAY, 'Weekly payouts to teammates.', 'lib/adminData.js → PAYOUT_DAY'],
      ['Deposit release', RELEASE_DAYS + ' days', 'Held deposits are paid back after this many days without a dispute.', 'components/TrustScore.jsx → RELEASE_DAYS']
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <section aria-labelledby="st-basics" style={{ ...card, padding: "18px" }}>
          <h2 id="st-basics" style={h2}>Money</h2>
          <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "10px" }}>
            {basics.map(([label, value, text, file]) => (
              <div key={label} style={{ padding: "14px", borderRadius: "16px", background: C.bg, display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "13px", color: C.dim }}>{label}</span>
                <span style={{ fontFamily: DISPLAY, fontSize: "24px", fontWeight: "700", color: C.white }}>{value}</span>
                <span style={{ fontSize: "13px", color: C.muted }}>{text}</span>
                <span style={{ marginTop: "4px" }}>{where(file)}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="ops-2eq">
          <section aria-labelledby="st-trust" style={{ ...card, padding: "18px" }}>
            <h2 id="st-trust" style={h2}>Teammate trust levels</h2>
            <p style={{ margin: "4px 0 10px", fontSize: "13px", color: C.dim }}>Security deposit held from each payout, by completed orders. {where('components/TrustScore.jsx → TIERS')}</p>
            <div className="ops-table-wrap">
              <table className="ops-table" style={{ minWidth: "380px" }}>
                <thead><tr><th style={th}>Level</th><th style={th}>From</th><th style={{ ...th, textAlign: "right" }}>Deposit</th></tr></thead>
                <tbody>
                  {TIERS.map((t) => (
                    <tr key={t.id}>
                      <td style={{ ...td, fontWeight: "700", color: t.color }}>{t.name}</td>
                      <td style={td}>{t.from.toLocaleString('en-US')} orders</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: "700", color: C.white }}>{t.deposit}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section aria-labelledby="st-rewards" style={{ ...card, padding: "18px" }}>
            <h2 id="st-rewards" style={h2}>Customer reward levels</h2>
            <p style={{ margin: "4px 0 10px", fontSize: "13px", color: C.dim }}>Cashback paid as gifted balance, plus a one-off gift per level. {where('components/Rewards.jsx → LEVELS')}</p>
            <div className="ops-table-wrap">
              <table className="ops-table" style={{ minWidth: "380px" }}>
                <thead><tr><th style={th}>Level</th><th style={th}>From</th><th style={{ ...th, textAlign: "right" }}>Cashback</th><th style={{ ...th, textAlign: "right" }}>Gift</th></tr></thead>
                <tbody>
                  {LEVELS.map((l) => (
                    <tr key={l.id}>
                      <td style={{ ...td, fontWeight: "700", color: l.color }}>{l.name}</td>
                      <td style={td}>{l.from.toLocaleString('en-US')} orders</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: "700", color: C.white }}>{l.cashback}%</td>
                      <td style={{ ...td, textAlign: "right" }}>{l.gift ? '€' + l.gift : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="ops-2eq">
          <section aria-labelledby="st-safety" style={{ ...card, padding: "18px" }}>
            <h2 id="st-safety" style={h2}>Chat safety filter</h2>
            <p style={{ margin: "4px 0 10px", fontSize: "13px", color: C.dim }}>Messages matching these are stopped before they’re sent. {where('components/Teammate.jsx → BLOCKED')}</p>
            <ul style={{ margin: "0", paddingLeft: "18px", fontSize: "14px", color: "#CFC4EA", lineHeight: "1.8" }}>
              <li>Account access: passwords, login or account details</li>
              <li>Off-platform payments: PayPal, Venmo, Cash App, IBAN, bank transfer, crypto</li>
              <li>Moving off Duoly: WhatsApp, Telegram, Snapchat</li>
            </ul>
          </section>
          <section aria-labelledby="st-access" style={{ ...card, padding: "18px" }}>
            <h2 id="st-access" style={h2}>Admin access</h2>
            <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#CFC4EA", lineHeight: "1.6" }}>
              Admins are the login emails listed in {where('ADMIN_EMAILS')} in {where('.env.local')}, separated by commas. The server checks it on every visit to /admin; anyone else gets a “page not found”.
            </p>
            <p style={{ margin: "10px 0 0", fontSize: "13px", color: C.dim }}>These settings are read-only here. Editing them from this page comes with the database.</p>
          </section>
        </div>
      </div>
    );
  }
}
