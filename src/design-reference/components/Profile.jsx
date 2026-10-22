'use client';

import { previewFetch as fetch } from '../../design-preview/preview-transport';


import React from 'react';
import { COUNTRIES, COUNTRY_NAME, flagSrc } from '../lib/countries';

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const GREEN = '#5EEAA8';
const PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => '/assets/avatars/avatar-' + n + '.png');
const ROLE = {
  customer: { label: 'Customer', back: 'Back to dashboard' },
  teammate: { label: 'Teammate', back: 'Back to orders' },
  admin: { label: 'Admin', back: 'Back to admin' }
};
const PROVIDER = { email: 'email code', discord: 'Discord', google: 'Google', password: 'email and password' };

// Crops a picked image to a centred square and shrinks it to 256×256, so uploads stay small (~20 KB).
async function toAvatar(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Pick a picture (JPG, PNG or WebP).');
  if (file.size > 15 * 1024 * 1024) throw new Error('That picture is over 15 MB. Try a smaller one.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That picture couldn’t be opened. Try a JPG or PNG.'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    let out = c.toDataURL('image/webp', 0.86);
    if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/jpeg', 0.88);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Profile settings for every role: picture, name, country; teammates also write a bio and pick languages.
export default class Profile extends React.Component {
  constructor(props) {
    super(props);
    const u = props.user;
    const saved = {
      name: u.name || '',
      // '' means "use the Discord / Google picture"
      image: u.image && u.image !== u.providerImage ? u.image : '',
      country: props.profile.country || '',
      bio: props.profile.bio || '',
      languages: props.profile.languages || []
    };
    this.state = { saved, ...saved, upload: '', saving: false, error: '', done: false, query: '', open: false, hi: 0, drag: false };
    this.fileRef = React.createRef();
    this.searchRef = React.createRef();
  }

  componentDidMount() {
    // the ?discord=… result from connecting is shown once; don't keep it in the address bar
    if (this.props.discordResult) window.history.replaceState(null, '', '/profile');
  }
  componentWillUnmount() { clearTimeout(this._doneT); }

  dirty() {
    const s = this.state, o = s.saved;
    return !!s.upload || s.name.trim() !== o.name || s.image !== o.image || s.country !== o.country || s.bio !== o.bio ||
      s.languages.join() !== o.languages.join();
  }

  async pickFile(file) {
    if (this.props.accountOnly) return this.setState({ error: 'Uploads are not available yet. Choose an avatar below.' });
    this.setState({ error: '' });
    try {
      const upload = await toAvatar(file);
      this.setState({ upload });
    } catch (e) {
      this.setState({ error: e.message });
    }
  }

  async save() {
    const s = this.state;
    if (s.name.trim().length < 2) return this.setState({ error: 'Your name needs at least 2 characters.' });
    this.setState({ saving: true, error: '' });
    const body = { name: s.name.trim(), country: s.country };
    if (s.upload) body.upload = s.upload; else body.image = s.image;
    if (!this.props.accountOnly && this.props.user.role === 'teammate') { body.bio = s.bio; body.languages = s.languages; }
    try {
      const res = this.props.onSave ? await this.props.onSave(body) : await fetch('/api/me/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return this.setState({ saving: false, error: data.error || 'Couldn’t save. Please try again.' });
      const p = data.profile || {};
      const saved = { name: p.name || body.name, image: p.image || '', country: p.country || '', bio: p.bio || '', languages: p.languages || [] };
      this.setState({ saved, ...saved, upload: '', saving: false, done: true });
      clearTimeout(this._doneT);
      this._doneT = setTimeout(() => this.setState({ done: false }), 2600);
    } catch (e) {
      this.setState({ saving: false, error: 'You seem to be offline. Please try again.' });
    }
  }

  discard() {
    this.setState({ ...this.state.saved, upload: '', error: '' });
  }

  async unlinkDiscord() {
    this.setState({ dcBusy: true, dcNote: '' });
    try {
      const res = await fetch('/api/discord/unlink', {
        method: 'POST', credentials: 'same-origin', redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf: this.props.csrf })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        this.setState({ dcBusy: false, dcNote: data.error || 'Couldn’t disconnect. Please try again.' });
        return;
      }
      this.setState({ dcBusy: false, discord: null, dcNote: this.props.user.role === 'admin' ? 'Disconnected. The bot removes your Online role in a few seconds.' : 'Disconnected. The bot removes your server roles in a few seconds, and you need to connect again before you can take orders.' });
    } catch (e) {
      this.setState({ dcBusy: false, dcNote: 'Couldn’t disconnect. Please try again.' });
    }
  }

  renderDiscord(card, h2, help, ghost) {
    const s = this.state;
    const d = s.discord === undefined ? this.props.discord : s.discord;
    const RESULT = {
      linked: ['Discord connected. Your roles in the Duoly server now follow what you do here.', GREEN],
      cancelled: ['You cancelled on Discord. Nothing was connected.', '#A79DC4'],
      taken: ['That Discord account is already connected to another Duoly account.', '#FF8A9B'],
      failed: ['Connecting didn’t work. Please try again.', '#FF8A9B'],
      unavailable: ['Discord isn’t set up on this site yet.', '#FF8A9B']
    };
    const note = s.dcNote ? [s.dcNote, '#A79DC4'] : RESULT[this.props.discordResult];
    const discordBtn = { ...ghost, border: "none", background: "#5865F2", color: "#FFFFFF" };
    return (
      <section aria-labelledby="pf-dc" style={card}>
        <h2 id="pf-dc" style={h2}>Discord</h2>
        {this.props.user.role === 'admin' ? (
          <p style={help}>Connect your Discord so the bot shows you as <strong style={{ color: "#F3EEFF" }}>Online</strong> in the Duoly server while the admin panel is open.</p>
        ) : (
          <p style={help}>Needed to take orders. In the Duoly server the bot gives you the <strong style={{ color: "#F3EEFF" }}>Teammate</strong> role, shows you as <strong style={{ color: "#F3EEFF" }}>Online</strong> while your dashboard toggle is on, and <strong style={{ color: "#F3EEFF" }}>In Session</strong> while you play an order.</p>
        )}
        <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          {d ? (
            <>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "10px", minHeight: "42px", padding: "0 14px", borderRadius: "12px", background: "rgba(88, 101, 242, .14)", border: "1px solid rgba(88, 101, 242, .4)", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#8B95FF" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.7 19.7 0 0 0 6 3l1.3-2a12.8 12.8 0 0 1-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.6 19.6 0 0 0 6-3c.5-5.1-.8-9.5-3.6-13.6zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" /></svg>
                Connected{d.username ? ' as ' + d.username : ''}
              </span>
              {d.auto ? <span style={{ fontSize: "13px", color: "#8E84AB" }}>You sign in with Discord, so it’s connected automatically.</span> : (
                <button type="button" onClick={() => this.unlinkDiscord()} disabled={s.dcBusy} style={{ ...ghost, opacity: s.dcBusy ? ".6" : "1" }}>{s.dcBusy ? 'Disconnecting…' : 'Disconnect'}</button>
              )}
            </>
          ) : (
            this.props.csrf && this.props.discordEnabled ? (
              <form method="POST" action="/api/discord/link" style={{ margin: 0 }}>
                <input type="hidden" name="csrf" value={this.props.csrf} />
                <input type="hidden" name="next" value="profile" />
                <button type="submit" style={{ ...discordBtn, cursor: "pointer" }}>Connect Discord</button>
              </form>
            ) : (
              <a aria-disabled="true" role="link" title={this.props.csrf ? 'Discord isn’t set up on this site yet' : 'Unavailable in the design preview'} style={discordBtn}>Connect Discord</a>
            )
          )}
        </div>
        {note ? <p role="status" style={{ margin: "12px 0 0", fontSize: "13.5px", fontWeight: "600", color: note[1] }}>{note[0]}</p> : null}
        <p style={{ ...help, marginTop: "10px", fontSize: "12.5px" }}>You need to be a member of the Duoly Discord server for the roles to show up.</p>
      </section>
    );
  }

  // ---- country picker (combobox with search)
  matches() {
    const q = this.state.query.trim().toLowerCase();
    const list = q ? COUNTRIES.filter(([c, n]) => n.toLowerCase().includes(q) || c === q) : COUNTRIES;
    return list.slice(0, 80);
  }
  pickCountry(code) {
    this.setState({ country: code, open: false, query: '' });
  }
  onCountryKey(e) {
    const list = this.matches();
    if (e.key === 'ArrowDown') { e.preventDefault(); this.setState({ open: true, hi: Math.min(this.state.hi + 1, list.length - 1) }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.setState({ hi: Math.max(this.state.hi - 1, 0) }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (this.state.open && list[this.state.hi]) this.pickCountry(list[this.state.hi][0]); }
    else if (e.key === 'Escape') { this.setState({ open: false, query: '' }); }
  }

  render() {
    const s = this.state;
    const u = this.props.user;
    const role = ROLE[u.role] || ROLE.customer;
    const teammate = !this.props.accountOnly && u.role === 'teammate';
    const avatar = s.upload || s.image || u.providerImage || PRESETS[0];
    const custom = !!(s.upload || s.image);
    const dirty = this.dirty();
    const list = s.open ? this.matches() : [];
    const shownName = s.name.trim() || u.name;

    const card = { padding: "22px", borderRadius: "22px", background: "#120B22", border: "1px solid rgba(196, 170, 255, .08)" };
    const h2 = { margin: "0 0 4px", fontFamily: DISPLAY, fontSize: "19px", fontWeight: "700", letterSpacing: "-.02em", color: "#FFFFFF" };
    const help = { margin: "0", fontSize: "13.5px", color: "#8E84AB" };
    const label = { display: "block", marginBottom: "8px", fontSize: "13.5px", fontWeight: "600", color: "#F3EEFF" };
    const ghost = { display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "42px", padding: "0 16px", borderRadius: "12px", border: "1px solid rgba(214, 187, 255, .2)", background: "transparent", color: "#F3EEFF", fontSize: "14px", fontWeight: "600", textDecoration: "none" };

    return (
      <div style={{ minHeight: "100vh", background: "#090414", color: "#F3EEFF", fontFamily: "Geist, system-ui, sans-serif", fontSize: "15px", lineHeight: "1.5", paddingBottom: dirty ? "110px" : "48px" }}>
        <header style={{ position: "sticky", top: "0", zIndex: "6", background: "rgba(9, 4, 20, .8)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(196, 170, 255, .08)" }}>
          <div style={{ maxWidth: "1040px", margin: "0 auto", padding: "10px 24px", display: "flex", alignItems: "center", gap: "16px" }}>
            <a href="/" aria-label="Duoly home" style={{ display: "flex", alignItems: "center" }}>
              <img src="/assets/brand/logo-wordmark.webp" alt="Duoly" width="104" height="39" style={{ width: "104px", height: "39px", display: "block" }} />
            </a>
            <a href={this.props.home} style={{ ...ghost, marginLeft: "auto" }}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
              {role.back}
            </a>
          </div>
        </header>

        <main style={{ maxWidth: "1040px", margin: "0 auto", padding: "36px 24px 0" }}>
          <h1 style={{ margin: "0", fontFamily: DISPLAY, fontSize: "clamp(30px, 4vw, 40px)", fontWeight: "800", letterSpacing: "-.035em", lineHeight: "1.05", color: "#FFFFFF" }}>Your profile</h1>
          <p style={{ margin: "8px 0 0", color: "#8E84AB" }}>
            {teammate ? 'This is what customers see when you take their order.' : u.role === 'admin' ? 'This is how teammates and customers see you on Duoly.' : 'This is what your teammate sees when they take your order.'}
          </p>

          <div className="pf-grid" style={{ marginTop: "28px" }}>
            {/* live preview */}
            <aside className="pf-preview" style={{ ...card, padding: "0", overflow: "hidden" }}>
              <div style={{ height: "74px", background: "linear-gradient(120deg, rgba(214, 187, 255, .28), rgba(240, 166, 255, .14) 55%, rgba(158, 230, 255, .12))" }} />
              <div style={{ padding: "0 22px 22px", marginTop: "-40px" }}>
                <img src={avatar} alt="" width="80" height="80" referrerPolicy="no-referrer" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", display: "block", boxShadow: "0 0 0 4px #120B22" }} />
                <div style={{ marginTop: "12px", fontFamily: DISPLAY, fontSize: "21px", fontWeight: "700", letterSpacing: "-.02em", color: "#FFFFFF", overflowWrap: "anywhere" }}>{shownName}</div>
                <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", fontSize: "13.5px", color: "#A79DC4" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", padding: "2px 9px", borderRadius: "8px", background: "rgba(214, 187, 255, .12)", color: "#D6BBFF" }}>{role.label}</span>
                  {s.country ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <img src={flagSrc(s.country)} alt="" width="20" height="15" style={{ width: "20px", height: "15px", borderRadius: "3px", objectFit: "cover" }} />
                      {COUNTRY_NAME[s.country]}
                    </span>
                  ) : <span style={{ color: "#6A6086" }}>No country set</span>}
                </div>
                {teammate ? (
                  <>
                    <p style={{ margin: "14px 0 0", fontSize: "14px", lineHeight: "1.55", color: s.bio ? "#D9D1F0" : "#6A6086", overflowWrap: "anywhere" }}>
                      {s.bio || 'Your bio shows up here.'}
                    </p>
                    {s.languages.length ? (
                      <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {s.languages.map((l) => <span key={l} style={{ fontSize: "12px", fontWeight: "600", padding: "3px 9px", borderRadius: "8px", background: "rgba(94, 234, 168, .08)", color: GREEN }}>{l}</span>)}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </aside>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
              {/* picture */}
              <section aria-labelledby="pf-pic" style={card}>
                <h2 id="pf-pic" style={h2}>Profile picture</h2>
                <p style={help}>{this.props.accountOnly ? 'Choose one of the avatars below. Uploads are not available yet.' : 'JPG, PNG or WebP. We crop it to a square for you.'}</p>
                <div style={{ marginTop: "18px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "18px" }}>
                  <button
                    type="button" disabled={!!this.props.accountOnly} aria-label="Upload a new profile picture" onClick={() => this.fileRef.current && this.fileRef.current.click()}
                    onDragOver={(e) => { e.preventDefault(); if (!s.drag) this.setState({ drag: true }); }}
                    onDragLeave={() => this.setState({ drag: false })}
                    onDrop={(e) => { e.preventDefault(); this.setState({ drag: false }); this.pickFile(e.dataTransfer.files[0]); }}
                    className="pf-avatar" style={{ position: "relative", flex: "0 0 auto", width: "96px", height: "96px", padding: "0", borderRadius: "50%", border: s.drag ? "2px dashed #D6BBFF" : "2px solid transparent", background: "transparent", transform: "none" }}>
                    <img src={avatar} alt="" width="92" height="92" referrerPolicy="no-referrer" style={{ width: "92px", height: "92px", borderRadius: "50%", objectFit: "cover", display: "block" }} />
                    <span aria-hidden="true" className="pf-avatar-cam" style={{ position: "absolute", right: "0", bottom: "0", width: "30px", height: "30px", borderRadius: "50%", background: "#D6BBFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#17092E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                    </span>
                  </button>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "0" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <button type="button" onClick={() => this.fileRef.current && this.fileRef.current.click()} style={{ ...ghost, border: "none", background: "#D6BBFF", color: "#17092E" }}>
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
                        Upload photo
                      </button>
                      {custom ? (
                        <button type="button" onClick={() => this.setState({ image: '', upload: '' })} style={ghost}>
                          {u.providerImage ? 'Use my ' + (PROVIDER[u.provider] || 'account') + ' picture' : 'Remove'}
                        </button>
                      ) : null}
                    </div>
                    <span style={{ fontSize: "12.5px", color: "#6A6086" }}>Or drag a picture onto your avatar.</span>
                  </div>
                  <input disabled title="Unavailable in the design preview. Do not enter real credentials or upload files." ref={this.fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { this.pickFile(e.target.files[0]); e.target.value = ''; }} style={{ display: "none" }} />
                </div>

                <div style={{ marginTop: "20px", fontSize: "13px", fontWeight: "600", color: "#A79DC4" }}>Or pick one of ours</div>
                <div role="radiogroup" aria-label="Duoly avatars" className="pf-presets" style={{ marginTop: "10px" }}>
                  {PRESETS.map((src, i) => {
                    const on = !s.upload && s.image === src;
                    return (
                      <button key={src} type="button" role="radio" aria-checked={on ? 'true' : 'false'} aria-label={'Avatar ' + (i + 1)} onClick={() => this.setState({ image: src, upload: '' })}
                        style={{ padding: "3px", borderRadius: "50%", border: on ? "2px solid #D6BBFF" : "2px solid transparent", background: "transparent", transform: "none", opacity: on || !custom ? "1" : ".7" }}>
                        <img src={src} alt="" width="44" height="44" style={{ width: "44px", height: "44px", borderRadius: "50%", display: "block" }} />
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* about */}
              <section aria-labelledby="pf-about" style={card}>
                <h2 id="pf-about" style={h2}>About you</h2>
                <p style={help}>{teammate ? 'Customers see this on your order card and in the waiting room.' : 'Shown to your teammate and on leaderboards.'}</p>

                <div style={{ marginTop: "18px" }}>
                  <label htmlFor="pf-name" style={label}>Display name</label>
                  <div style={{ position: "relative" }}>
                    <input id="pf-name" className="pf-input" value={s.name} maxLength={32} autoComplete="nickname" onChange={(e) => this.setState({ name: e.target.value, error: '' })} style={{ paddingRight: "56px" }} />
                    <span aria-hidden="true" style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "#6A6086", fontVariantNumeric: "tabular-nums" }}>{s.name.length}/32</span>
                  </div>
                </div>

                <div style={{ marginTop: "18px", position: "relative" }}>
                  <label htmlFor="pf-country" style={label}>Country</label>
                  <div style={{ position: "relative" }}>
                    {s.country && !s.open ? (
                      <img src={flagSrc(s.country)} alt="" width="22" height="16" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "22px", height: "16px", borderRadius: "3px", objectFit: "cover", pointerEvents: "none" }} />
                    ) : (
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E84AB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "17px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                    )}
                    <input
                      id="pf-country" ref={this.searchRef} className="pf-input" role="combobox" aria-expanded={s.open ? 'true' : 'false'} aria-controls="pf-country-list" aria-autocomplete="list"
                      aria-activedescendant={s.open && list[s.hi] ? 'pf-c-' + list[s.hi][0] : undefined}
                      placeholder={s.country ? COUNTRY_NAME[s.country] : 'Search countries'} autoComplete="off"
                      value={s.open ? s.query : (s.country ? COUNTRY_NAME[s.country] : '')}
                      onFocus={() => this.setState({ open: true, query: '', hi: 0 })}
                      onBlur={() => setTimeout(() => this.setState({ open: false, query: '' }), 120)}
                      onChange={(e) => this.setState({ query: e.target.value, open: true, hi: 0 })}
                      onKeyDown={(e) => this.onCountryKey(e)}
                      style={{ paddingLeft: "46px", paddingRight: "40px" }} />
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E84AB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)" + (s.open ? " rotate(180deg)" : ""), pointerEvents: "none" }}><path d="M6 9l6 6 6-6" /></svg>
                  </div>
                  {s.open ? (
                    <ul id="pf-country-list" role="listbox" aria-label="Countries" className="dl-pop dl-scroll" style={{ position: "absolute", left: "0", right: "0", top: "calc(100% + 6px)", zIndex: "10", maxHeight: "280px", overflowY: "auto", margin: "0", padding: "6px", listStyle: "none", borderRadius: "14px", background: "#170E2C", border: "1px solid rgba(214, 187, 255, .18)", boxShadow: "0 24px 60px rgba(0, 0, 0, .6)", animation: "dlpop .16s ease-out" }}>
                      {!s.query && s.country ? (
                        <li role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); this.pickCountry(''); }} style={{ padding: "9px 10px", borderRadius: "10px", fontSize: "14px", color: "#8E84AB", cursor: "pointer" }}>Don’t show a country</li>
                      ) : null}
                      {list.length ? list.map(([code, name], i) => (
                        <li key={code} id={'pf-c-' + code} role="option" aria-selected={s.country === code ? 'true' : 'false'}
                          onMouseDown={(e) => { e.preventDefault(); this.pickCountry(code); }} onMouseEnter={() => this.setState({ hi: i })}
                          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", fontSize: "14px", cursor: "pointer", color: "#F3EEFF", background: i === s.hi ? "rgba(214, 187, 255, .1)" : "transparent" }}>
                          <img src={flagSrc(code)} alt="" width="22" height="16" loading="lazy" style={{ width: "22px", height: "16px", borderRadius: "3px", objectFit: "cover", flex: "0 0 auto" }} />
                          {name}
                          {s.country === code ? <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D6BBFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}><path d="M20 6L9 17l-5-5" /></svg> : null}
                        </li>
                      )) : <li style={{ padding: "12px 10px", fontSize: "14px", color: "#8E84AB" }}>No country matches “{s.query}”.</li>}
                    </ul>
                  ) : null}
                </div>

                {teammate ? (
                  <>
                    <div style={{ marginTop: "18px" }}>
                      <label htmlFor="pf-bio" style={label}>Bio</label>
                      <textarea id="pf-bio" className="pf-input" rows={3} maxLength={160} value={s.bio} placeholder="Diamond jungle main, calm comms, I explain my calls." onChange={(e) => this.setState({ bio: e.target.value })} style={{ height: "auto", minHeight: "92px", padding: "12px 14px", resize: "vertical", lineHeight: "1.5" }} />
                      <div style={{ marginTop: "6px", textAlign: "right", fontSize: "12px", color: "#6A6086", fontVariantNumeric: "tabular-nums" }}>{s.bio.length}/160</div>
                    </div>
                    <fieldset style={{ margin: "6px 0 0", padding: "0", border: "none" }}>
                      <legend style={{ ...label, padding: "0" }}>Languages you play in <span style={{ fontWeight: "500", color: "#8E84AB" }}>· up to 6</span></legend>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {this.props.languages.map((l) => {
                          const on = s.languages.includes(l);
                          const full = !on && s.languages.length >= 6;
                          return (
                            <button key={l} type="button" aria-pressed={on ? 'true' : 'false'} disabled={full}
                              onClick={() => this.setState({ languages: on ? s.languages.filter((x) => x !== l) : s.languages.concat(l) })}
                              style={{ minHeight: "36px", padding: "0 13px", borderRadius: "999px", fontSize: "13.5px", fontWeight: "600", transform: "none", cursor: full ? "not-allowed" : "pointer", opacity: full ? ".4" : "1",
                                border: on ? "1px solid rgba(94, 234, 168, .45)" : "1px solid rgba(196, 170, 255, .16)", background: on ? "rgba(94, 234, 168, .1)" : "transparent", color: on ? GREEN : "#D9D1F0" }}>
                              {l}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  </>
                ) : null}
              </section>

              {/* Discord: teammates connect it so the bot can show Online / In Session in the server */}
              {(this.props.accountOnly ? (u.role === 'teammate' || u.role === 'admin' || this.props.discord) : (teammate || u.role === 'admin')) ? this.renderDiscord(card, h2, help, ghost) : null}

              {/* account */}
              <section aria-labelledby="pf-acc" style={card}>
                <h2 id="pf-acc" style={h2}>Account</h2>
                <dl className="pf-facts" style={{ margin: "14px 0 0" }}>
                  <dt>Email</dt><dd style={{ overflowWrap: "anywhere" }}>{u.email || '—'}</dd>
                  <dt>Signs in with</dt><dd>{PROVIDER[u.provider] || u.provider || '—'}</dd>
                  <dt>Account type</dt><dd>{role.label}</dd>
                </dl>
              </section>
            </div>
          </div>
        </main>

        {/* save bar: only while something changed */}
        {dirty || s.done || s.error ? (
          <div role="region" aria-label="Save changes" style={{ position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "8", padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", background: "rgba(9, 4, 20, .86)", backdropFilter: "blur(14px)", borderTop: "1px solid rgba(196, 170, 255, .1)", animation: "dlpop .2s ease-out" }}>
            <div style={{ maxWidth: "1040px", margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px" }}>
              <span role="status" style={{ flex: "1 1 200px", fontSize: "14px", color: s.error ? "#FF8A9B" : s.done && !dirty ? GREEN : "#A79DC4", fontWeight: "600" }}>
                {s.error || (s.done && !dirty ? 'Saved. Your profile is updated everywhere.' : 'You have unsaved changes')}
              </span>
              {dirty ? (
                <>
                  <button type="button" onClick={() => this.discard()} disabled={s.saving} style={ghost}>Discard</button>
                  <button type="button" onClick={() => this.save()} disabled={s.saving} style={{ ...ghost, border: "none", background: GREEN, color: "#062A1B", minWidth: "140px", justifyContent: "center", opacity: s.saving ? ".7" : "1" }}>
                    {s.saving ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}
