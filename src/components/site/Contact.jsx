// Live port of src/design-reference/components/Contact.jsx (Fabian's original): real fetch and the
// real Sparky widget instead of the design-preview transport. Keep layout and copy in sync with the original.
'use client';

import React from 'react';
import ClosedNotice from '../../design-reference/components/ClosedNotice.jsx';
import SupportChat from '../support/SupportChat';
import { LegalHeader, LegalFooter, Icon } from './LegalPage.jsx';
import { SITE } from '../../design-reference/lib/site';

// /contact: the real team (who's online), live chat, quick routes, and a form that lands in the support
// inbox (app/api/contact). Styles: .lg-* / .ct-* in app/globals.css.
const TOPICS = [
  ['order', 'Order help'],
  ['payment', 'Payments & refunds'],
  ['teammate', 'Becoming a teammate'],
  ['privacy', 'Privacy & data'],
  ['business', 'Business & partnerships'],
  ['other', 'Something else'],
];
const HINT = {
  order:
    'Got an open order? The chat in your order room reaches your teammate and us fastest.',
  teammate: 'Want to play for Duoly? The application takes about 3 minutes.',
  privacy:
    'Ask for a copy of your data, a correction or account deletion. We reply within one month at the latest.',
};
const avatar = (src) => src || '/assets/avatars/avatar-1.png';

export default class Contact extends React.Component {
  constructor(props) {
    super(props);
    const me = props.me || {};
    this.state = {
      name: me.name || '',
      email: me.email || '',
      topic: TOPICS.some((t) => t[0] === props.topic) ? props.topic : 'order',
      order: props.order || '',
      message: '',
      website: '',
      sending: false,
      error: '',
      field: '',
      sent: false,
    };
  }
  openChat = () => window.dispatchEvent(new Event('duoly:chat'));
  set = (k) => (e) =>
    this.setState({ [k]: e.target.value, error: '', field: '' });
  send = async (e) => {
    e.preventDefault();
    if (this.state.sending) return;
    this.setState({ sending: true, error: '', field: '' });
    const s = this.state;
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf: this.props.csrf,
          name: s.name,
          email: s.email,
          topic: s.topic,
          order: s.order,
          message: s.message,
          website: s.website,
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
      window.scrollTo({
        top: document.getElementById('ct-form').offsetTop - 90,
        behavior: 'smooth',
      });
    } catch (err) {
      this.setState({
        sending: false,
        error:
          'Can’t reach Duoly right now. Check your connection and try again.',
      });
    }
  };

  renderTeam() {
    const team = this.props.team || [];
    const online = team.filter((a) => a.online);
    const names = online.map((a) => a.name);
    const line = online.length
      ? names.slice(0, 2).join(' and ') +
        (names.length > 2 ? ' +' + (names.length - 2) : '') +
        (online.length === 1 ? ' is' : ' are') +
        ' online now'
      : 'The team is offline right now';
    return (
      <div className="ct-team">
        <span className="ct-avatars">
          {team.slice(0, 4).map((a) => (
            <span key={a.id} className="ct-av">
              <img
                src={avatar(a.image)}
                alt={a.name}
                referrerPolicy="no-referrer"
              />
              {a.online ? <span className="ct-av-dot" /> : null}
            </span>
          ))}
        </span>
        <span className="ct-team-text">
          <strong>{line}</strong>
          <span>
            {online.length
              ? 'Replies usually come within a few minutes.'
              : 'Leave a message and we’ll answer ' +
                (SITE.replyTime.indexOf('24') >= 0
                  ? 'within 24 hours'
                  : 'soon') +
                '.'}
          </span>
        </span>
      </div>
    );
  }

  render() {
    const s = this.state;
    const hint = HINT[s.topic];
    const needsOrder = s.topic === 'order' || s.topic === 'payment';
    const cards = [
      {
        icon: 'chat',
        title: 'Live chat',
        text: 'Sparky answers instantly, and a real person takes over whenever you need one.',
        cta: 'Open chat',
        onClick: this.openChat,
        main: true,
      },
      {
        icon: 'doc',
        title: 'Problem with an order?',
        text: 'Open your order room from the dashboard to chat with your teammate or report something.',
        cta: 'Go to my orders',
        href: '/dashboard',
      },
      SITE.discordInvite
        ? {
            icon: 'discord',
            title: 'Join our Discord',
            text: 'News, giveaways and a community of players looking for a duo.',
            cta: 'Join the server',
            href: SITE.discordInvite,
            ext: true,
          }
        : {
            icon: 'shield',
            title: 'Become a teammate',
            text: 'High rank and good vibes? Apply in about three minutes and start earning.',
            cta: 'Apply now',
            href: '/apply',
          },
    ];
    if (SITE.supportEmail)
      cards.push({
        icon: 'mail',
        title: 'Email us',
        text:
          'Prefer email? Write to us and we’ll answer ' + SITE.replyTime + '.',
        cta: SITE.supportEmail,
        href: 'mailto:' + SITE.supportEmail,
      });
    const legal = [
      SITE.company || SITE.name,
      SITE.owner,
      SITE.address || SITE.city,
      SITE.register,
      SITE.vat ? 'VAT ID ' + SITE.vat : '',
      SITE.supportEmail,
    ].filter(Boolean);

    return (
      <div className="lg-page">
        {this.props.chrome === false ? null : <LegalHeader active="contact" />}
        <main>
          <section className="lg-hero ct-hero">
            <div className="lg-hero-in">
              <span className="lg-kicker">
                <span className="lg-kicker-dot" />
                Contact · Real people, no ticket maze
              </span>
              <h1 className="lg-h1">
                Talk to the team
                <br />
                <span className="lg-grad">behind Duoly.</span>
              </h1>
              <p className="lg-intro">
                Questions about an order, a payment, becoming a teammate or your
                data: we read every message ourselves, from Vienna.
              </p>
              {this.renderTeam()}
            </div>
          </section>

          <section className="ct-wrap" aria-label="Ways to reach us">
            <div className={'ct-cards' + (cards.length > 3 ? ' four' : '')}>
              {cards.map((c) => {
                const inner = (
                  <>
                    <span className="ct-card-icon">
                      <Icon name={c.icon} size={22} />
                    </span>
                    <strong>{c.title}</strong>
                    <span className="ct-card-text">{c.text}</span>
                    <span className="ct-card-cta">
                      {c.cta} <Icon name="arrow" size={15} stroke={2.4} />
                    </span>
                  </>
                );
                return c.onClick ? (
                  <button
                    key={c.title}
                    type="button"
                    onClick={c.onClick}
                    className={'ct-card' + (c.main ? ' main' : '')}
                  >
                    {inner}
                  </button>
                ) : (
                  <a
                    key={c.title}
                    href={c.href}
                    className="ct-card"
                    {...(c.ext
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {inner}
                  </a>
                );
              })}
            </div>
          </section>

          <section
            id="ct-form"
            className="ct-wrap ct-main"
            aria-labelledby="ct-form-h"
          >
            <div data-private-block="" className="ct-form-card">
              {s.sent ? (
                <div className="ct-sent" role="status">
                  <span className="ct-sent-icon">
                    <Icon name="check" size={30} stroke={3} />
                  </span>
                  <h2>Message sent!</h2>
                  <p>
                    Thanks, {s.name.split(' ')[0]}. Your message is with the
                    team. We’ll answer in your support chat on this site, and we
                    have your email ({s.email}) if you’re not around.
                  </p>
                  <div className="ct-sent-actions">
                    <button
                      type="button"
                      className="lg-btn"
                      onClick={this.openChat}
                    >
                      Open the chat <Icon name="arrow" size={16} stroke={2.4} />
                    </button>
                    <button
                      type="button"
                      className="lg-btn ghost"
                      onClick={() =>
                        this.setState({ sent: false, message: '', order: '' })
                      }
                    >
                      Send another
                    </button>
                  </div>
                </div>
              ) : this.props.closed ? (
                <ClosedNotice
                  title="Talk to us"
                  text="The contact form is being connected. Until then, email us or ask in our Discord. We usually reply within a few hours."
                />
              ) : (
                <form onSubmit={this.send} noValidate>
                  <h2 id="ct-form-h">Send us a message</h2>
                  <p className="ct-sub">
                    Usually answered within minutes while we’re online, always
                    within 24 hours.
                  </p>

                  <fieldset className="ct-topics">
                    <legend>What’s it about?</legend>
                    <div>
                      {TOPICS.map(([id, label]) => (
                        <label
                          key={id}
                          className={'ct-topic' + (s.topic === id ? ' on' : '')}
                        >
                          <input
                            type="radio"
                            name="topic"
                            value={id}
                            checked={s.topic === id}
                            onChange={this.set('topic')}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {hint ? (
                    <div className="ct-hint">
                      <span>{hint}</span>
                      {s.topic === 'order' ? (
                        <a href="/dashboard">My orders</a>
                      ) : s.topic === 'teammate' ? (
                        <a href="/apply">Apply</a>
                      ) : (
                        <a href="/privacy">Privacy Policy</a>
                      )}
                    </div>
                  ) : null}

                  <div className="ct-grid">
                    <label className="ct-field">
                      <span>Your name</span>
                      <input
                        type="text"
                        value={s.name}
                        onChange={this.set('name')}
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
                        value={s.email}
                        onChange={this.set('email')}
                        autoComplete="email"
                        maxLength={120}
                        placeholder="you@example.com"
                        aria-invalid={s.field === 'email' ? 'true' : 'false'}
                      />
                    </label>
                    {needsOrder ? (
                      <label className="ct-field wide">
                        <span>
                          Order number <em>· optional</em>
                        </span>
                        <input
                          type="text"
                          value={s.order}
                          onChange={this.set('order')}
                          maxLength={20}
                          placeholder="DL-48403"
                        />
                      </label>
                    ) : null}
                    <label className="ct-field wide">
                      <span>Message</span>
                      <textarea
                        value={s.message}
                        onChange={this.set('message')}
                        rows={6}
                        maxLength={2000}
                        placeholder="Tell us what happened or what you’d like to know…"
                        aria-invalid={s.field === 'message' ? 'true' : 'false'}
                      />
                      <em className="ct-count">{s.message.length} / 2000</em>
                    </label>
                    {/* honeypot: hidden from people, bots fill it */}
                    <input
                      type="text"
                      name="website"
                      value={s.website}
                      onChange={this.set('website')}
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
                    className="lg-btn big"
                    disabled={s.sending}
                  >
                    {s.sending ? (
                      <span className="ct-spin" aria-hidden="true" />
                    ) : null}
                    {s.sending ? 'Sending…' : 'Send message'}
                    {s.sending ? null : (
                      <Icon name="arrow" size={17} stroke={2.4} />
                    )}
                  </button>
                  <p className="ct-fine">
                    By sending this you agree that we use your details to answer
                    you, as described in our{' '}
                    <a href="/privacy">Privacy Policy</a>.
                  </p>
                </form>
              )}
            </div>

            <aside className="ct-side">
              <div className="ct-side-card">
                <h3>What happens next</h3>
                <ol className="ct-steps">
                  <li>
                    <span>1</span>
                    <div>
                      <strong>It lands in our inbox</strong>The team gets a ping
                      right away, wherever we are.
                    </div>
                  </li>
                  <li>
                    <span>2</span>
                    <div>
                      <strong>A real person answers</strong>Not a bot, not a
                      ticket number. Usually within minutes.
                    </div>
                  </li>
                  <li>
                    <span>3</span>
                    <div>
                      <strong>You get the reply here</strong>In the chat bubble
                      on Duoly, and by email if you’ve gone.
                    </div>
                  </li>
                </ol>
              </div>
              <div className="ct-side-card">
                <h3>Good to know</h3>
                <a className="ct-link" href="/#faq">
                  <span>Frequently asked questions</span>
                  <Icon name="arrow" size={15} stroke={2.4} />
                </a>
                <a className="ct-link" href="/terms#cancel">
                  <span>Cancellations & refunds</span>
                  <Icon name="arrow" size={15} stroke={2.4} />
                </a>
                <a className="ct-link" href="/privacy#rights">
                  <span>Your data rights</span>
                  <Icon name="arrow" size={15} stroke={2.4} />
                </a>
              </div>
              <div className="ct-side-card ct-imprint">
                <h3>Legal notice</h3>
                {legal.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </aside>
          </section>
        </main>
        {this.props.chrome === false ? null : <LegalFooter />}
        <SupportChat csrf={this.props.csrf} />
      </div>
    );
  }
}
