import React from 'react';
import { ranksForGame } from '../../contracts/public-profile-admin';
import { GAME } from '../../design-reference/lib/games';
import {
  card,
  C,
  btn,
  input,
} from '../../design-reference/components/admin/ui';

export default class PublicProfileAdmin extends React.Component {
  constructor(props) {
    super(props);
    this.state = { data: null, error: '', busy: false, reason: '', ranks: {} };
  }
  componentDidMount() {
    this.load();
  }
  componentWillUnmount() {
    this.unmounted = true;
  }
  async load() {
    const res = await this.props.api.get(
      '/api/admin/public-profile?userId=' +
        encodeURIComponent(this.props.teammate.id),
    );
    if (this.unmounted) return;
    if (!res.ok) return this.setState({ error: res.error });
    this.setState({
      data: res.data,
      ranks: Object.fromEntries(
        res.data.approvedGames.map((g) => {
          const r = res.data.ranks.find((r) => r.game === g);
          return [
            g,
            {
              rank: r?.rank || '',
              peakRank: r?.peakRank || '',
              verified: r?.verified || false,
            },
          ];
        }),
      ),
      error: '',
    });
  }
  async save(body) {
    this.setState({ busy: true, error: '' });
    try {
      const res = await this.props.api.post('/api/admin/public-profile', body);
      if (!res.ok) return this.setState({ error: res.error, busy: false });
      await this.load();
      this.setState({ busy: false });
      this.props.log?.();
    } catch {
      this.setState({
        error: 'Could not save public profile settings.',
        busy: false,
      });
    }
  }
  render() {
    const d = this.state.data;
    return (
      <section
        style={{ ...card, marginTop: '20px', padding: '20px', color: C.white }}
        aria-label="Public profile moderation"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px' }}>
            Public profile: {this.props.teammate.name}
          </h2>
          <button type="button" style={btn()} onClick={this.props.onClose}>
            Close
          </button>
        </div>
        <p style={{ color: C.muted, fontSize: '13px' }}>
          Verify ranks only after checking evidence. Every change is recorded in
          the audit log.
        </p>
        {this.state.error ? (
          <p role="alert" style={{ color: C.red }}>
            {this.state.error}
          </p>
        ) : null}
        {d ? (
          <>
            <div style={{ display: 'grid', gap: '20px' }}>
              {d.approvedGames.map((g) => {
                const r = this.state.ranks[g];
                const set = (key, v) =>
                  this.setState((s) => ({
                    ranks: { ...s.ranks, [g]: { ...s.ranks[g], [key]: v } },
                  }));
                return (
                  <fieldset
                    key={g}
                    style={{
                      border: '1px solid rgba(196,170,255,.14)',
                      borderRadius: '12px',
                      minWidth: 0,
                      padding: '16px',
                    }}
                  >
                    <legend>{GAME[g]?.name || g}</legend>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        alignItems: 'end',
                      }}
                    >
                      {['rank', 'peakRank'].map((k) => (
                        <label
                          key={k}
                          style={{
                            display: 'grid',
                            gap: '8px',
                            flex: '1 1 180px',
                            minWidth: 0,
                          }}
                        >
                          {k === 'rank' ? 'Current rank' : 'Peak rank'}
                          <select
                            value={r[k]}
                            aria-label={`${GAME[g]?.name || g} ${k === 'rank' ? 'current rank' : 'peak rank'}`}
                            style={{ ...input, width: '100%' }}
                            onChange={(e) => set(k, e.target.value)}
                          >
                            <option value="">Not set</option>
                            {ranksForGame(g).map((rank) => (
                              <option key={rank}>{rank}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                      <label
                        style={{
                          display: 'flex',
                          gap: '8px',
                          minHeight: '40px',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={r.verified}
                          onChange={(e) => set('verified', e.target.checked)}
                        />
                        Verified
                      </label>
                      <button
                        type="button"
                        style={btn()}
                        disabled={this.state.busy || (r.verified && !r.rank)}
                        onClick={() =>
                          this.save({
                            action: 'rank',
                            userId: this.props.teammate.id,
                            game: g,
                            rank: r.rank || null,
                            peakRank: r.peakRank || null,
                            verified: r.verified,
                          })
                        }
                      >
                        Save rank
                      </button>
                    </div>
                  </fieldset>
                );
              })}
            </div>
            {d.slug ? (
              <div style={{ marginTop: '24px' }}>
                <p>
                  Profile link: /teammates/{d.slug}.{' '}
                  {d.hidden ? 'Hidden by an admin.' : 'Not hidden by an admin.'}
                </p>
                {d.reason ? (
                  <p style={{ color: C.muted }}>Last reason: {d.reason}</p>
                ) : null}
                <label style={{ display: 'grid', gap: '8px' }}>
                  Moderation reason
                  <input
                    style={{ ...input, width: '100%', boxSizing: 'border-box' }}
                    maxLength={500}
                    value={this.state.reason}
                    onChange={(e) => this.setState({ reason: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  style={{
                    ...btn(d.hidden ? undefined : 'danger'),
                    marginTop: '12px',
                  }}
                  disabled={this.state.busy || !this.state.reason.trim()}
                  onClick={() =>
                    this.save({
                      action: 'hide',
                      slug: d.slug,
                      hidden: !d.hidden,
                      reason: this.state.reason,
                    })
                  }
                >
                  {d.hidden ? 'Unhide profile' : 'Hide profile'}
                </button>
              </div>
            ) : (
              <p style={{ color: C.muted }}>
                This teammate has not chosen a public profile link yet.
              </p>
            )}
          </>
        ) : (
          <p style={{ color: C.muted }}>Loading profile settings…</p>
        )}
      </section>
    );
  }
}
