'use client';

import { previewFetch as fetch } from '../../../design-preview/preview-transport';


import React from 'react';
import { C, DISPLAY, card, h2, chip, btn, pill, ago } from './ui';

// Real reports from customers (waiting room → Report), with their screenshots. Approving means the
// customer is owed the bounty; there's no payout provider yet, so pay it out by hand for now.
class CustomerReports extends React.Component {
  constructor(props) {
    super(props);
    this.state = { reports: [], bounty: 50, loaded: false, error: '', filter: 'open', busy: '' };
  }
  componentDidMount() { this.load(); this._t = setInterval(() => this.load(), 20000); }
  componentWillUnmount() { clearInterval(this._t); }
  async load() {
    try {
      const res = await fetch('/api/admin/reports', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) return this.setState({ error: d.error || 'Couldn’t load reports.', loaded: true });
      this.setState({ reports: d.reports || [], bounty: d.bounty || 50, loaded: true, error: '' });
    } catch (e) {
      this.setState({ error: 'Can’t reach Duoly right now.', loaded: true });
    }
  }
  async decide(r, decision, note) {
    this.setState({ busy: r.id });
    try {
      const res = await fetch('/api/admin/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, decision, note }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return this.props.toast(d.error || 'Couldn’t save that.', 'warn');
      this.setState({ reports: this.state.reports.map((x) => (x.id === r.id ? { ...x, ...d.report } : x)) });
      this.props.log(decision === 'approved' ? 'Approved report' : 'Rejected report', r.id, r.typeLabel + ' · ' + r.against.name + (note ? ' · ' + note : ''));
      this.props.toast(decision === 'approved' ? 'Approved · ' + r.byName + ' is owed the bounty' : 'Report rejected');
    } catch (e) {
      this.props.toast('Can’t reach Duoly right now.', 'warn');
    } finally {
      this.setState({ busy: '' });
    }
  }
  render() {
    const s = this.state;
    const { now, ask, go } = this.props;
    const list = s.reports.filter((r) => s.filter === 'all' || r.status === 'open');
    const sym = (r) => (r.currency === 'USD' ? '$' : '€');
    const status = { open: ['Open', C.gold, 'rgba(255, 210, 122, .12)'], approved: ['Approved · bounty owed', C.green, 'rgba(94, 234, 168, .12)'], rejected: ['Rejected', C.dim, 'rgba(142, 132, 171, .14)'] };
    return (
      <section aria-labelledby="sf-r-h" style={{ ...card, padding: "18px", borderColor: s.reports.some((r) => r.status === 'open') ? 'rgba(255, 138, 155, .3)' : C.line }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <h2 id="sf-r-h" style={h2}>Customer reports</h2>
          <div role="group" aria-label="Filter" style={{ display: "flex", gap: "6px" }}>
            {[['open', 'Open'], ['all', 'All']].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={s.filter === id ? 'true' : 'false'} onClick={() => this.setState({ filter: id })} style={chip(s.filter === id)}>
                {label}<span style={{ opacity: ".65", fontWeight: "500" }}>{id === 'all' ? s.reports.length : s.reports.filter((r) => r.status === 'open').length}</span>
              </button>
            ))}
          </div>
        </div>
        <p style={{ margin: "6px 0 14px", fontSize: "13.5px", color: C.dim }}>
          Off-platform attempts and toxicity reported by customers, with their proof. Approve only with solid evidence: the customer is then owed the {s.bounty} bounty.
        </p>
        {s.error ? <p role="status" style={{ margin: "0 0 12px", fontSize: "13.5px", color: C.pink }}>{s.error}</p> : null}
        <div className="ops-cards">
          {list.map((r) => {
            const st = status[r.status] || status.open;
            return (
              <article key={r.id} style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px", borderRadius: "18px", background: C.bg, border: "1px solid " + (r.status === 'open' ? 'rgba(255, 138, 155, .28)' : C.line) }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: "700", fontSize: "17px", color: C.white }}>{r.typeLabel}</span>
                  <span style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", background: st[2], color: st[1], whiteSpace: "nowrap" }}>{st[0]}</span>
                </div>
                <div style={{ fontSize: "13px", color: C.muted }}>
                  <b style={{ color: C.white, fontWeight: "600" }}>{r.byName}</b> reported <b style={{ color: C.white, fontWeight: "600" }}>{r.against.name}</b> · {r.id} · bounty {sym(r)}{r.bounty}
                </div>
                <p style={{ margin: "0", padding: "10px 12px", borderRadius: "12px", background: C.panel, fontSize: "14px", color: "#CFC4EA", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>“{r.text}”</p>
                <div className="tm-proof">
                  {(r.evidence || []).map((f, i) => (
                    <a key={f} aria-disabled="true" role="link" className="tm-proof-thumb" title="Unavailable in the design preview">
                      <img src={'/api/uploads/' + f} alt={'Evidence ' + (i + 1)} />
                    </a>
                  ))}
                </div>
                <div style={{ fontSize: "12.5px", color: C.faint }}>
                  Sent {ago(r.at, now)} on order {r.orderId}
                  {r.decidedBy ? ' · ' + (r.status === 'approved' ? 'approved' : 'rejected') + ' by ' + r.decidedBy + (r.decisionNote ? ': ' + r.decisionNote : '') : ''}
                </div>
                {r.status === 'open' ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    <button type="button" style={btn('good')} disabled={s.busy === r.id} onClick={() => ask({
                      title: 'Approve report ' + r.id + '?', body: 'The proof holds up: ' + r.byName + ' is owed ' + sym(r) + r.bounty + ', and ' + r.against.name + ' should be warned or removed (Teammate Code). Pay the bounty out by hand until payouts are automated.', confirm: 'Approve · bounty owed', kind: 'good',
                      field: { label: 'Note (shown in the audit log)', placeholder: 'e.g. screenshot shows a PayPal request' },
                      onConfirm: (note) => this.decide(r, 'approved', note)
                    })}>Approve</button>
                    <button type="button" style={btn()} disabled={s.busy === r.id} onClick={() => ask({
                      title: 'Reject report ' + r.id + '?', body: 'Not enough proof. The customer sees that it was reviewed, and no bounty is paid.', confirm: 'Reject report',
                      field: { label: 'Note (shown in the audit log)', placeholder: 'e.g. screenshot doesn’t show the message' },
                      onConfirm: (note) => this.decide(r, 'rejected', note)
                    })}>Reject</button>
                    {go ? <button type="button" style={btn()} onClick={() => go('orders', { order: r.orderId })}>View order</button> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
          {s.loaded && !list.length ? <p style={{ margin: "0", color: C.dim }}>{s.filter === 'open' ? 'No open reports.' : 'No reports yet.'}</p> : null}
        </div>
      </section>
    );
  }
}

export default class Safety extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fFilter: 'Open' };
  }
  render() {
    const { data, now, actions, ask, go } = this.props;
    const s = this.state;
    const flags = data.flags.filter((f) => s.fFilter === 'All' || f.status === s.fFilter);
    const filters = (key, value, all) => (
      <div role="group" aria-label="Filter" style={{ display: "flex", gap: "6px" }}>
        {['Open', 'All'].map((f) => (
          <button key={f} type="button" aria-pressed={value === f ? 'true' : 'false'} onClick={() => this.setState({ [key]: f })} style={chip(value === f)}>
            {f}<span style={{ opacity: ".65", fontWeight: "500" }}>{f === 'All' ? all.length : all.filter((x) => x.status === 'Open').length}</span>
          </button>
        ))}
      </div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <CustomerReports now={now} ask={ask} go={go} toast={this.props.toast} log={this.props.log} />
        <section aria-labelledby="sf-f-h" style={{ ...card, padding: "18px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "6px" }}>
            <h2 id="sf-f-h" style={h2}>Flagged chat messages</h2>
            {filters('fFilter', s.fFilter, data.flags)}
          </div>
          <p style={{ margin: "0 0 12px", fontSize: "13.5px", color: C.dim }}>The chat safety filter stopped these (outside payments, logins, moving off Duoly), so they never reached the other person. Warn records it on their account; tell them yourself on Discord.</p>
          <ul style={{ listStyle: "none", margin: "0", padding: "0", display: "flex", flexDirection: "column", gap: "8px" }}>
            {flags.map((f) => (
              <li key={f.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 14px", padding: "14px", borderRadius: "16px", background: C.bg, border: "1px solid " + C.line }}>
                <span style={{ flex: "1 1 320px", minWidth: "0" }}>
                  <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", fontSize: "13px", color: C.muted }}>
                    <b style={{ color: C.white, fontWeight: "600" }}>{f.who}</b>
                    <span style={{ fontSize: "11.5px", padding: "1px 7px", borderRadius: "6px", background: f.role === 'teammate' ? 'rgba(214, 187, 255, .12)' : 'rgba(158, 230, 255, .12)', color: f.role === 'teammate' ? C.accent : C.cyan }}>{f.role}</span>
                    <span style={{ fontSize: "11.5px", padding: "1px 7px", borderRadius: "6px", background: 'rgba(255, 138, 155, .12)', color: C.red }}>{f.rule}</span>
                    · <button type="button" onClick={() => go('orders', { order: f.orderId })} style={{ padding: "0", border: "none", background: "transparent", color: C.accent, fontSize: "13px", textDecoration: "underline", textUnderlineOffset: "2px", transform: "none" }}>{f.orderId}</button> · {ago(f.at, Date.now())}
                  </span>
                  <span style={{ display: "block", marginTop: "6px", fontSize: "14.5px", color: C.white, overflowWrap: "anywhere" }}>“{f.text}”</span>
                </span>
                {f.status === 'Open' ? (
                  <span style={{ display: "flex", gap: "6px" }}>
                    <button type="button" style={btn('danger')} onClick={() => ask({
                      title: 'Warn ' + f.who + '?', body: 'Records a warning on their account (shown in the Teammates / Customers tabs). Let them know on Discord too.', confirm: 'Record warning', kind: 'danger',
                      onConfirm: () => actions.reviewFlag(f.id, 'Warned')
                    })}>Warn</button>
                    <button type="button" style={btn()} onClick={() => actions.reviewFlag(f.id, 'Dismissed')}>Dismiss</button>
                  </span>
                ) : <span title={f.by ? 'by ' + f.by : undefined} style={pill(f.status === 'Warned' ? 'Resolved' : f.status)}>{f.status}</span>}
              </li>
            ))}
            {!flags.length ? <li style={{ color: C.dim }}>{data.flags.length ? 'Nothing open. All reviewed.' : 'Nothing flagged yet. Messages the filter stops show up here.'}</li> : null}
          </ul>
        </section>
      </div>
    );
  }
}
