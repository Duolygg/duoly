// The sign-in popup: Discord, Google and email (log in or create an account). The homepage opens
// it (pay, Sign in), and so does every other page for a signed-out visitor (SiteAuthDialog.jsx,
// any link to /login). Moved from home/Home.jsx unchanged, so they are the same popup.
// Props: open, why (a line under the title), mode ('login' | 'register'), stat ({rating,
// reviews}), authError (a failed provider sign-in), onClose, onSignIn(provider),
// onEmailAuth(form) -> error message or null, onDone (signed in by email).
import React from 'react';

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

/** The rating line under the brand panel, from the public live stats (/api/home/live). */
export function authStat(stats) {
  const compact = (n) =>
    n >= 10000
      ? Math.round(n / 1000) + 'k'
      : n >= 1000
        ? (Math.round(n / 100) / 10).toLocaleString('en-US') + 'k'
        : n.toLocaleString('en-US');
  const ok = !!stats && stats.reviews > 0 && stats.rating !== null;
  return {
    rating: ok ? stats.rating.toFixed(1) : null,
    reviews: ok
      ? compact(stats.reviews) + (stats.reviews === 1 ? ' review' : ' reviews')
      : null,
  };
}

export default class AuthDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = { emailMode: props.mode || 'login', authNote: '' };
  }
  componentDidMount() {
    this._key = (e) => {
      if (e.key === 'Escape' && this.props.open) this.close();
    };
    document.addEventListener('keydown', this._key);
  }
  componentWillUnmount() {
    document.removeEventListener('keydown', this._key);
  }
  componentDidUpdate(prev) {
    // each time it opens: a clean note, and the mode the opener asked for
    if (this.props.open && !prev.open)
      this.setState({
        authNote: '',
        authBusy: null,
        ...(this.props.mode ? { emailMode: this.props.mode } : {}),
      });
  }
  close = () => {
    this.setState({ authBusy: null });
    if (this.props.onClose) this.props.onClose();
  };
  vals() {
    const s = this.state;
    const P = this.props;
    const busy = s.authBusy;
    const login = (provider) => () => {
      if (P.onSignIn) {
        this.setState({ authBusy: provider, authNote: '' });
        P.onSignIn(provider);
        return;
      }
      this.setState({
        authBusy: null,
        authNote: 'Sign-in is temporarily unavailable.',
      });
    };
    return {
      stat: P.stat || {},
      authNote:
        s.authNote ||
        (P.authError ? 'That login didn’t work. Please try again.' : ''),
      discordLabel: busy === 'discord' ? 'Connecting…' : 'Discord',
      googleLabel: busy === 'google' ? 'Connecting…' : 'Google',
      closeAuth: this.close,
      loginDiscord: login('discord'),
      loginGoogle: login('google'),
      ...this.emailVals(s, P),
    };
  }
  emailVals(s, P) {
    const register = s.emailMode === 'register';
    const field = (k) => (e) =>
      this.setState({ [k]: e.target.value, authNote: '' });
    const tab = (a) =>
      'flex: 1; min-height: 40px; border-radius: 10px; border: none; font-size: 14px; font-weight: 600; ' +
      (a
        ? 'background: #F3EEFF; color: #17092E;'
        : 'background: transparent; color: #A79DC4;');
    const submit = async (e) => {
      if (e) e.preventDefault();
      const st = this.state;
      const form = {
        mode: register ? 'register' : 'login',
        name: (st.emailName || '').trim(),
        email: (st.emailAddr || '').trim(),
        password: st.emailPass || '',
      };
      if (register && !form.name)
        return this.setState({ authNote: 'Enter your name.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        return this.setState({ authNote: 'Enter a valid email.' });
      if (form.password.length < 8)
        return this.setState({
          authNote: 'Password needs at least 8 characters.',
        });
      if (!P.onEmailAuth)
        return this.setState({
          authNote: 'Sign-in is temporarily unavailable.',
        });
      this.setState({ emailBusy: true, authNote: '' });
      const error = await P.onEmailAuth(form);
      this.setState(
        error
          ? { emailBusy: false, authNote: error }
          : { emailBusy: false, emailPass: '' },
      );
      if (!error && P.onDone) P.onDone();
    };
    // Password strength for the create-account form: length, mixed case, digit, symbol.
    const pw = s.emailPass || '';
    const score = !pw
      ? 0
      : Math.max(
          1,
          [
            pw.length >= 8,
            /[a-z]/.test(pw) && /[A-Z]/.test(pw),
            /\d/.test(pw),
            /[^A-Za-z0-9]/.test(pw) || pw.length >= 14,
          ].filter(Boolean).length,
        );
    const strength = [
      ['', '#2A1F45'],
      ['Weak', '#F0A6FF'],
      ['Okay', '#FFD0A6'],
      ['Good', '#D6BBFF'],
      ['Strong', '#5EEAA8'],
    ][score];
    return {
      emailRegister: register,
      authTitle: register ? 'Create your account' : 'Welcome back',
      authSub:
        P.why ||
        (register
          ? 'Ten seconds, then you’re ready to queue.'
          : 'Log in to queue in one tap and rebook teammates you liked.'),
      switchText: register ? 'Already have an account?' : 'New to Duoly?',
      switchLabel: register ? 'Log in' : 'Create an account',
      switchMode: () =>
        this.setState({
          emailMode: register ? 'login' : 'register',
          authNote: '',
        }),
      passType: s.showPass ? 'text' : 'password',
      passToggleLabel: s.showPass ? 'Hide password' : 'Show password',
      passShown: !!s.showPass,
      togglePass: () => this.setState({ showPass: !this.state.showPass }),
      showStrength: register && !!pw,
      strengthLabel: strength[0],
      strengthColor: strength[1],
      strengthBars: [1, 2, 3, 4].map(
        (n) =>
          'flex: 1; height: 4px; border-radius: 999px; transition: background-color .2s; background: ' +
          (n <= score ? strength[1] : 'rgba(196, 170, 255, .12)') +
          ';',
      ),
      emailLoginTab: tab(!register),
      emailRegisterTab: tab(register),
      emailLoginPressed: register ? 'false' : 'true',
      emailRegisterPressed: register ? 'true' : 'false',
      showLogin: () => this.setState({ emailMode: 'login', authNote: '' }),
      showRegister: () =>
        this.setState({ emailMode: 'register', authNote: '' }),
      emailName: s.emailName || '',
      emailAddr: s.emailAddr || '',
      emailPass: s.emailPass || '',
      setEmailName: field('emailName'),
      setEmailAddr: field('emailAddr'),
      setEmailPass: field('emailPass'),
      passAutocomplete: register ? 'new-password' : 'current-password',
      emailBusy: !!s.emailBusy,
      emailSubmitLabel: s.emailBusy
        ? register
          ? 'Creating account…'
          : 'Logging in…'
        : register
          ? 'Create account'
          : 'Log in',
      submitEmail: submit,
    };
  }

  render() {
    if (!this.props.open) return null;
    const v = this.vals();
    return (
      <>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-h"
          style={{
            position: 'fixed',
            inset: '0',
            zIndex: '50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflowY: 'auto',
          }}
        >
          <button
            type="button"
            aria-label="Close sign-in"
            onClick={v.closeAuth}
            style={{
              position: 'absolute',
              inset: '0',
              border: 'none',
              background: 'rgba(5, 2, 12, .78)',
              backdropFilter: 'blur(12px)',
              transform: 'none',
              cursor: 'default',
              animation: 'dlfade .2s ease-out',
            }}
          />
          <div
            className="dl-auth"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '880px',
              margin: 'auto',
              borderRadius: '30px',
              overflow: 'hidden',
              background: '#120B22',
              border: '1px solid rgba(214, 187, 255, .16)',
              boxShadow: '0 40px 120px rgba(0, 0, 0, .7)',
              animation: 'dlpop .24s ease-out',
            }}
          >
            <div
              className="dl-auth-side"
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                padding: '32px',
                background:
                  'radial-gradient(120% 80% at 20% 0%, rgba(240, 166, 255, .16), transparent 60%), radial-gradient(90% 70% at 100% 100%, rgba(214, 187, 255, .14), transparent 60%), #1B1033',
                borderRight: '1px solid rgba(214, 187, 255, .12)',
              }}
            >
              <img
                src="/assets/brand/logo-wordmark.webp"
                alt="Duoly"
                width="96"
                height="36"
                style={{ width: '96px', height: '36px', display: 'block' }}
              />
              <div
                style={{
                  flex: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '18px 0',
                }}
              >
                <img
                  src="/assets/brand/logo-mascots.webp"
                  alt="Duoly mascots"
                  width="250"
                  height="158"
                  style={{
                    width: '100%',
                    maxWidth: '250px',
                    height: 'auto',
                    display: 'block',
                    animation: 'dlfloat 6s ease-in-out infinite',
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily:
                    "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif",
                  fontSize: '28px',
                  fontWeight: '800',
                  lineHeight: '1.05',
                  letterSpacing: '-.03em',
                  color: '#FFFFFF',
                }}
              >
                Never solo
                <br />
                <span style={{ color: '#D6BBFF' }}>queue again.</span>
              </div>
              <ul
                style={{
                  margin: '16px 0 0',
                  padding: '0',
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '9px',
                  fontSize: '14px',
                  color: '#CFC4EA',
                }}
              >
                <li
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span
                    style={{
                      flex: '0 0 auto',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'rgba(94, 234, 168, .14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#5EEAA8"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  Matched in under 2 minutes
                </li>
                <li
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span
                    style={{
                      flex: '0 0 auto',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'rgba(94, 234, 168, .14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#5EEAA8"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  Balance and favourite teammates saved
                </li>
                <li
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span
                    style={{
                      flex: '0 0 auto',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'rgba(94, 234, 168, .14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#5EEAA8"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  Your own dashboard to track the climb
                </li>
              </ul>
              {v.stat.rating ? (
                <div
                  style={{
                    marginTop: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '16px',
                    background: 'rgba(9, 4, 20, .5)',
                    border: '1px solid rgba(196, 170, 255, .12)',
                  }}
                >
                  <span style={{ display: 'flex' }}>
                    <img
                      src="/assets/avatars/avatar-1.png"
                      alt=""
                      width="30"
                      height="30"
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        boxShadow: '0 0 0 2px #1B1033',
                      }}
                    />
                    <img
                      src="/assets/avatars/avatar-2.png"
                      alt=""
                      width="30"
                      height="30"
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        marginLeft: '-8px',
                        boxShadow: '0 0 0 2px #1B1033',
                      }}
                    />
                    <img
                      src="/assets/avatars/avatar-3.png"
                      alt=""
                      width="30"
                      height="30"
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        marginLeft: '-8px',
                        boxShadow: '0 0 0 2px #1B1033',
                      }}
                    />
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      lineHeight: '1.3',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13.5px',
                        fontWeight: '600',
                        color: '#FFFFFF',
                      }}
                    >
                      ★ {v.stat.rating} / 5
                    </span>
                    <span style={{ fontSize: '12px', color: '#A79DC4' }}>
                      from {v.stat.reviews}
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
            <div
              style={{
                position: 'relative',
                padding: '32px 32px 26px',
                minWidth: '0',
              }}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={v.closeAuth}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'rgba(196, 170, 255, .08)',
                  color: '#CFC4EA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <div
                role="group"
                aria-label="Account"
                style={{
                  display: 'inline-flex',
                  gap: '2px',
                  padding: '4px',
                  borderRadius: '14px',
                  background: '#090414',
                  border: '1px solid rgba(196, 170, 255, .1)',
                }}
              >
                <button
                  type="button"
                  aria-pressed={v.emailLoginPressed}
                  onClick={v.showLogin}
                  style={css(
                    v.emailLoginTab + ' flex: 0 0 auto; padding: 0 16px;',
                  )}
                >
                  Log in
                </button>
                <button
                  type="button"
                  aria-pressed={v.emailRegisterPressed}
                  onClick={v.showRegister}
                  style={css(
                    v.emailRegisterTab + ' flex: 0 0 auto; padding: 0 16px;',
                  )}
                >
                  Create account
                </button>
              </div>
              <h2
                id="auth-h"
                style={{
                  margin: '22px 0 0',
                  fontFamily:
                    "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif",
                  fontSize: '32px',
                  fontWeight: '800',
                  lineHeight: '1.05',
                  letterSpacing: '-.03em',
                  color: '#FFFFFF',
                }}
              >
                {v.authTitle}
              </h2>
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: '14.5px',
                  color: '#A79DC4',
                }}
              >
                {v.authSub}
              </p>
              <div
                style={{
                  marginTop: '22px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={v.loginDiscord}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    minHeight: '50px',
                    borderRadius: '14px',
                    border: 'none',
                    background: '#5865F2',
                    color: '#FFFFFF',
                    fontSize: '15px',
                    fontWeight: '600',
                  }}
                >
                  <img
                    src="/assets/social/discord-white.png"
                    alt=""
                    width="22"
                    height="17"
                    style={{ width: '22px', height: '17px' }}
                  />
                  {v.discordLabel}
                </button>
                <button
                  type="button"
                  onClick={v.loginGoogle}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    minHeight: '50px',
                    borderRadius: '14px',
                    border: 'none',
                    background: '#FFFFFF',
                    color: '#1F1F1F',
                    fontSize: '15px',
                    fontWeight: '600',
                  }}
                >
                  <img
                    src="/assets/social/google-g.png"
                    alt=""
                    width="18"
                    height="19"
                    style={{ width: '18px', height: '19px' }}
                  />
                  {v.googleLabel}
                </button>
              </div>
              <div
                style={{
                  margin: '20px 0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '12.5px',
                  color: '#6A6086',
                }}
              >
                <span
                  style={{
                    flex: '1',
                    height: '1px',
                    background: 'rgba(196, 170, 255, .12)',
                  }}
                />
                or with email
                <span
                  style={{
                    flex: '1',
                    height: '1px',
                    background: 'rgba(196, 170, 255, .12)',
                  }}
                />
              </div>
              <form
                onSubmit={v.submitEmail}
                noValidate
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {v.emailRegister ? (
                  <>
                    <label className="dl-field" htmlFor="dl-name">
                      <svg
                        aria-hidden="true"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21a8 8 0 0 1 16 0" />
                      </svg>
                      <span
                        style={{
                          position: 'absolute',
                          width: '1px',
                          height: '1px',
                          overflow: 'hidden',
                          clip: 'rect(0 0 0 0)',
                        }}
                      >
                        Name
                      </span>
                      <input
                        id="dl-name"
                        type="text"
                        placeholder="Your name"
                        autoComplete="nickname"
                        value={v.emailName}
                        onChange={v.setEmailName}
                      />
                    </label>
                  </>
                ) : null}
                <label className="dl-field" htmlFor="dl-email">
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  <span
                    style={{
                      position: 'absolute',
                      width: '1px',
                      height: '1px',
                      overflow: 'hidden',
                      clip: 'rect(0 0 0 0)',
                    }}
                  >
                    Email
                  </span>
                  <input
                    id="dl-email"
                    type="email"
                    placeholder="you@email.com"
                    autoComplete="email"
                    value={v.emailAddr}
                    onChange={v.setEmailAddr}
                  />
                </label>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <label className="dl-field" htmlFor="dl-pass">
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="4" y="10" width="16" height="11" rx="3" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                    <span
                      style={{
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        overflow: 'hidden',
                        clip: 'rect(0 0 0 0)',
                      }}
                    >
                      Password
                    </span>
                    <input
                      id="dl-pass"
                      type={v.passType}
                      placeholder="Password (8+ characters)"
                      autoComplete={v.passAutocomplete}
                      value={v.emailPass}
                      onChange={v.setEmailPass}
                    />
                    <button
                      type="button"
                      onClick={v.togglePass}
                      aria-label={v.passToggleLabel}
                      aria-pressed={v.passShown ? 'true' : 'false'}
                      style={{
                        flex: '0 0 auto',
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'transparent',
                        color: '#8E84AB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: 'none',
                      }}
                    >
                      {v.passShown ? (
                        <svg
                          aria-hidden="true"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 3l18 18" />
                          <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
                          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </label>
                  {v.showStrength ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div
                        aria-hidden="true"
                        style={{ flex: '1', display: 'flex', gap: '4px' }}
                      >
                        {v.strengthBars.map((b, i) => (
                          <span key={i} style={css(b)} />
                        ))}
                      </div>
                      <span
                        style={{
                          minWidth: '48px',
                          textAlign: 'right',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: v.strengthColor,
                        }}
                      >
                        {v.strengthLabel}
                      </span>
                    </div>
                  ) : null}
                  {!v.emailRegister ? (
                    <a
                      href="/reset-password"
                      style={{
                        alignSelf: 'flex-end',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#D6BBFF',
                        textDecoration: 'none',
                      }}
                    >
                      Forgot password?
                    </a>
                  ) : null}
                </div>
                {v.authNote ? (
                  <div
                    role="status"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: 'rgba(240, 166, 255, .1)',
                      border: '1px solid rgba(240, 166, 255, .28)',
                      fontSize: '13.5px',
                      color: '#F7D6FF',
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
                    {v.authNote}
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={v.emailBusy}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    minHeight: '54px',
                    marginTop: '2px',
                    borderRadius: '14px',
                    border: 'none',
                    background: '#D6BBFF',
                    color: '#17092E',
                    fontSize: '15.5px',
                    fontWeight: '700',
                    opacity: v.emailBusy ? '.7' : '1',
                  }}
                >
                  {v.emailSubmitLabel}
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
                </button>
              </form>
              <p
                style={{
                  margin: '16px 0 0',
                  textAlign: 'center',
                  fontSize: '14px',
                  color: '#A79DC4',
                }}
              >
                {v.switchText}{' '}
                <button
                  type="button"
                  onClick={v.switchMode}
                  style={{
                    padding: '0',
                    border: 'none',
                    background: 'transparent',
                    color: '#D6BBFF',
                    fontSize: '14px',
                    fontWeight: '600',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                    transform: 'none',
                  }}
                >
                  {v.switchLabel}
                </button>
              </p>
              <p
                style={{
                  margin: '12px 0 0',
                  textAlign: 'center',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  color: '#6A6086',
                }}
              >
                By continuing you agree to our{' '}
                <a href="/terms" target="_blank" rel="noopener">
                  Terms
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }
}
