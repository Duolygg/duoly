'use client';

import React from 'react';
import { maskEmail } from '../../lib/adminData';
import { LEVELS } from '../../lib/rewards';
import { C, card, th, td, chip, btn, pill, input, eur, dateOnly, ago } from './ui';

const PAGE = 15;

export default class Customers extends React.Component {
  constructor(props) {
    super(props);
    this.state = { q: '', level: 'All', sort: 'spent', page: 0 };
  }
  render() {
    const { data, actions, ask } = this.props;
    const s = this.state;
    const q = s.q.trim().toLowerCase();
    const list = data.customers.filter((c) => (s.level === 'All' || c.level === s.level) && (!q || [c.name, c.email, c.id].some((x) => String(x || '').toLowerCase().includes(q))))
      .slice().sort({ spent: (a, b) => b.spent - a.spent, orders: (a, b) => b.orders - a.orders, wallet: (a, b) => b.wallet - a.wallet, newest: (a, b) => (b.joined || 0) - (a.joined || 0), recent: (a, b) => (b.lastOrderAt || 0) - (a.lastOrderAt || 0) }[s.sort]);
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    const page = Math.min(s.page, pages - 1);
    const shown = list.slice(page * PAGE, page * PAGE + PAGE);
    const totalWallet = data.customers.reduce((a, c) => a + c.wallet, 0);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <section aria-label="Customer totals" className="ops-kpis">
          {[
            [data.customers.length.toLocaleString('en-US'), 'customers'],
            [data.customers.filter((c) => c.orders > 0).length.toLocaleString('en-US'), 'have finished an order'],
            [eur(totalWallet), 'sitting in wallets'],
            [LEVELS.map((l) => data.customers.filter((c) => c.level === l.name).length).join(' / '), LEVELS.map((l) => l.name.charAt(0)).join(' / ') + ' by level'],
            [data.customers.filter((c) => c.blocked).length, 'blocked']
          ].map(([v, l]) => (
            <div key={l} style={{ ...card, padding: "16px 18px" }}>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "700", color: C.white }}>{v}</div>
              <div style={{ fontSize: "13px", color: C.dim }}>{l}</div>
            </div>
          ))}
        </section>

        <section aria-label="Customers" style={{ ...card, padding: "18px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
            <input type="search" aria-label="Search customers" placeholder="Search name, email or ID…" value={s.q} onChange={(e) => this.setState({ q: e.target.value, page: 0 })} style={{ ...input, flex: "1 1 240px" }} />
            <select aria-label="Sort" value={s.sort} onChange={(e) => this.setState({ sort: e.target.value })} style={input}>
              <option value="spent">Most spent</option>
              <option value="orders">Most orders</option>
              <option value="wallet">Biggest wallet</option>
              <option value="recent">Ordered recently</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          <div role="group" aria-label="Level" style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {['All'].concat(LEVELS.map((l) => l.name)).map((lv) => {
              const color = (LEVELS.find((l) => l.name === lv) || {}).color;
              return (
                <button key={lv} type="button" aria-pressed={s.level === lv ? 'true' : 'false'} onClick={() => this.setState({ level: lv, page: 0 })} style={chip(s.level === lv)}>
                  {color ? <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} /> : null}{lv}
                </button>
              );
            })}
          </div>
          <div className="ops-table-wrap" style={{ marginTop: "12px" }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th style={th}>Customer</th><th style={th}>Level</th><th style={{ ...th, textAlign: "right" }}>Orders</th><th style={{ ...th, textAlign: "right" }}>Spent</th>
                  <th style={{ ...th, textAlign: "right" }}>Wallet</th><th style={th}>Joined</th><th style={th}>Status</th>
                  <th style={th}><span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id}>
                    <td style={td}>
                      <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ position: "relative", width: "32px", height: "32px", flex: "0 0 auto" }}>
                          <img src={c.av} alt="" width="32" height="32" referrerPolicy="no-referrer" style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }} />
                          {c.flag ? <img src={c.flag} alt="" width="13" height="13" style={{ position: "absolute", right: "-2px", bottom: "-2px", width: "13px", height: "13px", borderRadius: "50%", objectFit: "cover" }} /> : null}
                        </span>
                        <span style={{ lineHeight: "1.3" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", color: C.white }}>
                            {c.name}
                            {c.warnings ? <span title="Warnings from flagged chat messages" style={{ fontSize: "10.5px", fontWeight: "800", padding: "1px 6px", borderRadius: "6px", background: "rgba(255, 138, 155, .14)", color: C.red }}>{c.warnings} WARNED</span> : null}
                          </span>
                          <span style={{ display: "block", fontSize: "12px", color: C.dim }}>{maskEmail(c.email) || (c.provider === 'discord' ? 'Discord account' : c.provider === 'google' ? 'Google account' : '—')}{c.lastOrderAt ? ' · last order ' + ago(c.lastOrderAt, Date.now()) : ' · no orders yet'}</span>
                        </span>
                      </span>
                    </td>
                    <td style={td}><span style={{ fontWeight: "700", color: c.levelColor }}>{c.level}</span></td>
                    <td style={{ ...td, textAlign: "right" }} title={c.placed + ' placed in total, incl. cancelled'}>{c.orders.toLocaleString('en-US')}</td>
                    <td style={{ ...td, textAlign: "right", color: C.white, fontWeight: "600" }}>{eur(c.spent)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {eur(c.wallet)}
                      {c.gifted ? <span title={c.adjustments + ' manual adjustment' + (c.adjustments === 1 ? '' : 's') + ' by admins'} style={{ display: "block", fontSize: "11.5px", color: c.gifted < 0 ? C.red : C.green }}>{c.gifted < 0 ? '−' + eur(-c.gifted) : '+' + eur(c.gifted)} adjusted</span> : null}
                    </td>
                    <td style={{ ...td, color: C.dim }}>{c.joined ? dateOnly(c.joined) : '—'}</td>
                    <td style={td}><span title={c.blocked ? 'Blocked by ' + c.blocked.by + (c.blocked.reason ? ': ' + c.blocked.reason : '') : undefined} style={pill(c.blocked ? 'Blocked' : 'Active')}>{c.blocked ? 'Blocked' : 'Active'}</span></td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: "6px" }}>
                        <button type="button" style={btn()} onClick={() => ask({
                          title: 'Adjust ' + c.name + '’s wallet', body: 'Now ' + eur(c.wallet) + '. Use a plus amount to add credit (e.g. 5) and a minus amount to take it off (e.g. -5). The wallet can’t go below €0.', confirm: 'Adjust wallet',
                          field: { label: 'Amount in € (+ or −)', type: 'number', signed: true, placeholder: '5 or -5', required: true, value: '' },
                          field2: { label: 'Reason (shown in the audit log)', placeholder: 'e.g. sorry for the no-show on DL-48403', required: true },
                          onConfirm: (amount, reason) => actions.adjustBalance(c.id, 'customer', Math.round(parseFloat(amount) * 100) / 100, reason)
                        })}>Adjust balance</button>
                        {c.blocked ? (
                          <button type="button" style={btn()} onClick={() => ask({ title: 'Unblock ' + c.name + '?', body: 'They can book teammates again.', confirm: 'Unblock', onConfirm: () => actions.toggleBlock(c.id) })}>Unblock</button>
                        ) : (
                          <button type="button" style={btn('danger')} onClick={() => ask({
                            title: 'Block ' + c.name + '?', body: 'They can’t book or chat until unblocked. Their wallet stays as it is.', confirm: 'Block', kind: 'danger',
                            field: { label: 'Reason', placeholder: 'e.g. chargeback fraud', required: true },
                            onConfirm: (reason) => actions.toggleBlock(c.id, reason)
                          })}>Block</button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
                {!shown.length ? <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: C.dim, padding: "36px 12px" }}>{data.customers.length ? 'No customers match.' : 'No customers yet.'}</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", fontSize: "13px", color: C.dim }}>
            <span>{list.length ? (page * PAGE + 1) + '–' + Math.min(list.length, page * PAGE + PAGE) + ' of ' + list.length : '0 customers'} · emails are masked</span>
            <span style={{ display: "flex", gap: "6px" }}>
              <button type="button" disabled={page === 0} onClick={() => this.setState({ page: page - 1 })} style={{ ...btn(), opacity: page === 0 ? ".4" : "1" }}>Previous</button>
              <button type="button" disabled={page >= pages - 1} onClick={() => this.setState({ page: page + 1 })} style={{ ...btn(), opacity: page >= pages - 1 ? ".4" : "1" }}>Next</button>
            </span>
          </div>
        </section>
      </div>
    );
  }
}
