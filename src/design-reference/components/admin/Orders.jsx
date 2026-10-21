'use client';

import React from 'react';
import { GAMES, PLATFORM_FEE } from '../../lib/adminData';
import { tierFor } from '../../lib/trust';
import { levelFor } from '../../lib/rewards';
import { C, DISPLAY, card, h2, th, td, chip, btn, pill, input, eur, usd, ago, dateTime } from './ui';

const STATUSES = ['All', 'Queued', 'In progress', 'Completed', 'Refunded', 'Cancelled'];
const PAGE = 12;

export default class Orders extends React.Component {
  constructor(props) {
    super(props);
    this.state = { q: '', status: 'All', game: 'all', sort: 'new', page: 0, open: props.focusOrder || null };
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.open && this.state.open !== prevState.open && this._drawer) this._drawer.focus();
  }
  componentDidMount() {
    if (this.state.open && this._drawer) this._drawer.focus();
  }
  filtered() {
    const { data } = this.props;
    const s = this.state;
    const q = s.q.trim().toLowerCase();
    let list = data.orders.filter((o) =>
      (s.status === 'All' || o.status === s.status) &&
      (s.game === 'all' || o.game === s.game) &&
      (!q || [o.id, o.customer, o.teammate, o.service].some((x) => String(x).toLowerCase().includes(q))));
    const by = { new: (a, b) => b.createdAt - a.createdAt, old: (a, b) => a.createdAt - b.createdAt, high: (a, b) => b.amount - a.amount, low: (a, b) => a.amount - b.amount }[s.sort];
    return list.slice().sort(by);
  }
  exportCsv(list) {
    const rows = [['Order', 'Created', 'Customer', 'Teammate', 'Game', 'Service', 'Games', 'Amount EUR', 'Payment', 'Status']].concat(
      list.map((o) => [o.id, new Date(o.createdAt).toISOString(), o.customer, o.teammate, GAMES[o.game].name, o.service, o.games, o.amount.toFixed(2), o.pay, o.status]));
    const csv = rows.map((r) => r.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'duoly-orders.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.props.toast('Exported ' + list.length + ' orders');
  }

  renderDrawer() {
    const { data, now, actions, ask, go } = this.props;
    const o = data.orders.find((x) => x.id === this.state.open);
    if (!o) return null;
    const mate = data.teammates.find((t) => t.name === o.teammate);
    const cust = data.customers.find((c) => c.id === o.customerId);
    const tier = mate ? tierFor(mate.lifetime) : null;
    const level = cust ? levelFor(cust.orders) : null;
    const fee = o.amount * PLATFORM_FEE;
    const shareEur = o.amount - fee;
    // what the teammate is paid, saved on the order when it was booked (at that day's exchange rate)
    const shareUsd = o.payoutUsd || 0;
    const held = tier ? shareUsd * tier.deposit / 100 : 0;
    const cashback = level ? o.amount * level.cashback / 100 : 0;
    // finished orders can be refunded, waiting or running ones cancelled (both to the customer's wallet)
    const canRefund = o.status === 'Completed';
    const canCancel = ['Queued', 'In progress'].includes(o.status);
    const close = () => this.setState({ open: null });
    const timeline = [['Paid with ' + o.pay, o.createdAt, true]];
    if (o.teammate) timeline.push(['Matched with ' + o.teammate + ' after ' + Math.floor(o.waitSec / 60) + 'm ' + (o.waitSec % 60) + 's', o.createdAt + o.waitSec * 1000, true]);
    if (o.status === 'Queued') timeline.push(['Waiting for a teammate', null, false]);
    if (o.status === 'In progress') timeline.push(['Playing now', null, false]);
    if (o.results) timeline.push(['Played ' + o.games + (o.games === 1 ? ' game' : ' games') + ' · proof screenshots uploaded', o.completedAt || o.createdAt + (o.waitSec + o.games * 1900) * 1000, true]);
    if (o.status === 'Completed') timeline.push([o.real ? 'Completed · added to the teammate’s payout week' : 'Completed · teammate paid', o.completedAt || o.createdAt + (o.waitSec + o.games * 1900 + 60) * 1000, true]);
    if (o.status === 'Refunded') timeline.push(['Refunded to the customer’s wallet' + (o.refundedBy ? ' by ' + o.refundedBy : '') + (o.note ? ': ' + o.note : ''), null, true]);
    if (o.status === 'Cancelled') timeline.push(['Cancelled' + (o.note ? ': ' + o.note : ''), o.cancelledAt || null, true]);

    const row = (label, value, color, bold) => (
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "8px 0", borderBottom: "1px solid " + C.line, fontSize: "14px" }}>
        <span style={{ color: C.muted }}>{label}</span>
        <span style={{ color: color || C.white, fontWeight: bold ? "700" : "600", textAlign: "right" }}>{value}</span>
      </div>
    );
    const person = (label, name, av, sub, extra) => (
      <div style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: "10px", padding: "12px", borderRadius: "14px", background: C.bg, minWidth: "0" }}>
        {av ? <img src={av} alt="" width="38" height="38" style={{ width: "38px", height: "38px", borderRadius: "50%", flex: "0 0 auto" }} /> : <span style={{ width: "38px", height: "38px", borderRadius: "50%", background: C.raised, flex: "0 0 auto" }} />}
        <span style={{ minWidth: "0", lineHeight: "1.3" }}>
          <span style={{ display: "block", fontSize: "11.5px", color: C.faint, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
          <span style={{ display: "block", fontWeight: "600", color: C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || 'Not matched yet'}</span>
          {sub ? <span style={{ display: "block", fontSize: "12px", color: extra || C.dim }}>{sub}</span> : null}
        </span>
      </div>
    );

    return (
      <div role="dialog" aria-modal="true" aria-labelledby="ad-order-h" style={{ position: "fixed", inset: "0", zIndex: "60", display: "flex", justifyContent: "flex-end" }}>
        <button type="button" aria-label="Close order" onClick={close} style={{ position: "absolute", inset: "0", border: "none", background: "rgba(5, 2, 12, .6)", backdropFilter: "blur(4px)", cursor: "default", transform: "none", animation: "dlfade .15s ease-out" }} />
        <div ref={(el) => { this._drawer = el; }} tabIndex={-1} onKeyDown={(e) => { if (e.key === 'Escape') close(); }} style={{ position: "relative", width: "min(540px, 100%)", height: "100%", overflowY: "auto", background: C.panel, borderLeft: "1px solid rgba(214, 187, 255, .16)", boxShadow: "-30px 0 80px rgba(0, 0, 0, .5)", padding: "22px", animation: "adin .2s ease-out", outline: "none" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <img src={GAMES[o.game].img} alt={GAMES[o.game].name} width="48" height="48" style={{ width: "48px", height: "48px", borderRadius: "14px" }} />
            <div style={{ flex: "1", minWidth: "0" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                <h2 id="ad-order-h" style={{ ...h2, fontSize: "22px" }}>{o.id}</h2>
                <span style={pill(o.status)}>{o.status}</span>
              </div>
              <div style={{ fontSize: "13.5px", color: C.muted }}>{o.service}{o.games > 1 ? ' ×' + o.games : ''} · {GAMES[o.game].name} · {o.region}</div>
              <div style={{ fontSize: "12.5px", color: C.faint }}>{dateTime(o.createdAt)} · {ago(o.createdAt, now)}</div>
            </div>
            <button type="button" onClick={close} aria-label="Close" style={{ width: "40px", height: "40px", borderRadius: "12px", border: "none", background: "rgba(196, 170, 255, .08)", color: "#CFC4EA", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <div style={{ marginTop: "18px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {person('Customer', o.customer, o.customerAv, cust ? level.name + ' · ' + cust.orders + ' orders' : '', level ? level.color : '')}
            {person('Teammate', o.teammate, o.teammateAv, mate ? tier.name + ' · ★ ' + mate.rating.toFixed(2) : '', tier ? tier.color : '')}
          </div>


          <h3 style={{ margin: "22px 0 4px", fontSize: "13px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: C.faint }}>Money</h3>
          {row('Customer paid', eur(o.amount), C.white, true)}
          {row('Duoly fee (' + Math.round(PLATFORM_FEE * 100) + '%)', eur(fee), C.accent)}
          {row('Teammate share', eur(shareEur) + ' → ' + usd(shareUsd))}
          {tier ? row('Security deposit (' + tier.deposit + '%)', tier.deposit ? '− ' + usd(held) : 'none', C.gold) : null}
          {tier ? row('Teammate gets', usd(shareUsd - held), C.green, true) : null}
          {level ? row('Cashback to customer (' + level.cashback + '%)', eur(cashback), C.cyan) : null}

          <h3 style={{ margin: "22px 0 8px", fontSize: "13px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: C.faint }}>Timeline</h3>
          <ol style={{ listStyle: "none", margin: "0", padding: "0" }}>
            {timeline.map(([text, at, done], i) => (
              <li key={i} style={{ position: "relative", display: "flex", gap: "12px", paddingBottom: i === timeline.length - 1 ? "0" : "14px" }}>
                <span style={{ position: "relative", flex: "0 0 auto", width: "12px", display: "flex", justifyContent: "center" }}>
                  <span style={{ marginTop: "5px", width: "10px", height: "10px", borderRadius: "50%", background: done ? C.accent : 'transparent', border: done ? 'none' : '2px dashed ' + C.dim }} />
                  {i < timeline.length - 1 ? <span style={{ position: "absolute", top: "17px", bottom: "-2px", width: "2px", background: C.line2 }} /> : null}
                </span>
                <span style={{ lineHeight: "1.4" }}>
                  <span style={{ display: "block", fontSize: "14px", color: C.white }}>{text}</span>
                  {at ? <span style={{ display: "block", fontSize: "12px", color: C.faint }}>{dateTime(at)}</span> : null}
                </span>
              </li>
            ))}
          </ol>

          <div style={{ marginTop: "24px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {canRefund ? (
              <button type="button" style={btn('danger')} onClick={() => ask({
                title: 'Refund ' + eur(o.amount) + '?', body: o.customer + ' gets the full amount back as Duoly wallet credit. The teammate’s pay for this order isn’t changed: hold their payout on the Payouts page if needed.',
                confirm: 'Refund ' + eur(o.amount), kind: 'danger',
                field: { label: 'Reason (shown in the audit log)', placeholder: 'e.g. teammate left mid-game', required: true },
                onConfirm: (reason) => actions.refundOrder(o.id, reason)
              })}>Refund</button>
            ) : null}
            {canCancel ? (
              <button type="button" style={btn()} onClick={() => ask({
                title: 'Cancel ' + o.id + '?', body: 'The order stops' + (o.teammate ? ' (' + o.teammate + ' is taken off it)' : '') + ' and ' + o.customer + ' gets the full price back as wallet credit. To give it to another teammate instead, use a handover link on the Live desk.', confirm: 'Cancel order', kind: 'danger',
                field: { label: 'Reason', placeholder: 'e.g. customer asked to cancel', required: true },
                onConfirm: (reason) => actions.cancelOrder(o.id, reason)
              })}>Cancel order</button>
            ) : null}
            {!canRefund && !canCancel ? <span style={{ fontSize: "13.5px", color: C.dim }}>No actions available for a {o.status.toLowerCase()} order.</span> : null}
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { data, now } = this.props;
    const s = this.state;
    const list = this.filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    const page = Math.min(s.page, pages - 1);
    const shown = list.slice(page * PAGE, page * PAGE + PAGE);
    const count = (st) => (st === 'All' ? data.orders.length : data.orders.filter((o) => o.status === st).length);
    return (
      <section aria-labelledby="ad-orders-h" style={{ ...card, padding: "18px" }}>
        <h2 id="ad-orders-h" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Orders</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <label style={{ flex: "1 1 240px", display: "flex", alignItems: "center", gap: "8px", ...input, padding: "0 12px" }}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Search orders</span>
            <input type="search" placeholder="Search order ID, customer, teammate…" value={s.q} onChange={(e) => this.setState({ q: e.target.value, page: 0 })} style={{ flex: "1", minWidth: "0", height: "38px", border: "none", background: "transparent", color: C.white, fontSize: "14px", outline: "none" }} />
          </label>
          <select aria-label="Game" value={s.game} onChange={(e) => this.setState({ game: e.target.value, page: 0 })} style={input}>
            <option value="all">All games</option>
            {Object.keys(GAMES).map((g) => <option key={g} value={g}>{GAMES[g].name}</option>)}
          </select>
          <select aria-label="Sort" value={s.sort} onChange={(e) => this.setState({ sort: e.target.value })} style={input}>
            <option value="new">Newest first</option>
            <option value="old">Oldest first</option>
            <option value="high">Highest amount</option>
            <option value="low">Lowest amount</option>
          </select>
          <button type="button" onClick={() => this.exportCsv(list)} style={btn()}>
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
            Export CSV
          </button>
        </div>
        <div role="group" aria-label="Status" style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {STATUSES.map((st) => (
            <button key={st} type="button" aria-pressed={s.status === st ? 'true' : 'false'} onClick={() => this.setState({ status: st, page: 0 })} style={chip(s.status === st)}>
              {st}<span style={{ opacity: ".65", fontWeight: "500" }}>{count(st)}</span>
            </button>
          ))}
        </div>

        <div className="ad-table-wrap" style={{ marginTop: "12px" }}>
          <table className="ad-table">
            <thead>
              <tr>
                <th style={th}>Order</th><th style={th}>Customer</th><th style={th}>Teammate</th><th style={th}>Service</th>
                <th style={{ ...th, textAlign: "right" }}>Amount</th><th style={th}>Status</th><th style={th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} className="ad-tr" tabIndex={0} onClick={() => this.setState({ open: o.id })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.setState({ open: o.id }); } }} aria-label={'Open order ' + o.id}>
                  <td style={{ ...td, fontWeight: "600", color: C.white, fontFamily: "ui-monospace, Consolas, monospace", fontSize: "13px" }}>{o.id}</td>
                  <td style={td}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <img src={o.customerAv} alt="" width="26" height="26" style={{ width: "26px", height: "26px", borderRadius: "50%" }} />{o.customer}
                    </span>
                  </td>
                  <td style={{ ...td, color: o.teammate ? C.text : C.faint }}>
                    {o.teammate ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <img src={o.teammateAv} alt="" width="26" height="26" style={{ width: "26px", height: "26px", borderRadius: "50%" }} />{o.teammate}
                      </span>
                    ) : 'Waiting…'}
                  </td>
                  <td style={td}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <img src={GAMES[o.game].img} alt={GAMES[o.game].name} width="22" height="22" style={{ width: "22px", height: "22px", borderRadius: "6px" }} />
                      {o.service}{o.games > 1 ? ' ×' + o.games : ''}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: "600", color: C.white }}>{eur(o.amount)}</td>
                  <td style={td}><span style={pill(o.status)}>{o.status}</span></td>
                  <td style={{ ...td, color: C.dim }} title={dateTime(o.createdAt)}>{ago(o.createdAt, now)}</td>
                </tr>
              ))}
              {!shown.length ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: C.dim, padding: "36px 12px" }}>No orders match these filters.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", fontSize: "13px", color: C.dim }}>
          <span>{list.length ? (page * PAGE + 1) + '–' + Math.min(list.length, page * PAGE + PAGE) + ' of ' + list.length : '0 orders'}</span>
          <span style={{ display: "flex", gap: "6px" }}>
            <button type="button" disabled={page === 0} onClick={() => this.setState({ page: page - 1 })} style={{ ...btn(), opacity: page === 0 ? ".4" : "1" }}>Previous</button>
            <button type="button" disabled={page >= pages - 1} onClick={() => this.setState({ page: page + 1 })} style={{ ...btn(), opacity: page >= pages - 1 ? ".4" : "1" }}>Next</button>
          </span>
        </div>
        {this.renderDrawer()}
      </section>
    );
  }
}
