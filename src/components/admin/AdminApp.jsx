import React from 'react';
import {
  C,
  DISPLAY,
  btn,
  input,
} from '../../design-reference/components/admin/ui';
import { adminApi, auditEntry } from './api';
import { supportInbox } from './support-data';
import { newChatPing, playChatPing } from '../../design-reference/lib/sounds';
import Users from './Users';
import AuditLog from './AuditLog';
import Orders from './Orders';
import LiveDesk from './LiveDesk';
import Overview from './Overview';
import Teammates from './Teammates';
import Customers from './Customers';
import NotConnected from './NotConnected';
import Priority from './Priority';
import Support from './Support';
import Safety from './Safety';
import Settings from './Settings';
import Creators from './Creators';
import Payouts from './Payouts';

// Port of the original admin shell (components/admin/AdminApp.jsx): same sidebar, groups,
// titles, confirm dialog and toasts. Sections are real URLs (/admin/users) so they can be
// bookmarked and shared; navigation inside the shell uses the History API without reloads.
export const SECTIONS = [
  {
    id: 'overview',
    slug: '',
    label: 'Overview',
    icon: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-18v6h8V3h-8z',
  },
  {
    id: 'live',
    slug: 'live',
    label: 'Live desk',
    icon: 'M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z',
  },
  {
    id: 'priority',
    slug: 'priority',
    label: 'Priority',
    icon: 'M3 6h11M3 12h7M3 18h4M17 4v16M17 20l-3-3M17 20l3-3',
  },
  {
    id: 'users',
    slug: 'users',
    label: 'Users and roles',
    icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 11l2 2 4-4',
  },
  {
    id: 'applications',
    slug: 'applications',
    label: 'Applications',
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M9 15l2 2 4-4',
  },
  {
    id: 'orders',
    slug: 'orders',
    label: 'Orders',
    icon: 'M6 2l-2 4v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4H6zM4 6h16M16 10a4 4 0 0 1-8 0',
  },
  {
    id: 'teammates',
    slug: 'teammates',
    label: 'Teammates',
    icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  },
  {
    id: 'customers',
    slug: 'customers',
    label: 'Customers',
    icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  },
  {
    id: 'creators',
    slug: 'creators',
    label: 'Creators',
    icon: 'M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
  },
  {
    id: 'payouts',
    slug: 'payouts',
    label: 'Payouts',
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  },
  {
    id: 'support',
    slug: 'support',
    label: 'Support chat',
    icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5',
  },
  {
    id: 'safety',
    slug: 'safety',
    label: 'Reports and safety',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01',
  },
  {
    id: 'audit',
    slug: 'audit',
    label: 'Audit log',
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M8 13h8M8 17h5',
  },
  {
    id: 'settings',
    slug: 'settings',
    label: 'Settings',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  },
];
const GROUPS = [
  { label: 'Live', ids: ['overview', 'live', 'priority'] },
  {
    label: 'Business',
    ids: ['orders', 'payouts', 'customers', 'teammates', 'creators'],
  },
  // Applications live inside Teammates (a tab), like the original; /admin/applications opens it.
  { label: 'People and safety', ids: ['support', 'users', 'safety'] },
  { label: 'System', ids: ['audit', 'settings'] },
];
const TITLES = {
  overview: ['Overview', 'How Duoly is doing right now'],
  live: [
    'Live desk',
    'Watch every order in the shared queue and hand them to teammates. Admins don’t play and are always online here.',
  ],
  priority: [
    'Priority',
    'Who sees new orders first. Admins only: teammates never see their own score.',
  ],
  users: [
    'Users and roles',
    'Who’s a customer, a teammate or an admin. Changes apply right away.',
  ],
  applications: ['Teammates', 'Your contractors and new applications'],
  orders: ['Orders', 'Every order, its money trail and what happened'],
  teammates: ['Teammates', 'Your contractors and new applications'],
  customers: ['Customers', 'Who’s booking, their level and wallet'],
  payouts: ['Payouts', 'What each teammate is owed, week by week (USD)'],
  support: [
    'Support chat',
    'Everyone who wrote to Sparky. Reply to the ones waiting for a human.',
  ],
  safety: [
    'Reports and safety',
    'Customer reports and chat messages the safety filter stopped',
  ],
  audit: ['Audit log', 'Every action taken in this admin, newest first'],
  creators: [
    'Creators',
    'Creator codes, the customers they brought and the commission they earned',
  ],
  settings: ['Settings', 'The rules the platform runs on'],
};
// Sections wired to the database. Payouts shows what it will do, never sample data.
const LIVE = [
  'overview',
  'live',
  'priority',
  'users',
  'applications',
  'orders',
  'teammates',
  'customers',
  'support',
  'safety',
  'audit',
  'settings',
  'creators',
  'payouts',
];
// Every listed section is connected to its live server read model.
const PARTLY = {};
// The header badge, worded like the original per section.
export const badgeFor = (section, chatEnabled) => {
  if (!(LIVE.includes(section) || (section === 'safety' && chatEnabled)))
    return { live: false, label: 'Not connected yet', title: '' };
  if (section === 'live')
    return {
      live: true,
      label: 'Live · shared with teammates',
      title:
        'The order queue and who’s online come from the server and are shared with every teammate dashboard.',
    };
  if (section === 'settings')
    return {
      live: true,
      label: 'Live config',
      title: 'The rules the platform runs on, read from the server.',
    };
  if (PARTLY[section])
    return {
      live: true,
      partly: true,
      label: 'Live · partly connected',
      title: PARTLY[section],
    };
  return {
    live: true,
    label: 'Live · saved on the server',
    title:
      'Real data from the server. Every action is saved and goes into the audit log.',
  };
};

export const sectionFromPath = (path) => {
  const slug = String(path || '')
    .replace(/^\/admin\/?/, '')
    .replace(/\/$/, '');
  return (SECTIONS.find((s) => s.slug === slug) || SECTIONS[0]).id;
};
const pathOf = (id) => {
  const s = SECTIONS.find((x) => x.id === id);
  return s && s.slug ? '/admin/' + s.slug : '/admin';
};

export default class AdminApp extends React.Component {
  constructor(props) {
    super(props);
    this.api = adminApi(props.csrf);
    this.state = {
      section: props.section || 'overview',
      toasts: [],
      confirm: null,
      confirmValue: '',
      confirmValue2: '',
      confirmError: '',
      audit: [],
      auditLoaded: false,
      pendingApps: 0,
      queued: 0,
      active: 0,
      supportWaiting: 0,
      focusChat: null,
      openReports: 0,
    };
  }
  componentDidMount() {
    this._pop = () =>
      this.setState({ section: sectionFromPath(window.location.pathname) });
    window.addEventListener('popstate', this._pop);
    this.loadAudit();
    this.loadCounts();
    this._ping = newChatPing();
    this.watchSupport();
    this.presenceCheckIn();
    this.revealNav();
    this._counts = setInterval(this.loadCounts, 30000);
    this._support = setInterval(this.watchSupport, 5000);
    this._presence = setInterval(this.presenceCheckIn, 10000);
    this._leave = () => {
      try {
        navigator.sendBeacon(
          '/api/admin/presence',
          new Blob(
            [
              JSON.stringify({
                csrf: this.props.csrf,
                action: 'check-in',
                online: false,
              }),
            ],
            { type: 'application/json' },
          ),
        );
      } catch {}
    };
    window.addEventListener('pagehide', this._leave);
  }
  componentWillUnmount() {
    window.removeEventListener('popstate', this._pop);
    window.removeEventListener('pagehide', this._leave);
    clearInterval(this._counts);
    clearInterval(this._support);
    clearInterval(this._presence);
    (this._toastTimers || []).forEach(clearTimeout);
  }
  // On phones the sidebar is a scrolling tab row: keep the current section in view.
  revealNav = () => {
    const el = document.querySelector('.ops-nav [aria-current="page"]');
    if (el && el.scrollIntoView)
      el.scrollIntoView({ block: 'nearest', inline: 'center' });
  };
  componentDidUpdate(_, prev) {
    if (prev.section !== this.state.section) this.revealNav();
  }
  go = (section, opts) => {
    const path = pathOf(section);
    if (window.location.pathname !== path)
      window.history.pushState(null, '', path);
    document.title = TITLES[section][0] + ' | Duoly admin';
    this.setState({
      section,
      focusChat: opts && opts.chat ? opts.chat : null,
    });
    if (!(opts && opts.keepScroll)) window.scrollTo(0, 0);
  };

  // ---- feedback
  toast = (text, kind) => {
    const id = Date.now() + Math.random();
    this.setState((s) => ({
      toasts: s.toasts.concat([{ id, text, kind: kind || 'ok' }]),
    }));
    this._toastTimers = (this._toastTimers || []).concat([
      setTimeout(
        () =>
          this.setState((s) => ({
            toasts: s.toasts.filter((t) => t.id !== id),
          })),
        4200,
      ),
    ]);
  };
  // The server writes the audit row inside every command; this only refreshes the list.
  log = () => this.loadAudit();
  loadAudit = async () => {
    const r = await this.api.get('/api/admin/audit');
    if (r.ok)
      this.setState({
        audit: (r.data.audit || []).map(auditEntry),
        auditLoaded: true,
      });
  };
  presenceCheckIn = () =>
    this.api
      .post('/api/admin/presence', { action: 'check-in', online: true })
      .catch(() => undefined);
  watchSupport = async () => {
    let response;
    try {
      response = await this.api.get('/api/admin/support');
    } catch {
      return;
    }
    if (!response || !response.ok) return;
    const list = supportInbox(response.data).conversations;
    const needs = list.filter(
      (c) => c.status === 'waiting' || (c.status === 'open' && c.unread > 0),
    );
    const keys = new Set(needs.map((c) => c.id + ':' + (c.count || 0)));
    if (this._supportKeys) {
      const fresh = needs.filter(
        (c) => !this._supportKeys.has(c.id + ':' + (c.count || 0)),
      );
      if (fresh.length) this.alertSupport(fresh[0], fresh.length);
    }
    this._supportKeys = keys;
    if (this.state.supportWaiting !== needs.length)
      this.setState({ supportWaiting: needs.length });
  };
  alertSupport = (conversation, count) => {
    playChatPing(this._ping);
    if (
      (!document.hidden && this.state.section === 'support') ||
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    )
      return;
    try {
      const who =
        conversation.role === 'guest'
          ? 'A guest'
          : conversation.name +
            (conversation.role === 'teammate' ? ' (teammate)' : '');
      const notification = new Notification(
        conversation.status === 'waiting' && Number(conversation.count) <= 6
          ? who + ' needs help'
          : 'New message from ' +
              (conversation.role === 'guest' ? 'a guest' : conversation.name),
        {
          body:
            (conversation.lastUserText
              ? '“' + conversation.lastUserText.slice(0, 140) + '”'
              : 'Open the support chat to reply.') +
            (count > 1 ? '  (+' + (count - 1) + ' more)' : ''),
          icon: '/assets/brand/logo-mascots.webp',
          tag: 'duoly-support-' + conversation.id,
          renotify: true,
        },
      );
      notification.onclick = () => {
        window.focus();
        this.go('support', { chat: conversation.id });
        notification.close();
      };
    } catch {}
  };

  // Sidebar counts like the original: queue on Live desk, open orders, pending applications on
  // Teammates, chats waiting for a human, open reports (hot) on Reports and safety.
  loadCounts = async () => {
    const [summary, support] = await Promise.all([
      this.api.get('/api/admin/overview'),
      this.api.get('/api/admin/support'),
    ]);
    const next = {};
    if (summary.ok) {
      next.pendingApps = Number(summary.data.pendingApplications) || 0;
      next.queued = Number(summary.data.queuedOrders) || 0;
      next.active = Number(summary.data.activeOrders) || 0;
      if (this.props.reportsEnabled)
        next.openReports = Number(summary.data.reportsOpen) || 0;
    }
    if (support.ok)
      next.supportWaiting = supportInbox(support.data).conversations.filter(
        (c) => c.status === 'waiting' || (c.status === 'open' && c.unread > 0),
      ).length;
    this.setState(next);
  };
  // Confirmation dialog. opts: { title, body, confirm, kind, field: { label, placeholder, type, options }, field2, onConfirm(value, value2) }
  ask = (opts) =>
    this.setState({
      confirm: opts,
      confirmError: '',
      confirmValue: (opts.field && opts.field.value) || '',
      confirmValue2: (opts.field2 && opts.field2.value) || '',
    });
  closeAsk = () => this.setState({ confirm: null });
  submitAsk = (e) => {
    if (e) e.preventDefault();
    const c = this.state.confirm;
    if (!c) return;
    const v1 = this.state.confirmValue.trim(),
      v2 = this.state.confirmValue2.trim();
    if (c.field2 && c.field2.required && !v2)
      return this.setState({
        confirmError: 'Please add a reason. It goes into the audit log.',
      });
    if (c.field && c.field.required && !v1)
      return this.setState({
        confirmError: 'Please fill this in. It goes into the audit log.',
      });
    this.setState({ confirm: null, confirmError: '' });
    c.onConfirm(v1, v2);
  };
  renderConfirm() {
    const c = this.state.confirm;
    if (!c) return null;
    const f = c.field,
      f2 = c.field2;
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ops-confirm-h"
        style={{
          position: 'fixed',
          inset: '0',
          zIndex: '80',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <button
          type="button"
          aria-label="Cancel"
          onClick={this.closeAsk}
          style={{
            position: 'absolute',
            inset: '0',
            border: 'none',
            background: 'rgba(5, 2, 12, .72)',
            backdropFilter: 'blur(8px)',
            cursor: 'default',
            transform: 'none',
            animation: 'dlfade .15s ease-out',
          }}
        />
        <form
          onSubmit={this.submitAsk}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            borderRadius: '22px',
            background: C.panel,
            border: '1px solid rgba(214, 187, 255, .18)',
            boxShadow: '0 30px 90px rgba(0, 0, 0, .7)',
            animation: 'dlpop .18s ease-out',
          }}
        >
          <h2
            id="ops-confirm-h"
            style={{
              margin: '0',
              fontFamily: DISPLAY,
              fontSize: '22px',
              fontWeight: '800',
              letterSpacing: '-.02em',
              color: C.white,
            }}
          >
            {c.title}
          </h2>
          {c.body ? (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '14px',
                lineHeight: '1.5',
                color: C.muted,
              }}
            >
              {c.body}
            </p>
          ) : null}
          {f ? (
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                marginTop: '16px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#CFC4EA',
              }}
            >
              {f.label}
              {f.options ? (
                <select
                  value={this.state.confirmValue}
                  onChange={(e) =>
                    this.setState({ confirmValue: e.target.value })
                  }
                  style={input}
                  autoFocus
                >
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type || 'text'}
                  placeholder={f.placeholder || ''}
                  value={this.state.confirmValue}
                  onChange={(e) =>
                    this.setState({ confirmValue: e.target.value })
                  }
                  style={input}
                  autoFocus
                  required={!!f.required}
                />
              )}
            </label>
          ) : null}
          {f2 ? (
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                marginTop: '12px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#CFC4EA',
              }}
            >
              {f2.label}
              <input
                type="text"
                placeholder={f2.placeholder || ''}
                value={this.state.confirmValue2}
                onChange={(e) =>
                  this.setState({ confirmValue2: e.target.value })
                }
                style={input}
              />
            </label>
          ) : null}
          {this.state.confirmError ? (
            <p
              role="alert"
              style={{ margin: '12px 0 0', fontSize: '13px', color: C.red }}
            >
              {this.state.confirmError}
            </p>
          ) : null}
          <div
            style={{
              marginTop: '20px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            <button type="button" onClick={this.closeAsk} style={btn()}>
              Cancel
            </button>
            <button type="submit" style={btn(c.kind || 'primary')}>
              {c.confirm || 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  render() {
    const s = this.state;
    const a = this.props.admin || {};
    const [title, sub] = TITLES[s.section];
    const badge = badgeFor(s.section, this.props.chatEnabled);
    const counts = {
      live: s.queued,
      orders: s.active,
      teammates: s.pendingApps,
      support: s.supportWaiting,
      safety: s.openReports,
    };
    const props = {
      api: this.api,
      ask: this.ask,
      go: this.go,
      toast: this.toast,
      log: this.log,
      audit: s.audit,
      auditLoaded: s.auditLoaded,
      onApplications: (n) => this.setState({ pendingApps: n }),
      csrf: this.props.csrf,
      admin: this.props.admin,
    };
    let body = null;
    if (s.section === 'users') body = <Users {...props} />;
    else if (s.section === 'teammates' || s.section === 'applications')
      body = (
        <Teammates
          {...props}
          tab={s.section === 'applications' ? 'apps' : 'roster'}
          pendingApps={s.pendingApps}
          onTab={(tab) =>
            this.go(tab === 'apps' ? 'applications' : 'teammates', {
              keepScroll: true,
            })
          }
        />
      );
    else if (s.section === 'overview')
      body = <Overview {...props} chatEnabled={this.props.chatEnabled} />;
    else if (s.section === 'live') body = <LiveDesk {...props} />;
    else if (s.section === 'priority') body = <Priority {...props} />;
    else if (s.section === 'customers') body = <Customers {...props} />;
    else if (s.section === 'orders')
      body = <Orders {...props} stripeTest={this.props.stripeTest} />;
    else if (s.section === 'support')
      body = (
        <Support
          {...props}
          key={s.focusChat || 'support'}
          focusChat={s.focusChat}
        />
      );
    else if (s.section === 'audit') body = <AuditLog {...props} />;
    else if (s.section === 'settings') body = <Settings {...props} />;
    else if (s.section === 'creators') body = <Creators {...props} />;
    else if (s.section === 'payouts') body = <Payouts {...props} />;
    else if (s.section === 'safety')
      body = (
        <Safety
          {...props}
          chatEnabled={this.props.chatEnabled}
          reportsEnabled={this.props.reportsEnabled}
        />
      );
    else body = <NotConnected section={s.section} go={this.go} />;
    return (
      <div
        className="ops-shell"
        style={{
          background: C.bg,
          color: C.text,
          fontFamily: 'Geist, system-ui, sans-serif',
          fontSize: '15px',
          lineHeight: '1.5',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <aside className="ops-side" aria-label="Admin">
          <a href="/" aria-label="Duoly home" className="ops-side-title">
            <img
              src="/assets/brand/logo-wordmark.webp"
              alt="Duoly"
              width="92"
              height="34"
              style={{ width: '92px', height: '34px', display: 'block' }}
            />
            <span className="ops-side-chip">ADMIN</span>
          </a>
          <nav className="ops-nav" aria-label="Admin sections">
            {GROUPS.map((g) => (
              <div
                key={g.label}
                className="ops-group"
                role="group"
                aria-label={g.label}
              >
                <span className="ops-group-label" aria-hidden="true">
                  {g.label}
                </span>
                {SECTIONS.filter((x) => g.ids.includes(x.id)).map((x) => (
                  <a
                    key={x.id}
                    href={pathOf(x.id)}
                    className="ops-navbtn"
                    aria-current={
                      s.section === x.id ||
                      (x.id === 'teammates' && s.section === 'applications')
                        ? 'page'
                        : undefined
                    }
                    onClick={(e) => {
                      if (
                        e.metaKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.button !== 0
                      )
                        return;
                      e.preventDefault();
                      this.go(x.id);
                    }}
                    style={{
                      textDecoration: 'none',
                      opacity:
                        LIVE.includes(x.id) ||
                        (x.id === 'safety' && this.props.chatEnabled)
                          ? 1
                          : 0.62,
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={x.icon} />
                    </svg>
                    <span className="ops-navlabel">{x.label}</span>
                    {counts[x.id] ? (
                      <span
                        className={
                          'ops-count' +
                          (x.id === 'safety' ? ' ops-count-hot' : '')
                        }
                      >
                        {counts[x.id]}
                      </span>
                    ) : null}
                  </a>
                ))}
              </div>
            ))}
          </nav>
          <div className="ops-side-foot">
            <a href="/profile" aria-label="Your profile" className="ops-me">
              <img
                src={a.image || '/assets/avatars/avatar-1.png'}
                alt=""
                width="36"
                height="36"
                referrerPolicy="no-referrer"
              />
              <span className="ops-me-text">
                <span className="ops-me-name">
                  {a.name && a.name !== 'Player' ? a.name : a.email}
                </span>
                <span className="ops-me-sub">
                  {this.props.owner ? 'Owner' : 'Admin'}
                </span>
              </span>
            </a>
            <div className="ops-me-actions">
              <a
                href="/"
                className="ops-iconbtn"
                title="Open the site"
                aria-label="Open the site"
              >
                <svg
                  aria-hidden="true"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 11l9-7 9 7" />
                  <path d="M5 10v10h14V10" />
                </svg>
              </a>
              <a
                href="/rules"
                className="ops-iconbtn"
                title="Teammate rules"
                aria-label="Teammate rules"
              >
                <svg
                  aria-hidden="true"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
                </svg>
              </a>
              <form
                method="POST"
                action="/auth/logout"
                style={{ margin: 0, display: 'inline-flex' }}
              >
                <input type="hidden" name="csrf" value={this.props.csrf} />
                <button
                  type="submit"
                  className="ops-iconbtn ops-iconbtn-out"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <svg
                    aria-hidden="true"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="ops-main">
          <header
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '22px',
            }}
          >
            <div>
              <h1
                style={{
                  margin: '0',
                  fontFamily: DISPLAY,
                  fontWeight: '800',
                  fontSize: 'clamp(28px, 3.4vw, 38px)',
                  lineHeight: '1.05',
                  letterSpacing: '-.035em',
                  color: C.white,
                }}
              >
                {title}
              </h1>
              <p
                style={{ margin: '6px 0 0', fontSize: '14px', color: C.muted }}
              >
                {sub}
              </p>
            </div>
            {badge.live ? (
              <span
                title={badge.title}
                data-badge={badge.partly ? 'partly' : 'live'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  minHeight: '32px',
                  padding: '0 12px',
                  borderRadius: '999px',
                  border:
                    '1px solid ' +
                    (badge.partly
                      ? 'rgba(255, 210, 122, .35)'
                      : 'rgba(94, 234, 168, .35)'),
                  color: badge.partly ? C.gold : C.green,
                  fontSize: '12.5px',
                  fontWeight: '600',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: badge.partly ? C.gold : C.green,
                    animation: 'dlpulse 1.4s ease-in-out infinite',
                  }}
                />
                {badge.label}
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  minHeight: '32px',
                  padding: '0 12px',
                  borderRadius: '999px',
                  border: '1px solid ' + C.line2,
                  color: C.dim,
                  fontSize: '12.5px',
                  fontWeight: '600',
                }}
              >
                {badge.label}
              </span>
            )}
          </header>
          {body}
        </div>

        {this.renderConfirm()}

        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            right: '16px',
            bottom: '16px',
            zIndex: '90',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          {s.toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '14px',
                background: '#1B1033',
                border:
                  '1px solid ' +
                  (t.kind === 'warn'
                    ? 'rgba(255, 138, 155, .35)'
                    : 'rgba(94, 234, 168, .35)'),
                boxShadow: '0 18px 50px rgba(0, 0, 0, .55)',
                fontSize: '14px',
                color: C.white,
                animation: 'adtoast .2s ease-out',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: t.kind === 'warn' ? C.red : C.green,
                  flex: '0 0 auto',
                }}
              />
              {t.text}
            </div>
          ))}
        </div>
      </div>
    );
  }
}
