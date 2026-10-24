import React from 'react';
import {
  C,
  DISPLAY,
  card,
  h2,
  chip,
  btn,
  input,
  ago,
} from '../../design-reference/components/admin/ui';
import {
  ADJ_TIERS,
  ADJ_DURATIONS,
  tierById,
  tierByPoints,
  signed,
} from '../../contracts/priority';

const REFRESH_MS = 8000;
// Teammates only: the server never lists admins (ledger #16), so their filters are gone.
const FILTERS = ['All', 'Online now', 'Buffed', 'Nerfed', 'Missed orders'];
const BUFFS = ADJ_TIERS.filter((t) => t.points > 0);
const NERFS = ADJ_TIERS.filter((t) => t.points < 0);
const sr = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
};
const toMs = (v) => (v ? Date.parse(v) : null);

// "6 d left", "3 h left", "until removed"
function left(until, now) {
  if (!until) return 'until removed';
  const ms = until - now;
  if (ms <= 0) return 'ending';
  const h = Math.ceil(ms / 3600000);
  return h >= 48 ? Math.ceil(h / 24) + ' d left' : h + ' h left';
}
const tone = (s) => (s <= 25 ? C.green : s >= 75 ? C.red : C.accent);

/** Server account → what the screen renders (times in ms like the original). */
function account(a, now) {
  return {
    ...a,
    changedAt: toMs(a.changedAt),
    adj: a.adj
      ? { ...a.adj, at: toMs(a.adj.at), until: toMs(a.adj.until) }
      : null,
    misses: (a.misses || []).map((m) => ({ ...m, at: toMs(m.at) })),
    now,
  };
}

// Admin-only: how long (0-100 s) a new order waits before it shows up (and rings) for each
// teammate. Seconds used = base - buff/nerf + missed-order penalty. Teammates never see any
// of it. Port of the original components/admin/Priority.jsx on /api/admin/priority.
export default class Priority extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      accounts: [],
      rules: { perMiss: 10, cap: 50, days: 7 },
      def: 50,
      now: Date.now(),
      loaded: false,
      error: '',
      open: null,
      base: {},
      pick: {},
      saving: '',
      q: '',
      filter: 'All',
      sort: 'fast',
      howOpen: false,
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
    const r = await this.props.api.get('/api/admin/priority');
    if (!r.ok)
      return this.setState({
        error: r.error || 'Couldn’t load priorities.',
        loaded: true,
      });
    const d = r.data || {};
    const now = toMs(d.now) || Date.now();
    this.setState({
      accounts: (d.accounts || []).map((a) => account(a, now)),
      rules: d.rules || this.state.rules,
      def: d.default || 50,
      now,
      error: '',
      loaded: true,
    });
  }
  // one call for every change; the server answers with the account's new breakdown
  async send(a, body, toast) {
    this.setState({ saving: a.id });
    const r = await this.props.api.post('/api/admin/priority', {
      userId: a.id,
      ...body,
    });
    this.setState({ saving: '' });
    if (!r.ok)
      return this.props.toast(r.error || 'Couldn’t save that.', 'warn');
    const acc = account(r.data.account, this.state.now);
    const base = { ...this.state.base };
    delete base[a.id];
    const pick = { ...this.state.pick };
    delete pick[a.id];
    this.setState({
      base,
      pick,
      accounts: this.state.accounts.map((x) => (x.id === a.id ? acc : x)),
    });
    this.props.log();
    this.props.toast(toast(acc));
  }
  pickFor(a) {
    const tier = a.adj ? (tierByPoints(a.adj.points) || {}).id || '' : '';
    return this.state.pick[a.id] || { tier, duration: '7d', reason: '' };
  }
  setPick(a, patch) {
    this.setState((s) => ({
      pick: { ...s.pick, [a.id]: { ...this.pickFor(a), ...patch } },
    }));
  }
  // what the seconds would be with the chosen tier (preview in the editor)
  preview(a, tierId) {
    const t = tierById(tierId);
    return Math.max(
      0,
      Math.min(100, a.prio - (t ? t.points : 0) + (a.penalty || 0)),
    );
  }

  renderEditor(a) {
    const s = this.state;
    const p = this.pickFor(a);
    const baseVal = s.base[a.id] != null ? s.base[a.id] : a.prio;
    const baseDirty = s.base[a.id] != null && s.base[a.id] !== a.prio;
    const saving = s.saving === a.id;
    const tierBtn = (t) => {
      const on = p.tier === t.id;
      return (
        <button
          key={t.id}
          type="button"
          aria-pressed={on ? 'true' : 'false'}
          onClick={() => this.setPick(a, { tier: on ? '' : t.id })}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '1px',
            minWidth: '128px',
            padding: '9px 12px',
            borderRadius: '14px',
            textAlign: 'left',
            transform: 'none',
            cursor: 'pointer',
            border: '1px solid ' + (on ? t.color : C.line2),
            background: on ? t.color + '1a' : C.panel,
            color: C.white,
          }}
        >
          <span
            style={{
              fontFamily: DISPLAY,
              fontSize: '17px',
              fontWeight: '800',
              color: t.color,
            }}
          >
            {signed(t.points)}
          </span>
          <span style={{ fontSize: '12.5px', fontWeight: '600' }}>
            {t.name}
          </span>
          <span style={{ fontSize: '11px', color: C.dim }}>
            {Math.abs(t.points)} s {t.points > 0 ? 'earlier' : 'later'}
          </span>
        </button>
      );
    };
    const label = {
      fontSize: '11.5px',
      fontWeight: '700',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      color: C.faint,
    };
    return (
      <div
        style={{
          marginTop: '12px',
          paddingTop: '14px',
          borderTop: '1px solid ' + C.line,
          display: 'grid',
          gap: '16px',
        }}
      >
        <div>
          <div style={label}>Buff or nerf</div>
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            {BUFFS.map(tierBtn)}
          </div>
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            {NERFS.map(tierBtn)}
          </div>
          <div
            style={{
              marginTop: '10px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              role="group"
              aria-label="How long"
              style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}
            >
              {ADJ_DURATIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={p.duration === d.id ? 'true' : 'false'}
                  onClick={() => this.setPick(a, { duration: d.id })}
                  style={chip(p.duration === d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <input
              aria-label="Reason (optional)"
              placeholder="Reason (optional), e.g. great week, late to lobbies"
              value={p.reason}
              maxLength={140}
              onChange={(e) => this.setPick(a, { reason: e.target.value })}
              style={{ ...input, flex: '1 1 240px' }}
            />
          </div>
          <div
            style={{
              marginTop: '10px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <button
              type="button"
              disabled={!p.tier || saving}
              style={{ ...btn('primary'), opacity: p.tier ? '1' : '.4' }}
              onClick={() => {
                const t = tierById(p.tier);
                const d = ADJ_DURATIONS.find((x) => x.id === p.duration);
                this.send(
                  a,
                  {
                    action: 'adjust',
                    tier: p.tier,
                    duration: p.duration,
                    reason: p.reason,
                  },
                  (acc) =>
                    (a.name || a.email) +
                    ' got ' +
                    signed(t.points) +
                    ' ' +
                    t.name +
                    ' · now sees orders after ' +
                    acc.effective +
                    ' s',
                );
              }}
            >
              {saving ? 'Saving…' : a.adj ? 'Replace' : 'Apply'}
            </button>
            {a.adj ? (
              <button
                type="button"
                disabled={saving}
                style={btn()}
                onClick={() =>
                  this.send(
                    a,
                    { action: 'clearAdjust' },
                    (acc) =>
                      (a.name || a.email) +
                      ' is back to ' +
                      acc.effective +
                      ' s',
                  )
                }
              >
                Remove {signed(a.adj.points)}
              </button>
            ) : null}
            {p.tier ? (
              <span style={{ fontSize: '13px', color: C.dim }}>
                → sees orders after{' '}
                <b style={{ color: tone(this.preview(a, p.tier)) }}>
                  {this.preview(a, p.tier)} s
                </b>
              </span>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
          }}
        >
          <div>
            <div style={label}>Base priority</div>
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span
                aria-hidden="true"
                style={{ fontSize: '11.5px', color: C.faint }}
              >
                first
              </span>
              <label htmlFor={'prio-' + a.id} style={sr}>
                Base priority for {a.name || a.email}, in seconds
              </label>
              <input
                id={'prio-' + a.id}
                type="range"
                min="0"
                max="100"
                step="1"
                value={baseVal}
                onChange={(e) =>
                  this.setState({
                    base: { ...s.base, [a.id]: Number(e.target.value) },
                  })
                }
                style={{ flex: '1', minWidth: '0', accentColor: tone(baseVal) }}
              />
              <span
                aria-hidden="true"
                style={{ fontSize: '11.5px', color: C.faint }}
              >
                last
              </span>
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontSize: '18px',
                  fontWeight: '800',
                  color: tone(baseVal),
                  minWidth: '44px',
                  textAlign: 'right',
                }}
              >
                {baseVal} s
              </span>
            </div>
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                disabled={!baseDirty || saving}
                style={{ ...btn('primary'), opacity: baseDirty ? '1' : '.35' }}
                onClick={() =>
                  this.send(
                    a,
                    { action: 'set', prio: baseVal },
                    (acc) =>
                      (a.name || a.email) +
                      ' now sees orders after ' +
                      acc.effective +
                      ' s',
                  )
                }
              >
                Save base
              </button>
              {baseDirty ? (
                <button
                  type="button"
                  style={btn()}
                  onClick={() => {
                    const b = { ...s.base };
                    delete b[a.id];
                    this.setState({ base: b });
                  }}
                >
                  Undo
                </button>
              ) : null}
              {!baseDirty && a.custom ? (
                <button
                  type="button"
                  disabled={saving}
                  style={btn()}
                  onClick={() =>
                    this.send(
                      a,
                      { action: 'reset' },
                      (acc) =>
                        (a.name || a.email) +
                        ' is back to the default ' +
                        s.def +
                        ' s base',
                    )
                  }
                >
                  Reset to {s.def} s
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <div style={label}>Missed orders · last {s.rules.days} days</div>
            {a.missed ? (
              <>
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '8px 0 0',
                    padding: '0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}
                >
                  {(a.misses || []).map((m) => (
                    <li
                      key={m.id}
                      style={{
                        fontSize: '12.5px',
                        padding: '3px 9px',
                        borderRadius: '999px',
                        background: C.panel,
                        color: C.muted,
                      }}
                    >
                      {m.id} · {ago(m.at, s.now)}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={saving}
                  style={{ ...btn(), marginTop: '8px' }}
                  onClick={() =>
                    this.props.ask({
                      title:
                        'Forgive ' + (a.name || a.email) + '’s missed orders?',
                      body:
                        'Removes the −' +
                        a.penalty +
                        ' penalty right away. Orders they ignore from now on count again.',
                      confirm: 'Forgive',
                      onConfirm: () =>
                        this.send(
                          a,
                          { action: 'forgive' },
                          (acc) =>
                            (a.name || a.email) +
                            '’s missed orders are forgiven · ' +
                            acc.effective +
                            ' s',
                        ),
                    })
                  }
                >
                  Forgive {a.missed}
                </button>
              </>
            ) : (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: C.dim }}>
                None. They take what they’re online for.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  render() {
    const s = this.state;
    const q = s.q.trim().toLowerCase();
    const buffed = (a) => a.adj && a.adj.points > 0;
    const nerfed = (a) => (a.adj && a.adj.points < 0) || a.penalty > 0;
    const is = (a, f) =>
      f === 'All' ||
      (f === 'Online now' && a.online) ||
      (f === 'Buffed' && buffed(a)) ||
      (f === 'Nerfed' && nerfed(a)) ||
      (f === 'Missed orders' && a.missed > 0);
    const order = {
      fast: (a, b) => a.effective - b.effective,
      slow: (a, b) => b.effective - a.effective,
      online: (a, b) => b.online - a.online || a.effective - b.effective,
      name: (a, b) =>
        String(a.name || a.email).localeCompare(String(b.name || b.email)),
    }[s.sort];
    const list = s.accounts
      .filter(
        (a) =>
          is(a, s.filter) &&
          (!q ||
            [a.name, a.email].some((x) =>
              String(x || '')
                .toLowerCase()
                .includes(q),
            )),
      )
      .slice()
      .sort(
        (a, b) => order(a, b) || String(a.name).localeCompare(String(b.name)),
      );
    const count = (f) => s.accounts.filter((a) => is(a, f)).length;
    const online = s.accounts
      .filter((a) => a.online)
      .sort((a, b) => a.effective - b.effective);
    const missedTotal = s.accounts.reduce((t, a) => t + (a.missed || 0), 0);
    const avg = online.length
      ? Math.round(online.reduce((t, a) => t + a.effective, 0) / online.length)
      : null;

    const tiles = [
      [online.length, 'online now', C.green],
      [count('Buffed'), 'buffed', C.green],
      [count('Nerfed'), 'nerfed', C.pink],
      [
        missedTotal,
        'missed orders · ' + s.rules.days + ' d',
        missedTotal ? C.red : C.white,
      ],
      [avg == null ? '-' : avg + ' s', 'avg. wait online', C.white],
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <section aria-label="Priority at a glance" className="ops-kpis">
          {tiles.map(([v, l, color]) => (
            <div key={l} style={{ ...card, padding: '16px 18px' }}>
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontSize: '26px',
                  fontWeight: '700',
                  color,
                }}
              >
                {v}
              </div>
              <div style={{ fontSize: '13px', color: C.dim }}>{l}</div>
            </div>
          ))}
        </section>

        <section
          aria-labelledby="pr-how-h"
          style={{ ...card, padding: '18px' }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <h2 id="pr-how-h" style={h2}>
              Who sees new orders when
            </h2>
            <button
              type="button"
              aria-expanded={s.howOpen ? 'true' : 'false'}
              onClick={() => this.setState({ howOpen: !s.howOpen })}
              style={btn()}
            >
              {s.howOpen ? 'Hide' : 'How it works'}
            </button>
          </div>
          {/* the formula, always visible */}
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: C.muted,
            }}
          >
            {[
              ['Base', s.def + ' s by default', C.accent],
              ['Buffs', 'up to +35 · sees orders earlier', C.green],
              ['Nerfs', 'up to −35 · later', C.pink],
              [
                'Missed orders',
                '−' + s.rules.perMiss + ' each, automatic',
                C.red,
              ],
            ].map(([t, sub, color]) => (
              <span
                key={t}
                style={{
                  padding: '5px 10px',
                  borderRadius: '10px',
                  background: C.bg,
                  lineHeight: '1.25',
                }}
              >
                <b style={{ color }}>{t}</b>{' '}
                <span style={{ color: C.dim, fontSize: '12px' }}>{sub}</span>
              </span>
            ))}
            <span
              aria-hidden="true"
              style={{ fontWeight: '800', color: C.faint }}
            >
              →
            </span>
            <span
              style={{
                padding: '5px 10px',
                borderRadius: '10px',
                background: C.bg,
                lineHeight: '1.25',
              }}
            >
              <b style={{ color: C.white }}>Seconds before an order shows up</b>{' '}
              <span style={{ color: C.dim, fontSize: '12px' }}>
                lower is better
              </span>
            </span>
          </div>
          {s.howOpen ? (
            <p
              style={{
                margin: '12px 0 0',
                fontSize: '14px',
                lineHeight: '1.6',
                color: C.muted,
              }}
            >
              Priority is how many <b style={{ color: C.white }}>seconds</b> a
              new order waits before it appears, rings and notifies someone.
              Lower is better: 0 sees it the moment it comes in.
              <b style={{ color: C.green }}> Buffs</b> show them orders earlier
              and <b style={{ color: C.pink }}>nerfs</b> later, for 24 hours, 7
              days or until you remove them.
              <b style={{ color: C.red }}> Missed orders</b> are automatic: when
              an order times out while a teammate was online and could take it
              (in their queue for 60+ seconds), they get −{s.rules.perMiss} (
              {s.rules.perMiss} s later), up to −{s.rules.cap}, for{' '}
              {s.rules.days} days. Handover links skip priority.
              <b style={{ color: C.white }}>
                {' '}
                Teammates never see any of this.
              </b>
            </p>
          ) : null}

          <div style={{ marginTop: '16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                fontWeight: '600',
                color: C.faint,
                marginBottom: '8px',
              }}
            >
              <span>Order comes in · 0 s</span>
              <span>Online now</span>
              <span>100 s</span>
            </div>
            <div
              role="img"
              aria-label={
                online.length
                  ? 'Release timeline: ' +
                    online
                      .map(
                        (a) =>
                          (a.name || a.email) +
                          ' at ' +
                          a.effective +
                          ' seconds',
                      )
                      .join(', ')
                  : 'Nobody online right now'
              }
              style={{
                position: 'relative',
                height: '60px',
                borderRadius: '14px',
                background:
                  'linear-gradient(90deg, rgba(94, 234, 168, .14), rgba(214, 187, 255, .08) 50%, rgba(255, 138, 155, .12))',
                border: '1px solid ' + C.line,
              }}
            >
              {[0, 25, 50, 75, 100].map((t) => (
                <span
                  key={t}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 'calc(15px + (100% - 30px) * ' + t / 100 + ')',
                    top: '0',
                    bottom: '0',
                    width: '1px',
                    background:
                      t === s.def
                        ? 'rgba(214, 187, 255, .35)'
                        : 'rgba(196, 170, 255, .08)',
                  }}
                />
              ))}
              {online.map((a, i) => (
                <span
                  key={a.id}
                  title={(a.name || a.email) + ' · ' + a.effective + ' s'}
                  style={{
                    position: 'absolute',
                    left: 'calc((100% - 30px) * ' + a.effective / 100 + ')',
                    top: (i % 2 ? 24 : 6) + 'px',
                    width: '30px',
                    height: '30px',
                  }}
                >
                  <img
                    src={a.image || '/assets/avatars/avatar-1.png'}
                    alt=""
                    width="30"
                    height="30"
                    referrerPolicy="no-referrer"
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </span>
              ))}
              {!online.length ? (
                <span
                  style={{
                    position: 'absolute',
                    inset: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    color: C.dim,
                  }}
                >
                  Nobody online right now
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="pr-list-h"
          style={{ ...card, padding: '18px' }}
        >
          <h2 id="pr-list-h" style={sr}>
            Teammates and their priority
          </h2>
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
              placeholder="Search name or email…"
              value={s.q}
              onChange={(e) => this.setState({ q: e.target.value })}
              style={{ ...input, flex: '1 1 240px' }}
            />
            <select
              aria-label="Sort"
              value={s.sort}
              onChange={(e) => this.setState({ sort: e.target.value })}
              style={input}
            >
              <option value="fast">Sees orders first</option>
              <option value="slow">Sees orders last</option>
              <option value="online">Online first</option>
              <option value="name">Name</option>
            </select>
          </div>
          <div
            role="group"
            aria-label="Filter"
            style={{
              marginTop: '12px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
            }}
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
                  {count(f)}
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
              const t = a.adj ? tierByPoints(a.adj.points) : null;
              const open = s.open === a.id;
              const chipStyle = (color) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                fontWeight: '700',
                padding: '3px 9px',
                borderRadius: '999px',
                background: color + '1a',
                color,
                whiteSpace: 'nowrap',
              });
              return (
                <li
                  key={a.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '16px',
                    background: C.bg,
                    border:
                      '1px solid ' +
                      (open ? 'rgba(214, 187, 255, .35)' : C.line),
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '10px 16px',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flex: '1 1 220px',
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
                            title="Online now"
                            style={{
                              position: 'absolute',
                              right: '-1px',
                              bottom: '-1px',
                              width: '11px',
                              height: '11px',
                              borderRadius: '50%',
                              background: C.green,
                            }}
                          />
                        ) : null}
                      </span>
                      <span style={{ minWidth: '0', lineHeight: '1.3' }}>
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
                            {a.name || a.email}
                          </span>
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
                          {a.email}
                        </span>
                      </span>
                    </span>
                    {/* the breakdown */}
                    <span
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '6px',
                        flex: '2 1 300px',
                      }}
                    >
                      <span
                        title={
                          a.custom
                            ? 'Set by ' +
                              (a.changedBy || 'an admin') +
                              (a.changedAt ? ' ' + ago(a.changedAt, s.now) : '')
                            : 'Default'
                        }
                        style={chipStyle(C.muted)}
                      >
                        Base {a.prio} s{a.custom ? '' : ' · default'}
                      </span>
                      {t ? (
                        <span
                          title={
                            (a.adj.reason ? a.adj.reason + ' · ' : '') +
                            'by ' +
                            a.adj.by
                          }
                          style={chipStyle(t.color)}
                        >
                          {signed(t.points)} {t.name} ·{' '}
                          {left(a.adj.until, s.now)}
                        </span>
                      ) : null}
                      {a.penalty ? (
                        <span
                          title={
                            'Missed: ' +
                            (a.misses || []).map((m) => m.id).join(', ')
                          }
                          style={chipStyle(C.red)}
                        >
                          −{a.penalty} Missed orders ×{a.missed}
                        </span>
                      ) : null}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flex: '0 0 auto',
                        marginLeft: 'auto',
                      }}
                    >
                      <span style={{ textAlign: 'right', lineHeight: '1.15' }}>
                        <span
                          style={{
                            display: 'block',
                            fontFamily: DISPLAY,
                            fontSize: '22px',
                            fontWeight: '800',
                            color: tone(a.effective),
                          }}
                        >
                          {a.effective} s
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '11.5px',
                            color: C.dim,
                          }}
                        >
                          sees orders after
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-expanded={open ? 'true' : 'false'}
                        onClick={() =>
                          this.setState({ open: open ? null : a.id })
                        }
                        style={btn(open ? 'primary' : undefined)}
                      >
                        {open ? 'Close' : 'Adjust'}
                      </button>
                    </span>
                  </div>
                  {open ? this.renderEditor(a) : null}
                </li>
              );
            })}
            {s.loaded && !list.length ? (
              <li style={{ color: C.dim, fontSize: '14px' }}>
                {q || s.filter !== 'All'
                  ? 'No teammates match.'
                  : 'No teammates yet.'}
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    );
  }
}
