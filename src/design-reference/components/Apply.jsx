'use client';

import { previewFetch as fetch } from '../../design-preview/preview-transport';


import React from 'react';
import ClosedNotice from './ClosedNotice.jsx';
import Pick from './Pick.jsx';
import { GAMES as GAME_LIST } from '../lib/games';
import { servicesFor } from '../lib/catalog';
import { COUNTRIES, flagSrc } from '../lib/countries';
import { youtubeVideoId } from '../lib/youtube';

// Teammates keep 60% of what the customer pays (server/pricing calculateQuote). Tips are 100% theirs.
const SHARE = 0.6;
const eur = (n) => '€' + n.toFixed(2);

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

export default class Apply extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      step: 1, done: false,
      f: { name: '', email: '', discord: '', country: '', adult: false, game: 'lol', rank: '', region: '', role: '', link: '', video: '', hours: '10–20', why: '', svc: { duo: true, coach: false, social: false, gg: false } }
    };
  }
  // The application goes to the admins (Teammates → Applications).
  async send() {
    this.setState({ sending: true, sendError: '' });
    try {
      // Live site: the page passes onSend (real API with CSRF). Design preview: sample transport.
      const res = this.props.onSend ? await this.props.onSend(this.state.f) : await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.state.f) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return this.setState({ sending: false, sendError: d.error || 'Couldn’t send your application. Please try again.' });
      this.setState({ sending: false, done: true });
    } catch (e) {
      this.setState({ sending: false, sendError: 'You seem to be offline. Please try again.' });
    }
  }
  renderVals() {
    const s = this.state;
    const f = s.f;
    const set = (k) => (e) => this.setState({ f: { ...this.state.f, [k]: e.target.value } });
    const put = (k) => (value) => this.setState({ f: { ...this.state.f, [k]: value } });
    // Shared game list (lib/games.js, in demand order) plus what it takes to apply for each game. The
    // minimum is the lowest teammate tier the game's duo and team services ask for (lib/catalog.js;
    // coaching has its own bar below), down to the exact division, written the way each game writes it.
    // `ranks` is what the rank picker offers: the minimum and everything above it.
    const div = (tier, steps) => steps.map((d) => tier + ' ' + d);
    const NEEDS = {
      lol: { ranks: [...div('Diamond', [4, 3, 2, 1]), 'Master', 'Grandmaster', 'Challenger'] },
      val: { ranks: [...div('Ascendant', [1, 2, 3]), ...div('Immortal', [1, 2, 3]), 'Radiant'] },
      cs2: { min: 'Premier 15,000+ or FACEIT Level 8+', ranks: ['Premier 15,000–19,999', 'Premier 20,000–24,999', 'Premier 25,000–29,999', 'Premier 30,000+', ...div('FACEIT Level', [8, 9, 10])] },
      fn: { ranks: ['Champion', 'Unreal'] },
      cod: { ranks: [...div('Crimson', ['I', 'II', 'III']), 'Iridescent', 'Top 250'] },
      apex: { ranks: [...div('Diamond', ['IV', 'III', 'II', 'I']), 'Master', 'Apex Predator'] },
      r6: { ranks: [...div('Emerald', ['V', 'IV', 'III', 'II', 'I']), ...div('Diamond', ['V', 'IV', 'III', 'II', 'I']), 'Champion'] },
      mr: { ranks: [...div('Diamond', ['III', 'II', 'I']), ...div('Grandmaster', ['III', 'II', 'I']), ...div('Celestial', ['III', 'II', 'I']), 'Eternity', 'One Above All'] },
      ow: { ranks: [...div('Diamond', [5, 4, 3, 2, 1]), ...div('Master', [5, 4, 3, 2, 1]), ...div('Grandmaster', [5, 4, 3, 2, 1]), ...div('Champion', [5, 4, 3, 2, 1]), 'Top 500'] },
      rl: { ranks: [...div('Champion', ['I', 'II', 'III']), ...div('Grand Champion', ['I', 'II', 'III']), 'Supersonic Legend'] },
      tft: { ranks: ['Master', 'Grandmaster', 'Challenger'] },
      fc: { min: 'Division 1 in Rivals', ranks: ['Division 1', 'Elite Division'] },
      arc: { min: 'Experienced raider', ranks: ['Experienced raider', 'Veteran raider', 'Elite raider'] },
      mc: { min: 'Skilled PvPer or survival / SMP expert', ranks: ['Skilled PvPer', 'Top PvPer', 'Survival & SMP expert'] },
      pu: { ranks: ['Ultra', 'Master', 'Legend'] },
      dota: { ranks: ['Ancient', 'Divine', 'Immortal'] },
      wow: { min: 'Mythic+ 2,500+ or Duelist in arena', ranks: ['Mythic+ 2,500–2,999', 'Mythic+ 3,000–3,499', 'Mythic+ 3,500+', 'Duelist 2,100+', 'Elite 2,400+', 'Gladiator'] },
      pubg: { ranks: ['Diamond', 'Master', 'Survivor'] },
      wr: { ranks: ['Diamond', 'Master', 'Grandmaster', 'Challenger', 'Sovereign'] },
      dl: { ranks: ['Oracle', 'Phantom', 'Ascendant', 'Eternus'] }
    };
    const GAMES = GAME_LIST.filter((x) => NEEDS[x.id]).map((x) => ({ ...x, min: NEEDS[x.id].min || NEEDS[x.id].ranks[0] + ' or higher', ranks: NEEDS[x.id].ranks }));
    const g = GAMES.find((x) => x.id === f.game) || GAMES[0];
    const ggPicked = !!f.svc.gg;
    const ranks = ggPicked ? ['Any rank'].concat(g.ranks) : g.ranks;

    const step1ok = f.name.trim() && /@/.test(f.email) && f.discord.trim() && f.adult;
    const videoOk = youtubeVideoId(f.video) !== '';
    const step2ok = f.rank && f.region && videoOk;
    const step3ok = Object.keys(f.svc).some((k) => f.svc[k]);
    const ok = s.step === 1 ? step1ok : s.step === 2 ? step2ok : step3ok;
    const hints = { 1: 'Fill in all fields to continue', 2: f.rank && f.region ? 'Add a YouTube link to your intro video' : 'Pick your rank and region', 3: 'Pick at least one service' };

    const stepper = ['About you', 'Your game', 'What you offer'].map((name, i) => {
      const n = i + 1;
      const state = n < s.step ? 'done' : n === s.step ? 'now' : 'todo';
      return {
        name,
        bar: 'display: block; height: 4px; border-radius: 999px; background: ' + (state === 'todo' ? 'rgba(196, 170, 255, .14)' : '#D6BBFF') + ';',
        label: 'font-size: 13px; font-weight: 600; color: ' + (state === 'todo' ? '#6A6086' : (state === 'now' ? '#FFFFFF' : '#D6BBFF')) + ';'
      };
    });

    const games = GAMES.map((x) => {
      const a = x.id === f.game;
      return {
        short: x.short, img: x.img, pressed: a ? 'true' : 'false',
        style: 'display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 8px; border-radius: 16px; color: #FFFFFF; ' +
          (a ? 'background: #1B1033; border: 1.5px solid #D6BBFF;' : 'background: #090414; border: 1.5px solid rgba(196, 170, 255, .12);'),
        pick: () => this.setState({ f: { ...this.state.f, game: x.id, rank: '' } })
      };
    });

    const SVC = [
      ['duo', 'Ranked duo', 'Climb with players at or below your rank.'],
      ['coach', 'Coaching', 'Play & Learn sessions and 1:1 VOD reviews.'],
      ['social', 'Social & chill', 'Normals, ARAM, Quick Play and just vibes.'],
      ['gg', 'Gamer Girl', 'Friendly sessions as one of our Gamer Girls.']
    ];
    const box = (a) => 'flex: 0 0 auto; margin-top: 2px; width: 20px; height: 20px; border-radius: 6px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; ' +
      (a ? 'background: #D6BBFF; border: none;' : 'background: transparent; border: 1.5px solid rgba(196, 170, 255, .3);');
    const services = SVC.map(([k, title, desc]) => {
      const a = !!f.svc[k];
      return {
        title, desc, pressed: a ? 'true' : 'false', box: box(a),
        style: 'display: flex; align-items: flex-start; gap: 12px; padding: 16px; border-radius: 16px; text-align: left; ' +
          (a ? 'background: #1B1033; border: 1.5px solid #D6BBFF;' : 'background: #090414; border: 1.5px solid rgba(196, 170, 255, .12);'),
        toggle: () => this.setState({ f: { ...this.state.f, svc: { ...this.state.f.svc, [k]: !a } } })
      };
    });

    const perks = [
      ['01', 'Your hours, your rules', 'Go online when you want. No minimums, no shifts.'],
      ['02', 'Paid every week', 'Earnings land in your account every Friday. Tips are 100% yours.'],
      ['03', 'Players who want to be there', 'Customers are rated too. Toxic ones get removed fast.'],
      ['04', 'Grow your name', 'Top teammates get featured and join our creator program.']
    ].map(([n, title, text]) => ({ n, title, text }));

    // Earnings calculator: one booked game or hour of the game's main service (lib/catalog.js) pays
    // SHARE of its listed price. Only booked time counts, not time spent online.
    const cg = s.calcGame || 'lol';
    const ch = s.calcHours || 10;
    const cat = servicesFor(cg);
    const main = cat.modes.find((m) => m.id === cat.main);
    const per = Math.round(main.price * SHARE * 100) / 100;
    const hourly = main.unit === 'hour';
    const calcGames = GAMES.map((x) => {
      const a = x.id === cg;
      return {
        name: x.name, img: x.img, pressed: a ? 'true' : 'false',
        style: 'padding: 5px; border-radius: 14px; background: transparent; ' + (a ? 'border: 2px solid #5EEAA8;' : 'border: 2px solid transparent; opacity: .55;'),
        pick: () => this.setState({ calcGame: x.id })
      };
    });
    const calcHours = [5, 10, 20, 30].map((n) => ({
      label: n + (hourly ? 'h' : ' games'), pressed: ch === n ? 'true' : 'false',
      style: 'min-height: 42px; border-radius: 10px; border: none; font-size: 14px; font-weight: 700; ' + (ch === n ? 'background: #F3EEFF; color: #17092E;' : 'background: transparent; color: #CFC4EA;'),
      pick: () => this.setState({ calcHours: n })
    }));
    const monthly = Math.round(per * ch * 4.33);
    const online = s.online !== false;
    const bars = [['Mon', 46], ['Tue', 62], ['Wed', 30], ['Thu', 78], ['Fri', 100], ['Sat', 88], ['Sun', 54]].map(([day, h], i) => ({
      day, style: 'display: block; width: 100%; max-width: 28px; height: ' + h + '%; border-radius: 8px; background: ' + (i === 4 ? '#5EEAA8' : 'rgba(214, 187, 255, .28)') + ';'
    }));
    const acc = s.accepted || {};
    // What the teammate earns for a sample order: SHARE of the customer price after the bundle discount
    const earn = (game, id, units) => {
      const m = servicesFor(game).modes.find((x) => x.id === id);
      const off = m.cat === 'training' ? 0 : ({ 3: 10, 5: 15, 10: 25 }[units] || 0);
      return '+ ' + eur((m.was || m.price) * units * (100 - off) / 100 * SHARE);
    };
    const orders = [
      ['/assets/games/valorant.png', 'Duo Pro ×3 · Valorant', 'Lea · Platinum 2 · EU West', earn('val', 'duo2', 3)],
      ['/assets/games/league-of-legends.png', 'Play & Learn · League of Legends', 'Sam · Gold 1 · EU West', earn('lol', 'learn', 1)]
    ].map(([img, title, meta, pay], i) => ({
      img, title, meta, pay,
      btnLabel: acc[i] ? 'Accepted' : 'Accept',
      btn: 'min-height: 36px; padding: 0 14px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; ' + (acc[i] ? 'background: rgba(94, 234, 168, .14); color: #5EEAA8;' : 'background: #D6BBFF; color: #17092E;'),
      accept: () => this.setState({ accepted: { ...(this.state.accepted || {}), [i]: true } })
    }));

    return {
      calcGames, calcHours, calcMonthly: '€' + monthly.toLocaleString('en-US'),
      calcNote: 'You keep 60% of every order: ' + eur(per) + ' per ' + (hourly ? 'hour' : 'game') + ' of ' + main.title + ' in ' +
        (GAMES.find((x) => x.id === cg) || GAMES[0]).name + '. Tips are on top.',
      weekTotal: eur(per * ch),
      bars, orders,
      onlineChecked: online ? 'true' : 'false', onlineLabel: online ? 'Online' : 'Offline',
      onlineTrack: 'position: relative; width: 34px; height: 20px; border-radius: 999px; background: ' + (online ? '#5EEAA8' : '#2A1F45') + ';',
      onlineKnob: 'position: absolute; top: 3px; left: ' + (online ? '17px' : '3px') + '; width: 14px; height: 14px; border-radius: 50%; background: ' + (online ? '#0B2A1E' : '#8E84AB') + '; transition: left .15s;',
      toggleOnline: () => this.setState({ online: !online }),
      step: String(s.step), stepper, games, services, perks,
      reqs: GAMES.map((x) => ({ name: x.name, img: x.img, min: x.min })),
      // dropdown options for Pick; the form sends the country's name
      countries: COUNTRIES.map(([code, name]) => ({ value: name, label: name, icon: flagSrc(code) })),
      regions: ['EU West', 'EU Nordic & East', 'North America', 'LATAM', 'Brazil', 'Korea', 'Oceania'].map((r) => ({ value: r, label: r })),
      ranks: ranks.map((r) => ({ value: r, label: r })),
      hours: [['5–10', '5–10 hours'], ['10–20', '10–20 hours'], ['20–30', '20–30 hours'], ['30+', '30+ hours']].map(([value, label]) => ({ value, label })),
      f,
      on: { name: set('name'), email: set('email'), discord: set('discord'), country: put('country'), rank: put('rank'), region: put('region'), role: set('role'), link: set('link'), video: set('video'), hours: put('hours'), why: set('why') },
      videoBad: f.video.trim() !== '' && !videoOk,
      adultChecked: f.adult ? 'true' : 'false', adultBox: box(f.adult),
      toggleAdult: () => this.setState({ f: { ...this.state.f, adult: !this.state.f.adult } }),
      isStep1: s.step === 1, isStep2: s.step === 2, isStep3: s.step === 3,
      hasBack: s.step > 1, noBack: s.step === 1,
      showHint: !ok || !!s.sendError, hint: s.sendError || hints[s.step],
      nextDisabled: !ok || !!s.sending,
      nextLabel: s.step === 3 ? (s.sending ? 'Sending…' : 'Send application') : 'Continue',
      nextStyle: 'display: inline-flex; align-items: center; gap: 10px; min-height: 50px; padding: 0 22px; border-radius: 14px; border: none; font-size: 15px; font-weight: 700; ' +
        (ok ? 'background: #D6BBFF; color: #17092E;' : 'background: rgba(196, 170, 255, .12); color: #6A6086;'),
      next: () => { if (!ok || s.sending) return; if (s.step < 3) this.setState({ step: s.step + 1 }); else this.send(); },
      back: () => this.setState({ step: Math.max(1, s.step - 1) }),
      done: s.done, notDone: !s.done,
      firstName: f.name.trim().split(' ')[0] || 'friend',
      gameName: g.name
    };
  }

  render() {
    const v = this.renderVals();
    return (
      <div style={{ minHeight: "100vh", background: "#090414", color: "#F3EEFF", fontFamily: "Geist, system-ui, sans-serif", fontSize: "15px", lineHeight: "1.5", fontVariantNumeric: "tabular-nums" }}>
        {this.props.chrome === false ? null : (
        <header style={{ position: "sticky", top: "0", zIndex: "6", background: "rgba(9, 4, 20, .8)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(196, 170, 255, .08)" }}>
          <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "10px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 32px" }}>
            <a href="/" aria-label="Duoly home" style={{ display: "flex", alignItems: "center" }}>
              <img src="/assets/brand/logo-wordmark.webp" alt="Duoly" width="104" height="39" style={{ width: "104px", height: "39px", display: "block" }} />
            </a>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#D6BBFF", padding: "4px 10px", borderRadius: "999px", background: "rgba(214, 187, 255, .1)" }}>
              For teammates
            </span>
            <a href="/" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", minHeight: "44px", padding: "0 16px", borderRadius: "12px", border: "1px solid rgba(196, 170, 255, .16)", color: "#F3EEFF", textDecoration: "none", fontSize: "14px", fontWeight: "600" }}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M11 18l-6-6 6-6" />
              </svg>
              Back to booking
            </a>
          </div>
        </header>
        )}
        <main>
          <section aria-labelledby="ap-h" style={{ maxWidth: "1240px", margin: "0 auto", padding: "72px 24px 40px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "6px 14px 6px 6px", borderRadius: "999px", border: "1px solid rgba(94, 234, 168, .3)", background: "rgba(94, 234, 168, .08)", fontSize: "13px", fontWeight: "600", color: "#5EEAA8" }}>
              <span style={{ display: "flex" }}>
                <img src="/assets/avatars/avatar-1.png" alt="" width="24" height="24" style={{ width: "24px", height: "24px", borderRadius: "50%", boxShadow: "0 0 0 2px #090414" }} />
                <img src="/assets/avatars/avatar-2.png" alt="" width="24" height="24" style={{ width: "24px", height: "24px", borderRadius: "50%", boxShadow: "0 0 0 2px #090414", marginLeft: "-8px" }} />
                <img src="/assets/avatars/avatar-3.png" alt="" width="24" height="24" style={{ width: "24px", height: "24px", borderRadius: "50%", boxShadow: "0 0 0 2px #090414", marginLeft: "-8px" }} />
              </span>
              38 teammates joined this week
            </div>
            <h1 id="ap-h" style={{ margin: "22px 0 0", maxWidth: "900px", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: "800", fontSize: "clamp(46px, 6.4vw, 88px)", lineHeight: ".94", letterSpacing: "-.045em", color: "#FFFFFF" }}>
              Your rank is
              <br />
              worth{" "}
              <span style={{ color: "#5EEAA8" }}>
                real money.
              </span>
            </h1>
            <p style={{ margin: "22px 0 0", maxWidth: "540px", color: "#A79DC4", fontSize: "18px", lineHeight: "1.55" }}>
              Play as a teammate, coach or Gamer Girl on Duoly. Pick your hours, get paid every Friday, and only queue with players who want to be there.
            </p>
            <div style={{ marginTop: "30px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px" }}>
              <a href="#apply" style={{ display: "inline-flex", alignItems: "center", gap: "10px", minHeight: "54px", padding: "0 24px", borderRadius: "14px", background: "#D6BBFF", color: "#17092E", textDecoration: "none", fontSize: "16px", fontWeight: "700" }}>
                Apply in 3 minutes
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </a>
              <a href="#requirements" style={{ display: "inline-flex", alignItems: "center", minHeight: "54px", padding: "0 20px", borderRadius: "14px", border: "1px solid rgba(196, 170, 255, .2)", color: "#F3EEFF", textDecoration: "none", fontSize: "15px", fontWeight: "600" }}>
                See requirements
              </a>            </div>
            <div style={{ marginTop: "56px", width: "100%", maxWidth: "1060px", display: "flex", flexWrap: "wrap", gap: "14px", textAlign: "left" }}>
              <div style={{ flex: "1 1 420px", minWidth: "0", padding: "28px", borderRadius: "26px", background: "#120B22", border: "1px solid rgba(214, 187, 255, .18)", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", letterSpacing: ".1em", textTransform: "uppercase", color: "#8E84AB" }}>
                    Earnings calculator
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "15px", color: "#CFC4EA" }}>
                    See what you could make in a month.
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span id="calc-game" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                    Your game
                  </span>
                  <div role="radiogroup" aria-labelledby="calc-game" className="ap-calcgames">
                    {v.calcGames.map((g, $index) => (
                      <React.Fragment key={$index}>
                        <button type="button" role="radio" aria-checked={g.pressed} aria-label={g.name} onClick={g.pick} style={css(g.style)}>
                          <img src={g.img} alt="" width="36" height="36" style={{ width: "36px", height: "36px", borderRadius: "10px", display: "block" }} />
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span id="calc-hours" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                    Booked per week
                  </span>
                  <div role="radiogroup" aria-labelledby="calc-hours" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "4px", padding: "4px", borderRadius: "14px", background: "#090414", border: "1px solid rgba(196, 170, 255, .14)" }}>
                    {v.calcHours.map((h, $index) => (
                      <React.Fragment key={$index}>
                        <button type="button" role="radio" aria-checked={h.pressed} onClick={h.pick} style={css(h.style)}>
                          {h.label}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div style={{ paddingTop: "18px", borderTop: "1px solid rgba(196, 170, 255, .1)" }}>
                  <div style={{ fontSize: "13px", color: "#8E84AB" }}>
                    You could earn about
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "2px" }}>
                    <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "56px", fontWeight: "800", letterSpacing: "-.04em", lineHeight: "1", color: "#5EEAA8" }}>
                      {v.calcMonthly}
                    </span>
                    <span style={{ fontSize: "15px", color: "#A79DC4" }}>
                      / month
                    </span>
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "13px", color: "#8E84AB" }}>
                    {v.calcNote}
                  </div>
                </div>
              </div>
              <div style={{ flex: "1 1 420px", minWidth: "0", padding: "22px", borderRadius: "26px", background: "#0F0A1C", border: "1px solid rgba(196, 170, 255, .1)", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ position: "relative", flex: "0 0 auto", width: "44px", height: "44px" }}>
                    <img src="/assets/avatars/avatar-5.png" alt="" width="44" height="44" style={{ width: "44px", height: "44px", borderRadius: "50%", display: "block" }} />
                    <img src="/assets/flags/at.png" alt="" width="16" height="16" style={{ position: "absolute", right: "-2px", bottom: "-2px", width: "16px", height: "16px", borderRadius: "50%" }} />
                  </span>
                  <div style={{ flex: "1", minWidth: "0", lineHeight: "1.35" }}>
                    <div style={{ fontWeight: "600", color: "#FFFFFF" }}>
                      Your dashboard
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#8E84AB" }}>
                      Preview · ★ 4.98 from 212 sessions
                    </div>
                  </div>
                  <button type="button" role="switch" aria-checked={v.onlineChecked} onClick={v.toggleOnline} style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "40px", padding: "0 12px 0 6px", borderRadius: "999px", border: "1px solid rgba(196, 170, 255, .14)", background: "transparent", color: "#F3EEFF", fontSize: "13px", fontWeight: "600", transform: "none" }}>
                    <span style={css(v.onlineTrack)}>
                      <span style={css(v.onlineKnob)} />
                    </span>
                    {v.onlineLabel}
                  </button>
                </div>
                <div style={{ padding: "16px", borderRadius: "18px", background: "#120B22" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", color: "#8E84AB" }}>
                      This week
                    </span>
                    <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "700", color: "#FFFFFF" }}>
                      {v.weekTotal}
                    </span>
                  </div>
                  <div aria-hidden="true" style={{ marginTop: "12px", height: "92px", display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "8px", alignItems: "end" }}>
                    {v.bars.map((b, $index) => (
                      <React.Fragment key={$index}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%", justifyContent: "flex-end" }}>
                          <span style={css(b.style)} />
                          <span style={{ fontSize: "11px", color: "#6A6086" }}>
                            {b.day}
                          </span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", letterSpacing: ".1em", textTransform: "uppercase", color: "#8E84AB" }}>
                    Incoming orders
                  </div>
                  {v.orders.map((o, $index) => (
                    <React.Fragment key={$index}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 10px 10px 12px", borderRadius: "14px", background: "#120B22" }}>
                        <img src={o.img} alt="" width="34" height="34" style={{ width: "34px", height: "34px", borderRadius: "10px" }} />
                        <span style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", lineHeight: "1.3" }}>
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
                            {o.title}
                          </span>
                          <span style={{ fontSize: "12.5px", color: "#8E84AB" }}>
                            {o.meta}
                          </span>
                        </span>
                        <span style={{ fontSize: "14px", fontWeight: "700", color: "#5EEAA8" }}>
                          {o.pay}
                        </span>
                        <button type="button" onClick={o.accept} style={css(o.btn)}>
                          {o.btnLabel}
                        </button>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 24px" }}>
            <section aria-labelledby="perks-h" style={{ marginTop: "48px" }}>
              <h2 id="perks-h" style={{ margin: "0 0 20px", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "34px", fontWeight: "800", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                Why play on Duoly
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))", gap: "14px" }}>
                {v.perks.map((p, $index) => (
                  <React.Fragment key={$index}>
                    <div style={{ padding: "24px", borderRadius: "22px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .08)" }}>
                      <span style={{ width: "44px", height: "44px", borderRadius: "13px", background: "rgba(214, 187, 255, .12)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: "800", color: "#D6BBFF" }}>
                        {p.n}
                      </span>
                      <div style={{ marginTop: "14px", fontSize: "18px", fontWeight: "600", letterSpacing: "-.01em", color: "#FFFFFF" }}>
                        {p.title}
                      </div>
                      <div style={{ marginTop: "6px", fontSize: "14.5px", color: "#A79DC4" }}>
                        {p.text}
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </section>
            <section id="requirements" aria-labelledby="req-h" style={{ marginTop: "80px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "12px", marginBottom: "20px" }}>
                <h2 id="req-h" style={{ margin: "0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "34px", fontWeight: "800", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                  Minimum rank by game
                </h2>
                <span style={{ fontSize: "14px", color: "#8E84AB" }}>
                  Coaches and Gamer Girls have their own requirements — see below
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))", gap: "10px" }}>
                {v.reqs.map((r, $index) => (
                  <React.Fragment key={$index}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px", borderRadius: "18px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .08)" }}>
                      <img src={r.img} alt="" width="48" height="48" style={{ width: "48px", height: "48px", borderRadius: "13px" }} />
                      <span style={{ display: "flex", flexDirection: "column", lineHeight: "1.35" }}>
                        <span style={{ fontWeight: "600", color: "#FFFFFF" }}>
                          {r.name}
                        </span>
                        <span style={{ fontSize: "13px", color: "#D6BBFF", fontWeight: "600" }}>
                          {r.min}
                        </span>
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "10px" }}>
                <div style={{ padding: "18px 20px", borderRadius: "18px", border: "1px solid rgba(196, 170, 255, .1)" }}>
                  <div style={{ fontWeight: "600", color: "#FFFFFF" }}>
                    Coaches
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "14px", color: "#A79DC4" }}>
                    The coach rank shown on each game’s coaching (Master+ in League of Legends, Immortal+ in Valorant, FACEIT Level 10 in Counter-Strike 2…) and a short sample VOD review.
                  </div>
                </div>
                <div style={{ padding: "18px 20px", borderRadius: "18px", border: "1px solid rgba(196, 170, 255, .1)" }}>
                  <div style={{ fontWeight: "600", color: "#FFFFFF" }}>
                    Gamer Girls
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "14px", color: "#A79DC4" }}>
                    Any rank. Good vibes, a working mic and Discord are what matter most.
                  </div>
                </div>
              </div>
            </section>
            <section aria-labelledby="steps-h" style={{ marginTop: "80px" }}>
              <h2 id="steps-h" style={{ margin: "0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "34px", fontWeight: "800", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                From application to first payout
              </h2>
              <ol style={{ listStyle: "none", margin: "28px 0 0", padding: "0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "24px" }}>
                <li style={{ paddingTop: "18px", borderTop: "2px solid #D6BBFF" }}>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "14px", fontWeight: "700", color: "#D6BBFF" }}>
                    Day 1
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "19px", fontWeight: "600", color: "#FFFFFF" }}>
                    Apply
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "14.5px", color: "#A79DC4" }}>
                    Three quick steps, right below.
                  </div>
                </li>
                <li style={{ paddingTop: "18px", borderTop: "2px solid rgba(196, 170, 255, .2)" }}>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "14px", fontWeight: "700", color: "#8E84AB" }}>
                    Day 2
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "19px", fontWeight: "600", color: "#FFFFFF" }}>
                    Rank check
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "14.5px", color: "#A79DC4" }}>
                    We verify your account and rank history.
                  </div>
                </li>
                <li style={{ paddingTop: "18px", borderTop: "2px solid rgba(196, 170, 255, .2)" }}>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "14px", fontWeight: "700", color: "#8E84AB" }}>
                    Day 3
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "19px", fontWeight: "600", color: "#FFFFFF" }}>
                    Tryout game
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "14.5px", color: "#A79DC4" }}>
                    One game with our team on Discord. Just play like you.
                  </div>
                </li>
                <li style={{ paddingTop: "18px", borderTop: "2px solid rgba(196, 170, 255, .2)" }}>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "14px", fontWeight: "700", color: "#8E84AB" }}>
                    Day 4
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "19px", fontWeight: "600", color: "#FFFFFF" }}>
                    Go online
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "14.5px", color: "#A79DC4" }}>
                    Flip the switch and start earning.
                  </div>
                </li>
              </ol>
            </section>
            <section id="apply" aria-labelledby="form-h" style={{ marginTop: "88px", paddingBottom: "96px" }}>
              <div style={{ maxWidth: "760px", margin: "0 auto", borderRadius: "28px", background: "#120B22", border: "1px solid rgba(214, 187, 255, .18)" }}>
                {this.props.closed ? <ClosedNotice title="Applications open soon" text="We’re onboarding our first teammates through Discord right now. Join the server and say hi in the applications channel, or email us with your game, rank and Discord name." /> : v.notDone ? (
                  <>
                    <div style={{ padding: "28px 32px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                        <h2 id="form-h" style={{ margin: "0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "30px", fontWeight: "800", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                          Apply to join
                        </h2>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#8E84AB" }}>
                          Step {v.step} of 3
                        </span>
                      </div>
                      <ol aria-label="Application steps" style={{ listStyle: "none", margin: "18px 0 0", padding: "0", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
                        {v.stepper.map((s, $index) => (
                          <React.Fragment key={$index}>
                            <li style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <span style={css(s.bar)} />
                              <span style={css(s.label)}>
                                {s.name}
                              </span>
                            </li>
                          </React.Fragment>
                        ))}
                      </ol>
                    </div>
                    <div style={{ padding: "26px 32px 30px", display: "flex", flexDirection: "column", gap: "18px" }}>
                      {v.isStep1 ? (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "16px", animation: "appop .25s ease-out" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <label htmlFor="ap-name" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                Display name
                              </label>
                              <input id="ap-name" type="text" value={v.f.name} onChange={v.on.name} placeholder="e.g. Kairo" autoComplete="nickname" style={{ minHeight: "50px", padding: "0 14px", borderRadius: "14px", background: "#090414", border: "1px solid rgba(196, 170, 255, .16)", color: "#FFFFFF", fontSize: "15px" }} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <label htmlFor="ap-email" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                Email
                              </label>
                              <input id="ap-email" type="email" value={v.f.email} onChange={v.on.email} placeholder="you@email.com" autoComplete="email" style={{ minHeight: "50px", padding: "0 14px", borderRadius: "14px", background: "#090414", border: "1px solid rgba(196, 170, 255, .16)", color: "#FFFFFF", fontSize: "15px" }} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <label htmlFor="ap-discord" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                Discord username
                              </label>
                              <input id="ap-discord" type="text" value={v.f.discord} onChange={v.on.discord} placeholder="kairo.gg" style={{ minHeight: "50px", padding: "0 14px", borderRadius: "14px", background: "#090414", border: "1px solid rgba(196, 170, 255, .16)", color: "#FFFFFF", fontSize: "15px" }} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <label htmlFor="ap-country" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                Country
                              </label>
                              <Pick id="ap-country" label="Countries" search placeholder="Search countries" value={v.f.country} options={v.countries} onPick={v.on.country} />
                            </div>
                            <button type="button" role="checkbox" aria-checked={v.adultChecked} onClick={v.toggleAdult} style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", minHeight: "48px", padding: "0 4px", border: "none", background: "transparent", color: "#CFC4EA", fontSize: "14px", textAlign: "left", transform: "none" }}>
                              <span style={css(v.adultBox)}>
                                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#17092E" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              </span>
                              I’m 18 or older and I play on my own account
                            </button>
                          </div>
                        </>
                      ) : null}
                      {v.isStep2 ? (
                        <>
                          <div style={{ display: "flex", flexDirection: "column", gap: "18px", animation: "appop .25s ease-out" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <span id="ap-game-l" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                Your main game
                              </span>
                              <div role="radiogroup" aria-labelledby="ap-game-l" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(124px, 100%), 1fr))", gap: "8px" }}>
                                {v.games.map((g, $index) => (
                                  <React.Fragment key={$index}>
                                    <button type="button" role="radio" aria-checked={g.pressed} onClick={g.pick} style={css(g.style)}>
                                      <img src={g.img} alt="" width="40" height="40" style={{ width: "40px", height: "40px", borderRadius: "11px" }} />
                                      <span style={{ fontSize: "12.5px", fontWeight: "600", lineHeight: "1.2" }}>
                                        {g.short}
                                      </span>
                                    </button>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: "16px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label htmlFor="ap-rank" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                  Current rank
                                </label>
                                <Pick id="ap-rank" label="Ranks" placeholder="Choose…" value={v.f.rank} options={v.ranks} onPick={v.on.rank} />
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label htmlFor="ap-region" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                  Server / region
                                </label>
                                <Pick id="ap-region" label="Regions" placeholder="Choose…" value={v.f.region} options={v.regions} onPick={v.on.region} />
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label htmlFor="ap-role" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                  Main role
                                </label>
                                <input id="ap-role" type="text" value={v.f.role} onChange={v.on.role} placeholder="e.g. Jungle, Controller, Support" style={{ minHeight: "50px", padding: "0 14px", borderRadius: "14px", background: "#090414", border: "1px solid rgba(196, 170, 255, .16)", color: "#FFFFFF", fontSize: "15px" }} />
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <label htmlFor="ap-link" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                Profile link{" "}
                                <span style={{ fontWeight: "400", color: "#8E84AB" }}>
                                  (op.gg, tracker.gg, etc.)
                                </span>
                              </label>
                              <input id="ap-link" type="url" value={v.f.link} onChange={v.on.link} placeholder="https://" style={{ minHeight: "50px", padding: "0 14px", borderRadius: "14px", background: "#090414", border: "1px solid rgba(196, 170, 255, .16)", color: "#FFFFFF", fontSize: "15px" }} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <label htmlFor="ap-video" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                Intro video{" "}
                                <span style={{ fontWeight: "400", color: "#8E84AB" }}>
                                  (YouTube link, required)
                                </span>
                              </label>
                              <span id="ap-video-help" style={{ fontSize: "13px", color: "#A79DC4", lineHeight: "1.5" }}>
                                Upload a short video to YouTube (unlisted is fine) where you introduce yourself and tell us a bit about who you are. Showing your face is preferred, but voice only over a still image works too.
                              </span>
                              <input id="ap-video" type="url" required value={v.f.video} onChange={v.on.video} placeholder="https://youtu.be/…" aria-describedby={v.videoBad ? "ap-video-help ap-video-err" : "ap-video-help"} aria-invalid={v.videoBad ? "true" : "false"} style={{ minHeight: "50px", padding: "0 14px", borderRadius: "14px", background: "#090414", border: "1px solid " + (v.videoBad ? "#FF8A9B" : "rgba(196, 170, 255, .16)"), color: "#FFFFFF", fontSize: "15px" }} />
                              {v.videoBad ? (
                                <span id="ap-video-err" style={{ fontSize: "13px", color: "#FF8A9B" }}>
                                  That doesn’t look like a YouTube video link. Paste the link from the Share button.
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </>
                      ) : null}
                      {v.isStep3 ? (
                        <>
                          <div style={{ display: "flex", flexDirection: "column", gap: "18px", animation: "appop .25s ease-out" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <span id="ap-svc-l" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                What do you want to offer?{" "}
                                <span style={{ fontWeight: "400", color: "#8E84AB" }}>
                                  Pick all that fit
                                </span>
                              </span>
                              <div role="group" aria-labelledby="ap-svc-l" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "8px" }}>
                                {v.services.map((s, $index) => (
                                  <React.Fragment key={$index}>
                                    <button type="button" role="checkbox" aria-checked={s.pressed} onClick={s.toggle} style={css(s.style)}>
                                      <span style={css(s.box)}>
                                        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#17092E" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                      </span>
                                      <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        <span style={{ fontWeight: "600", color: "#FFFFFF" }}>
                                          {s.title}
                                        </span>
                                        <span style={{ fontSize: "13px", color: "#A79DC4" }}>
                                          {s.desc}
                                        </span>
                                      </span>
                                    </button>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "320px" }}>
                              <label htmlFor="ap-hours" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                Hours per week
                              </label>
                              <Pick id="ap-hours" label="Hours per week" value={v.f.hours} options={v.hours} onPick={v.on.hours} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <label htmlFor="ap-why" style={{ fontSize: "13px", fontWeight: "600", color: "#CFC4EA" }}>
                                Why would players love queuing with you?{" "}
                                <span style={{ fontWeight: "400", color: "#8E84AB" }}>
                                  (optional)
                                </span>
                              </label>
                              <textarea id="ap-why" rows="4" value={v.f.why} onChange={v.on.why} placeholder="Shotcaller, chill on comms, 4 years in Masters…" style={{ padding: "12px 14px", borderRadius: "14px", background: "#090414", border: "1px solid rgba(196, 170, 255, .16)", color: "#FFFFFF", fontSize: "15px", lineHeight: "1.5", resize: "vertical" }} />
                            </div>
                          </div>
                        </>
                      ) : null}
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", paddingTop: "18px", borderTop: "1px solid rgba(196, 170, 255, .1)" }}>
                        {v.hasBack ? (
                          <>
                            <button type="button" onClick={v.back} style={{ minHeight: "50px", padding: "0 18px", borderRadius: "14px", border: "1px solid rgba(196, 170, 255, .18)", background: "transparent", color: "#F3EEFF", fontSize: "15px", fontWeight: "600" }}>
                              Back
                            </button>
                          </>
                        ) : null}
                        {v.noBack ? (
                          <>
                            <span style={{ fontSize: "13px", color: "#8E84AB" }}>
                              Takes about 3 minutes
                            </span>
                          </>
                        ) : null}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {v.showHint ? (
                            <>
                              <span style={{ fontSize: "13px", color: "#8E84AB" }}>
                                {v.hint}
                              </span>
                            </>
                          ) : null}
                          <button type="button" onClick={v.next} disabled={v.nextDisabled} style={css(v.nextStyle)}>
                            {v.nextLabel}
                            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14" />
                              <path d="M13 6l6 6-6 6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
                {v.done ? (
                  <>
                    <div style={{ padding: "44px 32px 40px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", animation: "appop .3s ease-out" }}>
                      <img src="/assets/brand/logo-mascots.webp" alt="" width="200" height="126" style={{ width: "200px", height: "126px" }} />
                      <h2 style={{ margin: "14px 0 0", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "34px", fontWeight: "800", letterSpacing: "-.03em", color: "#FFFFFF" }}>
                        Application sent, {v.firstName}!
                      </h2>
                      <p style={{ margin: "10px 0 0", maxWidth: "440px", color: "#A79DC4", fontSize: "16px" }}>
                        We’ll check your {v.gameName} account and message{" "}
                        <strong style={{ color: "#FFFFFF" }}>
                          {v.f.discord}
                        </strong>
                        {" "}on Discord within 48 hours to set up your tryout.
                      </p>
                      <div style={{ marginTop: "24px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px" }}>
                        <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "50px", padding: "0 20px", borderRadius: "14px", background: "#5865F2", color: "#FFFFFF", textDecoration: "none", fontWeight: "600" }}>
                          <img src="/assets/social/discord-white.png" alt="" width="22" height="17" style={{ width: "22px", height: "17px" }} />
                          Join our Discord
                        </a>
                        <a href="/" style={{ display: "inline-flex", alignItems: "center", minHeight: "50px", padding: "0 20px", borderRadius: "14px", border: "1px solid rgba(196, 170, 255, .2)", color: "#F3EEFF", textDecoration: "none", fontWeight: "600" }}>
                          Back to Duoly
                        </a>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          </div>
        </main>
        {this.props.chrome === false ? null : (
        <footer style={{ borderTop: "1px solid rgba(196, 170, 255, .08)" }}>
          <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "28px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px", fontSize: "13px", color: "#6A6086" }}>
            <img src="/assets/brand/logo-wordmark.webp" alt="Duoly" width="96" height="36" style={{ width: "96px", height: "36px" }} />
            <span>
              © 2026 Duoly · Made in Vienna, Austria
            </span>
            <span style={{ display: "flex", gap: "18px" }}>
              <a href="/terms#teammates">
                Teammate terms
              </a>
              <a href="/privacy">
                Privacy
              </a>
              <a href="/contact?topic=teammate">
                Contact
              </a>
            </span>
          </div>
        </footer>
        )}
      </div>
    );
  }
}
