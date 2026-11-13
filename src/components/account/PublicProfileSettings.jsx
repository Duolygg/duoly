import React from 'react';
import {
  PROFILE_ACCENTS,
  PROFILE_BANNERS,
  VIBE_TAGS,
  slugFromName,
  slugValid,
  publicProfileSettingsSchema,
} from '../../contracts/teammate-profile';
import {
  HEADER_HEIGHT,
  HEADER_WIDTH,
  dragOffset,
  drawHeader,
  encodeHeader,
  headerCrop,
  headerFileError,
  loadHeaderImage,
} from './header-image';
import { GAME } from '../../design-reference/lib/games';
import './public-profile-settings.css';

export const splitProfileLabels = (value) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
/**
 * The saved header, as far as the settings read tells us. teammate_public_profile_get() does not
 * return it yet (see the note in the header block below), so this is undefined until that one
 * line lands in Postgres, null when there is no header, and the URL when there is one. The
 * endpoint answers with the URL it saved, so an upload in this session is always known.
 */
export const headerFromData = (data) =>
  data && 'header' in data
    ? data.header
    : data?.settings && 'header' in data.settings
      ? data.settings.header
      : undefined;
const request = async (url, options) => {
  const res = await fetch(url, {
    credentials: 'same-origin',
    redirect: 'error',
    ...options,
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error || 'Public profiles are unavailable right now.');
  return data;
};
export default class PublicProfileSettings extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: props.initialData || null,
      settings: props.initialData?.settings || null,
      error: '',
      message: '',
      saving: false,
      explain: false,
      consented: false,
      availability: '',
      /** undefined while the settings read does not carry it, null when there is none. */
      header: headerFromData(props.initialData),
      pick: null,
      headerError: '',
      headerNote: '',
      headerBusy: false,
    };
    this.headerFile = React.createRef();
    this.headerCanvas = React.createRef();
  }
  componentDidMount() {
    this.unmounted = false;
    if (!this.state.data) this.load();
  }
  componentWillUnmount() {
    this.unmounted = true;
  }
  async load() {
    try {
      const data = await request('/api/teammate/public-profile');
      if (!this.unmounted)
        this.setState({
          data,
          settings: {
            ...data.settings,
            slug: data.settings.slug || slugFromName(this.props.name),
          },
          error: '',
          ...this.headerPatch(data),
        });
    } catch (e) {
      if (!this.unmounted) this.setState({ error: e.message });
    }
  }
  /** Keeps a header we already know about when the payload says nothing about one. */
  headerPatch(data) {
    const header = headerFromData(data);
    return header === undefined ? {} : { header };
  }
  change(key, value) {
    this.setState((s) => ({
      settings: { ...s.settings, [key]: value },
      message: '',
      availability: key === 'slug' ? '' : s.availability,
    }));
  }
  togglePublish() {
    if (!this.state.settings.published && !this.state.consented)
      return this.setState({ explain: true });
    this.change('published', !this.state.settings.published);
  }
  async checkLink() {
    const slug = this.state.settings.slug;
    if (!slugValid(slug))
      return this.setState({
        availability:
          'Pick 3 to 24 lowercase letters, numbers or single hyphens.',
      });
    try {
      const data = await request(
        '/api/teammate/public-profile?slug=' + encodeURIComponent(slug),
      );
      if (this.state.settings.slug === slug)
        this.setState({
          availability: data.available
            ? 'This link is available.'
            : 'That link is unavailable. Try another.',
        });
    } catch (e) {
      this.setState({ availability: e.message });
    }
  }
  async save(e) {
    e.preventDefault();
    const parsed = publicProfileSettingsSchema.safeParse(this.state.settings);
    if (!parsed.success)
      return this.setState({
        error: 'Check your link, tags, roles and picks before saving.',
      });
    this.setState({ saving: true, error: '', message: '' });
    try {
      const data = await request('/api/teammate/public-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed.data, csrf: this.props.csrf }),
      });
      this.setState({
        data,
        settings: data.settings,
        saving: false,
        message: data.settings.published
          ? 'Public profile saved.'
          : 'Public profile is off.',
        ...this.headerPatch(data),
      });
    } catch (e) {
      this.setState({ saving: false, error: e.message });
    }
  }
  /* ---------- header image ---------- */
  /** Decodes the picked file and opens the crop on the centre of it. */
  async pickHeader(file) {
    const problem = headerFileError(file);
    if (problem) return this.setState({ headerError: problem, headerNote: '' });
    this.setState({ headerError: '', headerNote: '' });
    try {
      const image = await loadHeaderImage(file);
      if (this.unmounted) return;
      this.setState({ pick: { image, offsetX: 0.5, offsetY: 0.5 } }, () =>
        this.paintHeader(),
      );
    } catch (e) {
      if (!this.unmounted) this.setState({ headerError: e.message });
    }
  }
  paintHeader() {
    const canvas = this.headerCanvas.current;
    const pick = this.state.pick;
    if (canvas && pick)
      drawHeader(canvas, pick.image, pick.offsetX, pick.offsetY);
  }
  /** How much of the picture lies outside the 3:1 window, and the preview's own scale. */
  headerRoom() {
    const pick = this.state.pick;
    const canvas = this.headerCanvas.current;
    if (!pick) return null;
    const crop = headerCrop(pick.image.naturalWidth, pick.image.naturalHeight);
    const box = canvas?.getBoundingClientRect().width || HEADER_WIDTH;
    return {
      scale: crop.sw / box,
      x: pick.image.naturalWidth - crop.sw,
      y: pick.image.naturalHeight - crop.sh,
    };
  }
  /** Moves the crop by a pointer or key movement measured in preview pixels. */
  moveHeader(dx, dy) {
    const pick = this.state.pick;
    const room = this.headerRoom();
    if (!pick || !room) return;
    this.setState(
      {
        pick: {
          ...pick,
          offsetX: dragOffset(pick.offsetX, dx, room.scale, room.x),
          offsetY: dragOffset(pick.offsetY, dy, room.scale, room.y),
        },
      },
      () => this.paintHeader(),
    );
  }
  async uploadHeader() {
    const canvas = this.headerCanvas.current;
    if (!canvas || !this.state.pick) return;
    this.setState({ headerBusy: true, headerError: '', headerNote: '' });
    // Safari cannot encode WebP from a canvas and hands back a PNG; JPEG works everywhere.
    const encoded = encodeHeader((quality) => {
      const webp = canvas.toDataURL('image/webp', quality);
      return webp.startsWith('data:image/webp;')
        ? webp
        : canvas.toDataURL('image/jpeg', quality);
    });
    if (!encoded.ok)
      return this.setState({
        headerBusy: false,
        headerError:
          encoded.reason === 'format'
            ? 'This browser could not save the picture. Try another browser.'
            : 'That picture stays over 300 KB even at low quality. Try one with less fine detail.',
      });
    try {
      const data = await request('/api/teammate/profile-header', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf: this.props.csrf, image: encoded.url }),
      });
      if (!this.unmounted)
        this.setState({
          header: data.url,
          pick: null,
          headerBusy: false,
          headerNote: 'Header saved.',
        });
    } catch (e) {
      if (!this.unmounted)
        this.setState({ headerBusy: false, headerError: e.message });
    }
  }
  async removeHeader() {
    this.setState({ headerBusy: true, headerError: '', headerNote: '' });
    try {
      await request('/api/teammate/profile-header', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf: this.props.csrf }),
      });
      if (!this.unmounted)
        this.setState({
          header: null,
          pick: null,
          headerBusy: false,
          headerNote: 'Header removed.',
        });
    } catch (e) {
      if (!this.unmounted)
        this.setState({ headerBusy: false, headerError: e.message });
    }
  }
  /**
   * Pick, crop, upload, replace, remove. The picture never leaves the browser uncropped: the
   * canvas below is the 1500 by 500 strip that gets encoded, so what the teammate positions here
   * is exactly what the endpoint stores.
   */
  renderHeader() {
    const { header, pick, headerBusy } = this.state;
    const crop = pick
      ? headerCrop(pick.image.naturalWidth, pick.image.naturalHeight)
      : null;
    /** A picture that is already 3:1 has nothing to slide, so it says so instead of inviting a drag. */
    const movable = Boolean(
      crop &&
      (pick.image.naturalWidth - crop.sw > 1 ||
        pick.image.naturalHeight - crop.sh > 1),
    );
    return (
      <fieldset className="pp-header">
        <legend>Header image</legend>
        <p className="pp-help">Your header is shown on your public profile.</p>
        {this.state.headerError ? (
          <p role="alert" className="pp-error">
            {this.state.headerError}
          </p>
        ) : null}
        {pick ? (
          <>
            <canvas
              className="pp-header-art pp-header-crop"
              ref={this.headerCanvas}
              width={HEADER_WIDTH}
              height={HEADER_HEIGHT}
              role="img"
              aria-label="Header crop"
              aria-describedby="pp-header-hint"
              tabIndex={movable ? 0 : -1}
              onPointerDown={(e) => {
                if (!movable) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                this.drag = { x: e.clientX, y: e.clientY };
              }}
              onPointerMove={(e) => {
                if (!this.drag) return;
                const dx = e.clientX - this.drag.x;
                const dy = e.clientY - this.drag.y;
                this.drag = { x: e.clientX, y: e.clientY };
                this.moveHeader(dx, dy);
              }}
              onPointerUp={() => {
                this.drag = null;
              }}
              onPointerCancel={() => {
                this.drag = null;
              }}
              onKeyDown={(e) => {
                const step = 16;
                const by = {
                  ArrowLeft: [-step, 0],
                  ArrowRight: [step, 0],
                  ArrowUp: [0, -step],
                  ArrowDown: [0, step],
                }[e.key];
                if (!by || !movable) return;
                e.preventDefault();
                this.moveHeader(by[0], by[1]);
              }}
            />
            <p className="pp-help" id="pp-header-hint">
              {movable
                ? 'Drag the picture to position it, or use the arrow keys. Duoly saves the strip you see, 1500 by 500 pixels.'
                : 'This picture already fits the strip. Duoly saves it at 1500 by 500 pixels.'}
            </p>
            <div className="pp-actions">
              <button
                type="button"
                className="pp-button pp-primary"
                disabled={headerBusy}
                onClick={() => this.uploadHeader()}
              >
                {headerBusy ? 'Uploading…' : 'Upload header'}
              </button>
              <button
                type="button"
                className="pp-button"
                disabled={headerBusy}
                onClick={() => this.setState({ pick: null, headerError: '' })}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {header ? (
              <img
                className="pp-header-art"
                src={header}
                width={HEADER_WIDTH}
                height={HEADER_HEIGHT}
                alt="Your header image"
              />
            ) : (
              <p className="pp-help">
                {header === null
                  ? 'You have no header yet. A header is optional.'
                  : 'Pick a picture to set your header. Your public profile shows the header you have now.'}
              </p>
            )}
            <div className="pp-actions">
              <button
                type="button"
                className="pp-button"
                disabled={headerBusy}
                onClick={() => this.headerFile.current.click()}
              >
                {header ? 'Replace header' : 'Choose a picture'}
              </button>
              {/* Removing stays available while the settings read cannot tell us whether there
                  is a header, so nobody is stuck with one they cannot see from here. */}
              {header === null ? null : (
                <button
                  type="button"
                  className="pp-button"
                  disabled={headerBusy}
                  onClick={() => this.removeHeader()}
                >
                  {headerBusy ? 'Working…' : 'Remove header'}
                </button>
              )}
            </div>
          </>
        )}
        <input
          ref={this.headerFile}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: 'none' }}
          data-header-file
          onChange={(e) => {
            this.pickHeader(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <p className="pp-help" role="status">
          {this.state.headerNote}
        </p>
      </fieldset>
    );
  }
  render() {
    const { settings: s, data: d } = this.state;
    /** A page a visitor can actually open right now: published, not hidden, real link. */
    const live = Boolean(
      d?.settings.published && !d.hidden && slugValid(d.settings.slug || ''),
    );
    return (
      <section className="pp-settings" aria-labelledby="pp-heading">
        <div className="pp-settings-heading">
          <h2 id="pp-heading">Public profile</h2>
          <span>{d?.settings.published ? 'On' : 'Off'}</span>
        </div>
        {/* On by default since the owner decision of 2026-11-12: every teammate approved for a
            game already has a page, so the block opens by telling them it is live, and the
            first control under it is the one that turns it off. */}
        <p className="pp-help">
          {d?.settings.published === false
            ? 'Your profile is off, so nobody can open it. Switch it back on below to let players find your games, your ranks and your play style.'
            : 'Your profile is on, so players can find your games, your ranks and your play style, and book you by name.'}{' '}
          Bio and languages use the fields above.
        </p>
        <p className="pp-help">
          Email, Discord, full real name and earnings are never shown. Your
          public display name uses the first part of your name above. Your
          profile can be switched off any time.
        </p>
        {this.state.error ? (
          <p role="alert" className="pp-error">
            {this.state.error}
          </p>
        ) : null}
        {!s ? (
          <button
            type="button"
            className="pp-button"
            onClick={() => this.load()}
          >
            Load public profile settings
          </button>
        ) : (
          <form onSubmit={(e) => this.save(e)}>
            {d.hidden ? (
              <p role="status" className="pp-error">
                Support has hidden this profile. Contact support before
                publishing again.
              </p>
            ) : null}
            <label className="pp-switch">
              <input
                type="checkbox"
                checked={s.published}
                onChange={() => this.togglePublish()}
              />
              Show my public profile
            </label>
            {/* The page as it is saved right now, not as the unsaved form would make it. */}
            {live ? (
              <p className="pp-help pp-live">
                Your page is live at{' '}
                <a href={'/teammates/' + d.settings.slug}>
                  duoly.gg/teammates/{d.settings.slug}
                </a>
                . Switch it off above and save to take it down straight away.
              </p>
            ) : null}
            {this.state.explain ? (
              <div
                className="pp-explainer"
                role="region"
                aria-label="Before you publish"
              >
                <h3>Before you publish</h3>
                <p>
                  Your display name, avatar, bio, languages, games, verified
                  ranks, play style and eligible session stats will be public.
                  Country is optional. Email, Discord, full real name and
                  earnings stay private. Switch off and save to remove your
                  profile immediately.
                </p>
                <div className="pp-actions">
                  <button
                    type="button"
                    className="pp-button pp-primary"
                    onClick={() => {
                      this.setState({ consented: true, explain: false });
                      this.change('published', true);
                    }}
                  >
                    I understand, enable my profile
                  </button>
                  <button
                    type="button"
                    className="pp-button"
                    onClick={() => this.setState({ explain: false })}
                  >
                    Keep it off
                  </button>
                </div>
              </div>
            ) : null}
            <div className="pp-field">
              <label htmlFor="pp-slug">Profile link</label>
              <div className="pp-link-row">
                <span>duoly.gg/teammates/</span>
                <input
                  id="pp-slug"
                  maxLength={24}
                  value={s.slug}
                  onChange={(e) => this.change('slug', e.target.value)}
                  spellCheck={false}
                  autoCapitalize="none"
                />
                <button
                  type="button"
                  className="pp-button"
                  onClick={() => this.checkLink()}
                >
                  Check link
                </button>
              </div>
              <p className="pp-help" aria-live="polite">
                {this.state.availability ||
                  '3 to 24 lowercase letters, numbers or single hyphens. Old links redirect after a rename.'}
              </p>
            </div>
            <div className="pp-field">
              <label htmlFor="pp-featured">Featured game</label>
              <select
                id="pp-featured"
                value={s.featuredGame}
                onChange={(e) => this.change('featuredGame', e.target.value)}
              >
                {d.approvedGames.map((g) => (
                  <option key={g} value={g}>
                    {GAME[g]?.name || g}
                  </option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend>Accent</legend>
              <div className="pp-swatches">
                {Object.entries(PROFILE_ACCENTS).map(([key, color]) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={key}
                    aria-pressed={s.accent === key}
                    style={{ '--pp-swatch': color }}
                    onClick={() => this.change('accent', key)}
                  >
                    <span />
                    {key}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Banner</legend>
              <div className="pp-chips">
                {PROFILE_BANNERS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className="pp-button"
                    aria-pressed={s.banner === b}
                    onClick={() => this.change('banner', b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </fieldset>
            {this.renderHeader()}
            <fieldset>
              <legend>
                Vibe tags <span className="pp-help">up to 3</span>
              </legend>
              <div className="pp-chips">
                {VIBE_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="pp-button"
                    aria-pressed={s.vibeTags.includes(t)}
                    disabled={!s.vibeTags.includes(t) && s.vibeTags.length >= 3}
                    onClick={() =>
                      this.change(
                        'vibeTags',
                        s.vibeTags.includes(t)
                          ? s.vibeTags.filter((x) => x !== t)
                          : [...s.vibeTags, t],
                      )
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="pp-options">
              <label>
                <input
                  type="checkbox"
                  checked={s.showCountry}
                  onChange={(e) => this.change('showCountry', e.target.checked)}
                />
                Show my country
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={s.coaching}
                  onChange={(e) => this.change('coaching', e.target.checked)}
                />
                Offer coaching
              </label>
            </div>
            <fieldset>
              <legend>Your games</legend>
              {s.games.map((g, i) => {
                const rank = d.ranks.find((r) => r.game === g.game);
                return (
                  <div key={g.game} className="pp-game">
                    <h3>{GAME[g.game]?.name || g.game}</h3>
                    <p className="pp-help">
                      {rank?.rank
                        ? `${rank.rank}${rank.verified ? ' · Verified' : ''}${rank.peakRank ? ` · Peak ${rank.peakRank}` : ''}`
                        : 'Rank not verified yet'}
                      . Ask support to update.
                    </p>
                    <div className="pp-field">
                      <label htmlFor={'pp-roles-' + g.game}>
                        Roles{' '}
                        <span className="pp-help">
                          up to 3, comma separated
                        </span>
                      </label>
                      <input
                        id={'pp-roles-' + g.game}
                        defaultValue={g.roles.join(', ')}
                        key={'roles-' + g.game}
                        onChange={(e) =>
                          this.change(
                            'games',
                            s.games.map((x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    roles: splitProfileLabels(e.target.value),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="pp-field">
                      <label htmlFor={'pp-picks-' + g.game}>
                        Agents, champions or heroes{' '}
                        <span className="pp-help">
                          up to 5, comma separated
                        </span>
                      </label>
                      <input
                        id={'pp-picks-' + g.game}
                        defaultValue={g.picks.join(', ')}
                        key={'picks-' + g.game}
                        onChange={(e) =>
                          this.change(
                            'games',
                            s.games.map((x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    picks: splitProfileLabels(e.target.value),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </fieldset>
            <div className="pp-actions">
              <button
                type="submit"
                className="pp-button pp-primary"
                disabled={this.state.saving || !d.approvedGames.length}
              >
                {this.state.saving ? 'Saving…' : 'Save public profile'}
              </button>
              {live ? (
                <a href={'/teammates/' + d.settings.slug}>
                  View public profile
                </a>
              ) : null}
              <span role="status">{this.state.message}</span>
            </div>
          </form>
        )}
      </section>
    );
  }
}
