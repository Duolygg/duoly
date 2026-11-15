import React from 'react';
import {
  PROFILE_ACCENTS,
  PROFILE_BANNERS,
  VIBE_TAGS,
  VIBE_TAGS_MAX,
  featuredGamesOf,
  slugFromName,
  slugValid,
  publicProfileSettingsSchema,
} from '../../contracts/teammate-profile';
import {
  HEADER_HEIGHT,
  HEADER_WIDTH,
  encodeHeaderCrop,
  headerFileError,
  loadHeaderImage,
} from './header-image';
import { canvasReady, releasePicked } from './crop-image';
import ImageCropper from './ImageCropper';
import GameCards from './GameCards';
import './public-profile-settings.css';
import './profile-pickers.css';

/**
 * Everything a teammate can change in this block, in one comparable string, so the bar at the
 * bottom knows whether there is anything to save. Compared against what the last read or save
 * handed back, which is the only thing that is actually published.
 */
export const settingsFingerprint = (s) =>
  s
    ? JSON.stringify([
        s.published,
        s.slug,
        s.accent,
        s.banner,
        s.featuredGame,
        s.featuredGames,
        s.vibeTags,
        s.showCountry,
        s.coaching,
        (s.games ?? []).map((g) => [g.game, g.roles, g.picks]),
      ])
    : '';
/** The settings read carries a top-level header. Missing fields in older responses leave it unknown. */
export const headerFromData = (data) =>
  data && 'header' in data
    ? data.header
    : data?.settings && 'header' in data.settings
      ? data.settings.header
      : undefined;
const request = async (url, options) => {
  let res;
  try {
    res = await fetch(url, {
      credentials: 'same-origin',
      redirect: 'error',
      ...options,
    });
  } catch {
    throw new Error(
      'The request could not reach Duoly. Check your connection and try again.',
    );
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      'The server returned an unreadable response. Reload and try again.',
    );
  }
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
      headerPreviewError: '',
      headerNote: '',
      headerBusy: false,
      /** True for a moment after a save, so the bar can confirm it before it goes quiet. */
      justSaved: false,
    };
    this.headerRevision = 0;
    this.headerFile = React.createRef();
    this.headerPreview = React.createRef();
  }
  componentDidMount() {
    this.unmounted = false;
    if (!this.state.data) this.load();
    const image = this.headerPreview.current;
    if (image?.complete && !image.naturalWidth) this.headerPreviewFailed();
    this.showArt();
  }
  componentDidUpdate(_, previous) {
    if (
      previous.header !== this.state.header ||
      previous.pick !== this.state.pick
    )
      this.showArt();
  }
  /**
   * Keeps the page's profile preview card in step: the saved header once there is one, the
   * frame itself while a new one is being positioned, and nothing when there is no header.
   * The card lives on the profile screen, so a page without one simply does not ask.
   */
  showArt(live) {
    const report = this.props.onHeaderArt;
    if (!report) return;
    const pick = this.state.pick;
    if (live?.box && pick)
      return report({
        src: pick.url,
        box: live.box,
        naturalWidth: pick.image.naturalWidth,
        naturalHeight: pick.image.naturalHeight,
      });
    report(this.state.header ? { src: this.state.header } : null);
  }
  componentWillUnmount() {
    this.unmounted = true;
    releasePicked(this.state.pick);
    clearTimeout(this.savedTimer);
  }
  /** True when the form holds something the published page does not. */
  dirty() {
    return (
      settingsFingerprint(this.state.settings) !==
      settingsFingerprint(this.state.data?.settings)
    );
  }
  /** Puts the form back to what is published right now. */
  discard() {
    const saved = this.state.data?.settings;
    if (!saved) return;
    this.setState({
      settings: { ...saved, slug: saved.slug || slugFromName(this.props.name) },
      error: '',
      message: '',
      justSaved: false,
    });
  }
  /** Ends the crop and lets go of the picked file. */
  clearPick(patch) {
    releasePicked(this.state.pick);
    this.setState({ pick: null, ...patch });
  }
  async load() {
    const headerRevision = this.headerRevision;
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
          ...this.headerPatch(data, headerRevision),
        });
    } catch (e) {
      if (!this.unmounted) this.setState({ error: e.message });
    }
  }
  /** Keeps a header we already know about when the payload says nothing about one. */
  headerPatch(data, revision) {
    if (revision !== this.headerRevision) return {};
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
  feature(games) {
    if (!games.length) return;
    this.setState((s) => ({
      settings: { ...s.settings, featuredGames: games, featuredGame: games[0] },
      message: '',
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
    const featuredGames = featuredGamesOf(this.state.settings || {});
    const parsed = publicProfileSettingsSchema.safeParse({
      ...this.state.settings,
      featuredGames,
      featuredGame: featuredGames[0],
    });
    if (!parsed.success)
      return this.setState({
        error: 'Check your link, tags, roles and picks before saving.',
      });
    const headerRevision = this.headerRevision;
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
        justSaved: true,
        message: data.settings.published
          ? 'Public profile saved.'
          : 'Public profile is off.',
        ...this.headerPatch(data, headerRevision),
      });
      clearTimeout(this.savedTimer);
      this.savedTimer = setTimeout(() => {
        if (!this.unmounted) this.setState({ justSaved: false });
      }, 2600);
    } catch (e) {
      this.setState({ saving: false, error: e.message });
    }
  }
  /* ---------- header image ---------- */
  headerPreviewFailed() {
    this.setState({
      headerPreviewError:
        'Your header is saved, but the picture could not load. Reload or try another picture.',
    });
  }
  /** Decodes the picked file and opens the crop on it. */
  async pickHeader(file) {
    const problem = headerFileError(file);
    if (problem) return this.setState({ headerError: problem, headerNote: '' });
    this.setState({ headerError: '', headerNote: '' });
    /* A browser that hands back no canvas context would upload an empty strip, so the pick is
       turned away before the crop opens rather than at the end of it. */
    if (!canvasReady())
      return this.setState({
        headerError:
          'This browser could not prepare the picture. Try a smaller JPG or PNG.',
      });
    try {
      const pick = await loadHeaderImage(file);
      if (this.unmounted) return releasePicked(pick);
      this.clearPick({ pick });
    } catch (e) {
      if (!this.unmounted) this.setState({ headerError: e.message });
    }
  }
  async uploadHeader(area) {
    const pick = this.state.pick;
    if (!pick || !area) return;
    this.setState({ headerBusy: true, headerError: '', headerNote: '' });
    // Safari cannot encode WebP from a canvas and hands back a PNG; JPEG works everywhere.
    let encoded;
    try {
      encoded = encodeHeaderCrop(pick.image, area);
    } catch {
      return this.setState({
        headerBusy: false,
        headerError:
          'This browser could not prepare the picture. Try a smaller JPG or PNG.',
      });
    }
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
      this.headerRevision++;
      if (!this.unmounted)
        this.clearPick({
          header: data.url,
          headerPreviewError: '',
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
      this.headerRevision++;
      if (!this.unmounted)
        this.clearPick({
          header: null,
          headerPreviewError: '',
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
   * frame below is the 1500 by 500 strip that gets encoded, so what the teammate positions here
   * is exactly what the endpoint stores.
   */
  renderHeader() {
    const { header, pick, headerBusy } = this.state;
    // Without a saved profile there is nothing to attach a header to; a saved profile always has a slug.
    if (!this.state.data?.settings?.slug)
      return (
        <fieldset className="pp-header">
          <legend>Header image</legend>
          <p className="pp-help" data-header-locked>
            Save your public profile once, then you can add a header image.
          </p>
        </fieldset>
      );
    return (
      <fieldset className="pp-header">
        <legend>Header image</legend>
        {/* While the strip is being framed the cropper carries the only line of instructions,
            so this one steps aside rather than saying the same thing twice. */}
        {pick ? null : (
          <p className="pp-help">
            Your header is shown on your public profile.
          </p>
        )}
        {this.state.headerError || this.state.headerPreviewError ? (
          <p role="alert" className="pp-error">
            {this.state.headerError || this.state.headerPreviewError}
          </p>
        ) : null}
        {pick ? (
          <ImageCropper
            src={pick.url}
            shape="rect"
            aspect={HEADER_WIDTH / HEADER_HEIGHT}
            naturalWidth={pick.image.naturalWidth}
            naturalHeight={pick.image.naturalHeight}
            minRatio={1.2}
            maxRatio={2.8}
            maxStageWidth={560}
            maxStageHeight={420}
            label="Header crop"
            saveLabel="Save header"
            busyLabel="Saving…"
            cancelLabel="Cancel"
            busy={headerBusy}
            onPreview={(area) => this.showArt({ box: area })}
            onSave={(area) => this.uploadHeader(area)}
            onCancel={() => this.clearPick({ headerError: '' })}
          />
        ) : (
          <>
            {header ? (
              <img
                className="pp-header-art"
                src={header}
                width={HEADER_WIDTH}
                height={HEADER_HEIGHT}
                alt="Your header image"
                ref={this.headerPreview}
                onError={() => this.headerPreviewFailed()}
                onLoad={() => this.setState({ headerPreviewError: '' })}
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
    const dirty = this.dirty();
    const barState = this.state.saving
      ? 'saving'
      : dirty
        ? 'dirty'
        : this.state.justSaved
          ? 'saved'
          : 'clean';
    return (
      <section className="pp-settings pk-scope" aria-labelledby="pp-heading">
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
            {/* The work a teammate came here to do, above the blocks that only change how the
                page looks, and under the same section heading as all of them. See GameCards. */}
            <div className="pk-group">
              <h3>Your games</h3>
              <p>
                Featured games lead your profile. Put the one you want shown
                first at the top.
              </p>
              <GameCards
                games={s.games}
                ranks={d.ranks}
                featuredGames={featuredGamesOf(s)}
                onChange={(games) => this.change('games', games)}
                onFeature={(games) => this.feature(games)}
              />
            </div>
            {/* Everything that only changes how the page looks, under one heading, so the
                games above it are the section rather than one of five equal blocks. */}
            <div className="pk-group">
              <h3>Look</h3>
              <p>
                Colour, pattern and the picture across the top of your page.
              </p>
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
                <div className="pk-row">
                  {PROFILE_BANNERS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      className="pk-chip"
                      aria-pressed={s.banner === b}
                      onClick={() => this.change('banner', b)}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </fieldset>
              {this.renderHeader()}
            </div>
            <div className="pk-group">
              <h3>Vibe tags</h3>
              <p>
                How a session with you feels. Up to {VIBE_TAGS_MAX} of them.
              </p>
              <div className="pk-row">
                {VIBE_TAGS.map((t) => {
                  const on = s.vibeTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className="pk-chip"
                      aria-pressed={on}
                      disabled={!on && s.vibeTags.length >= VIBE_TAGS_MAX}
                      onClick={() =>
                        this.change(
                          'vibeTags',
                          on
                            ? s.vibeTags.filter((x) => x !== t)
                            : [...s.vibeTags, t],
                        )
                      }
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <p className="pk-hint">
                <span
                  className="pk-count"
                  data-full={String(s.vibeTags.length >= VIBE_TAGS_MAX)}
                  aria-live="polite"
                >
                  {s.vibeTags.length} / {VIBE_TAGS_MAX}
                </span>
                {s.vibeTags.length >= VIBE_TAGS_MAX
                  ? ' · Remove one to add another.'
                  : ''}
              </p>
            </div>
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
            {live ? (
              <div className="pp-actions">
                <a href={'/teammates/' + d.settings.slug}>
                  View public profile
                </a>
              </div>
            ) : null}
            {/* One bar, always under the block, so the state of the page is never a guess: it
                says whether anything is unsaved, and it is the only thing that publishes. */}
            <div
              className="pk-bar"
              data-state={barState}
              role="group"
              aria-label="Save your public profile"
            >
              <span className="pk-bar-text">
                <span className="pk-dot" />
                <span role="status">
                  {barState === 'saving'
                    ? 'Saving your profile'
                    : barState === 'dirty'
                      ? 'Unsaved changes'
                      : barState === 'saved'
                        ? this.state.message
                        : 'Everything here is saved.'}
                </span>
              </span>
              <span className="pk-bar-actions">
                {dirty ? (
                  <button
                    type="button"
                    className="pk-button"
                    disabled={this.state.saving}
                    onClick={() => this.discard()}
                  >
                    Discard
                  </button>
                ) : null}
                <button
                  type="submit"
                  className="pk-button pk-button-primary"
                  disabled={
                    this.state.saving || !dirty || !d.approvedGames.length
                  }
                >
                  {this.state.saving ? 'Saving…' : 'Save public profile'}
                </button>
              </span>
            </div>
          </form>
        )}
      </section>
    );
  }
}
