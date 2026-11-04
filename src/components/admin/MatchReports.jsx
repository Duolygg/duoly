import React from 'react';
import ProofManager from './ProofManager';
import { GAME as GAMES } from '../../design-reference/lib/games';
import { winrateLabel } from '../../design-reference/lib/winloss';
import {
  C,
  btn,
  chip,
  input,
  dateOnly,
} from '../../design-reference/components/admin/ui';

// Admin, Teammates, Match reports (20261102160000): what teammates reported on win/loss orders,
// every game with both IGNs and the match link. The customer IGN the customer gave on the order
// sits next to the one the teammate typed; a different one is marked, since a made-up report
// usually gets that wrong. Open the match links to check the result.
const STATES = {
  completed: ['Counts', C.green],
  open: ['Still playing', C.cyan],
  handed_over: ['Handed over', C.dim],
  customer_reroll: ['Re-rolled', C.dim],
};
// "Alex#EUW" and "alex #euw" are the same player
const same = (a, b) =>
  String(a || '')
    .toLowerCase()
    .replace(/\s+/g, '') ===
  String(b || '')
    .toLowerCase()
    .replace(/\s+/g, '');

export default class MatchReports extends React.Component {
  constructor(props) {
    super(props);
    // `reports` preloads the list (tests); otherwise it loads from the server
    this.state = {
      reports: props.reports || null,
      error: '',
      query: '',
      open: {},
      filter: 'All',
    };
  }
  componentDidMount() {
    if (!this.props.reports) this.load();
  }
  async load() {
    const res = await this.props.api
      .get('/api/admin/match-reports')
      .catch(() => ({ ok: false }));
    if (!res.ok)
      return this.setState({
        reports: [],
        error:
          res.error ||
          'Couldn’t load the match reports. They show up once the win/loss update is live.',
      });
    this.setState({ reports: res.data.reports || [], error: '' });
  }
  // ---- an admin corrects the result (migration 20261105140000)
  startEdit(r) {
    this.setState({
      editing: r.assignmentId,
      draft: {
        wins: r.wins,
        losses: r.losses,
        games: r.games.map((g) => ({ ...g })),
        reason: '',
      },
      editError: '',
    });
  }
  editDraft(patch) {
    this.setState((s) => ({ draft: { ...s.draft, ...patch }, editError: '' }));
  }
  editGame(i, patch) {
    this.setState((s) => ({
      draft: {
        ...s.draft,
        games: s.draft.games.map((g, n) => (n === i ? { ...g, ...patch } : g)),
      },
      editError: '',
    }));
  }
  async saveEdit(r) {
    const d = this.state.draft;
    const wins = Number(d.wins);
    const losses = Number(d.losses);
    if (
      !Number.isInteger(wins) ||
      !Number.isInteger(losses) ||
      wins < 0 ||
      losses < 0
    )
      return this.setState({ editError: 'Wins and losses are whole numbers.' });
    if (wins + losses !== d.games.length)
      return this.setState({
        editError:
          'Wins and losses need to add up to ' + d.games.length + ' games.',
      });
    if (d.reason.trim().length < 3)
      return this.setState({
        editError: 'Add a reason. It goes into the audit log.',
      });
    this.setState({ saving: true, editError: '' });
    const res = await this.props.api
      .post('/api/admin/match-reports', {
        action: 'edit',
        assignmentId: r.assignmentId,
        games: d.games.map((g) => ({
          teammateIgn: g.teammateIgn.trim(),
          customerIgn: g.customerIgn.trim(),
          link: g.link.trim(),
        })),
        wins,
        losses,
        reason: d.reason.trim(),
      })
      .catch(() => ({ ok: false }));
    this.setState({ saving: false });
    if (!res.ok)
      return this.setState({
        editError: res.error || 'Couldn’t save the correction.',
      });
    const report = res.data.report;
    this.setState((s) => ({
      editing: '',
      draft: null,
      reports: s.reports.map((x) =>
        x.assignmentId === r.assignmentId
          ? {
              ...x,
              games: report.games,
              wins: report.wins,
              losses: report.losses,
              edited: report.edited,
            }
          : x,
      ),
    }));
    if (this.props.log) this.props.log();
    if (this.props.toast)
      this.props.toast(
        r.reference + ' corrected to ' + wins + 'W ' + losses + 'L.',
      );
  }
  renderEditor(r) {
    const s = this.state;
    if (s.editing !== r.assignmentId)
      return (
        <button
          type="button"
          onClick={() => this.startEdit(r)}
          style={{ ...btn(), marginTop: '10px', minHeight: '32px' }}
        >
          Correct result
        </button>
      );
    const d = s.draft;
    const field = {
      ...input,
      minHeight: '34px',
      padding: '0 10px',
      fontSize: '13px',
      width: '100%',
      boxSizing: 'border-box',
    };
    return (
      <div
        data-match-editor
        style={{
          marginTop: '10px',
          padding: '12px',
          borderRadius: '12px',
          background: C.panel,
          border: '1px solid ' + C.line2,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <label style={{ fontSize: '12.5px', color: C.muted }}>
            Wins
            <input
              type="number"
              min="0"
              max={d.games.length}
              value={d.wins}
              onChange={(e) => this.editDraft({ wins: e.target.value })}
              style={{ ...field, width: '90px', display: 'block' }}
            />
          </label>
          <label style={{ fontSize: '12.5px', color: C.muted }}>
            Losses
            <input
              type="number"
              min="0"
              max={d.games.length}
              value={d.losses}
              onChange={(e) => this.editDraft({ losses: e.target.value })}
              style={{ ...field, width: '90px', display: 'block' }}
            />
          </label>
        </div>
        {d.games.map((g, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 1fr 2fr',
              gap: '6px',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '12.5px', color: C.dim }}>{i + 1}</span>
            <input
              aria-label={'Game ' + (i + 1) + ' teammate IGN'}
              value={g.teammateIgn}
              onChange={(e) =>
                this.editGame(i, { teammateIgn: e.target.value })
              }
              style={field}
            />
            <input
              aria-label={'Game ' + (i + 1) + ' customer IGN'}
              value={g.customerIgn}
              onChange={(e) =>
                this.editGame(i, { customerIgn: e.target.value })
              }
              style={field}
            />
            <input
              aria-label={'Game ' + (i + 1) + ' match link'}
              value={g.link}
              onChange={(e) => this.editGame(i, { link: e.target.value })}
              style={field}
            />
          </div>
        ))}
        <input
          aria-label="Reason for the correction"
          placeholder="Reason, e.g. match history shows 2 losses"
          value={d.reason}
          maxLength={200}
          onChange={(e) => this.editDraft({ reason: e.target.value })}
          style={field}
        />
        {s.editError ? (
          <p
            role="alert"
            style={{ margin: '0', color: C.red, fontSize: '13px' }}
          >
            {s.editError}
          </p>
        ) : null}
        <div
          style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}
        >
          <button
            type="button"
            onClick={() => this.setState({ editing: '', draft: null })}
            disabled={s.saving}
            style={btn()}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => this.saveEdit(r)}
            disabled={s.saving}
            style={btn('primary')}
          >
            {s.saving ? 'Saving…' : 'Save correction'}
          </button>
        </div>
      </div>
    );
  }
  render() {
    const s = this.state;
    if (!s.reports)
      return <p style={{ color: C.dim, margin: '8px 0' }}>Loading…</p>;
    const q = s.query.trim().toLowerCase();
    const rows = s.reports
      .map((r) => ({
        ...r,
        mismatch: r.games.some((g) => !same(g.customerIgn, r.orderIgn)),
      }))
      .filter(
        (r) =>
          (!q ||
            [r.reference, r.teammate.name, r.customer, r.orderIgn]
              .concat(r.games.map((g) => g.customerIgn + ' ' + g.teammateIgn))
              .join(' ')
              .toLowerCase()
              .includes(q)) &&
          (s.filter === 'All' || (s.filter === 'IGN differs' && r.mismatch)),
      );
    const flagged = s.reports.filter((r) =>
      r.games.some((g) => !same(g.customerIgn, r.orderIgn)),
    ).length;
    return (
      <div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <input
            type="search"
            aria-label="Search match reports"
            placeholder="Search order, teammate, customer or IGN"
            value={s.query}
            onChange={(e) => this.setState({ query: e.target.value })}
            style={{ ...input, flex: '1 1 260px' }}
          />
          {['All', 'IGN differs'].map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={s.filter === f ? 'true' : 'false'}
              onClick={() => this.setState({ filter: f })}
              style={chip(s.filter === f)}
            >
              {f}
              {f === 'IGN differs' && flagged ? ' · ' + flagged : ''}
            </button>
          ))}
          <button type="button" onClick={() => this.load()} style={btn()}>
            Refresh
          </button>
        </div>
        {s.error ? (
          <p role="alert" style={{ color: C.gold }}>
            {s.error}
          </p>
        ) : null}
        {!rows.length && !s.error ? (
          <p style={{ color: C.dim, margin: '8px 0' }}>
            {s.reports.length
              ? 'No report matches.'
              : 'No match reports yet. They come in as teammates finish win/loss orders.'}
          </p>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rows.map((r) => {
            const key = r.assignmentId || r.orderId + r.updatedAt;
            const open = !!s.open[key];
            const g = GAMES[r.game] || { name: r.game, img: '' };
            const [stateLabel, stateColor] = STATES[r.state] || [
              r.state,
              C.dim,
            ];
            return (
              <div
                key={key}
                data-match-report={r.reference}
                style={{
                  borderRadius: '14px',
                  background: C.raised,
                  border:
                    '1px solid ' +
                    (r.mismatch ? 'rgba(255, 210, 122, .4)' : C.line2),
                }}
              >
                <button
                  type="button"
                  aria-expanded={open ? 'true' : 'false'}
                  onClick={() =>
                    this.setState({
                      open: { ...s.open, [key]: !open },
                    })
                  }
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px 14px',
                    padding: '12px 14px',
                    border: 'none',
                    background: 'transparent',
                    color: C.text,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transform: 'none',
                  }}
                >
                  {g.img ? (
                    <img
                      src={g.img}
                      alt=""
                      width="28"
                      height="28"
                      style={{ borderRadius: '8px' }}
                    />
                  ) : null}
                  <span style={{ minWidth: '0', lineHeight: '1.35' }}>
                    <span style={{ display: 'block', fontWeight: '700' }}>
                      {r.reference} · {r.title} ×{r.units}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '12.5px',
                        color: C.muted,
                      }}
                    >
                      {r.teammate.name} played with {r.customer} ·{' '}
                      {dateOnly(r.updatedAt)}
                    </span>
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    {r.edited ? (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: C.cyan,
                        }}
                      >
                        Corrected
                      </span>
                    ) : null}
                    {r.mismatch ? (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: C.gold,
                        }}
                      >
                        IGN differs
                      </span>
                    ) : null}
                    <span style={{ fontWeight: '800', color: C.white }}>
                      <span style={{ color: C.green }}>{r.wins}W</span>{' '}
                      <span style={{ color: C.pink }}>{r.losses}L</span>
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: stateColor,
                      }}
                    >
                      {stateLabel}
                    </span>
                  </span>
                </button>
                {open ? (
                  <div style={{ padding: '0 14px 14px' }}>
                    <p
                      style={{
                        margin: '0 0 8px',
                        fontSize: '13px',
                        color: C.muted,
                      }}
                    >
                      Customer’s IGN on the order:{' '}
                      <b style={{ color: C.white }}>{r.orderIgn || '—'}</b>
                      {' · '}
                      {winrateLabel(r.wins, r.losses)}
                    </p>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '13px',
                      }}
                    >
                      <thead>
                        <tr style={{ color: C.faint, textAlign: 'left' }}>
                          <th style={{ padding: '6px 8px' }}>Game</th>
                          <th style={{ padding: '6px 8px' }}>Teammate IGN</th>
                          <th style={{ padding: '6px 8px' }}>Customer IGN</th>
                          <th style={{ padding: '6px 8px' }}>Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.games.map((m, i) => (
                          <tr
                            key={i}
                            style={{ borderTop: '1px solid ' + C.line }}
                          >
                            <td style={{ padding: '8px', color: C.dim }}>
                              {i + 1}
                            </td>
                            <td style={{ padding: '8px' }}>{m.teammateIgn}</td>
                            <td
                              style={{
                                padding: '8px',
                                color: same(m.customerIgn, r.orderIgn)
                                  ? C.text
                                  : C.gold,
                                fontWeight: same(m.customerIgn, r.orderIgn)
                                  ? '400'
                                  : '700',
                              }}
                            >
                              {m.customerIgn}
                            </td>
                            <td
                              style={{
                                padding: '8px',
                                maxWidth: '360px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <a
                                href={m.link}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                style={{ color: C.accent }}
                              >
                                {m.link}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {r.edited ? (
                      <p
                        style={{
                          margin: '8px 0 0',
                          fontSize: '12.5px',
                          color: C.cyan,
                        }}
                      >
                        Corrected by {r.edited.by} on {dateOnly(r.edited.at)}:{' '}
                        {r.edited.reason}
                      </p>
                    ) : null}
                    {r.assignmentId ? this.renderEditor(r) : null}
                    {r.assignmentId && this.props.api ? (
                      <ProofManager
                        orderId={r.orderId}
                        api={this.props.api}
                        ask={this.props.ask}
                        toast={this.props.toast}
                        log={this.props.log}
                        csrf={this.props.csrf}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p style={{ margin: '12px 0 0', fontSize: '12.5px', color: C.dim }}>
          Only reports marked Counts go into the winrate. Lying on a report is a
          reason to suspend: use Suspend in the Teammates tab.
        </p>
      </div>
    );
  }
}
