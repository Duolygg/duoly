'use client';

import { previewFetch as fetch } from '../../../design-preview/preview-transport';


import React from 'react';
import { GAMES } from '../../lib/adminData';
import Teammate from '../Teammate';
import { C, card, h2, chip, btn, ago } from './ui';
import { signed } from '../../lib/prioTiers';

const IDLE_MIN = 15; // minutes without activity before someone waiting counts as idle / possibly AFK
const REFRESH_MS = 4000;

const since = (ts, now) => {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
};

// Live desk: the shared order queue (same panel teammates use, admin is always online) and
// everyone who's online right now, straight from the server.
export default class LiveDesk extends React.Component {
  constructor(props) {
    super(props);
    this.state = { filter: 'All', online: [], loaded: false, error: '', now: props.now };
  }
  componentDidMount() {
    this.refresh();
    this._t = setInterval(() => this.refresh(), REFRESH_MS);
  }
  componentWillUnmount() {
    clearInterval(this._t);
  }
  async refresh() {
    try {
      const res = await fetch('/api/admin/presence', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) return this.setState({ error: d.error || 'Couldn’t load who’s online.', loaded: true });
      this.setState({ online: d.online || [], now: d.now || Date.now(), error: '', loaded: true });
      if (this.props.onOnline) this.props.onOnline(d.online || []);
    } catch (e) {
      this.setState({ error: 'Can’t reach Duoly right now. Retrying…', loaded: true });
    }
  }
  setOffline(p, reason) {
    fetch('/api/admin/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: p.id, reason }) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) return this.props.toast(d.error || 'Couldn’t set them offline.', 'warn');
        this.props.log('Set teammate offline', p.name, reason);
        this.props.toast(p.name + ' set offline · their dashboard switches off within a few seconds');
        this.refresh();
      })
      .catch(() => this.props.toast('Can’t reach Duoly right now.', 'warn'));
  }
  render() {
    const { ask, go, admin, desk, visible } = this.props;
    const now = this.state.now;
    const people = this.state.online.map((p) => {
      const idle = !p.admin && !p.order && now - (p.lastActive || now) > IDLE_MIN * 60000;
      return { ...p, state: p.order ? 'game' : idle ? 'idle' : 'waiting' };
    }).sort((a, b) => ({ idle: 0, waiting: 1, game: 2 }[a.state] - { idle: 0, waiting: 1, game: 2 }[b.state]) || ((a.admin ? 1 : 0) - (b.admin ? 1 : 0)) || (a.lastActive - b.lastActive));
    const teammates = people.filter((p) => !p.admin);
    const counts = {
      All: people.length,
      Waiting: teammates.filter((p) => p.state === 'waiting').length,
      'In a game': people.filter((p) => p.state === 'game').length,
      Idle: teammates.filter((p) => p.state === 'idle').length
    };
    const f = this.state.filter;
    const shown = people.filter((p) => f === 'All' || (f === 'Waiting' && p.state === 'waiting' && !p.admin) || (f === 'In a game' && p.state === 'game') || (f === 'Idle' && p.state === 'idle'));
    const stateLabel = { waiting: 'Waiting for orders', game: 'In a game', idle: 'AFK?' };
    const stateColor = { waiting: C.green, game: C.cyan, idle: C.pink };

    return (
      <div style={{ display: visible ? "flex" : "none", flexDirection: "column", gap: "20px" }}>
        <section aria-labelledby="ld-desk-h">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "8px", marginBottom: "10px" }}>
            <h2 id="ld-desk-h" style={{ ...h2, fontSize: "22px" }}>Order desk</h2>
            <span style={{ fontSize: "13px", color: C.dim }}>Every order as it comes in, newest first. Teammates see each one after their priority delay</span>
          </div>
          <Teammate admin user={{ id: admin.id, name: admin.name, email: admin.email, image: admin.image }} onAccept={desk.onAccept} onComplete={desk.onComplete} onHandover={desk.onHandover} onQueue={desk.onQueue} />
        </section>

        <section aria-labelledby="ld-online-h" style={{ ...card, padding: "18px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <div>
              <h2 id="ld-online-h" style={h2}>Online right now</h2>
              <p style={{ margin: "2px 0 0", fontSize: "13.5px", color: C.dim }}>Everyone with a teammate dashboard or the admin desk open. Idle = waiting with no activity for {IDLE_MIN}+ minutes.</p>
            </div>
            <div role="group" aria-label="Filter" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {Object.keys(counts).map((k) => (
                <button key={k} type="button" aria-pressed={f === k ? 'true' : 'false'} onClick={() => this.setState({ filter: k })} style={chip(f === k)}>
                  {k === 'Idle' ? <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: C.pink }} /> : null}
                  {k}<span style={{ opacity: ".65", fontWeight: "500" }}>{counts[k]}</span>
                </button>
              ))}
            </div>
          </div>
          {this.state.error ? <p role="status" style={{ margin: "12px 0 0", fontSize: "13.5px", color: C.pink }}>{this.state.error}</p> : null}

          <ul className="ad-cards" style={{ listStyle: "none", margin: "14px 0 0", padding: "0", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" }}>
            {shown.map((p) => (
              <li key={p.id} style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px", borderRadius: "16px", background: C.bg, border: "1px solid " + (p.state === 'idle' ? 'rgba(240, 166, 255, .35)' : C.line) }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
                  <span style={{ position: "relative", width: "40px", height: "40px", flex: "0 0 auto" }}>
                    <img src={p.image || '/assets/avatars/avatar-1.png'} alt="" width="40" height="40" referrerPolicy="no-referrer" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", opacity: p.state === 'idle' ? ".6" : "1" }} />
                    <span style={{ position: "absolute", right: "-1px", bottom: "-1px", width: "12px", height: "12px", borderRadius: "50%", background: stateColor[p.state] }} />
                  </span>
                  <span style={{ flex: "1", minWidth: "0", lineHeight: "1.3" }}>
                    <span style={{ display: "block", fontWeight: "600", color: C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", marginTop: "3px" }}>
                      {p.admin ? <span style={{ fontSize: "10.5px", fontWeight: "800", padding: "1px 6px", borderRadius: "6px", background: "rgba(255, 138, 155, .14)", color: C.red }}>ADMIN</span> : null}
                      <span title={'Priority: seconds before new orders show up for them' + (p.adj || p.penalty ? ' (base ' + p.basePrio + ' s' + (p.adj ? ', ' + signed(p.adj.points) + ' ' + (p.adj.points > 0 ? 'buff' : 'nerf') : '') + (p.penalty ? ', −' + p.penalty + ' missed orders' : '') + ')' : '')} style={{ fontSize: "10.5px", fontWeight: "800", padding: "1px 6px", borderRadius: "6px", background: "rgba(214, 187, 255, .12)", color: C.accent }}>PRIO {p.prio}</span>
                      {p.adj ? <span title={p.adj.reason || 'Set on the Priority page'} style={{ fontSize: "10.5px", fontWeight: "800", padding: "1px 6px", borderRadius: "6px", background: p.adj.points > 0 ? "rgba(94, 234, 168, .12)" : "rgba(240, 166, 255, .14)", color: p.adj.points > 0 ? C.green : C.pink }}>{signed(p.adj.points)}</span> : null}
                      {p.missed ? <span title={'Let ' + p.missed + (p.missed === 1 ? ' order' : ' orders') + ' time out while online in the last 7 days'} style={{ fontSize: "10.5px", fontWeight: "800", padding: "1px 6px", borderRadius: "6px", background: "rgba(255, 138, 155, .14)", color: C.red }}>{p.missed} MISSED</span> : null}
                    </span>
                  </span>
                  <span style={{ flex: "0 0 auto", alignSelf: "flex-start", whiteSpace: "nowrap", fontSize: "11.5px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", background: stateColor[p.state] + '1f', color: stateColor[p.state] }}>
                    {p.admin && p.state !== 'game' ? 'Always on' : stateLabel[p.state]}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                  {(p.games || []).map((g) => GAMES[g] ? <img key={g} src={GAMES[g].img} alt={GAMES[g].name} title={GAMES[g].name} width="22" height="22" style={{ width: "22px", height: "22px", flex: "0 0 auto", borderRadius: "6px" }} /> : null)}
                  {!(p.games || []).length ? <span style={{ fontSize: "12px", color: C.dim }}>{p.admin ? 'All games' : 'No games on'}</span> : null}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: "12.5px", color: C.muted }}>
                  <span>Online {p.since ? since(p.since, now) : '—'}</span>
                  <span style={{ color: p.state === 'idle' ? C.pink : C.muted, fontWeight: p.state === 'idle' ? "700" : "400" }}>
                    {p.state === 'idle' ? 'No activity for ' + since(p.lastActive, now) : 'Active ' + ago(p.lastActive || now, now)}
                  </span>
                  {p.order ? <span style={{ color: C.cyan, fontWeight: "600" }}>{p.order.id} · playing {p.order.games} {(p.order.unit || 'game') + (p.order.games === 1 ? '' : 's')}</span> : null}
                </div>
                {p.admin ? (
                  <span style={{ fontSize: "12.5px", color: C.faint }}>Admins can’t go offline.</span>
                ) : p.order ? (
                  <span style={{ fontSize: "12.5px", color: C.faint }}>Playing an order. It has to be finished before they can go offline.</span>
                ) : (
                  <button type="button" style={{ ...btn(p.state === 'idle' ? 'danger' : undefined), alignSelf: "flex-start" }} onClick={() => ask({
                    title: 'Set ' + p.name + ' offline?', body: 'Their dashboard switches off within a few seconds and shows that an admin set them offline. They can go online again when they’re back.',
                    confirm: 'Set offline', kind: 'danger',
                    field: { label: 'Reason', options: ['AFK / dashboard left open', 'Not answering orders', 'Asked to be set offline', 'Other'], value: p.state === 'idle' ? 'AFK / dashboard left open' : 'Not answering orders' },
                    onConfirm: (reason) => this.setOffline(p, reason)
                  })}>Set offline</button>
                )}
              </li>
            ))}
            {this.state.loaded && !shown.length ? (
              <li style={{ color: C.dim, fontSize: "14px" }}>
                {f === 'Idle' ? 'Nobody idle. Everyone online is active.' : f === 'All' ? 'Nobody else is online right now. Teammates appear here as soon as they go online on their dashboard.' : 'Nobody here right now.'}
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    );
  }
}
