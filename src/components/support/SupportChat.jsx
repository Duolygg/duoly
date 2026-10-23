'use client';

import React from 'react';
import { newChatPing, playChatPing } from '../../design-reference/lib/sounds';
import { createSupportFetch } from './support-data';

// The support chat (Sparky + the real admins). Talks to /api/support, which knows who's asking:
// guests, customers (their order and wallet) and teammates (payouts, deposit, games). When someone asks
// for a human, admins answer from the admin dashboard (Support chat) with their own name and picture.
// Props: teaser (show the little "Need a hand?" bubble), bottom (px from the bottom, default 24)
const MASCOT = '/assets/brand/logo-mascots.webp';
const POLL_OPEN = 3000;   // while the panel is open and a human is involved
const POLL_CLOSED = 12000; // panel closed: only to show an unread badge when the team replies

export default class SupportChat extends React.Component {
  constructor(props) {
    super(props);
    this.fetch = createSupportFetch({ csrf: props.csrf });
    this.state = { open: false, teaser: !!props.teaser, data: null, draft: '', sending: false, unread: 0, error: '' };
    this.listRef = React.createRef();
    this.inputRef = React.createRef();
  }
  componentDidMount() {
    this.ping = newChatPing();
    this.load();
    this.schedule();
    // other parts of the page can open the chat: window.dispatchEvent(new Event('duoly:chat')) (e.g. /contact)
    window.addEventListener('duoly:chat', this.openFromPage);
  }
  componentWillUnmount() { clearTimeout(this._t); window.removeEventListener('duoly:chat', this.openFromPage); }
  openFromPage = async () => {
    await this.load();
    if (!this.state.open) this.toggle();
  };
  schedule() {
    clearTimeout(this._t);
    const c = this.state.data && this.state.data.conversation;
    const human = c && (c.status === 'waiting' || c.status === 'open');
    if (!human && !this.state.open) return; // nothing to watch
    this._t = setTimeout(async () => { await this.load(); this.schedule(); }, this.state.open && human ? POLL_OPEN : POLL_CLOSED);
  }
  async load() {
    try {
      const r = await this.fetch('/api/support', { cache: 'no-store' });
      if (!r.ok) return;
      this.take(await r.json());
    } catch (e) {}
  }
  // new data from the server: count new team messages (sound + badge when closed)
  take(d) {
    const before = this.state.data && this.state.data.conversation ? this.state.data.conversation.messages.length : 0;
    const msgs = d.conversation ? d.conversation.messages : [];
    const fresh = this.state.data ? msgs.slice(before).filter((m) => m.from === 'admin') : [];
    if (fresh.length) playChatPing(this.ping);
    this.setState((s) => ({ data: d, unread: s.open ? 0 : s.unread + fresh.length }), () => this.toBottom());
  }
  toBottom() {
    const el = this.listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }
  toggle = () => {
    const open = !this.state.open;
    this.setState({ open, teaser: false, unread: 0 }, () => {
      this.schedule();
      if (open) { this.toBottom(); setTimeout(() => this.inputRef.current && this.inputRef.current.focus(), 50); }
    });
  };
  async send(body) {
    if (this.state.sending) return;
    const text = body.text != null ? String(body.text).trim() : '';
    if (body.text != null && !text) return;
    // show the message right away, then the server's answer
    const d = this.state.data || {};
    const c = d.conversation || { status: 'bot', messages: [{ id: 'g', from: 'bot', text: d.greeting || '', at: Date.now() }] };
    const optimistic = text ? { ...d, suggest: null, conversation: { ...c, messages: c.messages.concat([{ id: 'tmp', from: 'me-pending', text, at: Date.now() }]) } } : d;
    this.setState({ data: optimistic, draft: '', sending: true, error: '' }, () => this.toBottom());
    const started = Date.now();
    try {
      const r = await this.fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { this.setState({ sending: false, error: j.error || 'Couldn’t send that. Try again.', data: d, draft: text }); return; }
      // a short "typing" moment so Sparky doesn't feel like a vending machine
      const wait = Math.max(0, 650 - (Date.now() - started));
      setTimeout(() => { this.setState({ sending: false }); this.take(j); this.schedule(); }, wait);
    } catch (e) {
      this.setState({ sending: false, error: 'You seem to be offline. Try again.', data: d, draft: text });
    }
  }

  render() {
    const s = this.state;
    const d = s.data || {};
    const c = d.conversation;
    const team = d.team || [];
    const online = team.filter((a) => a.online);
    const bottom = this.props.bottom || 24;
    const agent = c && c.status === 'open' && c.agent ? c.agent : null;
    const msgs = c ? c.messages : (d.greeting ? [{ id: 'g', from: 'bot', text: d.greeting, at: 0 }] : []);
    const chips = !c ? (d.chips || []) : (c.status === 'bot' && !s.sending ? (d.suggest || []) : []);
    const avatar = (img, size, round) => <img src={img || '/assets/avatars/avatar-1.png'} alt="" width={size} height={size} referrerPolicy="no-referrer" style={{ width: size + 'px', height: size + 'px', borderRadius: round ? '50%' : '9px', objectFit: "cover", flex: "0 0 auto" }} />;
    const bot = <span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "9px", background: "#1B1033", display: "flex", alignItems: "center", justifyContent: "center" }}><img src={MASCOT} alt="" width="24" height="15" style={{ width: "24px", height: "15px" }} /></span>;
    const status = !c || c.status === 'bot' ? 'Sparky can make mistakes · say “human” anytime'
      : c.status === 'waiting' ? 'Waiting for the team · their replies show up right here'
        : c.status === 'open' ? 'You’re chatting with ' + (agent ? agent.name : 'the team') + ' from Duoly'
          : 'Chat closed · write to start a new one';

    return (
      <>
        {s.open ? (
          <section role="dialog" aria-label="Duoly support chat" style={{ position: "fixed", right: "24px", bottom: (bottom + 76) + "px", zIndex: "40", width: "384px", maxWidth: "calc(100vw - 32px)", height: "600px", maxHeight: "calc(100vh - " + (bottom + 116) + "px)", display: "flex", flexDirection: "column", borderRadius: "26px", overflow: "hidden", background: "#0F0A1C", border: "1px solid rgba(214, 187, 255, .18)", boxShadow: "0 30px 90px rgba(0, 0, 0, .65)", animation: "dlpop .22s ease-out", transformOrigin: "bottom right" }}>
            <header style={{ padding: "16px 16px 14px", background: "radial-gradient(120% 100% at 0% 0%, rgba(214, 187, 255, .16), transparent 60%), #1B1033", borderBottom: "1px solid rgba(214, 187, 255, .12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {agent ? (
                  <span style={{ position: "relative", flex: "0 0 auto" }}>
                    {avatar(agent.image, 46, true)}
                    <span style={{ position: "absolute", right: "0", bottom: "0", width: "12px", height: "12px", borderRadius: "50%", background: "#5EEAA8" }} />
                  </span>
                ) : (
                  <span style={{ flex: "0 0 auto", width: "46px", height: "46px", borderRadius: "15px", background: "#090414", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={MASCOT} alt="" width="40" height="25" style={{ width: "40px", height: "25px" }} />
                  </span>
                )}
                <div style={{ flex: "1", minWidth: "0", lineHeight: "1.3" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", color: "#FFFFFF" }}>
                    {agent ? agent.name : 'Sparky'}
                    <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", padding: "2px 6px", borderRadius: "6px", background: agent ? "rgba(94, 234, 168, .16)" : "#D6BBFF", color: agent ? "#5EEAA8" : "#17092E" }}>{agent ? 'TEAM' : 'AI'}</span>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#A79DC4" }}>
                    {agent ? 'Duoly support · replies here' : d.role === 'teammate' ? 'Teammate support · answers instantly' : 'Answers instantly · humans on standby'}
                  </div>
                </div>
                {c && c.status !== 'closed' ? (
                  <button type="button" onClick={() => this.send({ action: 'close' })} title="End this chat" style={{ flex: "0 0 auto", height: "32px", padding: "0 10px", borderRadius: "10px", border: "none", background: "rgba(196, 170, 255, .1)", color: "#CFC4EA", fontSize: "12.5px", fontWeight: "600", transform: "none" }}>End chat</button>
                ) : null}
                <button type="button" aria-label="Minimize chat" onClick={this.toggle} style={{ flex: "0 0 auto", width: "34px", height: "34px", borderRadius: "11px", border: "none", background: "rgba(196, 170, 255, .1)", color: "#CFC4EA", display: "flex", alignItems: "center", justifyContent: "center", transform: "none" }}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              </div>
              {/* the real admins */}
              {team.length ? (
                <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "#A79DC4" }}>
                  <span style={{ display: "flex", gap: "4px" }}>
                    {team.slice(0, 4).map((a) => (
                      <span key={a.id} title={a.name + (a.online ? ' · online' : ' · away')} style={{ position: "relative", display: "flex" }}>
                        {avatar(a.image, 24, true)}
                        {a.online ? <span style={{ position: "absolute", right: "-1px", bottom: "-1px", width: "8px", height: "8px", borderRadius: "50%", background: "#5EEAA8" }} /> : null}
                      </span>
                    ))}
                  </span>
                  {online.length
                    ? online.slice(0, 3).map((a) => a.name).join(', ').replace(/, ([^,]*)$/, ' and $1') + (online.length === 1 ? ' is' : ' are') + ' online'
                    : 'The team is away · Sparky answers 24/7'}
                </div>
              ) : null}
            </header>

            <div ref={this.listRef} className="dl-scroll" style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {msgs.map((m) => {
                if (m.from === 'system') return <div key={m.id} style={{ alignSelf: "center", maxWidth: "90%", fontSize: "12px", color: "#8E84AB", textAlign: "center", padding: "2px 8px" }}>{m.text}</div>;
                const mine = m.from === 'user' || m.from === 'me-pending';
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "flex-end", gap: "8px", justifyContent: mine ? "flex-end" : "flex-start" }}>
                    {!mine ? (m.from === 'admin' ? avatar(m.by && m.by.image, 28, true) : bot) : null}
                    <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", gap: "3px" }}>
                      {m.from === 'admin' ? <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#5EEAA8", paddingLeft: "4px" }}>{m.by ? m.by.name : 'Duoly team'}</span> : null}
                      <div style={{ padding: "10px 14px", fontSize: "14px", lineHeight: "1.5", whiteSpace: "pre-wrap", overflowWrap: "anywhere", opacity: m.from === 'me-pending' ? ".7" : "1",
                        borderRadius: mine ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                        background: mine ? "#D6BBFF" : m.from === 'admin' ? "rgba(94, 234, 168, .1)" : "#1B1033",
                        border: m.from === 'admin' ? "1px solid rgba(94, 234, 168, .25)" : "none",
                        color: mine ? "#17092E" : "#F3EEFF", fontWeight: mine ? "500" : "400" }}>
                        {m.text}
                      </div>
                    </div>
                  </div>
                );
              })}
              {s.sending && (!c || c.status === 'bot') ? (
                <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
                  {bot}
                  <div style={{ display: "flex", gap: "4px", padding: "14px 16px", borderRadius: "18px 18px 18px 6px", background: "#1B1033" }}>
                    {[0, 0.2, 0.4].map((d0) => <span key={d0} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#D6BBFF", animation: "dlpulse 1s ease-in-out " + d0 + "s infinite" }} />)}
                  </div>
                </div>
              ) : null}
              {chips.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingLeft: "36px" }}>
                  {chips.map((label) => (
                    <button key={label} type="button" onClick={() => this.send(/human|admin/i.test(label) ? { text: label, action: 'human' } : { text: label, chip: true })} style={{ minHeight: "34px", padding: "0 12px", borderRadius: "999px", border: "1px solid rgba(214, 187, 255, .3)", background: "transparent", color: "#D6BBFF", fontSize: "13px", fontWeight: "600", transform: "none" }}>
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); this.send({ text: s.draft }); }} style={{ padding: "12px", borderTop: "1px solid rgba(196, 170, 255, .1)", background: "#0F0A1C" }}>
              {s.error ? <div role="alert" style={{ marginBottom: "8px", fontSize: "12.5px", color: "#FF8A9B" }}>{s.error}</div> : null}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 6px 6px 14px", borderRadius: "16px", background: "#1A1230", border: "1px solid rgba(196, 170, 255, .14)" }}>
                <label htmlFor="dl-support-input" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>Message</label>
                <input ref={this.inputRef} id="dl-support-input" type="text" value={s.draft} maxLength={500} onChange={(e) => this.setState({ draft: e.target.value })} placeholder={agent ? 'Write to ' + agent.name + '…' : 'Ask anything…'} autoComplete="off" style={{ flex: "1", minWidth: "0", minHeight: "40px", border: "none", outline: "none", background: "transparent", color: "#FFFFFF", fontFamily: "inherit", fontSize: "14.5px" }} />
                <button type="submit" aria-label="Send message" disabled={!s.draft.trim() || s.sending} style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "12px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", transform: "none", background: s.draft.trim() ? "#D6BBFF" : "rgba(196, 170, 255, .1)", color: s.draft.trim() ? "#17092E" : "#6A6086" }}>
                  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
                </button>
              </div>
              <div style={{ marginTop: "8px", textAlign: "center", fontSize: "11px", color: "#6A6086" }}>{status}</div>
            </form>
          </section>
        ) : null}

        {s.teaser && !s.open ? (
          <div style={{ position: "fixed", right: "24px", bottom: (bottom + 76) + "px", zIndex: "39", display: "flex", alignItems: "center", gap: "10px", padding: "10px 8px 10px 14px", borderRadius: "16px 16px 4px 16px", background: "#F3EEFF", color: "#17092E", boxShadow: "0 16px 40px rgba(0, 0, 0, .45)", animation: "dlpop .3s ease-out", fontSize: "13.5px", fontWeight: "600" }}>
            Need a hand? Sparky answers in seconds.
            <button type="button" aria-label="Dismiss" onClick={() => this.setState({ teaser: false })} style={{ width: "26px", height: "26px", borderRadius: "8px", border: "none", background: "rgba(23, 9, 46, .08)", color: "#17092E", display: "flex", alignItems: "center", justifyContent: "center", transform: "none" }}>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        ) : null}

        <button type="button" aria-label={s.open ? 'Close support chat' : 'Open support chat' + (s.unread ? ' (' + s.unread + ' new)' : '')} onClick={this.toggle} style={{ position: "fixed", right: "24px", bottom: bottom + "px", zIndex: "41", width: "64px", height: "64px", borderRadius: "22px", border: "1px solid rgba(214, 187, 255, .3)", background: "#1B1033", boxShadow: "0 18px 44px rgba(124, 58, 237, .45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0" }}>
          {s.open ? (
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D6BBFF" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          ) : (
            <>
              <img src={MASCOT} alt="" width="52" height="33" style={{ width: "52px", height: "33px" }} />
              {s.unread ? (
                <span style={{ position: "absolute", top: "-5px", right: "-5px", minWidth: "20px", height: "20px", padding: "0 5px", boxSizing: "border-box", borderRadius: "999px", background: "#F0A6FF", color: "#17092E", fontSize: "11.5px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>{s.unread}</span>
              ) : null}
            </>
          )}
        </button>
      </>
    );
  }
}
