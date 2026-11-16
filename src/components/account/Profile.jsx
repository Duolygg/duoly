'use client';

/* global fetch */
// Port of the original components/Profile.jsx (duoly-admin/duoly@7f0299f). Live wiring comes in as
// props from LiveProfile.tsx (save through /api/me/profile with CSRF, Discord link). Teammates write
// a bio and pick languages (ledger #2); the rules are enforced again on the server and in Postgres.
import React from 'react';
import ImageCropper from './ImageCropper';
import PublicProfileSettings from './PublicProfileSettings';
import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_PICK_BYTES,
  canvasReady,
  encodeAvatar,
  framedImageStyle,
  loadPickedImage,
  pickFileError,
  releasePicked,
} from './crop-image';
import {
  AVATAR_GIF_MAX_BYTES,
  AVATAR_GIF_STEPS,
  encodeAnimatedCrop,
  readAnimatedGif,
} from './animated-image';
import TrophySettings from './TrophySettings';
import LanguagePicker from './LanguagePicker';
import { LANGUAGES_MAX } from '../../contracts/account';
import {
  COUNTRIES,
  COUNTRY_NAME,
  flagSrc,
} from '../../design-reference/lib/countries';

const DISPLAY = "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif";
const GREEN = '#5EEAA8';
const PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
  (n) => '/assets/avatars/avatar-' + n + '.png',
);
const ROLE = {
  customer: { label: 'Customer', back: 'Back to dashboard' },
  teammate: { label: 'Teammate', back: 'Back to orders' },
  admin: { label: 'Admin', back: 'Back to admin' },
};
/* The two places an uploaded picture is printed, at the sizes they print it: the account menu
   in the site header (32px) and the teammate cards (.tp-card-art, 72px). */
const AVATAR_PREVIEWS = [
  { size: 32, label: 'Menu' },
  { size: 72, label: 'Cards' },
];
const PROVIDER = {
  email: 'email code',
  discord: 'Discord',
  google: 'Google',
  password: 'email and password',
};

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
      languages: props.profile.languages || [],
    };
    this.state = {
      saved,
      ...saved,
      upload: '',
      saving: false,
      error: '',
      done: false,
      query: '',
      open: false,
      hi: 0,
      drag: false,
      /** The picked file while the cropper is open: the decoded image and its object URL. */
      crop: null,
      /** The frame the cropper is showing right now, so the preview card can follow it. */
      cropArea: null,
      /** 0 to 1 while an animated GIF is being cut frame by frame, else null. */
      cropProgress: null,
      /** What the header block wants the preview card's banner to show, if anything. */
      headerArt: null,
    };
    this.fileRef = React.createRef();
    this.searchRef = React.createRef();
  }

  componentDidMount() {
    this.unmounted = false;
    // the ?discord=… result from connecting is shown once; don't keep it in the address bar
    if (this.props.discordResult)
      window.history.replaceState(null, '', '/profile');
  }
  componentWillUnmount() {
    this.unmounted = true;
    releasePicked(this.state.crop);
    clearTimeout(this._doneT);
  }

  dirty() {
    const s = this.state,
      o = s.saved;
    return (
      !!s.upload ||
      s.name.trim() !== o.name ||
      s.image !== o.image ||
      s.country !== o.country ||
      s.bio !== o.bio ||
      s.languages.join() !== o.languages.join()
    );
  }

  /** Opens the cropper on a picked file. Nothing is encoded until the crop is saved. */
  async pickFile(file) {
    if (this.props.accountOnly && !this.props.allowUpload)
      return this.setState({
        error: 'Uploads are not available yet. Choose an avatar below.',
      });
    const problem = pickFileError(file, AVATAR_MAX_PICK_BYTES);
    if (problem) return this.setState({ error: problem });
    /* A browser that hands back no canvas context would save an empty picture, so the pick is
       turned away before the cropper opens rather than at the end of it. */
    if (!canvasReady())
      return this.setState({
        error:
          'This browser could not prepare the picture. Try a smaller JPG or PNG.',
      });
    this.setState({ error: '' });
    try {
      const picked = await loadPickedImage(file);
      if (this.unmounted) return releasePicked(picked);
      /* An animated GIF keeps moving: the crop is cut from every frame when it is saved. */
      try {
        picked.gif = await readAnimatedGif(file);
      } catch {
        picked.gif = null;
      }
      if (this.unmounted) return releasePicked(picked);
      this.closeCrop({ crop: picked });
    } catch (e) {
      if (!this.unmounted) this.setState({ error: e.message });
    }
  }

  /** Leaves the cropper and lets go of the picked file. */
  closeCrop(patch) {
    releasePicked(this.state.crop);
    this.setState({ crop: null, cropArea: null, cropProgress: null, ...patch });
  }

  /** Turns the chosen frame into the 256 by 256 picture the save sends. */
  saveCrop(area) {
    const crop = this.state.crop;
    if (crop?.gif) return this.saveAnimatedCrop(crop, area);
    let encoded;
    try {
      encoded = encodeAvatar(crop.image, area);
    } catch {
      return this.setState({
        error:
          'This browser could not prepare the picture. Try a smaller JPG or PNG.',
      });
    }
    if (!encoded.ok)
      return this.setState({
        error:
          encoded.reason === 'format'
            ? 'This browser could not save the picture. Try another browser.'
            : `That picture stays over ${Math.round(AVATAR_MAX_BYTES / 1024)} KB even at low quality. Try one with less fine detail.`,
      });
    this.closeCrop({ upload: encoded.url, error: '' });
  }

  /** The same crop cut from every frame of an animated GIF, so the picture keeps moving. */
  async saveAnimatedCrop(crop, area) {
    if (this.state.cropProgress !== null) return;
    this.setState({ cropProgress: 0, error: '' });
    let encoded;
    try {
      encoded = await encodeAnimatedCrop(
        crop.gif,
        area,
        AVATAR_GIF_STEPS,
        AVATAR_GIF_MAX_BYTES,
        {
          onProgress: (cropProgress) =>
            !this.unmounted && this.setState({ cropProgress }),
          cancelled: () => this.unmounted || this.state.crop !== crop,
        },
      );
    } catch {
      encoded = { ok: false, reason: 'format' };
    }
    if (this.unmounted || this.state.crop !== crop) return;
    if (!encoded.ok)
      return this.setState({
        cropProgress: null,
        error:
          encoded.reason === 'format'
            ? 'This browser could not prepare the GIF. Try another browser, or a JPG or PNG.'
            : `That GIF stays over ${Math.round(AVATAR_GIF_MAX_BYTES / (1024 * 1024))} MB even made smaller. Try a shorter one.`,
      });
    this.closeCrop({ upload: encoded.url, error: '' });
  }

  async save() {
    const s = this.state;
    if (s.name.trim().length < 2)
      return this.setState({ error: 'Your name needs at least 2 characters.' });
    this.setState({ saving: true, error: '' });
    const body = { name: s.name.trim(), country: s.country };
    if (s.upload) body.upload = s.upload;
    else body.image = s.image;
    if (this.props.user.role === 'teammate') {
      body.bio = s.bio;
      body.languages = s.languages;
    }
    try {
      const res = this.props.onSave
        ? await this.props.onSave(body)
        : await fetch('/api/me/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        return this.setState({
          saving: false,
          error: data.error || 'Couldn’t save. Please try again.',
        });
      const p = data.profile || {};
      const saved = {
        name: p.name || body.name,
        image: p.image || '',
        country: p.country || '',
        bio: p.bio || '',
        languages: p.languages || [],
      };
      this.setState({ saved, ...saved, upload: '', saving: false, done: true });
      clearTimeout(this._doneT);
      this._doneT = setTimeout(() => this.setState({ done: false }), 2600);
    } catch (e) {
      this.setState({
        saving: false,
        error: 'You seem to be offline. Please try again.',
      });
    }
  }

  discard() {
    this.closeCrop({ ...this.state.saved, upload: '', error: '' });
  }

  async unlinkDiscord() {
    this.setState({ dcBusy: true, dcNote: '' });
    try {
      const res = await fetch('/api/discord/unlink', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf: this.props.csrf }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        this.setState({
          dcBusy: false,
          dcNote: data.error || 'Couldn’t disconnect. Please try again.',
        });
        return;
      }
      this.setState({
        dcBusy: false,
        discord: null,
        dcNote:
          this.props.user.role === 'admin'
            ? 'Disconnected. The bot removes your Online role in a few seconds.'
            : 'Disconnected. The bot removes your server roles in a few seconds, and you need to connect again before you can take orders.',
      });
    } catch (e) {
      this.setState({
        dcBusy: false,
        dcNote: 'Couldn’t disconnect. Please try again.',
      });
    }
  }

  renderDiscord(card, h2, help, ghost) {
    const s = this.state;
    const d = s.discord === undefined ? this.props.discord : s.discord;
    const RESULT = {
      linked: [
        'Discord connected. Your roles in the Duoly server now follow what you do here.',
        GREEN,
      ],
      cancelled: [
        'You cancelled on Discord. Nothing was connected.',
        '#A79DC4',
      ],
      taken: [
        'That Discord account is already connected to another Duoly account.',
        '#FF8A9B',
      ],
      failed: ['Connecting didn’t work. Please try again.', '#FF8A9B'],
      unavailable: ['Discord isn’t set up on this site yet.', '#FF8A9B'],
    };
    const note = s.dcNote
      ? [s.dcNote, '#A79DC4']
      : RESULT[this.props.discordResult];
    const discordBtn = {
      ...ghost,
      border: 'none',
      background: '#5865F2',
      color: '#FFFFFF',
    };
    return (
      <section aria-labelledby="pf-dc" style={card}>
        <h2 id="pf-dc" style={h2}>
          Discord
        </h2>
        {this.props.user.role === 'admin' ? (
          <p style={help}>
            Connect your Discord so the bot shows you as{' '}
            <strong style={{ color: '#F3EEFF' }}>Online</strong> in the Duoly
            server while the admin panel is open.
          </p>
        ) : (
          <p style={help}>
            Needed to take orders. In the Duoly server the bot gives you the{' '}
            <strong style={{ color: '#F3EEFF' }}>Teammate</strong> role, shows
            you as <strong style={{ color: '#F3EEFF' }}>Online</strong> while
            your dashboard toggle is on, and{' '}
            <strong style={{ color: '#F3EEFF' }}>In Session</strong> while you
            play an order.
          </p>
        )}
        <div
          style={{
            marginTop: '14px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {d ? (
            <>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  minHeight: '42px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  background: 'rgba(88, 101, 242, .14)',
                  border: '1px solid rgba(88, 101, 242, .4)',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#FFFFFF',
                }}
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#8B95FF"
                    d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.7 19.7 0 0 0 6 3l1.3-2a12.8 12.8 0 0 1-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.6 19.6 0 0 0 6-3c.5-5.1-.8-9.5-3.6-13.6zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"
                  />
                </svg>
                Connected{d.username ? ' as ' + d.username : ''}
              </span>
              {d.auto ? (
                <span style={{ fontSize: '13px', color: '#8E84AB' }}>
                  You sign in with Discord, so it’s connected automatically.
                </span>
              ) : this.props.user.role === 'teammate' ? (
                // Only admins and customers can disconnect (src/server/discord/link.ts).
                <span style={{ fontSize: '13px', color: '#8E84AB' }}>
                  Teammates stay connected. Ask an admin to change it.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => this.unlinkDiscord()}
                  disabled={s.dcBusy}
                  style={{ ...ghost, opacity: s.dcBusy ? '.6' : '1' }}
                >
                  {s.dcBusy ? 'Disconnecting…' : 'Disconnect'}
                </button>
              )}
            </>
          ) : this.props.csrf && this.props.discordEnabled ? (
            <form
              method="POST"
              action="/api/discord/link"
              style={{ margin: 0 }}
            >
              <input type="hidden" name="csrf" value={this.props.csrf} />
              <input type="hidden" name="next" value="profile" />
              <button
                type="submit"
                style={{ ...discordBtn, cursor: 'pointer' }}
              >
                Connect Discord
              </button>
            </form>
          ) : (
            <a
              aria-disabled="true"
              role="link"
              title="Discord isn’t set up on this site yet"
              style={discordBtn}
            >
              Connect Discord
            </a>
          )}
        </div>
        {note ? (
          <p
            role="status"
            style={{
              margin: '12px 0 0',
              fontSize: '13.5px',
              fontWeight: '600',
              color: note[1],
            }}
          >
            {note[0]}
          </p>
        ) : null}
        <p style={{ ...help, marginTop: '10px', fontSize: '12.5px' }}>
          You need to be a member of the Duoly Discord server for the roles to
          show up.
        </p>
      </section>
    );
  }

  // ---- country picker (combobox with search)
  matches() {
    const q = this.state.query.trim().toLowerCase();
    const list = q
      ? COUNTRIES.filter(([c, n]) => n.toLowerCase().includes(q) || c === q)
      : COUNTRIES;
    return list.slice(0, 80);
  }
  pickCountry(code) {
    this.setState({ country: code, open: false, query: '' });
  }
  onCountryKey(e) {
    const list = this.matches();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.setState({
        open: true,
        hi: Math.min(this.state.hi + 1, list.length - 1),
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.setState({ hi: Math.max(this.state.hi - 1, 0) });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.state.open && list[this.state.hi])
        this.pickCountry(list[this.state.hi][0]);
    } else if (e.key === 'Escape') {
      this.setState({ open: false, query: '' });
    }
  }

  /**
   * The strip across the top of the preview card. It carries the teammate's own header once
   * there is one, and follows the frame while a new one is being positioned, so the card on
   * the left answers the question the crop below it is asking.
   */
  renderPreviewBanner() {
    const art = this.state.headerArt;
    const framed = art && framedImageStyle(art.box, art);
    return (
      <div
        className="dc-live-frame"
        style={{
          height: '74px',
          background:
            'linear-gradient(120deg, rgba(214, 187, 255, .28), rgba(240, 166, 255, .14) 55%, rgba(158, 230, 255, .12))',
        }}
      >
        {art && !framed ? (
          <img
            src={art.src}
            alt=""
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : null}
        {framed ? <img src={art.src} alt="" style={framed} /> : null}
      </div>
    );
  }

  render() {
    const s = this.state;
    const u = this.props.user;
    const role = ROLE[u.role] || ROLE.customer;
    const teammate = u.role === 'teammate';
    const avatar = s.upload || s.image || u.providerImage || PRESETS[0];
    const custom = !!(s.upload || s.image);
    const dirty = this.dirty();
    const list = s.open ? this.matches() : [];
    const shownName = s.name.trim() || u.name;
    /* Where the picked picture sits inside a round box, while the circle is being framed. */
    const cropping = s.crop && framedImageStyle(s.cropArea, s.crop.image);

    const card = {
      padding: '22px',
      borderRadius: '22px',
      background: '#120B22',
      border: '1px solid rgba(196, 170, 255, .08)',
    };
    const h2 = {
      margin: '0 0 4px',
      fontFamily: DISPLAY,
      fontSize: '19px',
      fontWeight: '700',
      letterSpacing: '-.02em',
      color: '#FFFFFF',
    };
    const help = { margin: '0', fontSize: '13.5px', color: '#8E84AB' };
    const label = {
      display: 'block',
      marginBottom: '8px',
      fontSize: '13.5px',
      fontWeight: '600',
      color: '#F3EEFF',
    };
    const ghost = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      minHeight: '42px',
      padding: '0 16px',
      borderRadius: '12px',
      border: '1px solid rgba(214, 187, 255, .2)',
      background: 'transparent',
      color: '#F3EEFF',
      fontSize: '14px',
      fontWeight: '600',
      textDecoration: 'none',
    };

    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#090414',
          color: '#F3EEFF',
          fontFamily: 'Geist, system-ui, sans-serif',
          fontSize: '15px',
          lineHeight: '1.5',
          paddingBottom: dirty ? '110px' : '48px',
        }}
      >
        {/* The site navbar (SiteLayout) sits above, so no second header here: just the way back. */}

        <div
          style={{
            maxWidth: '1040px',
            margin: '0 auto',
            padding: '28px 24px 0',
          }}
        >
          <a href={this.props.home} style={{ ...ghost, marginBottom: '20px' }}>
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
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            {role.back}
          </a>
          <h1
            style={{
              margin: '0',
              fontFamily: DISPLAY,
              fontSize: 'clamp(30px, 4vw, 40px)',
              fontWeight: '800',
              letterSpacing: '-.035em',
              lineHeight: '1.05',
              color: '#FFFFFF',
            }}
          >
            Your profile
          </h1>
          <p style={{ margin: '8px 0 0', color: '#8E84AB' }}>
            {teammate
              ? 'This is what customers see when you take their order.'
              : u.role === 'admin'
                ? 'This is how teammates and customers see you on Duoly.'
                : 'This is what your teammate sees when they take your order.'}
          </p>

          <div className="pf-grid" style={{ marginTop: '28px' }}>
            {/* live preview */}
            <aside
              className="pf-preview"
              style={{ ...card, padding: '0', overflow: 'hidden' }}
            >
              {this.renderPreviewBanner()}
              {/* Above the strip, because the picture laps over it. */}
              <div
                style={{
                  position: 'relative',
                  padding: '0 22px 22px',
                  marginTop: '-40px',
                }}
              >
                <img
                  src={avatar}
                  alt=""
                  width="80"
                  height="80"
                  referrerPolicy="no-referrer"
                  hidden={!!cropping}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    display: cropping ? 'none' : 'block',
                    boxShadow: '0 0 0 4px #120B22',
                  }}
                />
                {/* While the circle is being framed the card shows the frame itself, so the
                    choice is judged where the picture is actually printed. */}
                {cropping ? (
                  <span
                    className="dc-live-frame"
                    aria-hidden="true"
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      background: '#090414',
                      boxShadow: '0 0 0 4px #120B22',
                    }}
                  >
                    <img src={s.crop.url} alt="" style={cropping} />
                  </span>
                ) : null}
                <div
                  style={{
                    marginTop: '12px',
                    fontFamily: DISPLAY,
                    fontSize: '21px',
                    fontWeight: '700',
                    letterSpacing: '-.02em',
                    color: '#FFFFFF',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {shownName}
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13.5px',
                    color: '#A79DC4',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      padding: '2px 9px',
                      borderRadius: '8px',
                      background: 'rgba(214, 187, 255, .12)',
                      color: '#D6BBFF',
                    }}
                  >
                    {role.label}
                  </span>
                  {s.country ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <img
                        src={flagSrc(s.country)}
                        alt=""
                        width="20"
                        height="15"
                        style={{
                          width: '20px',
                          height: '15px',
                          borderRadius: '3px',
                          objectFit: 'cover',
                        }}
                      />
                      {COUNTRY_NAME[s.country]}
                    </span>
                  ) : (
                    <span style={{ color: '#6A6086' }}>No country set</span>
                  )}
                </div>
                {teammate ? (
                  <>
                    <p
                      style={{
                        margin: '14px 0 0',
                        fontSize: '14px',
                        lineHeight: '1.55',
                        color: s.bio ? '#D9D1F0' : '#6A6086',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {s.bio || 'Your bio shows up here.'}
                    </p>
                    {s.languages.length ? (
                      <div
                        style={{
                          marginTop: '12px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        {s.languages.map((l) => (
                          <span
                            key={l}
                            style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              padding: '3px 9px',
                              borderRadius: '8px',
                              background: 'rgba(94, 234, 168, .08)',
                              color: GREEN,
                            }}
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </aside>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                minWidth: '0',
              }}
            >
              {/* picture */}
              <section aria-labelledby="pf-pic" style={card}>
                <h2 id="pf-pic" style={h2}>
                  Profile picture
                </h2>
                {/* While the circle is open the cropper carries the only line of instructions,
                    so this one steps aside rather than saying the same thing twice. */}
                {s.crop ? null : (
                  <p style={help}>
                    {this.props.accountOnly && !this.props.allowUpload
                      ? 'Choose one of the avatars below. Uploads are not available yet.'
                      : 'JPG, PNG, WebP or GIF. You choose the part that shows, and a GIF keeps moving.'}
                  </p>
                )}
                {s.crop ? (
                  <div style={{ marginTop: '14px' }}>
                    <ImageCropper
                      src={s.crop.url}
                      shape="round"
                      aspect={1}
                      naturalWidth={s.crop.image.naturalWidth}
                      naturalHeight={s.crop.image.naturalHeight}
                      minRatio={0.85}
                      maxRatio={1.35}
                      maxStageWidth={420}
                      maxStageHeight={420}
                      label="Profile picture crop"
                      previews={AVATAR_PREVIEWS}
                      saveLabel="Use this picture"
                      busy={s.cropProgress !== null}
                      busyLabel={`Preparing GIF… ${Math.round((s.cropProgress || 0) * 100)}%`}
                      cancelLabel="Cancel"
                      onPreview={(area) => this.setState({ cropArea: area })}
                      onSave={(area) => this.saveCrop(area)}
                      onCancel={() => this.closeCrop({})}
                    />
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        marginTop: '18px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '18px',
                      }}
                    >
                      <button
                        type="button"
                        disabled={
                          !!this.props.accountOnly && !this.props.allowUpload
                        }
                        aria-label="Upload a new profile picture"
                        onClick={() =>
                          this.fileRef.current && this.fileRef.current.click()
                        }
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!s.drag) this.setState({ drag: true });
                        }}
                        onDragLeave={() => this.setState({ drag: false })}
                        onDrop={(e) => {
                          e.preventDefault();
                          this.setState({ drag: false });
                          this.pickFile(e.dataTransfer.files[0]);
                        }}
                        className="pf-avatar"
                        style={{
                          position: 'relative',
                          flex: '0 0 auto',
                          width: '96px',
                          height: '96px',
                          padding: '0',
                          borderRadius: '50%',
                          border: s.drag
                            ? '2px dashed #D6BBFF'
                            : '2px solid transparent',
                          background: 'transparent',
                          transform: 'none',
                        }}
                      >
                        <img
                          src={avatar}
                          alt=""
                          width="92"
                          height="92"
                          referrerPolicy="no-referrer"
                          style={{
                            width: '92px',
                            height: '92px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                        <span
                          aria-hidden="true"
                          className="pf-avatar-cam"
                          style={{
                            position: 'absolute',
                            right: '0',
                            bottom: '0',
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: '#D6BBFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#17092E"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        </span>
                      </button>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          minWidth: '0',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              this.fileRef.current &&
                              this.fileRef.current.click()
                            }
                            style={{
                              ...ghost,
                              border: 'none',
                              background: '#D6BBFF',
                              color: '#17092E',
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
                              strokeLinejoin="round"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <path d="M17 8l-5-5-5 5" />
                              <path d="M12 3v12" />
                            </svg>
                            Upload photo
                          </button>
                          {custom ? (
                            <button
                              type="button"
                              onClick={() =>
                                this.setState({ image: '', upload: '' })
                              }
                              style={ghost}
                            >
                              {u.providerImage
                                ? 'Use my ' +
                                  (PROVIDER[u.provider] || 'account') +
                                  ' picture'
                                : 'Remove'}
                            </button>
                          ) : null}
                        </div>
                        <span style={{ fontSize: '12.5px', color: '#6A6086' }}>
                          Or drag a picture onto your avatar.
                        </span>
                      </div>
                      <input
                        disabled={
                          !!this.props.accountOnly && !this.props.allowUpload
                        }
                        ref={this.fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => {
                          this.pickFile(e.target.files[0]);
                          e.target.value = '';
                        }}
                        style={{ display: 'none' }}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: '20px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#A79DC4',
                      }}
                    >
                      Or pick one of ours
                    </div>
                    <div
                      role="radiogroup"
                      aria-label="Duoly avatars"
                      className="pf-presets"
                      style={{ marginTop: '10px' }}
                    >
                      {PRESETS.map((src, i) => {
                        const on = !s.upload && s.image === src;
                        return (
                          <button
                            key={src}
                            type="button"
                            role="radio"
                            aria-checked={on ? 'true' : 'false'}
                            aria-label={'Avatar ' + (i + 1)}
                            onClick={() =>
                              this.setState({ image: src, upload: '' })
                            }
                            style={{
                              padding: '3px',
                              borderRadius: '50%',
                              border: on
                                ? '2px solid #D6BBFF'
                                : '2px solid transparent',
                              background: 'transparent',
                              transform: 'none',
                              opacity: on || !custom ? '1' : '.7',
                            }}
                          >
                            <img
                              src={src}
                              alt=""
                              width="44"
                              height="44"
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                display: 'block',
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

              {/* about */}
              <section aria-labelledby="pf-about" style={card}>
                <h2 id="pf-about" style={h2}>
                  About you
                </h2>
                <p style={help}>
                  {teammate
                    ? 'Customers see this on your order card and in the waiting room.'
                    : 'Shown to your teammate and on leaderboards.'}
                </p>

                <div style={{ marginTop: '18px' }}>
                  <label htmlFor="pf-name" style={label}>
                    Display name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="pf-name"
                      className="pf-input"
                      value={s.name}
                      maxLength={32}
                      autoComplete="nickname"
                      onChange={(e) =>
                        this.setState({ name: e.target.value, error: '' })
                      }
                      style={{ paddingRight: '56px' }}
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '12px',
                        color: '#6A6086',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {s.name.length}/32
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '18px', position: 'relative' }}>
                  <label htmlFor="pf-country" style={label}>
                    Country
                  </label>
                  <div style={{ position: 'relative' }}>
                    {s.country && !s.open ? (
                      <img
                        src={flagSrc(s.country)}
                        alt=""
                        width="22"
                        height="16"
                        style={{
                          position: 'absolute',
                          left: '14px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '22px',
                          height: '16px',
                          borderRadius: '3px',
                          objectFit: 'cover',
                          pointerEvents: 'none',
                        }}
                      />
                    ) : (
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#8E84AB"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          position: 'absolute',
                          left: '17px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          pointerEvents: 'none',
                        }}
                      >
                        <circle cx="11" cy="11" r="7" />
                        <path d="M20 20l-3.5-3.5" />
                      </svg>
                    )}
                    <input
                      id="pf-country"
                      ref={this.searchRef}
                      className="pf-input"
                      role="combobox"
                      aria-expanded={s.open ? 'true' : 'false'}
                      aria-controls="pf-country-list"
                      aria-autocomplete="list"
                      aria-activedescendant={
                        s.open && list[s.hi]
                          ? 'pf-c-' + list[s.hi][0]
                          : undefined
                      }
                      placeholder={
                        s.country ? COUNTRY_NAME[s.country] : 'Search countries'
                      }
                      autoComplete="off"
                      value={
                        s.open
                          ? s.query
                          : s.country
                            ? COUNTRY_NAME[s.country]
                            : ''
                      }
                      onFocus={() =>
                        this.setState({ open: true, query: '', hi: 0 })
                      }
                      onBlur={() =>
                        setTimeout(
                          () => this.setState({ open: false, query: '' }),
                          120,
                        )
                      }
                      onChange={(e) =>
                        this.setState({
                          query: e.target.value,
                          open: true,
                          hi: 0,
                        })
                      }
                      onKeyDown={(e) => this.onCountryKey(e)}
                      style={{ paddingLeft: '46px', paddingRight: '40px' }}
                    />
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#8E84AB"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform:
                          'translateY(-50%)' +
                          (s.open ? ' rotate(180deg)' : ''),
                        pointerEvents: 'none',
                      }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                  {s.open ? (
                    <ul
                      id="pf-country-list"
                      role="listbox"
                      aria-label="Countries"
                      className="dl-pop dl-scroll"
                      style={{
                        position: 'absolute',
                        left: '0',
                        right: '0',
                        top: 'calc(100% + 6px)',
                        zIndex: '10',
                        maxHeight: '280px',
                        overflowY: 'auto',
                        margin: '0',
                        padding: '6px',
                        listStyle: 'none',
                        borderRadius: '14px',
                        background: '#170E2C',
                        border: '1px solid rgba(214, 187, 255, .18)',
                        boxShadow: '0 24px 60px rgba(0, 0, 0, .6)',
                        animation: 'dlpop .16s ease-out',
                      }}
                    >
                      {!s.query && s.country ? (
                        <li
                          role="option"
                          aria-selected="false"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            this.pickCountry('');
                          }}
                          style={{
                            padding: '9px 10px',
                            borderRadius: '10px',
                            fontSize: '14px',
                            color: '#8E84AB',
                            cursor: 'pointer',
                          }}
                        >
                          Don’t show a country
                        </li>
                      ) : null}
                      {list.length ? (
                        list.map(([code, name], i) => (
                          <li
                            key={code}
                            id={'pf-c-' + code}
                            role="option"
                            aria-selected={
                              s.country === code ? 'true' : 'false'
                            }
                            onMouseDown={(e) => {
                              e.preventDefault();
                              this.pickCountry(code);
                            }}
                            onMouseEnter={() => this.setState({ hi: i })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              borderRadius: '10px',
                              fontSize: '14px',
                              cursor: 'pointer',
                              color: '#F3EEFF',
                              background:
                                i === s.hi
                                  ? 'rgba(214, 187, 255, .1)'
                                  : 'transparent',
                            }}
                          >
                            <img
                              src={flagSrc(code)}
                              alt=""
                              width="22"
                              height="16"
                              loading="lazy"
                              style={{
                                width: '22px',
                                height: '16px',
                                borderRadius: '3px',
                                objectFit: 'cover',
                                flex: '0 0 auto',
                              }}
                            />
                            {name}
                            {s.country === code ? (
                              <svg
                                aria-hidden="true"
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#D6BBFF"
                                strokeWidth="2.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ marginLeft: 'auto' }}
                              >
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            ) : null}
                          </li>
                        ))
                      ) : (
                        <li
                          style={{
                            padding: '12px 10px',
                            fontSize: '14px',
                            color: '#8E84AB',
                          }}
                        >
                          No country matches “{s.query}”.
                        </li>
                      )}
                    </ul>
                  ) : null}
                </div>

                {teammate ? (
                  <>
                    <div style={{ marginTop: '18px' }}>
                      <label htmlFor="pf-bio" style={label}>
                        Bio
                      </label>
                      <textarea
                        id="pf-bio"
                        className="pf-input"
                        rows={3}
                        maxLength={160}
                        value={s.bio}
                        placeholder="Diamond jungle main, calm comms, I explain my calls."
                        onChange={(e) => this.setState({ bio: e.target.value })}
                        style={{
                          height: 'auto',
                          minHeight: '92px',
                          padding: '12px 14px',
                          resize: 'vertical',
                          lineHeight: '1.5',
                        }}
                      />
                      <div
                        style={{
                          marginTop: '6px',
                          textAlign: 'right',
                          fontSize: '12px',
                          color: '#6A6086',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {s.bio.length}/160
                      </div>
                    </div>
                    <fieldset
                      style={{
                        margin: '6px 0 0',
                        padding: '0',
                        border: 'none',
                      }}
                    >
                      <legend style={{ ...label, padding: '0' }}>
                        Languages you play in{' '}
                        <span style={{ fontWeight: '500', color: '#8E84AB' }}>
                          · up to {LANGUAGES_MAX}
                        </span>
                      </legend>
                      <LanguagePicker
                        value={s.languages}
                        allowed={this.props.languages}
                        onChange={(languages) => this.setState({ languages })}
                      />
                    </fieldset>
                  </>
                ) : null}
              </section>

              {teammate && this.props.publicProfilesEnabled ? (
                <>
                  <PublicProfileSettings
                    csrf={this.props.csrf}
                    name={u.name}
                    onHeaderArt={(art) => this.setState({ headerArt: art })}
                  />
                  <TrophySettings csrf={this.props.csrf} />
                </>
              ) : null}

              {/* Discord: teammates connect it so the bot can show Online / In Session in the server */}
              {(
                this.props.accountOnly
                  ? u.role === 'teammate' ||
                    u.role === 'admin' ||
                    this.props.discord
                  : teammate || u.role === 'admin'
              )
                ? this.renderDiscord(card, h2, help, ghost)
                : null}

              {/* account */}
              <section aria-labelledby="pf-acc" style={card}>
                <h2 id="pf-acc" style={h2}>
                  Account
                </h2>
                <dl className="pf-facts" style={{ margin: '14px 0 0' }}>
                  <dt>Email</dt>
                  <dd style={{ overflowWrap: 'anywhere' }}>{u.email || '—'}</dd>
                  <dt>Signs in with</dt>
                  <dd>{PROVIDER[u.provider] || u.provider || '—'}</dd>
                  <dt>Account type</dt>
                  <dd>{role.label}</dd>
                </dl>
              </section>
            </div>
          </div>
        </div>

        {/* save bar: only while something changed */}
        {dirty || s.done || s.error ? (
          <div
            role="region"
            aria-label="Save changes"
            style={{
              position: 'fixed',
              left: '0',
              right: '0',
              bottom: '0',
              zIndex: '8',
              padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
              background: 'rgba(9, 4, 20, .86)',
              backdropFilter: 'blur(14px)',
              borderTop: '1px solid rgba(196, 170, 255, .1)',
              animation: 'dlpop .2s ease-out',
            }}
          >
            <div
              style={{
                maxWidth: '1040px',
                margin: '0 auto',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px 16px',
              }}
            >
              <span
                role="status"
                style={{
                  flex: '1 1 200px',
                  fontSize: '14px',
                  color: s.error
                    ? '#FF8A9B'
                    : s.done && !dirty
                      ? GREEN
                      : '#A79DC4',
                  fontWeight: '600',
                }}
              >
                {s.error ||
                  (s.done && !dirty
                    ? 'Saved. Your profile is updated everywhere.'
                    : 'You have unsaved changes')}
              </span>
              {dirty ? (
                <>
                  <button
                    type="button"
                    onClick={() => this.discard()}
                    disabled={s.saving}
                    style={ghost}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={() => this.save()}
                    disabled={s.saving}
                    style={{
                      ...ghost,
                      border: 'none',
                      background: GREEN,
                      color: '#062A1B',
                      minWidth: '140px',
                      justifyContent: 'center',
                      opacity: s.saving ? '.7' : '1',
                    }}
                  >
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
