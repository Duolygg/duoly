import React from 'react';
import { GAME as GAMES } from '../../design-reference/lib/games';
import { maskEmail } from '../../design-reference/lib/adminData';
import { flagSrc } from '../../design-reference/lib/countries';
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
  ago,
} from '../../design-reference/components/admin/ui';

// Port of the roster tab of the original components/admin/Teammates.jsx on /api/admin/teammates
// (RPCs admin_teammates, admin_set_suspended). Applications have their own section. Trust level,
// rating, deposit held and amount owed come with order completion and payouts; until then
// they show a dash rather than invented numbers. Online status needs presence (not built yet),
// so status is Playing (has an order in progress) or Not playing.
const REFRESH_MS = 20000;
const FILTERS = ['All', 'Playing', 'Suspended', 'No Discord'];
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
      warnings: Number(t.warnings) || 0,
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
          ? ' suspended · can’t take orders until reinstated'
          : ' reinstated'),
    );
    this.props.log();
    this.load();
  }
  render() {
    const { ask } = this.props;
    const s = this.state;
    const q = s.q.trim().toLowerCase();
    const is = (t, f) =>
      f === 'All' ||
      (f === 'Playing' && t.playing) ||
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
          earned: (a, b) => b.earned30 - a.earned30,
          newest: (a, b) => (b.joined || 0) - (a.joined || 0),
        }[s.sort],
      );
    const n = (f) => s.list.filter((t) => is(t, f)).length;
    const dash = (
      <span
        style={{ color: C.faint }}
        title="Comes with order completion and payouts"
      >
        –
      </span>
    );
    return (
      <section style={{ ...card, padding: '18px' }}>
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
                          {t.lastSeen
                            ? ' · signed in ' + ago(t.lastSeen, Date.now())
                            : ''}
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
                          GAMER GIRL · all games
                        </span>
                      ) : null}
                      {!t.gg &&
                        t.games.map((g) =>
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
                  <td style={td}>{dash}</td>
                  <td
                    style={{ ...td, textAlign: 'right' }}
                    title={
                      t.reviews
                        ? t.reviews + (t.reviews === 1 ? ' review' : ' reviews')
                        : 'No reviews yet'
                    }
                  >
                    {t.rating == null ? dash : '★ ' + t.rating.toFixed(2)}
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
                      color: t.earned30 ? C.white : C.faint,
                      fontWeight: '600',
                    }}
                  >
                    {t.earned30 ? usd(t.earned30) : '–'}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{dash}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{dash}</td>
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
                            : 'offline',
                      )}
                    >
                      {t.suspended
                        ? 'Suspended'
                        : t.playing
                          ? 'Playing'
                          : 'Not playing'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
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
                                ? ' Suspended for: ' + t.suspended.reason + '.'
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
                            body: 'They can’t see or take orders, upload proof or chat until you reinstate them.',
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
                  </td>
                </tr>
              ))}
              {s.loaded && !list.length ? (
                <tr>
                  <td
                    colSpan={10}
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
                      : 'No teammates yet. Approve an application or make someone a teammate in Users & roles.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: '13px', color: C.dim }}>
          Trust level, deposit and amount owed fill in once order completion and
          payouts are live. Game access and roles are edited in Users & roles.
        </p>
      </section>
    );
  }
}
