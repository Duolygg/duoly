import { track } from '../../client/analytics/track';
import React from 'react';
import Rewards from './Rewards';
import Favorites from './Favorites';
import FavoriteHeart, { HEART } from './FavoriteHeart';
import SupportChat from '../support/SupportChat';
import { GAME } from '../../design-reference/lib/games';
import { flagSrc } from '../../design-reference/lib/countries';
import { dashboardFetch as fetch } from './dashboard-data';
import TrustBadge from '../shared/TrustBadge';
import { proPrice, proStatusLine } from '../../contracts/pro';

// Port of the original components/Dashboard.jsx (duoly-admin/duoly@7f0299f). Layout and copy are
// his; data comes from /api/orders/active, /history and /credits through dashboard-data.js.
// Sections whose feature isn't live yet stay in the file and switch on here when it ships
// (ledger: wallet #11, rewards #12, reviews and tips #7/#10, Sparky #25, PRO #39).
// The PRO card also needs this.props.pro, which the server sends only while PRO_ENABLED is on.
const FEATURES = {
  wallet: true,
  rewards: true,
  reviews: true,
  support: true,
  pro: true,
};

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

const DISPLAY = "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif";

// Customer dashboard: the open order, order history, stats, teammates and wallet, all from the server.
export default class Dashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      menu: false,
      filter: 'all',
      showAll: false,
      live: null,
      history: null,
      proBusy: false,
      proError: '',
      // favorite teammates (20261106150000): null until loaded
      favs: null,
      favBusy: '',
      favErr: '',
    };
  }
  // Duoly PRO: the Stripe Customer Portal for cancelling or changing the card (ledger #39).
  async openProPortal(event) {
    event.preventDefault();
    if (this.state.proBusy) return;
    this.setState({ proBusy: true, proError: '' });
    try {
      const res = await window.fetch('/api/pro/portal', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf: this.props.csrf }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        track('pro_portal_opened');
        window.location.assign(data.url);
        return;
      }
      this.setState({
        proBusy: false,
        proError: data.error || 'Couldn’t open PRO settings. Try again.',
      });
    } catch {
      this.setState({
        proBusy: false,
        proError: 'Couldn’t open PRO settings. Try again.',
      });
    }
  }
  componentDidMount() {
    this.loadLive();
    this.loadHistory();
    this._live = setInterval(() => this.loadLive(), 5000);
    this._history = setInterval(() => this.loadHistory(), 30000);
    this.loadFavs();
    // who's online changes quickly; the list itself only when you heart someone
    this._favs = setInterval(() => this.loadFavs(), 20000);
  }
  componentWillUnmount() {
    clearInterval(this._live);
    clearInterval(this._history);
    clearInterval(this._favs);
  }
  // Favorite teammates, online first.
  async loadFavs() {
    try {
      const res = await fetch('/api/orders/favorites', { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      if (d && Array.isArray(d.favorites)) this.setState({ favs: d });
    } catch (e) {}
  }
  // Heart or unheart the teammate on one of your orders (handle = that order's id).
  toggleFav = async (handle, on, source) => {
    if (this.state.favBusy) return;
    this.setState({ favBusy: handle, favErr: '' });
    try {
      const res = await window.fetch(
        '/api/orders/' + encodeURIComponent(handle) + '/favorite',
        {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csrf: this.props.csrf, on }),
        },
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok || typeof d.favorite !== 'boolean')
        return this.setState({
          favBusy: '',
          favErr: d.error || 'Couldn’t save that. Try again.',
        });
      track('teammate_favorited', { on, source });
      await this.loadFavs();
      this.setState({ favBusy: '' });
    } catch (e) {
      this.setState({
        favBusy: '',
        favErr: 'Can’t reach Duoly right now. Try again.',
      });
    }
  };
  // Order history, wallet, stats and teammates.
  async loadHistory() {
    try {
      const res = await fetch('/api/me/history', { cache: 'no-store' });
      if (!res.ok) return;
      this.setState({ history: await res.json() });
    } catch (e) {}
  }
  // The customer's open order (real, from the server), so they can jump back to it and the chat.
  async loadLive() {
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      const o = d.order || null,
        prev = this.state.live;
      const sig = (x) => (x ? x.id + x.status + (x.review ? 'r' : '') : '');
      if (
        o?.status === 'in_progress' &&
        (!prev || prev.id !== o.id || prev.status !== 'in_progress')
      )
        track('match_seen', {
          game: o.game,
          wait_seconds: Math.max(
            0,
            Math.floor((o.acceptedAt - (o.queuedAt || o.createdAt)) / 1000),
          ),
        });
      this.setState({ live: o });
      if (sig(o) !== sig(prev) && prev) this.loadHistory();
    } catch (e) {}
  }
  renderLive() {
    const o = this.state.live;
    if (!o) return null;
    const g = GAME[o.game] || { name: o.game, img: '' };
    const mate = o.teammate ? String(o.teammate.name).split(' ')[0] : '';
    const st =
      o.status === 'queued'
        ? [
            o.rerolls
              ? 'Finding you a new teammate…'
              : 'Finding your teammate…',
            '#D6BBFF',
            'View queue',
          ]
        : o.status === 'in_progress'
          ? ['Playing with ' + mate + ' · say hi', '#5EEAA8', 'Open chat']
          : o.review
            ? [
                'Finished with ' +
                  mate +
                  ' · you rated ' +
                  o.review.rating +
                  '/5',
                '#9EE6FF',
                'View order',
              ]
            : FEATURES.reviews
              ? [
                  'Finished with ' + mate + ' · rate your session',
                  '#FFD27A',
                  'Rate & tip',
                ]
              : ['Finished with ' + mate, '#9EE6FF', 'View order'];
    const live = o.status === 'queued' || o.status === 'in_progress';
    return (
      <a
        href={'/queue/' + o.id}
        className="db-link"
        style={{
          marginTop: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '14px 18px',
          padding: '16px 18px',
          borderRadius: '22px',
          textDecoration: 'none',
          color: '#F3EEFF',
          background:
            'radial-gradient(80% 140% at 0% 0%, ' +
            (o.status === 'in_progress'
              ? 'rgba(94, 234, 168, .14)'
              : 'rgba(214, 187, 255, .14)') +
            ', transparent 60%), #1B1033',
          border:
            '1px solid ' +
            (o.status === 'in_progress'
              ? 'rgba(94, 234, 168, .35)'
              : 'rgba(214, 187, 255, .3)'),
        }}
      >
        <span style={{ position: 'relative', flex: '0 0 auto' }}>
          <img
            src={g.img}
            alt=""
            width="48"
            height="48"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              display: 'block',
            }}
          />
          {o.teammate ? (
            <img
              src={o.teammate.image || '/assets/avatars/avatar-3.png'}
              alt=""
              width="26"
              height="26"
              referrerPolicy="no-referrer"
              style={{
                position: 'absolute',
                right: '-8px',
                bottom: '-8px',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                objectFit: 'cover',
                boxShadow: '0 0 0 3px #1B1033',
              }}
            />
          ) : null}
        </span>
        <span style={{ flex: '1 1 220px', minWidth: '0', lineHeight: '1.35' }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '.08em',
              color: st[1],
            }}
          >
            {live ? (
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: st[1],
                  boxShadow: '0 0 10px ' + st[1],
                  animation: 'dlpulse 1.2s ease-in-out infinite',
                }}
              />
            ) : null}
            {live ? 'LIVE ORDER' : 'JUST FINISHED'} · {o.ref || o.id}
          </span>
          <span
            style={{
              display: 'block',
              marginTop: '2px',
              fontWeight: '700',
              fontSize: '16px',
              color: '#FFFFFF',
            }}
          >
            {st[0]}
          </span>
          <span
            style={{ display: 'block', fontSize: '13px', color: '#A79DC4' }}
          >
            {o.title} ×{o.games} · {g.name} · {o.region}
          </span>
        </span>
        <span
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            minHeight: '46px',
            padding: '0 18px',
            borderRadius: '14px',
            background: live ? '#D6BBFF' : 'transparent',
            border: live ? 'none' : '1px solid rgba(196, 170, 255, .25)',
            color: live ? '#17092E' : '#FFFFFF',
            fontSize: '14.5px',
            fontWeight: '700',
          }}
        >
          {st[2]}
          <svg
            aria-hidden="true"
            width="16"
            height="16"
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
        </span>
      </a>
    );
  }
  renderVals() {
    const s = this.state;
    const u = this.props.user || {};
    const h = s.history; // null until it loads
    const name = u.name || (u.email ? u.email.split('@')[0] : 'Player');
    const via =
      u.provider === 'discord'
        ? 'Discord'
        : u.provider === 'google'
          ? 'Google'
          : 'email';
    const now = h ? h.now : 0;
    const all = h ? h.orders : [];
    const completed = all.filter((o) => o.status === 'completed');
    const gameOf = (id) => GAME[id] || { name: id, short: id, img: '' };
    const avatarFor = (id) =>
      '/assets/avatars/avatar-' +
      (1 +
        (String(id || '')
          .split('')
          .reduce((a, c) => a + c.charCodeAt(0), 0) %
          10)) +
      '.png';
    // Balances and cashback are kept in EUR. A customer who picked USD sees them in dollars at the
    // customer rate, as the homepage shows prices and the wallet; an order shows what was charged.
    const usd = this.props.cur === 'USD';
    const sym = usd ? '$' : '€';
    const money = (n) =>
      sym +
      (usd
        ? Math.round((n || 0) * (this.props.usdRate || 1.13) * 100) / 100
        : n || 0
      ).toFixed(2);
    const priceOf = (o) =>
      o.freePerk
        ? 'Free with your perk'
        : o.paid
          ? (o.paid.currency === 'USD' ? '$' : '€') + o.paid.total.toFixed(2)
          : money(o.amountEur);

    // Activity: games played with a teammate per week (Monday to Sunday), last 12 weeks
    const WEEKS = 12;
    const monday = (t) => {
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d;
    };
    const weeks = [];
    if (h) {
      for (let i = WEEKS - 1; i >= 0; i--) {
        const d = monday(now);
        d.setDate(d.getDate() - i * 7);
        weeks.push({ ts: d.getTime(), games: 0, orders: 0 });
      }
      completed.forEach((o) => {
        const w = weeks.find((x) => x.ts === monday(o.completedAt).getTime());
        if (w) {
          w.games += o.games || 1;
          w.orders += 1;
        }
      });
    }
    const weekMax = Math.max.apply(null, weeks.map((w) => w.games).concat([1]));
    const byGame = {};
    completed.forEach((o) => {
      byGame[o.game] = (byGame[o.game] || 0) + (o.games || 1);
    });
    const fav = Object.entries(byGame).sort((a, b) => b[1] - a[1])[0];
    const recentGames = weeks.reduce((a, w) => a + w.games, 0);
    const activity = {
      weeks: weeks.map((w, i) => ({
        key: w.ts,
        current: i === weeks.length - 1,
        height: Math.max(w.games ? 8 : 3, (w.games / weekMax) * 100) + '%',
        title:
          'Week of ' +
          new Date(w.ts).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          }) +
          ': ' +
          w.games +
          (w.games === 1 ? ' game' : ' games'),
        games: w.games,
      })),
      total: recentGames,
      first: weeks.length
        ? new Date(weeks[0].ts).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })
        : '',
      fav: fav
        ? { name: gameOf(fav[0]).name, img: gameOf(fav[0]).img, games: fav[1] }
        : null,
      label:
        recentGames +
        (recentGames === 1 ? ' game' : ' games') +
        ' with a teammate in the last 12 weeks',
    };

    const chip = (a) =>
      'min-height: 36px; padding: 0 14px; border-radius: 999px; font-size: 13.5px; font-weight: 600; ' +
      (a
        ? 'background: #F3EEFF; color: #17092E; border: 1px solid #F3EEFF;'
        : 'background: transparent; color: #CFC4EA; border: 1px solid rgba(196, 170, 255, .16);');
    const FILTERS = {
      all: () => true,
      completed: (o) => o.status === 'completed',
      refunded: (o) => o.status === 'cancelled',
    };
    const filters = [
      ['all', 'All'],
      ['completed', 'Completed'],
      ['refunded', 'Cancelled'],
    ].map(([id, label]) => ({
      label,
      pressed: s.filter === id ? 'true' : 'false',
      style: chip(s.filter === id),
      pick: () => this.setState({ filter: id, showAll: false }),
    }));
    const today = new Date(now || 0);
    today.setHours(0, 0, 0, 0);
    const when = (t) => {
      const d = new Date(t),
        time = d.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        });
      const days = Math.round(
        (today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000,
      );
      return (
        (days === 0
          ? 'Today'
          : days === 1
            ? 'Yesterday'
            : d.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })) +
        ' · ' +
        time
      );
    };
    const filtered = all.filter(FILTERS[s.filter] || FILTERS.all);
    const SHOW = 8;
    const orders = (s.showAll ? filtered : filtered.slice(0, SHOW)).map((o) => {
      const g = gameOf(o.game);
      const mate = o.teammate || o.lastTeammate;
      const st =
        o.status === 'completed'
          ? !FEATURES.reviews
            ? ['Completed', '#8E84AB', false]
            : o.review
              ? ['You rated ' + o.review.rating + '/5', '#8E84AB', true]
              : ['Not rated yet', '#FFD27A', false]
          : o.status === 'cancelled'
            ? [o.cancelReason || 'Cancelled', '#8E84AB', false]
            : o.status === 'in_progress'
              ? ['Playing now', '#5EEAA8', false]
              : ['Finding a teammate…', '#D6BBFF', false];
      return {
        id: o.id,
        img: g.img,
        gameName: g.name,
        title: o.title + (o.games > 1 ? ' ×' + o.games : ''),
        when: when(o.createdAt) + ' · ' + g.short,
        mate: mate ? String(mate.name).split(' ')[0] : 'No teammate',
        avatar:
          mate && mate.image ? mate.image : avatarFor(mate ? mate.name : o.id),
        flagImg: mate && mate.country ? flagSrc(mate.country) : '',
        statusLabel: st[0],
        statusColor: st[1],
        star: st[2],
        price: priceOf(o),
        refunded: o.status === 'cancelled',
        back: o.freePerk
          ? ''
          : o.status === 'completed'
            ? o.cashback
              ? '+' + money(o.cashback) + ' back'
              : ''
            : o.status === 'cancelled' && o.refund
              ? money(o.refund.amountEur) + ' to balance'
              : '',
        backColor: o.status === 'cancelled' ? '#9EE6FF' : '#5EEAA8',
        href: '/queue/' + o.id,
        action:
          FEATURES.reviews && o.status === 'completed' && !o.review
            ? 'Rate & tip'
            : o.status === 'queued' || o.status === 'in_progress'
              ? 'Open'
              : 'View',
      };
    });
    // hearted teammates, by name and avatar (the order DTO has no teammate id)
    const favKeys = new Set(
      (s.favs ? s.favs.favorites : []).map((f) => f.name + '|' + f.image),
    );
    const mates = (h ? h.mates : []).map((m) => ({
      ...m,
      favOn: favKeys.has(m.name + '|' + m.image),
      first: String(m.name).split(' ')[0],
      img: gameOf(m.main).img,
      avatar: m.image || avatarFor(m.name),
      flagImg: m.country ? flagSrc(m.country) : '',
      rank:
        'Mostly ' +
        gameOf(m.main).name +
        ' · ' +
        m.orders +
        (m.orders === 1 ? ' order' : ' orders'),
      ratingLabel: m.rating ? '★ ' + m.rating.toFixed(1) : '',
      status: m.online ? 'Online now' : m.online === false ? 'Offline' : '',
      dot:
        'position: absolute; left: -1px; bottom: -1px; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 0 3px #120B22; background: ' +
        (m.online ? '#5EEAA8' : '#6A6086') +
        ';',
      statusColor: m.online ? '#5EEAA8' : '#8E84AB',
    }));
    const onlineMates = mates.filter((m) => m.online).length;
    const last = completed[0];
    // where the balance comes from and where it went; "from Duoly" = manual adjustments by admins (+ or −)
    const walletParts = h
      ? [
          h.refunds ? money(h.refunds) + ' refunded' : '',
          h.cashbackTotal ? money(h.cashbackTotal) + ' cashback' : '',
          h.levelGifts ? money(h.levelGifts) + ' level gifts' : '',
          h.gifted
            ? (h.gifted < 0 ? '−' + money(-h.gifted) : money(h.gifted)) +
              ' from Duoly'
            : '',
          h.walletSpent ? '−' + money(h.walletSpent) + ' spent on orders' : '',
        ].filter(Boolean)
      : [];

    return {
      name,
      first: name.split(' ')[0],
      email: u.email || '',
      via,
      isAdmin: !!u.isAdmin,
      avatar: u.image || '/assets/avatars/avatar-1.png',
      loaded: !!h,
      wallet: h ? money(h.wallet) : sym + '–',
      money,
      sym,
      stats: [
        [
          'Orders with Duoly',
          h ? String(h.lifetimeOrders) : '–',
          h
            ? h.weekOrders
              ? '+' + h.weekOrders + ' this week'
              : h.lifetimeOrders
                ? 'none this week yet'
                : 'book your first duo'
            : '',
        ],
        [
          'Games played',
          h ? String(h.gamesPlayed) : '–',
          h ? (fav ? 'mostly ' + gameOf(fav[0]).name : 'with a teammate') : '',
        ],
        [
          'Teammates',
          h ? String(mates.length) : '–',
          h
            ? mates.length
              ? onlineMates + ' online now'
              : 'you’ve played with'
            : '',
        ],
      ],
      giftedNote: walletParts.length ? walletParts.join(' · ') : '',
      walletBucketNote: h
        ? money(h.walletCashable || 0) +
          ' cashable refunds · ' +
          money(h.walletPromo || 0) +
          ' promotional credit'
        : '',
      // level-up gifts go into the balance automatically (lib/orders.js moneyOf), nothing to claim
      rewards: h?.rewards || {
        orders: h ? h.lifetimeOrders : 0,
        cashbackTotal: h ? h.cashbackTotal : 0,
        cashbackMonth: h ? h.cashbackMonth : 0,
        cashbackPending: 0,
        pendingOrders: 0,
        gifts: [],
        giftClaimed: true,
      },
      claimGift: () => {},
      activity,
      again: last
        ? {
            img: gameOf(last.game).img,
            sub:
              last.title +
              (last.games > 1 ? ' ×' + last.games : '') +
              (last.teammate
                ? ' with ' + String(last.teammate.name).split(' ')[0]
                : ''),
          }
        : null,
      filters,
      orders,
      noOrders: h && !filtered.length,
      ordersEmptyText: !all.length
        ? 'No orders yet. Book a duo and it shows up here.'
        : 'No ' +
          (s.filter === 'refunded' ? 'cancelled' : 'completed') +
          ' orders yet.',
      moreCount: s.showAll ? 0 : Math.max(0, filtered.length - SHOW),
      toggleAll: () => this.setState({ showAll: !s.showAll }),
      showingAll: s.showAll && filtered.length > SHOW,
      mates,
      matesLink: onlineMates
        ? 'Book a duo · ' + onlineMates + ' of your teammates online'
        : 'Book a duo',
      menuOpen: s.menu,
      menuOpenStr: s.menu ? 'true' : 'false',
      toggleMenu: () => this.setState({ menu: !this.state.menu }),
      signOut: () => this.props.onSignOut(),
    };
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
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#090414',
          color: '#F3EEFF',
          fontFamily: 'Geist, system-ui, sans-serif',
          fontSize: '15px',
          lineHeight: '1.5',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
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
              gap: '12px 32px',
            }}
          >
            <a
              href="/"
              aria-label="Duoly home"
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <img
                src="/assets/brand/logo-wordmark.webp"
                alt="Duoly"
                width="104"
                height="39"
                style={{ width: '104px', height: '39px', display: 'block' }}
              />
            </a>
            <nav
              aria-label="Main"
              className="db-nav"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 26px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              <a href="/#games" style={{ textDecoration: 'none' }}>
                Games
              </a>
              <a
                href="/dashboard"
                aria-current="page"
                style={{ textDecoration: 'none', color: '#FFFFFF' }}
              >
                Dashboard
              </a>
              <a href="/apply" style={{ textDecoration: 'none' }}>
                Become a teammate
              </a>
            </nav>
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
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
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      lineHeight: '1.2',
                    }}
                  >
                    <span>{v.name}</span>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: '500',
                        color: '#8E84AB',
                      }}
                    >
                      {FEATURES.wallet ? v.wallet + ' balance' : 'Customer'}
                    </span>
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
                    <div
                      style={{
                        padding: '8px 10px 10px',
                        borderBottom: '1px solid rgba(196, 170, 255, .1)',
                        marginBottom: '6px',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: '600',
                          color: '#FFFFFF',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {v.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8E84AB' }}>
                        Signed in with {v.via}
                      </div>
                    </div>
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
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 11l9-7 9 7" />
                        <path d="M5 10v10h14V10" />
                      </svg>
                      Book a duo
                    </a>
                    <a
                      href="#favorites"
                      role="menuitem"
                      onClick={() => this.setState({ menu: false })}
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
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                      >
                        <path d={HEART} />
                      </svg>
                      Favorites
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
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21a8 8 0 0 1 16 0" />
                      </svg>
                      Edit profile
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
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <path d="M16 17l5-5-5-5" />
                        <path d="M21 12H9" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main
          style={{
            maxWidth: '1240px',
            margin: '0 auto',
            padding: '40px 24px 80px',
          }}
        >
          <section
            aria-labelledby="db-h"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                minWidth: '0',
              }}
            >
              <img
                src={v.avatar}
                alt=""
                width="72"
                height="72"
                referrerPolicy="no-referrer"
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '22px',
                  objectFit: 'cover',
                  boxShadow:
                    '0 0 0 1px rgba(214, 187, 255, .25), 0 18px 40px rgba(0, 0, 0, .5)',
                }}
              />
              <div style={{ minWidth: '0' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#D6BBFF',
                    letterSpacing: '.02em',
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="#D6BBFF"
                      d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z"
                    />
                  </svg>
                  Your dashboard
                </div>
                <h1
                  id="db-h"
                  style={{
                    margin: '4px 0 0',
                    fontFamily: DISPLAY,
                    fontWeight: '800',
                    fontSize: 'clamp(32px, 4.4vw, 48px)',
                    lineHeight: '1',
                    letterSpacing: '-.035em',
                    color: '#FFFFFF',
                  }}
                >
                  Hey {v.first}, ready to queue?
                </h1>
                <p
                  style={{
                    margin: '8px 0 0',
                    color: '#A79DC4',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Signed in with {v.via}
                  {v.email ? ' · ' + v.email : ''}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {v.again ? (
                <a
                  href="/#games"
                  onClick={() =>
                    track('rebook_clicked', { source: 'dashboard' })
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    minHeight: '52px',
                    padding: '0 16px 0 8px',
                    borderRadius: '14px',
                    border: '1px solid rgba(196, 170, 255, .2)',
                    color: '#F3EEFF',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  <img
                    src={v.again.img}
                    alt=""
                    width="34"
                    height="34"
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '9px',
                    }}
                  />
                  <span
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      lineHeight: '1.2',
                    }}
                  >
                    <span>Book again</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#8E84AB',
                      }}
                    >
                      {v.again.sub}
                    </span>
                  </span>
                </a>
              ) : null}
              <a
                href="/#games"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  minHeight: '52px',
                  padding: '0 22px',
                  borderRadius: '14px',
                  background: '#D6BBFF',
                  color: '#17092E',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: '700',
                }}
              >
                Find a duo
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
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
              </a>
            </div>
          </section>

          {this.renderLive()}

          <section
            aria-label="Your stats"
            style={{
              marginTop: '32px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
            }}
          >
            {FEATURES.wallet ? (
              <a
                href="#wallet"
                className="db-link"
                style={{
                  ...card,
                  padding: '20px 22px',
                  background: '#1B1033',
                  border: '1px solid rgba(214, 187, 255, .28)',
                  color: '#F3EEFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <span style={{ ...label, color: '#CFC4EA' }}>
                  Duoly balance
                </span>
                <span
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 'clamp(26px, 6vw, 34px)',
                    fontWeight: '700',
                    letterSpacing: '-.03em',
                    color: '#FFFFFF',
                    lineHeight: '1.05',
                  }}
                >
                  {v.wallet}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#D6BBFF',
                  }}
                >
                  Use it at checkout
                </span>
              </a>
            ) : null}
            {v.stats.map((st, $index) => (
              <React.Fragment key={$index}>
                <div
                  style={{
                    ...card,
                    padding: '20px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <span style={label}>{st[0]}</span>
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 'clamp(26px, 6vw, 34px)',
                      fontWeight: '700',
                      letterSpacing: '-.03em',
                      color: '#FFFFFF',
                      lineHeight: '1.05',
                    }}
                  >
                    {st[1]}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#5EEAA8',
                    }}
                  >
                    {st[2]}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </section>

          {FEATURES.rewards ? (
            <Rewards
              name={v.name}
              orders={v.rewards.orders}
              cashbackTotal={v.rewards.cashbackTotal}
              cashbackMonth={v.rewards.cashbackMonth}
              cashbackPending={v.rewards.cashbackPending}
              pendingOrders={v.rewards.pendingOrders}
              perks={v.rewards.perks || null}
              proLive={!!this.props.pro}
              money={v.money}
              sym={v.sym}
              giftClaimed={v.rewards.giftClaimed}
            />
          ) : null}

          <div className="db-grid" style={{ marginTop: '20px' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                minWidth: '0',
              }}
            >
              <section
                aria-labelledby="act-h"
                style={{ ...card, padding: '24px', overflow: 'hidden' }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div>
                    <h2 id="act-h" style={h2}>
                      Your activity
                    </h2>
                    <div style={{ fontSize: '13.5px', color: '#A79DC4' }}>
                      Games played with a teammate · last 12 weeks
                    </div>
                  </div>
                  {v.activity.fav ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px 6px 6px',
                        borderRadius: '999px',
                        background: 'rgba(214, 187, 255, .08)',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#F3EEFF',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <img
                        src={v.activity.fav.img}
                        alt=""
                        width="24"
                        height="24"
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '7px',
                        }}
                      />
                      Most played: {v.activity.fav.name}
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    marginTop: '16px',
                    fontFamily: DISPLAY,
                    fontSize: '34px',
                    fontWeight: '700',
                    letterSpacing: '-.03em',
                    color: '#FFFFFF',
                    lineHeight: '1',
                  }}
                >
                  {v.loaded ? v.activity.total : '–'}
                  <span
                    style={{
                      marginLeft: '8px',
                      fontFamily: 'Geist, system-ui, sans-serif',
                      fontSize: '14px',
                      fontWeight: '500',
                      letterSpacing: '0',
                      color: '#8E84AB',
                    }}
                  >
                    {v.activity.total === 1 ? 'game' : 'games'}
                  </span>
                </div>
                <div
                  role="img"
                  aria-label={v.activity.label}
                  style={{
                    marginTop: '16px',
                    height: '130px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '6px',
                  }}
                >
                  {v.activity.weeks.map((w) => (
                    <span
                      key={w.key}
                      title={w.title}
                      style={{
                        flex: '1',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          width: '100%',
                          height: w.height,
                          borderRadius: '7px 7px 3px 3px',
                          transition: 'height .4s ease',
                          background: !w.games
                            ? 'rgba(196, 170, 255, .08)'
                            : w.current
                              ? 'repeating-linear-gradient(135deg, rgba(214, 187, 255, .75) 0 4px, rgba(214, 187, 255, .4) 4px 8px)'
                              : 'linear-gradient(180deg, #D6BBFF, rgba(214, 187, 255, .45))',
                        }}
                      />
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#6A6086',
                  }}
                >
                  <span>{v.activity.first}</span>
                  <span style={{ color: '#CFC4EA', fontWeight: '600' }}>
                    This week
                  </span>
                </div>
                {v.loaded && !v.activity.total ? (
                  <p
                    style={{
                      margin: '12px 0 0',
                      fontSize: '13.5px',
                      color: '#8E84AB',
                    }}
                  >
                    Nothing here yet. Every game you finish with a teammate adds
                    to this chart.
                  </p>
                ) : null}
              </section>

              <section
                data-private-block=""
                aria-labelledby="orders-h"
                style={{ ...card, padding: '24px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <h2 id="orders-h" style={h2}>
                    Recent orders
                  </h2>
                  <div
                    role="group"
                    aria-label="Filter orders"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
                  >
                    {v.filters.map((f, $index) => (
                      <React.Fragment key={$index}>
                        <button
                          type="button"
                          aria-pressed={f.pressed}
                          onClick={f.pick}
                          style={css(f.style)}
                        >
                          {f.label}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '0',
                    padding: '0',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {v.orders.map((o, $index) => (
                    <React.Fragment key={o.id}>
                      <li
                        className="db-row"
                        style={{
                          padding: '14px 0',
                          borderTop: $index
                            ? '1px solid rgba(196, 170, 255, .08)'
                            : 'none',
                        }}
                      >
                        <img
                          src={o.img}
                          alt={o.gameName}
                          width="44"
                          height="44"
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            opacity: o.refunded ? '.55' : '1',
                          }}
                        />
                        <div style={{ minWidth: '0' }}>
                          <div
                            style={{
                              fontWeight: '600',
                              color: '#FFFFFF',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {o.title}
                          </div>
                          <div style={{ fontSize: '13px', color: '#8E84AB' }}>
                            {o.when}
                          </div>
                        </div>
                        <div
                          className="db-hide-sm"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            minWidth: '0',
                          }}
                        >
                          <span
                            style={{
                              position: 'relative',
                              flex: '0 0 auto',
                              width: '32px',
                              height: '32px',
                            }}
                          >
                            <img
                              src={o.avatar}
                              alt=""
                              width="32"
                              height="32"
                              referrerPolicy="no-referrer"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                display: 'block',
                                objectFit: 'cover',
                              }}
                            />
                            {o.flagImg ? (
                              <img
                                src={o.flagImg}
                                alt=""
                                width="13"
                                height="13"
                                style={{
                                  position: 'absolute',
                                  right: '-2px',
                                  bottom: '-2px',
                                  width: '13px',
                                  height: '13px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  boxShadow: '0 0 0 2px #120B22',
                                }}
                              />
                            ) : null}
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
                              style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#F3EEFF',
                              }}
                            >
                              {o.mate}
                            </span>
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                color: o.statusColor,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {o.star ? (
                                <svg
                                  aria-hidden="true"
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  style={{ flex: '0 0 auto' }}
                                >
                                  <path
                                    fill="#FFD27A"
                                    d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"
                                  />
                                </svg>
                              ) : null}
                              {o.statusLabel}
                            </span>
                          </span>
                        </div>
                        <div
                          style={{
                            fontFamily: DISPLAY,
                            fontSize: '17px',
                            fontWeight: '700',
                            color: o.refunded ? '#8E84AB' : '#FFFFFF',
                            textAlign: 'right',
                            lineHeight: '1.25',
                          }}
                        >
                          <span
                            style={{
                              textDecoration: o.refunded
                                ? 'line-through'
                                : 'none',
                            }}
                          >
                            {o.price}
                          </span>
                          {o.back ? (
                            <span
                              style={{
                                display: 'block',
                                fontFamily: 'Geist, system-ui, sans-serif',
                                fontSize: '11.5px',
                                fontWeight: '600',
                                color: o.backColor,
                              }}
                            >
                              {o.back}
                            </span>
                          ) : null}
                        </div>
                        <a
                          href={o.href}
                          className="db-hide-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '40px',
                            padding: '0 14px',
                            borderRadius: '12px',
                            border:
                              o.action === 'Rate & tip'
                                ? 'none'
                                : '1px solid rgba(196, 170, 255, .2)',
                            background:
                              o.action === 'Rate & tip'
                                ? '#FFD27A'
                                : 'transparent',
                            color:
                              o.action === 'Rate & tip' ? '#2A1A00' : '#F3EEFF',
                            textDecoration: 'none',
                            fontSize: '13.5px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {o.action}
                        </a>
                      </li>
                    </React.Fragment>
                  ))}
                </ul>
                {!v.loaded ? (
                  <p style={{ margin: '8px 0 0', color: '#8E84AB' }}>
                    Loading your orders…
                  </p>
                ) : null}
                {v.moreCount || v.showingAll ? (
                  <button
                    type="button"
                    onClick={v.toggleAll}
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      minHeight: '44px',
                      borderRadius: '12px',
                      border: '1px solid rgba(196, 170, 255, .16)',
                      background: 'transparent',
                      color: '#F3EEFF',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    {v.showingAll
                      ? 'Show fewer'
                      : 'Show ' + v.moreCount + ' more'}
                  </button>
                ) : null}
                {v.noOrders ? (
                  <p style={{ margin: '8px 0 0', color: '#8E84AB' }}>
                    {v.ordersEmptyText}
                  </p>
                ) : null}
              </section>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                minWidth: '0',
              }}
            >
              <Favorites
                favs={this.state.favs}
                busy={this.state.favBusy}
                err={this.state.favErr}
                onToggle={(handle, on) =>
                  this.toggleFav(handle, on, 'favorites')
                }
                card={card}
                h2={h2}
              />
              <section
                aria-labelledby="mates-h"
                style={{ ...card, padding: '24px' }}
              >
                <h2 id="mates-h" style={{ ...h2, marginBottom: '14px' }}>
                  Your teammates
                </h2>
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
                  {v.mates.map((m) => (
                    <React.Fragment key={m.id}>
                      <li
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          borderRadius: '18px',
                          background: '#090414',
                          border: '1px solid rgba(196, 170, 255, .08)',
                        }}
                      >
                        <span
                          style={{
                            position: 'relative',
                            flex: '0 0 auto',
                            width: '46px',
                            height: '46px',
                          }}
                        >
                          <img
                            src={m.avatar}
                            alt=""
                            width="46"
                            height="46"
                            referrerPolicy="no-referrer"
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '50%',
                              display: 'block',
                              objectFit: 'cover',
                            }}
                          />
                          {m.flagImg ? (
                            <img
                              src={m.flagImg}
                              alt=""
                              width="16"
                              height="16"
                              style={{
                                position: 'absolute',
                                right: '-2px',
                                bottom: '-2px',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                boxShadow: '0 0 0 2px #090414',
                              }}
                            />
                          ) : null}
                          <span style={css(m.dot)} />
                        </span>
                        <span
                          style={{
                            flex: '1',
                            minWidth: '0',
                            display: 'flex',
                            flexDirection: 'column',
                            lineHeight: '1.3',
                          }}
                        >
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: '600',
                              color: '#FFFFFF',
                            }}
                          >
                            {m.first}
                            <TrustBadge badge={m.trustBadge} />
                            <img
                              src={m.img}
                              alt=""
                              width="16"
                              height="16"
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '4px',
                              }}
                            />
                            {m.ratingLabel ? (
                              <span
                                title="Your average rating for them"
                                style={{
                                  marginLeft: 'auto',
                                  fontSize: '13px',
                                  color: '#FFFFFF',
                                }}
                              >
                                {m.ratingLabel}
                              </span>
                            ) : null}
                          </span>
                          <span
                            style={{
                              fontSize: '12.5px',
                              color: '#A79DC4',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.rank}
                          </span>
                          <span
                            style={{ fontSize: '12px', color: m.statusColor }}
                          >
                            {m.status} · {m.games}{' '}
                            {m.games === 1 ? 'game' : 'games'} together
                          </span>
                        </span>
                        {m.handle && this.state.favs ? (
                          <FavoriteHeart
                            compact
                            name={m.first}
                            on={m.favOn}
                            busy={this.state.favBusy === m.handle}
                            onToggle={() =>
                              this.toggleFav(m.handle, !m.favOn, 'dashboard')
                            }
                          />
                        ) : null}
                      </li>
                    </React.Fragment>
                  ))}
                </ul>
                {v.loaded && !v.mates.length ? (
                  <p
                    style={{
                      margin: '0',
                      fontSize: '13.5px',
                      color: '#8E84AB',
                    }}
                  >
                    The teammates you play with show up here, with who’s online
                    right now.
                  </p>
                ) : null}
                <a
                  href="/#games"
                  style={{
                    marginTop: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '44px',
                    borderRadius: '12px',
                    border: '1px solid rgba(196, 170, 255, .16)',
                    color: '#F3EEFF',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  {v.matesLink}
                </a>
              </section>

              {FEATURES.wallet ? (
                <section
                  id="wallet"
                  aria-labelledby="wallet-h"
                  style={{ ...card, padding: '24px', scrollMarginTop: '90px' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <h2 id="wallet-h" style={h2}>
                      Duoly balance
                    </h2>
                    <span
                      style={{
                        fontFamily: DISPLAY,
                        fontSize: '22px',
                        fontWeight: '700',
                        color: '#D6BBFF',
                      }}
                    >
                      {v.wallet}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: '4px 0 14px',
                      fontSize: '13.5px',
                      color: '#A79DC4',
                    }}
                  >
                    Refunds, cashback and level-up gifts land here. Switch on
                    “Use my Duoly balance” at checkout to pay for part or all of
                    an order, any game. It never expires.
                    {v.walletBucketNote ? (
                      <span
                        style={{
                          display: 'block',
                          marginTop: '6px',
                          color: '#CFC4EA',
                          fontWeight: '600',
                        }}
                      >
                        {v.walletBucketNote}
                      </span>
                    ) : null}
                    {v.giftedNote ? (
                      <span
                        style={{
                          display: 'block',
                          marginTop: '6px',
                          color: '#5EEAA8',
                          fontWeight: '600',
                        }}
                      >
                        {v.giftedNote}
                      </span>
                    ) : null}
                  </p>
                  <a
                    href="/?wallet=1#checkout"
                    aria-label="Book with my balance"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      minHeight: '50px',
                      borderRadius: '14px',
                      border: '0',
                      background: '#D6BBFF',
                      color: '#17092E',
                      fontSize: '15px',
                      fontWeight: '700',
                      textDecoration: 'none',
                    }}
                  >
                    Book with my balance
                  </a>
                </section>
              ) : null}

              {FEATURES.pro && this.props.pro ? (
                <section
                  id="pro"
                  aria-labelledby="pro-h"
                  style={{
                    ...card,
                    padding: '24px',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#1B1033',
                    border: '1px solid rgba(214, 187, 255, .22)',
                  }}
                >
                  <img
                    src="/assets/brand/logo-mascots.webp"
                    alt=""
                    width="120"
                    height="76"
                    style={{
                      position: 'absolute',
                      right: '-10px',
                      top: '14px',
                      width: '120px',
                      height: '76px',
                      opacity: '.9',
                    }}
                  />
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                      padding: '3px 9px',
                      borderRadius: '8px',
                      background: 'rgba(240, 166, 255, .14)',
                      color: '#F0A6FF',
                    }}
                  >
                    Duoly PRO
                  </span>
                  <h2
                    id="pro-h"
                    style={{ ...h2, marginTop: '10px', maxWidth: '200px' }}
                  >
                    {this.props.pro.member
                      ? 'You’re saving 10% on every game'
                      : 'Save 10% on every game'}
                  </h2>
                  {this.props.proWelcome && !this.props.pro.member ? (
                    <p
                      role="status"
                      style={{
                        margin: '10px 0 0',
                        fontSize: '13.5px',
                        color: '#F0A6FF',
                      }}
                    >
                      Welcome to PRO. It switches on in a few seconds; reload if
                      it hasn’t yet.
                    </p>
                  ) : null}
                  {proStatusLine(this.props.pro, proPrice(this.props.cur)) ? (
                    <p
                      data-pro-status
                      style={{
                        margin: '10px 0 0',
                        fontSize: '13.5px',
                        color: '#CFC4EA',
                        maxWidth: '240px',
                      }}
                    >
                      {proStatusLine(this.props.pro, proPrice(this.props.cur))}
                    </p>
                  ) : null}
                  <ul
                    style={{
                      margin: '12px 0 16px',
                      padding: '0',
                      listStyle: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      fontSize: '14px',
                      color: '#CFC4EA',
                    }}
                  >
                    <li>✓ Priority matching</li>
                    <li>✓ Free re-rolls on every game</li>
                    <li>
                      {this.props.pro.included
                        ? '✓ Free while you’re Diamond'
                        : this.props.pro.member || !this.props.pro.trialEligible
                          ? '✓ Cancel anytime'
                          : '✓ 7 days free, no card needed'}
                    </li>
                  </ul>
                  {this.state.proError ? (
                    <p
                      role="alert"
                      style={{
                        margin: '0 0 10px',
                        fontSize: '13px',
                        color: '#FF8A9B',
                      }}
                    >
                      {this.state.proError}
                    </p>
                  ) : null}
                  {this.props.pro.included && !this.props.pro.manage ? null : (
                    <a
                      href={this.props.pro.manage ? '/dashboard#pro' : '/pro'}
                      onClick={
                        this.props.pro.manage
                          ? (e) => this.openProPortal(e)
                          : null
                      }
                      aria-busy={this.state.proBusy || undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '48px',
                        borderRadius: '14px',
                        background: '#F3EEFF',
                        color: '#17092E',
                        textDecoration: 'none',
                        fontSize: '14.5px',
                        fontWeight: '700',
                      }}
                    >
                      {this.props.pro.manage
                        ? 'Manage PRO'
                        : this.props.pro.trialEligible
                          ? 'Try PRO free for 7 days'
                          : 'Get PRO · ' + proPrice(this.props.cur) + '/month'}
                    </a>
                  )}
                </section>
              ) : null}
            </div>
          </div>
        </main>
        {FEATURES.support ? <SupportChat csrf={this.props.csrf} /> : null}
      </div>
    );
  }
}
