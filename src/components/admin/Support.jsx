'use client';

import React from 'react';
import {
  C,
  DISPLAY,
  card,
  chip,
  btn,
  input,
  ago,
  usd,
} from '../../design-reference/components/admin/ui';
import { GAMES } from '../../design-reference/lib/adminData';
import { supportInbox } from './support-data';

// Admin support inbox: every chat from the Sparky widget. "Needs reply" = someone asked for a human
// or wrote again after an admin answered. Admins reply with their own name and picture.
const POLL = 3000;
const FILTERS = [
  ['reply', 'Needs reply'],
  ['open', 'Open'],
  ['bot', 'With Sparky'],
  ['closed', 'Closed'],
  ['all', 'All'],
];
const ROLE = {
  teammate: ['Teammate', C.accent],
  customer: ['Customer', C.cyan],
  guest: ['Guest', C.dim],
};
// short label on the button, the full message goes into the reply box
const QUICK = [
  ['On it', 'Hey! I’m on it, give me a minute to check.'],
  [
    'Need order #',
    'Thanks for waiting! Could you send me your order number (DL-…)?',
  ],
  [
    'Need a screenshot',
    'Could you send a screenshot of what you’re seeing? That helps me sort it out faster.',
  ],
  [
    'Payment check',
    'I’m checking the payment status now and will confirm what happened.',
  ],
  ['All sorted', 'All sorted! Anything else I can help with?'],
];
const GROUP_MS = 5 * 60000;
const needsReply = (c) =>
  c.status === 'waiting' || (c.status === 'open' && c.unread > 0);
const dayLabel = (t) => {
  const d = new Date(t),
    today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (today - new Date(d).setHours(0, 0, 0, 0)) / 86400000,
  );
  return diff === 0
    ? 'Today'
    : diff === 1
      ? 'Yesterday'
      : d.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
};
const clock = (t) =>
  new Date(t).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
const statusOf = (c) =>
  c.status === 'waiting'
    ? ['Waiting ' + ago(c.waitingSince, Date.now()).replace(' ago', ''), C.gold]
    : c.status === 'open'
      ? [c.agent ? c.agent.name + ' is on it' : 'Open', C.green]
      : c.status === 'bot'
        ? ['With Sparky', C.accent]
        : ['Closed', C.faint];

export default class Support extends React.Component {
  constructor(props) {
    super(props);
    // focusChat: opened from a browser notification
    this.state = {
      notif: 'default',
      list: [],
      open: null,
      openId: props.focusChat || null,
      filter: 'reply',
      q: '',
      draft: '',
      sending: false,
      loaded: false,
      error: '',
    };
    this.listRef = React.createRef();
    this.boxRef = React.createRef();
  }
  componentDidMount() {
    // (the sound and browser notification for new chats come from AdminApp, on every admin page)
    this.setState({
      notif:
        typeof Notification === 'undefined'
          ? 'unsupported'
          : Notification.permission,
    });
    this.load().then(() => this.toBottom());
    this._t = setInterval(() => this.load(), POLL);
  }
  componentWillUnmount() {
    clearInterval(this._t);
  }
  async load() {
    try {
      const r = await this.props.api.get(
        '/api/admin/support' +
          (this.state.openId
            ? '?id=' + encodeURIComponent(this.state.openId)
            : ''),
      );
      if (!r.ok)
        return this.setState({
          error: r.error || 'Couldn’t load the chats.',
          loaded: true,
        });
      const d = supportInbox(r.data);
      const grew =
        d.open &&
        this.state.open &&
        d.open.messages.length > this.state.open.messages.length;
      this.setState(
        { list: d.conversations, open: d.open, loaded: true, error: '' },
        () => {
          if (grew) this.toBottom();
        },
      );
      if (d.open && d.open.unread)
        this.post({ id: d.open.id, action: 'seen' }, true);
    } catch (e) {
      this.setState({
        error: 'Can’t reach Duoly right now. Retrying…',
        loaded: true,
      });
    }
  }
  async askNotifications() {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    this.setState({ notif: p });
    if (p === 'granted') {
      try {
        new Notification('Notifications are on', {
          body: 'You’ll get one whenever someone in the support chat needs a human.',
          icon: '/assets/brand/logo-mascots.webp',
        });
      } catch (e) {}
      this.props.toast('Browser notifications are on for support chats');
    }
  }
  toBottom() {
    const el = this.listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }
  select(id) {
    this.setState({ openId: id, open: null, draft: '' }, async () => {
      await this.load();
      this.toBottom();
    });
  }
  async post(body, quiet) {
    try {
      const r = await this.props.api.post('/api/admin/support', body);
      if (!r.ok) {
        if (!quiet) this.props.toast(r.error || 'That didn’t work.', 'warn');
        return null;
      }
      const d = supportInbox(r.data);
      if (!quiet) this.setState({ open: d.open }, () => this.toBottom());
      return d;
    } catch (e) {
      if (!quiet) this.props.toast('Can’t reach Duoly right now.', 'warn');
      return null;
    }
  }
  async reply(text) {
    const o = this.state.open;
    const t = String(text || '').trim();
    if (!o || !t || this.state.sending) return;
    this.setState({ sending: true });
    const d = await this.post({ id: o.id, action: 'reply', text: t });
    this.setState({ sending: false, draft: d ? '' : this.state.draft }, () =>
      this.grow(),
    );
    if (d) {
      this.props.log(
        'Replied in support chat',
        o.name + ' · ' + o.id,
        t.slice(0, 80),
      );
      this.load();
    }
  }
  async act(action, label) {
    const o = this.state.open;
    if (!o) return;
    const d = await this.post({ id: o.id, action });
    if (d) {
      this.props.log(label, o.name + ' · ' + o.id);
      this.load();
    }
  }
  // the reply box grows with the text (up to ~6 lines)
  grow() {
    const el = this.boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(40, Math.min(el.scrollHeight, 150)) + 'px';
  }
  quick(text) {
    const cur = this.state.draft.trim();
    this.setState({ draft: cur ? cur + ' ' + text : text }, () => {
      this.grow();
      const el = this.boxRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  renderContext(o) {
    const x = o.context;
    const row = (k, v, color) => (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '7px 0',
          borderBottom: '1px solid ' + C.line,
          fontSize: '13px',
        }}
      >
        <span style={{ color: C.dim }}>{k}</span>
        <span
          style={{
            color: color || C.white,
            fontWeight: '600',
            textAlign: 'right',
            overflowWrap: 'anywhere',
          }}
        >
          {v}
        </span>
      </div>
    );
    const r = ROLE[o.role] || ROLE.guest;
    return (
      <aside style={{ ...card, padding: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '10px',
          }}
        >
          <img
            src={o.image || '/assets/avatars/avatar-1.png'}
            alt=""
            width="40"
            height="40"
            referrerPolicy="no-referrer"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
          <span style={{ minWidth: '0', lineHeight: '1.3' }}>
            <span
              style={{
                display: 'block',
                fontWeight: '700',
                color: C.white,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {o.name}
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: r[1] }}>
              {r[0]}
            </span>
          </span>
        </div>
        {o.email ? row('Email', o.email) : null}
        {x && x.kind === 'customer' ? (
          <>
            {row('Orders', x.orders)}
            {x.order
              ? row(
                  'Open order',
                  x.order.id + ' · ' + x.order.status.replace('_', ' '),
                  C.cyan,
                )
              : row('Open order', 'none', C.dim)}
            {x.order ? row('Units', x.order.units, C.dim) : null}
          </>
        ) : null}
        {x && x.kind === 'teammate' ? (
          <>
            {row('Completed', x.lifetime + ' orders')}
            {row('Recorded earnings', usd(x.owed || 0))}
            {row(
              'Games',
              x.gg
                ? 'Gamer Girl · all'
                : x.games.length
                  ? x.games.map((g) => (GAMES[g] || {}).short || g).join(', ')
                  : 'none yet',
              x.games.length || x.gg ? C.white : C.gold,
            )}
            {x.suspended ? row('Status', 'Suspended', C.red) : null}
            {row(
              'Discord',
              x.discord ? 'Connected' : 'Not connected',
              x.discord ? C.green : C.gold,
            )}
          </>
        ) : null}
        {o.role === 'guest' ? (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '12.5px',
              lineHeight: '1.5',
              color: C.dim,
            }}
          >
            Not signed in, so there’s no account to look at. Ask for their email
            or order number if you need it.
          </p>
        ) : null}
        {x ? (
          <div style={{ marginTop: '12px' }}>
            {x.kind === 'customer' ? (
              <button
                type="button"
                style={{ ...btn(), width: '100%' }}
                onClick={() =>
                  this.props.go(
                    x.order ? 'orders' : 'customers',
                    x.order ? { order: x.order.id } : undefined,
                  )
                }
              >
                {x.order ? 'Open order ' + x.order.id : 'Open Customers'}
              </button>
            ) : null}
            {x.kind === 'teammate' ? (
              <button
                type="button"
                style={{ ...btn(), width: '100%' }}
                onClick={() => this.props.go('teammates')}
              >
                Open Teammates
              </button>
            ) : null}
          </div>
        ) : null}
      </aside>
    );
  }

  renderMessages(o) {
    const out = [];
    let prev = null,
      prevDay = '';
    o.messages.forEach((m, i) => {
      const day = dayLabel(m.at);
      if (day !== prevDay) {
        out.push(
          <div
            key={'d' + i}
            style={{
              alignSelf: 'center',
              margin: '6px 0',
              fontSize: '11.5px',
              fontWeight: '700',
              letterSpacing: '.04em',
              color: C.faint,
            }}
          >
            {day}
          </div>,
        );
        prevDay = day;
        prev = null;
      }
      if (m.from === 'system') {
        out.push(
          <div
            key={m.id}
            style={{
              alignSelf: 'center',
              maxWidth: '80%',
              padding: '4px 12px',
              borderRadius: '999px',
              background: C.bg,
              fontSize: '12px',
              color: C.dim,
              textAlign: 'center',
            }}
          >
            {m.text} · {clock(m.at)}
          </div>,
        );
        prev = null;
        return;
      }
      const next = o.messages[i + 1];
      const sameAs = (a, b) =>
        a &&
        b &&
        a.from === b.from &&
        a.from !== 'system' &&
        Math.abs(b.at - a.at) < GROUP_MS &&
        dayLabel(a.at) === dayLabel(b.at);
      const startsGroup = !sameAs(prev, m);
      const endsGroup = !sameAs(m, next);
      const mine = m.from === 'admin';
      const who =
        m.from === 'admin'
          ? m.by
            ? m.by.name
            : 'Admin'
          : m.from === 'bot'
            ? 'Sparky'
            : o.name;
      const pic =
        m.from === 'user' ? (
          <img
            src={o.image || '/assets/avatars/avatar-1.png'}
            alt=""
            width="28"
            height="28"
            referrerPolicy="no-referrer"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : m.from === 'bot' ? (
          <span
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '9px',
              background: C.raised,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="/assets/brand/logo-mascots.webp"
              alt=""
              width="22"
              height="14"
              style={{ width: '22px', height: '14px' }}
            />
          </span>
        ) : (
          <img
            src={(m.by && m.by.image) || '/assets/avatars/avatar-1.png'}
            alt=""
            width="28"
            height="28"
            referrerPolicy="no-referrer"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        );
      out.push(
        <div
          key={m.id}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            justifyContent: mine ? 'flex-end' : 'flex-start',
            marginTop: startsGroup ? '8px' : '0',
          }}
        >
          {!mine ? (
            <span style={{ width: '28px', flex: '0 0 auto', display: 'flex' }}>
              {endsGroup ? pic : null}
            </span>
          ) : null}
          <div
            style={{
              maxWidth: 'min(72%, 620px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: mine ? 'flex-end' : 'flex-start',
              gap: '3px',
            }}
          >
            {startsGroup ? (
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: '600',
                  color: m.from === 'bot' ? C.accent : mine ? C.green : C.muted,
                  padding: '0 6px',
                }}
              >
                {who}{' '}
                <span style={{ fontWeight: '500', color: C.faint }}>
                  · {clock(m.at)}
                </span>
              </span>
            ) : null}
            <div
              title={new Date(m.at).toLocaleString('en-GB')}
              style={{
                padding: '9px 14px',
                fontSize: '14px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                borderRadius: mine
                  ? endsGroup
                    ? '18px 18px 6px 18px'
                    : '18px 6px 6px 18px'
                  : endsGroup
                    ? '18px 18px 18px 6px'
                    : '6px 18px 18px 6px',
                background: mine
                  ? C.accent
                  : m.from === 'bot'
                    ? C.raised
                    : 'rgba(158, 230, 255, .08)',
                border:
                  m.from === 'user'
                    ? '1px solid rgba(158, 230, 255, .2)'
                    : '1px solid transparent',
                color: mine ? C.ink : C.text,
                fontWeight: mine ? '500' : '400',
              }}
            >
              {m.text}
            </div>
          </div>
          {mine ? (
            <span style={{ width: '28px', flex: '0 0 auto', display: 'flex' }}>
              {endsGroup ? pic : null}
            </span>
          ) : null}
        </div>,
      );
      prev = m;
    });
    return out;
  }

  renderChat() {
    const s = this.state;
    const o = s.open;
    if (!s.openId) {
      return (
        <div
          style={{
            ...card,
            minHeight: '460px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '40px 24px',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: C.raised,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="/assets/brand/logo-mascots.webp"
              alt=""
              width="48"
              height="30"
              style={{ width: '48px', height: '30px' }}
            />
          </span>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: '20px',
              fontWeight: '700',
              color: C.white,
            }}
          >
            Pick a chat
          </div>
          <div
            style={{
              maxWidth: '300px',
              fontSize: '13.5px',
              color: C.dim,
              lineHeight: '1.5',
            }}
          >
            Chats waiting for a human are at the top of the list. Everything
            else Sparky is handling.
          </div>
        </div>
      );
    }
    if (!o)
      return <div style={{ ...card, minHeight: '460px' }} aria-busy="true" />;
    const r = ROLE[o.role] || ROLE.guest;
    const [stText, stColor] = statusOf(o);
    const has = s.draft.trim().length > 0;
    return (
      <section
        aria-label={'Chat with ' + o.name}
        style={{
          ...card,
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 190px)',
          minHeight: '520px',
          maxHeight: '860px',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px 12px',
            padding: '14px 16px',
            borderBottom: '1px solid ' + C.line,
          }}
        >
          <img
            src={o.image || '/assets/avatars/avatar-1.png'}
            alt=""
            width="42"
            height="42"
            referrerPolicy="no-referrer"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
          <div style={{ flex: '1 1 180px', minWidth: '0', lineHeight: '1.35' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontSize: '17px',
                  fontWeight: '700',
                  color: C.white,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {o.name}
              </span>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: '800',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: r[1] + '22',
                  color: r[1],
                }}
              >
                {r[0].toUpperCase()}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12.5px',
                color: C.dim,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '700',
                  color: stColor,
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: stColor,
                  }}
                />
                {stText}
              </span>
              <span>· {o.id}</span>
            </div>
          </div>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {o.status === 'waiting' || o.status === 'bot' ? (
              <button
                type="button"
                style={btn('primary')}
                onClick={() => this.act('claim', 'Joined support chat')}
              >
                Take over
              </button>
            ) : null}
            {o.status === 'open' || o.status === 'waiting' ? (
              <button
                type="button"
                style={btn()}
                onClick={() => this.act('bot', 'Handed chat back to Sparky')}
              >
                Back to Sparky
              </button>
            ) : null}
            {o.status !== 'closed' ? (
              <button
                type="button"
                style={btn()}
                onClick={() => this.act('close', 'Closed support chat')}
              >
                Close
              </button>
            ) : null}
          </span>
        </header>

        <div
          ref={this.listRef}
          className="dl-scroll"
          style={{
            flex: '1',
            minHeight: '0',
            overflowY: 'auto',
            padding: '14px 18px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {this.renderMessages(o)}
        </div>

        <div
          style={{
            padding: '12px 16px 14px',
            borderTop: '1px solid ' + C.line,
            background: 'rgba(9, 4, 20, .35)',
          }}
        >
          <div
            className="dl-scroll"
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '8px',
            }}
          >
            {QUICK.map(([label, text]) => (
              <button
                key={label}
                type="button"
                title={text}
                onClick={() => this.quick(text)}
                style={{
                  ...chip(false),
                  flex: '0 0 auto',
                  fontSize: '12.5px',
                  minHeight: '30px',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              this.reply(s.draft);
            }}
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-end',
              padding: '6px 6px 6px 14px',
              borderRadius: '16px',
              background: C.bg,
              border:
                '1px solid ' + (has ? 'rgba(214, 187, 255, .35)' : C.line2),
            }}
          >
            <label
              htmlFor="sp-reply"
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
              }}
            >
              Reply
            </label>
            <textarea
              id="sp-reply"
              ref={this.boxRef}
              rows={1}
              value={s.draft}
              maxLength={2000}
              placeholder={'Reply to ' + o.name + '…'}
              onChange={(e) =>
                this.setState({ draft: e.target.value }, () => this.grow())
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  this.reply(s.draft);
                }
              }}
              className="dl-scroll"
              style={{
                flex: '1',
                minWidth: '0',
                boxSizing: 'border-box',
                height: '40px',
                minHeight: '40px',
                maxHeight: '150px',
                padding: '10px 0',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: C.white,
                fontSize: '14.5px',
                fontFamily: 'inherit',
                lineHeight: '1.45',
                resize: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!has || s.sending}
              aria-label="Send reply"
              style={{
                flex: '0 0 auto',
                height: '40px',
                padding: '0 16px',
                borderRadius: '12px',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '700',
                transform: 'none',
                background: has ? C.accent : 'rgba(196, 170, 255, .1)',
                color: has ? C.ink : C.faint,
              }}
            >
              {s.sending ? 'Sending…' : 'Send'}
              <svg
                aria-hidden="true"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
          <div
            style={{
              marginTop: '7px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: '4px 12px',
              fontSize: '11.5px',
              color: C.faint,
            }}
          >
            <span>Enter to send · Shift + Enter for a new line</span>
            <span>
              {o.status === 'bot'
                ? 'Replying takes the chat over from Sparky'
                : 'They see your name and picture'}
            </span>
          </div>
        </div>
      </section>
    );
  }

  render() {
    const s = this.state;
    const q = s.q.trim().toLowerCase();
    const is = (c, f) =>
      f === 'all' ||
      (f === 'reply' && needsReply(c)) ||
      (f !== 'reply' && c.status === f);
    const list = s.list
      .filter(
        (c) =>
          is(c, s.filter) &&
          (!q ||
            [c.name, c.email, c.id, c.preview].some((x) =>
              String(x || '')
                .toLowerCase()
                .includes(q),
            )),
      )
      .sort(
        (a, b) =>
          needsReply(b) - needsReply(a) ||
          (a.waitingSince || Infinity) - (b.waitingSince || Infinity) ||
          b.updatedAt - a.updatedAt,
      );
    const count = (f) => s.list.filter((c) => is(c, f)).length;
    return (
      <div className={'sp-wrap' + (s.open ? '' : ' sp-noside')}>
        <section
          aria-label="Chats"
          style={{
            ...card,
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            minWidth: '0',
            maxHeight: 'calc(100vh - 190px)',
          }}
        >
          {s.notif === 'default' || s.notif === 'denied' ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '14px',
                background: 'rgba(214, 187, 255, .08)',
                border: '1px solid rgba(214, 187, 255, .18)',
              }}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={C.accent}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flex: '0 0 auto' }}
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              <span
                style={{
                  flex: '1',
                  minWidth: '0',
                  fontSize: '12.5px',
                  lineHeight: '1.4',
                  color: C.muted,
                }}
              >
                {s.notif === 'denied'
                  ? 'Notifications are blocked. Allow them for this site in your browser settings.'
                  : 'Get a browser notification when someone needs a human.'}
              </span>
              {s.notif === 'default' ? (
                <button
                  type="button"
                  onClick={() => this.askNotifications()}
                  style={{
                    ...btn('primary'),
                    minHeight: '32px',
                    padding: '0 12px',
                    fontSize: '12.5px',
                  }}
                >
                  Turn on
                </button>
              ) : null}
            </div>
          ) : null}
          <input
            type="search"
            aria-label="Search chats"
            placeholder="Search name, email, message…"
            value={s.q}
            onChange={(e) => this.setState({ q: e.target.value })}
            style={input}
          />
          <div
            role="group"
            aria-label="Filter"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
          >
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={s.filter === id ? 'true' : 'false'}
                onClick={() => this.setState({ filter: id })}
                style={chip(s.filter === id)}
              >
                {label}
                <span style={{ opacity: '.65', fontWeight: '500' }}>
                  {count(id)}
                </span>
              </button>
            ))}
          </div>
          {s.error ? (
            <p
              role="status"
              style={{ margin: '0', fontSize: '13px', color: C.pink }}
            >
              {s.error}
            </p>
          ) : null}
          <ul
            className="dl-scroll"
            style={{
              listStyle: 'none',
              margin: '0 -4px',
              padding: '0 4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              overflowY: 'auto',
              minHeight: '0',
            }}
          >
            {list.map((c) => {
              const r = ROLE[c.role] || ROLE.guest;
              const on = c.id === s.openId;
              const [stText, stColor] = statusOf(c);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => this.select(c.id)}
                    aria-current={on ? 'true' : undefined}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px',
                      borderRadius: '14px',
                      textAlign: 'left',
                      transform: 'none',
                      border:
                        '1px solid ' +
                        (on
                          ? 'rgba(214, 187, 255, .35)'
                          : needsReply(c)
                            ? 'rgba(255, 210, 122, .28)'
                            : C.line),
                      background: on ? C.raised : C.bg,
                      color: C.text,
                    }}
                  >
                    <img
                      src={c.image || '/assets/avatars/avatar-1.png'}
                      alt=""
                      width="36"
                      height="36"
                      referrerPolicy="no-referrer"
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flex: '0 0 auto',
                      }}
                    />
                    <span
                      style={{ flex: '1', minWidth: '0', lineHeight: '1.35' }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: '700',
                            color: C.white,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.name}
                        </span>
                        <span
                          style={{
                            flex: '0 0 auto',
                            fontSize: '10px',
                            fontWeight: '800',
                            padding: '1px 6px',
                            borderRadius: '6px',
                            background: r[1] + '22',
                            color: r[1],
                          }}
                        >
                          {r[0].toUpperCase()}
                        </span>
                        <span
                          style={{
                            marginLeft: 'auto',
                            flex: '0 0 auto',
                            fontSize: '11.5px',
                            color: C.faint,
                          }}
                        >
                          {ago(c.updatedAt, Date.now())}
                        </span>
                      </span>
                      <span
                        style={{
                          display: 'block',
                          marginTop: '2px',
                          fontSize: '12.5px',
                          color: C.muted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.preview || 'No messages yet'}
                      </span>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '4px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          color: stColor,
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: stColor,
                          }}
                        />
                        {stText}
                        {c.unread ? (
                          <span
                            style={{
                              marginLeft: 'auto',
                              minWidth: '18px',
                              height: '18px',
                              padding: '0 5px',
                              borderRadius: '999px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10.5px',
                              background: C.gold,
                              color: C.ink,
                            }}
                          >
                            {c.unread}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {s.loaded && !list.length ? (
              <li style={{ padding: '26px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px' }} aria-hidden="true">
                  ✓
                </div>
                <div
                  style={{
                    marginTop: '4px',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    color: C.white,
                  }}
                >
                  {s.filter === 'reply' ? 'All caught up' : 'Nothing here'}
                </div>
                <div
                  style={{ marginTop: '2px', fontSize: '12.5px', color: C.dim }}
                >
                  {s.filter === 'reply'
                    ? 'Nobody’s waiting. Sparky has it covered.'
                    : 'No chats in this list.'}
                </div>
              </li>
            ) : null}
          </ul>
        </section>
        <div style={{ minWidth: '0' }}>{this.renderChat()}</div>
        {s.open ? (
          <div className="sp-side">{this.renderContext(s.open)}</div>
        ) : null}
      </div>
    );
  }
}
