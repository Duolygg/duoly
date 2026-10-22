'use client';

import { previewFetch as fetch } from '../../design-preview/preview-transport';


import React from 'react';
import { IGN_LABEL, GAME, byDemand } from '../lib/games';
import { FAQ_TABS } from '../lib/faq';
import { FOOTER_COLUMNS } from '../../site/nav';
import SupportChat from './SupportChat';
import { servicesFor } from '../lib/catalog';
import { ranksOf, defaultRank, isRanked, rankPrice } from '../lib/ranks';
// Servers differ per game (lib/servers.js, checked again on the server in lib/orders.js)
import { serversFor, isServer, guessServer, usesServerName, serverFlag, MC_EDITIONS } from '../lib/servers';
import { flagSrc } from '../lib/countries';
// What the customer picked before logging in, so it survives the Discord/Google redirect
const PENDING_KEY = 'duoly-pending-queue';

// Turns a CSS declaration string ("color: red; margin-top: 4px") into a React style object.
function css(str) {
  const out = {};
  String(str || '').split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!k) return;
    out[k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val;
  });
  return out;
}

export default class Home extends React.Component {
  constructor(props) {
    super(props);
    // A currency saved on the account (or the cookie) comes from the server, so it's there on first paint.
    const initCur = props.initialCurrency || null;
    this.state = { now: 0, game: 'lol', mode: 'duo2', tab: 'duo', qty: 3, rank: '', useWallet: true, wallet: 0, pay: 'apple', voice: true, same: false, queued: false, cur: initCur, curManual: !!initCur };
  }
  detectCurrency() {
    let saved = this.state.curManual ? this.state.cur : null;
    // older choices only lived in localStorage: move them over to the cookie/account once
    if (!saved) {
      try { saved = window.localStorage.getItem('duoly-currency'); } catch (e) {}
      if ((saved === 'EUR' || saved === 'USD') && this.props.onCurrency) this.props.onCurrency(saved);
    }
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    const lang = (typeof navigator !== 'undefined' && ((navigator.languages && navigator.languages[0]) || navigator.language)) || '';
    const region = (lang.split('-')[1] || '').toUpperCase();
    const EURO = ['AT', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'PT', 'FI', 'IE', 'GR', 'SK', 'SI', 'EE', 'LV', 'LT', 'LU', 'MT', 'CY', 'HR'];
    let auto = null;
    if (tz.indexOf('Europe/') === 0) auto = 'EUR';
    else if (tz.indexOf('America/') === 0) auto = 'USD';
    else if (EURO.indexOf(region) >= 0) auto = 'EUR';
    else if (region === 'US') auto = 'USD';
    const city = tz.indexOf('/') > 0 ? tz.split('/').pop().replace(/_/g, ' ') : '';
    const cur = saved === 'EUR' || saved === 'USD' ? saved : auto;
    if (cur) this.setState({ cur, curAuto: auto, curCity: city, curManual: !!saved });
  }
  componentDidMount() {
    this.detectCurrency();
    this.loadFx();
    this.loadWallet();
    this.setState({ now: Date.now() });
    this._clock = setInterval(() => this.setState({ now: Date.now() }), 1000);
    this.resumeQueue();
  }
  // today's EUR → USD rate for customers (ECB rate + a small margin, lib/fx.js); until it loads, a close default
  async loadFx() {
    try {
      const r = await fetch('/api/fx');
      const j = await r.json();
      if (j.customerRate > 0.5 && j.customerRate < 2) this.setState({ usdRate: j.customerRate });
    } catch (e) {}
  }
  // the signed-in customer's Duoly balance (EUR), so checkout can use it
  async loadWallet() {
    const user = this.props.session && this.props.session.user;
    // Live checkout: the wallet is not connected yet, never show sample balances.
    if (this.props.onCheckout) return;
    if (!user || (user.role && user.role !== 'customer')) return;
    try {
      const r = await fetch('/api/me/history');
      const j = await r.json();
      if (r.ok && typeof j.wallet === 'number') this.setState({ wallet: j.wallet });
    } catch (e) {}
  }
  componentDidUpdate(prevProps) {
    const had = prevProps.session && prevProps.session.user;
    const user = this.props.session && this.props.session.user;
    if (had && !user) this.setState({ wallet: 0 });
    if (!had && user) {
      this.loadWallet();
      this.resumeQueue();
      // just signed in: the account's currency wins; if it has none yet, keep the one picked here
      if (user.currency) this.setState({ cur: user.currency, curManual: true });
      else if (this.state.curManual && this.props.onCurrency) this.props.onCurrency(this.state.cur);
    }
  }

  // ---- Queueing: login first (the order has to belong to an account), then confirm, then the waiting page.
  signedIn() {
    return !!(this.props.session && this.props.session.user);
  }
  startQueue = () => {
    if (!this.signedIn()) {
      const s = this.state;
      try {
        window.localStorage.setItem(PENDING_KEY, JSON.stringify({ game: s.game, mode: s.mode, bundle: s.bundle || null, tab: s.tab, qty: s.qty, rank: s.rank, voice: s.voice, pay: s.pay, at: Date.now() }));
      } catch (e) {}
      if (this.props.onCheckout && this.props.onOpenLogin) {
        // Live: real sign-in page, then straight back here to pay.
        try { document.cookie = 'duoly_resume=checkout; Max-Age=1800; Path=/; SameSite=Lax; Secure'; } catch (e) {}
        this.props.onOpenLogin();
        return;
      }
      this.setState({ auth: true, authNote: '', authWhy: 'Log in or create a free account first. That’s how we match the order to you and keep you posted.', emailMode: this.state.emailMode || 'register' });
      return;
    }
    const role = this.props.session.user.role || 'customer';
    if (role !== 'customer') {
      this.setState({ roleNote: role });
      return;
    }
    this.openConfirm();
  };
  // Back from logging in with a pick waiting? Restore it and go straight to the confirmation.
  resumeQueue() {
    if (!this.signedIn()) return;
    let p = null;
    try {
      p = JSON.parse(window.localStorage.getItem(PENDING_KEY) || 'null');
      window.localStorage.removeItem(PENDING_KEY);
    } catch (e) {}
    if (!p || Date.now() - (p.at || 0) > 30 * 60000) return;
    const { at, ...pick } = p;
    this.setState({ ...pick, auth: false, authWhy: '' }, this.startQueue);
  }
  openConfirm() {
    // the server for this game: what you picked last time for it, else the one nearest your time zone
    const game = this.state.game;
    let tz = '', ign = '', saved = '', mc = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    try {
      ign = window.localStorage.getItem('duoly-ign-' + game) || '';
      saved = window.localStorage.getItem('duoly-server-' + game) || '';
      mc = window.localStorage.getItem('duoly-mc-server') || '';
    } catch (e) {}
    const region = isServer(game, this.state.region) ? this.state.region : isServer(game, saved) ? saved : guessServer(game, tz);
    this.setState({ confirmOpen: true, region, serverOpen: false, mcServer: this.state.mcServer || mc, ign: this.state.ign || ign, placeErr: '', placing: false });
  }
  componentWillUnmount() {
    clearInterval(this._clock);
    clearTimeout(this._chatT);
  }
  vienna() {
    if (!this.state.now) return { vHM: '--:--', vS: '--', vStatus: 'Checking Vienna time…', vDot: 'width: 7px; height: 7px; border-radius: 50%; background: #8E84AB;' };
    const parts = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      .formatToParts(new Date(this.state.now)).forEach((p) => { parts[p.type] = p.value; });
    const h = parseInt(parts.hour, 10) % 24;
    const awake = h >= 8 && h < 24;
    return {
      vHM: (parts.hour === '24' ? '00' : parts.hour) + ':' + parts.minute, vS: parts.second,
      vStatus: awake ? 'Our team is online' : 'Team’s asleep — support still live 24/7',
      vDot: 'width: 7px; height: 7px; border-radius: 50%; background: ' + (awake ? '#5EEAA8' : '#F0A6FF') + ';'
    };
  }
  authVals(s) {
    // Real login comes in through props (session, onSignIn, onSignOut) from HomeWithAuth.
    // Without those props it falls back to a pretend login.
    const P = this.props || {};
    const real = P.session && P.session.user ? P.session.user : null;
    const user = real;
    const via = real ? (real.provider || '') : '';
    const viaName = via === 'discord' ? 'Discord' : via === 'google' ? 'Google' : 'email';
    const busy = s.authBusy;
    const login = (provider) => () => {
      this.setState({ authBusy: null, authNote: 'Design preview: login and account creation are not connected.' });
      if (P.onSignIn) P.onSignIn(provider);
    };
    const errorOpen = !!P.authError && !s.authErrDismissed;
    return {
      showAuth: !!s.auth || errorOpen || (!!P.askLogin && !user && !s.authErrDismissed),
      signedIn: !!user, signedOut: !user,
      userName: user ? (user.name || user.email || 'Player') : '',
      userAvatar: user && user.image ? user.image : '/assets/avatars/avatar-1.png',
      // each role has one dashboard: customers /dashboard, teammates /teammate, admins /admin
      ...(() => {
        const role = (real && real.role) || 'customer';
        return {
          userVia: (role === 'customer' ? '' : (role === 'admin' ? 'Admin' : 'Teammate') + ' · ') + 'Signed in with ' + viaName,
          isAdmin: role === 'admin', isTeammate: role === 'teammate', isCustomer: role === 'customer',
          homeHref: role === 'admin' ? '/admin' : role === 'teammate' ? '/teammate' : '/dashboard',
          homeLabel: role === 'admin' ? 'Admin dashboard' : role === 'teammate' ? 'Teammate dashboard' : 'Dashboard'
        };
      })(),
      creditLabel: 'via ' + viaName,
      accountOpen: !!s.accountMenu, accountOpenStr: s.accountMenu ? 'true' : 'false',
      toggleAccount: () => this.setState({ accountMenu: !this.state.accountMenu }),
      authNote: s.authNote || (errorOpen ? 'That login didn’t work. Please try again.' : ''),
      discordLabel: busy === 'discord' ? 'Connecting…' : 'Discord',
      googleLabel: busy === 'google' ? 'Connecting…' : 'Google',
      openAuth: () => { if (P.onOpenLogin) { P.onOpenLogin(); return; } this.setState({ auth: true, authNote: '', authWhy: '' }); },
      closeAuth: () => {
        try { window.localStorage.removeItem(PENDING_KEY); } catch (e) {}
        this.setState({ auth: false, authErrDismissed: true, authBusy: null, authWhy: '' });
      },
      loginDiscord: login('discord'),
      loginGoogle: login('google'),
      ...this.emailVals(s, P),
      signOut: () => {
        this.setState({ accountMenu: false });
        if (P.onSignOut && real) { P.onSignOut(); return; }
        this.setState({ user: null });
      }
    };
  }
  emailVals(s, P) {
    const register = s.emailMode === 'register';
    const field = (k) => (e) => this.setState({ [k]: e.target.value, authNote: '' });
    const tab = (a) => 'flex: 1; min-height: 40px; border-radius: 10px; border: none; font-size: 14px; font-weight: 600; ' +
      (a ? 'background: #F3EEFF; color: #17092E;' : 'background: transparent; color: #A79DC4;');
    const submit = async (e) => {
      if (e) e.preventDefault();
      this.setState({ emailBusy: false, emailPass: '', authNote: 'Design preview: login and account creation are not connected.' });
    };
    // Password strength for the create-account form: length, mixed case, digit, symbol.
    const pw = s.emailPass || '';
    const score = !pw ? 0 : Math.max(1, [pw.length >= 8, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw) || pw.length >= 14].filter(Boolean).length);
    const strength = [['', '#2A1F45'], ['Weak', '#F0A6FF'], ['Okay', '#FFD0A6'], ['Good', '#D6BBFF'], ['Strong', '#5EEAA8']][score];
    return {
      emailRegister: register,
      authTitle: register ? 'Create your account' : 'Welcome back',
      authSub: 'Design preview only. Login and account creation are not connected. Do not enter real credentials.',
      switchText: register ? 'Already have an account?' : 'New to Duoly?',
      switchLabel: register ? 'Log in' : 'Create an account',
      switchMode: () => this.setState({ emailMode: register ? 'login' : 'register', authNote: '' }),
      passType: s.showPass ? 'text' : 'password',
      passToggleLabel: s.showPass ? 'Hide password' : 'Show password',
      passShown: !!s.showPass,
      togglePass: () => this.setState({ showPass: !this.state.showPass }),
      showStrength: register && !!pw,
      strengthLabel: strength[0], strengthColor: strength[1],
      strengthBars: [1, 2, 3, 4].map((n) => 'flex: 1; height: 4px; border-radius: 999px; transition: background-color .2s; background: ' + (n <= score ? strength[1] : 'rgba(196, 170, 255, .12)') + ';'),
      emailLoginTab: tab(!register), emailRegisterTab: tab(register),
      emailLoginPressed: register ? 'false' : 'true', emailRegisterPressed: register ? 'true' : 'false',
      showLogin: () => this.setState({ emailMode: 'login', authNote: '' }),
      showRegister: () => this.setState({ emailMode: 'register', authNote: '' }),
      emailName: s.emailName || '', emailAddr: s.emailAddr || '', emailPass: s.emailPass || '',
      setEmailName: field('emailName'), setEmailAddr: field('emailAddr'), setEmailPass: field('emailPass'),
      passAutocomplete: register ? 'new-password' : 'current-password',
      emailBusy: !!s.emailBusy,
      emailSubmitLabel: s.emailBusy ? (register ? 'Creating account…' : 'Logging in…') : (register ? 'Create account' : 'Log in'),
      submitEmail: submit
    };
  }
  data() {
    return [
      { id: 'lol', online: '214',
        mates: [['Kairo', 'Master 214 LP', 'Mid', '4.97', '1,204'], ['Nyx', 'Grandmaster', 'Jungle', '4.95', '862'], ['Tavi', 'Master 88 LP', 'Support', '4.99', '2,011'], ['Ren', 'Diamond 1', 'ADC', '4.92', '540']] },
      { id: 'val', online: '158',
        mates: [['Vexa', 'Immortal 3', 'Controller', '4.96', '931'], ['Juno', 'Radiant', 'Duelist', '4.94', '612'], ['Otto', 'Immortal 1', 'Sentinel', '4.98', '1,377'], ['Mika', 'Ascendant 3', 'Initiator', '4.91', '402']] },
      { id: 'fn', online: '118',
        mates: [['Blitz', 'Unreal', 'IGL', '4.97', '1,318'], ['Nova', 'Champion', 'Fragger', '4.95', '744'], ['Rook', 'Unreal', 'Builder', '4.98', '956'], ['Kiko', 'Elite', 'Support', '4.91', '402']] },
      { id: 'apex', online: '81',
        mates: [['Vale', 'Apex Predator', 'IGL', '4.96', '1,026'], ['Rhea', 'Master', 'Fragger', '4.94', '688'], ['Cass', 'Master', 'Support', '4.97', '812'], ['Odin', 'Diamond 1', 'Recon', '4.90', '377']] },
      { id: 'rl', online: '57',
        mates: [['Ace', 'Grand Champion 2', 'Striker', '4.97', '903'], ['Pip', 'Supersonic Legend', 'Defender', '4.98', '1,211'], ['Moss', 'Grand Champion 1', 'Midfield', '4.93', '466'], ['Rex', 'Champion 3', 'Striker', '4.91', '281']] },
      { id: 'mr', online: '63',
        mates: [['Sol', 'Celestial 2', 'Strategist', '4.97', '388'], ['Brix', 'Grandmaster 1', 'Vanguard', '4.93', '290'], ['Lumi', 'Eternity', 'Duelist', '4.95', '511'], ['Dax', 'Grandmaster 3', 'Strategist', '4.90', '174']] },
      { id: 'ow', online: '61',
        mates: [['Wren', 'Grandmaster 2', 'Support', '4.98', '1,044'], ['Bo', 'Master 1', 'Tank', '4.94', '603'], ['Isa', 'Champion 5', 'DPS', '4.96', '722'], ['Pax', 'Master 3', 'Support', '4.92', '318']] },
      { id: 'arc', online: '49',
        mates: [['Hex', 'Elite', 'Scout', '4.96', '412'], ['Lark', 'Veteran', 'Support', '4.95', '287'], ['Brann', 'Elite', 'Fragger', '4.93', '330'], ['Wynn', 'Veteran', 'Looter', '4.92', '198']] },
      { id: 'mc', online: '44',
        mates: [['Pixel', 'Top PvPer', 'Duels', '4.97', '734'], ['Ivo', 'SMP expert', 'Builder', '4.96', '512'], ['Echo', 'Bedwars 1000★', 'Rusher', '4.94', '389'], ['Fern', 'SMP expert', 'Redstone', '4.98', '226']] },
      { id: 'pu', online: '38',
        mates: [['Momo', 'Master 1712', 'Attacker', '4.97', '466'], ['Rio', 'Master 1630', 'Support', '4.95', '301'], ['Kit', 'Master 1588', 'Defender', '4.93', '257'], ['Ash', 'Ultra 1', 'All-rounder', '4.90', '149']] },
      { id: 'cs2', online: '142',
        mates: [['Kaz', 'FACEIT Level 10', 'AWPer', '4.97', '1,102'], ['Dima', 'Premier 24,800', 'Entry', '4.95', '734'], ['Lex', 'Global Elite', 'IGL', '4.96', '866'], ['Tomo', 'Premier 19,300', 'Support', '4.92', '341']] },
      { id: 'cod', online: '104',
        mates: [['Ghost', 'Iridescent', 'Slayer', '4.96', '958'], ['Riva', 'Crimson 2', 'Objective', '4.94', '571'], ['Jax', 'Iridescent', 'Anchor', '4.97', '804'], ['Tess', 'Diamond 3', 'Support', '4.91', '288']] },
      { id: 'r6', online: '67',
        mates: [['Sable', 'Champion', 'IGL', '4.97', '903'], ['Kova', 'Champion', 'Entry', '4.96', '844'], ['Thorn', 'Diamond 1', 'Support', '4.95', '612'], ['Milo', 'Emerald 1', 'Flex', '4.91', '287']] },
      { id: 'tft', online: '54',
        mates: [['Nami', 'Challenger', 'Fast 8', '4.98', '517'], ['Sora', 'Grandmaster', 'Flex comps', '4.97', '688'], ['Elio', 'Master 312 LP', 'Reroll', '4.95', '421'], ['Bram', 'Diamond 1', 'Econ', '4.90', '203']] },
      { id: 'fc', online: '52',
        mates: [['Leo', 'Elite', 'Possession', '4.96', '598'], ['Iker', 'Elite', 'Counter', '4.95', '377'], ['Matti', 'Division 1', 'Skiller', '4.94', '412'], ['Cruz', 'Division 2', 'All-round', '4.90', '166']] }
    // name and icon come from the shared list (lib/games.js), so they match every other page.
    // Shown by teammates online, most first (ties keep the demand order), so busy games lead.
    ].map((x) => ({
      ...x, name: GAME[x.id].name, img: GAME[x.id].img,
      // services, bundles and units per game come from lib/catalog.js, ranks and rank prices from lib/ranks.js
      ...servicesFor(x.id)
    }))
      .sort(byDemand())
      .sort((a, b) => Number(String(b.online).replace(/\D/g, '')) - Number(String(a.online).replace(/\D/g, '')));
  }
  renderVals() {
    const s = this.state;
    const cur = s.cur || 'EUR';
    const conv = (p) => cur === 'USD' ? Math.ceil(p * (s.usdRate || 1.13)) - 0.01 : p;
    const money = (n) => (cur === 'USD' ? '$' : '€') + n.toFixed(2);
    const eur = (n) => money(conv(n));
    const all = this.data();
    const g = all.find((x) => x.id === s.game) || all[0];
    // the game's main service (lib/catalog.js `main`) is preselected and is what bundles are made of
    const top = g.modes.find((m) => m.id === g.main) || g.modes[0];
    const sel = g.modes.find((m) => m.id === s.mode) || top;
    const unit = sel.unit || 'game';
    // Rank only matters for ranked play (lib/ranks.js): there it sets the price, everywhere else it isn't asked.
    // Some modes have their own ladder (League Arena, CS2 Wingman), so the ranks come from the chosen service.
    const ranks = ranksOf(g.id, sel.id);
    const ranked = ranks.length > 0;
    const rank = ranks.indexOf(s.rank) >= 0 ? s.rank : defaultRank(g.id, sel.id);
    const priceOf = (m) => rankPrice(g.id, m.id, m.price, rank);
    const disc = { 1: 0, 3: 0.10, 5: 0.15, 10: 0.25 };
    const check = (a) => 'flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; ' +
      (a ? 'background: #D6BBFF;' : 'background: transparent; border: 1.5px solid rgba(196, 170, 255, .2); box-sizing: border-box;');
    const cardBase = 'display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-height: 196px; padding: 22px; border-radius: 20px; text-align: left; color: #F3EEFF; ';
    const cardOn = 'background: #1B1033; border: 1.5px solid #D6BBFF;';
    const cardOff = 'background: #120B22; border: 1.5px solid rgba(196, 170, 255, .08);';
    const badgeStyle = (b) => 'margin-left: auto; font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 8px; ' +
      (b && b.charAt(0) === '−' ? 'background: rgba(94, 234, 168, .12); color: #5EEAA8;' : 'background: rgba(240, 166, 255, .14); color: #F0A6FF;');

    const games = all.map((x, i) => {
      const active = x.id === g.id;
      return {
        name: x.name, img: x.img, online: x.online, active,
        pressed: active ? 'true' : 'false',
        // the online dots pulse slightly out of step, so the grid feels live instead of blinking in unison
        dotDelay: -((i * 0.37) % 1.8) + 's',
        style: 'display: flex; align-items: center; gap: 12px; min-width: 0; padding: 12px; border-radius: 18px; text-align: left; color: #FFFFFF; ' +
          (active ? 'background: #1B1033; border: 1.5px solid #D6BBFF;' : 'background: #120B22; border: 1.5px solid rgba(196, 170, 255, .08);'),
        pick: () => this.setState({ game: x.id, rank: '', queued: false })
      };
    });

    const card = (m) => {
      const active = m.id === sel.id && !s.bundle;
      return {
        title: m.title, tier: m.tier, desc: m.desc, badge: m.badge || '', badgeStyle: badgeStyle(m.badge),
        price: eur(priceOf(m)), per: '', was: m.was ? eur(m.was) : '',
        pressed: active ? 'true' : 'false', checkStyle: check(active),
        style: cardBase + (active ? cardOn : cardOff),
        pick: () => this.setState({ mode: m.id, bundle: null, qty: m.unit === 'hour' ? 1 : s.qty, queued: false })
      };
    };
    // three bundles of the main service, named per game (lib/catalog.js), in games or hours
    const topUnit = top.unit || 'game';
    const bundleDesc = {
      3: (u) => 'Three ' + u + 's of ' + top.title + ' with the same teammate. A good start to a session.',
      5: (u) => 'Five ' + u + 's of ' + top.title + ' with the same teammate. The most popular way to make real progress.',
      10: (u) => 'Ten ' + u + 's of ' + top.title + ' with the same teammate, at the best price per ' + u + '.'
    };
    const bundles = (g.bundles || []).map((title, i) => [title, [3, 5, 10][i]]).map(([title, n]) => {
      const active = s.bundle === title;
      const full = conv(priceOf(top)) * n;
      const b = '−' + Math.round(disc[n] * 100) + '%';
      return {
        title, tier: n + ' ' + topUnit + 's · ' + top.tier, desc: bundleDesc[n](topUnit), badge: b, badgeStyle: badgeStyle(b),
        price: money(full * (1 - disc[n])), per: '', was: money(full),
        pressed: active ? 'true' : 'false', checkStyle: check(active),
        style: cardBase + (active ? cardOn : cardOff),
        pick: () => this.setState({ bundle: title, mode: top.id, qty: n, queued: false })
      };
    });
    const by = (c) => g.modes.filter((m) => m.cat === c).map(card);
    const sets = { duo: by('duo'), bundles, gg: by('gg'), other: by('other'), social: by('social'), training: by('training') };
    // a tab with nothing for this game (e.g. no full-team mode in TFT) is hidden; if it was open, show Duo
    const curTab = sets[s.tab] && sets[s.tab].length ? s.tab : 'duo';
    const tabs = [['duo', 'Duo'], ['bundles', 'Bundles'], ['gg', 'Gamer Girls'], ['other', 'Teams'], ['social', 'Social'], ['training', 'Coaching']].filter(([id]) => sets[id].length).map(([id, label]) => {
      const a = curTab === id;
      return {
        label, count: String(sets[id].length), pressed: a ? 'true' : 'false',
        style: 'display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; border-radius: 10px; border: none; font-size: 14px; font-weight: 600; ' +
          (a ? 'background: #F3EEFF; color: #17092E;' : 'background: transparent; color: #A79DC4;'),
        countStyle: 'font-size: 11.5px; font-weight: 600; padding: 1px 7px; border-radius: 6px; ' + (a ? 'background: rgba(23, 9, 46, .1);' : 'background: rgba(196, 170, 255, .1);'),
        pick: () => this.setState({ tab: id })
      };
    });

    const AV = ['/assets/avatars/avatar-1.png', '/assets/avatars/avatar-2.png', '/assets/avatars/avatar-3.png', '/assets/avatars/avatar-4.png', '/assets/avatars/avatar-5.png', '/assets/avatars/avatar-6.png', '/assets/avatars/avatar-7.png', '/assets/avatars/avatar-8.png', '/assets/avatars/avatar-9.png', '/assets/avatars/avatar-10.png'];
    const FLAG = { DE: '/assets/flags/de.png', FR: '/assets/flags/fr.png', SE: '/assets/flags/se.png', ES: '/assets/flags/es.png', JP: '/assets/flags/jp.png', US: '/assets/flags/us.png', BR: '/assets/flags/br.png', PL: '/assets/flags/pl.png', KR: '/assets/flags/kr.png', NL: '/assets/flags/nl.png' };
    const CCS = ['DE', 'FR', 'SE', 'ES', 'JP', 'US', 'BR', 'PL', 'KR', 'NL'];
    const gi = all.indexOf(g);
    const mates = g.mates.map((m, i) => {
      const cc = CCS[(gi * 3 + i * 2) % 10];
      return { name: m[0], rank: m[1], role: m[2], rating: m[3], games: m[4], av: AV[(gi * 2 + i) % 10], cc, flag: FLAG[cc] };
    });

    const imgOf = (id) => all.find((x) => x.id === id).img;
    const tk = [['lol', 'Sam', 'Duo Pro', '58s'], ['cs2', 'Jan', '5-Stack Premier', '1m 08s'], ['val', 'Lea', 'Duo Apex', '1m 12s'], ['fn', 'Zoe', 'Duo Pro', '49s'], ['cod', 'Max', 'Ranked 4-Stack', '1m 19s'], ['ow', 'Jonas', 'Play & Learn', '44s'], ['r6', 'Elif', 'Duo Pro', '1m 02s'], ['mr', 'Ari', 'Rank Rush ×5', '1m 31s'], ['tft', 'Ivy', 'Double Up', '55s'], ['pu', 'Noah', 'Duo Pro', '2m 03s'], ['lol', 'Mia', 'All-Nighter ×10', '37s'], ['fc', 'Luca', 'Co-op Rivals', '1m 27s'], ['fn', 'Leo', 'Squads & Trios', '1m 05s'], ['apex', 'Nina', 'Duo Pro', '52s'], ['cs2', 'Oskar', 'Duo Apex', '1m 40s'], ['rl', 'Theo', 'Duo Apex', '1m 14s'], ['mc', 'Ava', 'PvP Duo', '41s'], ['arc', 'Kian', 'Full Squad Raids', '1m 22s'], ['val', 'Finn', '5-stack', '1m 50s']];
    // Teammates in the carousel and on the globe: at least one per game, so every game shows up with its own icon
    // (the first 7 are the globe pins: the seven most-booked games)
    const players = [
      ['Kairo', 'DE', 'lol', 'Master 214 LP', '4.97'], ['Vexa', 'FR', 'val', 'Immortal 3', '4.96'], ['Kaz', 'PL', 'cs2', 'FACEIT Level 10', '4.97'],
      ['Blitz', 'BR', 'fn', 'Unreal', '4.97'], ['Ghost', 'US', 'cod', 'Iridescent', '4.96'], ['Vale', 'SE', 'apex', 'Apex Predator', '4.96'],
      ['Sable', 'FR', 'r6', 'Champion', '4.97'], ['Sol', 'ES', 'mr', 'Celestial 2', '4.97'], ['Wren', 'SE', 'ow', 'Grandmaster 2', '4.98'],
      ['Pip', 'NL', 'rl', 'Supersonic Legend', '4.98'], ['Nami', 'KR', 'tft', 'Challenger', '4.98'], ['Leo', 'ES', 'fc', 'Elite', '4.96'],
      ['Hex', 'DE', 'arc', 'Elite', '4.96'], ['Pixel', 'BR', 'mc', 'Top PvPer', '4.97'], ['Momo', 'JP', 'pu', 'Master 1712', '4.97'],
      ['Nyx', 'US', 'lol', 'Grandmaster', '4.95'], ['Dima', 'DE', 'cs2', 'Premier 24,800', '4.95'], ['Rhea', 'FR', 'apex', 'Master', '4.94'],
      ['Isa', 'PL', 'ow', 'Champion 5', '4.96'], ['Ace', 'US', 'rl', 'Grand Champion 2', '4.97'], ['Lumi', 'KR', 'mr', 'Eternity', '4.95'], ['Tavi', 'NL', 'lol', 'Master 88 LP', '4.99']
    ].map((p, i) => ({
      name: p[0], cc: p[1], img: imgOf(p[2]), rank: p[3], rating: p[4], av: AV[i % AV.length], flag: FLAG[p[1]]
    }));
    const pinPos = [[24, 30], [60, 16], [80, 42], [44, 50], [20, 66], [62, 76], [82, 62]];
    const pins = pinPos.map((xy, i) => {
      const p = players[i];
      return {
        av: p.av, flag: p.flag, cc: p.cc, img: p.img, name: p.name, rank: p.rank, showTag: i === 1 || i === 3 || i === 6,
        wrap: 'position: absolute; left: ' + xy[0] + '%; top: ' + xy[1] + '%; transform: translate(-50%, -50%); animation: dlbob ' + (5 + i % 3) + 's ease-in-out ' + (-i) + 's infinite; display: flex; align-items: center; gap: 8px; flex-direction: ' + (xy[0] >= 60 ? 'row-reverse' : 'row') + ';',
        avatar: 'position: relative; flex: 0 0 auto; width: 50px; height: 50px; border-radius: 50%; box-shadow: 0 12px 28px rgba(0, 0, 0, .6);',
        ring: 'position: absolute; inset: 0; border-radius: 50%; border: 2px solid ' + ['#F0A6FF', '#D6BBFF', '#9EE6FF', '#FFD0A6'][i % 4] + '; animation: dlring 2.4s ease-out ' + (-i * 0.4) + 's infinite;'
      };
    });
    const carousel = players.concat(players);
    const row =tk.map((t) => ({ img: imgOf(t[0]), who: t[1], what: t[2], time: 'in ' + t[3] }));
    const ticker = row.concat(row);

    const qtys = [1, 3, 5, 10].map((n) => ({
      n: String(n), save: disc[n] ? '−' + Math.round(disc[n] * 100) + '%' : ' ',
      pressed: s.qty === n ? 'true' : 'false',
      style: 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 48px; border-radius: 10px; border: none; ' +
        (s.qty === n ? 'background: #F3EEFF; color: #17092E;' : 'background: transparent; color: #CFC4EA;'),
      pick: () => this.setState({ qty: n, bundle: null })
    }));

    const toggles = [['voice', 'Voice on Discord'], ['same', 'Same teammate every game']].map(([k, label]) => {
      const a = !!s[k];
      return {
        label, pressed: a ? 'true' : 'false',
        track: 'position: relative; width: 34px; height: 20px; border-radius: 999px; transition: background-color .15s; ' + (a ? 'background: #D6BBFF;' : 'background: #2A1F45;'),
        knob: 'position: absolute; top: 3px; left: ' + (a ? '17px' : '3px') + '; width: 14px; height: 14px; border-radius: 50%; transition: left .15s; background: ' + (a ? '#17092E' : '#8E84AB') + ';',
        pick: () => this.setState({ [k]: !a })
      };
    });

    const payList = [
      ['apple', 'Apple Pay', '/assets/payments/apple-pay.png', '#000000', 22],
      ['google', 'Google Pay', '/assets/payments/google-pay.png', '#FFFFFF', 22],
      ['paypal', 'PayPal', '/assets/payments/paypal.png', '#FFC439', 20],
      ['card', 'Card', '', '#090414', 0]
    ];
    const pays = payList.map(([id, label, img, bg, h]) => {
      const a = s.pay === id;
      return {
        label, img, noImg: !img, active: a, pressed: a ? 'true' : 'false',
        imgStyle: 'height: ' + h + 'px; width: auto; display: block;',
        style: 'position: relative; display: flex; align-items: center; justify-content: center; min-height: 50px; border-radius: 12px; background: ' + bg + '; ' +
          'border: 1px solid ' + (id === 'card' ? 'rgba(196, 170, 255, .16)' : (id === 'apple' ? 'rgba(255, 255, 255, .14)' : bg)) + '; ' +
          (a ? 'opacity: 1;' : 'opacity: .55;'),
        pick: () => this.setState({ pay: id })
      };
    });
    const payLabel = (payList.find((p) => p[0] === s.pay) || payList[0])[1];

    const sub = conv(priceOf(sel)) * s.qty;
    // the rank picker: every rank of this service's ladder with its price per unit
    const rankOpts = ranks.map((r) => ({
      name: r, active: r === rank, sel: r === rank ? 'true' : 'false',
      price: eur(rankPrice(g.id, sel.id, sel.price, r)),
      pick: () => this.setState({ rank: r, rankOpen: false })
    }));
    // multi-game / multi-hour discount on play sessions (coaching is always full price)
    const save = sub * (sel.cat !== 'training' ? (disc[s.qty] || 0) : 0);
    const total = sub - save;
    // Duoly balance (refunds, cashback, gifts) pays first when switched on; the payment method gets the rest.
    // The server does the same sum again (lib/orders.js placeOrder), this is only what we show.
    const walletHere = Math.round((cur === 'USD' ? s.wallet * (s.usdRate || 1.13) : s.wallet) * 100) / 100;
    const hasWallet = walletHere >= 0.01;
    const walletUse = hasWallet && s.useWallet ? Math.min(walletHere, total) : 0;
    const due = Math.max(0, Math.round((total - walletUse) * 100) / 100);
    const allWallet = walletUse > 0 && due < 0.01;
    const units = s.qty + ' ' + (s.qty === 1 ? unit : unit + 's');

    // Questions live in lib/faq.js (also published as FAQPage structured data for search engines).
    const tab = FAQ_TABS.find((t) => t.id === s.faqTab) || FAQ_TABS[0];
    const tabId = tab.id;
    const faqTabs = FAQ_TABS.map(({ id, label }) => {
      const a = tabId === id;
      return {
        id, label, pressed: a ? 'true' : 'false',
        style: 'min-height: 40px; padding: 0 16px; border-radius: 999px; font-size: 14px; font-weight: 600; ' +
          (a ? 'background: #F3EEFF; color: #17092E; border: 1px solid #F3EEFF;' : 'background: transparent; color: #CFC4EA; border: 1px solid rgba(196, 170, 255, .16);'),
        pick: () => this.setState({ faqTab: id, faqOpen: 0 })
      };
    });
    const openIdx = s.faqOpen === undefined ? 0 : s.faqOpen;
    const faqs = tab.items.map(([q, a], i) => {
      const open = openIdx === i;
      return {
        q, a, open, num: String(i + 1).padStart(2, '0'), expanded: open ? 'true' : 'false', id: 'faq-' + tabId + '-' + i,
        wrap: 'border-radius: 20px; ' + (open ? 'background: #1B1033; border: 1px solid rgba(214, 187, 255, .3);' : 'background: #120B22; border: 1px solid rgba(196, 170, 255, .08);'),
        iconWrap: 'flex: 0 0 auto; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: transform .2s ease; ' +
          (open ? 'background: #D6BBFF; color: #17092E; transform: rotate(45deg);' : 'background: rgba(196, 170, 255, .08); color: #D6BBFF;'),
        toggle: () => this.setState({ faqOpen: open ? -1 : i })
      };
    });

    return {
      faqTabs, faqs,
      curKnown: !!s.cur, curOpen: !!s.curMenu, curOpenStr: s.curMenu ? 'true' : 'false',
      curSymbol: cur === 'USD' ? '$' : '€', curCode: cur, curAria: 'Currency: ' + cur,
      curWhere: s.curManual ? (this.signedIn() ? 'Your choice · saved to your account' : 'Your choice · saved on this device') :('Auto-detected' + (s.curCity ? ' · ' + s.curCity : '')),
      toggleCur: () => this.setState({ curMenu: !this.state.curMenu }),
      curOptions: [['EUR', 'Euro', '€', '€9.99'], ['USD', 'US Dollar', '$', '$10.99']].map(([code, name, symbol, example]) => {
        const sel = cur === code;
        return {
          code, name, symbol, example, sel: sel ? 'true' : 'false', isSel: sel,
          badge: 'width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; ' + (sel ? 'background: #D6BBFF; color: #17092E;' : 'background: rgba(214, 187, 255, .1); color: #D6BBFF;'),
          style: 'width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 12px; border: none; text-align: left; transform: none; ' + (sel ? 'background: rgba(214, 187, 255, .1);' : 'background: transparent;'),
          pick: () => {
            try { window.localStorage.setItem('duoly-currency', code); } catch (e) {}
            if (this.props.onCurrency) this.props.onCurrency(code);
            this.setState({ cur: code, curMenu: false, curManual: true });
          }
        };
      }),
      ...this.vienna(),
      games, tabs, cards: sets[curTab], mates, ticker, pins, carousel, qtys, toggles, pays,
      game: { name: g.name, img: g.img },
      sel: { title: s.bundle || sel.title, tier: sel.tier },
      rank, ranked, rankOpts, rankOpen: !!s.rankOpen, rankOpenStr: s.rankOpen ? 'true' : 'false',
      toggleRank: () => this.setState({ rankOpen: !this.state.rankOpen }),
      closeRank: () => this.setState({ rankOpen: false }),
      rankKey: (e) => { if (e.key === 'Escape') this.setState({ rankOpen: false }); },
      rankLine: sel.tier + (ranked ? ' · from ' + rank : ''),      qty: s.qty, qtyUnit: s.qty === 1 ? unit : unit + 's',
      qtyLabel: 'How many ' + unit + 's',
      unitPrice: eur(priceOf(sel)), subtotal: money(sub), saveAmt: money(save), total: money(total),
      hasSave: save > 0, proSave: money(total * 0.1),
      savePct: Math.round((disc[s.qty] || 0) * 100) + '%',
      hasWallet, walletOn: !!s.useWallet, walletPressed: s.useWallet ? 'true' : 'false',
      walletAvail: money(walletHere), walletUse: money(walletUse), usesWallet: walletUse > 0, allWallet,
      toggleWallet: () => this.setState({ useWallet: !this.state.useWallet }),
      due: money(due), units, unitWord: unit,
      payNote: 'One payment for all ' + units + ', charged once when you queue. Nothing is charged after each ' + unit + '.',
      ctaLabel: allWallet ? 'Pay ' + money(total) + ' with Duoly balance' : 'Pay ' + money(due) + ' with ' + payLabel,
      ...this.authVals(s),
      ...this.confirmVals(s, { g, sel, unit, rank: ranked ? rank : '', total, due, walletUse, allWallet, cur, money, payLabel }),
      queue: this.startQueue
    };
  }
  // The "are you sure?" step before we charge and put the order in the queue.
  confirmVals(s, { g, sel, unit, rank, total, due, walletUse, allWallet, cur, money, payLabel }) {
    const ignLabel = IGN_LABEL[g.id] || 'in-game name';
    // Minecraft has no regions: the server address (or "my own world") and the edition instead
    const byName = usesServerName(g.id);
    const servers = serversFor(g.id);
    const server = servers.find((x) => x[0] === s.region) || servers[0];
    // the picker: continent tabs when a game has many servers, then a grid of server tiles with flags
    const groups = [];
    servers.forEach(([value, label, group]) => {
      let grp = groups.find((x) => x.name === group);
      if (!grp) groups.push(grp = { name: group, items: [] });
      grp.items.push({ value, label: label === value ? '' : label, on: value === server[0], flag: flagSrc(serverFlag(value, g.id)), pick: () => this.setState({ region: value, serverOpen: false, serverTab: '' }) });
    });
    const tabbed = servers.length > 8 && groups.length > 1;
    const tabName = tabbed ? (groups.some((x) => x.name === s.serverTab) ? s.serverTab : server[2]) : '';
    const serverTabs = tabbed ? groups.map((x) => ({ name: x.name, count: x.items.length, on: x.name === tabName, hasPick: x.items.some((i) => i.on), pick: () => this.setState({ serverTab: x.name }) })) : [];
    const serverTiles = tabbed ? (groups.find((x) => x.name === tabName) || groups[0]).items : groups.reduce((all, x) => all.concat(x.items), []);
    const amount = Math.round(total * 100) / 100;
    const place = async (e) => {
      if (e) e.preventDefault();
      const st = this.state;
      const ign = (st.ign || '').trim();
      if (ign.length < 2) return this.setState({ placeErr: 'Add your ' + ignLabel + ' so your teammate can invite you.' });
      const mcServer = (st.mcServer || '').trim();
      if (byName && mcServer.length < 2) return this.setState({ placeErr: 'Add the server you play on (or “my own world”).' });
      const region = byName ? mcServer + ' · ' + (st.mcEdition || MC_EDITIONS[0]) : st.region;
      this.setState({ placing: true, placeErr: '' });
      if (this.props.onCheckout) {
        // Live: the server prices the order and opens Stripe checkout.
        const result = await this.props.onCheckout({
          gameId: g.id, serviceId: sel.id, units: st.qty,
          server: byName ? mcServer : server[0],
          ...(rank ? { rank } : {}),
          ...(byName ? { edition: st.mcEdition || MC_EDITIONS[0] } : {}),
          ign, note: (st.orderNote || '').trim(), voice: !!st.voice
        });
        if (result && result.url) {
          try {
            window.localStorage.setItem('duoly-ign-' + g.id, ign);
            if (byName) window.localStorage.setItem('duoly-mc-server', mcServer);
            else window.localStorage.setItem('duoly-server-' + g.id, st.region);
          } catch (err) {}
          window.location.href = result.url;
          return;
        }
        if (result && result.orderId) { window.location.href = '/queue/' + result.orderId; return; }
        return this.setState({ placing: false, placeErr: (result && result.error) || 'Couldn’t start checkout. Please try again.' });
      }
      try {
        const res = await fetch('/api/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game: g.id, title: st.bundle || sel.title, badge: st.bundle ? 'Bundle' : sel.cat === 'training' ? 'Coaching' : sel.cat === 'social' ? 'Social' : sel.cat === 'gg' ? 'Gamer Girl' : '',
            cat: st.bundle ? 'bundle' : sel.cat, // 'gg' orders only go to Gamer Girl teammates
            games: st.qty, unit, rank, region, ign, note: (st.orderNote || '').trim(), voice: !!st.voice,
            total: amount, currency: cur, method: payLabel, useWallet: walletUse > 0
          })
        });
        const d = await res.json().catch(() => ({}));
        if (res.status === 401) return this.setState({ placing: false, confirmOpen: false }, this.startQueue);
        if (!res.ok || !d.order) return this.setState({ placing: false, placeErr: d.error || 'Couldn’t queue you. Please try again.' });
        try {
          window.localStorage.setItem('duoly-ign-' + g.id, ign);
          if (byName) window.localStorage.setItem('duoly-mc-server', mcServer);
          else window.localStorage.setItem('duoly-server-' + g.id, st.region);
        } catch (err) {}
        window.location.href = '/queue/' + d.order.id; // stays "placing" until the waiting page loads
      } catch (err) {
        this.setState({ placing: false, placeErr: 'Can’t reach Duoly right now. Check your connection and try again.' });
      }
    };
    return {
      confirmOpen: !!s.confirmOpen,
      closeConfirm: () => { if (!this.state.placing) this.setState({ confirmOpen: false }); },
      confirmTotal: money(amount), confirmPay: payLabel, confirmCur: cur,
      // step 1 of "what happens next": exactly where the money comes from, once
      chargeTitle: this.props.onCheckout ? 'Pay ' + money(amount) + ' securely with Stripe' : allWallet ? money(amount) + ' comes from your Duoly balance' : walletUse > 0 ? 'We charge ' + money(due) + ' to your ' + payLabel : 'We charge ' + money(amount) + ' to your ' + payLabel,
      chargeText: this.props.onCheckout ? 'Apple Pay, Google Pay, PayPal, cards and 20+ local methods. Cards, wallets and PayPal are only charged when a teammate accepts.' : (walletUse > 0 && !allWallet ? 'The other ' + money(walletUse) + ' comes from your Duoly balance. ' : '') +
        'One payment for all ' + s.qty + ' ' + (s.qty === 1 ? unit : unit + 's') + ', nothing is charged later. Cancel for free until a teammate accepts.',
      confirmLine: s.qty + ' ' + (s.qty === 1 ? unit : unit + 's') + (rank ? ' · from ' + rank : '') + ' · ' + (s.voice ? 'voice on Discord' : 'text chat'),
      ignLabel, ignPlaceholder: g.id === 'lol' || g.id === 'val' || g.id === 'tft' ? 'Name#TAG' : g.id === 'ow' ? 'Name#1234' : g.id === 'cod' ? 'Name#1234567' : 'Your ' + ignLabel,
      ign: s.ign || '', setIgn: (e) => this.setState({ ign: e.target.value, placeErr: '' }),
      notePlaceholder: 'e.g. ' + ({
        lol: 'I main support, need a jungler who calls', tft: 'I always go for reroll comps, help me level better', val: 'I play Sova, need someone to entry',
        cs2: 'I usually AWP, need someone who calls the rounds', fn: 'Zero Build please, I want to work on endgames', cod: 'Warzone duos, I play aggressive',
        apex: 'I play Wraith, help me with rotations', r6: 'I main defense, teach me some setups', mr: 'I play Strategist, need a Vanguard',
        ow: 'I play support, need a tank who makes space', rl: 'Help me with rotations and kickoffs', fc: 'I want to get better at defending',
        arc: 'First time on this map, show me good loot spots', mc: 'Bedwars, I want to get better at bridging', pu: 'I play Attacker, need someone in the jungle'
      }[g.id] || 'what you want to work on'),
      orderNote: s.orderNote || '', setOrderNote: (e) => this.setState({ orderNote: e.target.value }),
      byName, serverTabs, serverTiles, serverValue: server[0], serverLabel: server[1] === server[0] ? '' : server[1],
      serverFlag: flagSrc(serverFlag(server[0], g.id)),
      serverOpen: !!s.serverOpen, serverOpenStr: s.serverOpen ? 'true' : 'false',
      toggleServer: () => this.setState({ serverOpen: !this.state.serverOpen, serverTab: '' }),
      mcServer: s.mcServer || '', setMcServer: (e) => this.setState({ mcServer: e.target.value, placeErr: '' }),
      mcEditions: MC_EDITIONS.map((ed) => ({ ed, on: (s.mcEdition || MC_EDITIONS[0]) === ed, pick: () => this.setState({ mcEdition: ed }) })),
      region: byName ? ((s.mcServer || '').trim() || 'your server') : server[0],
      placing: !!s.placing, placeErr: s.placeErr || '',
      placeLabel: this.props.onCheckout ? (s.placing ? 'Opening checkout…' : 'Continue to payment · ' + money(amount)) : s.placing ? (allWallet ? 'Paying with your balance…' : 'Charging ' + payLabel + '…') : 'Pay ' + money(allWallet ? amount : due) + ' & queue',
      placeOrder: place
    };
  }

  render() {
    const v = this.renderVals();
    return (
      <div style={{ minHeight: "100vh", background: "#090414", color: "#F3EEFF", fontFamily: "Geist, system-ui, sans-serif", fontSize: "15px", lineHeight: "1.5", fontVariantNumeric: "tabular-nums" }}>
        <header style={{ position: "sticky", top: "0", zIndex: "6", background: "rgba(9, 4, 20, .8)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(196, 170, 255, .08)" }}>
          <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "10px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 32px" }}>
            <a href="#top" aria-label="Duoly home" style={{ display: "flex", alignItems: "center" }}>
              <img src="/assets/brand/logo-wordmark.webp" alt="Duoly" width="104" height="39" style={{ width: "104px", height: "39px", display: "block" }} />
            </a>
            <nav aria-label="Main" style={{ display: "flex", flexWrap: "wrap", gap: "4px 26px", fontSize: "14px", fontWeight: "500" }}>
              <a href="#games" style={{ textDecoration: "none" }}>
                Games
              </a>
              <a href="#how" style={{ textDecoration: "none" }}>
                How it works
              </a>
              <a href="#faq" style={{ textDecoration: "none" }}>
                FAQ
              </a>
              {v.isCustomer || v.signedOut ? (
                <a href="/apply" style={{ textDecoration: "none" }}>
                  Become a teammate
                </a>
              ) : null}
            </nav>
            <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
              {v.curKnown ? (
                <>
                  <div style={{ position: "relative" }}>
                    <button type="button" aria-haspopup="listbox" aria-expanded={v.curOpenStr} aria-label={v.curAria} onClick={v.toggleCur} style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "44px", padding: "0 10px 0 6px", borderRadius: "12px", border: "1px solid rgba(196, 170, 255, .14)", background: "transparent", color: "#F3EEFF", fontSize: "13px", fontWeight: "600" }}>
                      <span style={{ width: "32px", height: "32px", borderRadius: "9px", background: "rgba(214, 187, 255, .12)", color: "#D6BBFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800" }}>
                        {v.curSymbol}
                      </span>
                      {v.curCode}
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E84AB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {v.curOpen ? (
                      <>
                        <div role="listbox" aria-label="Currency" className="dl-pop" style={{ position: "absolute", right: "0", top: "calc(100% + 8px)", zIndex: "20", width: "264px", padding: "8px", borderRadius: "18px", background: "#170E2C", border: "1px solid rgba(214, 187, 255, .18)", boxShadow: "0 24px 60px rgba(0, 0, 0, .6)", animation: "dlpop .18s ease-out" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px 10px", fontSize: "12px", color: "#8E84AB" }}>
                            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
                              <circle cx="12" cy="9.5" r="2.5" />
                            </svg>
                            {v.curWhere}
                          </div>
                          {v.curOptions.map((c, $index) => (
                            <React.Fragment key={$index}>
                              <button type="button" role="option" aria-selected={c.sel} onClick={c.pick} style={css(c.style)}>
                                <span style={css(c.badge)}>
                                  {c.symbol}
                                </span>
                                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: "1.3" }}>
                                  <span style={{ fontWeight: "600", color: "#FFFFFF" }}>
                                    {c.name}
                                  </span>
                                  <span style={{ fontSize: "12px", color: "#8E84AB" }}>
                                    {c.code}
                                  </span>
                                </span>
                                {c.isSel ? (
                                  <>
                                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D6BBFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}>
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  </>
                                ) : null}
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </>
              ) : null}
              {v.signedOut ? (
                <>
                  <button type="button" onClick={v.openAuth} style={{ display: "flex", alignItems: "center", minHeight: "44px", padding: "0 18px", borderRadius: "12px", border: "none", background: "#F3EEFF", color: "#17092E", fontSize: "14px", fontWeight: "600" }}>
                    Sign in
                  </button>
                </>
              ) : null}
              {v.signedIn ? (
                <>
                  <div style={{ position: "relative" }}>
                    <button type="button" onClick={v.toggleAccount} aria-haspopup="menu" aria-expanded={v.accountOpenStr} aria-label="Account menu" style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "44px", padding: "0 12px 0 4px", borderRadius: "12px", border: "1px solid rgba(196, 170, 255, .14)", background: "transparent", color: "#F3EEFF", fontSize: "14px", fontWeight: "600" }}>
                      <img src={v.userAvatar} alt="" width="34" height="34" referrerPolicy="no-referrer" style={{ width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover" }} />
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: "1.2" }}>
                        <span>
                          {v.userName}
                        </span>
                        <span style={{ fontSize: "11.5px", fontWeight: "500", color: "#8E84AB" }}>
                          {v.creditLabel}
                        </span>
                      </span>
                    </button>
                    {v.accountOpen ? (
                      <>
                        <div role="menu" className="dl-pop" style={{ position: "absolute", right: "0", top: "calc(100% + 8px)", zIndex: "20", width: "240px", padding: "8px", borderRadius: "18px", background: "#170E2C", border: "1px solid rgba(214, 187, 255, .18)", boxShadow: "0 24px 60px rgba(0, 0, 0, .6)", animation: "dlpop .18s ease-out" }}>
                          <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid rgba(196, 170, 255, .1)", marginBottom: "6px" }}>
                            <div style={{ fontWeight: "600", color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {v.userName}
                            </div>
                            <div style={{ fontSize: "12px", color: "#8E84AB" }}>
                              {v.userVia}
                            </div>
                          </div>
                          <a href={v.homeHref} role="menuitem" style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "42px", padding: "0 10px", borderRadius: "10px", background: v.isAdmin ? "rgba(255, 138, 155, .1)" : "rgba(214, 187, 255, .08)", color: v.isAdmin ? "#FF8A9B" : "#FFFFFF", fontSize: "14px", fontWeight: "600", textDecoration: "none" }}>
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={v.isAdmin ? "currentColor" : "#D6BBFF"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              {v.isAdmin ? <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /> : v.isTeammate ? <path d="M17.3 5H6.7a4 4 0 0 0-4 3.6l-.6 6A3 3 0 0 0 5 18c1 0 1.6-.5 2.1-1.3L8.5 15h7l1.4 1.7c.5.8 1.1 1.3 2.1 1.3a3 3 0 0 0 2.9-3.4l-.6-6A4 4 0 0 0 17.3 5zM6 11h4M8 9v4" /> : <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />}
                            </svg>
                            {v.homeLabel}
                            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E84AB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}>
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          </a>
                          <a href="/profile" role="menuitem" style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "42px", padding: "0 10px", borderRadius: "10px", color: "#F3EEFF", fontSize: "14px", fontWeight: "600", textDecoration: "none" }}>
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="8" r="4" />
                              <path d="M4 21a8 8 0 0 1 16 0" />
                            </svg>
                            Edit profile
                          </a>
                          {v.isTeammate || v.isAdmin ? (
                            <a href="/rules" role="menuitem" style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "42px", padding: "0 10px", borderRadius: "10px", color: "#F3EEFF", fontSize: "14px", fontWeight: "600", textDecoration: "none" }}>
                              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
                              </svg>
                              Teammate rules
                            </a>
                          ) : null}
                          <button type="button" role="menuitem" onClick={v.signOut} style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", minHeight: "42px", padding: "0 10px", borderRadius: "10px", border: "none", background: "transparent", color: "#F3EEFF", fontSize: "14px", fontWeight: "600", textAlign: "left", transform: "none" }}>
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                              <path d="M16 17l5-5-5-5" />
                              <path d="M21 12H9" />
                            </svg>
                            Sign out
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>
        <main id="top">
          <section aria-labelledby="hero-h" style={{ maxWidth: "1240px", margin: "0 auto", padding: "56px 24px 40px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "40px" }}>
            <div style={{ flex: "1 1 480px", minWidth: "0" }}>
              {/* Reassurance for first-time visitors: who you'll play with, and what happens if it doesn't work out */}
              <a href="#how" style={{ display: "inline-flex", alignItems: "center", gap: "12px", maxWidth: "100%", padding: "8px 18px 8px 8px", borderRadius: "18px", background: "rgba(27, 16, 51, .7)", border: "1px solid rgba(196, 170, 255, .16)", color: "#A79DC4", textDecoration: "none", fontSize: "13px", fontWeight: "500", lineHeight: "1.35" }}>
                <span aria-hidden="true" style={{ display: "flex", flex: "0 0 auto" }}>
                  {['avatar-1', 'avatar-2', 'avatar-3', 'avatar-5'].map((av, i) => (
                    <img key={av} src={'/assets/avatars/' + av + '.png'} alt="" width="28" height="28" style={{ width: "28px", height: "28px", marginLeft: i ? "-8px" : "0", borderRadius: "50%", display: "block", boxShadow: "0 0 0 2px #1B1033" }} />
                  ))}
                </span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#FFFFFF", fontWeight: "600", fontSize: "13.5px" }}>
                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5EEAA8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    Rank-verified teammates
                  </span>
                  <span>Not matched? You get your money back.</span>
                </span>
              </a>
              <h1 id="hero-h" style={{ margin: "18px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: "800", fontSize: "clamp(44px, 6vw, 80px)", lineHeight: ".95", letterSpacing: "-.04em", color: "#FFFFFF" }}>
                Duo up in
                <br />
                <span style={{ color: "#D6BBFF" }}>
                  under 2 minutes.
                </span>
              </h1>
              <p style={{ margin: "22px 0 0", maxWidth: "460px", color: "#A79DC4", fontSize: "18px", lineHeight: "1.55" }}>
                Pick your game, tap pay, and a high-rank teammate joins your lobby. No sign-up, no waiting around.
              </p>
              <div style={{ marginTop: "30px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                <a href="#games" style={{ display: "inline-flex", alignItems: "center", gap: "10px", minHeight: "54px", padding: "0 24px", borderRadius: "14px", background: "#D6BBFF", color: "#17092E", textDecoration: "none", fontSize: "16px", fontWeight: "700" }}>
                  Find my duo
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </a>
                <a href="#how" style={{ display: "inline-flex", alignItems: "center", minHeight: "54px", padding: "0 20px", borderRadius: "14px", border: "1px solid rgba(196, 170, 255, .2)", color: "#F3EEFF", textDecoration: "none", fontSize: "15px", fontWeight: "600" }}>
                  How it works
                </a>
              </div>
              <dl style={{ margin: "40px 0 0", display: "flex", flexWrap: "wrap", gap: "18px 0" }}>
                <div style={{ paddingRight: "28px", marginRight: "28px", borderRight: "1px solid rgba(196, 170, 255, .14)" }}>
                  <dt style={{ fontSize: "13px", color: "#8E84AB" }}>
                    Online now
                  </dt>
                  <dd style={{ margin: "2px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "28px", fontWeight: "700", letterSpacing: "-.02em", color: "#FFFFFF", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#5EEAA8", animation: "dlpulse 1.6s ease-in-out infinite" }} />
                    1,284
                  </dd>
                </div>
                <div style={{ paddingRight: "28px", marginRight: "28px", borderRight: "1px solid rgba(196, 170, 255, .14)" }}>
                  <dt style={{ fontSize: "13px", color: "#8E84AB" }}>
                    Avg. wait
                  </dt>
                  <dd style={{ margin: "2px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "28px", fontWeight: "700", letterSpacing: "-.02em", color: "#FFFFFF" }}>
                    1m 42s
                  </dd>
                </div>
                <div>
                  <dt style={{ fontSize: "13px", color: "#8E84AB" }}>
                    38k reviews
                  </dt>
                  <dd style={{ margin: "2px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "28px", fontWeight: "700", letterSpacing: "-.02em", color: "#FFFFFF" }}>
                    4.9 / 5
                  </dd>
                </div>
              </dl>
            </div>
            <div style={{ flex: "1 1 420px", minWidth: "0", position: "relative", display: "flex", justifyContent: "center" }}>
              <img src="/assets/brand/logo-full.webp" alt="Duoly mascots: two smiling gamers with headsets" width="560" height="456" style={{ width: "100%", maxWidth: "560px", height: "auto", display: "block" }} />
              <div style={{ position: "absolute", left: "0", top: "18%", width: "250px", padding: "14px", borderRadius: "18px", background: "rgba(22, 14, 40, .92)", backdropFilter: "blur(10px)", border: "1px solid rgba(196, 170, 255, .16)", boxShadow: "0 24px 60px rgba(0, 0, 0, .5)", animation: "dlfloat 6s ease-in-out infinite" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "600", color: "#5EEAA8", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#5EEAA8" }} />
                  Match found · 1m 08s
                </div>
                <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ position: "relative", flex: "0 0 auto", width: "42px", height: "42px" }}>
                    <img src="/assets/avatars/avatar-1.png" alt="" width="42" height="42" style={{ width: "42px", height: "42px", borderRadius: "50%", display: "block" }} />
                    <img src="/assets/flags/de.png" alt="Germany" width="16" height="16" style={{ position: "absolute", right: "-2px", bottom: "-2px", width: "16px", height: "16px", borderRadius: "50%", boxShadow: "0 0 0 2px #160E28" }} />
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", lineHeight: "1.3" }}>
                    <span style={{ fontWeight: "600", color: "#FFFFFF" }}>
                      Kairo
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#A79DC4" }}>
                      Master 214 LP · Mid
                    </span>
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>
                    ★ 4.97
                  </span>
                </div>
              </div>
              <div style={{ position: "absolute", right: "2%", bottom: "14%", display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px 10px 10px", borderRadius: "14px", background: "rgba(22, 14, 40, .92)", border: "1px solid rgba(196, 170, 255, .16)", boxShadow: "0 20px 50px rgba(0, 0, 0, .45)", fontSize: "13px", fontWeight: "600", color: "#F3EEFF", animation: "dlfloat 7s ease-in-out infinite reverse" }}>
                <img src="/assets/games/valorant.png" alt="" width="28" height="28" style={{ width: "28px", height: "28px", borderRadius: "8px" }} />
                Rank Rush ×5 ·{" "}
                <span style={{ color: "#5EEAA8" }}>
                  −15%
                </span>
              </div>
            </div>
          </section>
          <div aria-label="Recent matches" style={{ borderTop: "1px solid rgba(196, 170, 255, .08)", borderBottom: "1px solid rgba(196, 170, 255, .08)", overflow: "hidden", padding: "14px 0" }}>
            <div style={{ display: "flex", gap: "40px", width: "max-content", animation: "dlticker 58s linear infinite" }}>
              {v.ticker.map((t, $index) => (
                <React.Fragment key={$index}>
                  <span style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "#A79DC4", whiteSpace: "nowrap" }}>
                    <img src={t.img} alt="" width="22" height="22" style={{ width: "22px", height: "22px", borderRadius: "6px" }} />
                    <span style={{ color: "#F3EEFF", fontWeight: "600" }}>
                      {t.who}
                    </span>
                    {" "}got a {t.what}
                    <span style={{ color: "#5EEAA8" }}>
                      {t.time}
                    </span>
                    <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" style={{ marginLeft: "20px" }}>
                      <path fill="#4A3B70" d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" />
                    </svg>
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 24px" }}>
            <section id="games" aria-labelledby="games-h" style={{ marginTop: "72px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "14px", marginBottom: "18px" }}>
                <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "15px", fontWeight: "700", color: "#8E84AB" }}>
                  01
                </span>
                <h2 id="games-h" style={{ margin: "0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "30px", fontWeight: "700", letterSpacing: "-.025em", color: "#FFFFFF" }}>
                  Choose your game
                </h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(218px, 1fr))", gap: "10px" }}>
                {v.games.map((g, $index) => (
                  <React.Fragment key={$index}>
                    <button type="button" onClick={g.pick} aria-pressed={g.pressed} title={g.name} style={css(g.style)}>
                      {/* selected: highlighted card plus a check badge on the icon (no radio column, so names fit on one line) */}
                      <span style={{ position: "relative", flex: "0 0 auto", width: "48px", height: "48px" }}>
                        <img src={g.img} alt="" width="48" height="48" style={{ width: "48px", height: "48px", borderRadius: "13px", display: "block" }} />
                        {g.active ? (
                          <span aria-hidden="true" style={{ position: "absolute", right: "-6px", top: "-6px", width: "20px", height: "20px", borderRadius: "50%", background: "#D6BBFF", boxShadow: "0 0 0 3px #1B1033", display: "flex", alignItems: "center", justifyContent: "center", animation: "dlcheck .22s ease-out" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#17092E" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </span>
                        ) : null}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: "0", lineHeight: "1.3" }}>
                        <span style={{ maxWidth: "100%", fontWeight: "600", fontSize: "15px", color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {g.name}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12.5px", color: "#8E84AB" }}>
                          <span className="dl-online" style={{ animationDelay: g.dotDelay }} />
                          {g.online} online
                        </span>
                      </span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </section>
            <section aria-labelledby="modes-h" style={{ marginTop: "64px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", marginBottom: "18px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
                  <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "15px", fontWeight: "700", color: "#8E84AB" }}>
                    02
                  </span>
                  <h2 id="modes-h" style={{ margin: "0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "30px", fontWeight: "700", letterSpacing: "-.025em", color: "#FFFFFF" }}>
                    Pick a mode
                  </h2>
                </div>
                <div role="tablist" aria-label="Mode categories" style={{ display: "flex", flexWrap: "wrap", gap: "2px", padding: "4px", borderRadius: "14px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .1)" }}>
                  {v.tabs.map((t, $index) => (
                    <React.Fragment key={$index}>
                      <button type="button" role="tab" aria-selected={t.pressed} onClick={t.pick} style={css(t.style)}>
                        {t.label}{" "}
                        <span style={css(t.countStyle)}>
                          {t.count}
                        </span>
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: "12px" }}>
                {v.cards.map((m, $index) => (
                  <React.Fragment key={$index}>
                    <button type="button" onClick={m.pick} aria-pressed={m.pressed} style={css(m.style)}>
                      <span style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", width: "100%" }}>
                        <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "22px", fontWeight: "700", letterSpacing: "-.02em", color: "#FFFFFF", lineHeight: "1.1" }}>
                            {m.title}
                          </span>
                          <span style={{ fontSize: "13.5px", fontWeight: "600", color: "#D6BBFF" }}>
                            {m.tier}
                          </span>
                        </span>
                        <span style={css(m.checkStyle)}>
                          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#17092E" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </span>
                      </span>
                      <span style={{ fontSize: "14px", color: "#A79DC4", lineHeight: "1.5" }}>
                        {m.desc}
                      </span>
                      <span style={{ marginTop: "auto", paddingTop: "16px", display: "flex", alignItems: "baseline", gap: "8px", width: "100%" }}>
                        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "26px", fontWeight: "700", letterSpacing: "-.02em", color: "#FFFFFF" }}>
                          {m.price}
                        </span>
                        <span style={{ fontSize: "13px", color: "#8E84AB" }}>
                          {m.per}
                        </span>
                        {m.was ? (
                          <>
                            <span style={{ fontSize: "13px", color: "#6A6086", textDecoration: "line-through" }}>
                              {m.was}
                            </span>
                          </>
                        ) : null}
                        {m.badge ? (
                          <>
                            <span style={css(m.badgeStyle)}>
                              {m.badge}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ marginTop: "28px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                  <h3 style={{ margin: "0", fontSize: "15px", fontWeight: "600", color: "#FFFFFF" }}>
                    Teammates online for {v.game.name}
                  </h3>
                  <span style={{ fontSize: "13px", color: "#8E84AB" }}>
                    You’ll get the first one free — re-roll twice if the vibe’s off
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "10px" }}>
                  {v.mates.map((p, $index) => (
                    <React.Fragment key={$index}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "16px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .08)" }}>
                        <span style={{ position: "relative", flex: "0 0 auto", width: "44px", height: "44px" }}>
                          <img src={p.av} alt="" width="44" height="44" style={{ width: "44px", height: "44px", borderRadius: "50%", display: "block" }} />
                          <img src={p.flag} alt={p.cc} width="16" height="16" style={{ position: "absolute", right: "-2px", bottom: "-2px", width: "16px", height: "16px", borderRadius: "50%", boxShadow: "0 0 0 2px #120B22" }} />
                        </span>
                        <span style={{ display: "flex", flexDirection: "column", minWidth: "0", lineHeight: "1.35" }}>
                          <span style={{ fontWeight: "600", color: "#FFFFFF" }}>
                            {p.name}
                          </span>
                          <span style={{ fontSize: "12.5px", color: "#A79DC4" }}>
                            {p.rank} · {p.role}
                          </span>
                        </span>
                        <span style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: "1.35" }}>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>
                            ★ {p.rating}
                          </span>
                          <span style={{ fontSize: "11.5px", color: "#8E84AB" }}>
                            {p.games} games
                          </span>
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </section>
            <section id="checkout" aria-labelledby="co-h" style={{ marginTop: "64px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "14px", marginBottom: "18px" }}>
                <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "15px", fontWeight: "700", color: "#8E84AB" }}>
                  03
                </span>
                <h2 id="co-h" style={{ margin: "0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "30px", fontWeight: "700", letterSpacing: "-.025em", color: "#FFFFFF" }}>
                  Check out
                </h2>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "stretch" }}>
                <div style={{ flex: "999 1 520px", minWidth: "0", padding: "26px", borderRadius: "24px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .1)", display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "18px" }}>
                    {v.ranked ? (
                    <div onKeyDown={v.rankKey} style={{ position: "relative", flex: "1 1 220px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <span id="dl-rank-l" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                        Your current rank <span style={{ fontWeight: "500", color: "#6A6086" }}>· sets the price</span>
                      </span>
                      <button type="button" onClick={v.toggleRank} aria-haspopup="listbox" aria-expanded={v.rankOpenStr} aria-labelledby="dl-rank-l" style={{ display: "flex", alignItems: "center", gap: "12px", minHeight: "56px", padding: "0 16px", borderRadius: "14px", background: v.rankOpen ? "#1B1033" : "#090414", border: "1px solid " + (v.rankOpen ? "#D6BBFF" : "rgba(196, 170, 255, .14)"), color: "#FFFFFF", fontSize: "15px", fontWeight: "600", textAlign: "left", transform: "none" }}>
                        <span style={{ flex: "1", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.rank}</span>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#A79DC4" }}>{v.unitPrice} / {v.unitWord}</span>
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A79DC4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", transition: "transform .15s", transform: v.rankOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                      {v.rankOpen ? (
                        <>
                          <button type="button" aria-label="Close rank list" tabIndex={-1} onClick={v.closeRank} style={{ position: "fixed", inset: "0", zIndex: "8", border: "none", background: "transparent", transform: "none", cursor: "default" }} />
                          <div role="listbox" aria-labelledby="dl-rank-l" className="dl-scroll" style={{ position: "absolute", top: "calc(100% + 8px)", left: "0", right: "0", zIndex: "9", minWidth: "260px", maxHeight: "340px", overflowY: "auto", padding: "6px", borderRadius: "16px", background: "#170E2C", border: "1px solid rgba(214, 187, 255, .2)", boxShadow: "0 24px 60px rgba(0, 0, 0, .6)", animation: "dlpop .16s ease-out" }}>
                            {v.rankOpts.map((r) => (
                              <button key={r.name} type="button" role="option" aria-selected={r.sel} onClick={r.pick} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", minHeight: "44px", padding: "0 12px", borderRadius: "10px", border: "none", background: r.active ? "rgba(214, 187, 255, .12)" : "transparent", color: r.active ? "#FFFFFF" : "#CFC4EA", fontSize: "14.5px", fontWeight: r.active ? "700" : "500", textAlign: "left", transform: "none" }}>
                                <span style={{ flex: "1", minWidth: "0" }}>{r.name}</span>
                                <span style={{ fontSize: "13px", fontWeight: "600", color: r.active ? "#D6BBFF" : "#8E84AB" }}>{r.price}</span>
                                {r.active ? <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D6BBFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> : <span style={{ width: "14px" }} />}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                    ) : null}
                    <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <span id="dl-qty" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                        {v.qtyLabel}
                      </span>
                      <div role="group" aria-labelledby="dl-qty" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "4px", padding: "4px", borderRadius: "14px", background: "#090414", border: "1px solid rgba(196, 170, 255, .14)" }}>
                        {v.qtys.map((q, $index) => (
                          <React.Fragment key={$index}>
                            <button type="button" onClick={q.pick} aria-pressed={q.pressed} style={css(q.style)}>
                              <span style={{ fontSize: "15px", fontWeight: "700", whiteSpace: "nowrap" }}>
                                {q.n}{q.save.trim() ? <span style={{ fontSize: "12px", fontWeight: "600", opacity: ".75" }}> ({q.save})</span> : null}
                              </span>
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                      How payment works
                    </span>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", padding: "16px", borderRadius: "16px", background: "#090414", border: "1px solid rgba(196, 170, 255, .12)" }}>
                      <span style={{ flex: "0 0 auto", width: "38px", height: "38px", borderRadius: "12px", background: "rgba(214, 187, 255, .1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#D6BBFF" }}>
                        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /><path d="M6 15h4" /></svg>
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: "0" }}>
                        <span style={{ fontWeight: "600", color: "#FFFFFF" }}>
                          Pay once, upfront
                        </span>
                        <span style={{ fontSize: "13px", lineHeight: "1.5", color: "#A79DC4" }}>
                          {v.payNote} Cancel for free until a teammate accepts.
                        </span>
                      </span>
                    </div>
                    {v.hasWallet ? (
                      <button type="button" role="switch" aria-checked={v.walletPressed} onClick={v.toggleWallet} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderRadius: "16px", textAlign: "left", background: v.walletOn ? "#1B1033" : "#090414", border: "1.5px solid " + (v.walletOn ? "#D6BBFF" : "rgba(196, 170, 255, .12)"), color: "#F3EEFF" }}>
                        <span style={{ display: "flex", flexDirection: "column", gap: "2px", flex: "1", minWidth: "0" }}>
                          <span style={{ fontWeight: "600", color: "#FFFFFF" }}>
                            Use my Duoly balance
                          </span>
                          <span style={{ fontSize: "13px", color: "#A79DC4" }}>
                            {v.walletAvail} available from refunds, cashback and gifts
                          </span>
                        </span>
                        <span style={{ position: "relative", flex: "0 0 auto", width: "34px", height: "20px", borderRadius: "999px", transition: "background-color .15s", background: v.walletOn ? "#D6BBFF" : "#2A1F45" }}>
                          <span style={{ position: "absolute", top: "3px", left: v.walletOn ? "17px" : "3px", width: "14px", height: "14px", borderRadius: "50%", transition: "left .15s", background: v.walletOn ? "#17092E" : "#8E84AB" }} />
                        </span>
                      </button>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {v.toggles.map((t, $index) => (
                      <React.Fragment key={$index}>
                        <button type="button" role="switch" aria-checked={t.pressed} onClick={t.pick} style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "44px", padding: "0 14px 0 8px", borderRadius: "12px", background: "transparent", border: "1px solid rgba(196, 170, 255, .12)", color: "#F3EEFF", fontSize: "13.5px", fontWeight: "500" }}>
                          <span style={css(t.track)}>
                            <span style={css(t.knob)} />
                          </span>
                          {t.label}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", paddingTop: "20px", borderTop: "1px solid rgba(196, 170, 255, .08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <img src="/assets/brand/logo-mascots.webp" alt="" width="56" height="35" style={{ width: "56px", height: "35px" }} />
                      <span style={{ fontSize: "14px", color: "#CFC4EA" }}>
                        Duoly PRO members save{" "}
                        <strong style={{ color: "#FFFFFF" }}>
                          {v.proSave}
                        </strong>
                        {" "}on this order
                      </span>
                    </div>
                    <a href="#" style={{ fontSize: "14px", fontWeight: "600", color: "#D6BBFF" }}>
                      Try PRO free for 7 days
                    </a>
                  </div>
                </div>
                <aside aria-label="Order summary" style={{ flex: "1 1 360px", minWidth: "0", padding: "26px", borderRadius: "24px", background: "#170E2C", border: "1px solid rgba(214, 187, 255, .28)", display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <img src={v.game.img} alt={v.game.name} width="52" height="52" style={{ width: "52px", height: "52px", borderRadius: "14px" }} />
                    <div style={{ minWidth: "0" }}>
                      <div style={{ fontWeight: "600", fontSize: "16px", color: "#FFFFFF" }}>
                        {v.sel.title}
                      </div>
                      <div style={{ fontSize: "13px", color: "#D6BBFF" }}>
                        {v.sel.tier}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "16px", borderTop: "1px solid rgba(196, 170, 255, .1)", fontSize: "14px", color: "#A79DC4" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>
                        {v.unitPrice} × {v.qty} {v.qtyUnit}
                      </span>
                      <span>
                        {v.subtotal}
                      </span>
                    </div>
                    {v.hasSave ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#5EEAA8" }}>
                          <span>
                            Bundle discount ({v.savePct})
                          </span>
                          <span>
                            −{v.saveAmt}
                          </span>
                        </div>
                      </>
                    ) : null}
                    {v.usesWallet ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#CFC4EA" }}>
                          <span>
                            Order total
                          </span>
                          <span>
                            {v.total}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#5EEAA8" }}>
                          <span>
                            Duoly balance
                          </span>
                          <span>
                            −{v.walletUse}
                          </span>
                        </div>
                      </>
                    ) : null}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "6px", paddingTop: "12px", borderTop: "1px dashed rgba(196, 170, 255, .14)" }}>
                      <span style={{ display: "flex", flexDirection: "column", lineHeight: "1.3" }}>
                        <span style={{ fontWeight: "600", color: "#FFFFFF" }}>
                          {v.usesWallet ? 'You pay now' : 'Total'}
                        </span>
                        <span style={{ fontSize: "12.5px", color: "#8E84AB" }}>
                          once, for all {v.units}
                        </span>
                      </span>
                      <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "36px", fontWeight: "700", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                        {v.due}
                      </span>
                    </div>
                  </div>
                  {v.allWallet ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "12px", background: "rgba(94, 234, 168, .08)", border: "1px solid rgba(94, 234, 168, .25)", fontSize: "13.5px", color: "#C9F7E2" }}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5EEAA8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><path d="M20 6L9 17l-5-5" /></svg>
                      Your Duoly balance covers the whole order. No card needed.
                    </div>
                  ) : null}
                  {this.props.onCheckout ? <div style={{ fontSize: "13px", lineHeight: "1.5", color: "#A79DC4" }}>Apple Pay, Google Pay, PayPal, cards, Klarna and 20+ local payment methods. You choose on the next step.</div> : null}
                  {v.allWallet || this.props.onCheckout ? null : <div role="radiogroup" aria-label="Payment method" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                    {v.pays.map((p, $index) => (
                      <React.Fragment key={$index}>
                        <button type="button" role="radio" aria-checked={p.pressed} aria-label={p.label} onClick={p.pick} style={css(p.style)}>
                          {p.active ? (
                            <>
                              <span style={{ position: "absolute", top: "-7px", right: "-7px", width: "22px", height: "22px", borderRadius: "50%", background: "#D6BBFF", boxShadow: "0 0 0 3px #170E2C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#17092E" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              </span>
                            </>
                          ) : null}
                          {p.img ? (
                            <>
                              <img src={p.img} alt="" style={css(p.imgStyle)} />
                            </>
                          ) : null}
                          {p.noImg ? (
                            <>
                              <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "600", color: "#F3EEFF" }}>
                                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="2" y="5" width="20" height="14" rx="3" />
                                  <path d="M2 10h20" />
                                  <path d="M6 15h4" />
                                </svg>
                                Card
                              </span>
                            </>
                          ) : null}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>}
                  <button type="button" onClick={v.queue} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", minHeight: "58px", borderRadius: "16px", border: "none", background: "#D6BBFF", color: "#17092E", fontSize: "16px", fontWeight: "700" }}>
                    {v.ctaLabel}
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="M13 6l6 6-6 6" />
                    </svg>
                  </button>
                  <ul style={{ listStyle: "none", margin: "0", padding: "0", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "#A79DC4" }}>
                    <li style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24">
                        <path fill="#D6BBFF" d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" />
                      </svg>
                      Charged once now, nothing after each {v.unitWord}
                    </li>
                    <li style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24">
                        <path fill="#D6BBFF" d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" />
                      </svg>
                      Free cancel until a teammate accepts
                    </li>
                    <li style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24">
                        <path fill="#D6BBFF" d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" />
                      </svg>
                      Not matched in 5 min? The full amount goes back to your Duoly balance
                    </li>
                  </ul>
                </aside>
              </div>
            </section>
            <section aria-labelledby="globe-h" style={{ marginTop: "112px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "40px" }}>
                <div style={{ flex: "1 1 360px", minWidth: "0" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600", color: "#5EEAA8" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#5EEAA8", animation: "dlpulse 1.6s ease-in-out infinite" }} />
                    Live right now
                  </div>
                  <h2 id="globe-h" style={{ margin: "14px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "clamp(34px, 4.2vw, 54px)", fontWeight: "800", letterSpacing: "-.04em", lineHeight: ".98", color: "#FFFFFF" }}>
                    1,284 teammates online, all over the world.
                  </h2>
                  <p style={{ margin: "16px 0 0", maxWidth: "440px", color: "#A79DC4", fontSize: "17px" }}>
                    We match you with someone on your server and in your language, so the ping is low and the comms are easy.
                  </p>
                  <dl style={{ margin: "28px 0 0", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px", maxWidth: "420px" }}>
                    <div style={{ padding: "14px 16px", borderRadius: "16px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .08)" }}>
                      <dt style={{ fontSize: "13px", color: "#8E84AB" }}>
                        Europe
                      </dt>
                      <dd style={{ margin: "2px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "700", color: "#FFFFFF" }}>
                        612
                      </dd>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: "16px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .08)" }}>
                      <dt style={{ fontSize: "13px", color: "#8E84AB" }}>
                        North America
                      </dt>
                      <dd style={{ margin: "2px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "700", color: "#FFFFFF" }}>
                        438
                      </dd>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: "16px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .08)" }}>
                      <dt style={{ fontSize: "13px", color: "#8E84AB" }}>
                        Asia & Oceania
                      </dt>
                      <dd style={{ margin: "2px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "700", color: "#FFFFFF" }}>
                        171
                      </dd>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: "16px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .08)" }}>
                      <dt style={{ fontSize: "13px", color: "#8E84AB" }}>
                        South America
                      </dt>
                      <dd style={{ margin: "2px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "700", color: "#FFFFFF" }}>
                        63
                      </dd>
                    </div>
                  </dl>
                </div>
                <div style={{ flex: "1 1 440px", minWidth: "0", display: "flex", justifyContent: "center" }}>
                  <div style={{ position: "relative", width: "100%", maxWidth: "520px", aspectRatio: "1 / 1" }}>
                    <svg aria-hidden="true" viewBox="0 0 400 400" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" }}>
                      <defs>
                        <radialGradient id="dl-atmo" cx="50%" cy="50%" r="50%">
                          <stop offset="78%" stopColor="#8B5CF6" stopOpacity=".35" />
                          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id="dl-sphere" cx="36%" cy="30%" r="75%">
                          <stop offset="0%" stopColor="#3A2370" />
                          <stop offset="55%" stopColor="#1A0F33" />
                          <stop offset="100%" stopColor="#0B0618" />
                        </radialGradient>
                        <pattern id="dl-dots" width="9" height="9" patternUnits="userSpaceOnUse">
                          <circle cx="4.5" cy="4.5" r="1.1" fill="#D6BBFF" fillOpacity=".22" />
                        </pattern>
                        <clipPath id="dl-clip">
                          <circle cx="200" cy="200" r="186" />
                        </clipPath>
                      </defs>
                      <circle cx="200" cy="200" r="236" fill="url(#dl-atmo)" />
                      <circle cx="200" cy="200" r="186" fill="url(#dl-sphere)" />
                      <g clipPath="url(#dl-clip)">
                        <rect x="0" y="0" width="500" height="400" fill="url(#dl-dots)" style={{ animation: "dldrift 30s linear infinite" }} />
                      </g>
                      <circle cx="200" cy="200" r="186" fill="none" stroke="rgba(214, 187, 255, .45)" strokeWidth="1.2" />
                      <path d="M60 120 A 186 186 0 0 1 200 14" fill="none" stroke="rgba(255, 255, 255, .35)" strokeWidth="2" strokeLinecap="round" />
                      <g fill="none" stroke="rgba(214, 187, 255, .12)" strokeWidth="1">
                        <ellipse cx="200" cy="200" rx="186" ry="30" />
                        <ellipse cx="200" cy="107" rx="161" ry="26" />
                        <ellipse cx="200" cy="293" rx="161" ry="26" />
                        <ellipse cx="200" cy="39" rx="93" ry="14" />
                        <ellipse cx="200" cy="361" rx="93" ry="14" />
                      </g>
                      <g fill="none" stroke="rgba(214, 187, 255, .16)" strokeWidth="1">
                        <ellipse cx="200" cy="200" rx="186" ry="186" style={{ transformOrigin: "200px 200px", animation: "dlmer 18s linear infinite" }} />
                        <ellipse cx="200" cy="200" rx="186" ry="186" style={{ transformOrigin: "200px 200px", animation: "dlmer 18s linear -3s infinite" }} />
                        <ellipse cx="200" cy="200" rx="186" ry="186" style={{ transformOrigin: "200px 200px", animation: "dlmer 18s linear -6s infinite" }} />
                        <ellipse cx="200" cy="200" rx="186" ry="186" style={{ transformOrigin: "200px 200px", animation: "dlmer 18s linear -9s infinite" }} />
                        <ellipse cx="200" cy="200" rx="186" ry="186" style={{ transformOrigin: "200px 200px", animation: "dlmer 18s linear -12s infinite" }} />
                        <ellipse cx="200" cy="200" rx="186" ry="186" style={{ transformOrigin: "200px 200px", animation: "dlmer 18s linear -15s infinite" }} />
                      </g>
                      <g fill="none" stroke="#F0A6FF" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 7" style={{ animation: "dldash 2.4s linear infinite" }}>
                        <path d="M96 120 Q 120 140 176 200" />
                        <path d="M176 200 Q 260 150 320 168" />
                        <path d="M240 64 Q 300 90 320 168" />
                        <path d="M80 264 Q 160 320 248 304" />
                        <path d="M176 200 Q 220 250 248 304" />
                        <path d="M248 304 Q 300 260 328 248" />
                      </g>
                    </svg>
                    {v.pins.map((p, $index) => (
                      <React.Fragment key={$index}>
                        <div style={css(p.wrap)}>
                          <span style={css(p.avatar)}>
                            <img src={p.av} alt="" width="50" height="50" style={{ width: "50px", height: "50px", borderRadius: "50%", display: "block" }} />
                            <img src={p.flag} alt={p.cc} width="18" height="18" style={{ position: "absolute", right: "-3px", bottom: "-3px", width: "18px", height: "18px", borderRadius: "50%" }} />
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px 4px 4px", borderRadius: "10px", background: "rgba(23, 14, 44, .9)", backdropFilter: "blur(8px)", lineHeight: "1.2", whiteSpace: "nowrap" }}>
                            <img src={p.img} alt="" width="20" height="20" style={{ width: "20px", height: "20px", borderRadius: "6px" }} />
                            <span style={{ fontSize: "12.5px", fontWeight: "600", color: "#FFFFFF" }}>
                              {p.name}
                            </span>
                          </span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
              <div aria-label="Teammates online" style={{ marginTop: "36px", overflow: "hidden" }}>
                <div style={{ display: "flex", gap: "12px", width: "max-content", animation: "dlticker 75s linear infinite" }}>
                  {v.carousel.map((c, $index) => (
                    <React.Fragment key={$index}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "268px", padding: "12px", borderRadius: "18px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .08)" }}>
                        <span style={{ position: "relative", flex: "0 0 auto", width: "46px", height: "46px" }}>
                          <img src={c.av} alt="" width="46" height="46" style={{ width: "46px", height: "46px", borderRadius: "50%", display: "block" }} />
                          <img src={c.flag} alt={c.cc} width="16" height="16" style={{ position: "absolute", right: "-2px", bottom: "-2px", width: "16px", height: "16px", borderRadius: "50%", boxShadow: "0 0 0 2px #120B22" }} />
                        </span>
                        <span style={{ display: "flex", flexDirection: "column", minWidth: "0", lineHeight: "1.35" }}>
                          <span style={{ fontWeight: "600", color: "#FFFFFF" }}>
                            {c.name}
                          </span>
                          <span style={{ fontSize: "12.5px", color: "#A79DC4" }}>
                            {c.rank} · ★ {c.rating}
                          </span>
                        </span>
                        <img src={c.img} alt="" width="30" height="30" style={{ marginLeft: "auto", width: "30px", height: "30px", borderRadius: "9px" }} />
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </section>
            <section id="how" aria-labelledby="how-h" style={{ marginTop: "112px" }}>
              <h2 id="how-h" style={{ margin: "0", maxWidth: "620px", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: "800", letterSpacing: "-.035em", lineHeight: "1", color: "#FFFFFF" }}>
                From “ugh, solo queue” to in-game in three taps.
              </h2>
              <ol style={{ listStyle: "none", margin: "40px 0 0", padding: "0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "28px" }}>
                <li style={{ paddingTop: "20px", borderTop: "2px solid #D6BBFF" }}>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "14px", fontWeight: "700", color: "#D6BBFF" }}>
                    Step 1
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "20px", fontWeight: "600", letterSpacing: "-.01em", color: "#FFFFFF" }}>
                    Pick game and mode
                  </div>
                  <div style={{ marginTop: "6px", color: "#A79DC4", fontSize: "15px" }}>
                    Everything’s on this page. No menus, no catalog.
                  </div>
                </li>
                <li style={{ paddingTop: "20px", borderTop: "2px solid rgba(196, 170, 255, .2)" }}>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "14px", fontWeight: "700", color: "#8E84AB" }}>
                    Step 2
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "20px", fontWeight: "600", letterSpacing: "-.01em", color: "#FFFFFF" }}>
                    Pay in one tap
                  </div>
                  <div style={{ marginTop: "6px", color: "#A79DC4", fontSize: "15px" }}>
                    Apple Pay, Google Pay, PayPal or card. We create your account for you.
                  </div>
                </li>
                <li style={{ paddingTop: "20px", borderTop: "2px solid rgba(196, 170, 255, .2)" }}>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "14px", fontWeight: "700", color: "#8E84AB" }}>
                    Step 3
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "20px", fontWeight: "600", letterSpacing: "-.01em", color: "#FFFFFF" }}>
                    Accept the invite
                  </div>
                  <div style={{ marginTop: "6px", color: "#A79DC4", fontSize: "15px" }}>
                    Your teammate adds you in-game and on Discord. GLHF.
                  </div>
                </li>
              </ol>
            </section>
            <section aria-labelledby="why-h" style={{ marginTop: "96px", padding: "40px", borderRadius: "28px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .08)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "32px" }}>
              <div style={{ flex: "1 1 300px" }}>
                <h2 id="why-h" style={{ margin: "0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "34px", fontWeight: "800", letterSpacing: "-.03em", lineHeight: "1.05", color: "#FFFFFF" }}>
                  Teammates you’d actually queue with again.
                </h2>
                <p style={{ margin: "12px 0 0", color: "#A79DC4" }}>
                  Every player is rank-verified and reviewed after every session. The bottom-rated get removed.
                </p>
              </div>
              <dl style={{ flex: "2 1 520px", margin: "0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "24px" }}>
                <div>
                  <dt style={{ fontSize: "13px", color: "#8E84AB" }}>
                    Teammates
                  </dt>
                  <dd style={{ margin: "4px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "40px", fontWeight: "700", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                    Top 0.5%
                  </dd>
                </div>
                <div>
                  <dt style={{ fontSize: "13px", color: "#8E84AB" }}>
                    Avg. rating
                  </dt>
                  <dd style={{ margin: "4px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "40px", fontWeight: "700", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                    4.9★
                  </dd>
                </div>
                <div>
                  <dt style={{ fontSize: "13px", color: "#8E84AB" }}>
                    Sessions played
                  </dt>
                  <dd style={{ margin: "4px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "40px", fontWeight: "700", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                    212k
                  </dd>
                </div>
                <div>
                  <dt style={{ fontSize: "13px", color: "#8E84AB" }}>
                    Support
                  </dt>
                  <dd style={{ margin: "4px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "40px", fontWeight: "700", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                    24/7
                  </dd>
                </div>
              </dl>
            </section>
            <section id="faq" aria-labelledby="faq-h" style={{ marginTop: "96px", paddingBottom: "96px", display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "32px 56px" }}>
              <div style={{ flex: "1 1 300px", minWidth: "0", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#D6BBFF" }}>
                    FAQ
                  </div>
                  <h2 id="faq-h" style={{ margin: "8px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "clamp(34px, 4vw, 48px)", fontWeight: "800", letterSpacing: "-.035em", lineHeight: "1", color: "#FFFFFF" }}>
                    Got questions?
                    <br />
                    We’ve got answers.
                  </h2>
                </div>
                <div role="tablist" aria-label="FAQ topics" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {v.faqTabs.map((t, $index) => (
                    <React.Fragment key={$index}>
                      <button type="button" role="tab" aria-selected={t.pressed} onClick={t.pick} style={css(t.style)}>
                        {t.label}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ marginTop: "8px", padding: "22px", borderRadius: "22px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .1)", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <img src="/assets/brand/logo-mascots.webp" alt="" width="72" height="45" style={{ width: "72px", height: "45px" }} />
                    <div style={{ lineHeight: "1.35" }}>
                      <div style={{ fontWeight: "600", color: "#FFFFFF" }}>
                        Still stuck?
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#A79DC4" }}>
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#5EEAA8" }} />
                        Avg. reply in under 3 min
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                    <a href="#" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "46px", borderRadius: "12px", background: "#5865F2", color: "#FFFFFF", textDecoration: "none", fontSize: "14px", fontWeight: "600" }}>
                      <img src="/assets/social/discord-white.png" alt="" width="20" height="15" style={{ width: "20px", height: "15px" }} />
                      Discord
                    </a>
                    <a href="#" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "46px", borderRadius: "12px", border: "1px solid rgba(196, 170, 255, .2)", color: "#F3EEFF", textDecoration: "none", fontSize: "14px", fontWeight: "600" }}>
                      Live chat
                    </a>
                  </div>
                </div>
              </div>
              <div style={{ flex: "2 1 560px", minWidth: "0", display: "flex", flexDirection: "column", gap: "10px" }}>
                {v.faqs.map((f, $index) => (
                  <React.Fragment key={$index}>
                    <div style={css(f.wrap)}>
                      {/* question as a heading; every answer is in the page (closed ones hidden) so search engines can read them all */}
                      <h3 style={{ margin: "0", font: "inherit" }}>
                        <button type="button" id={f.id + '-q'} aria-expanded={f.expanded} aria-controls={f.id} onClick={f.toggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: "16px", padding: "20px 22px", border: "none", background: "transparent", color: "#FFFFFF", textAlign: "left", transform: "none" }}>
                          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "14px", fontWeight: "700", color: "#6A6086", minWidth: "22px" }}>
                            {f.num}
                          </span>
                          <span style={{ flex: "1", fontSize: "17px", fontWeight: "600", letterSpacing: "-.01em" }}>
                            {f.q}
                          </span>
                          <span style={css(f.iconWrap)}>
                            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </span>
                        </button>
                      </h3>
                      <div id={f.id} role="region" aria-labelledby={f.id + '-q'} hidden={!f.open}>
                        <p style={{ margin: "0", padding: "0 22px 22px 60px", color: "#A79DC4", fontSize: "15px", lineHeight: "1.6", animation: "dlfade .2s ease-out" }}>
                          {f.a}
                        </p>
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </section>
          </div>
        </main>
        <footer style={{ borderTop: "1px solid rgba(196, 170, 255, .08)" }}>
          <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "40px 24px 0" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "28px 40px", padding: "28px 32px", borderRadius: "26px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .1)" }}>
              <div style={{ flex: "1 1 420px", minWidth: "0", display: "flex", alignItems: "center", gap: "20px" }}>
                <img src="/assets/flags/at.png" alt="Austrian flag" width="64" height="64" style={{ flex: "0 0 auto", width: "64px", height: "64px", borderRadius: "50%", display: "block", boxShadow: "0 10px 30px rgba(200, 16, 46, .35)" }} />
                <div style={{ minWidth: "0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600", color: "#F0A6FF", letterSpacing: ".02em" }}>
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                      <path fill="#F0A6FF" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.1 1.7-1.9 3.1-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
                    </svg>
                    Made in Vienna, Austria
                  </div>
                  <p style={{ margin: "6px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "22px", fontWeight: "700", letterSpacing: "-.02em", lineHeight: "1.25", color: "#FFFFFF" }}>
                    “Mozart took years to finish a symphony. You’ll be in a match in 2 minutes.”
                  </p>
                </div>
              </div>
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "28px", borderLeft: "1px solid rgba(196, 170, 255, .12)" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", letterSpacing: ".1em", textTransform: "uppercase", color: "#8E84AB" }}>
                  Local time · Vienna
                </span>
                <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "44px", fontWeight: "700", letterSpacing: "-.03em", lineHeight: "1", color: "#FFFFFF" }}>
                  {v.vHM}:{v.vS}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#A79DC4" }}>
                  <span style={css(v.vDot)} />
                  {v.vStatus}
                </span>
              </div>
            </div>
          </div>
          <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "40px 24px 120px", display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "28px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <img src="/assets/brand/logo-wordmark.webp" alt="Duoly" width="144" height="54" style={{ width: "144px", height: "54px" }} />
              <span style={{ fontSize: "13px", color: "#6A6086", maxWidth: "360px" }}>
                © 2026 Duoly. Not affiliated with Riot Games, Valve, Epic Games, Activision Blizzard, EA, Ubisoft, NetEase, Mojang or The Pokémon Company.
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "40px", fontSize: "14px" }}>
              {FOOTER_COLUMNS.map((col) => (
                <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontWeight: "600", color: "#FFFFFF" }}>
                    {col.title}
                  </span>
                  {col.links.map((l) => (
                    <a key={l.href} href={l.href} rel={l.href.startsWith('http') ? 'noopener' : undefined} style={{ textDecoration: "none" }}>
                      {l.label}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </footer>
        {/* support chat: Sparky + the real admins (components/SupportChat.jsx) */}
        <SupportChat teaser />
        {v.showAuth ? (
          <>
            <div role="dialog" aria-modal="true" aria-labelledby="auth-h" style={{ position: "fixed", inset: "0", zIndex: "50", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", overflowY: "auto" }}>
              <button type="button" aria-label="Close sign-in" onClick={v.closeAuth} style={{ position: "absolute", inset: "0", border: "none", background: "rgba(5, 2, 12, .78)", backdropFilter: "blur(12px)", transform: "none", cursor: "default", animation: "dlfade .2s ease-out" }} />
              <div className="dl-auth" style={{ position: "relative", width: "100%", maxWidth: "880px", margin: "auto", borderRadius: "30px", overflow: "hidden", background: "#120B22", border: "1px solid rgba(214, 187, 255, .16)", boxShadow: "0 40px 120px rgba(0, 0, 0, .7)", animation: "dlpop .24s ease-out" }}>
                <div className="dl-auth-side" style={{ position: "relative", display: "flex", flexDirection: "column", padding: "32px", background: "radial-gradient(120% 80% at 20% 0%, rgba(240, 166, 255, .16), transparent 60%), radial-gradient(90% 70% at 100% 100%, rgba(214, 187, 255, .14), transparent 60%), #1B1033", borderRight: "1px solid rgba(214, 187, 255, .12)" }}>
                  <img src="/assets/brand/logo-wordmark.webp" alt="Duoly" width="96" height="36" style={{ width: "96px", height: "36px", display: "block" }} />
                  <div style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", padding: "18px 0" }}>
                    <img src="/assets/brand/logo-mascots.webp" alt="Duoly mascots" width="250" height="158" style={{ width: "100%", maxWidth: "250px", height: "auto", display: "block", animation: "dlfloat 6s ease-in-out infinite" }} />
                  </div>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "28px", fontWeight: "800", lineHeight: "1.05", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                    Never solo
                    <br />
                    <span style={{ color: "#D6BBFF" }}>
                      queue again.
                    </span>
                  </div>
                  <ul style={{ margin: "16px 0 0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "9px", fontSize: "14px", color: "#CFC4EA" }}>
                    <li style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "50%", background: "rgba(94, 234, 168, .14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5EEAA8" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                      Matched in under 2 minutes
                    </li>
                    <li style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "50%", background: "rgba(94, 234, 168, .14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5EEAA8" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                      Balance and favourite teammates saved
                    </li>
                    <li style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ flex: "0 0 auto", width: "22px", height: "22px", borderRadius: "50%", background: "rgba(94, 234, 168, .14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5EEAA8" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                      Your own dashboard to track the climb
                    </li>
                  </ul>
                  <div style={{ marginTop: "22px", display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "16px", background: "rgba(9, 4, 20, .5)", border: "1px solid rgba(196, 170, 255, .12)" }}>
                    <span style={{ display: "flex" }}>
                      <img src="/assets/avatars/avatar-1.png" alt="" width="30" height="30" style={{ width: "30px", height: "30px", borderRadius: "50%", boxShadow: "0 0 0 2px #1B1033" }} />
                      <img src="/assets/avatars/avatar-2.png" alt="" width="30" height="30" style={{ width: "30px", height: "30px", borderRadius: "50%", marginLeft: "-8px", boxShadow: "0 0 0 2px #1B1033" }} />
                      <img src="/assets/avatars/avatar-3.png" alt="" width="30" height="30" style={{ width: "30px", height: "30px", borderRadius: "50%", marginLeft: "-8px", boxShadow: "0 0 0 2px #1B1033" }} />
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: "1.3" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: "600", color: "#FFFFFF" }}>
                        ★ 4.9 / 5
                      </span>
                      <span style={{ fontSize: "12px", color: "#A79DC4" }}>
                        from 38k reviews
                      </span>
                    </span>
                  </div>
                </div>
                <div style={{ position: "relative", padding: "32px 32px 26px", minWidth: "0" }}>
                  <button type="button" aria-label="Close" onClick={v.closeAuth} style={{ position: "absolute", top: "16px", right: "16px", width: "40px", height: "40px", borderRadius: "12px", border: "none", background: "rgba(196, 170, 255, .08)", color: "#CFC4EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                  <div role="group" aria-label="Account" style={{ display: "inline-flex", gap: "2px", padding: "4px", borderRadius: "14px", background: "#090414", border: "1px solid rgba(196, 170, 255, .1)" }}>
                    <button type="button" aria-pressed={v.emailLoginPressed} onClick={v.showLogin} style={css(v.emailLoginTab + ' flex: 0 0 auto; padding: 0 16px;')}>
                      Log in
                    </button>
                    <button type="button" aria-pressed={v.emailRegisterPressed} onClick={v.showRegister} style={css(v.emailRegisterTab + ' flex: 0 0 auto; padding: 0 16px;')}>
                      Create account
                    </button>
                  </div>
                  <h2 id="auth-h" style={{ margin: "22px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "32px", fontWeight: "800", lineHeight: "1.05", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                    {v.authTitle}
                  </h2>
                  <p style={{ margin: "8px 0 0", fontSize: "14.5px", color: "#A79DC4" }}>
                    {v.authSub}
                  </p>
                  <div style={{ marginTop: "22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button type="button" onClick={v.loginDiscord} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", minHeight: "50px", borderRadius: "14px", border: "none", background: "#5865F2", color: "#FFFFFF", fontSize: "15px", fontWeight: "600" }}>
                      <img src="/assets/social/discord-white.png" alt="" width="22" height="17" style={{ width: "22px", height: "17px" }} />
                      {v.discordLabel}
                    </button>
                    <button type="button" onClick={v.loginGoogle} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", minHeight: "50px", borderRadius: "14px", border: "none", background: "#FFFFFF", color: "#1F1F1F", fontSize: "15px", fontWeight: "600" }}>
                      <img src="/assets/social/google-g.png" alt="" width="18" height="19" style={{ width: "18px", height: "19px" }} />
                      {v.googleLabel}
                    </button>
                  </div>
                  <div style={{ margin: "20px 0 16px", display: "flex", alignItems: "center", gap: "12px", fontSize: "12.5px", color: "#6A6086" }}>
                    <span style={{ flex: "1", height: "1px", background: "rgba(196, 170, 255, .12)" }} />
                    or with email
                    <span style={{ flex: "1", height: "1px", background: "rgba(196, 170, 255, .12)" }} />
                  </div>
                  <form onSubmit={v.submitEmail} noValidate style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {v.emailRegister ? (
                      <>
                        <label className="dl-field" htmlFor="dl-name">
                          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 21a8 8 0 0 1 16 0" />
                          </svg>
                          <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                            Name
                          </span>
                          <input id="dl-name" type="text" placeholder="Your name" autoComplete="nickname" value={v.emailName} onChange={v.setEmailName} />
                        </label>
                      </>
                    ) : null}
                    <label className="dl-field" htmlFor="dl-email">
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="3" />
                        <path d="M3 7l9 6 9-6" />
                      </svg>
                      <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                        Email
                      </span>
                      <input id="dl-email" type="email" placeholder="you@email.com" autoComplete="email" value={v.emailAddr} onChange={v.setEmailAddr} />
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <label className="dl-field" htmlFor="dl-pass">
                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="10" width="16" height="11" rx="3" />
                          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                        </svg>
                        <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                          Password
                        </span>
                        <input disabled title="Unavailable in the design preview. Do not enter real credentials or upload files." id="dl-pass" type={v.passType} placeholder="Password (8+ characters)" autoComplete={v.passAutocomplete} value={v.emailPass} onChange={v.setEmailPass} />
                        <button type="button" onClick={v.togglePass} aria-label={v.passToggleLabel} aria-pressed={v.passShown ? 'true' : 'false'} style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "10px", border: "none", background: "transparent", color: "#8E84AB", display: "flex", alignItems: "center", justifyContent: "center", transform: "none" }}>
                          {v.passShown ? (
                            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 3l18 18" />
                              <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
                              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                            </svg>
                          ) : (
                            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </label>
                      {v.showStrength ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div aria-hidden="true" style={{ flex: "1", display: "flex", gap: "4px" }}>
                            {v.strengthBars.map((b, i) => (
                              <span key={i} style={css(b)} />
                            ))}
                          </div>
                          <span style={{ minWidth: "48px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: v.strengthColor }}>
                            {v.strengthLabel}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {v.authNote ? (
                      <div role="status" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "12px", background: "rgba(240, 166, 255, .1)", border: "1px solid rgba(240, 166, 255, .28)", fontSize: "13.5px", color: "#F7D6FF" }}>
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F0A6FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 8v5M12 16.5v.5" />
                        </svg>
                        {v.authNote}
                      </div>
                    ) : null}
                    <button type="submit" disabled={v.emailBusy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", minHeight: "54px", marginTop: "2px", borderRadius: "14px", border: "none", background: "#D6BBFF", color: "#17092E", fontSize: "15.5px", fontWeight: "700", opacity: v.emailBusy ? ".7" : "1" }}>
                      {v.emailSubmitLabel}
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </form>
                  <p style={{ margin: "16px 0 0", textAlign: "center", fontSize: "14px", color: "#A79DC4" }}>
                    {v.switchText}{" "}
                    <button type="button" onClick={v.switchMode} style={{ padding: "0", border: "none", background: "transparent", color: "#D6BBFF", fontSize: "14px", fontWeight: "600", textDecoration: "underline", textUnderlineOffset: "3px", transform: "none" }}>
                      {v.switchLabel}
                    </button>
                  </p>
                  <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: "12px", lineHeight: "1.5", color: "#6A6086" }}>
                    By continuing you agree to our{" "}
                    <a href="/terms" target="_blank" rel="noopener">
                      Terms
                    </a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" rel="noopener">
                      Privacy Policy
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {this.state.roleNote ? (
          <div role="dialog" aria-modal="true" aria-labelledby="rn-h" style={{ position: "fixed", inset: "0", zIndex: "50", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <button type="button" aria-label="Close" onClick={() => this.setState({ roleNote: null })} style={{ position: "absolute", inset: "0", border: "none", background: "rgba(5, 2, 12, .78)", backdropFilter: "blur(12px)", transform: "none", cursor: "default", animation: "dlfade .2s ease-out" }} />
            <div style={{ position: "relative", width: "100%", maxWidth: "420px", padding: "26px", borderRadius: "24px", background: "#120B22", border: "1px solid rgba(214, 187, 255, .16)", boxShadow: "0 40px 120px rgba(0, 0, 0, .7)", animation: "dlpop .24s ease-out" }}>
              <h2 id="rn-h" style={{ margin: "0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "800", letterSpacing: "-.02em", color: "#FFFFFF" }}>
                {this.state.roleNote === 'admin' ? 'Admins don’t book orders' : 'Teammate accounts can’t book'}
              </h2>
              <p style={{ margin: "8px 0 0", fontSize: "14.5px", lineHeight: "1.55", color: "#A79DC4" }}>
                You’re signed in as {this.state.roleNote === 'admin' ? 'an admin' : 'a teammate'}. To test booking, use a separate customer account.
              </p>
              <div style={{ marginTop: "20px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <a href={this.state.roleNote === 'admin' ? '/admin' : '/teammate'} style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50px", borderRadius: "14px", background: "#D6BBFF", color: "#17092E", fontSize: "15px", fontWeight: "700", textDecoration: "none" }}>
                  {this.state.roleNote === 'admin' ? 'Open admin dashboard' : 'Open teammate dashboard'}
                </a>
                <button type="button" onClick={() => this.setState({ roleNote: null })} style={{ minHeight: "50px", padding: "0 18px", borderRadius: "14px", background: "transparent", border: "1px solid rgba(196, 170, 255, .2)", color: "#FFFFFF", fontSize: "15px", fontWeight: "600" }}>Close</button>
              </div>
            </div>
          </div>
        ) : null}
        {v.confirmOpen ? (
          <div role="dialog" aria-modal="true" aria-labelledby="qc-h" style={{ position: "fixed", inset: "0", zIndex: "50", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", overflowY: "auto" }}>
            <button type="button" aria-label="Close" onClick={v.closeConfirm} style={{ position: "absolute", inset: "0", border: "none", background: "rgba(5, 2, 12, .78)", backdropFilter: "blur(12px)", transform: "none", cursor: "default", animation: "dlfade .2s ease-out" }} />
            <form onSubmit={v.placeOrder} noValidate style={{ position: "relative", width: "100%", maxWidth: "560px", margin: "auto", borderRadius: "28px", overflow: "hidden", background: "#120B22", border: "1px solid rgba(214, 187, 255, .16)", boxShadow: "0 40px 120px rgba(0, 0, 0, .7)", animation: "dlpop .24s ease-out" }}>
              <div style={{ position: "relative", padding: "26px 26px 22px", background: "radial-gradient(90% 120% at 0% 0%, rgba(240, 166, 255, .16), transparent 60%), radial-gradient(80% 120% at 100% 0%, rgba(214, 187, 255, .14), transparent 60%), #1B1033", borderBottom: "1px solid rgba(214, 187, 255, .12)" }}>
                <button type="button" aria-label="Close" onClick={v.closeConfirm} disabled={v.placing} style={{ position: "absolute", top: "16px", right: "16px", width: "40px", height: "40px", borderRadius: "12px", border: "none", background: "rgba(196, 170, 255, .08)", color: "#CFC4EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#D6BBFF" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#5EEAA8", boxShadow: "0 0 10px #5EEAA8" }} />
                  Last step
                </span>
                <h2 id="qc-h" style={{ margin: "8px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "30px", fontWeight: "800", lineHeight: "1.05", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                  Ready to queue?
                </h2>
                <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "14px", padding: "12px", borderRadius: "18px", background: "rgba(9, 4, 20, .55)", border: "1px solid rgba(214, 187, 255, .14)" }}>
                  <img src={v.game.img} alt="" width="48" height="48" style={{ width: "48px", height: "48px", borderRadius: "13px", flex: "0 0 auto" }} />
                  <div style={{ flex: "1", minWidth: "0", lineHeight: "1.35" }}>
                    <div style={{ fontWeight: "700", color: "#FFFFFF" }}>{v.sel.title} <span style={{ color: "#A79DC4", fontWeight: "500" }}>· {v.game.name}</span></div>
                    <div style={{ fontSize: "13px", lineHeight: "1.45", color: "#A79DC4" }}>{v.sel.tier} · {v.confirmLine}</div>
                  </div>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "800", letterSpacing: "-.02em", color: "#FFFFFF" }}>{v.confirmTotal}</div>
                </div>
              </div>

              <div style={{ padding: "22px 26px 26px", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div className="qc-fields" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "10px" }}>
                  {v.byName ? (
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                      Server or world
                      <input type="text" value={v.mcServer} onChange={v.setMcServer} placeholder="Hypixel, an IP or “my world”" autoComplete="off" spellCheck="false" maxLength={60} style={{ minHeight: "48px", padding: "0 14px", borderRadius: "14px", background: "#090414", border: "1px solid rgba(196, 170, 255, .18)", color: "#FFFFFF", fontSize: "15px", fontFamily: "inherit" }} />
                    </label>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                      <span id="qc-server-l">Server</span>
                      <button type="button" onClick={v.toggleServer} aria-expanded={v.serverOpenStr} aria-controls="qc-servers" aria-labelledby="qc-server-l" style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "48px", padding: "0 12px 0 14px", borderRadius: "14px", background: v.serverOpen ? "#1B1033" : "#090414", border: "1px solid " + (v.serverOpen ? "#D6BBFF" : "rgba(196, 170, 255, .18)"), color: "#FFFFFF", fontSize: "15px", fontWeight: "700", textAlign: "left", transform: "none" }}>
                        <img src={v.serverFlag} alt="" width="20" height="20" style={{ flex: "0 0 auto", width: "20px", height: "20px", borderRadius: "50%", objectFit: "cover" }} />
                        <span style={{ flex: "1", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.serverValue}{v.serverLabel ? <span style={{ fontWeight: "500", color: "#8E84AB" }}> · {v.serverLabel}</span> : null}</span>
                        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A79DC4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", transition: "transform .15s", transform: v.serverOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                    </div>
                  )}
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                    Your {v.ignLabel}
                    <input type="text" value={v.ign} onChange={v.setIgn} placeholder={v.ignPlaceholder} autoComplete="off" spellCheck="false" maxLength={40} autoFocus aria-invalid={v.placeErr && !v.ign ? 'true' : 'false'} style={{ minHeight: "48px", padding: "0 14px", borderRadius: "14px", background: "#090414", border: "1px solid " + (v.placeErr && v.ign.trim().length < 2 ? "rgba(240, 166, 255, .6)" : "rgba(196, 170, 255, .18)"), color: "#FFFFFF", fontSize: "15px", fontFamily: "inherit" }} />
                  </label>
                  {!v.byName && v.serverOpen ? (
                    // the game's servers, grouped by continent (lib/servers.js); opens inside the dialog so nothing gets cut off
                    <div id="qc-servers" className="qc-srv">
                      {v.serverTabs.length ? (
                        <div className="qc-srv-tabs" role="tablist" aria-label="Region">
                          {v.serverTabs.map((t) => (
                            <button key={t.name} type="button" role="tab" aria-selected={t.on ? 'true' : 'false'} onClick={t.pick} className={'qc-srv-tab' + (t.on ? ' on' : '')}>
                              {t.name}
                              {t.hasPick && !t.on ? <span className="qc-srv-dot" aria-hidden="true" /> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="qc-srv-grid" role="radiogroup" aria-labelledby="qc-server-l">
                        {v.serverTiles.map((it) => (
                          <button key={it.value} type="button" role="radio" aria-checked={it.on ? 'true' : 'false'} onClick={it.pick} className={'qc-srv-tile' + (it.on ? ' on' : '')}>
                            <img src={it.flag} alt="" width="30" height="30" className="qc-srv-flag" />
                            <span className="qc-srv-text">
                              <strong>{it.value}</strong>
                              {it.label ? <span>{it.label}</span> : null}
                            </span>
                            {it.on ? <span className="qc-srv-check" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></span> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {v.byName ? (
                    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                      Edition
                      {v.mcEditions.map((m) => (
                        <button key={m.ed} type="button" aria-pressed={m.on ? 'true' : 'false'} onClick={m.pick} style={{ minHeight: "36px", padding: "0 14px", borderRadius: "10px", border: "1px solid " + (m.on ? "#F3EEFF" : "rgba(196, 170, 255, .16)"), background: m.on ? "#F3EEFF" : "transparent", color: m.on ? "#17092E" : "#F3EEFF", fontSize: "13.5px", fontWeight: "700", transform: "none" }}>{m.ed}</button>
                      ))}
                    </div>
                  ) : null}
                  <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                    <span>Note for your teammate <span style={{ fontWeight: "500", color: "#6A6086" }}>· optional</span></span>
                    <input type="text" value={v.orderNote} onChange={v.setOrderNote} placeholder={v.notePlaceholder} maxLength={200} style={{ minHeight: "48px", padding: "0 14px", borderRadius: "14px", background: "#090414", border: "1px solid rgba(196, 170, 255, .18)", color: "#FFFFFF", fontSize: "15px", fontFamily: "inherit" }} />
                  </label>
                </div>

                <div>
                  <div style={{ fontSize: "12px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", color: "#8E84AB" }}>What happens next</div>
                  <ol style={{ listStyle: "none", margin: "12px 0 0", padding: "0", display: "flex", flexDirection: "column" }}>
                    {[
                      [v.chargeTitle, v.chargeText],
                      ['Your order goes live on ' + v.region, 'Rank-verified teammates for ' + v.game.name + ' see it right away. Most orders are taken in under 2 minutes.'],
                      ['You get matched and play', (this.props.onCheckout ? 'You’ll see who took it on the next page. Nobody free within 5 minutes? You pay nothing: the hold on your card or wallet is released automatically.' : 'You’ll see who took it on the next page. Nobody free within 5 minutes? The full ' + v.confirmTotal + ' goes back to your Duoly balance, automatically.')]
                    ].map(([t, d], i) => (
                      <li key={i} style={{ position: "relative", display: "flex", gap: "14px", paddingBottom: i < 2 ? "16px" : "0" }}>
                        {i < 2 ? <span aria-hidden="true" style={{ position: "absolute", left: "13px", top: "30px", bottom: "2px", width: "2px", borderRadius: "2px", background: "linear-gradient(#D6BBFF55, rgba(214, 187, 255, .08))" }} /> : null}
                        <span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800", background: i === 0 ? "#D6BBFF" : "rgba(214, 187, 255, .12)", color: i === 0 ? "#17092E" : "#D6BBFF" }}>{i + 1}</span>
                        <span style={{ minWidth: "0", lineHeight: "1.45" }}>
                          <span style={{ display: "block", fontWeight: "600", color: "#FFFFFF" }}>{t}</span>
                          <span style={{ display: "block", fontSize: "13.5px", color: "#A79DC4" }}>{d}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                {v.placeErr ? (
                  <div role="alert" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "12px", background: "rgba(240, 166, 255, .1)", border: "1px solid rgba(240, 166, 255, .28)", fontSize: "13.5px", color: "#F7D6FF" }}>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F0A6FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></svg>
                    {v.placeErr}
                  </div>
                ) : null}

                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  <button type="button" onClick={v.closeConfirm} disabled={v.placing} style={{ flex: "0 0 auto", minHeight: "56px", padding: "0 20px", borderRadius: "16px", background: "transparent", border: "1px solid rgba(196, 170, 255, .2)", color: "#FFFFFF", fontSize: "15px", fontWeight: "600" }}>
                    Back
                  </button>
                  <button type="submit" disabled={v.placing} style={{ flex: "1 1 220px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", minHeight: "56px", borderRadius: "16px", border: "none", background: "#D6BBFF", color: "#17092E", fontSize: "16px", fontWeight: "700", opacity: v.placing ? ".75" : "1" }}>
                    {v.placing ? <span aria-hidden="true" style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2.5px solid rgba(23, 9, 46, .25)", borderTopColor: "#17092E", animation: "dlspin .8s linear infinite" }} /> : null}
                    {v.placeLabel}
                  </button>
                </div>
                <p style={{ margin: "-6px 0 0", textAlign: "center", fontSize: "12px", lineHeight: "1.5", color: "#6A6086" }}>
                  By queueing you agree to our <a href="/terms" target="_blank" rel="noopener">Terms</a>. Payments are processed securely; we never see your card details.
                </p>
              </div>
            </form>
          </div>
        ) : null}
        <div style={{ position: "sticky", bottom: "0", zIndex: "5", padding: "12px 16px 16px" }}>
          <div style={{ maxWidth: "920px", margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 20px", padding: "10px 10px 10px 12px", borderRadius: "20px", background: "rgba(23, 14, 44, .9)", backdropFilter: "blur(16px)", border: "1px solid rgba(214, 187, 255, .22)", boxShadow: "0 18px 50px rgba(0, 0, 0, .6)" }}>
            <>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 280px", minWidth: "0" }}>
                  <img src={v.game.img} alt="" width="42" height="42" style={{ width: "42px", height: "42px", borderRadius: "12px" }} />
                  <div style={{ minWidth: "0", lineHeight: "1.35" }}>
                    <div style={{ fontWeight: "600", color: "#FFFFFF" }}>
                      {v.sel.title} · {v.qty} {v.qtyUnit}
                    </div>
                    <div style={{ fontSize: "13px", color: "#A79DC4" }}>
                      {v.rankLine}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "26px", fontWeight: "700", letterSpacing: "-.02em", color: "#FFFFFF" }}>
                  {v.total}
                </div>
                <button type="button" onClick={v.queue} style={{ minHeight: "52px", padding: "0 28px", borderRadius: "14px", border: "none", background: "#D6BBFF", color: "#17092E", fontSize: "16px", fontWeight: "700" }}>
                  Queue now
                </button>
            </>
          </div>
        </div>
      </div>
    );
  }
}
