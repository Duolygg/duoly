import React from 'react';
import {
  MAX_TROPHIES,
  RANK_MOMENTS,
  RANK_MOMENT_LABEL,
  TrophySubmissionSchema,
  defaultRarity,
  trophyArt,
  trophyGame,
  trophyLadder,
  trophyTier,
} from '../../contracts/trophies';
import { trophyCrest, trophyView } from '../../contracts/trophy-display';
import { GAME } from '../../design-reference/lib/games';
import './trophy-settings.css';

/**
 * The teammate's own trophy case: pick a game, pick the rank by its emblem (or a leaderboard
 * spot, a tournament placing or a title), add a screenshot or a link that shows it, and send it
 * for review. A live preview shows the trophy as players will see it. Staff check every one
 * before it goes on the public profile.
 */
const KINDS = [
  ['rank', 'Rank'],
  ['leaderboard', 'Leaderboard'],
  ['tournament', 'Tournament'],
  ['title', 'Title'],
];
const STATUS = {
  pending: 'Waiting for review',
  approved: 'On your profile',
  rejected: 'Not approved',
};
const MAX_PICK_BYTES = 20 * 1024 * 1024;
const MAX_PROOF_BYTES = 900 * 1024;
export const gameName = (id) => GAME[id]?.name || id;

/** Kinds a game supports: a rank needs a ladder, a leaderboard spot needs a public leaderboard. */
export function kindsFor(game) {
  const info = trophyGame(game);
  if (!info) return [];
  return KINDS.filter(
    ([k]) =>
      (k !== 'rank' || info.ladders.length > 0) &&
      (k !== 'leaderboard' || Boolean(info.leaderboard)),
  );
}

export function emptyDraft(game) {
  const info = trophyGame(game);
  const ladder = info?.ladders[0];
  return {
    game,
    kind: ladder ? 'rank' : (kindsFor(game)[0]?.[0] ?? 'title'),
    ladder: ladder?.id ?? '',
    tier: '',
    division: '',
    value: '',
    moment: 'peak',
    season: '',
    region: '',
    position: '',
    event: '',
    title: '',
    achievedOn: '',
    proofUrl: '',
    note: '',
  };
}

/** The draft as the API takes it: only the fields this kind uses, numbers as numbers. */
export function toSubmission(d) {
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const t = { game: d.game, kind: d.kind, proofUrl: d.proofUrl.trim() || null };
  if (d.note.trim()) t.note = d.note.trim();
  if (d.kind === 'rank')
    Object.assign(t, {
      ladder: d.ladder,
      tier: d.tier,
      division: d.division || null,
      value: num(d.value),
      moment: d.moment,
      season: d.season.trim(),
      region: d.region.trim() || null,
    });
  else if (d.kind === 'leaderboard')
    Object.assign(t, {
      position: num(d.position),
      season: d.season.trim(),
      region: d.region.trim() || null,
    });
  else if (d.kind === 'tournament')
    Object.assign(t, {
      event: d.event.trim(),
      position: num(d.position),
      achievedOn: d.achievedOn || null,
      region: d.region.trim() || null,
    });
  else
    Object.assign(t, {
      title: d.title.trim(),
      achievedOn: d.achievedOn || null,
    });
  return t;
}

/** Shrinks a screenshot into a WebP (or JPEG) data URL under the upload limit. */
async function encodeProof(file) {
  const bitmap = await globalThis.createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const [type, q] of [
    ['image/webp', 0.86],
    ['image/webp', 0.72],
    ['image/jpeg', 0.8],
    ['image/webp', 0.55],
    ['image/jpeg', 0.6],
  ]) {
    const url = canvas.toDataURL(type, q);
    if (!url.startsWith('data:' + type)) continue;
    const bytes = Math.floor(((url.length - url.indexOf(',') - 1) * 3) / 4);
    if (bytes <= MAX_PROOF_BYTES) return url;
  }
  throw new Error('That screenshot is too large. Try a smaller one.');
}

const request = async (url, options) => {
  const res = await fetch(url, {
    credentials: 'same-origin',
    redirect: 'error',
    cache: 'no-store',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data.error || 'Trophies are unavailable right now.');
  return data;
};

function Emblem({ view, size = 96 }) {
  return (
    <span
      className="ts-emblem"
      data-rarity={view.rarity}
      style={{ '--ts-size': size + 'px', '--art': `url("${view.art}")` }}
    >
      <span className="ts-emblem-glow" aria-hidden="true" />
      <img src={view.art} alt="" width={size} height={size} />
      <span className="ts-emblem-shine" aria-hidden="true" />
    </span>
  );
}

export default class TrophySettings extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      trophies: null,
      games: null,
      draft: null,
      image: null,
      imageName: '',
      error: '',
      message: '',
      busy: false,
      adding: false,
    };
  }
  componentDidMount() {
    this.unmounted = false;
    this.load();
  }
  componentWillUnmount() {
    this.unmounted = true;
  }
  async load() {
    try {
      const [own, profile] = await Promise.all([
        request('/api/teammate/trophies'),
        request('/api/teammate/public-profile'),
      ]);
      if (this.unmounted) return;
      const games = (profile.approvedGames || []).filter((g) => trophyGame(g));
      this.setState({ trophies: own.trophies, games, error: '' });
    } catch (e) {
      if (!this.unmounted) this.setState({ error: e.message });
    }
  }
  open(game) {
    this.setState({
      adding: true,
      draft: emptyDraft(game ?? this.state.games[0]),
      image: null,
      imageName: '',
      error: '',
      message: '',
    });
  }
  set(patch) {
    this.setState((s) => ({ draft: { ...s.draft, ...patch }, error: '' }));
  }
  async pickImage(file) {
    if (!file) return;
    if (!/^image\//.test(file.type) || file.size > MAX_PICK_BYTES)
      return this.setState({
        error: 'Pick a screenshot file (PNG, JPG or WebP) under 20 MB.',
      });
    try {
      const image = await encodeProof(file);
      if (!this.unmounted)
        this.setState({ image, imageName: file.name, error: '' });
    } catch (e) {
      if (!this.unmounted)
        this.setState({
          error: e.message || 'That screenshot could not be read.',
        });
    }
  }
  async submit(e) {
    e.preventDefault();
    const s = this.state;
    const parsed = TrophySubmissionSchema.safeParse(toSubmission(s.draft));
    if (!parsed.success)
      return this.setState({
        error: parsed.error.issues[0]?.message || 'Check the trophy details.',
      });
    if (!s.image && !parsed.data.proofUrl)
      return this.setState({
        error: 'Add a screenshot or a link that shows it.',
      });
    this.setState({ busy: true, error: '' });
    try {
      const data = await request('/api/teammate/trophies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf: this.props.csrf,
          action: 'submit',
          trophy: toSubmission(s.draft),
          ...(s.image ? { image: s.image } : {}),
        }),
      });
      this.setState((st) => ({
        busy: false,
        adding: false,
        draft: null,
        image: null,
        trophies: [data.trophy, ...(st.trophies || [])],
        message: 'Sent for review. It goes on your profile once it is checked.',
      }));
    } catch (err) {
      this.setState({ busy: false, error: err.message });
    }
  }
  async remove(t) {
    if (
      !window.confirm(
        t.status === 'approved'
          ? 'Take this trophy off your profile?'
          : 'Remove this trophy?',
      )
    )
      return;
    this.setState({ busy: true, error: '', message: '' });
    try {
      await request('/api/teammate/trophies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf: this.props.csrf,
          action: 'delete',
          id: t.id,
        }),
      });
      this.setState((s) => ({
        busy: false,
        trophies: s.trophies.filter((x) => x.id !== t.id),
      }));
    } catch (err) {
      this.setState({ busy: false, error: err.message });
    }
  }

  /** The draft drawn as the public card will draw it. */
  previewView() {
    const d = this.state.draft;
    const t = toSubmission(d);
    const shaped = {
      id: 'preview',
      ladder: null,
      tier: null,
      division: null,
      moment: null,
      season: null,
      region: null,
      event: null,
      title: null,
      achievedOn: null,
      ...t,
      position:
        Number.isFinite(t.position) && t.position > 0 ? t.position : null,
      value: Number.isFinite(t.value) ? t.value : null,
      proofUrl: null,
      verifiedAt: null,
    };
    let rarity = 'common';
    try {
      rarity = defaultRarity({
        ...shaped,
        position: shaped.position ?? undefined,
      });
    } catch {
      rarity = 'common';
    }
    if (d.kind === 'rank' && !d.tier) return null;
    if (d.kind === 'title' && !d.title.trim()) shaped.title = 'Your title';
    return trophyView({ ...shaped, rarity }, gameName(d.game));
  }

  renderRankFields(d) {
    const info = trophyGame(d.game);
    const ladder = trophyLadder(d.game, d.ladder);
    const tier = trophyTier(d.game, d.ladder, d.tier);
    return (
      <>
        {info.ladders.length > 1 ? (
          <div className="ts-field">
            <span className="ts-label">Ladder</span>
            <div className="pp-chips" role="radiogroup" aria-label="Ladder">
              {info.ladders.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="pp-button"
                  role="radio"
                  aria-checked={d.ladder === l.id ? 'true' : 'false'}
                  aria-pressed={d.ladder === l.id ? 'true' : 'false'}
                  onClick={() =>
                    this.set({ ladder: l.id, tier: '', division: '' })
                  }
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="ts-field">
          <span className="ts-label" id="ts-tier-label">
            Rank
          </span>
          <div
            className="ts-tiers"
            role="radiogroup"
            aria-labelledby="ts-tier-label"
          >
            {(ladder?.tiers || []).map((t) => {
              const art =
                trophyArt(d.game, t.key, 128) ??
                trophyCrest('rank', t.rarity, t.name.slice(0, 1));
              const on = d.tier === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={on ? 'true' : 'false'}
                  className="ts-tier"
                  data-rarity={t.rarity}
                  onClick={() => this.set({ tier: t.key, division: '' })}
                >
                  <img src={art} alt="" width="56" height="56" loading="lazy" />
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        {tier?.divisions?.length ? (
          <div className="ts-field">
            <span className="ts-label">Division</span>
            <div className="pp-chips" role="radiogroup" aria-label="Division">
              {['', ...tier.divisions].map((v) => (
                <button
                  key={v || 'none'}
                  type="button"
                  className="pp-button"
                  role="radio"
                  aria-checked={d.division === v ? 'true' : 'false'}
                  aria-pressed={d.division === v ? 'true' : 'false'}
                  onClick={() => this.set({ division: v })}
                >
                  {v || 'No division'}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="ts-field">
          <span className="ts-label">When you held it</span>
          <div
            className="pp-chips"
            role="radiogroup"
            aria-label="When you held it"
          >
            {RANK_MOMENTS.map((m) => (
              <button
                key={m}
                type="button"
                className="pp-button"
                role="radio"
                aria-checked={d.moment === m ? 'true' : 'false'}
                aria-pressed={d.moment === m ? 'true' : 'false'}
                onClick={() => this.set({ moment: m })}
              >
                {RANK_MOMENT_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="ts-row">
          {this.text('season', 'Season', 40, 'For example Season 2026')}
          {this.text('region', 'Region', 32, 'Optional, for example EU')}
          {ladder?.value
            ? this.text('value', ladder.value, 7, 'Optional', 'number')
            : null}
        </div>
      </>
    );
  }
  text(key, label, max, placeholder, type = 'text') {
    const d = this.state.draft;
    return (
      <label className="ts-field ts-input" key={key}>
        <span className="ts-label">{label}</span>
        <input
          type={type}
          inputMode={type === 'number' ? 'numeric' : undefined}
          min={type === 'number' ? (key === 'value' ? 0 : 1) : undefined}
          maxLength={type === 'number' ? undefined : max}
          placeholder={placeholder}
          value={d[key]}
          onChange={(e) => this.set({ [key]: e.target.value })}
        />
      </label>
    );
  }
  renderForm() {
    const s = this.state;
    const d = s.draft;
    const info = trophyGame(d.game);
    const view = this.previewView();
    return (
      <form className="ts-form" onSubmit={(e) => this.submit(e)} noValidate>
        <div className="ts-form-main">
          <div className="ts-field">
            <span className="ts-label">Game</span>
            <div className="pp-chips" role="radiogroup" aria-label="Game">
              {s.games.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="pp-button"
                  role="radio"
                  aria-checked={d.game === g ? 'true' : 'false'}
                  aria-pressed={d.game === g ? 'true' : 'false'}
                  onClick={() =>
                    d.game !== g &&
                    this.setState({ draft: emptyDraft(g), error: '' })
                  }
                >
                  {gameName(g)}
                </button>
              ))}
            </div>
          </div>
          <div className="ts-field">
            <span className="ts-label">What it is</span>
            <div
              className="ts-kinds"
              role="radiogroup"
              aria-label="Trophy type"
            >
              {kindsFor(d.game).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={d.kind === k ? 'true' : 'false'}
                  className="ts-kind"
                  onClick={() => this.set({ kind: k })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {d.kind === 'rank' ? this.renderRankFields(d) : null}
          {d.kind === 'leaderboard' ? (
            <div className="ts-row">
              {this.text(
                'position',
                `Spot on the ${info.leaderboard}`,
                7,
                'For example 412',
                'number',
              )}
              {this.text('season', 'Season', 40, 'For example Season 2026')}
              {this.text('region', 'Region', 32, 'Optional, for example EU')}
            </div>
          ) : null}
          {d.kind === 'tournament' ? (
            <>
              {this.text('event', 'Tournament', 80, 'Name of the event')}
              <div className="ts-row">
                {this.text(
                  'position',
                  'Placement',
                  5,
                  'For example 1',
                  'number',
                )}
                {this.text('achievedOn', 'Date', 10, '', 'date')}
                {this.text('region', 'Region', 32, 'Optional')}
              </div>
            </>
          ) : null}
          {d.kind === 'title' ? (
            <div className="ts-row">
              {this.text('title', 'Title', 60, 'For example Gladiator')}
              {this.text('achievedOn', 'Date', 10, '', 'date')}
            </div>
          ) : null}

          <div className="ts-field">
            <span className="ts-label">Proof</span>
            <p className="pp-help ts-tight">
              A screenshot of your profile or match history that shows your
              name, or a link to a tracker page. The screenshot stays private. A
              link shows on your profile next to the trophy.
            </p>
            <label className="ts-drop" data-filled={s.image ? '' : undefined}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => this.pickImage(e.target.files?.[0])}
              />
              {s.image ? (
                <>
                  <img src={s.image} alt="Your screenshot" />
                  <span>{s.imageName}. Click to swap it.</span>
                </>
              ) : (
                <span>
                  <b>Add a screenshot</b> or drop it here. PNG, JPG or WebP.
                </span>
              )}
            </label>
            {this.text('proofUrl', 'Or a link', 500, 'https://')}
          </div>
          {this.text(
            'note',
            'Note for the reviewer',
            400,
            'Optional, for example your in-game name',
          )}
        </div>

        <aside className="ts-preview" aria-label="Preview">
          <p className="ts-label">Preview</p>
          {view ? (
            <div className="ts-preview-card">
              <Emblem view={view} size={156} />
              <p className="ts-eyebrow">{view.eyebrow}</p>
              <p className="ts-name">{view.name}</p>
              {view.meta ? <p className="ts-meta">{view.meta}</p> : null}
            </div>
          ) : (
            <p className="pp-help">Pick a rank to see your trophy.</p>
          )}
          {s.error ? (
            <p role="alert" className="pp-error">
              {s.error}
            </p>
          ) : null}
          <div className="pp-actions">
            <button
              type="submit"
              className="pp-button pp-primary"
              disabled={s.busy}
            >
              {s.busy ? 'Sending…' : 'Send for review'}
            </button>
            <button
              type="button"
              className="pp-button"
              disabled={s.busy}
              onClick={() =>
                this.setState({ adding: false, draft: null, error: '' })
              }
            >
              Cancel
            </button>
          </div>
        </aside>
      </form>
    );
  }
  render() {
    const s = this.state;
    const list = s.trophies || [];
    const live = list.filter((t) => t.status !== 'rejected').length;
    const waiting = list.filter((t) => t.status === 'pending').length;
    const full = live >= MAX_TROPHIES;
    return (
      <section className="pp-settings ts" aria-labelledby="ts-heading">
        <div className="pp-settings-heading">
          <h2 id="ts-heading">Trophy case</h2>
          {s.trophies ? (
            <span>
              {live} of {MAX_TROPHIES} trophies
            </span>
          ) : null}
        </div>
        <p className="pp-help">
          Show players your best ranks and results. Each trophy is checked by
          Duoly before it appears on your public profile, rarest first.
        </p>
        {s.message ? (
          <p role="status" className="ts-ok">
            {s.message}
          </p>
        ) : null}
        {!s.trophies && !s.error ? <p className="pp-help">Loading…</p> : null}
        {s.error && !s.adding ? (
          <p role="alert" className="pp-error">
            {s.error}
          </p>
        ) : null}

        {list.length ? (
          <ul className="ts-list">
            {list.map((t) => {
              const view = trophyView(t, gameName(t.game));
              return (
                <li key={t.id} className="ts-item" data-status={t.status}>
                  <Emblem view={view} size={64} />
                  <div className="ts-item-text">
                    <p className="ts-eyebrow">{view.eyebrow}</p>
                    <p className="ts-item-name">{view.name}</p>
                    {view.meta ? <p className="ts-meta">{view.meta}</p> : null}
                    {t.status === 'rejected' && t.reviewNote ? (
                      <p className="ts-why">{t.reviewNote}</p>
                    ) : null}
                  </div>
                  <span className="ts-status" data-status={t.status}>
                    {STATUS[t.status]}
                  </span>
                  <button
                    type="button"
                    className="pp-button"
                    disabled={s.busy}
                    onClick={() => this.remove(t)}
                    aria-label={`Remove ${view.name}`}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {s.games && !s.games.length ? (
          <p className="pp-help">
            Trophies open up once you are approved for a game.
          </p>
        ) : null}
        {s.adding && s.draft ? (
          this.renderForm()
        ) : s.games?.length ? (
          <div className="pp-actions ts-add">
            <button
              type="button"
              className="pp-button pp-primary"
              disabled={full || waiting >= 6}
              onClick={() => this.open()}
            >
              Add a trophy
            </button>
            {full ? (
              <span className="pp-help">
                Your case is full. Remove one to add another.
              </span>
            ) : waiting >= 6 ? (
              <span className="pp-help">
                Six trophies are waiting for review. Add more once they are
                checked.
              </span>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }
}
