'use client';

import { previewFetch as fetch } from '../../design-preview/preview-transport';
import { previewPermission } from '../../design-preview/preview-auth';


import React from 'react';
import { GAMES } from '../lib/adminData';
import { IGN_LABEL } from '../lib/orderGen';
import { BLOCKED, BLOCKED_NOTE, MAX_CHAT } from '../lib/chatRules';
import { COUNTRY_NAME, flagSrc } from '../lib/countries';
import { newChatPing, playChatPing } from '../lib/sounds';
import { shrinkImage } from '../lib/shrinkImage';

// what customers can do once matched (kept in sync with lib/orders.js REVIEW_TAGS and lib/reports.js)
const REVIEW_TAGS = ['Great comms', 'Shotcaller', 'Super friendly', 'Taught me a lot', 'Carried hard', 'Patient', 'Fun to play with'];
const BOUNTY = 50;
const STAR = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';

const POLL_MS = 2500;
const QUICK = ['Invite sent?', 'Ready when you are!', 'Can we hop in voice?', 'GG, thanks!'];
const DISPLAY = "'Bricolage Grotesque', sans-serif";
const ACCENT = '#D6BBFF', GREEN = '#5EEAA8', PINK = '#F0A6FF', MUTED = '#A79DC4', DIM = '#8E84AB', GOLD = '#FFD27A';
// Teammate faces the empty slot cycles through while we search
const CANDIDATES = [2, 5, 8, 3, 6, 9, 4, 10, 7];
const TIPS = [
  'Most orders are taken in under 2 minutes.',
  'Every teammate is rank-verified and reviewed after each session.',
  'Not vibing with your teammate? Re-roll for free, twice per order.',
  'Teammates never ask for your login. If one does, report them.',
  'Liked them? Favourite your teammate afterwards and rebook in one tap.'
];

const pad = (n) => String(n).padStart(2, '0');
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + pad(s % 60); };
// Server messages, plus my own that are still sending or just sent (a poll that started before the send finished won't have them yet).
const mergeChat = (server, local, me) => {
  const ids = new Set(server.map((m) => m.id));
  return server.concat(local.filter((m) => !ids.has(m.id) && (String(m.id).startsWith('tmp') || (m.from === me && Date.now() - m.at < 10000))));
};
const moneyOf = (paid) => paid ? (paid.currency === 'USD' ? '$' : '€') + Number(paid.total).toFixed(2) : '';

// The customer's waiting room: live status of their order from search to match to GG.
export default class QueueRoom extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      order: null, offset: 0, now: 0, error: '', missing: false, ask: false, cancelling: false, notif: 'default', tip: 0, cycle: 0, chat: [], chatTyping: false, draft: '', chatWarn: '', unread: 0,
      // modal: null | 'reroll' | 'report'; rep: report form; rv: review + tip form
      modal: null, modalErr: '', busy: '',
      rep: { type: '', text: '', evidence: [], err: '', sent: null, drag: false },
      rv: { rating: 0, hover: 0, tags: [], text: '', tip: 0, custom: '', err: '' }
    };
  }
  componentDidUpdate(prevProps, prevState) {
    // keep the chat scrolled to the newest message
    if (this._chatList && (prevState.chat.length !== this.state.chat.length || prevState.chatTyping !== this.state.chatTyping)) {
      this._chatList.scrollTop = this._chatList.scrollHeight;
    }
  }
  // ---- chat with the teammate (once someone accepted)
  async pollChat() {
    const o = this.state.order;
    if (!o || (o.status !== 'in_progress' && o.status !== 'completed') || this._chatBusy) return;
    if (o.status === 'completed' && this._chatFinal) return; // finished: one last fetch is enough
    this._chatBusy = true;
    try {
      const res = await fetch('/api/orders/' + encodeURIComponent(this.props.id) + '/chat', { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      if (o.status === 'completed') this._chatFinal = true;
      const server = d.messages || [];
      const fresh = server.filter((m) => m.from === 'teammate' && !this.state.chat.some((x) => x.id === m.id));
      const loaded = this._chatLoaded;
      this._chatLoaded = true;
      // new message from the teammate (not on the first load, which only brings older ones)
      if (loaded && fresh.length) playChatPing(this._ping);
      this.setState((s) => ({ chat: mergeChat(server, s.chat, 'customer'), chatTyping: !!d.typing, unread: loaded && document.hidden ? s.unread + fresh.length : 0 }));
    } catch (e) {
    } finally {
      this._chatBusy = false;
    }
  }
  send = async (raw) => {
    const text = String(raw == null ? this.state.draft : raw).trim();
    if (!text) return;
    if (BLOCKED.test(text)) return this.setState({ chatWarn: BLOCKED_NOTE });
    const tempId = 'tmp' + Date.now();
    this.setState((s) => ({ draft: raw == null ? '' : s.draft, chatWarn: '', chat: s.chat.concat([{ id: tempId, from: 'customer', text, at: Date.now() }]) }));
    try {
      const res = await fetch('/api/orders/' + encodeURIComponent(this.props.id) + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return this.setState((s) => ({ chat: s.chat.filter((m) => m.id !== tempId), draft: text, chatWarn: d.error || 'Couldn’t send that. Try again.' }));
      // swap the "sending" copy for the saved message
      this.setState((s) => ({ chat: s.chat.filter((m) => m.id !== tempId && m.id !== d.message.id).concat([d.message]) }));
    } catch (e) {
      this.setState((s) => ({ chat: s.chat.filter((m) => m.id !== tempId), draft: text, chatWarn: 'Can’t reach Duoly right now. Try again.' }));
    }
  };
  setDraft = (e) => {
    this.setState({ draft: e.target.value, chatWarn: '' });
    if (e.target.value && Date.now() - (this._typedAt || 0) > 2500) {
      this._typedAt = Date.now();
      fetch('/api/orders/' + encodeURIComponent(this.props.id) + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ typing: true }) }).catch(() => {});
    }
  };
  focusChat = () => {
    const el = document.getElementById('q-chat');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = document.getElementById('q-chat-input');
    if (input) setTimeout(() => input.focus({ preventScroll: true }), 350);
  };
  componentDidMount() {
    this.setState({ now: Date.now(), notif: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission });
    this._bell = new Audio('/assets/sounds/order-bell.wav');
    this._bell.preload = 'auto';
    this._ping = newChatPing();
    this.poll();
    this._poll = setInterval(() => this.poll(), POLL_MS);
    this._tick = setInterval(() => this.setState({ now: Date.now() }), 1000);
    this._tips = setInterval(() => this.setState((s) => ({ tip: (s.tip + 1) % TIPS.length })), 6000);
    this._cycle = setInterval(() => { if (!this.state.order || this.state.order.status === 'queued') this.setState((s) => ({ cycle: s.cycle + 1 })); }, 900);
    this._chatPoll = setInterval(() => this.pollChat(), POLL_MS);
    this._seen = () => { if (!document.hidden) this.setState({ unread: 0 }); };
    document.addEventListener('visibilitychange', this._seen);
  }
  componentWillUnmount() {
    clearInterval(this._poll);
    clearInterval(this._tick);
    clearInterval(this._tips);
    clearInterval(this._cycle);
    clearInterval(this._chatPoll);
    document.removeEventListener('visibilitychange', this._seen);
    clearTimeout(this._bellStop);
    document.title = 'Duoly';
  }
  async poll() {
    try {
      const res = await fetch('/api/orders/' + encodeURIComponent(this.props.id), { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) { window.location.href = '/?login=' + encodeURIComponent('/queue/' + this.props.id); return; }
      if (res.status === 404) { clearInterval(this._poll); return this.setState({ missing: true, error: '' }); }
      if (!res.ok || !d.order) return this.setState({ error: d.error || 'Couldn’t load your order. Retrying…' });
      const prev = this.state.order;
      if (prev && prev.status === 'queued' && d.order.status === 'in_progress') this.celebrate(d.order);
      if (d.order.status === 'completed' || d.order.status === 'cancelled') clearInterval(this._poll);
      this.setState({ order: d.order, offset: d.now ? d.now - Date.now() : 0, error: '' }, () => {
        if (!prev || prev.status !== d.order.status) this.pollChat(); // chat opens the moment someone accepts
      });
    } catch (e) {
      this.setState({ error: 'Connection lost. Reconnecting…' });
    }
  }
  // Someone took it: sound, desktop notification (if allowed), confetti.
  celebrate(o) {
    try {
      this._bell.currentTime = 0;
      this._bell.play().catch(() => {});
      this._bellStop = setTimeout(() => { try { this._bell.pause(); } catch (e) {} }, 3000);
    } catch (e) {}
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        const n = new Notification('You’re matched!', { body: (o.teammate ? o.teammate.name : 'A teammate') + ' accepted your ' + o.title + '. Jump back in.', icon: '/assets/brand/logo-full.webp', tag: 'duoly-match-' + o.id, silent: true });
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch (e) {}
    this.setState({ burst: Date.now() });
  }
  askNotify = () => {
    if (typeof Notification === 'undefined') return;
    previewPermission().then((p) => this.setState({ notif: p })).catch(() => {});
  };
  cancel = async () => {
    this.setState({ cancelling: true, error: '' });
    try {
      const res = await fetch('/api/orders/' + encodeURIComponent(this.props.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { this.setState({ cancelling: false, ask: false, error: d.error || 'Couldn’t cancel. Please try again.' }); this.poll(); return; }
      clearInterval(this._poll);
      this.setState({ order: d.order, cancelling: false, ask: false });
    } catch (e) {
      this.setState({ cancelling: false, error: 'Can’t reach Duoly right now. Please try again.' });
    }
  };

  // ---- after matching: re-roll, report; after the order: review + tip
  async act(body) {
    const res = await fetch('/api/orders/' + encodeURIComponent(this.props.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, d };
  }
  reroll = async () => {
    this.setState({ busy: 'reroll', modalErr: '' });
    try {
      const { ok, d } = await this.act({ action: 'reroll' });
      if (!ok) return this.setState({ busy: '', modalErr: d.error || 'Couldn’t switch teammates. Try again.' });
      this._chatLoaded = false;
      this.setState({ busy: '', modal: null, order: { ...d.order, reports: (this.state.order && this.state.order.reports) || [] }, chat: [], chatTyping: false, celebrated: false });
    } catch (e) {
      this.setState({ busy: '', modalErr: 'Can’t reach Duoly right now. Try again.' });
    }
  };
  addEvidence = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 5 - this.state.rep.evidence.length);
    for (const f of files) {
      try {
        const data = await shrinkImage(f);
        this.setState((s) => ({ rep: { ...s.rep, evidence: s.rep.evidence.length < 5 ? s.rep.evidence.concat([{ id: Date.now() + Math.random(), data }]) : s.rep.evidence, err: '' } }));
      } catch (e) {
        this.setState((s) => ({ rep: { ...s.rep, err: e.message } }));
      }
    }
  };
  sendReport = async () => {
    const r = this.state.rep;
    if (!r.type) return this.setState({ rep: { ...r, err: 'Pick what happened.' } });
    if (r.text.trim().length < 10) return this.setState({ rep: { ...r, err: 'Tell us what happened in a sentence or two.' } });
    if (!r.evidence.length) return this.setState({ rep: { ...r, err: 'Add at least one screenshot as proof.' } });
    this.setState({ busy: 'report', rep: { ...r, err: '' } });
    try {
      const { ok, d } = await this.act({ action: 'report', type: r.type, text: r.text, evidence: r.evidence.map((x) => x.data) });
      if (!ok) return this.setState({ busy: '', rep: { ...this.state.rep, err: d.error || 'Couldn’t send your report. Try again.' } });
      this.setState((s) => ({ busy: '', rep: { ...s.rep, sent: d.report }, order: { ...s.order, reports: (s.order.reports || []).concat([d.report]) } }));
    } catch (e) {
      this.setState({ busy: '', rep: { ...this.state.rep, err: 'Can’t reach Duoly right now. Try again.' } });
    }
  };
  openReport = (type) => this.setState({ modal: 'report', modalErr: '', rep: { type: type || '', text: '', evidence: [], err: '', sent: null, drag: false } });
  // review form edits always start from the latest state, so quick clicks don't undo each other
  editRv = (fn) => this.setState((s) => ({ rv: { ...s.rv, ...fn(s.rv) } }));
  sendReview = async () => {
    const rv = this.state.rv;
    if (!rv.rating) return this.setState({ rv: { ...rv, err: 'Tap a star to rate your teammate.' } });
    const tip = rv.tip === 'custom' ? Number(String(rv.custom).replace(',', '.')) || 0 : Number(rv.tip) || 0;
    if (tip < 0 || tip > 100) return this.setState({ rv: { ...rv, err: 'Tips can be up to 100.' } });
    this.setState({ busy: 'review', rv: { ...rv, err: '' } });
    try {
      const { ok, d } = await this.act({ action: 'review', rating: rv.rating, tags: rv.tags, text: rv.text, tip });
      if (!ok) return this.setState({ busy: '', rv: { ...this.state.rv, err: d.error || 'Couldn’t send that. Try again.' } });
      this.setState((s) => ({ busy: '', order: { ...d.order, reports: s.order.reports || [] } }));
    } catch (e) {
      this.setState({ busy: '', rv: { ...this.state.rv, err: 'Can’t reach Duoly right now. Try again.' } });
    }
  };

  phase(o) {
    if (!o) return 'loading';
    if (o.status === 'queued') return 'searching';
    if (o.status === 'in_progress') return 'matched';
    if (o.status === 'completed') return 'done';
    return 'cancelled';
  }

  renderVals() {
    const s = this.state;
    const o = s.order;
    const phase = s.missing ? 'missing' : this.phase(o);
    const now = (s.now || Date.now()) + s.offset;
    const g = o ? GAMES[o.game] || { name: o.game, img: '' } : null;
    const waited = o ? now - o.createdAt : 0;
    const limit = o ? o.autoCancelMs : 300000;
    const total = o ? moneyOf(o.paid) : '';
    const mate = o && o.teammate ? o.teammate : null;
    const wins = 0;
    const byYou = o && /customer/i.test(o.cancelReason || '');
    const units = o ? o.games + ' ' + (o.unit || 'game') + (o.games === 1 ? '' : 's') : '';
    const rerolled = !!(o && o.rerolls && o.status === 'queued');

    const head = {
      loading: ['Loading your order…', ''],
      searching: rerolled
        ? ['Finding you a new teammate', 'Your order is back in the queue for other ' + (g ? g.name : '') + ' teammates. Your last teammate can’t take it again.']
        : ['Finding your teammate', 'Your order is live for rank-verified ' + (g ? g.name : '') + ' teammates. We’ll show you who took it the second they accept.'],
      matched: [(mate ? mate.name : 'A teammate') + ' is on it!', 'They accepted your order and will invite ' + (o ? o.ign : 'you') + ' in-game. Keep ' + (g ? g.name : 'your game') + ' open.'],
      done: ['GG!', 'Your ' + units + ' with ' + (mate ? mate.name : 'your teammate') + ' ' + (o && o.games === 1 ? 'is' : 'are') + ' done. How was it?'],
      cancelled: [byYou ? 'Order cancelled' : 'Nobody was free this time', (total || 'The full amount') + ' is back in your Duoly balance. Switch it on at checkout to pay your next order, any game.'],
      missing: ['We can’t find that order', 'It may belong to another account. Your orders are on your dashboard.']
    }[phase];

    if (typeof document !== 'undefined') {
      document.title = (s.unread ? '(' + s.unread + ') New message · ' : '') + (phase === 'searching' ? '(' + clock(waited) + ') Finding your teammate — Duoly'
        : phase === 'matched' ? '✓ Matched! — Duoly' : phase === 'done' ? 'GG — Duoly' : 'Your order — Duoly');
    }

    // [label, done, current]
    const steps = [
      ['Paid', true, false],
      ['In queue', phase !== 'searching' && phase !== 'loading', phase === 'searching'],
      ['Playing', phase === 'done', phase === 'matched'],
      ['Done', phase === 'done', false]
    ];
    const sym = o && o.paid && o.paid.currency === 'USD' ? '$' : '€';

    return { s, o, g, phase, head, waited, limit, total, mate, wins, steps, byYou, units, sym, now, ignLabel: o ? IGN_LABEL[o.game] || 'in-game name' : '' };
  }

  // Matchmaking-style duo: your card ↔ the teammate slot (cycles through faces until someone accepts).
  renderStage(v) {
    const { phase, mate, o, g } = v;
    const user = this.props.user;
    const searching = phase === 'searching' || phase === 'loading';
    const matched = phase === 'matched' || phase === 'playing' || phase === 'done';
    const cancelled = phase === 'cancelled';
    const first = (n) => String(n || '').split(' ')[0];
    const face = CANDIDATES[this.state.cycle % CANDIDATES.length];
    const tone = matched ? GREEN : cancelled ? DIM : ACCENT;

    const player = (kind) => {
      const isYou = kind === 'you';
      const img = isYou ? (user.image || '/assets/avatars/avatar-1.png') : matched && mate ? (mate.image || '/assets/avatars/avatar-3.png') : '/assets/avatars/avatar-' + face + '.png';
      const live = !isYou && searching;
      const border = isYou ? 'rgba(214, 187, 255, .22)' : matched ? 'rgba(94, 234, 168, .55)' : cancelled ? 'rgba(196, 170, 255, .1)' : 'transparent';
      return (
        <div style={{ position: "relative", flex: "1 1 0", maxWidth: "176px", minWidth: "0", borderRadius: "24px", padding: "1.5px", background: live ? "rgba(196, 170, 255, .08)" : isYou ? "linear-gradient(160deg, rgba(214, 187, 255, .55), rgba(240, 166, 255, .12) 60%)" : border, overflow: "hidden", boxShadow: matched && !isYou ? "0 0 0 1px rgba(94, 234, 168, .2), 0 18px 60px rgba(94, 234, 168, .18)" : "0 18px 50px rgba(0, 0, 0, .35)", animation: matched && !isYou ? "qpop .55s ease-out" : "none" }}>
          {/* spinning gradient border while searching */}
          {live ? <span aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", width: "300%", aspectRatio: "1", marginLeft: "-150%", marginTop: "-150%", background: "conic-gradient(from 0deg, transparent 0 55%, " + PINK + " 72%, " + ACCENT + " 86%, transparent 100%)", animation: "qorbit 2.6s linear infinite" }} /> : null}
          <div style={{ position: "relative", height: "100%", borderRadius: "22.5px", background: "linear-gradient(180deg, " + (matched && !isYou ? 'rgba(94, 234, 168, .1)' : 'rgba(214, 187, 255, .08)') + ", rgba(18, 11, 34, .2) 60%), #160D2A", padding: "16px 12px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <span style={{ alignSelf: "stretch", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10.5px", fontWeight: "800", letterSpacing: ".1em", color: isYou ? ACCENT : matched ? GREEN : DIM }}>
              {isYou ? 'YOU' : 'TEAMMATE'}
              {g && g.img ? <img src={g.img} alt="" width="18" height="18" style={{ width: "18px", height: "18px", borderRadius: "5px", opacity: isYou || matched ? 1 : .5 }} /> : null}
            </span>
            <span style={{ position: "relative", width: "84px", height: "84px", borderRadius: "50%", padding: "3px", background: isYou ? "linear-gradient(135deg, " + ACCENT + ", " + PINK + ")" : matched ? "linear-gradient(135deg, " + GREEN + ", #9EE6FF)" : "rgba(196, 170, 255, .14)" }}>
              <img key={isYou ? 'you' : matched ? 'mate' : face} src={img} alt="" width="78" height="78" referrerPolicy="no-referrer" style={{ width: "78px", height: "78px", borderRadius: "50%", objectFit: "cover", display: "block", background: "#120B22", boxShadow: "0 0 0 3px #160D2A", animation: live ? "qswap .9s ease-out" : "none", filter: live ? "saturate(.6) brightness(.85)" : cancelled && !isYou ? "grayscale(1) brightness(.5)" : "none" }} />
              {live ? (
                <span aria-hidden="true" style={{ position: "absolute", inset: "3px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(9, 4, 20, .35)", color: "#FFFFFF", fontFamily: DISPLAY, fontSize: "30px", fontWeight: "800" }}>?</span>
              ) : null}
              {matched && !isYou ? (
                <span aria-hidden="true" style={{ position: "absolute", right: "-2px", bottom: "-2px", width: "26px", height: "26px", borderRadius: "50%", background: GREEN, boxShadow: "0 0 0 3px #160D2A", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#062A1B" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
              ) : null}
            </span>
            <span style={{ maxWidth: "100%", minWidth: "0", textAlign: "center", lineHeight: "1.3" }}>
              {isYou || matched ? (
                <span style={{ display: "block", fontWeight: "700", fontSize: "15.5px", color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isYou ? first(user.name) : first(mate && mate.name)}</span>
              ) : (
                <span aria-hidden="true" style={{ display: "block", width: "78px", height: "12px", margin: "4px auto 6px", borderRadius: "6px", background: "linear-gradient(90deg, rgba(196, 170, 255, .08), rgba(196, 170, 255, .22), rgba(196, 170, 255, .08))", backgroundSize: "200% 100%", animation: "qshimmer 1.4s linear infinite" }} />
              )}
              <span style={{ display: "block", fontSize: "12.5px", color: isYou ? MUTED : matched ? GREEN : DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {isYou ? (o ? o.from || o.region : '') : matched ? 'Rank-verified' : cancelled ? 'No match' : 'Searching…'}
              </span>
            </span>
          </div>
        </div>
      );
    };

    return (
      <div className="q-anim" style={{ position: "relative", padding: "6px 0 4px" }}>
        {o ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 12px 6px 6px", borderRadius: "999px", background: "rgba(9, 4, 20, .6)", border: "1px solid rgba(196, 170, 255, .12)", fontSize: "12.5px", fontWeight: "600", color: "#CFC4EA" }}>
            {g && g.img ? <img src={g.img} alt="" width="20" height="20" style={{ width: "20px", height: "20px", borderRadius: "6px" }} /> : null}
            {o.title} ×{o.games}
            <span aria-hidden="true" style={{ width: "3px", height: "3px", borderRadius: "50%", background: DIM }} />
            {o.region}
          </span>
        ) : <span style={{ display: "inline-block", height: "32px" }} />}

        <div aria-hidden="true" style={{ position: "relative", marginTop: "22px", display: "flex", alignItems: "stretch", justifyContent: "center" }}>
          {player('you')}
          {/* the link between you two */}
          <div style={{ position: "relative", flex: "0 0 auto", alignSelf: "center", width: "clamp(44px, 9vw, 76px)", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ position: "absolute", left: "0", right: "0", top: "50%", height: "2px", marginTop: "-1px", borderRadius: "2px", background: matched ? GREEN : cancelled ? 'rgba(196, 170, 255, .1)' : "repeating-linear-gradient(90deg, rgba(214, 187, 255, .35) 0 6px, transparent 6px 12px)" }} />
            {searching ? [0, 1].map((i) => (
              <span key={i} style={{ position: "absolute", left: "0", top: "50%", width: "8px", height: "8px", marginTop: "-4px", borderRadius: "50%", background: PINK, boxShadow: "0 0 12px " + PINK, animation: "qflow 1.6s ease-in-out " + (i * 0.8) + "s infinite" }} />
            )) : null}
            <span style={{ position: "relative", width: "34px", height: "34px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: matched ? GREEN : "#1B1033", border: "1px solid " + (matched ? GREEN : 'rgba(214, 187, 255, .25)'), color: matched ? '#062A1B' : tone, fontFamily: DISPLAY, fontSize: "12px", fontWeight: "800", boxShadow: matched ? "0 0 24px rgba(94, 234, 168, .5)" : "none" }}>
              {matched ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
              ) : 'DUO'}
            </span>
          </div>
          {player('mate')}
        </div>

        {/* confetti when matched */}
        {this.state.burst ? (
          <div key={this.state.burst} aria-hidden="true" style={{ position: "absolute", left: "50%", top: "55%" }}>
            {Array.from({ length: 26 }, (_, i) => {
              const a = (i / 26) * Math.PI * 2;
              const d = 130 + (i % 4) * 34;
              return <span key={i} style={{ position: "absolute", width: i % 3 ? "8px" : "6px", height: i % 3 ? "14px" : "6px", borderRadius: i % 3 ? "3px" : "50%", background: [GREEN, ACCENT, PINK, '#FFD27A', '#9EE6FF'][i % 5], '--dx': (Math.cos(a) * d).toFixed(0) + 'px', '--dy': (Math.sin(a) * d).toFixed(0) + 'px', '--r': (i * 47) + 'deg', animation: "qburst 1.3s cubic-bezier(.2, .7, .3, 1) forwards" }} />;
            })}
          </div>
        ) : null}
      </div>
    );
  }

  // Chat with the teammate: opens when they accept, read-only once the order is done.
  renderChat(v) {
    const s = this.state;
    const { mate, o, phase } = v;
    const open = phase === 'matched' || phase === 'playing';
    const name = mate ? String(mate.name).split(' ')[0] : 'Your teammate';
    const time = (at) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const hasText = !!s.draft.trim();
    return (
      <section id="q-chat" aria-labelledby="q-chat-h" style={{ borderRadius: "24px", background: "#0E0819", border: "1px solid rgba(214, 187, 255, .18)", overflow: "hidden", boxShadow: "0 20px 60px rgba(0, 0, 0, .35)", scrollMarginTop: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", background: "linear-gradient(180deg, rgba(27, 16, 51, .9), rgba(27, 16, 51, .5))", borderBottom: "1px solid rgba(196, 170, 255, .08)" }}>
          <span style={{ position: "relative", flex: "0 0 auto", width: "40px", height: "40px" }}>
            <img src={(mate && mate.image) || '/assets/avatars/avatar-3.png'} alt="" width="40" height="40" referrerPolicy="no-referrer" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", display: "block" }} />
            <span style={{ position: "absolute", right: "-1px", bottom: "-1px", width: "11px", height: "11px", borderRadius: "50%", background: open ? GREEN : DIM, boxShadow: "0 0 0 2.5px #1B1033" }} />
          </span>
          <span style={{ flex: "1", minWidth: "0", lineHeight: "1.3" }}>
            <span id="q-chat-h" style={{ display: "block", fontWeight: "700", color: "#FFFFFF" }}>Chat with {name}</span>
            <span style={{ display: "block", fontSize: "12.5px", color: s.chatTyping ? GREEN : DIM }}>
              {s.chatTyping ? 'typing…' : open ? 'Your teammate · ' + (o.voice ? 'voice on Discord' : 'text chat') : 'Order finished · chat closed'}
            </span>
          </span>
          <span title={'Your ' + v.ignLabel} style={{ flex: "0 0 auto", maxWidth: "45%", padding: "5px 10px", borderRadius: "10px", background: "rgba(9, 4, 20, .6)", border: "1px solid rgba(196, 170, 255, .12)", fontFamily: "ui-monospace, Consolas, monospace", fontSize: "12px", color: "#CFC4EA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.ign}</span>
        </div>

        <div ref={(el) => { this._chatList = el; }} aria-live="polite" className="dl-scroll" style={{ height: "320px", overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {!s.chat.length ? (
            <p style={{ margin: "auto", textAlign: "center", fontSize: "13.5px", color: DIM, maxWidth: "240px" }}>Say hi to {name}! They’ll invite {o.ign} in-game.</p>
          ) : null}
          {s.chat.map((m) => {
            if (m.from === 'system') {
              return <div key={m.id} style={{ alignSelf: "center", padding: "4px 12px", borderRadius: "999px", background: "rgba(214, 187, 255, .08)", fontSize: "12px", fontWeight: "600", color: "#CFC4EA", textAlign: "center" }}>{m.text}</div>;
            }
            const me = m.from === 'customer';
            const sending = String(m.id).startsWith('tmp');
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: me ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "82%", padding: "9px 13px", fontSize: "14px", lineHeight: "1.45", whiteSpace: "pre-wrap", overflowWrap: "anywhere", textAlign: "left", ...(me ? { borderRadius: "18px 18px 6px 18px", background: ACCENT, color: "#17092E", fontWeight: "500" } : { borderRadius: "18px 18px 18px 6px", background: "#1B1033", color: "#F3EEFF", border: "1px solid rgba(214, 187, 255, .12)" }) }}>{m.text}</div>
                <span style={{ marginTop: "3px", padding: "0 4px", fontSize: "11px", color: "#6A6086" }}>{sending ? 'Sending…' : time(m.at) + (me ? ' · Sent' : '')}</span>
              </div>
            );
          })}
          {s.chatTyping ? (
            <div aria-label={name + ' is typing'} style={{ alignSelf: "flex-start", display: "flex", gap: "4px", padding: "12px 14px", borderRadius: "18px 18px 18px 6px", background: "#1B1033", border: "1px solid rgba(214, 187, 255, .12)" }}>
              {[0, 1, 2].map((i) => <span key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: ACCENT, animation: "tmdot 1.2s ease-in-out " + (i * 0.18) + "s infinite" }} />)}
            </div>
          ) : null}
        </div>

        {open ? (
          <div style={{ padding: "10px 12px 12px", borderTop: "1px solid rgba(196, 170, 255, .08)" }}>
            {!s.chat.some((m) => m.from === 'customer') ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                {QUICK.map((q) => (
                  <button key={q} type="button" onClick={() => this.send(q)} style={{ minHeight: "32px", padding: "0 12px", borderRadius: "999px", border: "1px solid rgba(214, 187, 255, .22)", background: "transparent", color: "#CFC4EA", fontSize: "12.5px", fontWeight: "600" }}>{q}</button>
                ))}
              </div>
            ) : null}
            {s.chatWarn ? <p role="alert" style={{ margin: "0 0 8px", fontSize: "12.5px", color: PINK }}>{s.chatWarn}</p> : null}
            <form onSubmit={(e) => { e.preventDefault(); this.send(); }} style={{ display: "flex", gap: "8px" }}>
              <label htmlFor="q-chat-input" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Message {name}</label>
              <input id="q-chat-input" type="text" autoComplete="off" placeholder={'Message ' + name + '…'} value={s.draft} onChange={this.setDraft} maxLength={MAX_CHAT} style={{ flex: "1", minWidth: "0", minHeight: "46px", padding: "0 14px", borderRadius: "14px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .16)", color: "#FFFFFF", fontSize: "14.5px", fontFamily: "inherit" }} />
              <button type="submit" aria-label="Send" disabled={!hasText} style={{ flex: "0 0 auto", width: "46px", height: "46px", borderRadius: "14px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", background: hasText ? ACCENT : "rgba(196, 170, 255, .1)", color: hasText ? "#17092E" : DIM }}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </form>
            <p style={{ margin: "8px 0 0", fontSize: "11.5px", color: "#6A6086" }}>Keep payments and logins on Duoly. Teammates will never ask for them.</p>
          </div>
        ) : null}
      </section>
    );
  }

  // Shown once matched: what to do if it isn't working out (re-roll) or the teammate breaks the rules (report, bounty).
  renderProtect(v) {
    const { o, mate, sym } = v;
    const name = mate ? String(mate.name).split(' ')[0] : 'your teammate';
    const left = o.rerollsLeft;
    // re-roll only in the first 5 minutes after matching (server-checked too); then it locks for the session
    const msLeft = o.rerollUntil ? o.rerollUntil - v.now : 0;
    const locked = msLeft <= 0;
    const rerollText = left <= 0 ? 'You’ve used both re-rolls on this order. If something’s wrong, report it below.'
      : locked ? 'Locked now that your session is underway. If something’s wrong, report it below and we’ll step in.'
        : 'Switch to a new teammate for free in the first 5 minutes · ' + clock(msLeft) + ' left. ' + left + ' of 2 re-rolls left.';
    const sent = o.reports || [];
    const row = (icon, color, title, text, action) => (
      <li className="q-protect-row">
        <span className="q-protect-icon" style={{ color, background: 'color-mix(in srgb, ' + color + ' 13%, transparent)' }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
        </span>
        <span style={{ flex: "1", minWidth: "0", lineHeight: "1.4" }}>
          <span style={{ display: "block", fontWeight: "700", color: "#FFFFFF", fontSize: "14.5px" }}>{title}</span>
          <span style={{ display: "block", fontSize: "13px", color: MUTED }}>{text}</span>
        </span>
        {action}
      </li>
    );
    const small = (label, onClick, disabled, tone) => (
      <button type="button" onClick={onClick} disabled={disabled} className="q-protect-btn" style={tone === 'pink' ? { color: PINK, borderColor: 'rgba(240, 166, 255, .35)' } : {}}>{label}</button>
    );
    return (
      <section aria-labelledby="q-protect-h" className="q-protect">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="q-protect-shield">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#062A1B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
          </span>
          <span style={{ lineHeight: "1.3" }}>
            <span id="q-protect-h" style={{ display: "block", fontFamily: DISPLAY, fontSize: "19px", fontWeight: "800", letterSpacing: "-.02em", color: "#FFFFFF" }}>You’re covered</span>
            <span style={{ display: "block", fontSize: "13px", color: MUTED }}>Your session should feel great. If it doesn’t, here’s what to do.</span>
          </span>
        </div>
        <ul style={{ listStyle: "none", margin: "16px 0 0", padding: "0", display: "flex", flexDirection: "column", gap: "8px" }}>
          {row(locked || left <= 0 ? 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4' : 'M1 4v6h6M23 20v-6h-6M20.5 9A9 9 0 0 0 5.6 5.6L1 10m22 4l-4.6 4.4A9 9 0 0 1 3.5 15', locked || left <= 0 ? DIM : ACCENT, 'Not the right fit? Re-roll',
            rerollText,
            small(locked || left <= 0 ? 'Locked' : 'Re-roll', () => this.setState({ modal: 'reroll', modalErr: '' }), locked || left <= 0))}
          {row('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM9 10h6', GOLD, 'Asked to pay or chat outside Duoly?',
            'Report it with proof and get ' + sym + BOUNTY + ' once we confirm it.',
            small('Report', () => this.openReport('off_platform'), false, 'pink'))}
          {row('M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', PINK, 'Toxic or disrespectful?',
            'Report ' + name + ' with proof and get ' + sym + BOUNTY + ' once we confirm it.',
            small('Report', () => this.openReport('toxic'), false, 'pink'))}
        </ul>
        <p style={{ margin: "14px 0 0", fontSize: "12.5px", lineHeight: "1.5", color: DIM }}>
          Bounties need solid proof, like screenshots of the messages or the match. Our team checks every report by hand, and false reports don’t count.
        </p>
        {sent.length ? (
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {sent.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderRadius: "12px", background: "rgba(94, 234, 168, .07)", border: "1px solid rgba(94, 234, 168, .22)", fontSize: "13px", color: "#CFF7E4" }}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                Report {r.id} {r.status === 'approved' ? 'confirmed · bounty on its way' : r.status === 'rejected' ? 'reviewed · not enough proof' : 'received · under review'}
              </div>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  // After the order: stars, quick tags, a few words and a tip. Then a thank-you with what they sent.
  renderReview(v) {
    const { o, mate, sym } = v;
    const name = mate ? String(mate.name).split(' ')[0] : (o.lastTeammate ? o.lastTeammate.name.split(' ')[0] : 'your teammate');
    const rv = this.state.rv;
    const stars = (n, size, interactive) => (
      <div role={interactive ? 'radiogroup' : undefined} aria-label={interactive ? 'Rating' : 'Rated ' + n + ' out of 5'} style={{ display: "flex", justifyContent: "center", gap: size > 30 ? "8px" : "3px" }} onMouseLeave={interactive ? () => this.setState({ rv: { ...this.state.rv, hover: 0 } }) : undefined}>
        {[1, 2, 3, 4, 5].map((i) => {
          const on = i <= n;
          const star = <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", transition: "transform .15s", transform: interactive && i === rv.hover ? "scale(1.15)" : "none" }}><path d={STAR} fill={on ? GOLD : 'rgba(196, 170, 255, .14)'} stroke={on ? GOLD : 'rgba(196, 170, 255, .25)'} strokeWidth="1" strokeLinejoin="round" /></svg>;
          return interactive ? (
            <button key={i} type="button" role="radio" aria-checked={rv.rating === i ? 'true' : 'false'} aria-label={i + (i === 1 ? ' star' : ' stars')}
              onMouseEnter={() => this.setState({ rv: { ...this.state.rv, hover: i } })} onClick={() => this.setState({ rv: { ...this.state.rv, rating: i, err: '' } })}
              style={{ padding: "2px", border: "none", background: "transparent", cursor: "pointer", transform: "none" }}>{star}</button>
          ) : <span key={i}>{star}</span>;
        })}
      </div>
    );

    if (o.review) {
      return (
        <div className="q-review" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "12px", fontWeight: "800", letterSpacing: ".1em", color: GREEN }}>THANK YOU</div>
          <div style={{ marginTop: "10px" }}>{stars(o.review.rating, 26, false)}</div>
          <p style={{ margin: "10px 0 0", color: "#FFFFFF", fontWeight: "600" }}>
            You rated {name} {o.review.rating}/5{o.tip ? ' and tipped ' + (o.tip.currency === 'USD' ? '$' : '€') + o.tip.amount.toFixed(2) : ''}.
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "13.5px", color: MUTED }}>
            {o.tip ? '100% of your tip goes to ' + name + '. ' : ''}Your feedback helps us match you with the right teammates.
          </p>
        </div>
      );
    }

    const shown = rv.hover || rv.rating;
    const words = ['', 'Not great', 'Could be better', 'Good', 'Great', 'Amazing!'];
    const tipVal = rv.tip === 'custom' ? Number(String(rv.custom).replace(',', '.')) || 0 : Number(rv.tip) || 0;
    const chip = (on) => ({ minHeight: "36px", padding: "0 13px", borderRadius: "999px", fontSize: "13.5px", fontWeight: "600", cursor: "pointer", transform: "none", border: "1px solid " + (on ? ACCENT : 'rgba(196, 170, 255, .16)'), background: on ? 'rgba(214, 187, 255, .14)' : 'transparent', color: on ? '#FFFFFF' : '#CFC4EA' });
    return (
      <div className="q-review">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "20px", fontWeight: "800", letterSpacing: "-.02em", color: "#FFFFFF" }}>Rate your session with {name}</div>
          <div style={{ marginTop: "12px" }}>{stars(shown, 40, true)}</div>
          <div aria-live="polite" style={{ marginTop: "6px", minHeight: "20px", fontSize: "14px", fontWeight: "700", color: shown ? GOLD : DIM }}>{shown ? words[shown] : 'Tap to rate'}</div>
        </div>

        {rv.rating ? (
          <div style={{ animation: "dlfade .25s ease-out" }}>
            <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px" }}>
              {REVIEW_TAGS.map((t) => {
                const on = rv.tags.includes(t);
                return <button key={t} type="button" aria-pressed={on ? 'true' : 'false'} onClick={() => this.editRv((x) => ({ tags: x.tags.includes(t) ? x.tags.filter((y) => y !== t) : x.tags.concat(t).slice(-4) }))} style={chip(on)}>{t}</button>;
              })}
            </div>
            <textarea value={rv.text} onChange={(e) => { const text = e.target.value; this.editRv(() => ({ text })); }} maxLength={500} rows={3} placeholder={'Anything you’d like ' + name + ' or us to know? (optional)'} aria-label="Your review"
              style={{ marginTop: "14px", width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: "14px", border: "1px solid rgba(196, 170, 255, .16)", background: "#090414", color: "#FFFFFF", font: "inherit", fontSize: "14px", resize: "vertical", outline: "none" }} />

            <div className="q-tip">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <span style={{ fontWeight: "700", color: "#FFFFFF" }}>Leave a tip for {name}</span>
                <span style={{ fontSize: "12.5px", color: GREEN, fontWeight: "600" }}>100% goes to {name}</span>
              </div>
              <div role="radiogroup" aria-label="Tip" style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "6px" }}>
                {[[0, 'No tip'], [2, sym + '2'], [5, sym + '5'], [10, sym + '10'], ['custom', 'Other']].map(([val, label]) => {
                  const on = rv.tip === val;
                  return <button key={label} type="button" role="radio" aria-checked={on ? 'true' : 'false'} onClick={() => this.editRv(() => ({ tip: val, err: '' }))} style={{ ...chip(on), padding: "0 4px", minHeight: "44px", borderRadius: "12px", fontWeight: "700", ...(on && val ? { borderColor: GREEN, background: 'rgba(94, 234, 168, .1)', color: GREEN } : {}) }}>{label}</button>;
                })}
              </div>
              {rv.tip === 'custom' ? (
                <label style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px", padding: "0 14px", minHeight: "44px", borderRadius: "12px", border: "1px solid rgba(196, 170, 255, .16)", background: "#090414" }}>
                  <span style={{ color: MUTED, fontWeight: "700" }}>{sym}</span>
                  <input inputMode="decimal" value={rv.custom} onChange={(e) => { const custom = e.target.value.replace(/[^\d.,]/g, '').slice(0, 6); this.editRv(() => ({ custom })); }} placeholder="Amount" aria-label="Tip amount" style={{ flex: "1", minWidth: "0", border: "none", background: "transparent", color: "#FFFFFF", font: "inherit", fontSize: "15px", outline: "none" }} />
                </label>
              ) : null}
            </div>

            {rv.err ? <p role="alert" style={{ margin: "10px 0 0", fontSize: "13.5px", color: PINK, textAlign: "center" }}>{rv.err}</p> : null}
            <button type="button" onClick={this.sendReview} disabled={this.state.busy === 'review'} className="q-review-send">
              {this.state.busy === 'review' ? 'Sending…' : tipVal > 0 ? 'Send rating & ' + sym + tipVal.toFixed(2).replace(/\.00$/, '') + ' tip' : 'Send rating'}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  // The teammate's screenshots that closed the order.
  renderProof(v) {
    const { o } = v;
    if (!o.proof || !o.proof.length) return null;
    return (
      <section aria-labelledby="q-proof-h" style={{ borderRadius: "24px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .1)", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <h2 id="q-proof-h" style={{ margin: "0", fontSize: "12px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: DIM }}>Proof from your teammate</h2>
          <button type="button" onClick={() => this.openReport('')} style={{ border: "none", background: "transparent", padding: "0", color: PINK, fontSize: "13px", fontWeight: "600", cursor: "pointer", transform: "none" }}>Report a problem</button>
        </div>
        <div className="tm-proof" style={{ marginTop: "12px" }}>
          {o.proof.map((f, i) => (
            <a key={f} aria-disabled="true" role="link" className="tm-proof-thumb" title="Unavailable in the design preview">
              <img src={'/api/uploads/' + f} alt={'Proof screenshot ' + (i + 1)} />
            </a>
          ))}
        </div>
      </section>
    );
  }

  renderModal(v) {
    const s = this.state;
    if (!s.modal) return null;
    const { mate, o, sym } = v;
    const name = mate ? String(mate.name).split(' ')[0] : (o && o.lastTeammate ? o.lastTeammate.name.split(' ')[0] : 'your teammate');
    const close = () => this.setState({ modal: null, modalErr: '' });
    const btn = (primary, extra) => ({ minHeight: "48px", padding: "0 18px", borderRadius: "14px", fontSize: "15px", fontWeight: "700", cursor: "pointer", transform: "none", ...(primary ? { border: "none", background: ACCENT, color: "#17092E" } : { border: "1px solid rgba(196, 170, 255, .2)", background: "transparent", color: "#FFFFFF" }), ...extra });
    let body = null;
    if (s.modal === 'reroll') {
      body = (
        <>
          <h2 id="q-modal-h" className="q-modal-title">Switch to a new teammate?</h2>
          <p className="q-modal-text">{name} leaves your order and it goes straight back into the queue. It’s free, you keep everything you paid for, and {name} can’t pick it up again. {o.rerollsLeft === 1 ? 'This is your last re-roll on this order.' : 'You have ' + o.rerollsLeft + ' re-rolls left.'}</p>
          <p className="q-modal-text" style={{ marginTop: "8px" }}>If {name} broke a rule, report them instead (or as well) so we can act on it.</p>
          {s.modalErr ? <p role="alert" style={{ margin: "12px 0 0", fontSize: "13.5px", color: PINK }}>{s.modalErr}</p> : null}
          <div className="q-modal-actions">
            <button type="button" onClick={close} style={btn(false)}>Keep {name}</button>
            <button type="button" onClick={this.reroll} disabled={s.busy === 'reroll'} style={btn(true)}>{s.busy === 'reroll' ? 'Switching…' : 'Re-roll teammate'}</button>
          </div>
        </>
      );
    } else if (s.modal === 'report') {
      const r = s.rep;
      if (r.sent) {
        body = (
          <div style={{ textAlign: "center" }}>
            <span style={{ display: "inline-flex", width: "56px", height: "56px", borderRadius: "18px", alignItems: "center", justifyContent: "center", background: GREEN }}>
              <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#062A1B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            <h2 id="q-modal-h" className="q-modal-title" style={{ marginTop: "14px" }}>Report received</h2>
            <p className="q-modal-text">Thanks for telling us. Our team reviews report <b style={{ color: "#FFFFFF" }}>{r.sent.id}</b> by hand, usually within 24 hours. If your proof holds up, you get <b style={{ color: GREEN }}>{sym}{BOUNTY}</b> and we deal with {name}.</p>
            <div className="q-modal-actions" style={{ justifyContent: "center" }}>
              <button type="button" onClick={close} style={btn(true)}>Done</button>
            </div>
          </div>
        );
      } else {
        const types = [['off_platform', 'Tried to move me off Duoly', 'Asked me to pay outside Duoly, add them elsewhere, or book them privately.'], ['toxic', 'Toxic or disrespectful', 'Insults, harassment, slurs, throwing or leaving games on purpose.']];
        body = (
          <>
            <h2 id="q-modal-h" className="q-modal-title">Report {name}</h2>
            <p className="q-modal-text">With solid proof, you get <b style={{ color: GREEN }}>{sym}{BOUNTY}</b> once our team confirms it.</p>
            <div role="radiogroup" aria-label="What happened" style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {types.map(([id, title, text]) => {
                const on = r.type === id;
                return (
                  <button key={id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} onClick={() => this.setState({ rep: { ...r, type: id, err: '' } })}
                    style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 14px", borderRadius: "14px", textAlign: "left", cursor: "pointer", transform: "none", border: "1.5px solid " + (on ? ACCENT : 'rgba(196, 170, 255, .14)'), background: on ? 'rgba(214, 187, 255, .08)' : '#090414', color: "#F3EEFF" }}>
                    <span style={{ flex: "0 0 auto", marginTop: "2px", width: "18px", height: "18px", borderRadius: "50%", boxSizing: "border-box", border: on ? "5px solid " + ACCENT : "1.5px solid rgba(196, 170, 255, .35)" }} />
                    <span style={{ lineHeight: "1.4" }}>
                      <span style={{ display: "block", fontWeight: "700", color: "#FFFFFF" }}>{title}</span>
                      <span style={{ display: "block", fontSize: "13px", color: MUTED }}>{text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <textarea value={r.text} onChange={(e) => this.setState({ rep: { ...r, text: e.target.value, err: '' } })} maxLength={1000} rows={3} placeholder="What happened? When, and what did they say or do?" aria-label="What happened"
              style={{ marginTop: "12px", width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: "14px", border: "1px solid rgba(196, 170, 255, .16)", background: "#090414", color: "#FFFFFF", font: "inherit", fontSize: "14px", resize: "vertical", outline: "none" }} />
            <div style={{ marginTop: "12px", fontSize: "13.5px", fontWeight: "700", color: "#FFFFFF" }}>Proof <span style={{ fontWeight: "500", color: DIM }}>· screenshots of the messages or the match, up to 5</span></div>
            <div className="tm-proof" style={{ marginTop: "8px" }}>
              {r.evidence.map((p, i) => (
                <span key={p.id} className="tm-proof-thumb">
                  <img src={p.data} alt={'Evidence ' + (i + 1)} />
                  <button type="button" aria-label={'Remove screenshot ' + (i + 1)} onClick={() => this.setState({ rep: { ...r, evidence: r.evidence.filter((x) => x.id !== p.id) } })}>
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
              {r.evidence.length < 5 ? (
                <label className={'tm-proof-add' + (r.drag ? ' is-drag' : '')}
                  onDragOver={(e) => { e.preventDefault(); if (!r.drag) this.setState({ rep: { ...r, drag: true } }); }} onDragLeave={() => this.setState({ rep: { ...this.state.rep, drag: false } })}
                  onDrop={(e) => { e.preventDefault(); this.setState({ rep: { ...this.state.rep, drag: false } }); this.addEvidence(e.dataTransfer.files); }}>
                  <input disabled title="Unavailable in the design preview. Do not enter real credentials or upload files." type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => { this.addEvidence(e.target.files); e.target.value = ''; }} style={{ position: "absolute", width: "1px", height: "1px", opacity: "0" }} />
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                  <span>Add screenshots</span>
                </label>
              ) : null}
            </div>
            {r.err ? <p role="alert" style={{ margin: "10px 0 0", fontSize: "13.5px", color: PINK }}>{r.err}</p> : null}
            <div className="q-modal-actions">
              <button type="button" onClick={close} style={btn(false)}>Cancel</button>
              <button type="button" onClick={this.sendReport} disabled={s.busy === 'report'} style={btn(true, { background: PINK })}>{s.busy === 'report' ? 'Sending…' : 'Send report'}</button>
            </div>
          </>
        );
      }
    }
    return (
      <div className="q-modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) close(); }} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="q-modal-h" className="q-modal dl-scroll">{body}</div>
      </div>
    );
  }

  // The order summary (what was booked, rank, in-game name) plus who took it.
  renderOrderCard(v) {
    const { o, g, total, mate } = v;
    const card = { borderRadius: "24px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .1)" };
    return (
      <section aria-labelledby="q-order-h" style={{ ...card, padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <h2 id="q-order-h" style={{ margin: "0", fontSize: "12px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: DIM }}>Your order</h2>
          <span style={{ fontSize: "12.5px", color: DIM }}>{o.id}</span>
        </div>
        <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "14px" }}>
          {g.img ? <img src={g.img} alt="" width="52" height="52" style={{ width: "52px", height: "52px", borderRadius: "14px", flex: "0 0 auto" }} /> : null}
          <div style={{ flex: "1", minWidth: "0", lineHeight: "1.35" }}>
            <div style={{ fontWeight: "700", fontSize: "16px", color: "#FFFFFF" }}>{o.title} <span style={{ color: MUTED, fontWeight: "500" }}>×{o.games}</span></div>
            <div style={{ fontSize: "13px", color: MUTED }}>{g.name}</div>
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: "24px", fontWeight: "800", letterSpacing: "-.02em", color: "#FFFFFF" }}>{total}</div>
        </div>
        <dl style={{ margin: "16px 0 0", padding: "14px 0 0", borderTop: "1px solid rgba(196, 170, 255, .08)", display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "8px 16px", fontSize: "14px" }}>
          {[
            ['Server', o.region],
            o.from ? ['Your rank', o.from] : null,
            [v.ignLabel.charAt(0).toUpperCase() + v.ignLabel.slice(1), o.ign],
            ['Comms', o.voice ? 'Voice on Discord' : 'Text chat'],
            o.note ? ['Note', '“' + o.note + '”'] : null,
            ['Paid with', o.paid ? o.paid.method : '—']
          ].filter(Boolean).map(([k, val]) => (
            <React.Fragment key={k}>
              <dt style={{ color: DIM }}>{k}</dt>
              <dd style={{ margin: "0", color: "#F3EEFF", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</dd>
            </React.Fragment>
          ))}
        </dl>
        {mate ? (
          <div style={{ marginTop: "14px", padding: "12px", borderRadius: "16px", background: "rgba(94, 234, 168, .06)", border: "1px solid rgba(94, 234, 168, .22)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={mate.image || '/assets/avatars/avatar-3.png'} alt="" width="40" height="40" referrerPolicy="no-referrer" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} />
              <span style={{ minWidth: "0", lineHeight: "1.3" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "7px", fontWeight: "700", color: "#FFFFFF" }}>
                  {mate.name}
                  {mate.country ? <img src={flagSrc(mate.country)} alt={COUNTRY_NAME[mate.country] || ''} title={COUNTRY_NAME[mate.country] || ''} width="18" height="13" style={{ width: "18px", height: "13px", borderRadius: "2px", objectFit: "cover" }} /> : null}
                </span>
                <span style={{ display: "block", fontSize: "12.5px", color: GREEN }}>Your teammate · rank-verified</span>
              </span>
            </div>
            {/* from the teammate's profile */}
            {mate.bio ? <p style={{ margin: "10px 0 0", fontSize: "13.5px", lineHeight: "1.5", color: "#CFC4EA", overflowWrap: "anywhere" }}>{mate.bio}</p> : null}
            {mate.languages && mate.languages.length ? (
              <div style={{ marginTop: "8px", fontSize: "12.5px", color: DIM }}>Speaks {mate.languages.join(', ')}</div>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  render() {
    const v = this.renderVals();
    const { s, o, g, phase, head, waited, limit, total, mate } = v;
    const user = this.props.user;
    const card = { borderRadius: "24px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .1)" };
    const btn = (primary) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "50px", padding: "0 20px", borderRadius: "14px", fontSize: "15px", fontWeight: "700", textDecoration: "none", ...(primary ? { border: "none", background: ACCENT, color: "#17092E" } : { border: "1px solid rgba(196, 170, 255, .2)", background: "transparent", color: "#FFFFFF" }) });
    const left = Math.max(0, limit - waited);

    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(60% 40% at 50% 0%, rgba(214, 187, 255, .1), transparent 70%), #090414", color: "#F3EEFF", fontFamily: "Geist, system-ui, sans-serif", fontSize: "15px", lineHeight: "1.5", fontVariantNumeric: "tabular-nums" }}>
        <header style={{ maxWidth: "1180px", margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <a href="/" aria-label="Duoly home"><img src="/assets/brand/logo-wordmark.webp" alt="Duoly" width="96" height="36" style={{ width: "96px", height: "36px", display: "block" }} /></a>
          <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "5px 12px 5px 5px", borderRadius: "999px", border: "1px solid rgba(196, 170, 255, .14)", color: "#FFFFFF", textDecoration: "none", fontSize: "14px", fontWeight: "600", minWidth: "0" }}>
            <img src={user.image || '/assets/avatars/avatar-1.png'} alt="" width="30" height="30" referrerPolicy="no-referrer" style={{ width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>{user.name}</span>
          </a>
        </header>

        <main style={{ maxWidth: "1180px", margin: "0 auto", padding: "8px 20px 48px" }}>
          <div className="q-grid">
            {/* stage, and once matched the order card under it (keeps the right column calm) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
            <section aria-live="polite" aria-busy={phase === 'loading' ? 'true' : 'false'} style={{ ...card, position: "relative", overflow: "hidden", padding: "28px 24px 26px", textAlign: "center", background: "radial-gradient(80% 60% at 50% 30%, rgba(214, 187, 255, .08), transparent 70%), #120B22" }}>
              {phase !== 'missing' ? this.renderStage(v) : (
                <img src="/assets/brand/logo-mascots.webp" alt="" width="200" height="126" style={{ width: "200px", height: "auto", margin: "30px auto", display: "block", opacity: ".7" }} />
              )}
              <h1 style={{ margin: "26px 0 0", fontFamily: DISPLAY, fontWeight: "800", fontSize: "clamp(28px, 3.8vw, 38px)", lineHeight: "1.08", letterSpacing: "-.035em", color: "#FFFFFF" }}>
                {head[0]}
                {phase === 'searching' ? (
                  <span aria-hidden="true" style={{ display: "inline-flex", gap: "4px", marginLeft: "6px", verticalAlign: "middle" }}>
                    {[0, 1, 2].map((i) => <span key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: ACCENT, animation: "dlpulse 1.2s ease-in-out " + (i * 0.2) + "s infinite" }} />)}
                  </span>
                ) : null}
              </h1>
              {head[1] ? <p style={{ margin: "8px auto 0", maxWidth: "440px", fontSize: "15px", color: MUTED }}>{head[1]}</p> : null}

              {phase === 'searching' ? (
                <div style={{ marginTop: "20px", display: "inline-flex", alignItems: "stretch", borderRadius: "18px", background: "rgba(9, 4, 20, .7)", border: "1px solid rgba(214, 187, 255, .14)", overflow: "hidden" }}>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "10px 20px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", letterSpacing: ".08em", color: GREEN }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: GREEN, boxShadow: "0 0 10px " + GREEN, animation: "dlpulse 1.2s ease-in-out infinite" }} />
                      IN QUEUE
                    </span>
                    <span role="timer" aria-label="Time in queue" style={{ fontFamily: DISPLAY, fontSize: "28px", fontWeight: "800", lineHeight: "1.1", letterSpacing: "-.02em", color: "#FFFFFF" }}>{clock(waited)}</span>
                  </span>
                  <span aria-hidden="true" style={{ width: "1px", background: "rgba(214, 187, 255, .12)" }} />
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "10px 20px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: ".08em", color: DIM }}>USUAL WAIT</span>
                    <span style={{ fontFamily: DISPLAY, fontSize: "28px", fontWeight: "800", lineHeight: "1.1", letterSpacing: "-.02em", color: MUTED }}>&lt; 2:00</span>
                  </span>
                </div>
              ) : null}

              {phase === 'done' ? this.renderReview(v) : null}

              {phase === 'done' || phase === 'cancelled' || phase === 'missing' ? (
                <div style={{ marginTop: "22px", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "10px" }}>
                  {phase !== 'missing' ? <a href="/#checkout" style={btn(true)}>Queue again</a> : null}
                  <a href="/dashboard" style={btn(phase === 'missing')}>Go to my dashboard</a>
                </div>
              ) : null}
              {phase === 'matched' || phase === 'playing' ? (
                <div style={{ marginTop: "22px", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "10px" }}>
                  <button type="button" onClick={this.focusChat} style={btn(true)}>
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
                    Message {mate ? String(mate.name).split(' ')[0] : 'your teammate'}
                  </button>
                  <a href="/dashboard" style={btn(false)}>Dashboard</a>
                </div>
              ) : null}

              {/* progress steps */}
              {phase !== 'missing' && phase !== 'cancelled' ? (
                <ol aria-label="Order progress" style={{ listStyle: "none", margin: "28px auto 0", padding: "0", maxWidth: "520px", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                  {v.steps.map(([label, done, active], i) => (
                    <li key={label} aria-current={active ? 'step' : undefined} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", fontSize: "12.5px", fontWeight: "600", color: done ? '#FFFFFF' : active ? ACCENT : DIM }}>
                      {i > 0 ? <span aria-hidden="true" style={{ position: "absolute", top: "13px", right: "calc(50% + 18px)", left: "calc(-50% + 18px)", height: "2px", borderRadius: "2px", background: done || active ? 'linear-gradient(90deg, ' + GREEN + ', ' + (done ? GREEN : ACCENT) + ')' : 'rgba(196, 170, 255, .12)' }} /> : null}
                      <span style={{ width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? GREEN : active ? 'rgba(214, 187, 255, .16)' : 'rgba(196, 170, 255, .06)', border: active ? "1.5px solid " + ACCENT : "1.5px solid transparent", color: done ? '#062A1B' : ACCENT }}>
                        {done ? (
                          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                        ) : active ? <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: ACCENT, animation: "dlpulse 1.2s ease-in-out infinite" }} /> : null}
                      </span>
                      {label}
                    </li>
                  ))}
                </ol>
              ) : null}
              {s.error ? <p role="status" style={{ margin: "16px 0 0", fontSize: "13.5px", color: PINK }}>{s.error}</p> : null}
            </section>
            {phase === 'matched' || phase === 'done' ? this.renderOrderCard(v) : null}
            </div>

            {/* side */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
              {/* chat first, then what to do if it isn't working out (re-roll / report) */}
              {phase === 'matched' || phase === 'done' ? this.renderChat(v) : null}
              {phase === 'matched' ? this.renderProtect(v) : null}
              {phase === 'done' ? this.renderProof(v) : null}
              {phase === 'matched' || phase === 'done' ? null : o ? this.renderOrderCard(v) : (
                <div aria-hidden="true" style={{ ...card, height: "260px", opacity: ".6" }} />
              )}

              {phase === 'searching' ? (
                <>
                  <section aria-labelledby="q-wait-h" style={{ ...card, padding: "20px" }}>
                    <h2 id="q-wait-h" style={{ margin: "0", fontSize: "12px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: DIM }}>While you wait</h2>
                    <ul style={{ listStyle: "none", margin: "12px 0 0", padding: "0", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", color: "#CFC4EA" }}>
                      {[
                        'Launch ' + g.name + ' and get to the lobby',
                        'Have your ' + v.ignLabel + ' ready: ' + o.ign,
                        o.voice ? 'Open Discord so you can hop in voice' : 'Keep this tab open, we’ll show you who took it'
                      ].map((t) => (
                        <li key={t} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                          <span style={{ flex: "0 0 auto", marginTop: "2px", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(214, 187, 255, .12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24"><path fill={ACCENT} d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" /></svg>
                          </span>
                          <span style={{ minWidth: "0", overflowWrap: "anywhere" }}>{t}</span>
                        </li>
                      ))}
                    </ul>
                    {s.notif === 'default' ? (
                      <button type="button" onClick={this.askNotify} style={{ ...btn(false), width: "100%", marginTop: "16px", minHeight: "46px", fontSize: "14px" }}>
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                        Notify me when I’m matched
                      </button>
                    ) : s.notif === 'granted' ? (
                      <p style={{ margin: "14px 0 0", fontSize: "13px", color: GREEN }}>We’ll notify you here the moment someone accepts.</p>
                    ) : null}
                    <p key={s.tip} style={{ margin: "16px 0 0", padding: "12px 14px", borderRadius: "14px", background: "#090414", fontSize: "13.5px", color: MUTED, animation: "qtip 6s ease-in-out" }}>
                      <b style={{ color: ACCENT, fontWeight: "700" }}>Tip · </b>{TIPS[s.tip]}
                    </p>
                  </section>

                  <section aria-label="Cancel" style={{ ...card, padding: "18px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "13px", color: DIM }}>
                      <span>Nobody free in 5:00? {total} back to your Duoly balance.</span>
                      <span style={{ color: MUTED, fontWeight: "600" }}>{clock(left)}</span>
                    </div>
                    <div aria-hidden="true" style={{ marginTop: "8px", height: "4px", borderRadius: "999px", background: "rgba(196, 170, 255, .08)", overflow: "hidden" }}>
                      <div style={{ width: Math.min(100, (waited / limit) * 100).toFixed(1) + "%", height: "100%", borderRadius: "999px", background: "linear-gradient(90deg, " + ACCENT + ", " + PINK + ")", transition: "width 1s linear" }} />
                    </div>
                    {s.ask ? (
                      <div role="alertdialog" aria-labelledby="q-cancel-h" style={{ marginTop: "14px", padding: "14px", borderRadius: "16px", background: "rgba(240, 166, 255, .06)", border: "1px solid rgba(240, 166, 255, .25)" }}>
                        <p id="q-cancel-h" style={{ margin: "0", fontSize: "14px", color: "#F3EEFF" }}>Cancel and get {total} back to your Duoly balance?</p>
                        <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          <button type="button" onClick={this.cancel} disabled={s.cancelling} style={{ ...btn(false), minHeight: "44px", borderColor: "rgba(255, 138, 155, .4)", color: "#FF8A9B" }}>{s.cancelling ? 'Cancelling…' : 'Yes, cancel'}</button>
                          <button type="button" onClick={() => this.setState({ ask: false })} disabled={s.cancelling} style={{ ...btn(true), minHeight: "44px" }}>Keep waiting</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => this.setState({ ask: true })} style={{ marginTop: "12px", padding: "0", border: "none", background: "transparent", color: MUTED, fontSize: "13.5px", fontWeight: "600", textDecoration: "underline", textUnderlineOffset: "3px", transform: "none" }}>
                        Cancel order · free until someone accepts
                      </button>
                    )}
                  </section>
                </>
              ) : null}
            </div>
          </div>
        </main>
        {this.renderModal(v)}
      </div>
    );
  }
}
