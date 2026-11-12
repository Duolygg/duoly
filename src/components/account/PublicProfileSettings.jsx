import React from 'react';
import {
  PROFILE_ACCENTS,
  PROFILE_BANNERS,
  VIBE_TAGS,
  slugFromName,
  slugValid,
  publicProfileSettingsSchema,
} from '../../contracts/teammate-profile';
import { GAME } from '../../design-reference/lib/games';
import './public-profile-settings.css';

export const splitProfileLabels = (value) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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
    };
  }
  componentDidMount() {
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
        });
    } catch (e) {
      if (!this.unmounted) this.setState({ error: e.message });
    }
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
      });
    } catch (e) {
      this.setState({ saving: false, error: e.message });
    }
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
