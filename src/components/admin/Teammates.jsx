import React from 'react';
import { GAME as GAMES } from '../../design-reference/lib/games';
import { maskEmail } from '../../design-reference/lib/adminData';
import { flagSrc } from '../../design-reference/lib/countries';
import { TIERS } from '../../design-reference/lib/trust';
import { winrateLabel } from '../../design-reference/lib/winloss';
import Applications from './Applications';
import PublicProfileAdmin from './PublicProfileAdmin';
import MatchReports from './MatchReports';
import TrophyQueue from './TrophyQueue';
import {
  C,
  card,
  th,
  td,
  chip,
  btn,
  pill,
  input,
  usd,
  dateOnly,
} from '../../design-reference/components/admin/ui';

// Port of the original components/admin/Teammates.jsx on /api/admin/teammates (RPCs
// admin_teammates, admin_set_suspended): the Teammates and Applications tabs. The tab is part of
// the URL (/admin/teammates, /admin/applications). Trust level, deposit held, amount owed and
// balance adjustments wait on trust levels and weekly payouts, so those cells say so. Presence
// is durable: Playing wins, then Online, then Offline.
const REFRESH_MS = 20000;
const FILTERS = ['All', 'Online', 'Suspended', 'No Discord'];
const TIER_BY_ID = Object.fromEntries(TIERS.map((tier) => [tier.id, tier]));
const toMs = (v) => (v ? Date.parse(v) : null);

export default class Teammates extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      list: [],
      loaded: false,
      error: '',
      q: '',
      filter: 'All',
      sort: 'orders',
      tab: props.tab || 'roster',
      busy: '',
    };
  }
  componentDidMount() {
    this.load();
    this._t = setInterval(() => this.load(), REFRESH_MS);
  }
  componentWillUnmount() {
    clearInterval(this._t);
  }
  componentDidUpdate(prev) {
    if (prev.tab !== this.props.tab && this.props.tab)
      this.setState({ tab: this.props.tab });
  }
  async load() {
    const res = await this.props.api.get('/api/admin/teammates');
    if (!res.ok) return this.setState({ error: res.error, loaded: true });
    const list = (res.data.teammates || []).map((t) => ({
      ...t,
      av: t.image || '/assets/avatars/avatar-1.png',
      flag: t.country ? flagSrc(t.country) : '',
      joined: toMs(t.joined),
      lastSeen: toMs(t.lastSeen),
      lifetime: Number(t.completed) || 0,
      earned30: (Number(t.earned30UsdCents) || 0) / 100,
      rating: t.rating == null ? null : Number(t.rating),
      reviews: Number(t.reviews) || 0,
      // match reports on win/loss orders (20261102160000)
      wins: Number(t.winLoss && t.winLoss.wins) || 0,
      losses: Number(t.winLoss && t.winLoss.losses) || 0,
      warnings: Number(t.warnings) || 0,
      tier: TIER_BY_ID[(t.trust && t.trust.trust_tier) || 'rookie'] || TIERS[0],
      held: (Number(t.depositHeldUsdCents) || 0) / 100,
      owed:
        Number((t.payout && t.payout.due) || 0) +
        Number((t.payout && t.payout.owed) || 0),
      suspended: t.suspended
        ? { ...t.suspended, at: toMs(t.suspended.at) }
        : null,
    }));
    this.setState({ list, error: '', loaded: true });
  }
  async setSuspended(t, suspended, reason) {
    this.setState({ busy: t.id });
    const res = await this.props.api.post('/api/admin/teammates', {
      userId: t.id,
      suspended,
      ...(reason ? { reason } : {}),
    });
    this.setState({ busy: '' });
    if (!res.ok) return this.props.toast(res.error, 'warn');
    this.props.toast(
      t.name +
        (suspended
          ? ' suspended · signed out and can’t take orders until reinstated'
          : ' reinstated'),
    );
    this.props.log();
    this.load();
  }
  async adjustBalance(t, amount, reason) {
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || !dollars || Math.abs(dollars) > 1000)
      return this.props.toast(
        'Enter an amount from -1000 to 1000 USD, excluding 0.',
        'warn',
      );
    this.setState({ busy: t.id });
    const res = await this.props.api.post('/api/admin/payouts', {
      action: 'adjust',
      teammateId: t.id,
      amountCents: Math.round(dollars * 100),
      reason,
    });
    this.setState({ busy: '' });
    if (!res.ok) return this.props.toast(res.error, 'warn');
    this.props.toast('Adjusted ' + t.name + ' by ' + usd(dollars) + '.');
    this.props.log();
  }
  renderRoster() {
    const { ask } = this.props;
    const s = this.state;
    const q = s.q.trim().toLowerCase();
    const is = (t, f) =>
      f === 'All' ||
      (f === 'Online' && (t.online || t.playing) && !t.suspended) ||
      (f === 'Suspended' && t.suspended) ||
      (f === 'No Discord' && !t.discord);
    const list = s.list
      .filter(
        (t) =>
          is(t, s.filter) &&
          (!q ||
            [t.name, t.email]
              .concat(t.games.map((g) => (GAMES[g] || {}).name))
              .some((x) =>
                String(x || '')
                  .toLowerCase()
                  .includes(q),
              )),
      )
      .slice()
      .sort(
        {
          orders: (a, b) => b.lifetime - a.lifetime,
          rating: (a, b) => (b.rating || 0) - (a.rating || 0),
          winrate: (a, b) =>
            (b.wins + b.losses ? b.wins / (b.wins + b.losses) : -1) -
            (a.wins + a.losses ? a.wins / (a.wins + a.losses) : -1),
          earned: (a, b) => b.earned30 - a.earned30,
          newest: (a, b) => (b.joined || 0) - (a.joined || 0),
        }[s.sort],
      );
    const n = (f) => s.list.filter((t) => is(t, f)).length;
    return (
      <>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <input
            type="search"
            aria-label="Search teammates"
            placeholder="Search name, email, game…"
            value={s.q}
            onChange={(e) => this.setState({ q: e.target.value })}
            style={{ ...input, flex: '1 1 240px' }}
          />
          <div
            role="group"
            aria-label="Filter"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
          >
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={s.filter === f ? 'true' : 'false'}
                onClick={() => this.setState({ filter: f })}
                style={chip(s.filter === f)}
              >
                {f}
                <span style={{ opacity: '.65', fontWeight: '500' }}>
                  {n(f)}
                </span>
              </button>
            ))}
          </div>
          <select
            aria-label="Sort"
            value={s.sort}
            onChange={(e) => this.setState({ sort: e.target.value })}
            style={input}
          >
            <option value="orders">Most orders</option>
            <option value="rating">Best rating</option>
            <option value="winrate">Best winrate</option>
            <option value="earned">Most earned (30d)</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        {s.error ? (
          <p
            role="status"
            style={{ margin: '12px 0 0', fontSize: '13.5px', color: C.pink }}
          >
            {s.error}
          </p>
        ) : null}
        <div className="ops-table-wrap" style={{ marginTop: '12px' }}>
          <table className="ops-table">
            <thead>
              <tr>
                <th style={th}>Teammate</th>
                <th style={th}>Games</th>
                <th style={th}>Trust level</th>
                <th style={{ ...th, textAlign: 'right' }}>Rating</th>
                <th style={{ ...th, textAlign: 'right' }}>Winrate</th>
                <th style={{ ...th, textAlign: 'right' }}>Orders</th>
                <th style={{ ...th, textAlign: 'right' }}>Earned 30d</th>
                <th style={{ ...th, textAlign: 'right' }}>Deposit held</th>
                <th style={{ ...th, textAlign: 'right' }}>Owed</th>
                <th style={th}>Status</th>
                <th style={th}>
                  <span
                    style={{
                      position: 'absolute',
                      width: '1px',
                      height: '1px',
                      overflow: 'hidden',
                      clip: 'rect(0 0 0 0)',
                    }}
                  >
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td style={td}>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <span
                        style={{
                          position: 'relative',
                          width: '32px',
                          height: '32px',
                          flex: '0 0 auto',
                        }}
                      >
                        <img
                          src={t.av}
                          alt=""
                          width="32"
                          height="32"
                          referrerPolicy="no-referrer"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                          }}
                        />
                        {t.flag ? (
                          <img
                            src={t.flag}
                            alt=""
                            width="13"
                            height="13"
                            style={{
                              position: 'absolute',
                              right: '-2px',
                              bottom: '-2px',
                              width: '13px',
                              height: '13px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : null}
                      </span>
                      <span style={{ lineHeight: '1.3' }}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '600',
                            color: C.white,
                          }}
                        >
                          {t.name}
                          {t.warnings ? (
                            <span
                              title="Warnings from flagged chat messages"
                              style={{
                                fontSize: '10.5px',
                                fontWeight: '800',
                                padding: '1px 6px',
                                borderRadius: '6px',
                                background: 'rgba(255, 138, 155, .14)',
                                color: C.red,
                              }}
                            >
                              {t.warnings} WARNED
                            </span>
                          ) : null}
                          {!t.discord ? (
                            <span
                              title="Hasn’t connected Discord yet, so they can’t take orders"
                              style={{
                                fontSize: '10.5px',
                                fontWeight: '800',
                                padding: '1px 6px',
                                borderRadius: '6px',
                                background: 'rgba(255, 210, 122, .14)',
                                color: C.gold,
                              }}
                            >
                              NO DISCORD
                            </span>
                          ) : null}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            color: C.dim,
                          }}
                        >
                          {maskEmail(t.email)}
                          {t.joined ? ' · since ' + dateOnly(t.joined) : ''}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '5px',
                        maxWidth: '190px',
                        whiteSpace: 'normal',
                      }}
                    >
                      {t.gg ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: 'rgba(240, 166, 255, .14)',
                            color: C.pink,
                          }}
                        >
                          Gamer Girl · all games
                        </span>
                      ) : null}
                      {/* the comp game icons start on their own line under the Gamer Girl badge */}
                      {t.gg && t.games.length ? (
                        <span
                          aria-hidden="true"
                          style={{ flexBasis: '100%', height: '0' }}
                        />
                      ) : null}
                      {/* comp games: also for Gamer Girl teammates (20261102140000) */}
                      {t.games.map((g) =>
                        GAMES[g] ? (
                          <img
                            key={g}
                            src={GAMES[g].img}
                            alt={GAMES[g].name}
                            title={GAMES[g].name}
                            width="22"
                            height="22"
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '6px',
                              flex: '0 0 auto',
                            }}
                          />
                        ) : null,
                      )}
                      {!t.gg && !t.games.length ? (
                        <span style={{ fontSize: '12.5px', color: C.gold }}>
                          No games yet
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ fontWeight: '700', color: t.tier.color }}>
                      {t.tier.name}
                    </span>{' '}
                    <span style={{ color: C.dim, fontSize: '12.5px' }}>
                      · {t.tier.deposit}%
                    </span>
                  </td>
                  <td
                    style={{ ...td, textAlign: 'right' }}
                    title={
                      t.reviews
                        ? t.reviews + (t.reviews === 1 ? ' review' : ' reviews')
                        : 'No reviews yet'
                    }
                  >
                    {t.rating == null ? 'New' : '★ ' + t.rating.toFixed(2)}
                  </td>
                  <td
                    style={{ ...td, textAlign: 'right' }}
                    title="From match reports on win/loss orders"
                  >
                    {winrateLabel(t.wins, t.losses) || '—'}
                  </td>
                  <td
                    style={{ ...td, textAlign: 'right' }}
                    title={t.accepted + ' accepted in total'}
                  >
                    {t.lifetime.toLocaleString('en-US')}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'right',
                      color: C.white,
                      fontWeight: '600',
                    }}
                  >
                    {usd(t.earned30)}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'right',
                      color: t.held ? C.gold : C.faint,
                    }}
                  >
                    {t.held ? usd(t.held) : usd(0)}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'right',
                      fontWeight: '700',
                      color: t.owed < 0 ? C.red : t.owed ? C.white : C.faint,
                    }}
                    title="Current payout week plus unpaid payout lines"
                  >
                    {t.owed ? usd(t.owed) : usd(0)}
                  </td>
                  <td style={td}>
                    <span
                      title={
                        t.suspended
                          ? 'Suspended by ' +
                            (t.suspended.by || 'an admin') +
                            (t.suspended.reason
                              ? ': ' + t.suspended.reason
                              : '')
                          : undefined
                      }
                      style={pill(
                        t.suspended
                          ? 'Suspended'
                          : t.playing
                            ? 'online'
                            : t.online
                              ? 'online'
                              : 'offline',
                      )}
                    >
                      {t.suspended
                        ? 'Suspended'
                        : t.playing
                          ? 'Playing'
                          : t.online
                            ? 'Online'
                            : 'Offline'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        style={btn()}
                        onClick={() =>
                          this.setState({ publicProfileTeammate: t })
                        }
                      >
                        Public profile
                      </button>
                      {/* balance changes are money: Payouts permission (20261105130000) */}
                      {!this.props.can || this.props.can('payouts') ? (
                        <>
                          <button
                            type="button"
                            disabled={s.busy === t.id}
                            style={btn()}
                            onClick={() =>
                              ask({
                                title: 'Adjust ' + t.name + '’s payout balance',
                                body: 'Use a positive or negative USD amount. The reason is visible to the teammate and counts in this payout week.',
                                confirm: 'Add adjustment',
                                field: {
                                  label: 'Amount in USD',
                                  placeholder: '25.00 or -25.00',
                                  type: 'number',
                                  required: true,
                                },
                                field2: {
                                  label: 'Reason shown to the teammate',
                                  placeholder: 'Why this adjustment was made',
                                  required: true,
                                },
                                onConfirm: (amount, reason) =>
                                  this.adjustBalance(t, amount, reason),
                              })
                            }
                          >
                            Adjust balance
                          </button>
                        </>
                      ) : null}
                      {t.suspended ? (
                        <button
                          type="button"
                          disabled={s.busy === t.id}
                          style={btn()}
                          onClick={() =>
                            ask({
                              title: 'Reinstate ' + t.name + '?',
                              body:
                                'They can take orders again right away.' +
                                (t.suspended.reason
                                  ? ' Suspended for: ' +
                                    t.suspended.reason +
                                    '.'
                                  : ''),
                              confirm: 'Reinstate',
                              onConfirm: () => this.setSuspended(t, false),
                            })
                          }
                        >
                          Reinstate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={s.busy === t.id || t.playing}
                          title={
                            t.playing
                              ? 'They’re playing an order right now'
                              : undefined
                          }
                          style={{
                            ...btn('danger'),
                            opacity: t.playing ? '.45' : '1',
                          }}
                          onClick={() =>
                            ask({
                              title: 'Suspend ' + t.name + '?',
                              body: 'They’re signed out and can’t sign in, see or take orders, upload proof or chat until you reinstate them. They also lose the Teammate role on Discord.',
                              confirm: 'Suspend',
                              kind: 'danger',
                              field: {
                                label: 'Reason (shown in the audit log)',
                                placeholder:
                                  'e.g. repeated toxic behaviour reports',
                                required: true,
                              },
                              onConfirm: (reason) =>
                                this.setSuspended(t, true, reason),
                            })
                          }
                        >
                          Suspend
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
              {s.loaded && !list.length ? (
                <tr>
                  <td
                    colSpan={11}
                    style={{
                      ...td,
                      textAlign: 'center',
                      color: C.dim,
                      padding: '36px 12px',
                      whiteSpace: 'normal',
                    }}
                  >
                    {s.list.length
                      ? 'No teammates match.'
                      : 'No teammates yet. Approve an application or make someone a teammate in Users and roles.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {s.publicProfileTeammate ? (
          <PublicProfileAdmin
            key={s.publicProfileTeammate.id}
            teammate={s.publicProfileTeammate}
            api={this.props.api}
            log={this.props.log}
            onClose={() => this.setState({ publicProfileTeammate: null })}
          />
        ) : null}
        <p style={{ margin: '12px 0 0', fontSize: '13px', color: C.dim }}>
          Game access and roles are edited in Users and roles. Payout balances
          include the running Vienna week and unpaid payout lines.
        </p>
      </>
    );
  }
  render() {
    const s = this.state;
    const pending = this.props.pendingApps || 0;
    const pick = (id) => {
      this.setState({ tab: id });
      // Teammates and Applications have their own address; Match reports stays on the current one
      if (this.props.onTab && id !== 'reports' && id !== 'trophies')
        this.props.onTab(id);
    };
    const tab = (id, label, n, hot) => (
      <button
        type="button"
        role="tab"
        aria-selected={s.tab === id ? 'true' : 'false'}
        onClick={() => pick(id)}
        style={{
          ...chip(s.tab === id),
          minHeight: '40px',
          padding: '0 16px',
          fontSize: '14px',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
        {n === null ? null : (
          <span
            style={{
              minWidth: '20px',
              height: '20px',
              padding: '0 6px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11.5px',
              background: hot
                ? 'rgba(255, 210, 122, .2)'
                : 'rgba(196, 170, 255, .14)',
              color: s.tab === id ? C.ink : hot ? C.gold : C.accent,
            }}
          >
            {n}
          </span>
        )}
      </button>
    );
    return (
      <section style={{ ...card, padding: '18px' }}>
        <div
          role="tablist"
          aria-label="Teammates"
          // wraps onto a second line on a phone instead of running off the screen
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '14px',
          }}
        >
          {tab('roster', 'Teammates', s.list.length)}
          {tab('apps', 'Applications', pending, pending > 0)}
          {tab('reports', 'Match reports', null)}
          {tab('trophies', 'Trophies', null)}
        </div>
        {s.tab === 'roster' ? (
          this.renderRoster()
        ) : s.tab === 'reports' ? (
          <MatchReports {...this.props} />
        ) : s.tab === 'trophies' ? (
          <TrophyQueue {...this.props} />
        ) : (
          <Applications {...this.props} embedded />
        )}
      </section>
    );
  }
}
