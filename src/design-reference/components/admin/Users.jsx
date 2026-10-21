'use client';

import { previewFetch as fetch } from '../../../design-preview/preview-transport';


import React from 'react';
import { C, DISPLAY, card, h2, chip, input, btn, ago } from './ui';
import { GAMES } from '../../lib/games';

const REFRESH_MS = 15000;
const ROLE = {
  customer: { label: 'Customer', color: C.muted, bg: 'rgba(196, 170, 255, .1)', what: 'Books orders. Sees the customer dashboard.' },
  teammate: { label: 'Teammate', color: C.green, bg: 'rgba(94, 234, 168, .12)', what: 'Gets orders and plays them. Sees the teammate dashboard.' },
  admin: { label: 'Admin', color: C.red, bg: 'rgba(255, 138, 155, .14)', what: 'Runs Duoly: this admin dashboard and the live desk.' }
};
const VIA = { discord: 'Discord', google: 'Google', password: 'Email' };
const FILTERS = [['all', 'All'], ['customer', 'Customers'], ['teammate', 'Teammates'], ['admin', 'Admins']];

// Admin: who is a customer, teammate or admin. Roles are checked on the server for every page and API.
export default class Users extends React.Component {
  constructor(props) {
    super(props);
    // editing: the teammate whose order access is open; draft: { games, gg } being edited
    this.state = { accounts: [], loaded: false, error: '', q: '', filter: 'all', busy: '', editing: '', draft: null };
  }
  // ---- order access (which games a teammate may take, or Gamer Girl). Rules: lib/access.js
  editAccess(a) {
    const acc = a.access || { games: [], gg: false };
    this.setState({ editing: a.id, draft: { games: acc.games.slice(), gg: !!acc.gg } });
  }
  async saveAccess(a) {
    const d = this.state.draft;
    this.setState({ busy: a.id });
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: a.id, access: d }) });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) return this.props.toast(r.error || 'Couldn’t save their access.', 'warn');
      this.setState({ editing: '', draft: null, accounts: this.state.accounts.map((x) => (x.id === a.id ? { ...x, access: r.access } : x)) });
      const what = r.access.gg ? 'Gamer Girl (Gamer Girl orders, all games)' : r.access.games.length ? r.access.games.length + ' game' + (r.access.games.length === 1 ? '' : 's') : 'no games';
      this.props.log('Changed order access', a.name || a.email, what);
      this.props.toast((a.name || a.email) + ' now gets orders for ' + what.replace(/^Gamer Girl \(.*\)$/, 'Gamer Girl orders only'));
    } catch (e) {
      this.props.toast('Can’t reach Duoly right now.', 'warn');
    } finally {
      this.setState({ busy: '' });
    }
  }
  renderAccess(a) {
    const s = this.state;
    const acc = a.access || { games: [], gg: false };
    const open = s.editing === a.id;
    const d = open ? s.draft : null;
    const label = { fontSize: "12px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: C.faint };
    if (!open) {
      return (
        <div style={{ flex: "1 1 100%", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", paddingTop: "10px", borderTop: "1px solid " + C.line }}>
          <span style={label}>Order access</span>
          {acc.gg ? (
            <span style={{ fontSize: "12.5px", fontWeight: "700", padding: "3px 10px", borderRadius: "999px", background: "rgba(240, 166, 255, .14)", color: C.pink }}>Gamer Girl · only Gamer Girl orders, every game</span>
          ) : acc.games.length ? (
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4px" }} title={GAMES.filter((g) => acc.games.includes(g.id)).map((g) => g.name).join(', ')}>
              {GAMES.filter((g) => acc.games.includes(g.id)).map((g) => <img key={g.id} src={g.img} alt={g.name} width="22" height="22" style={{ width: "22px", height: "22px", borderRadius: "6px" }} />)}
            </span>
          ) : (
            <span style={{ fontSize: "12.5px", fontWeight: "600", color: C.gold }}>No games yet · gets no orders</span>
          )}
          <button type="button" onClick={() => this.editAccess(a)} style={{ ...btn(), minHeight: "32px", padding: "0 12px", fontSize: "13px", marginLeft: "auto" }}>Edit access</button>
        </div>
      );
    }
    // always from the latest draft, so quick clicks don't undo each other
    const edit = (fn) => this.setState((st) => ({ draft: { ...st.draft, ...fn(st.draft) } }));
    const toggle = (id) => edit((x) => ({ games: x.games.includes(id) ? x.games.filter((g) => g !== id) : x.games.concat(id) }));
    return (
      <div style={{ flex: "1 1 100%", paddingTop: "12px", borderTop: "1px solid " + C.line }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "14px", background: d.gg ? "rgba(240, 166, 255, .08)" : C.panel, border: "1px solid " + (d.gg ? "rgba(240, 166, 255, .3)" : C.line2) }}>
          <span style={{ flex: "1", minWidth: "0", lineHeight: "1.4" }}>
            <span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: C.white }}>Gamer Girl</span>
            <span style={{ display: "block", fontSize: "12.5px", color: C.dim }}>Sees only Gamer Girl orders, for every game, and nothing else. Internal: customers never see this.</span>
          </span>
          <button type="button" role="switch" aria-checked={d.gg ? 'true' : 'false'} aria-label="Gamer Girl" onClick={() => edit((x) => ({ gg: !x.gg }))}
            style={{ position: "relative", flex: "0 0 auto", width: "44px", height: "26px", borderRadius: "999px", border: "none", padding: "0", transform: "none", background: d.gg ? C.pink : "#2A1F45", transition: "background-color .2s" }}>
            <span style={{ position: "absolute", top: "4px", left: d.gg ? "22px" : "4px", width: "18px", height: "18px", borderRadius: "50%", background: d.gg ? C.ink : C.dim, transition: "left .2s" }} />
          </button>
        </div>

        {d.gg ? null : (
          <>
            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={label}>Games they can take</span>
              <span style={{ fontSize: "12.5px", color: C.dim }}>{d.games.length} of {GAMES.length}</span>
              <button type="button" onClick={() => edit(() => ({ games: GAMES.map((g) => g.id) }))} style={{ ...btn(), minHeight: "28px", padding: "0 10px", fontSize: "12px", marginLeft: "auto" }}>All</button>
              <button type="button" onClick={() => edit(() => ({ games: [] }))} style={{ ...btn(), minHeight: "28px", padding: "0 10px", fontSize: "12px" }}>None</button>
            </div>
            <div role="group" aria-label={'Games for ' + (a.name || a.email)} style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "6px" }}>
              {GAMES.map((g) => {
                const on = d.games.includes(g.id);
                return (
                  <button key={g.id} type="button" aria-pressed={on ? 'true' : 'false'} onClick={() => toggle(g.id)} title={g.name}
                    style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "40px", padding: "4px 10px 4px 4px", borderRadius: "12px", fontSize: "13px", fontWeight: "600", textAlign: "left", transform: "none", minWidth: "0",
                      background: on ? C.raised : "transparent", border: "1px solid " + (on ? C.accent : C.line2), color: on ? C.white : C.dim }}>
                    <img src={g.img} alt="" width="30" height="30" style={{ width: "30px", height: "30px", borderRadius: "8px", flex: "0 0 auto", filter: on ? "none" : "grayscale(1) brightness(.6)" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.short}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          <span style={{ flex: "1 1 200px", fontSize: "12.5px", color: C.dim }}>
            {d.gg ? 'Gamer Girl orders of every game, no regular orders.' : d.games.length ? 'Regular orders for these games. Gamer Girl orders stay with Gamer Girls.' : 'With no games they won’t get any orders.'} Applies within a few seconds.
          </span>
          <button type="button" onClick={() => this.setState({ editing: '', draft: null })} disabled={s.busy === a.id} style={btn()}>Cancel</button>
          <button type="button" onClick={() => this.saveAccess(a)} disabled={s.busy === a.id} style={btn('primary')}>{s.busy === a.id ? 'Saving…' : 'Save access'}</button>
        </div>
      </div>
    );
  }
  componentDidMount() {
    this.load();
    this._t = setInterval(() => this.load(), REFRESH_MS);
  }
  componentWillUnmount() {
    clearInterval(this._t);
  }
  async load() {
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) return this.setState({ error: d.error || 'Couldn’t load accounts.', loaded: true });
      this.setState({ accounts: d.accounts || [], error: '', loaded: true });
    } catch (e) {
      this.setState({ error: 'Can’t reach Duoly right now. Retrying…', loaded: true });
    }
  }
  change(a, role) {
    if (a.role === role) return;
    const name = a.name || a.email;
    const lines = {
      teammate: name + ' gets the teammate dashboard (priority starts at 50). They only get orders once you unlock games for them, or make them a Gamer Girl, under Order access.',
      admin: name + ' gets full access to this admin dashboard, including changing roles. Only do this for people you trust.',
      customer: name + ' goes back to being a customer.' + (a.role === 'teammate' ? ' They’re taken off the order desk right away.' : '') + (a.role === 'admin' ? ' They lose admin access immediately.' : '')
    };
    this.props.ask({
      title: 'Make ' + name + ' ' + (role === 'admin' ? 'an admin' : 'a ' + ROLE[role].label.toLowerCase()) + '?',
      body: lines[role],
      confirm: 'Make ' + ROLE[role].label.toLowerCase(),
      kind: role === 'admin' ? 'danger' : 'primary',
      onConfirm: () => this.save(a, role)
    });
  }
  async save(a, role) {
    this.setState({ busy: a.id });
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: a.id, role }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return this.props.toast(d.error || 'Couldn’t change the role.', 'warn');
      this.setState({ accounts: this.state.accounts.map((x) => (x.id === a.id ? { ...x, role, roleBy: d.account.roleBy, roleAt: d.account.roleAt } : x)) });
      this.props.log('Changed role', a.name || a.email, ROLE[a.role].label + ' → ' + ROLE[role].label);
      this.props.toast((a.name || a.email) + ' is now ' + (role === 'admin' ? 'an admin' : 'a ' + ROLE[role].label.toLowerCase()));
    } catch (e) {
      this.props.toast('Can’t reach Duoly right now.', 'warn');
    } finally {
      this.setState({ busy: '' });
    }
  }

  render() {
    const s = this.state;
    const now = Date.now();
    const q = s.q.trim().toLowerCase();
    const count = (r) => s.accounts.filter((a) => r === 'all' || a.role === r).length;
    const order = { admin: 0, teammate: 1, customer: 2 };
    const list = s.accounts
      .filter((a) => (s.filter === 'all' || a.role === s.filter) && (!q || [a.name, a.email].some((x) => String(x || '').toLowerCase().includes(q))))
      .sort((a, b) => (order[a.role] - order[b.role]) || ((b.lastSeen || 0) - (a.lastSeen || 0)) || String(a.name).localeCompare(String(b.name)));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <section aria-label="Roles" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {['customer', 'teammate', 'admin'].map((r) => (
            <div key={r} style={{ ...card, padding: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <span style={{ fontSize: "12px", fontWeight: "800", letterSpacing: ".08em", textTransform: "uppercase", color: ROLE[r].color }}>{ROLE[r].label}s</span>
                <span style={{ fontFamily: DISPLAY, fontSize: "26px", fontWeight: "800", color: C.white }}>{count(r)}</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "13px", lineHeight: "1.5", color: C.dim }}>{ROLE[r].what}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="us-h" style={{ ...card, padding: "18px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "10px" }}>
            <div style={{ minWidth: "0", flex: "1 1 320px" }}>
              <h2 id="us-h" style={h2}>Accounts</h2>
              <p style={{ margin: "4px 0 0", fontSize: "13.5px", color: C.dim }}>
                Everyone who signed up or logged in. New accounts are customers. Owners (ADMIN_EMAILS) are always admins and can’t be changed here.
              </p>
            </div>
            <input type="search" aria-label="Search accounts" placeholder="Search name or email…" value={s.q} onChange={(e) => this.setState({ q: e.target.value })} style={{ ...input, flex: "0 1 260px" }} />
          </div>
          <div role="group" aria-label="Filter" style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={s.filter === id ? 'true' : 'false'} onClick={() => this.setState({ filter: id })} style={chip(s.filter === id)}>
                {label}<span style={{ opacity: ".65", fontWeight: "500" }}>{count(id)}</span>
              </button>
            ))}
          </div>
          {s.error ? <p role="status" style={{ margin: "12px 0 0", fontSize: "13.5px", color: C.pink }}>{s.error}</p> : null}

          <ul style={{ listStyle: "none", margin: "14px 0 0", padding: "0", display: "flex", flexDirection: "column", gap: "8px" }}>
            {list.map((a) => {
              const locked = a.owner || a.you;
              return (
                <li key={a.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px", padding: "12px 14px", borderRadius: "16px", background: C.bg, border: "1px solid " + C.line }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 260px", minWidth: "0" }}>
                    <span style={{ position: "relative", width: "40px", height: "40px", flex: "0 0 auto" }}>
                      <img src={a.image || '/assets/avatars/avatar-1.png'} alt="" width="40" height="40" referrerPolicy="no-referrer" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} />
                      {a.online ? <span title="On the order desk now" style={{ position: "absolute", right: "-1px", bottom: "-1px", width: "11px", height: "11px", borderRadius: "50%", background: C.green, boxShadow: "0 0 0 2.5px " + C.bg }} /> : null}
                    </span>
                    <span style={{ minWidth: "0", lineHeight: "1.35" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", color: C.white }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || a.email || 'Unnamed account'}</span>
                        {a.you ? <span style={{ flex: "0 0 auto", fontSize: "10.5px", fontWeight: "800", padding: "1px 6px", borderRadius: "6px", background: "rgba(214, 187, 255, .14)", color: C.accent }}>YOU</span> : null}
                        {a.owner ? <span title="Set in ADMIN_EMAILS on the server" style={{ flex: "0 0 auto", fontSize: "10.5px", fontWeight: "800", padding: "1px 6px", borderRadius: "6px", background: "rgba(255, 210, 122, .14)", color: C.gold }}>OWNER</span> : null}
                      </span>
                      <span style={{ display: "block", fontSize: "12px", color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.email || 'no email'} · {VIA[a.provider] || 'Email'}{a.lastSeen ? ' · seen ' + ago(a.lastSeen, now) : ' · never logged in'}
                        {a.roleBy && !a.owner ? ' · set by ' + a.roleBy : ''}
                      </span>
                    </span>
                  </span>
                  <span role="radiogroup" aria-label={'Role for ' + (a.name || a.email)} title={a.owner ? 'Owners are set in ADMIN_EMAILS' : a.you ? 'You can’t change your own role' : ''} style={{ display: "inline-flex", gap: "2px", padding: "3px", borderRadius: "12px", background: C.panel, border: "1px solid " + C.line2, opacity: locked ? ".55" : "1", flex: "0 0 auto" }}>
                    {['customer', 'teammate', 'admin'].map((r) => {
                      const on = a.role === r;
                      return (
                        <button key={r} type="button" role="radio" aria-checked={on ? 'true' : 'false'} disabled={locked || s.busy === a.id} onClick={() => this.change(a, r)} style={{ minHeight: "34px", padding: "0 12px", borderRadius: "9px", border: "none", fontSize: "13px", fontWeight: "700", cursor: locked ? "not-allowed" : "pointer", transform: "none", background: on ? ROLE[r].bg : "transparent", color: on ? ROLE[r].color : C.dim }}>
                          {ROLE[r].label}
                        </button>
                      );
                    })}
                  </span>
                  {a.role === 'teammate' ? this.renderAccess(a) : null}
                </li>
              );
            })}
            {s.loaded && !list.length ? <li style={{ color: C.dim, fontSize: "14px" }}>{q || s.filter !== 'all' ? 'No accounts match.' : 'No accounts yet.'}</li> : null}
          </ul>
        </section>
      </div>
    );
  }
}
