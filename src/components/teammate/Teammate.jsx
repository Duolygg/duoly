'use client';

import { createTeammateFetch, newEligibleOrders } from './teammate-data';
import PrivateProofs from '../proofs/PrivateProofs';
import {
  readChat,
  sendChat as sendRealChat,
  setTyping,
} from '../../client/order-chat';
const previewPermission = () =>
  typeof Notification === 'undefined'
    ? Promise.resolve('unsupported')
    : Notification.requestPermission();

import React from 'react';
// Session commands are supplied by the live wrapper.
import Leaderboard from './Leaderboard';
import PerformanceCard from './PerformanceCard';
import PayoutPanel from './PayoutPanel';
import StreamingPanel from './StreamingPanel';
import SupportChat from '../support/SupportChat';
import TrustScore, { tierFor } from './TrustScore';
import {
  GAMES,
  GAME_IDS,
  IGN_LABEL,
  gameOf,
} from '../../design-reference/lib/games';
import { flagSrc } from '../../design-reference/lib/countries';
import { canTake, NO_ACCESS } from '../../design-reference/lib/access';
import { tracksWinLoss } from '../../design-reference/lib/winloss';
import { newChatPing, playChatPing } from '../../design-reference/lib/sounds';
import WaitingForOrders from '../shared/WaitingForOrders';
import { MoodBadge, moodOf } from '../shared/moods';
import { shrinkImage } from '../../design-reference/lib/shrinkImage';
import { BLOCKED, BLOCKED_NOTE } from '../../design-reference/lib/chatRules';

// Turns a CSS declaration string ("color: red; margin-top: 4px") into a React style object.
function css(str) {
  const out = {};
  String(str || '')
    .split(';')
    .forEach((decl) => {
      const i = decl.indexOf(':');
      if (i < 0) return;
      const k = decl.slice(0, i).trim();
      const val = decl.slice(i + 1).trim();
      if (!k) return;
      out[
        k.startsWith('--')
          ? k
          : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      ] = val;
    });
  return out;
}

export const FEATURES = {
  presence: true,
  notifications: true,
  preferences: true,
  trust: true,
  stats: true,
  reviews: true,
  tips: true,
  leaderboard: true,
  handovers: false,
  cancelled: false,
  support: true,
  legacyProof: false,
  simulation: false,
};

const DISPLAY = "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif";

// Latest customer reviews (stars, text, tags). Only customer display names are shown.
function LatestReviews({ reviews }) {
  if (!reviews.length) return null;
  return (
    <div style={{ marginTop: '16px' }}>
      <div
        style={{
          fontSize: '12px',
          fontWeight: '700',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: '#6A6086',
        }}
      >
        Latest reviews
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: '8px 0 0',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {reviews.map((r, i) => (
          <li
            key={i}
            style={{
              padding: '10px 12px',
              borderRadius: '14px',
              background: '#090414',
              fontSize: '13.5px',
              lineHeight: '1.45',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#FFD27A',
                fontWeight: '700',
              }}
            >
              {'★'.repeat(r.rating)}
              <span style={{ color: '#6A6086' }}>
                {'★'.repeat(5 - r.rating)}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#8E84AB',
                }}
              >
                {r.customer}
              </span>
            </div>
            {r.text ? (
              <div
                style={{
                  marginTop: '4px',
                  color: '#D9D1F0',
                  overflowWrap: 'anywhere',
                }}
              >
                “{r.text}”
              </div>
            ) : null}
            {r.tags && r.tags.length ? (
              <div
                style={{
                  marginTop: '6px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                }}
              >
                {r.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: '11.5px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'rgba(214, 187, 255, .1)',
                      color: '#D6BBFF',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const GREEN = '#5EEAA8';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
// Orders come from the one shared queue on the server (lib/orders.js); every dashboard polls it.
const POLL_MS = 3000;
const PRESENCE_MS = 10000;
// Trust level history (sample): orders completed before this session, deposit currently held, saved vs Rookie rate
// Earnings, trust level, rating and the leaderboard come from the server's earnings ledger
// (lib/ledger.js → /api/teammate/stats), refreshed on load, every minute and after each completed order.
const STATS_MS = 60000;
const DAY_MS = 86400000;

// Teammates (contractors) are always paid in USD.
const money = (n) => '$' + n.toFixed(2);
const waitLabel = (sec) =>
  sec >= 3600
    ? Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm'
    : (sec >= 60 ? Math.floor(sec / 60) + 'm ' : '') +
      Math.floor(sec % 60) +
      's';
// Order chat. Messages are { id, from: 'me' | 'them' | 'system', text, at }. Orders from real
// customers (o.realCustomer) use the real chat on the server; simulated orders get a simulated
// customer below. Payments and account access stay on Duoly (BLOCKED is also enforced server-side).
const CHAT_POLL_MS = 2500;
function customerReply(text, o) {
  const t = text.toLowerCase();
  if (/inv|lobby|party|add/.test(t))
    return pick([
      'Accepted, I’m in your lobby!',
      'Got the invite, joining now.',
      'In! Ready when you are.',
    ]);
  if (/ready|queue|q up|start|go\b/.test(t))
    return pick(['Ready! Let’s go.', 'Queue it, I’m ready.', 'Let’s goo']);
  if (/voice|mic|discord|call/.test(t))
    return o.voice
      ? 'Sure, joining voice in a sec.'
      : 'I’d rather keep it to text chat if that’s okay!';
  if (/role|pick|main|play what|champ|agent|hero/.test(t))
    return pick([
      'I can flex, you pick first.',
      'I usually play support, but I can fill.',
      'Whatever works best for the comp!',
    ]);
  if (/gg|nice|well played|wp/.test(t))
    return pick(['GG! That was fun.', 'GG, you’re cracked', 'GGs!']);
  if (/\?$/.test(t.trim()))
    return pick(['Yeah, sounds good!', 'Sure!', 'Hmm, up to you!']);
  return pick([
    'Sounds good!',
    'Okay, let’s do it.',
    'Perfect, thanks!',
    'Nice',
  ]);
}
const clock = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    r = s % 60;
  return (
    (h ? h + ':' + String(m).padStart(2, '0') : m) +
    ':' +
    String(r).padStart(2, '0')
  );
};

export default class Teammate extends React.Component {
  constructor(props) {
    super(props);
    this._fetch = createTeammateFetch({ csrf: props.csrf });
    const admin = !!props.admin;
    this.state = {
      now: 0,
      online: false,
      onlineSince: 0,
      loaded: false,
      readError: false,
      // teammates without a connected Discord are locked behind the connect popup (admins never are)
      needDiscord: !admin && props.discordLinked === false,
      // shared queue from the server (orders auto-cancel after autoCancelMs without a teammate)
      queue: [],
      live: [],
      recent: [],
      cancelled: [],
      autoCancelMs: 300000,
      handovers: {},
      // the match report of the active win/loss order (null for other orders)
      matchReport: null,
      notice: '',
      forced: null,
      active: null,
      proof: [],
      proofErr: '',
      proofDrag: false,
      completing: false,
      stats: null,
      board: null,
      statsAt: 0,
      // games a teammate gets orders for (admins see every game)
      // every game starts switched on; which ones can actually bring orders is decided by `access` below
      enabled: Object.fromEntries(GAME_IDS.map((id) => [id, true])),
      voiceOk: true,
      settingsSaving: false,
      settingsLoaded: admin,
      // which orders an admin approved this teammate for (games, or Gamer Girl); the server sends updates with every poll
      access: props.access || NO_ACCESS,
      menu: false,
      offlineBlocked: false,
      chat: [],
      chatTyping: false,
      chatDraft: '',
      chatWarn: '',
      copied: false,
    };
    this._chatTimers = [];
    this._seen = null; // order ids already shown; null until the first poll so existing orders don't ring
    this._presenceVersion = 0;
    this._lastActive = Date.now();
  }
  async post(url, body) {
    const res = await this._fetch(url, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }
  componentDidUpdate(prevProps, prevState) {
    // keep the chat scrolled to the newest message
    if (
      this._chatList &&
      (prevState.chat.length !== this.state.chat.length ||
        prevState.chatTyping !== this.state.chatTyping)
    ) {
      this._chatList.scrollTop = this._chatList.scrollHeight;
    }
  }
  chatPush(from, text) {
    this.setState((st) => ({
      chat: st.chat.concat([
        { id: Date.now() + Math.random(), from, text, at: Date.now() },
      ]),
    }));
  }
  // Simulated customer: shows "typing…" for a moment, then the message arrives.
  customerSays(text, delay) {
    if (!FEATURES.simulation) return;
    const t1 = setTimeout(() => {
      if (!this.state.active) return;
      this.setState({ chatTyping: true });
      const t2 = setTimeout(
        () => {
          if (!this.state.active) return;
          this.setState({ chatTyping: false });
          this.chatPush('them', text);
          playChatPing(this._ping);
        },
        900 + Math.min(text.length * 25, 1600),
      );
      this._chatTimers.push(t2);
    }, delay);
    this._chatTimers.push(t1);
  }
  clearChatTimers() {
    this._chatTimers.forEach(clearTimeout);
    this._chatTimers = [];
  }
  sameAssignment(a) {
    return (
      !this._disposed &&
      this.state.active?.id === a.id &&
      this.state.active?.assignmentId === a.assignmentId
    );
  }
  chatMessage(m) {
    return {
      id: m.id,
      from:
        m.sender === 'teammate'
          ? 'me'
          : m.sender === 'customer'
            ? 'them'
            : 'system',
      text: m.body,
      at: Date.parse(m.created_at),
    };
  }
  async sendChat(raw) {
    const text = String(raw || '').trim();
    const a = this.state.active;
    if (
      !text ||
      !a?.assignmentId ||
      !this.props.chatEnabled ||
      this._sendingChat ||
      this.state.chatLocked
    )
      return;
    if (BLOCKED.test(text)) {
      this.setState({ chatWarn: BLOCKED_NOTE });
      return;
    }
    // Uncertain retries keep exactly the same request binding. No optimistic delivered bubble.
    const pending = this._pendingChat;
    const input =
      pending &&
      pending.assignment_id === a.assignmentId &&
      pending.body === text
        ? pending
        : {
            assignment_id: a.assignmentId,
            request_id: crypto.randomUUID(),
            body: text,
          };
    this._pendingChat = input;
    this._sendingChat = true;
    this.setState({ chatWarn: '', sendingChat: true });
    try {
      const result = await sendRealChat(fetch, a.id, this.props.csrf, input);
      if (!this.sameAssignment(a)) return;
      this._pendingChat = null;
      if (result.outcome === 'blocked') {
        this.setState({ chatWarn: result.note, chatDraft: text });
        return;
      }
      this.setState((st) => ({
        chat: st.chat
          .filter((m) => m.id !== result.message.id)
          .concat(this.chatMessage(result.message)),
        chatDraft: '',
        chatWarn: '',
      }));
      this.pollChat();
    } catch (error) {
      if (!this.sameAssignment(a)) return;
      const denied = [401, 403, 404].includes(error.status);
      this.setState({
        chatDraft: text,
        chatWarn:
          error.message ||
          'Message was not confirmed. Retry to check the same request.',
        ...(denied ? { chat: [], chatTyping: false, chatLocked: true } : {}),
      });
    } finally {
      this._sendingChat = false;
      if (!this._disposed) this.setState({ sendingChat: false });
    }
  }
  async pollChat() {
    const a = this.state.active;
    if (!a?.assignmentId || !this.props.chatEnabled || this._chatBusy) return;
    this._chatBusy = true;
    try {
      const room = await readChat(fetch, a.id, a.assignmentId);
      if (!this.sameAssignment(a)) return;
      const chat = room.messages.map((m) => this.chatMessage(m));
      // new message from the customer (not on the first load of this order, which only brings older ones)
      const loaded = this._chatLoadedFor === a.assignmentId;
      this._chatLoadedFor = a.assignmentId;
      if (
        loaded &&
        chat.some(
          (m) =>
            m.from === 'them' && !this.state.chat.some((x) => x.id === m.id),
        )
      )
        playChatPing(this._ping);
      this.setState({
        chat,
        chatTyping: room.typing.some(
          (t) => t.role === 'customer' && Date.parse(t.expires_at) > Date.now(),
        ),
        chatLocked: !room.writable,
        chatWarn: room.writable ? '' : 'This conversation is read-only.',
      });
    } catch (error) {
      if (!this.sameAssignment(a)) return;
      this.setState({
        chatWarn: error.message || 'Could not load the conversation.',
        ...([401, 403, 404].includes(error.status)
          ? { chat: [], chatTyping: false, chatLocked: true }
          : {}),
      });
    } finally {
      this._chatBusy = false;
    }
  }
  typingPing() {
    const a = this.state.active;
    if (
      !a?.assignmentId ||
      !this.props.chatEnabled ||
      this.state.chatLocked ||
      Date.now() - (this._typedAt || 0) < 2500
    )
      return;
    this._typedAt = Date.now();
    setTyping(fetch, a.id, this.props.csrf, a.assignmentId).catch(() => {});
  }
  queueSettingsState(
    enabled = this.state.enabled,
    voiceOk = this.state.voiceOk,
  ) {
    return {
      enabledGames: GAME_IDS.filter((id) => enabled[id]),
      voiceOptIn: voiceOk,
    };
  }
  applyQueueSettings(settings) {
    this.setState({
      enabled: Object.fromEntries(
        GAME_IDS.map((id) => [id, settings.enabledGames.includes(id)]),
      ),
      voiceOk: settings.voiceOptIn,
      ...(settings.allowedGames
        ? {
            access: {
              games: settings.compGames || settings.allowedGames,
              gg: settings.ggAccess,
            },
          }
        : {}),
      settingsSaving: false,
      settingsLoaded: true,
    });
  }
  async loadQueueSettings() {
    if (!FEATURES.preferences || this.props.admin || this.state.needDiscord)
      return;
    try {
      const response = await this._fetch('/api/queue-settings');
      if (!response.ok || this._disposed) return;
      this.applyQueueSettings(await response.json());
    } catch {}
  }
  async saveQueueSettings(enabled, voiceOk) {
    if (
      this.state.settingsSaving ||
      !this.state.settingsLoaded ||
      this.props.admin
    )
      return;
    const previous = this.queueSettingsState();
    const next = this.queueSettingsState(enabled, voiceOk);
    this.setState({ enabled, voiceOk, settingsSaving: true, notice: '' });
    try {
      const response = await this._fetch('/api/queue-settings', {
        method: 'POST',
        body: JSON.stringify(next),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Could not save queue settings.');
      if (!this._disposed) this.applyQueueSettings(data);
    } catch (error) {
      if (!this._disposed) {
        this.applyQueueSettings(previous);
        this.setState({
          notice: error.message || 'Could not save queue settings.',
        });
      }
    }
  }
  componentDidMount() {
    const now = Date.now();
    this.setState(
      this.props.admin || this.props.preview
        ? { now, onlineSince: now }
        : { now },
    );
    // the ?discord=… result from connecting is read once; don't keep it in the address bar
    if (this.props.discordResult)
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.hash,
      );
    this._tick = setInterval(() => this.setState({ now: Date.now() }), 1000);
    this._poll = setInterval(() => this.poll(), POLL_MS);
    this._presencePoll = setInterval(() => this.checkIn(), PRESENCE_MS);
    this._chatPoll = setInterval(() => this.pollChat(), CHAT_POLL_MS);
    // last activity, so admins can see who's AFK with the dashboard left open
    this._activity = () => {
      this._lastActive = Date.now();
    };
    ['pointerdown', 'pointermove', 'keydown', 'wheel'].forEach((ev) =>
      window.addEventListener(ev, this._activity, { passive: true }),
    );
    // closing the tab: tell the server right away instead of waiting for the timeout
    this._leave = () => {
      if (!FEATURES.presence || this.props.admin || !this.state.online) return;
      try {
        navigator.sendBeacon(
          '/api/teammate/presence',
          new Blob(
            [
              JSON.stringify({
                csrf: this.props.csrf,
                action: 'set',
                online: false,
              }),
            ],
            { type: 'application/json' },
          ),
        );
      } catch {}
    };
    window.addEventListener('pagehide', this._leave);
    this._bell = new Audio('/assets/sounds/order-bell.wav');
    this._bell.preload = 'auto';
    this._ping = newChatPing();
    this.setState({
      notif:
        typeof Notification === 'undefined'
          ? 'unsupported'
          : Notification.permission,
    });
    this.loadQueueSettings();
    this.checkIn();
    this.checkMine();
    if (FEATURES.stats || FEATURES.reviews) {
      this.loadStats();
      this._stats = setInterval(() => this.loadStats(), STATS_MS);
    }
  }
  // Real numbers from the earnings ledger (and the leaderboard).
  async loadStats() {
    if (
      !(FEATURES.stats || FEATURES.reviews) ||
      this.props.admin ||
      this.state.needDiscord
    )
      return;
    try {
      const res = await this._fetch('/api/teammate/stats', {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const d = await res.json();
      this.setState({
        stats: d.stats,
        board: d.leaderboard,
        meId: d.me,
        statsAt: Date.now(),
      });
    } catch (e) {}
  }
  async checkIn() {
    if (!FEATURES.presence || this.props.admin || this.state.needDiscord)
      return;
    const presenceVersion = this._presenceVersion;
    try {
      const { ok, data } = await this.post('/api/presence', {
        action: 'check-in',
        lastActive: this._lastActive,
      });
      if (!ok || this._disposed || presenceVersion !== this._presenceVersion)
        return;
      if (data.online) {
        this.setState(
          {
            online: true,
            onlineSince: data.onlineSince || Date.now(),
            forced: null,
          },
          () => this.poll(),
        );
      } else if (this.state.online || data.forcedOffline) {
        this._seen = null;
        this.setState({
          online: false,
          queue: [],
          forced: data.forcedOffline,
        });
      }
    } catch {}
  }
  // On load: if this teammate already owns an order (claimed through a handover link, or before
  // a reload), go online and open it.
  async checkMine() {
    if (this.state.needDiscord) return;
    try {
      const { ok, data } = await this.post('/api/desk', {
        online: false,
        lastActive: this._lastActive,
      });
      if (ok && data.mine) {
        const presence = await this.post('/api/presence', {
          action: 'set',
          online: true,
        });
        if (!presence.ok) return;
        this.setState(
          {
            online: true,
            onlineSince: presence.data.onlineSince || Date.now(),
            forced: null,
          },
          () => {
            this.startActive(data.mine, true);
            this.poll();
          },
        );
      }
    } catch (e) {}
  }
  componentWillUnmount() {
    this._disposed = true;
    clearInterval(this._tick);
    clearInterval(this._poll);
    clearInterval(this._presencePoll);
    clearInterval(this._chatPoll);
    clearInterval(this._stats);
    clearTimeout(this._toastT);
    ['pointerdown', 'pointermove', 'keydown', 'wheel'].forEach((ev) =>
      window.removeEventListener(ev, this._activity),
    );
    window.removeEventListener('pagehide', this._leave);
    this.clearChatTimers();
    if (this._bell) this._bell.pause();
  }
  askNotifications() {
    if (
      typeof Notification === 'undefined' ||
      Notification.permission !== 'default'
    )
      return;
    previewPermission()
      .then((p) => this.setState({ notif: p }))
      .catch(() => {});
  }
  // Desktop notification for a new order (the bell already plays, so the notification stays silent).
  notify(o) {
    if (
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    )
      return;
    try {
      const title =
        o.title +
        (o.games > 1 ? ' ×' + o.games : '') +
        ' · ' +
        gameOf(o.game).name;
      const n = new Notification('New Order Available!', {
        body: 'New Order: ' + title + '\nPrice: ' + money(o.payout),
        icon: '/assets/brand/logo-full.webp',
        // one tag per order: a shared tag only replaces the previous popup quietly, so the next order wouldn't pop up
        tag: 'duoly-order-' + (o.id || Date.now()),
        silent: true,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {}
  }
  // "Test" in queue settings: the same bell and a sample popup, worded as a preview, so teammates
  // know what a new order looks and sounds like (and can check their volume and notification settings).
  testAlert() {
    this.playBell();
    if (
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    )
      return;
    try {
      // A reused tag would only quietly replace the last test in the notification centre, so a second
      // press showed nothing: close the previous test and give each one its own tag so it always pops up.
      if (this._testNote) this._testNote.close();
      const n = new Notification('This is how new orders reach you!', {
        body: 'When a customer books one of your games, you’ll hear this bell and get a popup like this one.',
        icon: '/assets/brand/logo-full.webp',
        tag: 'duoly-order-test-' + Date.now(),
        silent: true,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
      this._testNote = n;
    } catch (e) {}
  }
  // New-order bell: the clip is ~3s, played twice back to back (~6s).
  playBell() {
    const bell = this._bell;
    if (!bell) return;
    let plays = 0;
    bell.onended = () => {
      plays += 1;
      if (plays < 2) {
        bell.currentTime = 0;
        bell.play().catch(() => {});
      }
    };
    bell.currentTime = 0;
    bell.play().catch(() => {}); // browsers may block sound until the page has been clicked
  }
  // Does this order match the teammate's queue settings (their games, voice)? Admins see everything.
  // There's no way to dismiss an order: it stays until someone takes it or it's auto-cancelled.
  fits(o) {
    const s = this.state;
    if (this.props.admin) return true;
    return (
      !FEATURES.preferences ||
      (canTake(o, s.access) && !!s.enabled[o.game] && (s.voiceOk || !o.voice))
    );
  }
  // Games this teammate can get orders for: the ones an admin approved (Gamer Girls: every game). Admins: all.
  myGames() {
    const a = this.state.access;
    if (this.props.admin || a.gg) return GAMES;
    return GAMES.filter((g) => a.games.includes(g.id));
  }
  // Check in with the server: says we're online and fetches the shared queue.
  async poll(force = false) {
    if (
      this.props.admin ||
      this.state.needDiscord ||
      (FEATURES.presence && !this.state.online && !this.state.active) ||
      this._completionBusy ||
      this._polling ||
      (this._accepting && !force)
    )
      return;
    this._polling = true;
    const generation = this._generation || 0;
    try {
      const { ok, status, data } = await this.post('/api/desk');
      if (
        this._disposed ||
        this._completionBusy ||
        generation !== (this._generation || 0)
      )
        return;
      if (!ok) {
        if ([401, 403, 404].includes(status)) this.clearPrivateAssignment();
        this.setState({
          readError: true,
          loaded: false,
          queue: [],
          notice:
            status === 401
              ? 'Sign in again to load your desk.'
              : status === 403 || status === 404
                ? 'You no longer have access to this desk.'
                : 'Could not load your desk. Retrying…',
        });
        return;
      }
      this._acceptReadback = false;
      const fresh = this.state.online
        ? newEligibleOrders(this._seen, data.queue, this.state.access, {
            enabledGames: GAME_IDS.filter((id) => this.state.enabled[id]),
            voiceOptIn: this.state.voiceOk,
          })
        : [];
      this._seen = data.queue.map((order) => order.id);
      if (fresh.length) {
        this.playBell();
        fresh.forEach((order) => this.notify(order));
      }
      this.setState({
        queue: data.queue,
        loaded: true,
        readError: false,
        notice: '',
      });
      if (
        data.mine &&
        (!this.state.active ||
          this.state.active.assignmentId !== data.mine.assignmentId)
      )
        this.startActive(data.mine, true);
      else if (!data.mine && this.state.active) {
        this._pendingChat = null;
        this.setState({
          active: null,
          chat: [],
          chatTyping: false,
          proof: [],
          proofErr: '',
        });
      }
    } catch {
      if (!this._disposed)
        this.setState({
          loaded: false,
          readError: true,
          queue: [],
          notice: 'Could not load your desk. Retrying…',
        });
    } finally {
      this._polling = false;
    }
  }
  clearPrivateAssignment() {
    this.clearChatTimers();
    this._pendingChat = null;
    this._typedAt = 0;
    // Revoking private context is not financial confirmation of completion.
    this.setState({
      active: null,
      chat: [],
      chatTyping: false,
      chatDraft: '',
      chatWarn: '',
      chatLocked: true,
      proof: [],
      proofErr: '',
      proofDrag: false,
      copied: false,
    });
  }
  startActive(o, resumed) {
    this.clearChatTimers();
    this._pendingChat = null;
    this._typedAt = 0;
    this.setState(
      {
        active: o,
        offlineBlocked: false,
        proof: [],
        proofErr: '',
        proofDrag: false,
        chat: [],
        chatTyping: false,
        chatDraft: '',
        chatWarn: '',
        copied: false,
        chatLocked: true,
      },
      () => {
        this.pollChat();
        this.loadMatchReport(o);
      },
    );
  }
  // ---- match report (win/loss orders, 20261102160000): every game with both IGNs and the match
  // link, plus wins and losses. Required to finish; the winrate comes from these.
  emptyMatchReport(o) {
    let mine = '';
    try {
      mine = window.localStorage.getItem('duoly-my-ign-' + o.game) || '';
    } catch (e) {}
    return {
      games: Array.from({ length: o.games }, () => ({
        teammateIgn: mine,
        customerIgn: o.ign || '',
        link: '',
      })),
      wins: '',
      losses: '',
      saved: false,
      busy: false,
      err: '',
    };
  }
  async loadMatchReport(o) {
    if (this.props.admin || !tracksWinLoss(o)) {
      this.setState({ matchReport: null });
      return;
    }
    this.setState({ matchReport: this.emptyMatchReport(o) });
    try {
      const res = await this._fetch(
        '/api/orders/' + encodeURIComponent(o.id) + '/match-report',
      );
      const data = await res.json();
      if (res.ok && data.report && this.state.active?.id === o.id)
        this.setState({
          matchReport: {
            games: data.report.games,
            wins: String(data.report.wins),
            losses: String(data.report.losses),
            saved: true,
            busy: false,
            err: '',
          },
        });
    } catch (e) {}
  }
  editMatch(fn) {
    this.setState((st) =>
      st.matchReport
        ? {
            matchReport: {
              ...st.matchReport,
              ...fn(st.matchReport),
              saved: false,
              err: '',
            },
          }
        : null,
    );
  }
  async saveMatchReport() {
    const o = this.state.active;
    const r = this.state.matchReport;
    if (!o || !r || r.busy) return;
    const wins = Number(r.wins);
    const losses = Number(r.losses);
    if (
      !Number.isInteger(wins) ||
      !Number.isInteger(losses) ||
      r.wins === '' ||
      r.losses === '' ||
      wins + losses !== o.games
    )
      return this.setState({
        matchReport: {
          ...r,
          err: 'Wins and losses need to add up to ' + o.games + ' games.',
        },
      });
    this.setState({ matchReport: { ...r, busy: true, err: '' } });
    const { ok, data } = await this.post(
      '/api/orders/' + encodeURIComponent(o.id) + '/match-report',
      { games: r.games, wins, losses },
    ).catch(() => ({ ok: false, data: {} }));
    if (!ok)
      return this.setState({
        matchReport: {
          ...this.state.matchReport,
          busy: false,
          err: data.error || 'Couldn’t save the match report. Try again.',
        },
      });
    try {
      const mine = r.games.find((g) => g.teammateIgn.trim());
      if (mine)
        window.localStorage.setItem(
          'duoly-my-ign-' + o.game,
          mine.teammateIgn.trim(),
        );
    } catch (e) {}
    this.setState({
      matchReport: { ...this.state.matchReport, busy: false, saved: true },
    });
  }
  // A Diamond customer picked this teammate. Passing sends the order to everyone right away.
  async pass(o) {
    if (this.props.admin || this._passing || !o.pickedForYou) return;
    this._passing = true;
    try {
      const { ok } = await this.post(
        '/api/orders/' + encodeURIComponent(o.id),
        { action: 'pass' },
      );
      if (!ok) {
        this.setState({
          notice: 'Could not pass this order. Refresh your desk and try again.',
        });
        return;
      }
      clearTimeout(this._toastT);
      this.setState({ toast: 'Passed. It went to everyone.' });
      this._toastT = setTimeout(() => {
        if (!this._disposed) this.setState({ toast: '' });
      }, 4000);
      this.poll(true);
    } catch {
      this.setState({
        notice: 'Could not pass this order. Refresh your desk and try again.',
      });
    } finally {
      this._passing = false;
    }
  }
  // First to accept gets it: the server says no if someone else was quicker.
  async accept(o) {
    if (
      this.props.admin ||
      this.state.needDiscord ||
      this.state.active ||
      this._accepting ||
      this._acceptReadback ||
      this.state.readError ||
      this._completionBusy
    )
      return;
    this._accepting = true;
    // A command may commit even when its response is lost. Only a fresh desk
    // read can release this lock; retries here are reads, never mutations.
    this._acceptReadback = true;
    this._generation = (this._generation || 0) + 1;
    this.setState({
      accepting: true,
      loaded: false,
      readError: true,
      queue: [],
    });
    try {
      const { ok, data } = await this.post(
        '/api/orders/' + encodeURIComponent(o.id),
        { action: 'accept' },
      );
      if (!ok) {
        this.setState({
          notice:
            data.error ||
            'Acceptance was not confirmed. Refresh before trying again.',
        });
        return;
      }
      // Never open the command result optimistically. Re-read both authoritative resources.
      const result = await this.post('/api/desk');
      if (!result.ok) {
        this.setState({
          loaded: false,
          readError: true,
          notice:
            'Acceptance was confirmed, but the desk could not be refreshed. Retrying…',
        });
        return;
      }
      this._acceptReadback = false;
      this.setState({
        queue: result.data.queue,
        loaded: true,
        readError: false,
        notice: '',
      });
      if (result.data.mine) this.startActive(result.data.mine, false);
    } catch {
      this.setState({
        notice: 'Acceptance was not confirmed. Refresh before trying again.',
      });
    } finally {
      this._accepting = false;
      this.setState({ accepting: false });
    }
  }
  async completed() {
    if (this._completionReading) return;
    this._completionReadback = true;
    this._completionBusy = true;
    this._completionReading = true;
    this.setState({ completionReadback: true, completionReading: true });
    try {
      const { ok, status, data } = await this.post('/api/desk');
      if (!ok && [401, 403, 404].includes(status)) {
        this.clearPrivateAssignment();
        this.setState({
          loaded: false,
          readError: true,
          queue: [],
          notice:
            status === 401
              ? 'Sign in again to read back your desk.'
              : 'You no longer have access to this desk.',
        });
        return;
      }
      if (!ok || data.mine !== null) {
        this.setState({
          notice:
            'Completion recorded, but the current assignment is not confirmed clear. Read back the desk before taking another order.',
        });
        return;
      }
      if (this._disposed) return;
      this._pendingChat = null;
      this._completionReadback = false;
      this._completionBusy = false;
      this.setState({
        active: null,
        chat: [],
        chatTyping: false,
        queue: data.queue,
        loaded: true,
        readError: false,
        notice: 'Completion recorded.',
        proof: [],
        proofErr: '',
        completing: false,
        completionReadback: false,
      });
    } catch {
      if (!this._disposed)
        this.setState({
          notice:
            'Completion recorded. Desk readback is unavailable. Try reading it again.',
        });
    } finally {
      this._completionReading = false;
      if (!this._disposed) this.setState({ completionReading: false });
    }
  }
  // Proof screenshots for "mark as done" (shrunk in the browser, sent with the completion).
  async addProof(fileList) {
    if (!FEATURES.legacyProof) return;
    const files = Array.from(fileList || []).slice(
      0,
      5 - this.state.proof.length,
    );
    if (!files.length) return;
    this.setState({ proofErr: '' });
    for (const f of files) {
      try {
        const data = await shrinkImage(f);
        this.setState((st) => ({
          proof:
            st.proof.length < 5
              ? st.proof.concat([{ id: Date.now() + Math.random(), data }])
              : st.proof,
        }));
      } catch (e) {
        this.setState({ proofErr: e.message });
      }
    }
  }
  async complete(depositRate) {
    if (!FEATURES.legacyProof) return;
    const a = this.state.active;
    if (!a || this.state.completing) return;
    if (!this.state.proof.length)
      return this.setState({
        proofErr: 'Add at least one screenshot first, like your match history.',
      });
    this.setState({ completing: true, proofErr: '' });
    const { ok, data } = await this.post(
      '/api/orders/' + encodeURIComponent(a.id),
      { action: 'complete', proof: this.state.proof.map((p) => p.data) },
    ).catch(() => ({ ok: false, data: {} }));
    this.setState({ completing: false });
    if (!ok)
      return this.setState({
        proofErr: data.error || 'Couldn’t complete the order. Try again.',
      });
    this.clearChatTimers();
    if (this.props.onComplete) this.props.onComplete(data.order || a);
    this.setState({
      chat: [],
      chatTyping: false,
      active: null,
      offlineBlocked: false,
      notice: '',
      proof: [],
      proofErr: '',
    });
    this.loadStats(); // the server's ledger now has this order: earnings, trust level and leaderboard update
  }
  // Admins: a link a teammate can open to grab this order.
  async handover(o) {
    if (!FEATURES.handovers) return;
    const { ok, data } = await this.post(
      '/api/orders/' + encodeURIComponent(o.id),
      { action: 'handover' },
    ).catch(() => ({ ok: false, data: {} }));
    if (!ok)
      return this.setState({
        notice: data.error || 'Couldn’t create a handover link.',
      });
    let copied = false;
    try {
      await navigator.clipboard.writeText(data.url);
      copied = true;
    } catch (e) {}
    this.setState({
      handovers: {
        ...this.state.handovers,
        [o.id]: { url: data.url, expiresAt: data.expiresAt, copied },
      },
    });
    if (this.props.onHandover) this.props.onHandover(o, data.url);
  }
  // Teammates: hand over the order they're playing (the customer asked for someone else). A
  // one-time link for 15 minutes; whoever takes it gets the order and the chat.
  async handoverMine(o) {
    const { ok, data } = await this.post(
      '/api/orders/' + encodeURIComponent(o.id),
      { action: 'handover' },
    ).catch(() => ({ ok: false, data: {} }));
    if (!ok)
      return this.setState({
        notice: data.error || 'Couldn’t create a handover link.',
      });
    let copied = false;
    try {
      await navigator.clipboard.writeText(data.url);
      copied = true;
    } catch (e) {}
    this.setState({
      handovers: {
        ...this.state.handovers,
        [o.id]: { url: data.url, expiresAt: data.expiresAt, copied },
      },
    });
  }
  async cancelHandover(o) {
    const { ok, data } = await this.post(
      '/api/orders/' + encodeURIComponent(o.id),
      { action: 'handover-cancel' },
    ).catch(() => ({ ok: false, data: {} }));
    if (!ok)
      return this.setState({
        notice: data.error || 'Couldn’t cancel the handover link.',
      });
    const rest = { ...this.state.handovers };
    delete rest[o.id];
    this.setState({ handovers: rest });
  }
  copyHandover(id) {
    const h = this.state.handovers[id];
    if (!h) return;
    try {
      navigator.clipboard.writeText(h.url);
    } catch (e) {}
    this.setState({
      handovers: { ...this.state.handovers, [id]: { ...h, copied: true } },
    });
  }
  async setOnline(on) {
    if (this.props.admin && !on) return; // admins are always online
    if (on && this.state.needDiscord) return; // connect Discord first (popup)
    if (!on && this.state.active)
      return this.setState({ offlineBlocked: true });
    const presenceVersion = ++this._presenceVersion;
    // Flip the switch right away; the server confirms (or we roll back) after.
    const before = {
      online: this.state.online,
      onlineSince: this.state.onlineSince,
    };
    const fail = (notice) => {
      if (this._disposed || presenceVersion !== this._presenceVersion) return;
      this.setState({ ...before, notice }, () => before.online && this.poll());
    };
    this._seen = null;
    if (on) {
      this.askNotifications();
      this.setState({
        online: true,
        onlineSince: Date.now(),
        offlineBlocked: false,
        forced: null,
      });
    } else {
      this.setState({ online: false, queue: [], offlineBlocked: false });
    }
    try {
      const { ok, data } = await this.post('/api/presence', {
        action: 'set',
        online: on,
      });
      if (this._disposed || presenceVersion !== this._presenceVersion) return;
      if (!ok)
        return fail(data.error || 'Could not change your online status.');
      if (on)
        this.setState({ onlineSince: data.onlineSince || Date.now() }, () =>
          this.poll(),
        );
    } catch {
      fail('Could not change your online status.');
    }
  }
  renderVals() {
    const s = this.state;
    const u = this.props.user || {};
    const name = u.name || (u.email ? u.email.split('@')[0] : 'Teammate');
    const now = s.now ? s.now + (this._offset || 0) : 0; // server time
    // ---- real earnings (USD, after deposit, plus tips) from the ledger, bucketed into the viewer's own days
    const st = s.stats;
    const recent = st ? st.recent : [];
    const dayStart = (t) => {
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    const todayStart = dayStart(now || Date.now());
    const earn = (e) => e.net + (e.tip || 0);
    const todayList = recent.filter((e) => e.at >= todayStart);
    const today = todayList.reduce((sum, e) => sum + earn(e), 0);
    // this payout period: everything since the last payout day (Friday) started
    const sinceFriday =
      todayStart - ((new Date(todayStart).getDay() - 5 + 7) % 7) * DAY_MS;
    const payoutDue = recent
      .filter((e) => e.at >= sinceFriday)
      .reduce((sum, e) => sum + earn(e), 0);

    // status
    const onlineFor =
      s.online && now ? clock((now - s.onlineSince) / 1000) : '0:00';
    const switchStyle = (big) =>
      'position: relative; flex: 0 0 auto; width: ' +
      (big ? 76 : 44) +
      'px; height: ' +
      (big ? 42 : 26) +
      'px; border-radius: 999px; border: none; padding: 0; transform: none; transition: background-color .2s, box-shadow .2s; ' +
      (s.online
        ? 'background: ' +
          GREEN +
          '; box-shadow: 0 0 0 6px rgba(94, 234, 168, .14), 0 0 40px rgba(94, 234, 168, .35);'
        : 'background: #2A1F45; box-shadow: inset 0 0 0 1px rgba(196, 170, 255, .18);');
    const knobStyle = (big) =>
      'position: absolute; top: ' +
      (big ? 5 : 4) +
      'px; left: ' +
      (s.online ? (big ? 39 : 22) : big ? 5 : 4) +
      'px; width: ' +
      (big ? 32 : 18) +
      'px; height: ' +
      (big ? 32 : 18) +
      'px; border-radius: 50%; transition: left .22s cubic-bezier(.3, 1.4, .5, 1), background-color .2s; display: flex; align-items: center; justify-content: center; ' +
      (s.online ? 'background: #062A1B;' : 'background: #8E84AB;');

    // trust level decides the security deposit held from each payout
    const tier = tierFor(st ? st.completed : 0);
    const depositRate = this.props.admin ? 0 : tier.deposit / 100;
    const depositNote = tier.deposit
      ? '−' + tier.deposit + '% deposit'
      : 'no deposit';

    // available orders: the shared queue, newest first; same for teammates and admins
    const admin = !!this.props.admin;
    const limit = s.autoCancelMs / 1000;
    // (teammates don't get createdAt, so only admins hide an order locally the moment it hits 5:00)
    const available = s.queue
      .filter(
        (o) =>
          this.fits(o) &&
          (!now || !o.createdAt || now - o.createdAt < s.autoCancelMs),
      )
      .map((o) => {
        const waited = Math.max(0, ((now || o.createdAt) - o.createdAt) / 1000);
        const left = Math.max(0, limit - waited);
        const g = gameOf(o.game);
        const h = admin ? s.handovers[o.id] : null;
        return {
          ...o,
          key: o.id,
          img: g.img,
          gameName: g.name,
          payoutLabel: money(o.payout),
          depositNote: FEATURES.trust
            ? admin
              ? 'teammate rate'
              : depositNote
            : 'Order payout',
          gamesLabel:
            o.games + ' ' + (o.unit || 'game') + (o.games === 1 ? '' : 's'),
          // Only the server-projected customer avatar and country are available.
          avatar: o.customerImage || '/assets/avatars/avatar-1.png',
          flagImg: flagSrc(o.flag),
          // the bar fills up towards the 5-minute auto-cancel
          leftLabel:
            'waiting ' +
            waitLabel(waited) +
            ' · ' +
            (left > 0
              ? 'cancels in ' +
                Math.floor(left / 60) +
                ':' +
                String(Math.floor(left % 60)).padStart(2, '0')
              : 'cancelling…'),
          bar:
            'height: 100%; border-radius: 999px; transition: width 1s linear; width: ' +
            Math.min(100, (waited / limit) * 100).toFixed(1) +
            '%; background: ' +
            (left < 60 ? '#FF8A9B' : left < 180 ? '#F0A6FF' : GREEN) +
            ';',
          urgent: left < 60,
          handoverUrl: h ? h.url : '',
          handoverCopied: h ? h.copied : false,
          handoverBy:
            o.handover && !h ? 'Handover link sent by ' + o.handover.by : '',
          makeHandover: () => this.handover(o),
          copyHandover: () => this.copyHandover(o.id),
          accept: () => this.accept(o),
          pass: () => this.pass(o),
        };
      })
      // Picked for you first (the server sorts them first too).
      .sort((a, b) => (b.pickedForYou ? 1 : 0) - (a.pickedForYou ? 1 : 0));
    // admins: orders that hit 5 minutes without a teammate (customer got wallet credit)
    const cancelledOrders = admin
      ? s.cancelled.map((o) => ({
          ...o,
          img: gameOf(o.game).img,
          gameName: gameOf(o.game).name,
          credit:
            '€' +
            Number(
              (o.refund && o.refund.amountEur) || o.amountEur || 0,
            ).toFixed(2),
          ago:
            o.cancelledAt && now
              ? waitLabel(Math.max(0, (now - o.cancelledAt) / 1000)) + ' ago'
              : '',
          // teammates who were online and could have taken it (they get a priority penalty)
          ignoredLabel: (o.ignoredBy || []).length
            ? 'Ignored by ' +
              o.ignoredBy.map((x) => String(x.name).split(' ')[0]).join(', ')
            : '',
        }))
      : [];
    // admins: who's playing what right now, and what just finished
    const liveOrders = admin
      ? s.live.map((o) => ({
          ...o,
          img: gameOf(o.game).img,
          gameName: gameOf(o.game).name,
          who: o.teammate
            ? (o.teammate.id === u.id ? 'You' : o.teammate.name) +
              (o.teammate.admin ? ' (admin)' : '')
            : '—',
          progress:
            o.games +
            ' ' +
            (o.unit || 'game') +
            (o.games === 1 ? '' : 's') +
            (o.rerolls ? ' · re-rolled ' + o.rerolls + '×' : ''),
          since: o.acceptedAt
            ? waitLabel(
                Math.max(0, ((now || o.acceptedAt) - o.acceptedAt) / 1000),
              )
            : '',
        }))
      : [];

    // active order
    let active = null;
    if (s.active) {
      const a = s.active;
      const g = gameOf(a.game);
      const unit = a.unit || 'game';
      const units = a.games + ' ' + unit + (a.games === 1 ? '' : 's');
      active = {
        ...a,
        img: g.img,
        gameName: g.name,
        payoutLabel: money(a.payout),
        netLabel:
          !FEATURES.trust || admin
            ? money(a.payout)
            : money(a.payout * (1 - depositRate)),
        heldLabel: !FEATURES.trust
          ? 'Order payout before completion'
          : admin
            ? 'teammate rate · stays with Duoly'
            : depositRate
              ? money(a.payout * depositRate) + ' held (' + tier.deposit + '%)'
              : 'No deposit held',
        completeLabel: admin
          ? 'Mark as done'
          : 'Mark as done · get ' + money(a.payout * (1 - depositRate)),
        avatar: a.customerImage || '/assets/avatars/avatar-1.png',
        flagImg: flagSrc(a.flag),
        progress: units,
        units,
        // proof: what to screenshot depends on how the order is counted
        proofHint:
          unit === 'hour'
            ? 'Play the full ' +
              units +
              ', then upload screenshots from the session, like your match history or end screens with both names.'
            : (a.games === 1
                ? 'Play the game'
                : 'Play all ' + a.games + ' games') +
              ' with ' +
              a.customer +
              ', then upload your match history or end-of-game screens showing ' +
              (a.games === 1 ? 'it' : 'them') +
              '.',
        // win/loss orders: the match report form (null for other orders)
        matchReport: s.matchReport
          ? {
              ...s.matchReport,
              setGame: (i, key, value) =>
                this.editMatch((r) => ({
                  games: r.games.map((g, j) =>
                    j === i ? { ...g, [key]: value } : g,
                  ),
                })),
              setWins: (value) =>
                this.editMatch(() => ({ wins: value.replace(/\D/g, '') })),
              setLosses: (value) =>
                this.editMatch(() => ({ losses: value.replace(/\D/g, '') })),
              save: () => this.saveMatchReport(),
            }
          : null,
        // handing it over (teammates): the link while it's valid
        ...(() => {
          const h = admin ? null : s.handovers[a.id];
          const live = h && h.expiresAt > Date.now() ? h : null;
          return {
            canHandover: !admin,
            handoverUrl: live ? live.url : '',
            handoverCopied: live ? live.copied : false,
            handoverUntil: live
              ? new Date(live.expiresAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '',
            makeHandover: () => this.handoverMine(a),
            copyHandover: () => this.copyHandover(a.id),
            cancelHandover: () => this.cancelHandover(a),
          };
        })(),
        proof: s.proof,
        proofErr: s.proofErr,
        proofDrag: s.proofDrag,
        canAddProof: s.proof.length < 5,
        canComplete: s.proof.length > 0 && !s.completing,
        completing: s.completing,
        addProof: (files) => this.addProof(files),
        removeProof: (id) =>
          this.setState({
            proof: this.state.proof.filter((p) => p.id !== id),
            proofErr: '',
          }),
        setDrag: (on) => {
          if (this.state.proofDrag !== on) this.setState({ proofDrag: on });
        },
        complete: () => this.complete(depositRate),
      };
    }

    // week earnings chart: the last 7 days of real completions (today last)
    const vals = [6, 5, 4, 3, 2, 1, 0].map((back) => {
      const from = todayStart - back * DAY_MS;
      return recent
        .filter((e) => e.at >= from && e.at < from + DAY_MS)
        .reduce((sum, e) => sum + earn(e), 0);
    });
    const maxV = Math.max(1, Math.max.apply(null, vals));
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayIdx = now ? new Date(now).getDay() : 6;
    const week = vals.map((val, i) => ({
      day: i === 6 ? 'Today' : dayNames[(todayIdx - 6 + i + 7) % 7],
      amount: money(val),
      bar:
        'width: 100%; border-radius: 8px 8px 4px 4px; transition: height .4s ease; height: ' +
        (val ? Math.max(6, (val / maxV) * 100) : 3).toFixed(1) +
        '%; ' +
        (i === 6
          ? 'background: ' + GREEN + ';'
          : val
            ? 'background: rgba(214, 187, 255, .35);'
            : 'background: rgba(196, 170, 255, .1);'),
      dayStyle:
        'font-size: 11.5px; ' +
        (i === 6 ? 'color: #FFFFFF; font-weight: 600;' : 'color: #8E84AB;'),
    }));
    const weekTotal = vals.reduce((a, b) => a + b, 0);

    const mine = this.myGames();
    const games = mine.map((g) => {
      const on = !!s.enabled[g.id];
      return {
        ...g,
        pressed: on ? 'true' : 'false',
        style:
          'display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 12px 6px 6px; border-radius: 14px; text-align: left; font-size: 14px; font-weight: 600; ' +
          (on
            ? 'background: #1B1033; border: 1.5px solid #D6BBFF; color: #FFFFFF;'
            : 'background: #090414; border: 1.5px solid rgba(196, 170, 255, .1); color: #8E84AB;'),
        imgStyle:
          'width: 34px; height: 34px; border-radius: 10px; transition: filter .2s; ' +
          (on ? '' : 'filter: grayscale(1) brightness(.6);'),
        saving: s.settingsSaving || !s.settingsLoaded,
        toggle: () =>
          this.saveQueueSettings(
            { ...this.state.enabled, [g.id]: !on },
            this.state.voiceOk,
          ),
      };
    });
    const enabledCount = mine.filter((g) => s.enabled[g.id]).length;
    // online visual: enabled games light up one after another
    // (the pill shows at most 3 icons, then "+N", so it fits the card with many games)
    const liveAll = mine.filter((g) => s.enabled[g.id]);
    const live = liveAll.slice(0, 3);
    const liveMore = liveAll.length - live.length;
    const cycle = Math.max(live.length, 1) * 0.7;
    const liveGames = live.map((g, i) => ({
      id: g.id,
      img: g.img,
      style:
        'width: 26px; height: 26px; border-radius: 8px; animation: tmlit ' +
        cycle +
        's ease-in-out ' +
        i * 0.7 +
        's infinite; opacity: .35;',
    }));

    return {
      name,
      first: name.split(' ')[0],
      avatar: u.image || '/assets/avatars/avatar-1.png',
      isAdmin: !!u.isAdmin,
      online: s.online,
      offline: FEATURES.presence && !s.online,
      onlineStr: s.online ? 'true' : 'false',
      onlineFor,
      statusTitle: !FEATURES.presence
        ? s.active
          ? 'You’re in a game'
          : 'Ready to play?'
        : s.online
          ? s.active
            ? 'You’re in a game'
            : 'You’re online'
          : 'You’re offline',
      statusSub: !FEATURES.presence
        ? 'Orders for your games show up below. First to accept gets it.'
        : s.online
          ? s.active
            ? 'Finish your order, then pick the next one.'
            : 'Orders for your games show up below. First to accept gets it.'
          : 'Go online to start receiving orders from customers. You choose when you play.',
      switchLabel: s.online ? 'Go offline' : 'Go online',
      bigSwitch: switchStyle(true),
      bigKnob: knobStyle(true),
      smallSwitch: switchStyle(false),
      smallKnob: knobStyle(false),
      toggleOnline: () => this.setOnline(!this.state.online),
      offlineBlocked: s.offlineBlocked,
      forcedNotice: s.forced
        ? 'An admin set you offline' +
          (s.forced.reason ? ' (' + s.forced.reason.toLowerCase() + ')' : '') +
          '. Go online again when you’re back.'
        : '',
      notice: s.notice,
      toast: s.toast || '',
      clearNotice: () => this.setState({ notice: '' }),
      pill:
        'display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 8px 0 14px; border-radius: 999px; font-size: 13.5px; font-weight: 600; ' +
        (s.online
          ? 'background: rgba(94, 234, 168, .1); border: 1px solid rgba(94, 234, 168, .35); color: ' +
            GREEN +
            ';'
          : 'background: transparent; border: 1px solid rgba(196, 170, 255, .16); color: #CFC4EA;'),
      pillText: s.online ? 'Online · ' + onlineFor : 'Offline',
      statusCard:
        'position: relative; overflow: hidden; padding: 28px; border-radius: 28px; transition: border-color .3s, background .3s; ' +
        (s.online
          ? 'background: radial-gradient(70% 120% at 85% 50%, rgba(94, 234, 168, .12), transparent 60%), #120B22; border: 1px solid rgba(94, 234, 168, .3);'
          : 'background: radial-gradient(70% 120% at 85% 50%, rgba(214, 187, 255, .08), transparent 60%), #120B22; border: 1px solid rgba(196, 170, 255, .1);'),
      available,
      hasAvailable: available.length > 0,
      // only while online: after going offline the last load stays marked as loaded, and the
      // offline card ("Orders are hidden") already says what to do
      waiting:
        s.loaded &&
        !s.readError &&
        !s.active &&
        !available.length &&
        !(FEATURES.presence && !s.online),
      showFeed:
        s.loaded &&
        !s.readError &&
        !s.active &&
        !(FEATURES.presence && !s.online),
      admin,
      busy: !!s.active || !!s.accepting || !!s.completing,
      liveOrders,
      hasLive: liveOrders.length > 0,
      cancelledOrders,
      hasCancelled: cancelledOrders.length > 0,
      linksSent: String(Object.keys(s.handovers).length),
      active,
      hasActive: !!active,
      queueCount: String(s.queue.length),
      today: money(today),
      weekTotal: money(weekTotal),
      week,
      payoutDue: money(st && st.payout ? st.payout.due : payoutDue),
      payout: st && st.payout ? st.payout : null,
      todayOrders:
        todayList.filter((e) => !e.adjustment).length === 1
          ? '1 order today'
          : todayList.filter((e) => !e.adjustment).length + ' orders today',
      // manual balance adjustments by admins (last 30 days), with the reason
      adjustments: (st && st.adjustments ? st.adjustments : []).map((a) => ({
        ...a,
        label: (a.amount < 0 ? '−' : '+') + money(Math.abs(a.amount)),
        when: new Date(a.at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        }),
      })),
      statsLoaded: !!st,
      ratingLabel: st && st.rating ? '★ ' + st.rating.toFixed(2) : '—',
      reviewsLabel:
        st && st.reviews
          ? st.reviews + (st.reviews === 1 ? ' review' : ' reviews')
          : 'No reviews yet',
      // winrate from match reports on win/loss orders (20261102160000)
      winrateLabel:
        st && st.winLoss && st.winLoss.wins + st.winLoss.losses > 0
          ? Math.round(
              (100 * st.winLoss.wins) / (st.winLoss.wins + st.winLoss.losses),
            ) + '%'
          : '—',
      winLossLabel:
        st && st.winLoss && st.winLoss.wins + st.winLoss.losses > 0
          ? st.winLoss.wins +
            'W ' +
            st.winLoss.losses +
            'L from your match reports'
          : 'From your match reports',
      tipsLabel: money(st ? st.tipsTotal : 0),
      completedLabel: (st ? st.completed : 0) + ' completed · ' + tier.name,
      latestReviews: st ? st.latestReviews : [],
      trust: {
        completed: st ? st.completed : 0,
        held: st ? st.held : 0,
        saved: st ? st.saved : 0,
      },
      board: s.board,
      // The server sends week, month and all once the leaderboard migration is live.
      boardReady: !!(s.board && s.board.week),
      meId: s.meId,
      leaderMe: { name, avatar: u.image || '/assets/avatars/avatar-1.png' },
      // order chat
      chatMsgs: s.chat.map((m) => ({
        ...m,
        system: m.from === 'system',
        bubble: m.from !== 'system',
        time: new Date(m.at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        row:
          'display: flex; flex-direction: column; ' +
          (m.from === 'me'
            ? 'align-items: flex-end;'
            : 'align-items: flex-start;'),
        style:
          'max-width: 78%; padding: 10px 14px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; animation: tmin .2s ease-out; ' +
          (m.from === 'me'
            ? 'border-radius: 18px 18px 6px 18px; background: #D6BBFF; color: #17092E; font-weight: 500;'
            : 'border-radius: 18px 18px 18px 6px; background: #1B1033; color: #F3EEFF; border: 1px solid rgba(214, 187, 255, .12);'),
      })),
      chatTyping: s.chatTyping,
      chatDraft: s.chatDraft,
      chatWarn: s.chatWarn,
      setChatDraft: (e) => {
        this.setState({ chatDraft: e.target.value, chatWarn: '' });
        if (e.target.value) this.typingPing();
      },
      chatKey: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendChat(this.state.chatDraft);
        }
      },
      sendChat: () => this.sendChat(this.state.chatDraft),
      sendStyle:
        'flex: 0 0 auto; width: 44px; height: 44px; border-radius: 12px; border: none; display: flex; align-items: center; justify-content: center; transform: none; ' +
        (s.chatDraft.trim()
          ? 'background: #D6BBFF; color: #17092E;'
          : 'background: rgba(196, 170, 255, .1); color: #8E84AB;'),
      quickReplies: (s.active
        ? [
            'Sending you an invite now',
            'Ready when you are!',
            'GG! Ready for the next one?',
          ]
        : []
      ).map((text) => ({ text, send: () => this.sendChat(text) })),
      ignLabel: s.active ? IGN_LABEL[s.active.game] : '',
      ign: s.active ? s.active.ign : '',
      copied: s.copied,
      copyIgn: () => {
        try {
          navigator.clipboard.writeText(this.state.active.ign);
        } catch (e) {}
        this.setState({ copied: true });
        clearTimeout(this._copyT);
        this._copyT = setTimeout(() => this.setState({ copied: false }), 1600);
      },
      chatListRef: (el) => {
        this._chatList = el;
      },
      notifState: s.notif || 'default',
      notifOn: s.notif === 'granted',
      notifAsk: !s.notif || s.notif === 'default',
      notifBlocked: s.notif === 'denied',
      notifUnsupported: s.notif === 'unsupported',
      askNotifications: () => this.askNotifications(),
      // A preview of a real new-order alert: the bell plus a popup that explains itself.
      testNotification: () => this.testAlert(),
      games,
      liveGames,
      liveMore,
      enabledLabel: enabledCount + ' of ' + mine.length + ' games',
      // no games approved yet (Gamer Girls don't need any: they get Gamer Girl orders for every game)
      noAccess:
        FEATURES.preferences &&
        !admin &&
        !s.access.gg &&
        !s.access.games.length,
      gamerGirl: !admin && !!s.access.gg,
      // a Gamer Girl teammate approved for comp games too (20261102140000)
      gamerGirlComp: !admin && !!s.access.gg && s.access.games.length > 0,
      noGames: FEATURES.preferences && mine.length > 0 && enabledCount === 0,
      voiceOk: s.voiceOk,
      voiceStr: s.voiceOk ? 'true' : 'false',
      voiceTrack:
        'position: relative; flex: 0 0 auto; width: 44px; height: 26px; border-radius: 999px; border: none; padding: 0; transform: none; transition: background-color .2s; background: ' +
        (s.voiceOk ? '#D6BBFF' : '#2A1F45') +
        ';',
      voiceKnob:
        'position: absolute; top: 4px; left: ' +
        (s.voiceOk ? 22 : 4) +
        'px; width: 18px; height: 18px; border-radius: 50%; transition: left .2s; background: ' +
        (s.voiceOk ? '#17092E' : '#8E84AB') +
        ';',
      settingsSaving: s.settingsSaving || !s.settingsLoaded,
      toggleVoice: () =>
        this.saveQueueSettings(this.state.enabled, !this.state.voiceOk),
      menuOpen: s.menu,
      menuOpenStr: s.menu ? 'true' : 'false',
      toggleMenu: () => this.setState({ menu: !this.state.menu }),
      signOut: () => this.props.onSignOut?.(),
    };
  }

  // Empty queue (shared with the admin Live Desk), plus how long you've been waiting and which
  // games we're listening for.
  renderWaiting(v) {
    const admin = v.admin;
    const on = v.games.filter((g) => g.pressed === 'true');
    const shown = on.slice(0, 5);
    const pill = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      minHeight: '36px',
      padding: '0 14px',
      borderRadius: '999px',
      background: 'rgba(214, 187, 255, .06)',
      border: '1px solid rgba(214, 187, 255, .12)',
      fontSize: '13px',
      fontWeight: '500',
      color: '#A79DC4',
    };
    return (
      <WaitingForOrders
        text={
          admin
            ? 'No open orders. New ones land here as soon as a customer books, so you can hand them to a teammate within 5 minutes.'
            : 'No orders yet. As soon as an eligible order is available, it pops up here.'
        }
      >
        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {FEATURES.presence ? (
            <span style={pill}>
              <svg
                aria-hidden="true"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#D6BBFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              Online for
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}
              >
                {v.onlineFor}
              </span>
            </span>
          ) : null}
          {FEATURES.preferences && (admin || shown.length) ? (
            <span
              style={pill}
              title={admin ? undefined : on.map((g) => g.name).join(', ')}
            >
              {admin ? 'Covering all games' : 'Your games'}
              {admin ? null : (
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {shown.map((g, i) => (
                    <img
                      key={g.id}
                      src={g.img}
                      alt={g.name}
                      width="20"
                      height="20"
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        marginLeft: i ? '-5px' : '0',
                        boxShadow: '0 0 0 2px #110A20',
                      }}
                    />
                  ))}
                  {on.length > shown.length ? (
                    <span
                      style={{
                        marginLeft: '6px',
                        fontSize: '12px',
                        color: '#8E84AB',
                      }}
                    >
                      +{on.length - shown.length}
                    </span>
                  ) : null}
                </span>
              )}
            </span>
          ) : null}
        </div>

        {FEATURES.notifications && !admin && v.notifAsk ? (
          <button
            type="button"
            onClick={v.askNotifications}
            style={{
              marginTop: '18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '40px',
              padding: '0 16px',
              borderRadius: '12px',
              border: '1px solid rgba(214, 187, 255, .2)',
              background: 'transparent',
              color: '#D6BBFF',
              fontSize: '13.5px',
              fontWeight: '600',
            }}
          >
            <svg
              aria-hidden="true"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            Turn on notifications
          </button>
        ) : null}
        {v.noAccess ? (
          <p
            role="status"
            style={{
              margin: '18px 0 0',
              maxWidth: '380px',
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'rgba(255, 210, 122, .08)',
              border: '1px solid rgba(255, 210, 122, .28)',
              color: '#FFE3A8',
              fontSize: '13.5px',
              lineHeight: '1.5',
            }}
          >
            No games are unlocked for you yet. An admin decides which games you
            can take; orders show up here as soon as they approve one.
          </p>
        ) : null}
        {!admin && v.noGames ? (
          <p
            role="status"
            style={{
              margin: '18px 0 0',
              padding: '8px 14px',
              borderRadius: '12px',
              background: 'rgba(240, 166, 255, .1)',
              border: '1px solid rgba(240, 166, 255, .28)',
              color: '#F7D6FF',
              fontSize: '13.5px',
            }}
          >
            Turn on at least one game in Queue settings to get orders.
          </p>
        ) : null}
      </WaitingForOrders>
    );
  }

  // Teammates must connect Discord before they can work: the bot uses it for the Online / In Session /
  // Teammate roles in the Duoly server. Can't be closed; Discord sign-ins never see it (connected already).
  renderDiscordGate() {
    if (this.props.admin || !this.state.needDiscord) return null;
    const RESULT = {
      cancelled:
        'You cancelled on Discord. Connect it to unlock your dashboard.',
      taken:
        'That Discord account is already connected to another Duoly account. Use your own.',
      failed: 'Connecting didn’t work. Please try again.',
      unavailable: 'Discord isn’t set up on this site yet. Ask an admin.',
    };
    const err = RESULT[this.props.discordResult];
    const logo =
      'M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.7 19.7 0 0 0 6 3l1.3-2a12.8 12.8 0 0 1-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.6 19.6 0 0 0 6-3c.5-5.1-.8-9.5-3.6-13.6zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z';
    const perks = [
      ['#5EEAA8', 'Online', 'while your dashboard toggle is on'],
      ['#FFD27A', 'In Session', 'while you’re playing an order'],
      ['#D6BBFF', 'Teammate', 'your role in the Duoly server'],
    ];
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dc-gate-h"
        aria-describedby="dc-gate-p"
        style={{
          position: 'fixed',
          inset: '0',
          zIndex: '100',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: 'rgba(5, 2, 12, .78)',
          backdropFilter: 'blur(10px)',
          animation: 'dlfade .2s ease-out',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '440px',
            padding: '30px 26px 22px',
            borderRadius: '28px',
            background:
              'radial-gradient(120% 70% at 50% 0%, rgba(88, 101, 242, .3), transparent 62%), #140C26',
            border: '1px solid rgba(139, 149, 255, .3)',
            boxShadow: '0 40px 120px rgba(0, 0, 0, .7)',
            textAlign: 'center',
            animation: 'dlpop .25s ease-out',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '76px',
              height: '76px',
              margin: '0 auto',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#5865F2',
              boxShadow: '0 16px 40px rgba(88, 101, 242, .45)',
            }}
          >
            <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24">
              <path fill="#FFFFFF" d={logo} />
            </svg>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: '-6px',
                bottom: '-6px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#D6BBFF',
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#17092E"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
          </div>
          <h2
            id="dc-gate-h"
            style={{
              margin: '20px 0 0',
              fontFamily: DISPLAY,
              fontSize: '26px',
              fontWeight: '800',
              letterSpacing: '-.03em',
              lineHeight: '1.1',
              color: '#FFFFFF',
            }}
          >
            Connect your Discord to start
          </h2>
          <p
            id="dc-gate-p"
            style={{
              margin: '10px auto 0',
              maxWidth: '340px',
              fontSize: '14.5px',
              lineHeight: '1.5',
              color: '#B9AFD6',
            }}
          >
            Every Duoly teammate is linked to Discord. Connect your account to
            take orders.
          </p>
          {FEATURES.presence ? (
            <ul
              style={{
                listStyle: 'none',
                margin: '20px 0 0',
                padding: '6px',
                borderRadius: '18px',
                background: 'rgba(9, 4, 20, .6)',
                border: '1px solid rgba(196, 170, 255, .1)',
                textAlign: 'left',
              }}
            >
              {perks.map(([color, role, when]) => (
                <li
                  key={role}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: color,
                      boxShadow: '0 0 12px ' + color,
                      flex: '0 0 auto',
                    }}
                  />
                  <span style={{ fontSize: '14px', color: '#CFC4EA' }}>
                    <strong style={{ color: '#FFFFFF' }}>{role}</strong> {when}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {err ? (
            <p
              role="alert"
              style={{
                margin: '16px 0 0',
                fontSize: '13.5px',
                fontWeight: '600',
                color: '#FF8A9B',
              }}
            >
              {err}
            </p>
          ) : null}
          <form method="POST" action="/api/discord/link">
            <input type="hidden" name="csrf" value={this.props.csrf} />
            <input type="hidden" name="next" value="teammate" />
            <button
              type="submit"
              disabled={!this.props.discordEnabled}
              autoFocus
              style={{
                marginTop: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                minHeight: '54px',
                borderRadius: '16px',
                background: '#5865F2',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: '700',
                boxShadow: '0 12px 30px rgba(88, 101, 242, .35)',
              }}
            >
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
              >
                <path fill="#FFFFFF" d={logo} />
              </svg>
              Connect Discord
            </button>
          </form>
          {!this.props.discordEnabled ? (
            <p role="alert">
              Discord isn’t set up on this site yet. Ask an admin.
            </p>
          ) : null}
          <p
            style={{ margin: '12px 0 0', fontSize: '12.5px', color: '#8E84AB' }}
          >
            We only see your Discord name and ID. Nothing is ever posted for
            you.
          </p>
          <div
            style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(196, 170, 255, .1)',
              fontSize: '13px',
              color: '#8E84AB',
            }}
          >
            Not you?{' '}
            <button
              type="button"
              onClick={() => this.props.onSignOut?.()}
              style={{
                padding: '0',
                border: 'none',
                background: 'transparent',
                color: '#D6BBFF',
                fontSize: '13px',
                fontWeight: '600',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
                transform: 'none',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const v = this.renderVals();
    const card = {
      borderRadius: '24px',
      background: '#120B22',
      border: '1px solid rgba(196, 170, 255, .08)',
    };
    const h2 = {
      margin: '0',
      fontFamily: DISPLAY,
      fontSize: '22px',
      fontWeight: '700',
      letterSpacing: '-.02em',
      color: '#FFFFFF',
    };
    const label = { fontSize: '13px', color: '#8E84AB' };
    const statNum = {
      fontFamily: DISPLAY,
      fontSize: 'clamp(24px, 5.5vw, 32px)',
      fontWeight: '700',
      letterSpacing: '-.03em',
      color: '#FFFFFF',
      lineHeight: '1.05',
    };
    return (
      <div
        style={{
          minHeight: v.admin ? '0' : '100vh',
          background: v.admin ? 'transparent' : '#090414',
          color: '#F3EEFF',
          fontFamily: 'Geist, system-ui, sans-serif',
          fontSize: '15px',
          lineHeight: '1.5',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {this.renderDiscordGate()}
        <style>{`
          .tm-live-proof button { min-height: 44px; padding: 10px 14px; border: 1px solid rgba(214,187,255,.2); border-radius: 12px; background: #D6BBFF; color: #17092E; font: inherit; font-weight: 600; }
          .tm-live-proof button:disabled { opacity: .5; cursor: not-allowed; }
          .tm-live-proof p { color: #A79DC4; font-size: 13px; line-height: 1.5; }
          .tm-live-proof h3 { font-family: 'Bricolage Grotesque', 'Bricolage Fallback', sans-serif; color: #FFFFFF; }
          .tm-live-proof input[type=file] { min-height: 44px; font: inherit; }
          .tm-live-proof input::file-selector-button { min-height: 44px; border: 1px solid rgba(214,187,255,.2); border-radius: 12px; background: #120B22; color: #D6BBFF; font: inherit; }
        `}</style>
        {/* support chat with teammate answers (Sparky knows their payouts, deposit and games) */}
        {FEATURES.support && !v.admin ? (
          <SupportChat csrf={this.props.csrf} />
        ) : null}
        {v.admin ? null : (
          <header
            style={{
              position: 'sticky',
              top: '0',
              zIndex: '6',
              background: 'rgba(9, 4, 20, .8)',
              backdropFilter: 'blur(14px)',
              borderBottom: '1px solid rgba(196, 170, 255, .08)',
            }}
          >
            <div
              style={{
                maxWidth: '1240px',
                margin: '0 auto',
                padding: '10px 24px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '12px 24px',
              }}
            >
              <a
                href="/"
                aria-label="Duoly home"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textDecoration: 'none',
                }}
              >
                <img
                  src="/assets/brand/logo-wordmark.webp"
                  alt="Duoly"
                  width="104"
                  height="39"
                  style={{ width: '104px', height: '39px', display: 'block' }}
                />
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: '700',
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    padding: '3px 9px',
                    borderRadius: '8px',
                    background: 'rgba(214, 187, 255, .12)',
                    color: '#D6BBFF',
                  }}
                >
                  Teammate
                </span>
              </a>
              {FEATURES.leaderboard && v.boardReady ? (
                <a
                  href="#leaderboard"
                  className="db-nav"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    textDecoration: 'none',
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="#FFD27A"
                  >
                    <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z" />
                  </svg>
                  Leaderboard
                </a>
              ) : null}
              <a
                href="/rules"
                className="db-nav"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  textDecoration: 'none',
                }}
              >
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#D6BBFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
                </svg>
                Rules
              </a>
              <div
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {FEATURES.presence ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={v.onlineStr}
                    aria-label={v.switchLabel}
                    onClick={v.toggleOnline}
                    style={css(v.pill)}
                  >
                    {v.online ? (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: GREEN,
                          animation: 'dlpulse 1.4s ease-in-out infinite',
                        }}
                      />
                    ) : null}
                    {v.pillText}
                    <span style={css(v.smallSwitch)}>
                      <span style={css(v.smallKnob)} />
                    </span>
                  </button>
                ) : null}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={v.toggleMenu}
                    aria-haspopup="menu"
                    aria-expanded={v.menuOpenStr}
                    aria-label="Account menu"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      minHeight: '44px',
                      padding: '0 12px 0 4px',
                      borderRadius: '12px',
                      border: '1px solid rgba(196, 170, 255, .14)',
                      background: 'transparent',
                      color: '#F3EEFF',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    <img
                      src={v.avatar}
                      alt=""
                      width="34"
                      height="34"
                      referrerPolicy="no-referrer"
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                    />
                    <span
                      className="db-hide-sm"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        lineHeight: '1.2',
                      }}
                    >
                      <span>{v.name}</span>
                      {FEATURES.stats ? (
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: '500',
                            color: '#8E84AB',
                          }}
                        >
                          {v.today} today
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {v.menuOpen ? (
                    <div
                      role="menu"
                      style={{
                        position: 'absolute',
                        right: '0',
                        top: 'calc(100% + 8px)',
                        zIndex: '20',
                        width: '240px',
                        padding: '8px',
                        borderRadius: '18px',
                        background: '#170E2C',
                        border: '1px solid rgba(214, 187, 255, .18)',
                        boxShadow: '0 24px 60px rgba(0, 0, 0, .6)',
                        animation: 'dlpop .18s ease-out',
                      }}
                    >
                      <a
                        href="/"
                        role="menuitem"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          minHeight: '42px',
                          padding: '0 10px',
                          borderRadius: '10px',
                          color: '#F3EEFF',
                          fontSize: '14px',
                          fontWeight: '600',
                          textDecoration: 'none',
                        }}
                      >
                        Duoly home
                      </a>
                      <a
                        href="/profile"
                        role="menuitem"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          minHeight: '42px',
                          padding: '0 10px',
                          borderRadius: '10px',
                          color: '#F3EEFF',
                          fontSize: '14px',
                          fontWeight: '600',
                          textDecoration: 'none',
                        }}
                      >
                        Edit profile
                      </a>
                      <a
                        href="/rules"
                        role="menuitem"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          minHeight: '42px',
                          padding: '0 10px',
                          borderRadius: '10px',
                          color: '#F3EEFF',
                          fontSize: '14px',
                          fontWeight: '600',
                          textDecoration: 'none',
                        }}
                      >
                        Teammate rules
                      </a>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={v.signOut}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          minHeight: '42px',
                          padding: '0 10px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'transparent',
                          color: '#F3EEFF',
                          fontSize: '14px',
                          fontWeight: '600',
                          textAlign: 'left',
                          transform: 'none',
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>
        )}

        <main
          id="main-content"
          style={
            v.admin
              ? {}
              : {
                  maxWidth: '1240px',
                  margin: '0 auto',
                  padding: '32px 24px 80px',
                }
          }
        >
          {FEATURES.handovers && v.admin ? (
            <section
              aria-label="Your desk status"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '12px 16px',
                padding: '16px 18px',
                borderRadius: '20px',
                background:
                  'radial-gradient(60% 140% at 0% 50%, rgba(94, 234, 168, .12), transparent 70%), #120B22',
                border: '1px solid rgba(94, 234, 168, .3)',
              }}
            >
              <span
                style={{
                  position: 'relative',
                  width: '44px',
                  height: '44px',
                  flex: '0 0 auto',
                }}
              >
                <img
                  src={v.avatar}
                  alt=""
                  width="44"
                  height="44"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '-1px',
                    bottom: '-1px',
                    width: '13px',
                    height: '13px',
                    borderRadius: '50%',
                    background: GREEN,
                    animation: 'dlpulse 1.6s ease-in-out infinite',
                  }}
                />
              </span>
              <span
                style={{ flex: '1 1 240px', minWidth: '0', lineHeight: '1.35' }}
              >
                <span
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '700',
                    color: '#FFFFFF',
                  }}
                >
                  Watching the queue
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'rgba(94, 234, 168, .12)',
                      color: GREEN,
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="5" y="11" width="14" height="10" rx="2.5" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                    Admin · always on
                  </span>
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '13.5px',
                    color: '#A79DC4',
                  }}
                >
                  Admins don’t play. Get each order to a teammate with a
                  handover link before it hits 5:00 and is cancelled. Watching
                  for {v.onlineFor}.
                </span>
              </span>
              <span style={{ display: 'flex', gap: '8px' }}>
                <span
                  style={{
                    padding: '8px 14px',
                    borderRadius: '14px',
                    background: '#090414',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontFamily: DISPLAY,
                      fontSize: '22px',
                      fontWeight: '700',
                      color: v.available.length ? '#FFD27A' : GREEN,
                      lineHeight: '1.1',
                    }}
                  >
                    {v.available.length}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '11.5px',
                      color: '#8E84AB',
                    }}
                  >
                    waiting
                  </span>
                </span>
                <span
                  style={{
                    padding: '8px 14px',
                    borderRadius: '14px',
                    background: '#090414',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontFamily: DISPLAY,
                      fontSize: '22px',
                      fontWeight: '700',
                      color: '#FFFFFF',
                      lineHeight: '1.1',
                    }}
                  >
                    {v.linksSent}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '11.5px',
                      color: '#8E84AB',
                    }}
                  >
                    links sent
                  </span>
                </span>
              </span>
            </section>
          ) : (
            <section
              aria-labelledby="tm-status-h"
              className="tm-status"
              style={css(v.statusCard)}
            >
              <div style={{ minWidth: '0' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: v.online ? GREEN : '#D6BBFF',
                    letterSpacing: '.02em',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: v.online ? GREEN : '#6A6086',
                      animation: v.online
                        ? 'dlpulse 1.4s ease-in-out infinite'
                        : 'none',
                    }}
                  />
                  {v.online
                    ? 'Live · online for ' + v.onlineFor
                    : 'Hey ' + v.first + ', ready to play?'}
                </div>
                <h1
                  id="tm-status-h"
                  style={{
                    margin: '10px 0 0',
                    fontFamily: DISPLAY,
                    fontWeight: '800',
                    fontSize: 'clamp(36px, 5vw, 56px)',
                    lineHeight: '.98',
                    letterSpacing: '-.04em',
                    color: '#FFFFFF',
                  }}
                >
                  {v.statusTitle}
                </h1>
                <p
                  style={{
                    margin: '12px 0 0',
                    maxWidth: '460px',
                    color: '#A79DC4',
                    fontSize: '16px',
                  }}
                >
                  {v.statusSub}
                </p>
                {FEATURES.presence ? (
                  <div
                    style={{
                      marginTop: '24px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '16px',
                    }}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={v.onlineStr}
                      onClick={v.toggleOnline}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '8px 20px 8px 8px',
                        borderRadius: '999px',
                        border: '1px solid rgba(196, 170, 255, .14)',
                        background: '#090414',
                        color: '#FFFFFF',
                        fontSize: '16px',
                        fontWeight: '700',
                        transform: 'none',
                      }}
                    >
                      <span style={css(v.bigSwitch)}>
                        <span style={css(v.bigKnob)}>
                          {v.online ? (
                            <svg
                              aria-hidden="true"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={GREEN}
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          ) : null}
                        </span>
                      </span>
                      {v.switchLabel}
                    </button>
                    {v.online ? (
                      <span style={{ fontSize: '14px', color: '#A79DC4' }}>
                        <b style={{ color: '#FFFFFF' }}>{v.queueCount}</b>{' '}
                        customers queueing in your games
                      </span>
                    ) : (
                      <span style={{ fontSize: '14px', color: '#8E84AB' }}>
                        Orders stay hidden while you’re offline.
                      </span>
                    )}
                  </div>
                ) : null}
                {v.offlineBlocked ? (
                  <p
                    role="status"
                    style={{
                      margin: '14px 0 0',
                      fontSize: '13.5px',
                      color: '#F7D6FF',
                    }}
                  >
                    Finish your active order before going offline.
                  </p>
                ) : null}
                {v.forcedNotice && v.offline ? (
                  <p
                    role="alert"
                    style={{
                      margin: '14px 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: 'rgba(240, 166, 255, .1)',
                      border: '1px solid rgba(240, 166, 255, .3)',
                      fontSize: '13.5px',
                      color: '#F7D6FF',
                      maxWidth: '520px',
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#F0A6FF"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flex: '0 0 auto' }}
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v5M12 16.5v.5" />
                    </svg>
                    {v.forcedNotice}
                  </p>
                ) : null}
              </div>

              <div
                className="tm-visual"
                aria-hidden="true"
                style={{
                  position: 'relative',
                  height: '260px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {v.online ? (
                  <>
                    <span
                      style={{
                        position: 'absolute',
                        top: '18px',
                        width: '250px',
                        height: '190px',
                        borderRadius: '50%',
                        background:
                          'radial-gradient(closest-side, rgba(94, 234, 168, .26), rgba(94, 234, 168, .08) 55%, transparent)',
                        animation: 'tmglow 3.6s ease-in-out infinite',
                      }}
                    />
                    <img
                      src="/assets/brand/logo-mascots.webp"
                      alt=""
                      width="250"
                      height="158"
                      style={{
                        position: 'relative',
                        top: '-26px',
                        width: '230px',
                        height: 'auto',
                        filter:
                          'drop-shadow(0 18px 40px rgba(94, 234, 168, .25))',
                        animation: 'dlfloat 5s ease-in-out infinite',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: '14px',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px 8px 8px',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        borderRadius: '999px',
                        background: 'rgba(9, 4, 20, .72)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(94, 234, 168, .28)',
                        boxShadow: '0 14px 40px rgba(0, 0, 0, .45)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ display: 'flex', gap: '4px' }}>
                        {v.liveGames.map((g) => (
                          <img
                            key={g.id}
                            src={g.img}
                            alt=""
                            width="26"
                            height="26"
                            style={css(g.style)}
                          />
                        ))}
                        {v.liveMore > 0 ? (
                          <span
                            style={{
                              height: '26px',
                              minWidth: '26px',
                              padding: '0 6px',
                              borderRadius: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'rgba(94, 234, 168, .12)',
                              color: GREEN,
                              fontSize: '11.5px',
                              fontWeight: '700',
                            }}
                          >
                            +{v.liveMore}
                          </span>
                        ) : null}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#F3EEFF',
                        }}
                      >
                        Looking for orders
                        <span style={{ animation: 'tmdot 1.4s infinite' }}>
                          .
                        </span>
                        <span style={{ animation: 'tmdot 1.4s .2s infinite' }}>
                          .
                        </span>
                        <span style={{ animation: 'tmdot 1.4s .4s infinite' }}>
                          .
                        </span>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        position: 'absolute',
                        width: '230px',
                        height: '230px',
                        borderRadius: '50%',
                        background:
                          'radial-gradient(circle, rgba(214, 187, 255, .1), transparent 70%)',
                      }}
                    />
                    <img
                      src="/assets/brand/logo-mascots.webp"
                      alt=""
                      width="250"
                      height="158"
                      style={{
                        position: 'relative',
                        width: '230px',
                        height: 'auto',
                        filter: 'grayscale(.85) brightness(.55)',
                        animation: 'dlfloat 7s ease-in-out infinite',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: '18%',
                        top: '16%',
                        fontFamily: DISPLAY,
                        fontWeight: '800',
                        fontSize: '26px',
                        color: '#6A6086',
                        animation: 'dlfloat 4s ease-in-out infinite',
                      }}
                    >
                      z
                    </span>
                    <span
                      style={{
                        position: 'absolute',
                        right: '10%',
                        top: '6%',
                        fontFamily: DISPLAY,
                        fontWeight: '800',
                        fontSize: '18px',
                        color: '#4A3B70',
                        animation: 'dlfloat 4s ease-in-out -1.5s infinite',
                      }}
                    >
                      z
                    </span>
                  </>
                )}
              </div>
            </section>
          )}

          {v.admin ||
          !(FEATURES.stats || (FEATURES.reviews && v.statsLoaded)) ? null : (
            <section
              aria-label="Your numbers"
              style={{
                marginTop: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px',
              }}
            >
              {FEATURES.stats ? (
                <div
                  style={{
                    ...card,
                    padding: '20px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <span style={label}>Earned today</span>
                  <span style={statNum}>{v.today}</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: GREEN,
                    }}
                  >
                    {v.todayOrders}
                  </span>
                </div>
              ) : null}
              {FEATURES.stats ? (
                <div
                  style={{
                    ...card,
                    padding: '20px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <span style={label}>Last 7 days</span>
                  <span style={statNum}>{v.weekTotal}</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#D6BBFF',
                    }}
                  >
                    {v.completedLabel}
                  </span>
                </div>
              ) : null}
              <div
                style={{
                  ...card,
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <span style={label}>Rating</span>
                <span style={statNum}>{v.ratingLabel}</span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#8E84AB',
                  }}
                >
                  {v.reviewsLabel}
                </span>
              </div>
              <div
                data-winrate
                style={{
                  ...card,
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <span style={label}>Winrate</span>
                <span style={statNum}>{v.winrateLabel}</span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#8E84AB',
                  }}
                >
                  {v.winLossLabel}
                </span>
              </div>
              {FEATURES.stats && FEATURES.tips ? (
                <div
                  style={{
                    ...card,
                    padding: '20px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <span style={label}>Tips received</span>
                  <span style={statNum}>{v.tipsLabel}</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#8E84AB',
                    }}
                  >
                    100% yours, paid with your earnings
                  </span>
                </div>
              ) : null}
            </section>
          )}

          <div
            className="tm-grid"
            style={
              v.admin
                ? { marginTop: '16px', gridTemplateColumns: 'minmax(0, 1fr)' }
                : { marginTop: '20px' }
            }
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                minWidth: '0',
              }}
            >
              {v.hasActive ? (
                <section
                  aria-labelledby="tm-active-h"
                  style={{
                    ...card,
                    padding: '24px',
                    background: '#120B22',
                    border: '1.5px solid rgba(94, 234, 168, .4)',
                    boxShadow: '0 0 60px rgba(94, 234, 168, .08)',
                    animation: 'tmin .3s ease-out',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                        color: GREEN,
                      }}
                    >
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: GREEN,
                          animation: 'dlpulse 1.2s ease-in-out infinite',
                        }}
                      />
                      Active order · {v.active.publicReference} ·{' '}
                      {v.active.progress}
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: '14px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '14px',
                    }}
                  >
                    <img
                      src={v.active.img}
                      alt={v.active.gameName}
                      width="56"
                      height="56"
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                      }}
                    />
                    <div style={{ minWidth: '0', flex: '1 1 160px' }}>
                      <h2 id="tm-active-h" style={h2}>
                        {v.active.title} ×{v.active.games} with{' '}
                        {v.active.customer}
                      </h2>
                      <div style={{ fontSize: '13.5px', color: '#A79DC4' }}>
                        {v.active.from ? 'From ' + v.active.from + ' · ' : ''}
                        {v.active.region} ·{' '}
                        {v.active.voice ? 'Voice on Discord' : 'Text chat only'}
                      </div>
                      {v.active.mood ? (
                        <div className="tm-mood">
                          <MoodBadge id={v.active.mood} />
                          <span>{moodOf(v.active.mood).line}</span>
                        </div>
                      ) : null}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontFamily: DISPLAY,
                          fontSize: '24px',
                          fontWeight: '700',
                          color: GREEN,
                        }}
                      >
                        {v.active.netLabel}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8E84AB' }}>
                        {v.active.heldLabel}
                      </div>
                    </div>
                  </div>
                  {v.active.note ? (
                    <p
                      style={{
                        margin: '14px 0 0',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: '#090414',
                        color: '#CFC4EA',
                        fontSize: '14px',
                      }}
                    >
                      “{v.active.note}”
                    </p>
                  ) : null}
                  {/* win/loss orders: the match report, required before finishing (20261102160000) */}
                  {v.active.matchReport ? (
                    <div
                      data-match-report
                      style={{
                        marginTop: '16px',
                        padding: '16px',
                        borderRadius: '18px',
                        background: '#090414',
                        border:
                          '1px solid ' +
                          (v.active.matchReport.saved
                            ? 'rgba(94, 234, 168, .35)'
                            : 'rgba(196, 170, 255, .1)'),
                      }}
                    >
                      <div style={{ fontWeight: '700', color: '#FFFFFF' }}>
                        Match report
                      </div>
                      <p
                        style={{
                          margin: '2px 0 12px',
                          fontSize: '13px',
                          color: '#A79DC4',
                        }}
                      >
                        Every game: your IGN, the customer’s IGN and the match
                        link. Then how many you won and lost. Needed to finish
                        this order, and it builds your winrate.
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {v.active.matchReport.games.map((g, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                'auto minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.6fr)',
                              gap: '6px',
                              alignItems: 'center',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '12.5px',
                                fontWeight: '700',
                                color: '#8E84AB',
                                minWidth: '52px',
                              }}
                            >
                              Game {i + 1}
                            </span>
                            <input
                              aria-label={'Your IGN, game ' + (i + 1)}
                              placeholder="Your IGN"
                              value={g.teammateIgn}
                              maxLength={64}
                              onChange={(e) =>
                                v.active.matchReport.setGame(
                                  i,
                                  'teammateIgn',
                                  e.target.value,
                                )
                              }
                              style={{
                                minHeight: '38px',
                                padding: '0 10px',
                                borderRadius: '10px',
                                border: '1px solid rgba(196, 170, 255, .16)',
                                background: '#120B22',
                                color: '#FFFFFF',
                                font: 'inherit',
                                fontSize: '13.5px',
                                minWidth: '0',
                              }}
                            />
                            <input
                              aria-label={'Customer IGN, game ' + (i + 1)}
                              placeholder="Customer IGN"
                              value={g.customerIgn}
                              maxLength={64}
                              onChange={(e) =>
                                v.active.matchReport.setGame(
                                  i,
                                  'customerIgn',
                                  e.target.value,
                                )
                              }
                              style={{
                                minHeight: '38px',
                                padding: '0 10px',
                                borderRadius: '10px',
                                border: '1px solid rgba(196, 170, 255, .16)',
                                background: '#120B22',
                                color: '#FFFFFF',
                                font: 'inherit',
                                fontSize: '13.5px',
                                minWidth: '0',
                              }}
                            />
                            <input
                              aria-label={'Match link, game ' + (i + 1)}
                              placeholder="https://… match link"
                              inputMode="url"
                              value={g.link}
                              maxLength={300}
                              onChange={(e) =>
                                v.active.matchReport.setGame(
                                  i,
                                  'link',
                                  e.target.value,
                                )
                              }
                              style={{
                                minHeight: '38px',
                                padding: '0 10px',
                                borderRadius: '10px',
                                border: '1px solid rgba(196, 170, 255, .16)',
                                background: '#120B22',
                                color: '#FFFFFF',
                                font: 'inherit',
                                fontSize: '13.5px',
                                minWidth: '0',
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          marginTop: '12px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px',
                            fontWeight: '700',
                            color: '#5EEAA8',
                          }}
                        >
                          Won
                          <input
                            inputMode="numeric"
                            value={v.active.matchReport.wins}
                            onChange={(e) =>
                              v.active.matchReport.setWins(e.target.value)
                            }
                            style={{
                              minHeight: '38px',
                              padding: '0 10px',
                              borderRadius: '10px',
                              border: '1px solid rgba(196, 170, 255, .16)',
                              background: '#120B22',
                              color: '#FFFFFF',
                              font: 'inherit',
                              fontSize: '13.5px',
                              minWidth: '0',
                              width: '56px',
                              textAlign: 'center',
                            }}
                          />
                        </label>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px',
                            fontWeight: '700',
                            color: '#F0A6FF',
                          }}
                        >
                          Lost
                          <input
                            inputMode="numeric"
                            value={v.active.matchReport.losses}
                            onChange={(e) =>
                              v.active.matchReport.setLosses(e.target.value)
                            }
                            style={{
                              minHeight: '38px',
                              padding: '0 10px',
                              borderRadius: '10px',
                              border: '1px solid rgba(196, 170, 255, .16)',
                              background: '#120B22',
                              color: '#FFFFFF',
                              font: 'inherit',
                              fontSize: '13.5px',
                              minWidth: '0',
                              width: '56px',
                              textAlign: 'center',
                            }}
                          />
                        </label>
                        <span style={{ fontSize: '12.5px', color: '#8E84AB' }}>
                          of {v.active.games}
                        </span>
                        <button
                          type="button"
                          onClick={v.active.matchReport.save}
                          disabled={v.active.matchReport.busy}
                          style={{
                            marginLeft: 'auto',
                            minHeight: '38px',
                            padding: '0 16px',
                            borderRadius: '12px',
                            border: 'none',
                            background: v.active.matchReport.saved
                              ? 'rgba(94, 234, 168, .14)'
                              : '#D6BBFF',
                            color: v.active.matchReport.saved
                              ? '#5EEAA8'
                              : '#17092E',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          {v.active.matchReport.busy
                            ? 'Saving…'
                            : v.active.matchReport.saved
                              ? 'Saved ✓'
                              : 'Save report'}
                        </button>
                      </div>
                      {v.active.matchReport.err ? (
                        <p
                          role="alert"
                          style={{
                            margin: '8px 0 0',
                            fontSize: '13px',
                            color: '#F0A6FF',
                          }}
                        >
                          {v.active.matchReport.err}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {/* finish with proof: screenshots of the match history / session, then mark as done */}
                  <div
                    className="tm-live-proof"
                    style={{
                      marginTop: '16px',
                      padding: '16px',
                      borderRadius: '18px',
                      background: '#090414',
                      border: '1px solid rgba(196, 170, 255, .1)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <span
                        style={{
                          flex: '0 0 auto',
                          width: '34px',
                          height: '34px',
                          borderRadius: '11px',
                          background: 'rgba(214, 187, 255, .12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#D6BBFF"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="3" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </span>
                      <span style={{ minWidth: '0', lineHeight: '1.35' }}>
                        <span
                          style={{
                            display: 'block',
                            fontWeight: '700',
                            color: '#FFFFFF',
                          }}
                        >
                          Finish with proof
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            color: '#A79DC4',
                          }}
                        >
                          {v.active.proofHint}
                        </span>
                      </span>
                    </div>
                    <PrivateProofs
                      key={v.active.assignmentId}
                      orderId={v.active.id}
                      assignmentId={v.active.assignmentId}
                      mode="teammate"
                      csrf={this.props.csrf}
                      onCompleted={() => this.completed()}
                      onCompletionBusyChange={(busy) => {
                        this._completionBusy =
                          busy || !!this._completionReadback;
                        this.setState({ completing: this._completionBusy });
                      }}
                    />
                    {this.state.completionReadback ? (
                      <button
                        type="button"
                        disabled={this.state.completionReading}
                        onClick={() => this.completed()}
                      >
                        Read back desk
                      </button>
                    ) : null}
                    {v.active.canHandover ? (
                      <div
                        data-handover
                        style={{
                          marginTop: '16px',
                          padding: '14px 16px',
                          borderRadius: '16px',
                          background: 'rgba(196, 170, 255, .06)',
                          border: '1px solid rgba(196, 170, 255, .14)',
                        }}
                      >
                        <div style={{ fontWeight: '700', color: '#FFFFFF' }}>
                          Customer asked for another teammate?
                        </div>
                        <p
                          style={{
                            margin: '4px 0 12px',
                            fontSize: '13px',
                            lineHeight: '1.5',
                            color: '#A79DC4',
                          }}
                        >
                          Make a one-time link and send it to that teammate.
                          When they take it, the order and the chat move to them
                          and the customer is told. You don’t get paid for this
                          order then.
                        </p>
                        {v.active.handoverUrl ? (
                          <>
                            <div
                              style={{
                                padding: '10px 12px',
                                borderRadius: '12px',
                                background: '#090414',
                                border: '1px solid rgba(196, 170, 255, .16)',
                                fontFamily: 'ui-monospace, Consolas, monospace',
                                fontSize: '12.5px',
                                color: '#CFC4EA',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {v.active.handoverUrl}
                            </div>
                            <div
                              style={{
                                marginTop: '10px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <button
                                type="button"
                                onClick={v.active.copyHandover}
                                style={{
                                  minHeight: '38px',
                                  padding: '0 14px',
                                  borderRadius: '12px',
                                  border: 'none',
                                  background: '#D6BBFF',
                                  color: '#17092E',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                }}
                              >
                                {v.active.handoverCopied
                                  ? 'Copied'
                                  : 'Copy link'}
                              </button>
                              <button
                                type="button"
                                onClick={v.active.cancelHandover}
                                style={{
                                  minHeight: '38px',
                                  padding: '0 14px',
                                  borderRadius: '12px',
                                  border: '1px solid rgba(196, 170, 255, .2)',
                                  background: 'transparent',
                                  color: '#CFC4EA',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel link
                              </button>
                              <span
                                style={{ fontSize: '12.5px', color: '#8E84AB' }}
                              >
                                Works until {v.active.handoverUntil}, once.
                              </span>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={v.active.makeHandover}
                            style={{
                              minHeight: '40px',
                              padding: '0 16px',
                              borderRadius: '12px',
                              border: '1px solid rgba(214, 187, 255, .35)',
                              background: 'transparent',
                              color: '#F3EEFF',
                              fontWeight: '700',
                              cursor: 'pointer',
                            }}
                          >
                            Hand over this order
                          </button>
                        )}
                      </div>
                    ) : null}
                    {FEATURES.legacyProof ? (
                      <>
                        <div className="tm-proof" style={{ marginTop: '12px' }}>
                          {v.active.proof.map((p, i) => (
                            <span key={p.id} className="tm-proof-thumb">
                              <img src={p.data} alt={'Screenshot ' + (i + 1)} />
                              <button
                                type="button"
                                aria-label={'Remove screenshot ' + (i + 1)}
                                onClick={() => v.active.removeProof(p.id)}
                              >
                                <svg
                                  aria-hidden="true"
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                >
                                  <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))}
                          {v.active.canAddProof ? (
                            <label
                              className={
                                'tm-proof-add' +
                                (v.active.proofDrag ? ' is-drag' : '')
                              }
                              onDragOver={(e) => {
                                e.preventDefault();
                                v.active.setDrag(true);
                              }}
                              onDragLeave={() => v.active.setDrag(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                v.active.setDrag(false);
                                v.active.addProof(e.dataTransfer.files);
                              }}
                            >
                              <input
                                disabled
                                title="Unavailable in the design preview. Do not enter real credentials or upload files."
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                multiple
                                onChange={(e) => {
                                  v.active.addProof(e.target.files);
                                  e.target.value = '';
                                }}
                                style={{
                                  position: 'absolute',
                                  width: '1px',
                                  height: '1px',
                                  opacity: '0',
                                }}
                              />
                              <svg
                                aria-hidden="true"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                              <span>
                                {v.active.proof.length
                                  ? 'Add more'
                                  : 'Add screenshots'}
                              </span>
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: '500',
                                  color: '#6A6086',
                                }}
                              >
                                or drop them here · up to 5
                              </span>
                            </label>
                          ) : null}
                        </div>
                        {v.active.proofErr ? (
                          <p
                            role="alert"
                            style={{
                              margin: '10px 0 0',
                              fontSize: '13px',
                              color: '#F7D6FF',
                            }}
                          >
                            {v.active.proofErr}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={v.active.complete}
                          disabled={!v.active.canComplete}
                          style={{
                            marginTop: '12px',
                            width: '100%',
                            minHeight: '54px',
                            borderRadius: '14px',
                            border: 'none',
                            background: v.active.canComplete
                              ? '#D6BBFF'
                              : 'rgba(214, 187, 255, .14)',
                            color: v.active.canComplete ? '#17092E' : '#8E84AB',
                            fontSize: '16px',
                            fontWeight: '700',
                            cursor: v.active.canComplete
                              ? 'pointer'
                              : 'not-allowed',
                          }}
                        >
                          {v.active.completing
                            ? 'Uploading proof…'
                            : v.active.proof.length
                              ? v.active.completeLabel
                              : 'Add a screenshot to mark as done'}
                        </button>
                      </>
                    ) : null}
                  </div>

                  {this.props.chatEnabled ? (
                    <div
                      aria-labelledby="tm-chat-h"
                      role="region"
                      style={{
                        marginTop: '18px',
                        borderRadius: '20px',
                        background: '#090414',
                        border: '1px solid rgba(196, 170, 255, .1)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '10px 12px',
                          padding: '12px 14px',
                          borderBottom: '1px solid rgba(196, 170, 255, .08)',
                          background: 'rgba(27, 16, 51, .5)',
                        }}
                      >
                        <span
                          style={{
                            position: 'relative',
                            flex: '0 0 auto',
                            width: '38px',
                            height: '38px',
                          }}
                        >
                          <img
                            src={v.active.avatar}
                            alt=""
                            width="38"
                            height="38"
                            referrerPolicy="no-referrer"
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                          {/* Customer presence is not tracked. Do not invent an online dot. */}
                        </span>
                        <span
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            lineHeight: '1.3',
                            minWidth: '0',
                          }}
                        >
                          <span
                            id="tm-chat-h"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: '600',
                              color: '#FFFFFF',
                            }}
                          >
                            Chat with {v.active.customer}
                            {v.active.flagImg ? (
                              <img
                                src={v.active.flagImg}
                                alt=""
                                width="14"
                                height="14"
                                style={{
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '50%',
                                }}
                              />
                            ) : null}
                          </span>
                          <span
                            style={{
                              fontSize: '12.5px',
                              color: v.chatTyping ? GREEN : '#8E84AB',
                            }}
                          >
                            {v.chatTyping
                              ? 'typing…'
                              : v.active.voice
                                ? 'Voice requested'
                                : 'Text only'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={v.copyIgn}
                          title={'Copy ' + v.ignLabel}
                          style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            minHeight: '40px',
                            padding: '0 6px 0 12px',
                            borderRadius: '12px',
                            border: '1px solid rgba(214, 187, 255, .18)',
                            background: '#120B22',
                            color: '#F3EEFF',
                            textAlign: 'left',
                            transform: 'none',
                            maxWidth: '100%',
                          }}
                        >
                          <span
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              lineHeight: '1.2',
                              minWidth: '0',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '11px',
                                color: '#8E84AB',
                                textTransform: 'capitalize',
                              }}
                            >
                              {v.ignLabel}
                            </span>
                            <span
                              style={{
                                fontSize: '13.5px',
                                fontWeight: '700',
                                fontFamily: 'ui-monospace, Consolas, monospace',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {v.ign}
                            </span>
                          </span>
                          <span
                            style={{
                              flex: '0 0 auto',
                              minWidth: '28px',
                              height: '28px',
                              padding: '0 6px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              background: v.copied
                                ? 'rgba(94, 234, 168, .14)'
                                : 'rgba(214, 187, 255, .1)',
                              color: v.copied ? GREEN : '#D6BBFF',
                            }}
                          >
                            {v.copied ? (
                              'Copied'
                            ) : (
                              <svg
                                aria-hidden="true"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect
                                  x="9"
                                  y="9"
                                  width="11"
                                  height="11"
                                  rx="2.5"
                                />
                                <path d="M5 15V6a2 2 0 0 1 2-2h9" />
                              </svg>
                            )}
                          </span>
                        </button>
                      </div>

                      <div
                        ref={v.chatListRef}
                        aria-live="polite"
                        className="dl-scroll"
                        style={{
                          height: '300px',
                          overflowY: 'auto',
                          padding: '16px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        {v.chatMsgs.map((m) =>
                          m.system ? (
                            <div
                              key={m.id}
                              style={{
                                alignSelf: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '5px 12px',
                                borderRadius: '999px',
                                background: 'rgba(196, 170, 255, .06)',
                                fontSize: '12px',
                                color: '#A79DC4',
                                textAlign: 'center',
                                animation: 'tmin .2s ease-out',
                              }}
                            >
                              {m.text}
                              <span style={{ color: '#6A6086' }}>{m.time}</span>
                            </div>
                          ) : (
                            <div key={m.id} style={css(m.row)}>
                              <div style={css(m.style)}>{m.text}</div>
                              <span
                                style={{
                                  marginTop: '3px',
                                  padding: '0 4px',
                                  fontSize: '11px',
                                  color: '#6A6086',
                                }}
                              >
                                {m.from === 'me' ? m.time + ' · Sent' : m.time}
                              </span>
                            </div>
                          ),
                        )}
                        {v.chatTyping ? (
                          <div
                            style={{
                              alignSelf: 'flex-start',
                              display: 'flex',
                              gap: '4px',
                              padding: '12px 14px',
                              borderRadius: '18px 18px 18px 6px',
                              background: '#1B1033',
                              border: '1px solid rgba(214, 187, 255, .12)',
                            }}
                            aria-label={v.active.customer + ' is typing'}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#D6BBFF',
                                animation: 'tmdot 1.2s infinite',
                              }}
                            />
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#D6BBFF',
                                animation: 'tmdot 1.2s .2s infinite',
                              }}
                            />
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#D6BBFF',
                                animation: 'tmdot 1.2s .4s infinite',
                              }}
                            />
                          </div>
                        ) : null}
                      </div>

                      <div
                        style={{
                          padding: '10px 12px 12px',
                          borderTop: '1px solid rgba(196, 170, 255, .08)',
                        }}
                      >
                        {v.chatWarn ? (
                          <div
                            role="alert"
                            style={{
                              marginBottom: '8px',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              background: 'rgba(240, 166, 255, .1)',
                              border: '1px solid rgba(240, 166, 255, .28)',
                              fontSize: '12.5px',
                              color: '#F7D6FF',
                            }}
                          >
                            {v.chatWarn}
                          </div>
                        ) : null}
                        <div
                          style={{
                            display: 'flex',
                            gap: '6px',
                            overflowX: 'auto',
                            paddingBottom: '8px',
                          }}
                        >
                          {v.quickReplies.map((q, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={q.send}
                              disabled={
                                !this.props.chatEnabled ||
                                this.state.chatLocked ||
                                this.state.sendingChat
                              }
                              style={{
                                flex: '0 0 auto',
                                minHeight: '34px',
                                padding: '0 12px',
                                borderRadius: '999px',
                                border: '1px solid rgba(214, 187, 255, .2)',
                                background: 'transparent',
                                color: '#D6BBFF',
                                fontSize: '12.5px',
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                                transform: 'none',
                              }}
                            >
                              {q.text}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <label
                            htmlFor="tm-chat-input"
                            style={{
                              position: 'absolute',
                              width: '1px',
                              height: '1px',
                              overflow: 'hidden',
                              clip: 'rect(0 0 0 0)',
                            }}
                          >
                            Message {v.active.customer}
                          </label>
                          <input
                            id="tm-chat-input"
                            disabled={
                              !this.props.chatEnabled ||
                              this.state.chatLocked ||
                              this.state.sendingChat
                            }
                            type="text"
                            autoComplete="off"
                            placeholder={'Message ' + v.active.customer + '…'}
                            value={v.chatDraft}
                            onChange={v.setChatDraft}
                            onKeyDown={v.chatKey}
                            maxLength={500}
                            style={{
                              flex: '1',
                              minWidth: '0',
                              minHeight: '44px',
                              padding: '0 14px',
                              borderRadius: '12px',
                              background: '#120B22',
                              border: '1px solid rgba(196, 170, 255, .16)',
                              color: '#FFFFFF',
                              fontSize: '14.5px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={v.sendChat}
                            disabled={
                              !this.props.chatEnabled ||
                              this.state.chatLocked ||
                              this.state.sendingChat
                            }
                            aria-label="Send message"
                            style={css(v.sendStyle)}
                          >
                            <svg
                              aria-hidden="true"
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M22 2L11 13" />
                              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p role="status">Order chat is unavailable.</p>
                  )}
                </section>
              ) : null}

              <section
                aria-labelledby="tm-orders-h"
                style={{ ...card, padding: '24px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginBottom: '16px',
                  }}
                >
                  <h2 id="tm-orders-h" style={h2}>
                    Available orders
                  </h2>
                  {v.showFeed ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color: '#A79DC4',
                      }}
                    >
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: GREEN,
                          animation: 'dlpulse 1.4s ease-in-out infinite',
                        }}
                      />
                      {v.admin
                        ? 'Live · every order, right away'
                        : 'Live · updates every few seconds'}
                    </span>
                  ) : null}
                </div>

                {this.state.readError ? (
                  <button
                    type="button"
                    disabled={
                      this.state.accepting || this.state.completionReading
                    }
                    onClick={() =>
                      this._completionReadback ? this.completed() : this.poll()
                    }
                    style={{ minHeight: '44px', marginBottom: '12px' }}
                  >
                    Refresh desk
                  </button>
                ) : null}
                {v.toast ? (
                  <div
                    role="status"
                    data-toast
                    style={{
                      marginBottom: '12px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: 'rgba(94, 234, 168, .1)',
                      border: '1px solid rgba(94, 234, 168, .3)',
                      fontSize: '13.5px',
                      color: '#C9F7E2',
                    }}
                  >
                    {v.toast}
                  </div>
                ) : null}
                {v.notice ? (
                  <div
                    role="status"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '12px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: 'rgba(240, 166, 255, .1)',
                      border: '1px solid rgba(240, 166, 255, .28)',
                      fontSize: '13.5px',
                      color: '#F7D6FF',
                    }}
                  >
                    <span style={{ flex: '1' }}>{v.notice}</span>
                    <button
                      type="button"
                      onClick={v.clearNotice}
                      aria-label="Dismiss"
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'transparent',
                        color: '#F7D6FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: 'none',
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      >
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                ) : null}

                {v.offline ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      padding: '28px 12px 12px',
                    }}
                  >
                    <span
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'rgba(196, 170, 255, .08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#8E84AB"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="4" y="10" width="16" height="11" rx="3" />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      </svg>
                    </span>
                    <div
                      style={{
                        marginTop: '14px',
                        fontFamily: DISPLAY,
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#FFFFFF',
                      }}
                    >
                      Orders are hidden
                    </div>
                    <p
                      style={{
                        margin: '6px 0 18px',
                        maxWidth: '340px',
                        color: '#8E84AB',
                        fontSize: '14px',
                      }}
                    >
                      Go online and orders for your games will drop in here in
                      real time.
                    </p>
                    <button
                      type="button"
                      onClick={v.toggleOnline}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        minHeight: '48px',
                        padding: '0 22px',
                        borderRadius: '14px',
                        border: 'none',
                        background: GREEN,
                        color: '#062A1B',
                        fontSize: '15px',
                        fontWeight: '700',
                      }}
                    >
                      Go online
                    </button>
                  </div>
                ) : null}

                {v.hasActive ? (
                  <p
                    style={{
                      margin: v.admin ? '0 0 10px' : '0',
                      padding: v.admin ? '10px 14px' : '18px',
                      borderRadius: '16px',
                      background: '#090414',
                      color: '#8E84AB',
                      fontSize: '14px',
                      textAlign: 'center',
                    }}
                  >
                    {v.admin
                      ? 'You’re in a game. The queue stays visible; finish your order to take the next one.'
                      : 'New orders are paused while you’re in a game.'}
                  </p>
                ) : null}

                {v.waiting ? this.renderWaiting(v) : null}

                {v.showFeed && v.hasAvailable ? (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: '0',
                      padding: '0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {v.available.map((o) => (
                      <li
                        key={o.key}
                        data-picked={o.pickedForYou ? 'true' : undefined}
                        style={{
                          padding: '16px',
                          borderRadius: '18px',
                          background: o.pickedForYou ? '#160C2A' : '#090414',
                          border: o.pickedForYou
                            ? '1.5px solid #FFD27A'
                            : '1px solid rgba(214, 187, 255, .16)',
                          boxShadow: o.pickedForYou
                            ? '0 0 30px rgba(255, 210, 122, .14)'
                            : 'none',
                          animation: 'tmin .35s ease-out',
                        }}
                      >
                        {o.pickedForYou ? (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: '6px 10px',
                              marginBottom: '12px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: '700',
                                padding: '3px 9px',
                                borderRadius: '7px',
                                background: 'rgba(255, 210, 122, .16)',
                                color: '#FFD27A',
                              }}
                            >
                              Picked for you
                            </span>
                            <span
                              style={{ fontSize: '13px', color: '#CFC4EA' }}
                            >
                              A past customer asked for you. Only you can take
                              this for a moment.
                            </span>
                          </div>
                        ) : null}
                        <div className="tm-order">
                          <img
                            src={o.img}
                            alt={o.gameName}
                            width="52"
                            height="52"
                            style={{
                              width: '100%',
                              maxWidth: '52px',
                              height: 'auto',
                              borderRadius: '14px',
                            }}
                          />
                          <div style={{ minWidth: '0' }}>
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: '6px 8px',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: DISPLAY,
                                  fontSize: '18px',
                                  fontWeight: '700',
                                  color: '#FFFFFF',
                                }}
                              >
                                {o.title}
                              </span>
                              <span
                                style={{ fontSize: '12px', color: '#8E84AB' }}
                              >
                                {o.publicReference}
                              </span>
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  padding: '2px 8px',
                                  borderRadius: '7px',
                                  background: 'rgba(214, 187, 255, .1)',
                                  color: '#D6BBFF',
                                }}
                              >
                                {o.gamesLabel}
                              </span>
                              {o.badge ? (
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    padding: '2px 8px',
                                    borderRadius: '7px',
                                    background: 'rgba(240, 166, 255, .12)',
                                    color: '#F0A6FF',
                                  }}
                                >
                                  {o.badge}
                                </span>
                              ) : null}
                              {o.voice ? (
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    padding: '2px 8px',
                                    borderRadius: '7px',
                                    background: 'rgba(94, 234, 168, .1)',
                                    color: GREEN,
                                  }}
                                >
                                  Voice
                                </span>
                              ) : null}
                              {o.mood ? <MoodBadge id={o.mood} /> : null}
                            </div>
                            <div
                              style={{
                                marginTop: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '13.5px',
                                color: '#A79DC4',
                                minWidth: '0',
                              }}
                            >
                              <span
                                style={{
                                  position: 'relative',
                                  flex: '0 0 auto',
                                  width: '22px',
                                  height: '22px',
                                }}
                              >
                                <img
                                  src={o.avatar}
                                  alt=""
                                  width="22"
                                  height="22"
                                  referrerPolicy="no-referrer"
                                  style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    display: 'block',
                                  }}
                                />
                                {o.flagImg ? (
                                  <img
                                    src={o.flagImg}
                                    alt=""
                                    width="10"
                                    height="10"
                                    style={{
                                      position: 'absolute',
                                      right: '-2px',
                                      bottom: '-2px',
                                      width: '10px',
                                      height: '10px',
                                      borderRadius: '50%',
                                      boxShadow: '0 0 0 1.5px #090414',
                                    }}
                                  />
                                ) : null}
                              </span>
                              <span
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <b
                                  style={{
                                    color: '#F3EEFF',
                                    fontWeight: '600',
                                  }}
                                >
                                  {o.customer}
                                </b>
                                {o.from ? ' · ' + o.from : ''} · {o.region}
                              </span>
                            </div>
                            {o.note ? (
                              <div
                                style={{
                                  marginTop: '6px',
                                  fontSize: '13px',
                                  color: '#8E84AB',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                “{o.note}”
                              </div>
                            ) : null}
                          </div>
                          <div
                            className="tm-order-cta"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <div
                              style={{ textAlign: 'right', marginRight: '4px' }}
                            >
                              <div
                                style={{
                                  fontFamily: DISPLAY,
                                  fontSize: '22px',
                                  fontWeight: '700',
                                  color: GREEN,
                                  lineHeight: '1.1',
                                }}
                              >
                                {o.payoutLabel}
                              </div>
                              <div
                                style={{ fontSize: '11.5px', color: '#8E84AB' }}
                              >
                                {o.depositNote}
                              </div>
                            </div>
                            {FEATURES.handovers && v.admin ? (
                              // admins don't play: their action is getting the order to a teammate
                              <button
                                type="button"
                                onClick={
                                  o.handoverUrl
                                    ? o.copyHandover
                                    : o.makeHandover
                                }
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  minHeight: '44px',
                                  padding: '0 16px',
                                  borderRadius: '12px',
                                  border: 'none',
                                  background: o.handoverCopied
                                    ? GREEN
                                    : '#D6BBFF',
                                  color: o.handoverCopied
                                    ? '#062A1B'
                                    : '#17092E',
                                  fontSize: '14px',
                                  fontWeight: '700',
                                  whiteSpace: 'nowrap',
                                }}
                              >
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
                                  <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                                </svg>
                                {o.handoverUrl
                                  ? o.handoverCopied
                                    ? 'Copied'
                                    : 'Copy link'
                                  : 'Handover link'}
                              </button>
                            ) : (
                              <>
                                {o.pickedForYou ? (
                                  <button
                                    type="button"
                                    onClick={o.pass}
                                    style={{
                                      minHeight: '44px',
                                      padding: '0 16px',
                                      borderRadius: '12px',
                                      background: 'transparent',
                                      border:
                                        '1px solid rgba(196, 170, 255, .24)',
                                      color: '#F3EEFF',
                                      fontSize: '14.5px',
                                      fontWeight: '600',
                                    }}
                                  >
                                    Pass
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={o.accept}
                                  disabled={v.busy}
                                  title={
                                    v.busy
                                      ? 'Finish your current order first'
                                      : undefined
                                  }
                                  style={{
                                    minHeight: '44px',
                                    padding: '0 20px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: '#D6BBFF',
                                    color: '#17092E',
                                    fontSize: '14.5px',
                                    fontWeight: '700',
                                    opacity: v.busy ? '.4' : '1',
                                  }}
                                >
                                  Accept
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {FEATURES.handovers && v.admin ? (
                          // wait time + auto-cancel countdown: admins only
                          <div
                            style={{
                              marginTop: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                            }}
                          >
                            <div
                              style={{
                                flex: '1',
                                height: '4px',
                                borderRadius: '999px',
                                background: 'rgba(196, 170, 255, .1)',
                                overflow: 'hidden',
                              }}
                            >
                              <div style={css(o.bar)} />
                            </div>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: o.urgent ? '700' : '400',
                                color: o.urgent ? '#FF8A9B' : '#8E84AB',
                                minWidth: '64px',
                                textAlign: 'right',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {o.leftLabel}
                            </span>
                          </div>
                        ) : null}
                        {FEATURES.handovers && v.admin ? (
                          o.handoverUrl ? (
                            <div
                              style={{
                                marginTop: '12px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px',
                                borderRadius: '14px',
                                background: 'rgba(214, 187, 255, .06)',
                                border: '1px dashed rgba(214, 187, 255, .3)',
                              }}
                            >
                              <svg
                                aria-hidden="true"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#D6BBFF"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ flex: '0 0 auto' }}
                              >
                                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                              </svg>
                              <label
                                style={{
                                  position: 'absolute',
                                  width: '1px',
                                  height: '1px',
                                  overflow: 'hidden',
                                  clip: 'rect(0 0 0 0)',
                                }}
                                htmlFor={'ho-' + o.id}
                              >
                                Handover link for {o.id}
                              </label>
                              <input
                                id={'ho-' + o.id}
                                readOnly
                                value={o.handoverUrl}
                                onFocus={(e) => e.target.select()}
                                style={{
                                  flex: '1 1 220px',
                                  minWidth: '0',
                                  minHeight: '38px',
                                  padding: '0 10px',
                                  borderRadius: '10px',
                                  background: '#090414',
                                  border: '1px solid rgba(196, 170, 255, .16)',
                                  color: '#FFFFFF',
                                  fontSize: '13px',
                                  fontFamily:
                                    'ui-monospace, Consolas, monospace',
                                }}
                              />
                              <span
                                style={{
                                  flexBasis: '100%',
                                  fontSize: '12px',
                                  color: '#8E84AB',
                                }}
                              >
                                Send it to a teammate. Works until the order is
                                taken or auto-cancels; it stays in the queue
                                meanwhile, so whoever grabs it first gets it.
                              </span>
                            </div>
                          ) : o.handoverBy ? (
                            <div
                              style={{
                                marginTop: '10px',
                                fontSize: '12px',
                                color: '#8E84AB',
                              }}
                            >
                              {o.handoverBy}
                            </div>
                          ) : null
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              {FEATURES.handovers && v.admin ? (
                <section
                  aria-labelledby="tm-live-h"
                  style={{ ...card, padding: '24px' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '12px',
                    }}
                  >
                    <h2 id="tm-live-h" style={h2}>
                      Being played right now
                    </h2>
                    <span style={{ fontSize: '13px', color: '#8E84AB' }}>
                      {v.liveOrders.length} in progress
                    </span>
                  </div>
                  {v.hasLive ? (
                    <ul
                      style={{
                        listStyle: 'none',
                        margin: '0',
                        padding: '0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {v.liveOrders.map((o) => (
                        <li
                          key={o.id}
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '10px 14px',
                            padding: '12px 14px',
                            borderRadius: '16px',
                            background: '#090414',
                            border: '1px solid rgba(158, 230, 255, .14)',
                          }}
                        >
                          <img
                            src={o.img}
                            alt={o.gameName}
                            width="36"
                            height="36"
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                            }}
                          />
                          <span
                            style={{
                              flex: '1 1 200px',
                              minWidth: '0',
                              lineHeight: '1.35',
                            }}
                          >
                            <span
                              style={{
                                display: 'block',
                                fontWeight: '600',
                                color: '#FFFFFF',
                              }}
                            >
                              {o.id} · {o.title}
                              {o.games > 1 ? ' ×' + o.games : ''} for{' '}
                              {o.customer}
                            </span>
                            <span
                              style={{
                                display: 'block',
                                fontSize: '12.5px',
                                color: '#A79DC4',
                              }}
                            >
                              {o.progress} · started {o.since} ago
                            </span>
                          </span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              background: 'rgba(158, 230, 255, .1)',
                              color: '#9EE6FF',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#9EE6FF',
                              }}
                            />
                            {o.who}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      style={{
                        margin: '0',
                        fontSize: '14px',
                        color: '#8E84AB',
                      }}
                    >
                      Nobody is playing an order right now.
                    </p>
                  )}
                </section>
              ) : null}

              {FEATURES.cancelled && v.admin ? (
                <section
                  aria-labelledby="tm-cancel-h"
                  style={{ ...card, padding: '24px' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <h2 id="tm-cancel-h" style={h2}>
                      Auto-cancelled
                    </h2>
                    <span style={{ fontSize: '13px', color: '#8E84AB' }}>
                      last {v.cancelledOrders.length}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: '13.5px',
                      color: '#8E84AB',
                    }}
                  >
                    Nobody took these within 5 minutes. The customer got the
                    full price back as wallet credit to reorder.
                  </p>
                  {v.hasCancelled ? (
                    <ul
                      style={{
                        listStyle: 'none',
                        margin: '0',
                        padding: '0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {v.cancelledOrders.map((o) => (
                        <li
                          key={o.id}
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '10px 14px',
                            padding: '12px 14px',
                            borderRadius: '16px',
                            background: '#090414',
                            border: '1px solid rgba(255, 138, 155, .18)',
                          }}
                        >
                          <img
                            src={o.img}
                            alt={o.gameName}
                            width="36"
                            height="36"
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              filter: 'grayscale(.6)',
                            }}
                          />
                          <span
                            style={{
                              flex: '1 1 200px',
                              minWidth: '0',
                              lineHeight: '1.35',
                            }}
                          >
                            <span
                              style={{
                                display: 'block',
                                fontWeight: '600',
                                color: '#FFFFFF',
                              }}
                            >
                              {o.id} · {o.title}
                              {o.games > 1 ? ' ×' + o.games : ''} for{' '}
                              {o.customer}
                            </span>
                            <span
                              style={{
                                display: 'block',
                                fontSize: '12.5px',
                                color: '#A79DC4',
                              }}
                            >
                              Cancelled {o.ago} · {o.region}
                            </span>
                            {o.ignoredLabel ? (
                              <span
                                title="Online and able to take it for at least a minute, but didn’t. Their priority went up for 7 days."
                                style={{
                                  display: 'block',
                                  marginTop: '2px',
                                  fontSize: '12.5px',
                                  fontWeight: '600',
                                  color: '#F0A6FF',
                                }}
                              >
                                {o.ignoredLabel}
                              </span>
                            ) : null}
                          </span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              background: 'rgba(94, 234, 168, .1)',
                              color: GREEN,
                            }}
                          >
                            +{o.credit} to wallet
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      style={{
                        margin: '0',
                        fontSize: '14px',
                        color: '#8E84AB',
                      }}
                    >
                      None yet. Every order has been taken in time.
                    </p>
                  )}
                </section>
              ) : null}
            </div>

            {v.admin ||
            !(
              FEATURES.stats ||
              FEATURES.preferences ||
              FEATURES.reviews
            ) ? null : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  minWidth: '0',
                }}
              >
                {FEATURES.stats ? (
                  <section
                    aria-labelledby="tm-earn-h"
                    style={{ ...card, padding: '24px' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <h2 id="tm-earn-h" style={h2}>
                        Earnings
                      </h2>
                      <span style={{ fontSize: '13px', color: '#8E84AB' }}>
                        last 7 days
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: '6px',
                        fontFamily: DISPLAY,
                        fontSize: '32px',
                        fontWeight: '700',
                        letterSpacing: '-.03em',
                        color: '#FFFFFF',
                      }}
                    >
                      {v.weekTotal}
                    </div>
                    <div
                      role="img"
                      aria-label={
                        'Earnings over the last 7 days, ' +
                        v.weekTotal +
                        ' in total'
                      }
                      style={{
                        marginTop: '14px',
                        height: '140px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                        gap: '8px',
                        alignItems: 'end',
                      }}
                    >
                      {v.week.map((d, i) => (
                        <div
                          key={i}
                          style={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <div
                            style={{
                              flex: '1',
                              width: '100%',
                              display: 'flex',
                              alignItems: 'flex-end',
                            }}
                          >
                            <div title={d.amount} style={css(d.bar)} />
                          </div>
                          <span style={css(d.dayStyle)}>{d.day}</span>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: '#090414',
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          lineHeight: '1.35',
                        }}
                      >
                        <span style={{ fontSize: '13.5px', color: '#A79DC4' }}>
                          Next payout · Friday
                        </span>
                        <span style={{ fontSize: '11.5px', color: '#6A6086' }}>
                          Earned since last Friday, after deposit, incl. tips
                        </span>
                        {v.payout && v.payout.carried ? (
                          <span
                            style={{ fontSize: '11.5px', color: '#6A6086' }}
                          >
                            Includes {money(v.payout.carried)} carried forward
                          </span>
                        ) : null}
                        {v.payout && v.payout.held ? (
                          <span
                            style={{ fontSize: '11.5px', color: '#FFC46B' }}
                          >
                            {money(v.payout.held)} paused while a report or
                            dispute is open
                          </span>
                        ) : null}
                      </span>
                      <span style={{ fontWeight: '700', color: '#FFFFFF' }}>
                        {v.payoutDue}
                      </span>
                    </div>
                    {v.adjustments.length ? (
                      <ul
                        aria-label="Balance adjustments"
                        style={{
                          listStyle: 'none',
                          margin: '8px 0 0',
                          padding: '0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        {v.adjustments.map((a, i) => (
                          <li
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: '10px',
                              padding: '8px 12px',
                              borderRadius: '12px',
                              background: '#090414',
                              fontSize: '13px',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: '700',
                                color: a.amount < 0 ? '#FF8A9B' : GREEN,
                                flex: '0 0 auto',
                              }}
                            >
                              {a.label}
                            </span>
                            <span
                              style={{
                                color: '#CFC4EA',
                                minWidth: '0',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {a.reason}
                            </span>
                            <span
                              style={{
                                marginLeft: 'auto',
                                color: '#6A6086',
                                fontSize: '12px',
                                flex: '0 0 auto',
                              }}
                            >
                              Adjusted by Duoly · {a.when}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {v.payout ? (
                      <PayoutPanel
                        payout={v.payout}
                        csrf={this.props.csrf}
                        connect={!!this.props.connectPayouts}
                      />
                    ) : null}
                    <LatestReviews reviews={v.latestReviews} />
                  </section>
                ) : FEATURES.reviews &&
                  v.statsLoaded &&
                  v.latestReviews.length ? (
                  <section
                    aria-label="Latest reviews"
                    style={{ ...card, padding: '24px' }}
                  >
                    <LatestReviews reviews={v.latestReviews} />
                  </section>
                ) : null}

                {FEATURES.preferences ? (
                  <section
                    aria-labelledby="tm-settings-h"
                    style={{ ...card, padding: '24px' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <h2 id="tm-settings-h" style={h2}>
                        Queue settings
                      </h2>
                      <span style={{ fontSize: '13px', color: '#8E84AB' }}>
                        {v.enabledLabel}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '4px 0 14px',
                        fontSize: '13.5px',
                        color: '#A79DC4',
                      }}
                    >
                      {v.gamerGirl
                        ? v.gamerGirlComp
                          ? 'You’re a Gamer Girl teammate: Gamer Girl orders for the games you turn on, and comp orders for your approved games.'
                          : 'You’re a Gamer Girl teammate: you get Gamer Girl orders for the games you turn on.'
                        : v.noAccess
                          ? 'No games unlocked yet. An admin approves which games you can take.'
                          : 'You only get orders for the games you turn on. Missing a game? Ask an admin to unlock it.'}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {v.games.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          aria-pressed={g.pressed}
                          disabled={g.saving}
                          onClick={g.toggle}
                          style={css(g.style)}
                        >
                          <img
                            src={g.img}
                            alt=""
                            width="34"
                            height="34"
                            style={css(g.imgStyle)}
                          />
                          {g.name}
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: g.pressed === 'true' ? GREEN : '#6A6086',
                            }}
                          >
                            {g.pressed === 'true' ? 'On' : 'Off'}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: '#090414',
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          lineHeight: '1.35',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#FFFFFF',
                          }}
                        >
                          Voice comms
                        </span>
                        <span style={{ fontSize: '12.5px', color: '#8E84AB' }}>
                          Accept orders that need Discord voice
                        </span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={v.voiceStr}
                        aria-label="Voice comms"
                        disabled={v.settingsSaving}
                        onClick={v.toggleVoice}
                        style={css(v.voiceTrack)}
                      >
                        <span style={css(v.voiceKnob)} />
                      </button>
                    </div>
                    <div
                      style={{
                        marginTop: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: '#090414',
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          lineHeight: '1.35',
                          minWidth: '0',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#FFFFFF',
                          }}
                        >
                          Desktop notifications
                        </span>
                        <span
                          style={{
                            fontSize: '12.5px',
                            color: v.notifBlocked ? '#F7D6FF' : '#8E84AB',
                          }}
                        >
                          {v.notifOn
                            ? 'On · every new order plays the bell and shows a popup. Press Test to try it.'
                            : v.notifBlocked
                              ? 'Blocked · allow them in your browser’s site settings'
                              : v.notifUnsupported
                                ? 'Not supported in this browser'
                                : 'Get a popup even when this tab is in the background'}
                        </span>
                      </span>
                      {v.notifAsk ? (
                        <button
                          type="button"
                          onClick={v.askNotifications}
                          style={{
                            flex: '0 0 auto',
                            minHeight: '36px',
                            padding: '0 14px',
                            borderRadius: '10px',
                            border: 'none',
                            background: '#D6BBFF',
                            color: '#17092E',
                            fontSize: '13px',
                            fontWeight: '700',
                          }}
                        >
                          Turn on
                        </button>
                      ) : null}
                      {v.notifOn ? (
                        <button
                          type="button"
                          onClick={v.testNotification}
                          style={{
                            flex: '0 0 auto',
                            minHeight: '36px',
                            padding: '0 14px',
                            borderRadius: '10px',
                            border: '1px solid rgba(196, 170, 255, .2)',
                            background: 'transparent',
                            color: '#F3EEFF',
                            fontSize: '13px',
                            fontWeight: '600',
                          }}
                        >
                          Test
                        </button>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>

          {/* Twitch streaming (migration 20261105100000); only for teammates with streaming games */}
          {v.admin || this.props.preview || this.state.needDiscord ? null : (
            <StreamingPanel csrf={this.props.csrf} />
          )}
          {/* Performance ranking (migration 20261030120000); hidden until a ranking exists */}
          {v.admin || this.state.needDiscord ? null : <PerformanceCard />}
          {v.admin || !(FEATURES.trust || FEATURES.leaderboard) ? null : (
            <>
              {FEATURES.trust ? (
                <TrustScore
                  completed={v.trust.completed}
                  held={v.trust.held}
                  saved={v.trust.saved}
                />
              ) : null}
              {FEATURES.leaderboard && v.boardReady ? (
                <Leaderboard board={v.board} meId={v.meId} me={v.leaderMe} />
              ) : null}
            </>
          )}
        </main>
      </div>
    );
  }
}
