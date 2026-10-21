'use client';

import { previewFetch as fetch } from '../../../design-preview/preview-transport';


import React from 'react';
import { signOut } from '../../../design-preview/preview-auth';
import { C, DISPLAY, btn, input, eur } from './ui';
import Overview from './Overview';
import Orders from './Orders';
import Teammates from './Teammates';
import Customers from './Customers';
import Payouts from './Payouts';
import Safety from './Safety';
import Settings from './Settings';
import AuditLog from './AuditLog';
import LiveDesk from './LiveDesk';
import Priority from './Priority';
import Users from './Users';
import Support from './Support';
import { newChatPing, playChatPing } from '../../lib/sounds';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-18v6h8V3h-8z' },
  { id: 'live', label: 'Live desk', icon: 'M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z' },
  { id: 'priority', label: 'Priority', icon: 'M3 6h11M3 12h7M3 18h4M17 4v16M17 20l-3-3M17 20l3-3' },
  { id: 'users', label: 'Users & roles', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 11l2 2 4-4' },
  { id: 'orders', label: 'Orders', icon: 'M6 2l-2 4v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4H6zM4 6h16M16 10a4 4 0 0 1-8 0' },
  { id: 'teammates', label: 'Teammates', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' },
  { id: 'customers', label: 'Customers', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { id: 'payouts', label: 'Payouts', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { id: 'support', label: 'Support chat', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5' },
  { id: 'safety', label: 'Reports & safety', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01' },
  { id: 'audit', label: 'Audit log', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M8 13h8M8 17h5' },
  { id: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' }
];
// sidebar groups (every section is in exactly one)
const GROUPS = [
  { label: 'Live', ids: ['overview', 'live', 'priority'] },
  { label: 'Business', ids: ['orders', 'payouts', 'customers', 'teammates'] },
  { label: 'People & safety', ids: ['support', 'users', 'safety'] },
  { label: 'System', ids: ['audit', 'settings'] }
];
const TITLES = {
  overview: ['Overview', 'How Duoly is doing right now'],
  live: ['Live desk', 'Watch every order in the shared queue and hand them to teammates. Admins don’t play and are always online here.'],
  priority: ['Priority', 'Who sees new orders first. Admins only: teammates never see their own score.'],
  users: ['Users & roles', 'Who’s a customer, a teammate or an admin. Changes apply right away.'],
  orders: ['Orders', 'Every order, its money trail and what happened'],
  teammates: ['Teammates', 'Your contractors and new applications'],
  customers: ['Customers', 'Who’s booking, their level and wallet'],
  payouts: ['Payouts', 'What each teammate is owed, week by week (USD)'],
  support: ['Support chat', 'Everyone who wrote to Sparky. Reply to the ones waiting for a human.'],
  safety: ['Reports & safety', 'Customer reports and chat messages the safety filter stopped'],
  audit: ['Audit log', 'Every action taken in this admin, newest first'],
  settings: ['Settings', 'The rules the platform runs on']
};

export default class AdminApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = { data: null, section: 'overview', focusOrder: null, focusChat: null, toasts: [], confirm: null, confirmValue: '', confirmValue2: '', audit: [] };
  }
  componentDidMount() {
    // Everything is real and comes from the server (loadStats); empty until the first answer.
    const data = { orders: [], daily: [], payouts: [], teammates: [], customers: [], applications: [], flags: [], disputes: [], reportsOpen: 0, live: { queue: 0, avgWait: 0, online: 0 } };
    this.desk = { onAccept: this.deskAccept, onComplete: this.deskComplete, onHandover: this.deskHandover, onQueue: this.deskQueue };
    this.setState({ data, section: this.sectionFromHash() });
    this._hash = () => this.setState({ section: this.sectionFromHash() });
    window.addEventListener('hashchange', this._hash);
    this.loadStats();
    this.loadAudit();
    this._stats = setInterval(this.loadStats, 30000);
    // support chats are watched on every admin page: sound + browser notification when someone needs a human
    this.ping = newChatPing();
    this.watchSupport();
    this._support = setInterval(this.watchSupport, 5000);
  }
  componentWillUnmount() {
    window.removeEventListener('hashchange', this._hash);
    clearInterval(this._stats);
    clearInterval(this._support);
    (this._toastTimers || []).forEach(clearTimeout);
  }
  sectionFromHash() {
    const h = (window.location.hash || '').replace('#', '');
    return SECTIONS.some((s) => s.id === h) ? h : 'overview';
  }
  go = (section, extra) => {
    if (window.location.hash !== '#' + section) window.history.replaceState(null, '', '#' + section);
    this.setState({ section, focusOrder: extra && extra.order ? extra.order : null, focusChat: extra && extra.chat ? extra.chat : null });
    window.scrollTo(0, 0);
  };

  // ---- support chats: someone new waiting for a human, or a new message in a chat that needs a reply
  watchSupport = async () => {
    try {
      const r = await fetch('/api/admin/support', { cache: 'no-store' });
      if (!r.ok) return;
      const list = (await r.json()).conversations || [];
      const needs = list.filter((c) => c.status === 'waiting' || (c.status === 'open' && c.unread > 0));
      const keys = new Set(needs.map((c) => c.id + ':' + c.count));
      if (this._supportKeys) {
        const fresh = needs.filter((c) => !this._supportKeys.has(c.id + ':' + c.count));
        if (fresh.length) this.alertSupport(fresh[0], fresh.length);
      }
      this._supportKeys = keys;
      if (this.state.data && this.state.data.supportWaiting !== needs.length) this.update('supportWaiting', () => needs.length);
    } catch (e) {}
  };
  alertSupport(c, n) {
    playChatPing(this.ping);
    // the browser notification: when this tab is in the background or you're on another admin page
    const looking = !document.hidden && this.state.section === 'support';
    if (looking || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const who = c.role === 'guest' ? 'A guest' : c.name + (c.role === 'teammate' ? ' (teammate)' : '');
      const note = new Notification(c.status === 'waiting' && c.count <= 6 ? who + ' needs help' : 'New message from ' + (c.role === 'guest' ? 'a guest' : c.name), {
        body: (c.lastUserText ? '“' + c.lastUserText.slice(0, 140) + '”' : 'Open the support chat to reply.') + (n > 1 ? '  (+' + (n - 1) + ' more)' : ''),
        icon: '/assets/brand/logo-mascots.webp', tag: 'duoly-support-' + c.id, renotify: true
      });
      note.onclick = () => { window.focus(); this.go('support', { chat: c.id }); note.close(); };
    } catch (e) {}
  }

  // ---- feedback
  toast = (text, kind) => {
    const id = Date.now() + Math.random();
    this.setState((s) => ({ toasts: s.toasts.concat([{ id, text, kind: kind || 'ok' }]) }));
    this._toastTimers = (this._toastTimers || []).concat([setTimeout(() => this.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200)]);
  };
  // Audit log: shown right away and saved on the server (who and when are set there).
  log = (action, target, detail) => {
    const a = this.props.admin || {};
    this.setState((s) => ({ audit: [{ id: Date.now() + Math.random(), at: Date.now(), who: a.name || a.email, action, target, detail: detail || '' }].concat(s.audit) }));
    fetch('/api/admin/audit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, target, detail: detail || '' }) }).catch(() => {});
  };
  loadAudit = async () => {
    try {
      const r = await fetch('/api/admin/audit', { cache: 'no-store' });
      if (r.ok) this.setState({ audit: (await r.json()).audit || [] });
    } catch (e) {}
  };
  // Confirmation dialog. opts: { title, body, confirm, kind, field: { label, placeholder, type }, field2, onConfirm(value, value2) }
  ask = (opts) => this.setState({ confirm: opts, confirmError: '', confirmValue: (opts.field && opts.field.value) || '', confirmValue2: (opts.field2 && opts.field2.value) || '' });
  closeAsk = () => this.setState({ confirm: null });
  submitAsk = (e) => {
    if (e) e.preventDefault();
    const c = this.state.confirm;
    if (!c) return;
    const v1 = this.state.confirmValue.trim(), v2 = this.state.confirmValue2.trim();
    // signed amounts (balance adjustments) can be + or −, but not 0
    if (c.field && c.field.signed && (!parseFloat(v1) || Math.abs(parseFloat(v1)) > 1000)) return this.setState({ confirmError: 'Enter an amount like 10 or -10 (up to 1000).' });
    if (c.field && c.field.type === 'number' && !c.field.signed && !(parseFloat(v1) > 0)) return this.setState({ confirmError: 'Enter an amount above 0.' });
    if (c.field && c.field.type === 'number' && !c.field.signed && parseFloat(v1) > 500) return this.setState({ confirmError: 'That’s more than €500. Split it up or check the amount.' });
    if (c.field2 && c.field2.required && !v2) return this.setState({ confirmError: 'Please add a reason. It goes into the audit log.' });
    if (c.field && c.field.required && !v1) return this.setState({ confirmError: 'Please fill this in. It goes into the audit log.' });
    this.setState({ confirm: null, confirmError: '' });
    c.onConfirm(v1, v2);
  };

  // ---- data changes: every action goes to the server (which re-checks admin rights), then the list updates
  update = (key, fn) => this.setState((s) => ({ data: { ...s.data, [key]: fn(s.data[key]) } }));

  // Real orders (orders.json) and payouts (the teammate ledger) from the server.
  loadStats = async () => {
    try {
      const r = await fetch('/api/admin/stats', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      this.setState((s) => ({ statsLoaded: true, data: s.data ? {
        ...s.data, orders: j.orders, daily: j.daily, payouts: j.payouts, live: { ...s.data.live, ...j.live },
        teammates: j.teammates, customers: j.customers, applications: j.applications, flags: j.flags, reportsOpen: j.reportsOpen, supportWaiting: j.supportWaiting
      } : s.data }));
    } catch (e) { /* keep what's on screen; the next poll tries again */ }
  };
  // POST to an admin API; shows the error as a toast and returns null when it fails
  call = async (url, body) => {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { this.toast(j.error || 'That didn’t work. Try again.', 'warn'); return null; }
      return j;
    } catch (e) {
      this.toast('Couldn’t reach the server. Try again.', 'warn');
      return null;
    }
  };
  replace = (key, item) => this.update(key, (list) => list.map((x) => (x.id === item.id ? item : x)));
  payoutCall = async (body) => {
    try {
      const r = await fetch('/api/admin/payouts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { this.toast(j.error || 'That didn’t work. Try again.', 'warn'); return null; }
      this.update('payouts', () => j.payouts);
      return j;
    } catch (e) {
      this.toast('Couldn’t reach the server. Try again.', 'warn');
      return null;
    }
  };

  // Order desk events (the desk talks to the shared queue on the server; these keep the audit log)
  deskAccept = (o) => {
    this.log('Took order', o.id, o.customer + ' · ' + o.title + (o.games > 1 ? ' ×' + o.games : ''));
    this.toast('You took ' + o.id + ' for ' + o.customer);
  };
  deskComplete = (o) => {
    this.log('Completed order', o.id, o.games + ' ' + (o.unit || 'game') + (o.games === 1 ? '' : 's') + ' · proof uploaded');
    this.toast('Order ' + o.id + ' completed');
  };
  deskHandover = (o, url) => {
    this.log('Created handover link', o.id, o.customer + ' · ' + o.title);
    this.toast('Handover link for ' + o.id + ' copied. Send it to a teammate.');
  };
  deskQueue = (n) => {
    if (n !== this.state.liveQueue) this.setState({ liveQueue: n });
  };
  actions = {
    // Orders: the money goes back to the customer's Duoly wallet (no payment provider yet)
    refundOrder: async (id, reason) => {
      const o = this.state.data.orders.find((x) => x.id === id);
      const j = await this.call('/api/admin/orders', { id, action: 'refund', reason });
      if (!j) return;
      this.replace('orders', { ...o, ...j.order });
      this.log('Refunded order', id, (o ? eur(o.amount) + ' · ' : '') + reason);
      this.toast('Order ' + id + ' refunded' + (o ? ' · ' + eur(o.amount) + ' back to ' + o.customer + '’s wallet' : ''));
      this.loadStats();
    },
    cancelOrder: async (id, reason) => {
      const o = this.state.data.orders.find((x) => x.id === id);
      const j = await this.call('/api/admin/orders', { id, action: 'cancel', reason });
      if (!j) return;
      this.replace('orders', { ...o, ...j.order });
      this.log('Cancelled order', id, reason);
      this.toast('Order ' + id + ' cancelled · ' + (o ? eur(o.amount) + ' back to ' + o.customer + '’s wallet' : 'refunded'));
      this.loadStats();
    },
    // Chat messages the safety filter stopped
    reviewFlag: async (id, status) => {
      const f = this.state.data.flags.find((x) => x.id === id);
      const j = await this.call('/api/admin/flags', { id, status });
      if (!j) return;
      this.replace('flags', j.flag);
      this.log(status === 'Warned' ? 'Warned user' : 'Dismissed flag', id, f ? f.who + ' · “' + f.text.slice(0, 60) + '”' : '');
      this.toast(status === 'Warned' ? 'Warning recorded for ' + (f ? f.who : 'them') : 'Flag ' + id + ' dismissed');
    },
    // Teammate applications
    approveApp: async (id) => {
      const a = this.state.data.applications.find((x) => x.id === id);
      const j = await this.call('/api/admin/applications', { id, decision: 'approve' });
      if (!j) return;
      this.replace('applications', j.application);
      this.log('Approved application', id, a ? a.name + ' · ' + a.email : '');
      const msg = { teammate: ' is now a Rookie teammate', 'no-account': ' approved. They have no Duoly account yet: once they sign up with ' + (a && a.email) + ', make them a teammate in Users & roles', teammate_: '' };
      this.toast((a ? a.name : 'Applicant') + (msg[j.result] || ' approved (already a ' + j.result + ')'));
      this.loadStats();
    },
    rejectApp: async (id, reason) => {
      const a = this.state.data.applications.find((x) => x.id === id);
      const j = await this.call('/api/admin/applications', { id, decision: 'reject', reason });
      if (!j) return;
      this.replace('applications', j.application);
      this.log('Rejected application', id, (a ? a.name + ' · ' : '') + reason);
      this.toast((a ? a.name : 'Application') + ' rejected');
    },
    // Accounts
    toggleSuspend: async (id, reason) => {
      const t = this.state.data.teammates.find((x) => x.id === id);
      const on = !(t && t.suspended);
      const j = await this.call('/api/admin/people', { userId: id, action: on ? 'suspend' : 'unsuspend', reason });
      if (!j) return;
      this.replace('teammates', j.account);
      this.log(on ? 'Suspended teammate' : 'Reinstated teammate', t ? t.name : id, reason || '');
      this.toast((t ? t.name : 'Teammate') + (on ? ' suspended · set offline, can’t take orders' : ' reinstated'));
    },
    // + or − on a customer's wallet (EUR) or what a teammate is owed (USD, this payout week)
    adjustBalance: async (id, role, amount, reason) => {
      const list = role === 'teammate' ? this.state.data.teammates : this.state.data.customers;
      const p = list.find((x) => x.id === id);
      const j = await this.call('/api/admin/people', { userId: id, action: 'balance', amount, reason });
      if (!j) return;
      this.replace(role === 'teammate' ? 'teammates' : 'customers', j.account);
      const money = (amount < 0 ? '−' : '+') + (role === 'teammate' ? '$' : '€') + Math.abs(amount).toFixed(2);
      this.log(role === 'teammate' ? 'Adjusted teammate balance' : 'Adjusted wallet', p ? p.name : id, money + ' · ' + reason);
      this.toast(money + ' ' + (role === 'teammate' ? 'for ' : 'on ') + (p ? p.name : 'their') + (role === 'teammate' ? ' · now owed $' + j.account.owed.toFixed(2) : '’s wallet · now €' + j.account.wallet.toFixed(2)));
      if (role === 'teammate') this.loadStats(); // payouts change too
    },
    toggleBlock: async (id, reason) => {
      const c = this.state.data.customers.find((x) => x.id === id);
      const on = !(c && c.blocked);
      const j = await this.call('/api/admin/people', { userId: id, action: on ? 'block' : 'unblock', reason });
      if (!j) return;
      this.replace('customers', j.account);
      this.log(on ? 'Blocked customer' : 'Unblocked customer', c ? c.name : id, reason || '');
      this.toast((c ? c.name : 'Customer') + (on ? ' blocked · can’t book or chat' : ' unblocked'));
    },
    // Payouts are saved on the server (data/payouts.json); "paid" only records it until a payout provider is connected.
    payPayout: async (id) => {
      const p = this.state.data.payouts.find((x) => x.id === id);
      if (!(await this.payoutCall({ action: 'pay', id }))) return;
      this.log('Paid out', p ? p.teammate : id, p ? '$' + p.total.toFixed(2) + ' · week of ' + p.week : '');
      this.toast('Payout to ' + (p ? p.teammate : 'teammate') + ' marked as paid');
    },
    holdPayout: async (id, reason) => {
      const p = this.state.data.payouts.find((x) => x.id === id);
      if (!(await this.payoutCall({ action: 'hold', id, reason }))) return;
      this.log('Held payout', p ? p.teammate : id, reason || '');
      this.toast('Payout for ' + (p ? p.teammate : 'teammate') + ' put on hold');
    },
    releasePayout: async (id) => {
      const p = this.state.data.payouts.find((x) => x.id === id);
      if (!(await this.payoutCall({ action: 'release', id }))) return;
      this.log('Released hold', p ? p.teammate : id, '');
      this.toast('Payout for ' + (p ? p.teammate : 'teammate') + ' scheduled again');
    },
    payAll: async () => {
      const j = await this.payoutCall({ action: 'payAll' });
      if (!j) return;
      this.log('Paid all scheduled payouts', j.paid + ' payouts', '$' + j.total.toFixed(2));
      this.toast(j.paid + ' payouts marked as paid · $' + j.total.toFixed(2));
    }
  };
  renderConfirm() {
    const c = this.state.confirm;
    if (!c) return null;
    const f = c.field, f2 = c.field2;
    return (
      <div role="dialog" aria-modal="true" aria-labelledby="ad-confirm-h" style={{ position: "fixed", inset: "0", zIndex: "80", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <button type="button" aria-label="Cancel" onClick={this.closeAsk} style={{ position: "absolute", inset: "0", border: "none", background: "rgba(5, 2, 12, .72)", backdropFilter: "blur(8px)", cursor: "default", transform: "none", animation: "dlfade .15s ease-out" }} />
        <form onSubmit={this.submitAsk} style={{ position: "relative", width: "100%", maxWidth: "440px", padding: "24px", borderRadius: "22px", background: C.panel, border: "1px solid rgba(214, 187, 255, .18)", boxShadow: "0 30px 90px rgba(0, 0, 0, .7)", animation: "dlpop .18s ease-out" }}>
          <h2 id="ad-confirm-h" style={{ margin: "0", fontFamily: DISPLAY, fontSize: "22px", fontWeight: "800", letterSpacing: "-.02em", color: C.white }}>{c.title}</h2>
          {c.body ? <p style={{ margin: "8px 0 0", fontSize: "14px", lineHeight: "1.5", color: C.muted }}>{c.body}</p> : null}
          {f ? (
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "16px", fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
              {f.label}
              {f.options ? (
                <select value={this.state.confirmValue} onChange={(e) => this.setState({ confirmValue: e.target.value })} style={input} autoFocus>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type || 'text'} min={f.type === 'number' && !f.signed ? '0.01' : undefined} step={f.type === 'number' ? '0.01' : undefined} placeholder={f.placeholder || ''} value={this.state.confirmValue} onChange={(e) => this.setState({ confirmValue: e.target.value })} style={input} autoFocus required={!!f.required} />
              )}
            </label>
          ) : null}
          {f2 ? (
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px", fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
              {f2.label}
              <input type="text" placeholder={f2.placeholder || ''} value={this.state.confirmValue2} onChange={(e) => this.setState({ confirmValue2: e.target.value })} style={input} />
            </label>
          ) : null}
          {this.state.confirmError ? (
            <p role="alert" style={{ margin: "12px 0 0", fontSize: "13px", color: C.red }}>{this.state.confirmError}</p>
          ) : null}
          <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" onClick={this.closeAsk} style={btn()}>Cancel</button>
            <button type="submit" style={btn(c.kind || 'primary')}>{c.confirm || 'Confirm'}</button>
          </div>
        </form>
      </div>
    );
  }

  render() {
    const s = this.state;
    const d = s.data;
    const a = this.props.admin || {};
    const [title, sub] = TITLES[s.section];
    const counts = d ? {
      live: s.liveQueue || 0,
      orders: d.orders.filter((o) => o.status === 'Queued' || o.status === 'In progress').length,
      teammates: d.applications.filter((x) => x.status === 'Pending').length,
      payouts: d.payouts.filter((p) => p.status === 'Scheduled').length,
      support: d.supportWaiting || 0,
      safety: (d.reportsOpen || 0) + d.flags.filter((x) => x.status === 'Open').length
    } : {};
    const props = { data: d, now: this.props.now, actions: this.actions, ask: this.ask, go: this.go, toast: this.toast, log: this.log, audit: s.audit, focusOrder: s.focusOrder, liveQueue: s.liveQueue || 0 };
    let body = null;
    // sections that show server data wait for it instead of flashing empty lists
    const waiting = !s.statsLoaded && ['overview', 'orders', 'payouts', 'teammates', 'customers', 'safety'].includes(s.section);
    if (d && !waiting) {
      if (s.section === 'overview') body = <Overview {...props} />;
      if (s.section === 'priority') body = <Priority {...props} adminName={a.name || a.email} />;
      if (s.section === 'users') body = <Users {...props} />;
      if (s.section === 'orders') body = <Orders key={s.focusOrder || 'orders'} {...props} />;
      if (s.section === 'teammates') body = <Teammates {...props} />;
      if (s.section === 'customers') body = <Customers {...props} />;
      if (s.section === 'payouts') body = <Payouts {...props} />;
      if (s.section === 'safety') body = <Safety {...props} />;
      if (s.section === 'support') body = <Support key={s.focusChat || 'support'} {...props} focusChat={s.focusChat} />;
      if (s.section === 'audit') body = <AuditLog {...props} />;
      if (s.section === 'settings') body = <Settings {...props} />;
    }
    return (
      <div className="ad-shell" style={{ background: C.bg, color: C.text, fontFamily: "Geist, system-ui, sans-serif", fontSize: "15px", lineHeight: "1.5", fontVariantNumeric: "tabular-nums" }}>
        <aside className="ad-side" aria-label="Admin">
          {/* logo stays at the top, the links scroll, your profile stays at the bottom: nothing gets cut off */}
          <a href="/" aria-label="Duoly home" className="ad-side-title">
            <img src="/assets/brand/logo-wordmark.webp" alt="Duoly" width="92" height="34" style={{ width: "92px", height: "34px", display: "block" }} />
            <span className="ad-side-chip">ADMIN</span>
          </a>
          <nav className="ad-nav" aria-label="Admin sections">
            {GROUPS.map((g) => (
              <div key={g.label} className="ad-group" role="group" aria-label={g.label}>
                <span className="ad-group-label" aria-hidden="true">{g.label}</span>
                {SECTIONS.filter((x) => g.ids.includes(x.id)).map((x) => (
                  <button key={x.id} type="button" className="ad-navbtn" aria-current={s.section === x.id ? 'page' : undefined} onClick={() => this.go(x.id)}>
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={x.icon} /></svg>
                    <span className="ad-navlabel">{x.label}</span>
                    {counts[x.id] ? <span className={'ad-count' + (x.id === 'safety' ? ' ad-count-hot' : '')}>{counts[x.id]}</span> : null}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="ad-side-foot">
            <a href="/profile" aria-label="Your profile" className="ad-me">
              <img src={a.image || '/assets/avatars/avatar-1.png'} alt="" width="36" height="36" referrerPolicy="no-referrer" />
              <span className="ad-me-text">
                <span className="ad-me-name">{a.name || a.email}</span>
                <span className="ad-me-sub">Admin</span>
              </span>
            </a>
            <div className="ad-me-actions">
              <a href="/" className="ad-iconbtn" title="Open the site" aria-label="Open the site">
                <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>
              </a>
              <a href="/rules" className="ad-iconbtn" title="Teammate rules" aria-label="Teammate rules">
                <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></svg>
              </a>
              <button type="button" className="ad-iconbtn ad-iconbtn-out" title="Sign out" aria-label="Sign out" onClick={() => signOut({ callbackUrl: '/' })}>
                <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
              </button>
            </div>
          </div>
        </aside>

        <main className="ad-main">
          <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", marginBottom: "22px" }}>
            <div>
              <h1 style={{ margin: "0", fontFamily: DISPLAY, fontWeight: "800", fontSize: "clamp(28px, 3.4vw, 38px)", lineHeight: "1.05", letterSpacing: "-.035em", color: C.white }}>{title}</h1>
              <p style={{ margin: "6px 0 0", fontSize: "14px", color: C.muted }}>{sub}</p>
            </div>
            {/* everything in the admin is real and saved on the server */}
            <span title={s.section === 'live' ? "The order queue and who's online come from the server and are shared with every teammate dashboard." : s.section === 'settings' ? 'The rules the platform runs on, straight from the code.' : 'Real data from the server. Every action is saved and goes into the audit log.'} style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "32px", padding: "0 12px", borderRadius: "999px", border: "1px solid rgba(94, 234, 168, .35)", color: C.green, fontSize: "12.5px", fontWeight: "600" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: C.green, animation: "dlpulse 1.4s ease-in-out infinite" }} />
              {s.section === 'live' ? 'Live · shared with teammates' : s.section === 'settings' ? 'Live config' : 'Live · saved on the server'}
            </span>
          </header>
          {d ? (
            // The desk stays mounted on every section so an order in progress, its chat and the new-order bell keep going.
            <LiveDesk {...props} admin={a} desk={this.desk} visible={s.section === 'live'} />
          ) : null}
          {d && !waiting ? body : (
            <div aria-busy="true" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px" }}>
              {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: "112px", borderRadius: "20px", background: C.panel, opacity: 1 - i * 0.15 }} />)}
            </div>
          )}
        </main>

        {this.renderConfirm()}

        <div aria-live="polite" style={{ position: "fixed", right: "16px", bottom: "16px", zIndex: "90", display: "flex", flexDirection: "column", gap: "8px", maxWidth: "calc(100vw - 32px)" }}>
          {s.toasts.map((t) => (
            <div key={t.id} role="status" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderRadius: "14px", background: "#1B1033", border: "1px solid " + (t.kind === 'warn' ? 'rgba(255, 138, 155, .35)' : 'rgba(94, 234, 168, .35)'), boxShadow: "0 18px 50px rgba(0, 0, 0, .55)", fontSize: "14px", color: C.white, animation: "adtoast .2s ease-out" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: t.kind === 'warn' ? C.red : C.green, flex: "0 0 auto" }} />
              {t.text}
            </div>
          ))}
        </div>
      </div>
    );
  }
}
