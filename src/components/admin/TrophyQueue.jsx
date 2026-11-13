import React from 'react';
import { RARITIES, RARITY_LABEL } from '../../contracts/trophies';
import { trophyView } from '../../contracts/trophy-display';
import { GAME } from '../../design-reference/lib/games';
import {
  C,
  btn,
  chip,
  input,
  dateOnly,
} from '../../design-reference/components/admin/ui';

// Trophy review: teammates send ranks, leaderboard spots, tournament results and titles with a
// screenshot (private, shown here through a short-lived link) or a proof link. Approving puts the
// trophy on the public profile; the rarity decides how loud it looks there and can be raised or
// lowered here. Rejecting needs a note, because the teammate sees it.
const STATUSES = [
  ['pending', 'Waiting'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
];
const gameName = (id) => GAME[id]?.name || id;

export default class TrophyQueue extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      status: 'pending',
      rows: null,
      error: '',
      busy: '',
      edits: {},
      zoom: null,
    };
  }
  componentDidMount() {
    this.load();
  }
  componentWillUnmount() {
    this.unmounted = true;
  }
  async load(status = this.state.status) {
    const res = await this.props.api.get(
      '/api/admin/trophies?status=' + status,
    );
    if (this.unmounted || status !== this.state.status) return;
    if (!res.ok) return this.setState({ error: res.error, rows: [] });
    this.setState({ rows: res.data.trophies || [], error: '' });
  }
  edit(id, patch) {
    this.setState((s) => ({
      edits: { ...s.edits, [id]: { ...s.edits[id], ...patch } },
    }));
  }
  async review(t, decision) {
    const e = this.state.edits[t.id] || {};
    const note = (e.note || '').trim();
    if (decision === 'rejected' && !note)
      return this.edit(t.id, {
        problem: 'Say why. The teammate sees this note.',
      });
    this.setState({ busy: t.id, error: '' });
    const res = await this.props.api.post('/api/admin/trophies', {
      action: 'review',
      id: t.id,
      decision,
      rarity: e.rarity || t.rarity,
      note: note || null,
    });
    if (this.unmounted) return;
    if (!res.ok) return this.setState({ busy: '', error: res.error });
    this.setState((s) => ({
      busy: '',
      rows: s.rows.filter((r) => r.id !== t.id),
    }));
    this.props.log?.();
  }
  renderRow(t) {
    const s = this.state;
    const e = s.edits[t.id] || {};
    const view = trophyView(t, gameName(t.game));
    const busy = s.busy === t.id;
    return (
      <li
        key={t.id}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '18px',
          padding: '16px',
          borderRadius: '16px',
          border: '1px solid ' + C.line,
          background: 'rgba(13, 7, 25, .55)',
          alignItems: 'start',
        }}
      >
        <img
          src={view.art}
          alt=""
          width="88"
          height="88"
          style={{ objectFit: 'contain', flex: 'none' }}
        />
        <div style={{ minWidth: 0, flex: '1 1 280px' }}>
          <p style={{ margin: 0, fontSize: '12.5px', color: C.muted }}>
            {view.eyebrow}
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: '20px',
              fontWeight: 700,
              color: C.white,
            }}
          >
            {view.name}
          </p>
          {view.meta ? (
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: C.text }}>
              {view.meta}
            </p>
          ) : null}
          <p style={{ margin: '10px 0 0', fontSize: '13px', color: C.muted }}>
            {t.teammate}
            {t.slug ? (
              <>
                {' · '}
                <a
                  href={'/teammates/' + t.slug}
                  target="_blank"
                  rel="noopener"
                  style={{ color: C.accent }}
                >
                  /teammates/{t.slug}
                </a>
              </>
            ) : null}
            {' · sent '}
            {dateOnly(t.createdAt)}
          </p>
          {t.note ? (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '13px',
                color: C.text,
                whiteSpace: 'pre-wrap',
              }}
            >
              “{t.note}”
            </p>
          ) : null}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              marginTop: '12px',
              alignItems: 'center',
            }}
          >
            {t.proofImage ? (
              <button
                type="button"
                onClick={() => this.setState({ zoom: t.proofImage })}
                style={{
                  padding: 0,
                  border: '1px solid ' + C.line2,
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: 'none',
                  cursor: 'zoom-in',
                }}
                aria-label="Open the screenshot"
              >
                <img
                  src={t.proofImage}
                  alt="Proof screenshot"
                  style={{
                    display: 'block',
                    width: '300px',
                    maxWidth: '100%',
                    height: '169px',
                    objectFit: 'cover',
                  }}
                />
              </button>
            ) : (
              <span style={{ fontSize: '13px', color: C.muted }}>
                {t.hasImage
                  ? 'Screenshot could not be loaded.'
                  : 'No screenshot, link only.'}
              </span>
            )}
            {t.proofUrl ? (
              <a
                href={t.proofUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                style={{
                  color: C.accent,
                  fontSize: '13px',
                  overflowWrap: 'anywhere',
                }}
              >
                {t.proofUrl}
              </a>
            ) : null}
          </div>
          {t.reviewNote && s.status !== 'pending' ? (
            <p style={{ margin: '10px 0 0', fontSize: '13px', color: C.muted }}>
              Note: {t.reviewNote}
            </p>
          ) : null}
        </div>
        <div
          style={{
            display: 'grid',
            gap: '10px',
            flex: '1 1 220px',
            maxWidth: '320px',
          }}
        >
          <label style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
            How it shows
            <select
              style={{ ...input, width: '100%' }}
              value={e.rarity || t.rarity}
              onChange={(ev) => this.edit(t.id, { rarity: ev.target.value })}
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {RARITY_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
            Note for the teammate
            <input
              style={{ ...input, width: '100%', boxSizing: 'border-box' }}
              maxLength={300}
              value={e.note || ''}
              placeholder={
                s.status === 'approved'
                  ? 'Required to take it down'
                  : 'Required to reject'
              }
              onChange={(ev) =>
                this.edit(t.id, { note: ev.target.value, problem: '' })
              }
            />
          </label>
          {e.problem ? (
            <p
              role="alert"
              style={{ margin: 0, color: C.red, fontSize: '13px' }}
            >
              {e.problem}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {s.status !== 'approved' ? (
              <button
                type="button"
                style={btn('good')}
                disabled={busy}
                onClick={() => this.review(t, 'approved')}
              >
                Approve
              </button>
            ) : null}
            {s.status !== 'rejected' ? (
              <button
                type="button"
                style={btn('danger')}
                disabled={busy}
                onClick={() => this.review(t, 'rejected')}
              >
                {s.status === 'approved' ? 'Take down' : 'Reject'}
              </button>
            ) : null}
          </div>
        </div>
      </li>
    );
  }
  render() {
    const s = this.state;
    return (
      <div>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '14px',
          }}
        >
          {STATUSES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={s.status === id ? 'true' : 'false'}
              style={{ ...chip(s.status === id), minHeight: '36px' }}
              onClick={() =>
                this.setState({ status: id, rows: null, edits: {} }, () =>
                  this.load(id),
                )
              }
            >
              {label}
            </button>
          ))}
          <span style={{ fontSize: '13px', color: C.muted }}>
            Check the name on the proof matches the teammate before approving.
          </span>
        </div>
        {s.error ? (
          <p role="alert" style={{ color: C.red }}>
            {s.error}
          </p>
        ) : null}
        {!s.rows ? (
          <p style={{ color: C.muted }}>Loading trophies…</p>
        ) : s.rows.length ? (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gap: '10px',
            }}
          >
            {s.rows.map((t) => this.renderRow(t))}
          </ul>
        ) : (
          <p style={{ color: C.muted }}>
            {s.status === 'pending'
              ? 'No trophies waiting for review.'
              : 'Nothing here yet.'}
          </p>
        )}
        {s.zoom ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Proof screenshot"
            onClick={() => this.setState({ zoom: null })}
            onKeyDown={(ev) =>
              ev.key === 'Escape' && this.setState({ zoom: null })
            }
            tabIndex={-1}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              display: 'grid',
              placeItems: 'center',
              padding: '24px',
              background: 'rgba(5, 2, 12, .86)',
              cursor: 'zoom-out',
            }}
          >
            <img
              src={s.zoom}
              alt="Proof screenshot"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                borderRadius: '12px',
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }
}
