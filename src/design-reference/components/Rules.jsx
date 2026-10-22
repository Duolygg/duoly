'use client';

import React from 'react';
import { TIERS, RELEASE_DAYS } from './TrustScore';
import { PAYOUT_DAY } from '../lib/adminData';
import { BLOCKED } from '../lib/chatRules';

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const GREEN = '#5EEAA8';
const GOLD = '#FFD27A';
const PINK = '#F0A6FF';
const RED = '#FF8A9B';
const READ_KEY = 'duoly-rules-read';

// Small stroke icons (24×24 paths)
const ICON = {
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  hand: 'M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-3a2 2 0 0 0-4 0',
  power: 'M18.4 6.6a9 9 0 1 1-12.8 0M12 2v10',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  game: 'M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-4 3.6l-.6 6A3 3 0 0 0 5 18c1 0 1.6-.5 2.1-1.3L8.5 15h7l1.4 1.7c.5.8 1.1 1.3 2.1 1.3a3 3 0 0 0 2.9-3.4l-.6-6A4 4 0 0 0 17.3 5z',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  coin: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  sparkle: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z',
  stop: 'M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9zM15 9l-6 6M9 9l6 6',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5'
};
const Icon = ({ d, size = 20, color = 'currentColor', width = 2 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><path d={d} /></svg>
);

const GOLDEN = [
  ['Online means ready', 'Only go online when you can start a game within 2 minutes.'],
  ['Finish what you start', 'Play every game you were booked for. Never leave or throw.'],
  ['Everything stays on Duoly', 'Payments, chat and bookings. No outside deals, ever.'],
  ['Never touch a customer’s account', 'You play with them, not for them. Don’t ask for logins.'],
  ['Be the teammate you’d want', 'Patient, honest, kind, even when the game isn’t.']
];

const CHAPTERS = [
  { id: 'orders', n: '01', title: 'Taking orders', icon: ICON.bolt, color: '#D6BBFF',
    lead: 'Customers book Duoly because a teammate joins in under two minutes. Everything here protects that promise.',
    rules: [
      [ICON.power, 'Online means ready to play', 'Go online only when you can start a game within 2 minutes. Stepping away? Go offline. Admins set idle teammates offline so customers never wait on an empty seat.'],
      [ICON.hand, 'First to accept gets it', 'New orders don’t reach everyone at the same moment: teammates who are reliable see them first, and the rest a little later. Once an order shows up for you, the first to accept gets it. Accept only what you can start right now, and only one order at a time.'],
      [ICON.clock, 'Five minutes, then it’s gone', 'Orders nobody takes within 5 minutes are cancelled and refunded. If you can play it, take it.'],
      [ICON.game, 'Your games, your rank', 'You get orders for the games an admin approved for you. Want another game? Ask an admin, and never claim a rank you don’t have.'],
      [ICON.trophy, 'Reliability moves you up', 'Teammates who show up, finish orders and get great feedback see new orders sooner. Letting orders time out while you’re online does the opposite: you see new ones later for a while.']
    ] },
  { id: 'game', n: '02', title: 'In the game', icon: ICON.game, color: GREEN,
    lead: 'This is the part customers pay for. Make every game feel worth it, win or lose.',
    rules: [
      [ICON.bolt, 'Join fast', 'Send the invite as soon as you accept. The in-game name is on the order, ready to copy.'],
      [ICON.flag, 'Play every game you were booked for', 'Never leave mid-game, never throw, never “just one more” and disappear. If something real comes up, message the customer and an admin right away.'],
      [ICON.trophy, 'Play at the level they paid for', 'A Duo Apex customer gets your best. Coaching orders get explanations. Social orders get good vibes, not tryhard.'],
      [ICON.check, 'Prove it honestly', 'When you’re done, upload 1 to 5 screenshots of your match history or end screens with both of you in them, then mark the order as done. Fake proof ends your time on Duoly.'],
      [ICON.mic, 'Respect their comms choice', 'If they picked text chat, don’t push voice. If they picked voice, be on it and be clear.'],
      [ICON.shield, 'Follow the game’s rules', 'No cheats, scripts, exploits or anything that could get them (or you) banned. Play on your own account only.']
    ] },
  { id: 'chat', n: '03', title: 'Talking to customers', icon: ICON.chat, color: '#9EE6FF',
    lead: 'The order chat is where trust is built. Keep it friendly, keep it on Duoly.',
    rules: [
      [ICON.heart, 'Kind beats clever', 'Explain your calls, celebrate their plays, stay calm when it goes wrong. Nobody rebooks a teammate who flamed them.'],
      [ICON.coin, 'Payments only through Duoly', 'Never ask for or accept outside payments, “discounts” or tips via other apps. The chat blocks these messages automatically.'],
      [ICON.key, 'Never ask for a login', 'You play alongside customers, never on their account. Asking for passwords or account access is never okay.'],
      [ICON.user, 'Bookings stay on Duoly', 'Don’t move customers to your socials to book you privately. Want them back? Be great, and they’ll rebook you here.']
    ] },
  { id: 'money', n: '04', title: 'Getting paid', icon: ICON.coin, color: GOLD,
    lead: 'Clear money, no surprises. Here’s exactly how it works.' },
  { id: 'safety', n: '05', title: 'Safety & privacy', icon: ICON.lock, color: '#B9B0D6',
    lead: 'Customers trust us with their time and their info. You do too. We protect both.',
    rules: [
      [ICON.eye, 'Customer info is for the order only', 'Names, in-game names and chats stay private. No screenshots, no sharing, no looking people up.'],
      [ICON.mic, 'No recording without a yes', 'Streaming or clipping a session? Ask first, every time. No answer means no.'],
      [ICON.lock, 'Your account is yours alone', 'Nobody else may play or chat on your Duoly account. You must be 18 or older.'],
      [ICON.flag, 'Report, don’t retaliate', 'Toxic or creepy customer? Stay calm, finish safely or stop, and report it. Customers are rated too, and those who cross the line are removed.']
    ] },
  { id: 'gg', n: '06', title: 'For Gamer Girls', icon: ICON.sparkle, color: PINK,
    lead: 'Gamer Girl sessions are about gaming and good company. Your boundaries come first.',
    rules: [
      [ICON.sparkle, 'Gamer Girl orders only', 'As a verified Gamer Girl you get Gamer Girl orders across every game, and only those.'],
      [ICON.shield, 'You never owe personal info', 'No photos, socials, phone numbers, location or meetups. Ever. A “no” needs no explanation.'],
      [ICON.stop, 'You can end a session that crosses the line', 'Inappropriate requests or comments? End it and report it. Admins review every report, and you won’t be penalised for protecting yourself.'],
      [ICON.heart, 'Same standards, same respect', 'Every other rule applies to you too, and every customer is expected to treat you like any other teammate.']
    ] }
];

const ZERO = [
  [ICON.coin, 'Outside payments', 'Asking for, offering or accepting money outside Duoly.'],
  [ICON.key, 'Account access', 'Asking for logins or playing on a customer’s account.'],
  [ICON.shield, 'Cheating', 'Hacks, scripts, exploits, or wintrading.'],
  [ICON.stop, 'Harassment', 'Hate speech, threats, sexual comments, or bullying.'],
  [ICON.flag, 'Fake proof', 'Uploading screenshots of games that didn’t happen or aren’t from this order.'],
  [ICON.user, 'Account sharing', 'Letting anyone else use your Duoly account.']
];

const LADDER = [
  ['Heads-up', 'A friendly note from an admin. Most things end here.', '#9EE6FF'],
  ['Time-out', 'You’re set offline and paused from the order desk for a while.', GOLD],
  ['Suspension', 'No orders until an admin has reviewed what happened.', PINK],
  ['Removal', 'Your teammate account is closed for good.', RED]
];

const CHAT_EXAMPLES = [
  [true, 'Sending you an invite now! Ready when you are'],
  [true, 'Nice try on that fight. Let’s wait for my cooldown next time'],
  [false, 'Pay me on PayPal next time and we skip the fee'],
  [false, 'Send me your login, I’ll play your placements']
];

// The teammate rulebook (/rules). Written to be read: short chapters, the why behind each rule,
// the five things that matter most up top, and a sign-off at the end.
export default class Rules extends React.Component {
  constructor(props) {
    super(props);
    this.state = { active: 'golden', progress: 0, readAt: null };
  }

  componentDidMount() {
    try { const t = window.localStorage.getItem(READ_KEY); if (t) this.setState({ readAt: Number(t) || null }); } catch (e) {}
    this._onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const progress = max > 0 ? Math.min(1, h.scrollTop / max) : 0;
      // the chapter whose top passed a line a third down the screen
      const ids = ['golden'].concat(CHAPTERS.map((c) => c.id), ['zero', 'consequences']);
      let active = ids[0];
      ids.forEach((id) => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < window.innerHeight * 0.33) active = id; });
      if (progress !== this.state.progress || active !== this.state.active) this.setState({ progress, active });
    };
    window.addEventListener('scroll', this._onScroll, { passive: true });
    this._onScroll();
  }
  componentWillUnmount() { window.removeEventListener('scroll', this._onScroll); }

  markRead() {
    const now = Date.now();
    try { window.localStorage.setItem(READ_KEY, String(now)); } catch (e) {}
    this.setState({ readAt: now });
  }

  renderRules(rules, color) {
    return (
      <ul className="rl-cards">
        {rules.map(([icon, title, text]) => (
          <li key={title} className="rl-card">
            <span className="rl-card-icon" style={{ color, background: 'color-mix(in srgb, ' + color + ' 12%, transparent)' }}><Icon d={icon} size={19} /></span>
            <h3 className="rl-card-title">{title}</h3>
            <p className="rl-card-text">{text}</p>
          </li>
        ))}
      </ul>
    );
  }

  renderChat() {
    return (
      <div className="rl-chat" aria-label="Example messages">
        {CHAT_EXAMPLES.map(([ok, text]) => (
          <div key={text} className="rl-chat-row">
            <span className="rl-chat-verdict" style={{ color: ok ? GREEN : RED, background: ok ? 'rgba(94, 234, 168, .1)' : 'rgba(255, 138, 155, .1)' }}>
              <Icon d={ok ? ICON.check : ICON.x} size={14} width={3} />
            </span>
            <span className="rl-bubble" style={ok ? {} : { background: 'transparent', border: '1px dashed rgba(255, 138, 155, .4)', color: '#CFC4EA', textDecoration: 'line-through', textDecorationColor: 'rgba(255, 138, 155, .55)' }}>{text}</span>
            {!ok ? <span className="rl-chat-tag">{BLOCKED.test(text) ? 'Blocked by the chat' : 'Not okay'}</span> : null}
          </div>
        ))}
      </div>
    );
  }

  renderMoney() {
    const tiles = [
      [ICON.coin, 'Your rate, upfront', 'Every order shows exactly what you earn before you accept. What you see is what you get.'],
      [ICON.clock, 'Paid every ' + PAYOUT_DAY, 'Earnings from completed orders go out weekly, in USD.'],
      [ICON.heart, 'Tips are 100% yours', 'Every cent a customer tips goes straight to you.']
    ];
    return (
      <>
        <ul className="rl-cards rl-cards-3">
          {tiles.map(([icon, title, text]) => (
            <li key={title} className="rl-card">
              <span className="rl-card-icon" style={{ color: GOLD, background: 'rgba(255, 210, 122, .12)' }}><Icon d={icon} size={19} /></span>
              <h3 className="rl-card-title">{title}</h3>
              <p className="rl-card-text">{text}</p>
            </li>
          ))}
        </ul>
        <div className="rl-panel" style={{ marginTop: "14px" }}>
          <h3 className="rl-card-title" style={{ margin: "0" }}>Trust levels: your deposit shrinks as you grow</h3>
          <p className="rl-card-text" style={{ marginTop: "6px" }}>
            A small security deposit is held from each payout and paid back after {RELEASE_DAYS} days without a dispute. It covers refunds if a customer’s complaint is upheld. The more orders you complete, the less is held, down to nothing.
          </p>
          <ol className="rl-tiers">
            {TIERS.map((t) => (
              <li key={t.id} className="rl-tier" style={{ '--c': t.color }}>
                <span className="rl-tier-dot" />
                <span className="rl-tier-name" style={{ color: t.color }}>{t.name}</span>
                <span className="rl-tier-dep">{t.deposit ? t.deposit + '% held' : 'No deposit'}</span>
                <span className="rl-tier-from">{t.from ? t.from + '+ orders' : 'Start here'}</span>
              </li>
            ))}
          </ol>
        </div>
      </>
    );
  }

  render() {
    const s = this.state;
    const nav = [{ id: 'golden', n: '★', title: 'The golden rules' }].concat(CHAPTERS.map((c) => ({ id: c.id, n: c.n, title: c.title })), [{ id: 'zero', n: '07', title: 'Zero tolerance' }, { id: 'consequences', n: '08', title: 'If a rule is broken' }]);
    const readDate = s.readAt ? new Date(s.readAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    return (
      <div className="rl-page">
        {this.props.chrome === false ? null : (
        <header className="rl-header">
          <div className="rl-header-in">
            <a href="/" aria-label="Duoly home" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
              <img src="/assets/brand/logo-wordmark.webp" alt="Duoly" width="104" height="39" style={{ width: "104px", height: "39px", display: "block" }} />
              <span className="rl-badge">Rules</span>
            </a>
            <a href={this.props.back.href} className="rl-btn rl-btn-ghost" style={{ marginLeft: "auto" }}>
              <Icon d="M19 12H5M12 19l-7-7 7-7" size={16} width={2.2} />
              {this.props.back.label}
            </a>
          </div>
          <span aria-hidden="true" className="rl-progress" style={{ transform: 'scaleX(' + s.progress + ')' }} />
        </header>
        )}

        {/* hero */}
        <section className="rl-hero">
          <div className="rl-hero-text">
            <span className="rl-eyebrow"><Icon d={ICON.book} size={15} /> The Teammate Code · 6 min read</span>
            <h1 className="rl-h1">Play fair. Get paid.<br /><span className="rl-grad">Have a great time.</span></h1>
            <p className="rl-lead">
              Duoly works because customers trust that whoever joins their lobby is skilled, kind and fair. These rules keep it that way, for them and for you. Short chapters, real examples, no legal fog.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "24px" }}>
              <a href="#orders" className="rl-btn rl-btn-primary">Start reading <Icon d="M12 5v14M19 12l-7 7-7-7" size={16} width={2.4} /></a>
              {s.readAt ? <span className="rl-read-chip"><Icon d={ICON.check} size={15} width={3} /> You read these on {readDate}</span> : null}
            </div>
          </div>

          <div id="golden" className="rl-golden">
            <div className="rl-golden-head">
              <span className="rl-golden-star"><Icon d={ICON.sparkle} size={18} color="#17092E" width={2.2} /></span>
              <span>
                <span style={{ display: "block", fontFamily: DISPLAY, fontWeight: "800", fontSize: "19px", color: "#FFFFFF", letterSpacing: "-.02em" }}>The 5 golden rules</span>
                <span style={{ display: "block", fontSize: "13px", color: "#A79DC4" }}>Short on time? Remember these.</span>
              </span>
            </div>
            <ol className="rl-golden-list">
              {GOLDEN.map(([title, text], i) => (
                <li key={title}>
                  <span className="rl-golden-n">{i + 1}</span>
                  <span>
                    <span style={{ display: "block", fontWeight: "700", color: "#FFFFFF" }}>{title}</span>
                    <span style={{ display: "block", fontSize: "13.5px", color: "#A79DC4" }}>{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="rl-body">
          <nav aria-label="Chapters" className="rl-toc">
            <span className="rl-toc-label">Chapters</span>
            <ol>
              {nav.map((c) => (
                <li key={c.id}>
                  <a href={'#' + c.id} aria-current={s.active === c.id ? 'true' : undefined} className="rl-toc-link">
                    <span className="rl-toc-n">{c.n}</span>{c.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <main className="rl-main">
            {CHAPTERS.map((c) => (
              <section key={c.id} id={c.id} aria-labelledby={c.id + '-h'} className="rl-chapter">
                <div className="rl-chapter-head">
                  <span className="rl-chapter-n" style={{ color: c.color, borderColor: 'color-mix(in srgb, ' + c.color + ' 35%, transparent)', background: 'color-mix(in srgb, ' + c.color + ' 10%, transparent)' }}>{c.n}</span>
                  <div>
                    <h2 id={c.id + '-h'} className="rl-h2">{c.title}</h2>
                    <p className="rl-chapter-lead">{c.lead}</p>
                  </div>
                </div>
                {c.id === 'money' ? this.renderMoney() : this.renderRules(c.rules, c.color)}
                {c.id === 'chat' ? this.renderChat() : null}
              </section>
            ))}

            <section id="zero" aria-labelledby="zero-h" className="rl-chapter">
              <div className="rl-zero">
                <div className="rl-chapter-head" style={{ marginBottom: "18px" }}>
                  <span className="rl-chapter-n" style={{ color: RED, borderColor: 'rgba(255, 138, 155, .4)', background: 'rgba(255, 138, 155, .1)' }}>07</span>
                  <div>
                    <h2 id="zero-h" className="rl-h2">Zero tolerance</h2>
                    <p className="rl-chapter-lead">No warnings, no second chances. Any of these means immediate removal, and held deposits go towards refunding the customers affected.</p>
                  </div>
                </div>
                <ul className="rl-zero-grid">
                  {ZERO.map(([icon, title, text]) => (
                    <li key={title} className="rl-zero-item">
                      <Icon d={icon} size={18} color={RED} />
                      <span>
                        <span style={{ display: "block", fontWeight: "700", color: "#FFFFFF" }}>{title}</span>
                        <span style={{ display: "block", fontSize: "13.5px", lineHeight: "1.5", color: "#CFC4EA" }}>{text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section id="consequences" aria-labelledby="cons-h" className="rl-chapter">
              <div className="rl-chapter-head">
                <span className="rl-chapter-n" style={{ color: '#D6BBFF', borderColor: 'rgba(214, 187, 255, .35)', background: 'rgba(214, 187, 255, .1)' }}>08</span>
                <div>
                  <h2 id="cons-h" className="rl-h2">If a rule is broken</h2>
                  <p className="rl-chapter-lead">Everyone has an off day. We start with a conversation and only go further if it keeps happening. A real person reviews every case.</p>
                </div>
              </div>
              <ol className="rl-ladder">
                {LADDER.map(([title, text, color], i) => (
                  <li key={title} className="rl-step" style={{ '--c': color }}>
                    <span className="rl-step-n">{i + 1}</span>
                    <span className="rl-step-title" style={{ color }}>{title}</span>
                    <span className="rl-step-text">{text}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* sign-off */}
            <section aria-labelledby="done-h" className="rl-done">
              <span className="rl-done-icon"><Icon d={s.readAt ? ICON.check : ICON.trophy} size={26} color="#17092E" width={2.4} /></span>
              <h2 id="done-h" className="rl-h2" style={{ marginTop: "14px" }}>{s.readAt ? 'You’re all set' : 'That’s everything'}</h2>
              <p className="rl-chapter-lead" style={{ maxWidth: "460px", margin: "8px auto 0" }}>
                {s.readAt
                  ? 'Thanks for reading. Questions or something unclear? Ask an admin any time.'
                  : 'Thanks for reading all the way. Questions or something unclear? Ask an admin any time. Now go make someone’s night.'}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px", marginTop: "22px" }}>
                {s.readAt ? null : (
                  <button type="button" onClick={() => this.markRead()} className="rl-btn rl-btn-primary">
                    <Icon d={ICON.check} size={16} width={2.6} /> I’ve read the rules
                  </button>
                )}
                <a href={this.props.back.href} className="rl-btn rl-btn-ghost">{this.props.back.label}</a>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }
}
