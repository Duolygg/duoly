import React from 'react';
import {
  C,
  DISPLAY,
  card,
  h2,
  chip,
  input,
  btn,
  ago,
} from '../../design-reference/components/admin/ui';
import { ACCESS_GAMES as GAMES } from '../../design-reference/lib/games';
import { account } from './api';
import { DEFAULT_ADMIN_SECTIONS } from '../../contracts/admin-access';

// Dashboard sections an owner can give an admin, in sidebar order (migration 20261105130000).
const ADMIN_SECTION_LABELS = [
  ['overview', 'Overview'],
  ['live', 'Live desk'],
  ['priority', 'Priority'],
  ['performance', 'Performance'],
  ['orders', 'Orders'],
  ['payouts', 'Payouts'],
  ['customers', 'Customers'],
  ['teammates', 'Teammates & applications'],
  ['creators', 'Creators'],
  ['support', 'Support chat'],
  ['users', 'Users and roles'],
  ['safety', 'Reports and safety'],
  ['audit', 'Audit log'],
  ['settings', 'Settings'],
];

// Port of the original components/admin/Users.jsx, wired to /api/admin/users (Supabase RPCs
// admin_accounts, admin_set_role, admin_set_access). The database writes the audit row.

const REFRESH_MS = 15000;
const ROLE = {
  customer: {
    label: 'Customer',
    color: C.muted,
    bg: 'rgba(196, 170, 255, .1)',
    what: 'Books orders. Sees the customer dashboard.',
  },
  teammate: {
    label: 'Teammate',
    color: C.green,
    bg: 'rgba(94, 234, 168, .12)',
    what: 'Gets orders and plays them. Sees the teammate dashboard.',
  },
  admin: {
    label: 'Admin',
    color: C.red,
    bg: 'rgba(255, 138, 155, .14)',
    what: 'Runs Duoly: this admin dashboard and the live desk.',
  },
};
const VIA = {
  discord: 'Discord',
  google: 'Google',
  password: 'Email',
  email: 'Email',
};
const FILTERS = [
  ['all', 'All'],
  ['customer', 'Customers'],
  ['teammate', 'Teammates'],
  ['admin', 'Admins'],
];

// Admin: who is a customer, teammate or admin. Roles are checked on the server for every page and API.
export default class Users extends React.Component {
  constructor(props) {
    super(props);
    // editing: the teammate whose order access is open; draft: { games, gg } being edited
    this.state = {
      accounts: [],
      loaded: false,
      error: '',
      q: '',
      filter: 'all',
      busy: '',
      editing: '',
      draft: null,
      // Duo tier level per teammate (migration 20261030140000); null until it can be read
      levels: null,
    };
  }
  // ---- order access: Gamer Girl orders (every game) and/or comp orders in approved games
  // (migration 20261102140000; before, Gamer Girl excluded comp orders). Rules: lib/access.js
  editAccess(a) {
    const acc = a.access || { games: [], gg: false };
    this.setState({
      editing: a.id,
      draft: {
        games: acc.games.slice(),
        gg: !!acc.gg,
        // Twitch streaming games (migration 20261105100000); always a subset of games
        stream: (acc.stream || []).slice(),
        level: (this.state.levels && this.state.levels[a.id]) || 'standard',
      },
    });
  }
  async saveAccess(a) {
    const d = this.state.draft;
    this.setState({ busy: a.id });
    try {
      const res = await this.props.api.post('/api/admin/users', {
        userId: a.id,
        access: { games: d.games, gg: d.gg },
      });
      if (!res.ok)
        return this.props.toast(
          res.error || 'Couldn’t save their access.',
          'warn',
        );
      let r = res.data;
      // Twitch streaming: only approved games can be streamed
      const stream = d.stream.filter((g) => d.games.includes(g));
      const had = (a.access && a.access.stream) || [];
      if (
        stream.length !== had.length ||
        stream.some((g) => !had.includes(g))
      ) {
        const st = await this.props.api.post('/api/admin/users', {
          userId: a.id,
          streamGames: stream,
        });
        if (!st.ok)
          this.props.toast(
            st.error || 'Access saved, but not their streaming games.',
            'warn',
          );
        else {
          r = { ...r, access: { ...r.access, ...st.data.access } };
          const names = GAMES.filter((g) =>
            st.data.access.stream.includes(g.id),
          )
            .map((g) => g.short)
            .join(', ');
          this.props.log(
            'Changed streaming access',
            a.name || a.email,
            names || 'None',
          );
        }
      }
      const before =
        (this.state.levels && this.state.levels[a.id]) || 'standard';
      if (this.state.levels && d.games.length && d.level !== before) {
        const lv = await this.props.api.post('/api/admin/duo-levels', {
          userId: a.id,
          level: d.level,
        });
        if (!lv.ok)
          this.props.toast(
            lv.error || 'Access saved, but not their teammate level.',
            'warn',
          );
        else {
          this.setState({
            levels: { ...this.state.levels, [a.id]: d.level },
          });
          this.props.log(
            'Changed teammate level',
            a.name || a.email,
            d.level === 'plus_only' ? 'Plus only' : 'Standard',
          );
        }
      }
      this.setState({
        editing: '',
        draft: null,
        accounts: this.state.accounts.map((x) =>
          x.id === a.id ? { ...x, access: { ...x.access, ...r.access } } : x,
        ),
      });
      const n = r.access.games.length;
      const games = n + ' comp game' + (n === 1 ? '' : 's');
      const what = r.access.gg
        ? 'Gamer Girl orders' + (n ? ' and ' + games : ' only')
        : n
          ? games
          : 'no games';
      this.props.log('Changed order access', a.name || a.email, what);
      this.props.toast((a.name || a.email) + ' now gets ' + what);
    } catch (e) {
      this.props.toast('Can’t reach Duoly right now.', 'warn');
    } finally {
      this.setState({ busy: '' });
    }
  }
  // ---- what an admin may see (owners only; migration 20261105130000)
  editPermissions(a) {
    this.setState({
      permEditing: a.id,
      permDraft: (a.permissions || []).slice(),
    });
  }
  async savePermissions(a) {
    const draft = this.state.permDraft;
    this.setState({ busy: a.id });
    try {
      const res = await this.props.api.post('/api/admin/users', {
        userId: a.id,
        permissions: draft,
      });
      if (!res.ok)
        return this.props.toast(
          res.error || 'Couldn’t save their permissions.',
          'warn',
        );
      const permissions = res.data.permissions || draft;
      this.setState({
        permEditing: '',
        permDraft: null,
        accounts: this.state.accounts.map((x) =>
          x.id === a.id ? { ...x, permissions } : x,
        ),
      });
      this.props.log();
      this.props.toast(
        (a.name || a.email) +
          ' can now see ' +
          (permissions.length
            ? permissions.length +
              ' of ' +
              ADMIN_SECTION_LABELS.length +
              ' sections'
            : 'nothing'),
      );
    } catch {
      this.props.toast('Can’t reach Duoly right now.', 'warn');
    } finally {
      this.setState({ busy: '' });
    }
  }
  renderPermissions(a) {
    const s = this.state;
    const open = s.permEditing === a.id;
    const list = open ? s.permDraft : a.permissions || [];
    const label = {
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      color: C.faint,
    };
    const toggle = (id) =>
      this.setState((st) => ({
        permDraft: st.permDraft.includes(id)
          ? st.permDraft.filter((x) => x !== id)
          : st.permDraft.concat(id),
      }));
    const small = {
      ...btn(),
      minHeight: '32px',
      padding: '0 12px',
      fontSize: '12.5px',
    };
    return (
      <div
        data-admin-permissions
        style={{
          flex: '1 1 100%',
          paddingTop: '10px',
          borderTop: '1px solid ' + C.line,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px 12px',
            flexWrap: 'wrap',
          }}
        >
          <span style={label}>Can see</span>
          <span style={{ fontSize: '12.5px', color: C.dim }}>
            {list.length} of {ADMIN_SECTION_LABELS.length} sections
          </span>
          {open ? null : (
            <button
              type="button"
              onClick={() => this.editPermissions(a)}
              style={{ ...small, fontSize: '13px', marginLeft: 'auto' }}
            >
              Edit permissions
            </button>
          )}
        </div>
        <div
          role="group"
          aria-label={'Dashboard sections for ' + (a.name || a.email)}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
        >
          {ADMIN_SECTION_LABELS.map(([id, name]) => {
            const on = list.includes(id);
            if (!open && !on) return null;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on ? 'true' : 'false'}
                disabled={!open}
                onClick={() => toggle(id)}
                style={{
                  minHeight: '30px',
                  padding: '0 12px',
                  borderRadius: '999px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  transform: 'none',
                  cursor: open ? 'pointer' : 'default',
                  background: on ? C.raised : 'transparent',
                  border: '1px solid ' + (on ? C.accent : C.line2),
                  color: on ? C.white : C.dim,
                }}
              >
                {name}
              </button>
            );
          })}
          {!open && !list.length ? (
            <span
              style={{ fontSize: '12.5px', fontWeight: '600', color: C.gold }}
            >
              Nothing yet · they only see an empty dashboard
            </span>
          ) : null}
        </div>
        {open ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <button
              type="button"
              onClick={() =>
                this.setState({ permDraft: DEFAULT_ADMIN_SECTIONS.slice() })
              }
              style={small}
            >
              Defaults
            </button>
            <button
              type="button"
              onClick={() =>
                this.setState({
                  permDraft: ADMIN_SECTION_LABELS.map(([id]) => id),
                })
              }
              style={small}
            >
              Everything
            </button>
            <span
              style={{ flex: '1 1 160px', fontSize: '12.5px', color: C.dim }}
            >
              Applies on their next page load.
            </span>
            <button
              type="button"
              onClick={() =>
                this.setState({ permEditing: '', permDraft: null })
              }
              disabled={s.busy === a.id}
              style={btn()}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => this.savePermissions(a)}
              disabled={s.busy === a.id}
              style={btn('primary')}
            >
              {s.busy === a.id ? 'Saving…' : 'Save permissions'}
            </button>
          </div>
        ) : null}
      </div>
    );
  }
  renderAccess(a) {
    const s = this.state;
    const acc = a.access || { games: [], gg: false };
    const open = s.editing === a.id;
    const d = open ? s.draft : null;
    const label = {
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      color: C.faint,
    };
    if (!open) {
      return (
        <div
          style={{
            flex: '1 1 100%',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px 12px',
            paddingTop: '10px',
            borderTop: '1px solid ' + C.line,
          }}
        >
          <span style={label}>Order access</span>
          {acc.games.length && s.levels && s.levels[a.id] === 'plus_only' ? (
            <span
              title="Duo Plus only: no Duo Pro, Duo Apex or other services"
              style={{
                fontSize: '12.5px',
                fontWeight: '700',
                padding: '3px 10px',
                borderRadius: '999px',
                background: 'rgba(255, 210, 122, .12)',
                color: C.gold,
              }}
            >
              Plus only
            </span>
          ) : null}
          {acc.gg ? (
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: '700',
                padding: '3px 10px',
                borderRadius: '999px',
                background: 'rgba(240, 166, 255, .14)',
                color: C.pink,
              }}
            >
              {acc.games.length
                ? 'Gamer Girl · every game'
                : 'Gamer Girl · only Gamer Girl orders, every game'}
            </span>
          ) : null}
          {acc.games.length ? (
            <span
              style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px' }}
              title={GAMES.filter((g) => acc.games.includes(g.id))
                .map((g) => g.name)
                .join(', ')}
            >
              {GAMES.filter((g) => acc.games.includes(g.id)).map((g) => (
                <img
                  key={g.id}
                  src={g.img}
                  alt={g.name}
                  width="22"
                  height="22"
                  style={{ width: '22px', height: '22px', borderRadius: '6px' }}
                />
              ))}
            </span>
          ) : acc.gg ? null : (
            <span
              style={{ fontSize: '12.5px', fontWeight: '600', color: C.gold }}
            >
              No games yet · gets no orders
            </span>
          )}
          {acc.stream && acc.stream.length ? (
            <span
              title={
                'Twitch streaming: ' +
                GAMES.filter((g) => acc.stream.includes(g.id))
                  .map((g) => g.name)
                  .join(', ')
              }
              style={{
                fontSize: '12.5px',
                fontWeight: '700',
                padding: '3px 10px',
                borderRadius: '999px',
                background: 'rgba(169, 112, 255, .16)',
                color: '#C9A6FF',
              }}
            >
              Twitch · {acc.stream.length}{' '}
              {acc.stream.length === 1 ? 'game' : 'games'}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => this.editAccess(a)}
            style={{
              ...btn(),
              minHeight: '32px',
              padding: '0 12px',
              fontSize: '13px',
              marginLeft: 'auto',
            }}
          >
            Edit access
          </button>
        </div>
      );
    }
    // always from the latest draft, so quick clicks don't undo each other
    const edit = (fn) =>
      this.setState((st) => ({ draft: { ...st.draft, ...fn(st.draft) } }));
    const toggle = (id) =>
      edit((x) => ({
        games: x.games.includes(id)
          ? x.games.filter((g) => g !== id)
          : x.games.concat(id),
        // a game they can't take can't be streamed either
        stream: x.games.includes(id)
          ? x.stream.filter((g) => g !== id)
          : x.stream,
      }));
    const toggleStream = (id) =>
      edit((x) => ({
        stream: x.stream.includes(id)
          ? x.stream.filter((g) => g !== id)
          : x.stream.concat(id),
      }));
    const streamable = GAMES.filter((g) => d.games.includes(g.id));
    return (
      <div
        style={{
          flex: '1 1 100%',
          paddingTop: '12px',
          borderTop: '1px solid ' + C.line,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: '14px',
            background: d.gg ? 'rgba(240, 166, 255, .08)' : C.panel,
            border: '1px solid ' + (d.gg ? 'rgba(240, 166, 255, .3)' : C.line2),
          }}
        >
          <span style={{ flex: '1', minWidth: '0', lineHeight: '1.4' }}>
            <span
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '700',
                color: C.white,
              }}
            >
              Gamer Girl
            </span>
            <span
              style={{ display: 'block', fontSize: '12.5px', color: C.dim }}
            >
              Gamer Girl and Social orders in every game. Comp orders only in
              the games below, if she’s good at one. Internal: customers never
              see this.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={d.gg ? 'true' : 'false'}
            aria-label="Gamer Girl"
            onClick={() => edit((x) => ({ gg: !x.gg }))}
            style={{
              position: 'relative',
              flex: '0 0 auto',
              width: '44px',
              height: '26px',
              borderRadius: '999px',
              border: 'none',
              padding: '0',
              transform: 'none',
              background: d.gg ? C.pink : '#2A1F45',
              transition: 'background-color .2s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '4px',
                left: d.gg ? '22px' : '4px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: d.gg ? C.ink : C.dim,
                transition: 'left .2s',
              }}
            />
          </button>
        </div>

        <>
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={label}>
              {d.gg ? 'Comp games too (optional)' : 'Games they can take'}
            </span>
            <span style={{ fontSize: '12.5px', color: C.dim }}>
              {d.games.length} of {GAMES.length}
            </span>
            <button
              type="button"
              onClick={() => edit(() => ({ games: GAMES.map((g) => g.id) }))}
              style={{
                ...btn(),
                minHeight: '28px',
                padding: '0 10px',
                fontSize: '12px',
                marginLeft: 'auto',
              }}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => edit(() => ({ games: [] }))}
              style={{
                ...btn(),
                minHeight: '28px',
                padding: '0 10px',
                fontSize: '12px',
              }}
            >
              None
            </button>
          </div>
          <div
            role="group"
            aria-label={'Games for ' + (a.name || a.email)}
            style={{
              marginTop: '8px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '6px',
            }}
          >
            {GAMES.map((g) => {
              const on = d.games.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on ? 'true' : 'false'}
                  onClick={() => toggle(g.id)}
                  title={g.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minHeight: '40px',
                    padding: '4px 10px 4px 4px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    textAlign: 'left',
                    transform: 'none',
                    minWidth: '0',
                    background: on ? C.raised : 'transparent',
                    border: '1px solid ' + (on ? C.accent : C.line2),
                    color: on ? C.white : C.dim,
                  }}
                >
                  <img
                    src={g.img}
                    alt=""
                    width="30"
                    height="30"
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      flex: '0 0 auto',
                      filter: on ? 'none' : 'grayscale(1) brightness(.6)',
                    }}
                  />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {g.short}
                  </span>
                </button>
              );
            })}
          </div>
          {s.levels ? (
            <>
              <div style={{ marginTop: '14px', ...label }}>Teammate level</div>
              <div
                role="radiogroup"
                aria-label={'Teammate level for ' + (a.name || a.email)}
                style={{
                  marginTop: '8px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '6px',
                }}
              >
                {[
                  [
                    'standard',
                    'Standard',
                    'Duo Plus and Duo Pro. Duo Apex after 100 seconds (right away for TOP 1% and TOP 5%).',
                  ],
                  [
                    'plus_only',
                    'Plus only',
                    'Hired with a lower rank: Duo Plus only, never Pro, Apex or other services.',
                  ],
                ].map(([id, name, hint]) => {
                  const on = d.level === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on ? 'true' : 'false'}
                      onClick={() => edit(() => ({ level: id }))}
                      style={{
                        display: 'block',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        textAlign: 'left',
                        transform: 'none',
                        background: on ? C.raised : 'transparent',
                        border: '1px solid ' + (on ? C.accent : C.line2),
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '700',
                          color: on ? C.white : C.text,
                        }}
                      >
                        {name}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          marginTop: '2px',
                          fontSize: '12.5px',
                          color: C.dim,
                        }}
                      >
                        {hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </>
        {streamable.length ? (
          <>
            <div
              style={{
                marginTop: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={label}>Twitch streaming</span>
              <span style={{ fontSize: '12.5px', color: C.dim }}>
                {d.stream.filter((g) => d.games.includes(g)).length
                  ? 'They can go live and be booked for these games'
                  : 'Off · pick games to let them offer stream sessions'}
              </span>
            </div>
            <div
              role="group"
              aria-label={'Twitch streaming games for ' + (a.name || a.email)}
              style={{
                marginTop: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              {streamable.map((g) => {
                const on = d.stream.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={on ? 'true' : 'false'}
                    aria-label={'Stream ' + g.name}
                    onClick={() => toggleStream(g.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      minHeight: '32px',
                      padding: '0 12px 0 4px',
                      borderRadius: '10px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      transform: 'none',
                      background: on
                        ? 'rgba(169, 112, 255, .16)'
                        : 'transparent',
                      border: '1px solid ' + (on ? '#A970FF' : C.line2),
                      color: on ? C.white : C.dim,
                    }}
                  >
                    <img
                      src={g.img}
                      alt=""
                      width="24"
                      height="24"
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '7px', // rounded square like every game icon
                        filter: on ? 'none' : 'grayscale(1) brightness(.6)',
                      }}
                    />
                    {g.short}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ flex: '1 1 200px', fontSize: '12.5px', color: C.dim }}>
            {d.gg
              ? 'Gamer Girl orders of every game, no regular orders.'
              : d.games.length
                ? 'Regular orders for these games. Gamer Girl orders stay with Gamer Girls.'
                : 'With no games they won’t get any orders.'}{' '}
            Applies within a few seconds.
          </span>
          <button
            type="button"
            onClick={() => this.setState({ editing: '', draft: null })}
            disabled={s.busy === a.id}
            style={btn()}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => this.saveAccess(a)}
            disabled={s.busy === a.id}
            style={btn('primary')}
          >
            {s.busy === a.id ? 'Saving…' : 'Save access'}
          </button>
        </div>
      </div>
    );
  }
  componentDidMount() {
    this.load();
    this._t = setInterval(() => this.load(), REFRESH_MS);
  }
  componentWillUnmount() {
    clearInterval(this._t);
  }
  async load() {
    const res = await this.props.api.get('/api/admin/users');
    if (!res.ok)
      return this.setState({
        error: res.status
          ? res.error
          : 'Can’t reach Duoly right now. Retrying…',
        loaded: true,
      });
    this.setState({
      accounts: (res.data.accounts || []).map(account),
      error: '',
      loaded: true,
    });
    // Before migration 20261030140000 this fails and the level picker stays hidden.
    const lv = await this.props.api.get('/api/admin/duo-levels');
    if (lv.ok && lv.data && lv.data.levels)
      this.setState({ levels: lv.data.levels });
  }
  change(a, role) {
    if (a.role === role) return;
    const name = a.name || a.email;
    const lines = {
      teammate:
        name +
        ' gets the teammate dashboard (priority starts at 50). They only get orders once you unlock games for them, or make them a Gamer Girl, under Order access.',
      admin:
        name +
        ' gets full access to this admin dashboard, including changing roles. Only do this for people you trust.',
      customer:
        name +
        ' goes back to being a customer.' +
        (a.role === 'teammate'
          ? ' They’re taken off the order desk right away.'
          : '') +
        (a.role === 'admin' ? ' They lose admin access immediately.' : ''),
    };
    this.props.ask({
      title:
        'Make ' +
        name +
        ' ' +
        (role === 'admin'
          ? 'an admin'
          : 'a ' + ROLE[role].label.toLowerCase()) +
        '?',
      body: lines[role],
      confirm: 'Make ' + ROLE[role].label.toLowerCase(),
      kind: role === 'admin' ? 'danger' : 'primary',
      onConfirm: () => this.save(a, role),
    });
  }
  async save(a, role) {
    this.setState({ busy: a.id });
    try {
      const res = await this.props.api.post('/api/admin/users', {
        userId: a.id,
        role,
      });
      if (!res.ok)
        return this.props.toast(
          res.error || 'Couldn’t change the role.',
          'warn',
        );
      const next = account(res.data.account);
      this.setState({
        accounts: this.state.accounts.map((x) => (x.id === a.id ? next : x)),
      });
      this.props.log(
        'Changed role',
        a.name || a.email,
        ROLE[a.role].label + ' → ' + ROLE[role].label,
      );
      this.props.toast(
        (a.name || a.email) +
          ' is now ' +
          (role === 'admin'
            ? 'an admin'
            : 'a ' + ROLE[role].label.toLowerCase()),
      );
    } catch (e) {
      this.props.toast('Can’t reach Duoly right now.', 'warn');
    } finally {
      this.setState({ busy: '' });
    }
  }

  render() {
    const s = this.state;
    const now = Date.now();
    const q = s.q.trim().toLowerCase();
    const count = (r) =>
      s.accounts.filter((a) => r === 'all' || a.role === r).length;
    const order = { admin: 0, teammate: 1, customer: 2 };
    const list = s.accounts
      .filter(
        (a) =>
          (s.filter === 'all' || a.role === s.filter) &&
          (!q ||
            [a.name, a.email].some((x) =>
              String(x || '')
                .toLowerCase()
                .includes(q),
            )),
      )
      .sort(
        (a, b) =>
          order[a.role] - order[b.role] ||
          (b.lastSeen || 0) - (a.lastSeen || 0) ||
          String(a.name).localeCompare(String(b.name)),
      );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <section
          aria-label="Roles"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          {['customer', 'teammate', 'admin'].map((r) => (
            <div key={r} style={{ ...card, padding: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    color: ROLE[r].color,
                  }}
                >
                  {ROLE[r].label}s
                </span>
                <span
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: '26px',
                    fontWeight: '800',
                    color: C.white,
                  }}
                >
                  {count(r)}
                </span>
              </div>
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  color: C.dim,
                }}
              >
                {ROLE[r].what}
              </p>
            </div>
          ))}
        </section>

        <section aria-labelledby="us-h" style={{ ...card, padding: '18px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ minWidth: '0', flex: '1 1 320px' }}>
              <h2 id="us-h" style={h2}>
                Accounts
              </h2>
              <p
                style={{ margin: '4px 0 0', fontSize: '13.5px', color: C.dim }}
              >
                Everyone who signed up or logged in. New accounts are customers.
                Owners are always admins and can’t be changed here, and nobody
                can change their own role. Only owners can make admins and
                choose what each admin can see.
              </p>
            </div>
            <input
              type="search"
              aria-label="Search accounts"
              placeholder="Search name or email…"
              value={s.q}
              onChange={(e) => this.setState({ q: e.target.value })}
              style={{ ...input, flex: '0 1 260px' }}
            />
          </div>
          <div
            role="group"
            aria-label="Filter"
            style={{
              marginTop: '14px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={s.filter === id ? 'true' : 'false'}
                onClick={() => this.setState({ filter: id })}
                style={chip(s.filter === id)}
              >
                {label}
                <span style={{ opacity: '.65', fontWeight: '500' }}>
                  {count(id)}
                </span>
              </button>
            ))}
          </div>
          {s.error ? (
            <p
              role="status"
              style={{ margin: '12px 0 0', fontSize: '13.5px', color: C.pink }}
            >
              {s.error}
            </p>
          ) : null}

          <ul
            style={{
              listStyle: 'none',
              margin: '14px 0 0',
              padding: '0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {list.map((a) => {
              // Only owners change admins (migration 20261105130000).
              const locked =
                a.owner || a.you || (!this.props.owner && a.role === 'admin');
              return (
                <li
                  key={a.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '10px 16px',
                    padding: '12px 14px',
                    borderRadius: '16px',
                    background: C.bg,
                    border: '1px solid ' + C.line,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flex: '1 1 260px',
                      minWidth: '0',
                    }}
                  >
                    <span
                      style={{
                        position: 'relative',
                        width: '40px',
                        height: '40px',
                        flex: '0 0 auto',
                      }}
                    >
                      <img
                        src={a.image || '/assets/avatars/avatar-1.png'}
                        alt=""
                        width="40"
                        height="40"
                        referrerPolicy="no-referrer"
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                      {a.online ? (
                        <span
                          title="On the order desk now"
                          style={{
                            position: 'absolute',
                            right: '-1px',
                            bottom: '-1px',
                            width: '11px',
                            height: '11px',
                            borderRadius: '50%',
                            background: C.green,
                            boxShadow: '0 0 0 2.5px ' + C.bg,
                          }}
                        />
                      ) : null}
                    </span>
                    <span style={{ minWidth: '0', lineHeight: '1.35' }}>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '600',
                          color: C.white,
                        }}
                      >
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {a.name || a.email || 'Unnamed account'}
                        </span>
                        {a.you ? (
                          <span
                            style={{
                              flex: '0 0 auto',
                              fontSize: '10.5px',
                              fontWeight: '800',
                              padding: '1px 6px',
                              borderRadius: '6px',
                              background: 'rgba(214, 187, 255, .14)',
                              color: C.accent,
                            }}
                          >
                            YOU
                          </span>
                        ) : null}
                        {a.owner ? (
                          <span
                            title="Owners are always admins"
                            style={{
                              flex: '0 0 auto',
                              fontSize: '10.5px',
                              fontWeight: '800',
                              padding: '1px 6px',
                              borderRadius: '6px',
                              background: 'rgba(255, 210, 122, .14)',
                              color: C.gold,
                            }}
                          >
                            OWNER
                          </span>
                        ) : null}
                        {a.busy ? (
                          <span
                            title="Playing an order right now"
                            style={{
                              flex: '0 0 auto',
                              fontSize: '10.5px',
                              fontWeight: '800',
                              padding: '1px 6px',
                              borderRadius: '6px',
                              background: 'rgba(158, 230, 255, .12)',
                              color: C.cyan,
                            }}
                          >
                            PLAYING
                          </span>
                        ) : null}
                        {a.role === 'teammate' && !a.discord ? (
                          <span
                            title="Hasn’t connected Discord yet, so they can’t take orders"
                            style={{
                              flex: '0 0 auto',
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
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {a.name ? (a.email || 'no email') + ' · ' : ''}via{' '}
                        {VIA[a.provider] || 'Email'}
                        {a.lastSeen
                          ? ' · signed in ' + ago(a.lastSeen, now)
                          : ' · never logged in'}
                        {a.roleBy && !a.owner ? ' · set by ' + a.roleBy : ''}
                      </span>
                    </span>
                  </span>
                  <span
                    role="radiogroup"
                    aria-label={'Role for ' + (a.name || a.email)}
                    title={
                      a.owner
                        ? 'Owners are always admins'
                        : a.you
                          ? 'You can’t change your own role'
                          : locked
                            ? 'Only owners can change admins'
                            : ''
                    }
                    style={{
                      display: 'inline-flex',
                      gap: '2px',
                      padding: '3px',
                      borderRadius: '12px',
                      background: C.panel,
                      border: '1px solid ' + C.line2,
                      opacity: locked ? '.55' : '1',
                      flex: '0 0 auto',
                    }}
                  >
                    {['customer', 'teammate', 'admin'].map((r) => {
                      const on = a.role === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          role="radio"
                          aria-checked={on ? 'true' : 'false'}
                          disabled={
                            locked ||
                            s.busy === a.id ||
                            (r === 'admin' && !this.props.owner)
                          }
                          title={
                            r === 'admin' && !this.props.owner && !locked
                              ? 'Only owners can make someone admin'
                              : undefined
                          }
                          onClick={() => this.change(a, r)}
                          style={{
                            minHeight: '34px',
                            padding: '0 12px',
                            borderRadius: '9px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: locked ? 'not-allowed' : 'pointer',
                            transform: 'none',
                            background: on ? ROLE[r].bg : 'transparent',
                            color: on ? ROLE[r].color : C.dim,
                          }}
                        >
                          {ROLE[r].label}
                        </button>
                      );
                    })}
                  </span>
                  {a.role === 'teammate' ? this.renderAccess(a) : null}
                  {a.role === 'admin' && !a.owner && this.props.owner
                    ? this.renderPermissions(a)
                    : null}
                </li>
              );
            })}
            {s.loaded && !list.length ? (
              <li style={{ color: C.dim, fontSize: '14px' }}>
                {q || s.filter !== 'all'
                  ? 'No accounts match.'
                  : 'No accounts yet.'}
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    );
  }
}
