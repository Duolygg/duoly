import React from 'react';
import { GAMES } from '../../design-reference/lib/adminData';
import { IGN_LABEL } from '../../design-reference/lib/orderGen';
import { BLOCKED, BLOCKED_NOTE } from '../../design-reference/lib/chatRules';
import { newChatPing, playChatPing } from '../../design-reference/lib/sounds';
import { shrinkImage } from '../../design-reference/lib/shrinkImage';
import PrivateProofs from '../proofs/PrivateProofs';
import TipPaymentPanel from './TipPayment';
import { createRoomFetch } from './queue-room-data';
import { TRUSTPILOT_EVALUATE } from '../../site/trustpilot';
import MatchStage, {
  tipMoney,
  BOUNTY,
  ChatPanel,
  CoveredPanel,
  OrderCard,
  ProofPanel,
  QueueSteps,
  QueueTimer,
  ReviewForm,
  ReviewThanks,
  clock,
} from './MatchStage';

// Port of the original components/QueueRoom.jsx (duoly-admin/duoly@7f0299f): layout and copy are
// his. Data and commands go through queue-room-data.js to the real order, chat and proof APIs.
// Report with bounty (#9), review and tip (#7/#10) stay in the file and switch on here.
const FEATURES = { reviews: true, tips: true };

const POLL_MS = 2500;
const DISPLAY = "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif";
const ACCENT = '#D6BBFF',
  GREEN = '#5EEAA8',
  PINK = '#F0A6FF',
  MUTED = '#A79DC4',
  DIM = '#8E84AB';
const TIPS = [
  'Most orders are taken in under 2 minutes.',
  'Every teammate is rank-verified and reviewed after each session.',
  'Not vibing with your teammate? Re-roll for free, twice per order.',
  'Teammates never ask for your login. If one does, report them.',
  'Liked them? Favourite your teammate afterwards and rebook in one tap.',
];

// Server messages, plus my own that are still sending or just sent (a poll that started before the send finished won't have them yet).
const mergeChat = (server, local, me) => {
  const ids = new Set(server.map((m) => m.id));
  return server.concat(
    local.filter(
      (m) =>
        !ids.has(m.id) &&
        (String(m.id).startsWith('tmp') ||
          (m.from === me && Date.now() - m.at < 10000)),
    ),
  );
};
const moneyOf = (paid) =>
  paid
    ? (paid.currency === 'USD' ? '$' : '€') + Number(paid.total).toFixed(2)
    : '';

// The customer's waiting room: live status of their order from search to match to GG.
export default class QueueRoom extends React.Component {
  constructor(props) {
    super(props);
    this._fetch = createRoomFetch({
      orderId: props.id,
      csrf: props.csrf,
      proMember: !!props.proMember,
    });
    this.state = {
      order: null,
      offset: 0,
      now: 0,
      error: '',
      missing: false,
      ask: false,
      cancelling: false,
      notif: 'default',
      tip: 0,
      cycle: 0,
      chat: [],
      chatTyping: false,
      draft: '',
      chatWarn: '',
      unread: 0,
      // modal: null | 'reroll' | 'report'; rep: report form; rv: review + tip form
      modal: null,
      modalErr: '',
      busy: '',
      rep: {
        type: '',
        text: '',
        evidence: [],
        err: '',
        sent: null,
        drag: false,
      },
      tipPayment: null,
      rv: {
        rating: 0,
        hover: 0,
        tags: [],
        text: '',
        tip: 0,
        custom: '',
        err: '',
      },
    };
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
  // ---- chat with the teammate (once someone accepted)
  async pollChat() {
    const o = this.state.order;
    if (
      !o ||
      (o.status !== 'in_progress' && o.status !== 'completed') ||
      this._chatBusy
    )
      return;
    if (o.status === 'completed' && this._chatFinal) return; // finished: one last fetch is enough
    this._chatBusy = true;
    try {
      const res = await this._fetch(
        '/api/orders/' + encodeURIComponent(this.props.id) + '/chat',
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const d = await res.json();
      if (o.status === 'completed') this._chatFinal = true;
      const server = d.messages || [];
      const fresh = server.filter(
        (m) =>
          m.from === 'teammate' && !this.state.chat.some((x) => x.id === m.id),
      );
      const loaded = this._chatLoaded;
      this._chatLoaded = true;
      // new message from the teammate (not on the first load, which only brings older ones)
      if (loaded && fresh.length) playChatPing(this._ping);
      this.setState((s) => ({
        chat: mergeChat(server, s.chat, 'customer'),
        chatTyping: !!d.typing,
        unread: loaded && document.hidden ? s.unread + fresh.length : 0,
      }));
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
    this.setState((s) => ({
      draft: raw == null ? '' : s.draft,
      chatWarn: '',
      chat: s.chat.concat([
        { id: tempId, from: 'customer', text, at: Date.now() },
      ]),
    }));
    try {
      const res = await this._fetch(
        '/api/orders/' + encodeURIComponent(this.props.id) + '/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        },
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok)
        return this.setState((s) => ({
          chat: s.chat.filter((m) => m.id !== tempId),
          draft: text,
          chatWarn: d.error || 'Couldn’t send that. Try again.',
        }));
      // swap the "sending" copy for the saved message
      this.setState((s) => ({
        chat: s.chat
          .filter((m) => m.id !== tempId && m.id !== d.message.id)
          .concat([d.message]),
      }));
    } catch (e) {
      this.setState((s) => ({
        chat: s.chat.filter((m) => m.id !== tempId),
        draft: text,
        chatWarn: 'Can’t reach Duoly right now. Try again.',
      }));
    }
  };
  setDraft = (e) => {
    this.setState({ draft: e.target.value, chatWarn: '' });
    if (e.target.value && Date.now() - (this._typedAt || 0) > 2500) {
      this._typedAt = Date.now();
      this._fetch(
        '/api/orders/' + encodeURIComponent(this.props.id) + '/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ typing: true }),
        },
      ).catch(() => {});
    }
  };
  focusChat = () => {
    const el = document.getElementById('q-chat');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = document.getElementById('q-chat-input');
    if (input) setTimeout(() => input.focus({ preventScroll: true }), 350);
  };
  componentDidMount() {
    this.setState({
      now: Date.now(),
      notif:
        typeof Notification === 'undefined'
          ? 'unsupported'
          : Notification.permission,
    });
    this._bell = new Audio('/assets/sounds/order-bell.wav');
    this._bell.preload = 'auto';
    this._ping = newChatPing();
    this.poll();
    this._poll = setInterval(() => this.poll(), POLL_MS);
    this._tick = setInterval(() => this.setState({ now: Date.now() }), 1000);
    this._tips = setInterval(
      () => this.setState((s) => ({ tip: (s.tip + 1) % TIPS.length })),
      6000,
    );
    this._cycle = setInterval(() => {
      if (!this.state.order || this.state.order.status === 'queued')
        this.setState((s) => ({ cycle: s.cycle + 1 }));
    }, 900);
    this._chatPoll = setInterval(() => this.pollChat(), POLL_MS);
    this._seen = () => {
      if (!document.hidden) this.setState({ unread: 0 });
    };
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
      const res = await this._fetch(
        '/api/orders/' + encodeURIComponent(this.props.id),
        { cache: 'no-store' },
      );
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = '/?signin=1';
        return;
      }
      if (res.status === 404) {
        clearInterval(this._poll);
        return this.setState({ missing: true, error: '' });
      }
      if (!res.ok || !d.order)
        return this.setState({
          error: d.error || 'Couldn’t load your order. Retrying…',
        });
      const prev = this.state.order;
      if (prev && prev.status === 'queued' && d.order.status === 'in_progress')
        this.celebrate(d.order);
      if (d.order.status === 'completed' || d.order.status === 'cancelled')
        clearInterval(this._poll);
      this.setState(
        { order: d.order, offset: d.now ? d.now - Date.now() : 0, error: '' },
        () => {
          if (!prev || prev.status !== d.order.status) this.pollChat(); // chat opens the moment someone accepts
        },
      );
    } catch (e) {
      this.setState({ error: 'Connection lost. Reconnecting…' });
    }
  }
  // Someone took it: sound, desktop notification (if allowed), confetti.
  celebrate(o) {
    try {
      this._bell.currentTime = 0;
      this._bell.play().catch(() => {});
      this._bellStop = setTimeout(() => {
        try {
          this._bell.pause();
        } catch (e) {}
      }, 3000);
    } catch (e) {}
    try {
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        document.hidden
      ) {
        const n = new Notification('You’re matched!', {
          body:
            (o.teammate ? o.teammate.name : 'A teammate') +
            ' accepted your ' +
            o.title +
            '. Jump back in.',
          icon: '/assets/brand/logo-full.webp',
          tag: 'duoly-match-' + o.id,
          silent: true,
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
    } catch (e) {}
    this.setState({ burst: Date.now() });
  }
  askNotify = () => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission()
      .then((p) => this.setState({ notif: p }))
      .catch(() => {});
  };
  cancel = async () => {
    this.setState({ cancelling: true, error: '' });
    try {
      const res = await this._fetch(
        '/api/orders/' + encodeURIComponent(this.props.id),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel' }),
        },
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.setState({
          cancelling: false,
          ask: false,
          error: d.error || 'Couldn’t cancel. Please try again.',
        });
        this.poll();
        return;
      }
      clearInterval(this._poll);
      this.setState({ order: d.order, cancelling: false, ask: false });
    } catch (e) {
      this.setState({
        cancelling: false,
        error: 'Can’t reach Duoly right now. Please try again.',
      });
    }
  };

  // ---- after matching: re-roll, report; after the order: review + tip
  async act(body) {
    const res = await this._fetch(
      '/api/orders/' + encodeURIComponent(this.props.id),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, d };
  }
  reroll = async () => {
    this.setState({ busy: 'reroll', modalErr: '' });
    try {
      const { ok, d } = await this.act({ action: 'reroll' });
      if (!ok)
        return this.setState({
          busy: '',
          modalErr: d.error || 'Couldn’t switch teammates. Try again.',
        });
      this._chatLoaded = false;
      this.setState({
        busy: '',
        modal: null,
        order: {
          ...d.order,
          reports: (this.state.order && this.state.order.reports) || [],
        },
        chat: [],
        chatTyping: false,
        celebrated: false,
      });
    } catch (e) {
      this.setState({
        busy: '',
        modalErr: 'Can’t reach Duoly right now. Try again.',
      });
    }
  };
  addEvidence = async (fileList) => {
    const files = Array.from(fileList || []).slice(
      0,
      5 - this.state.rep.evidence.length,
    );
    for (const f of files) {
      try {
        const data = await shrinkImage(f);
        this.setState((s) => ({
          rep: {
            ...s.rep,
            evidence:
              s.rep.evidence.length < 5
                ? s.rep.evidence.concat([
                    { id: Date.now() + Math.random(), data },
                  ])
                : s.rep.evidence,
            err: '',
          },
        }));
      } catch (e) {
        this.setState((s) => ({ rep: { ...s.rep, err: e.message } }));
      }
    }
  };
  sendReport = async () => {
    const r = this.state.rep;
    if (!r.type)
      return this.setState({ rep: { ...r, err: 'Pick what happened.' } });
    if (r.text.trim().length < 10)
      return this.setState({
        rep: { ...r, err: 'Tell us what happened in a sentence or two.' },
      });
    if (!r.evidence.length)
      return this.setState({
        rep: { ...r, err: 'Add at least one screenshot as proof.' },
      });
    this.setState({ busy: 'report', rep: { ...r, err: '' } });
    try {
      const { ok, d } = await this.act({
        action: 'report',
        type: r.type,
        text: r.text,
        evidence: r.evidence.map((x) => x.data),
      });
      if (!ok)
        return this.setState({
          busy: '',
          rep: {
            ...this.state.rep,
            err: d.error || 'Couldn’t send your report. Try again.',
          },
        });
      this.setState((s) => ({
        busy: '',
        rep: { ...s.rep, sent: d.report },
        order: {
          ...s.order,
          reports: (s.order.reports || []).concat([d.report]),
        },
      }));
    } catch (e) {
      this.setState({
        busy: '',
        rep: {
          ...this.state.rep,
          err: 'Can’t reach Duoly right now. Try again.',
        },
      });
    }
  };
  openReport = (type) =>
    this.setState({
      modal: 'report',
      modalErr: '',
      rep: {
        type: type || '',
        text: '',
        evidence: [],
        err: '',
        sent: null,
        drag: false,
      },
    });
  // review form edits always start from the latest state, so quick clicks don't undo each other
  editRv = (fn) => this.setState((s) => ({ rv: { ...s.rv, ...fn(s.rv) } }));
  sendReview = async () => {
    const rv = this.state.rv;
    if (!rv.rating)
      return this.setState({
        rv: { ...rv, err: 'Tap a star to rate your teammate.' },
      });
    const tip = FEATURES.tips
      ? rv.tip === 'custom'
        ? Number(String(rv.custom).replace(',', '.')) || 0
        : Number(rv.tip) || 0
      : 0;
    // tips are picked in the currency the order was paid in; a USD tip is charged in EUR
    const usd = this.state.order?.paid?.currency === 'USD';
    const sym = usd ? '$' : '€';
    if (tip > 0 && tip < (usd ? 2 : 1))
      return this.setState({
        rv: { ...rv, err: 'Tips start at ' + sym + (usd ? '2.' : '1.') },
      });
    if (tip > 100)
      return this.setState({
        rv: { ...rv, err: 'Tips can be up to ' + sym + '100.' },
      });
    this.setState({ busy: 'review', rv: { ...rv, err: '' } });
    try {
      const { ok, d } = await this.act({
        action: 'review',
        rating: rv.rating,
        tags: rv.tags,
        text: rv.text,
        tip,
        tipCurrency: usd ? 'USD' : 'EUR',
      });
      if (!ok)
        return this.setState({
          busy: '',
          rv: {
            ...this.state.rv,
            err: d.error || 'Couldn’t send that. Try again.',
          },
        });
      this.setState((s) => ({
        busy: '',
        tipPayment: d.tipPayment || null,
        order: { ...d.order, reports: s.order.reports || [] },
        rv: d.tipError ? { ...s.rv, err: d.tipError } : s.rv,
      }));
    } catch (e) {
      this.setState({
        busy: '',
        rv: {
          ...this.state.rv,
          err: 'Can’t reach Duoly right now. Try again.',
        },
      });
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
    // Free monthly coaching (migration 20261026160000): no price, nothing to refund.
    const free = !!(o && o.freePerk);
    const total = o ? (free ? 'Free with your perk' : moneyOf(o.paid)) : '';
    const mate = o && o.teammate ? o.teammate : null;
    const wins = 0;
    const byYou = o && /customer/i.test(o.cancelReason || '');
    const units = o
      ? o.games + ' ' + (o.unit || 'game') + (o.games === 1 ? '' : 's')
      : '';
    const rerolled = !!(o && o.rerolls && o.status === 'queued');

    const head = {
      loading: ['Loading your order…', ''],
      searching: rerolled
        ? [
            'Finding you a new teammate',
            'Your order is back in the queue for other ' +
              (g ? g.name : '') +
              ' teammates. Your last teammate can’t take it again.',
          ]
        : [
            'Finding your teammate',
            'Your order is live for rank-verified ' +
              (g ? g.name : '') +
              ' teammates. We’ll show you who took it the second they accept.',
          ],
      matched: [
        (mate ? mate.name : 'A teammate') + ' is on it!',
        'They accepted your order and will invite ' +
          (o ? o.ign : 'you') +
          ' in-game. Keep ' +
          (g ? g.name : 'your game') +
          ' open.',
      ],
      done: [
        'GG!',
        'Your ' +
          units +
          ' with ' +
          (mate ? mate.name : 'your teammate') +
          ' ' +
          (o && o.games === 1 ? 'is' : 'are') +
          ' done. How was it?',
      ],
      cancelled: [
        byYou ? 'Order cancelled' : 'Nobody was free this time',
        free
          ? 'Nothing was charged. Your free coaching for this month is available again.'
          : 'Nothing was charged: the hold on your ' +
            (total ? total + ' ' : '') +
            'payment is released, usually within a few days depending on your bank.',
      ],
      missing: [
        'We can’t find that order',
        'It may belong to another account. Your orders are on your dashboard.',
      ],
    }[phase];

    if (typeof document !== 'undefined') {
      document.title =
        (s.unread ? '(' + s.unread + ') New message · ' : '') +
        (phase === 'searching'
          ? '(' + clock(waited) + ') Finding your teammate — Duoly'
          : phase === 'matched'
            ? '✓ Matched! — Duoly'
            : phase === 'done'
              ? 'GG — Duoly'
              : 'Your order — Duoly');
    }

    // [label, done, current]
    const steps = [
      [free ? 'Booked' : 'Paid', true, false],
      [
        'In queue',
        phase !== 'searching' && phase !== 'loading',
        phase === 'searching',
      ],
      ['Playing', phase === 'done', phase === 'matched'],
      ['Done', phase === 'done', false],
    ];
    const sym = o && o.paid && o.paid.currency === 'USD' ? '$' : '€';

    return {
      s,
      o,
      g,
      phase,
      head,
      waited,
      limit,
      total,
      free,
      mate,
      wins,
      steps,
      byYou,
      units,
      sym,
      now,
      ignLabel: o ? IGN_LABEL[o.game] || 'in-game name' : '',
    };
  }

  // Matchmaking-style duo: your card ↔ the teammate slot (cycles through faces until someone accepts).
  // Shared with the homepage preview, see MatchStage.jsx.
  renderStage(v) {
    return (
      <MatchStage
        phase={v.phase}
        mate={v.mate}
        order={v.o}
        game={v.g}
        user={this.props.user}
        cycle={this.state.cycle}
        burst={this.state.burst}
      />
    );
  }

  // Chat with the teammate: opens when they accept, read-only once the order is done.
  renderChat(v) {
    const s = this.state;
    return (
      <ChatPanel
        mate={v.mate}
        order={v.o}
        phase={v.phase}
        ignLabel={v.ignLabel}
        chat={s.chat}
        typing={s.chatTyping}
        draft={s.draft}
        warn={s.chatWarn}
        onDraft={this.setDraft}
        onSend={this.send}
        listRef={(el) => {
          this._chatList = el;
        }}
      />
    );
  }

  // Shown once matched: what to do if it isn't working out (re-roll) or the teammate breaks the rules (report, bounty).
  renderProtect(v) {
    return (
      <CoveredPanel
        order={v.o}
        mate={v.mate}
        sym={v.sym}
        now={v.now}
        reportsEnabled={this.props.reportsEnabled}
        onReroll={() => this.setState({ modal: 'reroll', modalErr: '' })}
        onReport={(type) => this.openReport(type)}
      />
    );
  }

  // After the order: stars, quick tags, a few words and a tip. Then a thank-you with what they sent.
  resumeTip = async () => {
    const o = this.state.order;
    if (!o?.review || o.tip?.state !== 'pending' || this.state.busy) return;
    this.setState({ busy: 'review' });
    try {
      const res = await this.api('/api/orders/' + this.props.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          rating: o.review.rating,
          tags: o.review.tags || [],
          text: o.review.text || '',
          tip: o.tip.amount,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'The tip could not open.');
      this.setState((s) => ({
        busy: '',
        tipPayment: d.tipPayment || null,
        order: { ...d.order, reports: s.order.reports || [] },
      }));
    } catch (error) {
      this.setState((s) => ({
        busy: '',
        rv: {
          ...s.rv,
          err:
            error instanceof Error ? error.message : 'The tip could not open.',
        },
      }));
    }
  };

  renderReview(v) {
    const { o, mate, sym } = v;
    const name = mate
      ? String(mate.name).split(' ')[0]
      : o.lastTeammate
        ? o.lastTeammate.name.split(' ')[0]
        : 'your teammate';
    const rv = this.state.rv;
    if (this.state.tipPayment) {
      return (
        <TipPaymentPanel
          payment={this.state.tipPayment}
          onPaid={() =>
            this.setState((s) => ({
              tipPayment: null,
              order: {
                ...s.order,
                tip: s.order.tip ? { ...s.order.tip, state: 'paid' } : null,
              },
            }))
          }
        />
      );
    }

    if (o.review) {
      return (
        <ReviewThanks
          name={name}
          rating={o.review.rating}
          tip={o.tip}
          reviewUrl={TRUSTPILOT_EVALUATE}
        >
          {o.tip?.state === 'pending' ? (
            <button
              type="button"
              className="q-review-send"
              disabled={this.state.busy === 'review'}
              onClick={this.resumeTip}
            >
              {this.state.busy === 'review'
                ? 'Opening payment…'
                : 'Pay ' + tipMoney(o.tip) + ' tip'}
            </button>
          ) : null}
          {rv.err ? (
            <p role="alert" style={{ color: PINK, fontSize: '13.5px' }}>
              {rv.err}
            </p>
          ) : null}
        </ReviewThanks>
      );
    }

    return (
      <ReviewForm
        name={name}
        sym={sym}
        rv={rv}
        busy={this.state.busy === 'review'}
        tips={FEATURES.tips}
        onEdit={this.editRv}
        onSend={this.sendReview}
      />
    );
  }

  // The teammate's screenshots that closed the order.
  renderProof(v) {
    const { o } = v;
    return (
      <ProofPanel
        reportsEnabled={this.props.reportsEnabled}
        onReport={() => this.openReport('')}
      >
        <PrivateProofs orderId={o.id} mode="customer" />
      </ProofPanel>
    );
  }

  renderModal(v) {
    const s = this.state;
    if (!s.modal) return null;
    const { mate, o, sym } = v;
    const name = mate
      ? String(mate.name).split(' ')[0]
      : o && o.lastTeammate
        ? o.lastTeammate.name.split(' ')[0]
        : 'your teammate';
    const close = () => this.setState({ modal: null, modalErr: '' });
    const btn = (primary, extra) => ({
      minHeight: '48px',
      padding: '0 18px',
      borderRadius: '14px',
      fontSize: '15px',
      fontWeight: '700',
      cursor: 'pointer',
      transform: 'none',
      ...(primary
        ? { border: 'none', background: ACCENT, color: '#17092E' }
        : {
            border: '1px solid rgba(196, 170, 255, .2)',
            background: 'transparent',
            color: '#FFFFFF',
          }),
      ...extra,
    });
    let body = null;
    if (s.modal === 'reroll') {
      body = (
        <>
          <h2 id="q-modal-h" className="q-modal-title">
            Switch to a new teammate?
          </h2>
          <p className="q-modal-text">
            {name} leaves your order and it goes straight back into the queue.
            It’s free, you keep everything you paid for, and {name} can’t pick
            it up again.{' '}
            {o.rerollsUnlimited
              ? 'Duoly PRO gives you unlimited re-rolls in the first 5 minutes.'
              : o.rerollsLeft === 1
                ? 'This is your last re-roll on this order.'
                : 'You have ' + o.rerollsLeft + ' re-rolls left.'}
          </p>
          <p className="q-modal-text" style={{ marginTop: '8px' }}>
            If {name} broke a rule, report them instead (or as well) so we can
            act on it.
          </p>
          {s.modalErr ? (
            <p
              role="alert"
              style={{ margin: '12px 0 0', fontSize: '13.5px', color: PINK }}
            >
              {s.modalErr}
            </p>
          ) : null}
          <div className="q-modal-actions">
            <button type="button" onClick={close} style={btn(false)}>
              Keep {name}
            </button>
            <button
              type="button"
              onClick={this.reroll}
              disabled={s.busy === 'reroll'}
              style={btn(true)}
            >
              {s.busy === 'reroll' ? 'Switching…' : 'Re-roll teammate'}
            </button>
          </div>
        </>
      );
    } else if (s.modal === 'report') {
      const r = s.rep;
      if (r.sent) {
        body = (
          <div style={{ textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                width: '56px',
                height: '56px',
                borderRadius: '18px',
                alignItems: 'center',
                justifyContent: 'center',
                background: GREEN,
              }}
            >
              <svg
                aria-hidden="true"
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#062A1B"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <h2
              id="q-modal-h"
              className="q-modal-title"
              style={{ marginTop: '14px' }}
            >
              Report received
            </h2>
            <p className="q-modal-text">
              Thanks for telling us. Our team reviews report{' '}
              <b style={{ color: '#FFFFFF' }}>{r.sent.id}</b> by hand, usually
              within 24 hours. If your proof holds up, you get{' '}
              <b style={{ color: GREEN }}>
                {sym}
                {BOUNTY}
              </b>{' '}
              and we deal with {name}.
            </p>
            <div
              className="q-modal-actions"
              style={{ justifyContent: 'center' }}
            >
              <button type="button" onClick={close} style={btn(true)}>
                Done
              </button>
            </div>
          </div>
        );
      } else {
        const types = [
          [
            'off_platform',
            'Tried to move me off Duoly',
            'Asked me to pay outside Duoly, add them elsewhere, or book them privately.',
          ],
          [
            'toxic',
            'Toxic or disrespectful',
            'Insults, harassment, slurs, throwing or leaving games on purpose.',
          ],
        ];
        body = (
          <>
            <h2 id="q-modal-h" className="q-modal-title">
              Report {name}
            </h2>
            <p className="q-modal-text">
              With solid proof, you get{' '}
              <b style={{ color: GREEN }}>
                {sym}
                {BOUNTY}
              </b>{' '}
              once our team confirms it.
            </p>
            <div
              role="radiogroup"
              aria-label="What happened"
              style={{
                marginTop: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {types.map(([id, title, text]) => {
                const on = r.type === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on ? 'true' : 'false'}
                    onClick={() =>
                      this.setState({ rep: { ...r, type: id, err: '' } })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transform: 'none',
                      border:
                        '1.5px solid ' +
                        (on ? ACCENT : 'rgba(196, 170, 255, .14)'),
                      background: on ? 'rgba(214, 187, 255, .08)' : '#090414',
                      color: '#F3EEFF',
                    }}
                  >
                    <span
                      style={{
                        flex: '0 0 auto',
                        marginTop: '2px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        boxSizing: 'border-box',
                        border: on
                          ? '5px solid ' + ACCENT
                          : '1.5px solid rgba(196, 170, 255, .35)',
                      }}
                    />
                    <span style={{ lineHeight: '1.4' }}>
                      <span
                        style={{
                          display: 'block',
                          fontWeight: '700',
                          color: '#FFFFFF',
                        }}
                      >
                        {title}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          color: MUTED,
                        }}
                      >
                        {text}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <textarea
              value={r.text}
              onChange={(e) =>
                this.setState({ rep: { ...r, text: e.target.value, err: '' } })
              }
              maxLength={1000}
              rows={3}
              placeholder="What happened? When, and what did they say or do?"
              aria-label="What happened"
              style={{
                marginTop: '12px',
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: '14px',
                border: '1px solid rgba(196, 170, 255, .16)',
                background: '#090414',
                color: '#FFFFFF',
                font: 'inherit',
                fontSize: '14px',
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <div
              style={{
                marginTop: '12px',
                fontSize: '13.5px',
                fontWeight: '700',
                color: '#FFFFFF',
              }}
            >
              Proof{' '}
              <span style={{ fontWeight: '500', color: DIM }}>
                · screenshots of the messages or the match, up to 5
              </span>
            </div>
            <div
              data-private-block=""
              className="tm-proof"
              style={{ marginTop: '8px' }}
            >
              {r.evidence.map((p, i) => (
                <span key={p.id} className="tm-proof-thumb">
                  <img src={p.data} alt={'Evidence ' + (i + 1)} />
                  <button
                    type="button"
                    aria-label={'Remove screenshot ' + (i + 1)}
                    onClick={() =>
                      this.setState({
                        rep: {
                          ...r,
                          evidence: r.evidence.filter((x) => x.id !== p.id),
                        },
                      })
                    }
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
              {r.evidence.length < 5 ? (
                <label
                  className={'tm-proof-add' + (r.drag ? ' is-drag' : '')}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!r.drag) this.setState({ rep: { ...r, drag: true } });
                  }}
                  onDragLeave={() =>
                    this.setState({ rep: { ...this.state.rep, drag: false } })
                  }
                  onDrop={(e) => {
                    e.preventDefault();
                    this.setState({ rep: { ...this.state.rep, drag: false } });
                    this.addEvidence(e.dataTransfer.files);
                  }}
                >
                  <input
                    disabled
                    title="Unavailable in the design preview. Do not enter real credentials or upload files."
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(e) => {
                      this.addEvidence(e.target.files);
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
                  <span>Add screenshots</span>
                </label>
              ) : null}
            </div>
            {r.err ? (
              <p
                role="alert"
                style={{ margin: '10px 0 0', fontSize: '13.5px', color: PINK }}
              >
                {r.err}
              </p>
            ) : null}
            <div className="q-modal-actions">
              <button type="button" onClick={close} style={btn(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={this.sendReport}
                disabled={s.busy === 'report'}
                style={btn(true, { background: PINK })}
              >
                {s.busy === 'report' ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </>
        );
      }
    }
    return (
      <div
        className="q-modal-wrap"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="q-modal-h"
          className="q-modal dl-scroll"
        >
          {body}
        </div>
      </div>
    );
  }

  // The order summary (what was booked, rank, in-game name) plus who took it.
  renderOrderCard(v) {
    return (
      <OrderCard
        order={v.o}
        game={v.g}
        total={v.total}
        free={v.free}
        mate={v.mate}
        ignLabel={v.ignLabel}
      />
    );
  }

  render() {
    const v = this.renderVals();
    const { s, o, g, phase, head, waited, limit, total, free, mate } = v;
    const user = this.props.user;
    const card = {
      borderRadius: '24px',
      background: '#120B22',
      border: '1px solid rgba(196, 170, 255, .1)',
    };
    const btn = (primary) => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      minHeight: '50px',
      padding: '0 20px',
      borderRadius: '14px',
      fontSize: '15px',
      fontWeight: '700',
      textDecoration: 'none',
      ...(primary
        ? { border: 'none', background: ACCENT, color: '#17092E' }
        : {
            border: '1px solid rgba(196, 170, 255, .2)',
            background: 'transparent',
            color: '#FFFFFF',
          }),
    });
    const left = Math.max(0, limit - waited);

    return (
      <div
        data-private=""
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(60% 40% at 50% 0%, rgba(214, 187, 255, .1), transparent 70%), #090414',
          color: '#F3EEFF',
          fontFamily: 'Geist, system-ui, sans-serif',
          fontSize: '15px',
          lineHeight: '1.5',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <header
          style={{
            maxWidth: '1180px',
            margin: '0 auto',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <a href="/" aria-label="Duoly home">
            <img
              src="/assets/brand/logo-wordmark.webp"
              alt="Duoly"
              width="96"
              height="36"
              style={{ width: '96px', height: '36px', display: 'block' }}
            />
          </a>
          <a
            href="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '5px 12px 5px 5px',
              borderRadius: '999px',
              border: '1px solid rgba(196, 170, 255, .14)',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '600',
              minWidth: '0',
            }}
          >
            <img
              src={user.image || '/assets/avatars/avatar-1.png'}
              alt=""
              width="30"
              height="30"
              referrerPolicy="no-referrer"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '160px',
              }}
            >
              {user.name}
            </span>
          </a>
        </header>

        <main
          style={{
            maxWidth: '1180px',
            margin: '0 auto',
            padding: '8px 20px 48px',
          }}
        >
          <div className="q-grid">
            {/* stage, and once matched the order card under it (keeps the right column calm) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                minWidth: '0',
              }}
            >
              <section
                aria-live="polite"
                aria-busy={phase === 'loading' ? 'true' : 'false'}
                style={{
                  ...card,
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '28px 24px 26px',
                  textAlign: 'center',
                  background:
                    'radial-gradient(80% 60% at 50% 30%, rgba(214, 187, 255, .08), transparent 70%), #120B22',
                }}
              >
                {phase !== 'missing' ? (
                  this.renderStage(v)
                ) : (
                  <img
                    src="/assets/brand/logo-mascots.webp"
                    alt=""
                    width="200"
                    height="126"
                    style={{
                      width: '200px',
                      height: 'auto',
                      margin: '30px auto',
                      display: 'block',
                      opacity: '.7',
                    }}
                  />
                )}
                <h1
                  style={{
                    margin: '26px 0 0',
                    fontFamily: DISPLAY,
                    fontWeight: '800',
                    fontSize: 'clamp(28px, 3.8vw, 38px)',
                    lineHeight: '1.08',
                    letterSpacing: '-.035em',
                    color: '#FFFFFF',
                  }}
                >
                  {head[0]}
                  {phase === 'searching' ? (
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-flex',
                        gap: '4px',
                        marginLeft: '6px',
                        verticalAlign: 'middle',
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: ACCENT,
                            animation:
                              'dlpulse 1.2s ease-in-out ' +
                              i * 0.2 +
                              's infinite',
                          }}
                        />
                      ))}
                    </span>
                  ) : null}
                </h1>
                {head[1] ? (
                  <p
                    style={{
                      margin: '8px auto 0',
                      maxWidth: '440px',
                      fontSize: '15px',
                      color: MUTED,
                    }}
                  >
                    {head[1]}
                  </p>
                ) : null}

                {phase === 'searching' ? <QueueTimer waited={waited} /> : null}

                {FEATURES.reviews && phase === 'done'
                  ? this.renderReview(v)
                  : null}

                {phase === 'done' ||
                phase === 'cancelled' ||
                phase === 'missing' ? (
                  <div
                    style={{
                      marginTop: '22px',
                      display: 'flex',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    {phase !== 'missing' ? (
                      <a href="/#checkout" style={btn(true)}>
                        Queue again
                      </a>
                    ) : null}
                    <a href="/dashboard" style={btn(phase === 'missing')}>
                      Go to my dashboard
                    </a>
                  </div>
                ) : null}
                {phase === 'matched' || phase === 'playing' ? (
                  <div
                    style={{
                      marginTop: '22px',
                      display: 'flex',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={this.focusChat}
                      style={btn(true)}
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
                        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                      </svg>
                      Message{' '}
                      {mate ? String(mate.name).split(' ')[0] : 'your teammate'}
                    </button>
                    <a href="/dashboard" style={btn(false)}>
                      Dashboard
                    </a>
                  </div>
                ) : null}

                {/* progress steps */}
                {phase !== 'missing' && phase !== 'cancelled' ? (
                  <QueueSteps steps={v.steps} />
                ) : null}
                {s.error ? (
                  <p
                    role="status"
                    style={{
                      margin: '16px 0 0',
                      fontSize: '13.5px',
                      color: PINK,
                    }}
                  >
                    {s.error}
                  </p>
                ) : null}
              </section>
              {phase === 'matched' || phase === 'done'
                ? this.renderOrderCard(v)
                : null}
            </div>

            {/* side */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                minWidth: '0',
              }}
            >
              {/* chat first, then what to do if it isn't working out (re-roll / report) */}
              {this.props.chatEnabled &&
              (phase === 'matched' || phase === 'done')
                ? this.renderChat(v)
                : null}
              {phase === 'matched' || phase === 'done'
                ? this.renderProtect(v)
                : null}
              {phase === 'done' ? this.renderProof(v) : null}
              {phase === 'matched' || phase === 'done' ? null : o ? (
                this.renderOrderCard(v)
              ) : (
                <div
                  aria-hidden="true"
                  style={{ ...card, height: '260px', opacity: '.6' }}
                />
              )}

              {phase === 'searching' ? (
                <>
                  <section
                    aria-labelledby="q-wait-h"
                    style={{ ...card, padding: '20px' }}
                  >
                    <h2
                      id="q-wait-h"
                      style={{
                        margin: '0',
                        fontSize: '12px',
                        fontWeight: '700',
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                        color: DIM,
                      }}
                    >
                      While you wait
                    </h2>
                    <ul
                      style={{
                        listStyle: 'none',
                        margin: '12px 0 0',
                        padding: '0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        fontSize: '14px',
                        color: '#CFC4EA',
                      }}
                    >
                      {[
                        'Launch ' + g.name + ' and get to the lobby',
                        'Have your ' + v.ignLabel + ' ready: ' + o.ign,
                        o.voice
                          ? 'Open Discord so you can hop in voice'
                          : 'Keep this tab open, we’ll show you who took it',
                      ].map((t) => (
                        <li
                          key={t}
                          style={{
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                          }}
                        >
                          <span
                            style={{
                              flex: '0 0 auto',
                              marginTop: '2px',
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: 'rgba(214, 187, 255, .12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg
                              aria-hidden="true"
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                            >
                              <path
                                fill={ACCENT}
                                d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z"
                              />
                            </svg>
                          </span>
                          <span
                            style={{ minWidth: '0', overflowWrap: 'anywhere' }}
                          >
                            {t}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {s.notif === 'default' ? (
                      <button
                        type="button"
                        onClick={this.askNotify}
                        style={{
                          ...btn(false),
                          width: '100%',
                          marginTop: '16px',
                          minHeight: '46px',
                          fontSize: '14px',
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                        </svg>
                        Notify me when I’m matched
                      </button>
                    ) : s.notif === 'granted' ? (
                      <p
                        style={{
                          margin: '14px 0 0',
                          fontSize: '13px',
                          color: GREEN,
                        }}
                      >
                        We’ll notify you here the moment someone accepts.
                      </p>
                    ) : null}
                    <p
                      key={s.tip}
                      style={{
                        margin: '16px 0 0',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: '#090414',
                        fontSize: '13.5px',
                        color: MUTED,
                        animation: 'qtip 6s ease-in-out',
                      }}
                    >
                      <b style={{ color: ACCENT, fontWeight: '700' }}>Tip · </b>
                      {TIPS[s.tip]}
                    </p>
                  </section>

                  <section
                    aria-label="Cancel"
                    style={{ ...card, padding: '18px 20px' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '10px',
                        fontSize: '13px',
                        color: DIM,
                      }}
                    >
                      <span>
                        {free
                          ? 'Nobody free in 5:00? Your free coaching comes back.'
                          : 'Nobody free in 5:00? ' +
                            total +
                            ' back to your Duoly balance.'}
                      </span>
                      <span style={{ color: MUTED, fontWeight: '600' }}>
                        {clock(left)}
                      </span>
                    </div>
                    <div
                      aria-hidden="true"
                      style={{
                        marginTop: '8px',
                        height: '4px',
                        borderRadius: '999px',
                        background: 'rgba(196, 170, 255, .08)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width:
                            Math.min(100, (waited / limit) * 100).toFixed(1) +
                            '%',
                          height: '100%',
                          borderRadius: '999px',
                          background:
                            'linear-gradient(90deg, ' +
                            ACCENT +
                            ', ' +
                            PINK +
                            ')',
                          transition: 'width 1s linear',
                        }}
                      />
                    </div>
                    {s.ask ? (
                      <div
                        role="alertdialog"
                        aria-labelledby="q-cancel-h"
                        style={{
                          marginTop: '14px',
                          padding: '14px',
                          borderRadius: '16px',
                          background: 'rgba(240, 166, 255, .06)',
                          border: '1px solid rgba(240, 166, 255, .25)',
                        }}
                      >
                        <p
                          id="q-cancel-h"
                          style={{
                            margin: '0',
                            fontSize: '14px',
                            color: '#F3EEFF',
                          }}
                        >
                          {free
                            ? 'Cancel and get your free coaching back?'
                            : 'Cancel and get ' +
                              total +
                              ' back to your Duoly balance?'}
                        </p>
                        <div
                          style={{
                            marginTop: '12px',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={this.cancel}
                            disabled={s.cancelling}
                            style={{
                              ...btn(false),
                              minHeight: '44px',
                              borderColor: 'rgba(255, 138, 155, .4)',
                              color: '#FF8A9B',
                            }}
                          >
                            {s.cancelling ? 'Cancelling…' : 'Yes, cancel'}
                          </button>
                          <button
                            type="button"
                            onClick={() => this.setState({ ask: false })}
                            disabled={s.cancelling}
                            style={{ ...btn(true), minHeight: '44px' }}
                          >
                            Keep waiting
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => this.setState({ ask: true })}
                        style={{
                          marginTop: '12px',
                          padding: '0',
                          border: 'none',
                          background: 'transparent',
                          color: MUTED,
                          fontSize: '13.5px',
                          fontWeight: '600',
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px',
                          transform: 'none',
                        }}
                      >
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
