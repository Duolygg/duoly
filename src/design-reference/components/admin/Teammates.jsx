'use client';

import React from 'react';
import { GAMES, maskEmail } from '../../lib/adminData';
import { C, DISPLAY, card, th, td, chip, btn, pill, input, usd, ago, dateOnly } from './ui';

export default class Teammates extends React.Component {
  constructor(props) {
    super(props);
    this.state = { tab: 'roster', q: '', filter: 'All', sort: 'orders', appFilter: 'Pending' };
  }
  renderRoster() {
    const { data, actions, ask } = this.props;
    const s = this.state;
    const q = s.q.trim().toLowerCase();
    const live = (t) => t.status !== 'offline' && !t.suspended;
    const is = (t, f) => f === 'All' || (f === 'Online' && live(t)) || (f === 'Suspended' && t.suspended) || (f === 'No Discord' && !t.discord);
    const list = data.teammates.filter((t) => is(t, s.filter) &&
      (!q || [t.name, t.email, t.tier].concat(t.games.map((g) => (GAMES[g] || {}).name)).some((x) => String(x || '').toLowerCase().includes(q))))
      .slice().sort({ orders: (a, b) => b.lifetime - a.lifetime, rating: (a, b) => b.rating - a.rating, earned: (a, b) => b.earned30 - a.earned30, newest: (a, b) => (b.joined || 0) - (a.joined || 0) }[s.sort]);
    const n = (f) => data.teammates.filter((t) => is(t, f)).length;
    return (
      <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <input type="search" aria-label="Search teammates" placeholder="Search name, email, game, level…" value={s.q} onChange={(e) => this.setState({ q: e.target.value })} style={{ ...input, flex: "1 1 240px" }} />
          <div role="group" aria-label="Filter" style={{ display: "flex", gap: "6px" }}>
            {['All', 'Online', 'Suspended', 'No Discord'].map((f) => (
              <button key={f} type="button" aria-pressed={s.filter === f ? 'true' : 'false'} onClick={() => this.setState({ filter: f })} style={chip(s.filter === f)}>{f}<span style={{ opacity: ".65", fontWeight: "500" }}>{n(f)}</span></button>
            ))}
          </div>
          <select aria-label="Sort" value={s.sort} onChange={(e) => this.setState({ sort: e.target.value })} style={input}>
            <option value="orders">Most orders</option>
            <option value="rating">Best rating</option>
            <option value="earned">Most earned (30d)</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        <div className="ops-table-wrap" style={{ marginTop: "12px" }}>
          <table className="ops-table">
            <thead>
              <tr>
                <th style={th}>Teammate</th><th style={th}>Games</th><th style={th}>Trust level</th><th style={{ ...th, textAlign: "right" }}>Rating</th>
                <th style={{ ...th, textAlign: "right" }}>Orders</th><th style={{ ...th, textAlign: "right" }}>Earned 30d</th><th style={{ ...th, textAlign: "right" }}>Deposit held</th><th style={{ ...th, textAlign: "right" }}>Owed</th>
                <th style={th}>Status</th><th style={th}><span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td style={td}>
                    <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ position: "relative", width: "32px", height: "32px", flex: "0 0 auto" }}>
                        <img src={t.av} alt="" width="32" height="32" referrerPolicy="no-referrer" style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }} />
                        {t.flag ? <img src={t.flag} alt="" width="13" height="13" style={{ position: "absolute", right: "-2px", bottom: "-2px", width: "13px", height: "13px", borderRadius: "50%", objectFit: "cover" }} /> : null}
                      </span>
                      <span style={{ lineHeight: "1.3" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", color: C.white }}>
                          {t.name}
                          {t.warnings ? <span title="Warnings from flagged chat messages" style={{ fontSize: "10.5px", fontWeight: "800", padding: "1px 6px", borderRadius: "6px", background: "rgba(255, 138, 155, .14)", color: C.red }}>{t.warnings} WARNED</span> : null}
                          {!t.discord ? <span title="Hasn’t connected Discord yet, so they can’t go online" style={{ fontSize: "10.5px", fontWeight: "800", padding: "1px 6px", borderRadius: "6px", background: "rgba(255, 210, 122, .14)", color: C.gold }}>NO DISCORD</span> : null}
                        </span>
                        <span style={{ display: "block", fontSize: "12px", color: C.dim }}>{maskEmail(t.email)}{t.joined ? ' · since ' + dateOnly(t.joined) : ''}</span>
                      </span>
                    </span>
                  </td>
                  <td style={td}>
                    {/* games an admin approved them for (Users & roles) */}
                    <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px", maxWidth: "190px", whiteSpace: "normal" }}>
                      {t.gg ? <span style={{ fontSize: "11px", fontWeight: "800", padding: "2px 7px", borderRadius: "6px", background: "rgba(240, 166, 255, .14)", color: C.pink }}>GAMER GIRL · all games</span> : null}
                      {!t.gg && t.games.map((g) => GAMES[g] ? <img key={g} src={GAMES[g].img} alt={GAMES[g].name} title={GAMES[g].name} width="22" height="22" style={{ width: "22px", height: "22px", borderRadius: "6px", flex: "0 0 auto" }} /> : null)}
                      {!t.gg && !t.games.length ? <span style={{ fontSize: "12.5px", color: C.gold }}>No games yet</span> : null}
                    </span>
                  </td>
                  <td style={td}><span style={{ fontWeight: "700", color: t.tierColor }}>{t.tier}</span> <span style={{ color: C.dim, fontSize: "12.5px" }}>· {t.deposit}%</span></td>
                  <td style={{ ...td, textAlign: "right" }}>{t.rating ? '★ ' + t.rating.toFixed(2) : '—'}</td>
                  <td style={{ ...td, textAlign: "right" }}>{t.lifetime.toLocaleString('en-US')}</td>
                  <td style={{ ...td, textAlign: "right", color: C.white, fontWeight: "600" }}>{usd(t.earned30)}</td>
                  <td style={{ ...td, textAlign: "right", color: t.held ? C.gold : C.faint }}>{t.held ? usd(t.held) : '—'}</td>
                  <td style={{ ...td, textAlign: "right" }} title="Every payout week not marked paid yet, incl. manual adjustments">
                    <span style={{ fontWeight: "700", color: t.owed < 0 ? C.red : t.owed ? C.white : C.faint }}>{t.owed ? (t.owed < 0 ? '−' + usd(-t.owed) : usd(t.owed)) : '—'}</span>
                    {t.adjusted ? <span style={{ display: "block", fontSize: "11.5px", color: t.adjusted < 0 ? C.red : C.green }}>{t.adjusted < 0 ? '−' + usd(-t.adjusted) : '+' + usd(t.adjusted)} adjusted</span> : null}
                  </td>
                  <td style={td}><span title={t.suspended ? 'Suspended by ' + t.suspended.by + (t.suspended.reason ? ': ' + t.suspended.reason : '') : undefined} style={pill(t.suspended ? 'Suspended' : t.status === 'offline' ? 'offline' : 'online')}>{t.suspended ? 'Suspended' : t.status === 'playing' ? 'Playing' : t.status === 'online' ? 'Online' : 'Offline'}</span></td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <span style={{ display: "inline-flex", gap: "6px" }}>
                    <button type="button" style={btn()} onClick={() => ask({
                      title: 'Adjust ' + t.name + '’s balance', body: 'Owed now: ' + usd(t.owed || 0) + '. A plus amount adds to what they’re paid (e.g. 10), a minus amount takes it off (e.g. -10). It goes into this week’s payout, and they see it with the reason on their dashboard.', confirm: 'Adjust balance',
                      field: { label: 'Amount in $ (+ or −)', type: 'number', signed: true, placeholder: '10 or -10', required: true, value: '' },
                      field2: { label: 'Reason (the teammate sees this)', placeholder: 'e.g. bonus for covering a late-night order', required: true },
                      onConfirm: (amount, reason) => actions.adjustBalance(t.id, 'teammate', Math.round(parseFloat(amount) * 100) / 100, reason)
                    })}>Adjust balance</button>
                    {t.suspended ? (
                      <button type="button" style={btn()} onClick={() => ask({ title: 'Reinstate ' + t.name + '?', body: 'They can go online and take orders again.', confirm: 'Reinstate', onConfirm: () => actions.toggleSuspend(t.id) })}>Reinstate</button>
                    ) : (
                      <button type="button" style={btn('danger')} onClick={() => ask({
                        title: 'Suspend ' + t.name + '?', body: 'They’re set offline right away and can’t go online or take orders until you reinstate them. Hold their payout on the Payouts page if needed.', confirm: 'Suspend', kind: 'danger',
                        field: { label: 'Reason (shown in the audit log)', placeholder: 'e.g. repeated toxic behaviour reports', required: true },
                        onConfirm: (reason) => actions.toggleSuspend(t.id, reason)
                      })}>Suspend</button>
                    )}
                    </span>
                  </td>
                </tr>
              ))}
              {!list.length ? <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: C.dim, padding: "36px 12px" }}>{data.teammates.length ? 'No teammates match.' : 'No teammates yet. Approve an application or make someone a teammate in Users & roles.'}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  renderApplications() {
    const { data, now, actions, ask } = this.props;
    const s = this.state;
    const list = data.applications.filter((a) => s.appFilter === 'All' || a.status === s.appFilter);
    return (
      <>
        <div role="group" aria-label="Filter applications" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {['Pending', 'Approved', 'Rejected', 'All'].map((f) => (
            <button key={f} type="button" aria-pressed={s.appFilter === f ? 'true' : 'false'} onClick={() => this.setState({ appFilter: f })} style={chip(s.appFilter === f)}>
              {f}<span style={{ opacity: ".65", fontWeight: "500" }}>{data.applications.filter((a) => f === 'All' || a.status === f).length}</span>
            </button>
          ))}
        </div>
        <div className="ops-cards" style={{ marginTop: "14px" }}>
          {list.map((a) => (
            <article key={a.id} style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "18px", borderRadius: "18px", background: C.bg, border: "1px solid " + (a.status === 'Pending' ? 'rgba(255, 210, 122, .25)' : C.line) }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img src={GAMES[a.game].img} alt={GAMES[a.game].name} width="44" height="44" style={{ width: "44px", height: "44px", borderRadius: "12px" }} />
                <div style={{ flex: "1", minWidth: "0", lineHeight: "1.3" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: DISPLAY, fontSize: "18px", fontWeight: "700", color: C.white }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: "13px", color: C.muted }}>{[a.rank, a.role, a.region, a.country].filter(Boolean).join(' · ')}</div>
                </div>
                <span style={pill(a.status)}>{a.status}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {a.services.map((x) => <span key={x} style={{ fontSize: "12px", fontWeight: "600", padding: "3px 9px", borderRadius: "8px", background: "rgba(214, 187, 255, .1)", color: C.accent }}>{x}</span>)}
                <span style={{ fontSize: "12px", fontWeight: "600", padding: "3px 9px", borderRadius: "8px", background: "rgba(158, 230, 255, .1)", color: C.cyan }}>{a.hours} h/week</span>
              </div>
              {a.why ? <p style={{ margin: "0", fontSize: "14px", color: "#CFC4EA", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>“{a.why}”</p> : null}
              {a.link ? <a href={/^https?:\/\//.test(a.link) ? a.link : 'https://' + a.link} target="_blank" rel="noreferrer nofollow" style={{ fontSize: "13px", color: C.accent, overflowWrap: "anywhere" }}>{a.link}</a> : null}
              <div style={{ fontSize: "12.5px", color: C.dim, lineHeight: "1.5" }}>
                {a.email} · Discord <b style={{ color: C.white, fontWeight: "600" }}>{a.discord}</b><br />Applied {ago(a.submittedAt, Date.now())}{a.decidedBy ? ' · ' + a.status.toLowerCase() + ' by ' + a.decidedBy : ''}{a.reason ? ': ' + a.reason : ''}
              </div>
              {a.status === 'Pending' ? (
                <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                  <button type="button" style={{ ...btn('good'), flex: "1" }} onClick={() => ask({ title: 'Approve ' + a.name + '?', body: 'The Duoly account with ' + a.email + ' becomes a Rookie teammate, approved for ' + GAMES[a.game].name + '. Let them know on Discord (' + a.discord + '). No account with that email yet? You’ll be told, and can make them a teammate once they sign up.', confirm: 'Approve', kind: 'good', onConfirm: () => actions.approveApp(a.id) })}>Approve</button>
                  <button type="button" style={{ ...btn('danger'), flex: "1" }} onClick={() => ask({
                    title: 'Reject ' + a.name + '?', body: 'Nothing is sent automatically: let them know on Discord (' + a.discord + ').', confirm: 'Reject', kind: 'danger',
                    field: { label: 'Reason', options: ['Rank too low', 'Couldn’t verify account', 'Region not needed right now', 'Incomplete application', 'Other'], value: 'Rank too low' },
                    onConfirm: (reason) => actions.rejectApp(a.id, reason)
                  })}>Reject</button>
                </div>
              ) : null}
            </article>
          ))}
          {!list.length ? <p style={{ margin: "0", color: C.dim }}>{data.applications.length ? 'No applications here.' : 'No applications yet. They show up here when someone applies on the “Become a teammate” page.'}</p> : null}
        </div>
      </>
    );
  }
  render() {
    const { data } = this.props;
    const s = this.state;
    const pending = data.applications.filter((a) => a.status === 'Pending').length;
    const tab = (id, label, n, hot) => (
      <button type="button" role="tab" aria-selected={s.tab === id ? 'true' : 'false'} onClick={() => this.setState({ tab: id })} style={{ ...chip(s.tab === id), minHeight: "40px", padding: "0 16px", fontSize: "14px" }}>
        {label}<span style={{ minWidth: "20px", height: "20px", padding: "0 6px", borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11.5px", background: hot ? 'rgba(255, 210, 122, .2)' : 'rgba(196, 170, 255, .14)', color: s.tab === id ? C.ink : hot ? C.gold : C.accent }}>{n}</span>
      </button>
    );
    return (
      <section style={{ ...card, padding: "18px" }}>
        <div role="tablist" aria-label="Teammates" style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          {tab('roster', 'Teammates', data.teammates.length)}
          {tab('apps', 'Applications', pending, pending > 0)}
        </div>
        {s.tab === 'roster' ? this.renderRoster() : this.renderApplications()}
      </section>
    );
  }
}
