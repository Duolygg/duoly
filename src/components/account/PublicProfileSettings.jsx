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
  encodeHeaderCrop,
  headerFileError,
  loadHeaderImage,
} from './header-image';
import { canvasReady, releasePicked } from './crop-image';
import ImageCropper from './ImageCropper';
import { GAME } from '../../design-reference/lib/games';
import './public-profile-settings.css';

export const splitProfileLabels = (value) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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
        message: data.settings.published
          ? 'Public profile saved.'
          : 'Public profile is off.',
        ...this.headerPatch(data, headerRevision),
      });
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
