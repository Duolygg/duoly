// Live port of src/design-reference/components/Creators.jsx (Fabian's original): real fetch and the
// real Sparky widget instead of the design-preview transport. Keep layout and copy in sync with the original.
'use client';

import React from 'react';
import ClosedNotice from '../../design-reference/components/ClosedNotice.jsx';
import SupportChat from '../support/SupportChat';
import { LegalFooter, Icon } from './LegalPage.jsx';
import { GAMES } from '../../design-reference/lib/games';
import { CREATOR, tierFor } from '../../design-reference/lib/creators';

// /creators: the creator program landing page. Numbers come from lib/creators.js; the application goes
// to the support inbox (app/api/contact, topic "creator"). Styles: .cr-* in app/globals.css.

const eur = (n) =>
  '€' +
  n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
const eur2 = (n) => '€' + n.toFixed(2);
// the mock stream chat in the hero (illustration only)
const CHAT = [
  ['kiwi_', '#F0A6FF', 'how do u always have a duo lol'],
  [
    'YourChannel',
    '#FFD27A',
    'Duoly! Master+ teammate in 2 min, code YOURNAME = 10% off',
  ],
  ['nebula', '#9EE6FF', '!duoly'],
  [
    'DuolyBot',
    '#D6BBFF',
    'Duo up in under 2 minutes → duoly.gg/yourname · 10% off your first order',
  ],
  ['mxrtin', '#5EEAA8', 'just booked one, we’re queueing rn'],
  ['zoe.gg', '#F0A6FF', 'W streamer, W code'],
  ['lumi', '#9EE6FF', 'does it work for valorant too?'],
  ['YourChannel', '#FFD27A', 'every game: League, Valo, CS2, Fortnite, Apex…'],
];
const SALES = [
  ['kiwi_', 'Duo Pro ×3'],
  ['mxrtin', 'Duo Plus ×5'],
  ['nebula', 'Arena Partner ×3'],
  ['zoe.gg', 'Ranked 5s ×1'],
  ['lumi', 'Duo Apex ×3'],
];
const PLATFORMS = ['Twitch', 'YouTube', 'TikTok', 'Kick', 'Instagram', 'Other'];
const SIZES = ['Under 1K', '1K – 10K', '10K – 100K', '100K+'];
const FAQ = [
  [
    'Who can join?',
    'Streamers, YouTubers and TikTokers who play games we offer and have an engaged community. There’s no hard follower minimum: a small, active chat often converts better than a big quiet one.',
  ],
  [
    'How do I earn?',
    'You get your own code and link. Every time a viewer books with it, you earn ' +
      CREATOR.tiers[0].commission +
      '–' +
      CREATOR.tiers[2].commission +
      '% of the order, and keep earning on their orders for ' +
      CREATOR.attributionMonths +
      ' months.',
  ],
  [
    'What do my viewers get?',
    CREATOR.viewerDiscount +
      '% off their first order with your code, and a high-rank teammate in their lobby within minutes.',
  ],
  [
    'When do I get paid?',
    'Monthly, once you’ve earned at least ' +
      eur(CREATOR.payoutMin) +
      '. You see every order that used your code.',
  ],
  [
    'Can I play with Duoly teammates on stream?',
    'Yes. Partners get free sessions every month for content, and Elite creators can play with our top teammates live.',
  ],
  [
    'Do I have to stream Duoly every time?',
    'No. Put your link in your panels or description and mention it when it fits. No scripts, no forced ad reads.',
  ],
];

export default class Creators extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      chat: CHAT.slice(0, 4),
      next: 4,
      sale: 0,
      orders: 40,
      faq: 0,
      f: {
        name: '',
        email: '',
        platform: 'Twitch',
        channel: '',
        size: '1K – 10K',
        game: 'lol',
        message: '',
        website: '',
      },
      sending: false,
      sent: false,
      error: '',
      field: '',
    };
  }
  componentDidMount() {
    // the hero's chat keeps moving, and a sale pops up every few seconds
    this._chat = setInterval(
      () =>
        this.setState((s) => ({
          chat: s.chat.concat([CHAT[s.next % CHAT.length]]).slice(-5),
          next: s.next + 1,
        })),
      2200,
    );
    this._sale = setInterval(
      () => this.setState((s) => ({ sale: s.sale + 1 })),
      3400,
    );
  }
  componentWillUnmount() {
    clearInterval(this._chat);
    clearInterval(this._sale);
  }
  setF = (k) => (e) =>
    this.setState({
      f: { ...this.state.f, [k]: e.target.value },
      error: '',
      field: '',
    });
  pickF = (k, v) => () =>
    this.setState({ f: { ...this.state.f, [k]: v }, error: '', field: '' });

  apply = async (e) => {
    e.preventDefault();
    const f = this.state.f;
    if (this.state.sending) return;
    if (!/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(f.channel.trim()))
      return this.setState({
        error: 'Add a link to your channel so we can check it out.',
        field: 'channel',
      });
    this.setState({ sending: true, error: '', field: '' });
    const game = (GAMES.find((g) => g.id === f.game) || {}).name || f.game;
    const message =
      'Creator application\nPlatform: ' +
      f.platform +
      '\nChannel: ' +
      f.channel.trim() +
      '\nAudience: ' +
      f.size +
      '\nMain game: ' +
      game +
      (f.message.trim() ? '\n\n' + f.message.trim() : '');
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf: this.props.csrf,
          name: f.name,
          email: f.email,
          topic: 'creator',
          message,
          website: f.website,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok)
        return this.setState({
          sending: false,
          error: j.error || 'Couldn’t send that. Please try again.',
          field: j.field || '',
        });
      this.setState({ sending: false, sent: true });
    } catch (err) {
      this.setState({
        sending: false,
        error:
          'Can’t reach Duoly right now. Check your connection and try again.',
      });
    }
  };

  renderStream() {
    const s = this.state;
    const sale = SALES[s.sale % SALES.length];
    const t = CREATOR.tiers[1];
    const cut = Math.round(CREATOR.avgOrder * t.commission) / 100;
    return (
      <div className="cr-stage" aria-hidden="true">
        <div className="cr-screen">
          <div className="cr-screen-bg" />
          <div className="cr-screen-top">
            <span className="cr-live">
              <span />
              LIVE
            </span>
            <span className="cr-viewers">
              <Icon name="user" size={13} stroke={2.4} />
              2,481
            </span>
          </div>
          <div className="cr-cam">
            <img src="/assets/brand/logo-mascots.webp" alt="" />
          </div>
          <div className="cr-overlay">
            <img src="/assets/brand/logo-wordmark.webp" alt="" />
            <span>
              <strong>Duo with a Master+ player</strong>duoly.gg/yourname ·{' '}
              {CREATOR.viewerDiscount}% off
            </span>
          </div>
        </div>
        <div className="cr-chat">
          <div className="cr-chat-h">Stream chat</div>
          <div className="cr-chat-list">
            {s.chat.map(([who, color, text], i) => (
              <div key={s.next - s.chat.length + i} className="cr-msg">
                <b style={{ color }}>{who}</b> {text}
              </div>
            ))}
          </div>
        </div>
        <div key={s.sale} className="cr-sale">
          <span className="cr-sale-icon">
            <Icon name="check" size={16} stroke={3} />
          </span>
          <span>
            <strong>+{eur2(cut)} for you</strong>
            {sale[0]} booked {sale[1]} with your code
          </span>
        </div>
      </div>
    );
  }

  render() {
    const s = this.state;
    const f = s.f;
    const tier = tierFor(s.orders);
    const monthly = (s.orders * CREATOR.avgOrder * tier.commission) / 100;
    const pct = ((s.orders - 1) / (300 - 1)) * 100;
    const games = GAMES.concat(GAMES);
    return (
      <div className="lg-page cr-page">
        {this.props.chrome === false ? null : (
          <header className="lg-header">
            <div className="lg-header-in">
              <a href="/" aria-label="Duoly home" className="lg-logo">
                <img
                  src="/assets/brand/logo-wordmark.webp"
                  alt="Duoly"
                  width="96"
                  height="36"
                />
              </a>
              <span className="cr-badge">Creators</span>
              <nav aria-label="Creator program" className="cr-nav">
                <a href="#how">How it works</a>
                <a href="#earn">Earnings</a>
                <a href="#tiers">Tiers</a>
                <a href="#faq">FAQ</a>
              </nav>
              <a href="#apply" className="lg-btn cr-head-cta">
                Apply now
              </a>
            </div>
          </header>
        )}

        <main>
          <section className="cr-hero">
            <div className="cr-aurora">
              <span />
              <span />
              <span />
            </div>
            <div className="cr-hero-in">
              <div className="cr-hero-copy">
                <span className="lg-kicker">
                  <span className="lg-kicker-dot" />
                  Duoly Creator Program
                </span>
                <h1 className="cr-h1">
                  Your chat wants a duo.
                  <br />
                  <span className="lg-grad">Get paid when they book one.</span>
                </h1>
                <p className="lg-intro">
                  Give your viewers {CREATOR.viewerDiscount}% off a high-rank
                  teammate, and earn up to {CREATOR.tiers[2].commission}% on
                  every order they place for {CREATOR.attributionMonths} months.
                </p>
                <div className="cr-ctas">
                  <a href="#apply" className="lg-btn big-inline">
                    Become a creator{' '}
                    <Icon name="arrow" size={17} stroke={2.4} />
                  </a>
                  <a href="#earn" className="lg-btn ghost">
                    What would I earn?
                  </a>
                </div>
                <div className="cr-facts">
                  <span>
                    <strong>
                      {CREATOR.tiers[0].commission}–
                      {CREATOR.tiers[2].commission}%
                    </strong>
                    commission
                  </span>
                  <span>
                    <strong>{CREATOR.viewerDiscount}% off</strong>for your
                    viewers
                  </span>
                  <span>
                    <strong>{CREATOR.attributionMonths} months</strong>on every
                    viewer
                  </span>
                </div>
              </div>
              {this.renderStream()}
            </div>
          </section>

          <section
            className="cr-marquee"
            aria-label="Games your viewers can book"
          >
            <span className="cr-marquee-h">
              Every game your community plays
            </span>
            <div className="cr-marquee-mask">
              <div className="cr-marquee-row">
                {games.map((g, i) => (
                  <span key={i} className="cr-game">
                    <img src={g.img} alt="" />
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section id="how" className="cr-sec">
            <span className="cr-eyebrow">How it works</span>
            <h2 className="cr-h2">Three steps. No scripts.</h2>
            <div className="cr-steps">
              {[
                [
                  'user',
                  'Apply in two minutes',
                  'Tell us about your channel. We reply within a few days, usually faster.',
                ],
                [
                  'card',
                  'Get your code & link',
                  'Your own code, link and stream kit: panels, overlay and a chat command.',
                ],
                [
                  'heart',
                  'Earn on every order',
                  'Viewers save ' +
                    CREATOR.viewerDiscount +
                    '% on their first order, you earn on all of their orders for ' +
                    CREATOR.attributionMonths +
                    ' months.',
                ],
              ].map(([icon, t, d], i) => (
                <div key={t} className="cr-step">
                  <span className="cr-step-n">0{i + 1}</span>
                  <span className="cr-step-icon">
                    <Icon name={icon} size={22} />
                  </span>
                  <strong>{t}</strong>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="earn" className="cr-sec">
            <div className="cr-calc">
              <div className="cr-calc-copy">
                <span className="cr-eyebrow">Earnings calculator</span>
                <h2 className="cr-h2">See what your chat is worth.</h2>
                <p>
                  Drag to how many orders your code brings in a month. We use a
                  typical order of {eur2(CREATOR.avgOrder)} (three games of Duo
                  Pro).
                </p>
                <label className="cr-range">
                  <span className="cr-range-top">
                    <span>Orders from your code / month</span>
                    <strong>{s.orders}</strong>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="300"
                    value={s.orders}
                    onChange={(e) =>
                      this.setState({ orders: Number(e.target.value) })
                    }
                    style={{
                      background:
                        'linear-gradient(90deg,#D6BBFF ' +
                        pct +
                        '%,rgba(196,170,255,.14) ' +
                        pct +
                        '%)',
                    }}
                    aria-label="Orders from your code per month"
                  />
                  <span className="cr-range-scale">
                    <span>1</span>
                    <span>100</span>
                    <span>200</span>
                    <span>300</span>
                  </span>
                </label>
              </div>
              <div className="cr-calc-out">
                <span className={'cr-tier-pill ' + tier.id}>
                  {tier.name} · {tier.commission}%
                </span>
                <span className="cr-calc-label">You’d earn about</span>
                <strong className="cr-calc-big">
                  {eur(monthly)}
                  <em>/month</em>
                </strong>
                <span className="cr-calc-year">
                  That’s {eur(monthly * 12)} a year, on top of what you already
                  make.
                </span>
                <a href="#apply" className="lg-btn">
                  Start earning <Icon name="arrow" size={16} stroke={2.4} />
                </a>
              </div>
            </div>
          </section>

          <section id="tiers" className="cr-sec">
            <span className="cr-eyebrow">Tiers</span>
            <h2 className="cr-h2">Grow with us.</h2>
            <p className="cr-lead">
              Your tier goes up automatically with the orders your code brings
              in each month.
            </p>
            <div className="cr-tiers">
              {CREATOR.tiers.map((t, i) => (
                <div
                  key={t.id}
                  className={
                    'cr-tier ' + t.id + (t.id === tier.id ? ' on' : '')
                  }
                >
                  {t.id === tier.id ? (
                    <span className="cr-tier-you">Your tier</span>
                  ) : null}
                  <span className="cr-tier-name">{t.name}</span>
                  <strong className="cr-tier-pct">
                    {t.commission}%<em> commission</em>
                  </strong>
                  <span className="cr-tier-from">
                    {t.from
                      ? t.from + '+ orders a month'
                      : 'Where everyone starts'}
                  </span>
                  <ul>
                    {t.perks.map((p) => (
                      <li key={p}>
                        <span className="lg-tick">
                          <Icon name="check" size={12} stroke={3} />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  {i === 2 ? <span className="cr-tier-glow" /> : null}
                </div>
              ))}
            </div>
          </section>

          <section id="faq" className="cr-sec cr-faq-wrap">
            <div>
              <span className="cr-eyebrow">FAQ</span>
              <h2 className="cr-h2">Good questions.</h2>
              <p className="cr-lead">
                Anything else?{' '}
                <a href="/contact?topic=business">Get in touch</a>.
              </p>
            </div>
            <div className="cr-faq">
              {FAQ.map(([q, a], i) => {
                const open = s.faq === i;
                return (
                  <div key={q} className={'cr-q' + (open ? ' open' : '')}>
                    <button
                      type="button"
                      aria-expanded={open ? 'true' : 'false'}
                      onClick={() => this.setState({ faq: open ? -1 : i })}
                    >
                      {q}
                      <span className="cr-q-plus" aria-hidden="true">
                        +
                      </span>
                    </button>
                    {open ? <p>{a}</p> : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section id="apply" className="cr-sec">
            <div className="cr-apply">
              <div className="cr-apply-copy">
                <span className="cr-eyebrow">Apply</span>
                <h2 className="cr-h2">Let’s make content together.</h2>
                <p>
                  Two minutes, no follower minimum. We look at every application
                  ourselves and get back to you within a few days.
                </p>
                <ul className="cr-apply-list">
                  <li>
                    <span className="lg-tick">
                      <Icon name="check" size={12} stroke={3} />
                    </span>
                    Free to join, cancel any time
                  </li>
                  <li>
                    <span className="lg-tick">
                      <Icon name="check" size={12} stroke={3} />
                    </span>
                    Your own code, link and stream kit
                  </li>
                  <li>
                    <span className="lg-tick">
                      <Icon name="check" size={12} stroke={3} />
                    </span>
                    Monthly payouts from {eur(CREATOR.payoutMin)}
                  </li>
                </ul>
              </div>
              <div className="cr-apply-card">
                {s.sent ? (
                  <div className="ct-sent" role="status">
                    <span className="ct-sent-icon">
                      <Icon name="check" size={30} stroke={3} />
                    </span>
                    <h2 className="cr-h3">Application sent!</h2>
                    <p>
                      Thanks, {f.name.split(' ')[0]}. We’ll check out your
                      channel and get back to you at {f.email}. You can also
                      follow up in the chat bubble on Duoly.
                    </p>
                  </div>
                ) : this.props.closed ? (
                  <ClosedNotice
                    title="Creator applications open soon"
                    text="Send us your channel link by email or in Discord and we’ll get back to you."
                  />
                ) : (
                  <form onSubmit={this.apply} noValidate>
                    <div className="ct-grid">
                      <label className="ct-field">
                        <span>Your name</span>
                        <input
                          type="text"
                          value={f.name}
                          onChange={this.setF('name')}
                          autoComplete="name"
                          maxLength={60}
                          placeholder="Alex"
                          aria-invalid={s.field === 'name' ? 'true' : 'false'}
                        />
                      </label>
                      <label className="ct-field">
                        <span>Email</span>
                        <input
                          type="email"
                          value={f.email}
                          onChange={this.setF('email')}
                          autoComplete="email"
                          maxLength={120}
                          placeholder="you@example.com"
                          aria-invalid={s.field === 'email' ? 'true' : 'false'}
                        />
                      </label>
                    </div>
                    <fieldset className="ct-topics">
                      <legend>Where do you create?</legend>
                      <div>
                        {PLATFORMS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={
                              'ct-topic' + (f.platform === p ? ' on' : '')
                            }
                            aria-pressed={f.platform === p ? 'true' : 'false'}
                            onClick={this.pickF('platform', p)}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="ct-grid">
                      <label className="ct-field wide">
                        <span>Channel link</span>
                        <input
                          type="url"
                          value={f.channel}
                          onChange={this.setF('channel')}
                          maxLength={160}
                          placeholder="twitch.tv/yourname"
                          aria-invalid={
                            s.field === 'channel' ? 'true' : 'false'
                          }
                        />
                      </label>
                    </div>
                    <fieldset className="ct-topics">
                      <legend>Audience size</legend>
                      <div>
                        {SIZES.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={'ct-topic' + (f.size === p ? ' on' : '')}
                            aria-pressed={f.size === p ? 'true' : 'false'}
                            onClick={this.pickF('size', p)}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="ct-grid">
                      <label className="ct-field wide">
                        <span>Main game</span>
                        <span className="cr-games">
                          {GAMES.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              title={g.name}
                              aria-label={g.name}
                              aria-pressed={f.game === g.id ? 'true' : 'false'}
                              onClick={this.pickF('game', g.id)}
                              className={
                                'cr-game-pick' + (f.game === g.id ? ' on' : '')
                              }
                            >
                              <img src={g.img} alt="" />
                            </button>
                          ))}
                        </span>
                      </label>
                      <label className="ct-field wide">
                        <span>
                          Anything else? <em>· optional</em>
                        </span>
                        <textarea
                          value={f.message}
                          onChange={this.setF('message')}
                          rows={3}
                          maxLength={1200}
                          placeholder="Stream schedule, content ideas, past brand deals…"
                        />
                      </label>
                      <input
                        type="text"
                        name="website"
                        value={f.website}
                        onChange={this.setF('website')}
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        className="ct-hp"
                      />
                    </div>
                    {s.error ? (
                      <div className="ct-error" role="alert">
                        {s.error}
                      </div>
                    ) : null}
                    <button
                      type="submit"
                      className="lg-btn big cr-submit"
                      disabled={s.sending}
                    >
                      {s.sending ? (
                        <span className="ct-spin" aria-hidden="true" />
                      ) : null}
                      {s.sending ? 'Sending…' : 'Send application'}
                      {s.sending ? null : (
                        <Icon name="arrow" size={17} stroke={2.4} />
                      )}
                    </button>
                    <p className="ct-fine">
                      We use your details only to review your application.{' '}
                      <a href="/privacy">Privacy Policy</a>
                    </p>
                  </form>
                )}
              </div>
            </div>
          </section>
        </main>
        {this.props.chrome === false ? null : <LegalFooter />}
        <SupportChat csrf={this.props.csrf} />
      </div>
    );
  }
}
