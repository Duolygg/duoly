import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  C,
  DISPLAY,
  card,
  h2,
  th,
  td,
  chip,
  btn,
  input,
  ago,
  dateTime,
} from '../../design-reference/components/admin/ui';
import {
  BRACKETS,
  BRACKET_COLORS,
  bracketLabel,
  bracketRoleName,
} from '../../contracts/performance';

import { DEMO_DATA, DEMO_HISTORY } from './performance-demo';

// Admin → Performance (migration 20261030120000, docs/product/performance-ranking.md). Every
// live number comes from /api/admin/performance. Demo uses an isolated fictional cohort.
// Recalculation runs every 12 hours by itself; "Recalculate now" also re-syncs the Discord roles.

const REFRESH_MS = 60_000;
const FILTERS = ['All', 'Ranked', 'Not eligible', 'Discord issues'];
const STATUS = {
  synced: ['Synced', C.green],
  pending: ['Pending', C.gold],
  no_discord: ['No Discord', C.dim],
  not_member: ['Not in server', C.dim],
  error: ['Error', C.red],
  off: ['Sync off', C.dim],
};
const pct = (v) =>
  v === null || v === undefined ? '' : Math.round(v * 100) + '%';
const fixed = (v, d = 1) =>
  v === null || v === undefined ? '' : Number(v).toFixed(d);

function Badge({ bracket }) {
  const color = bracket ? BRACKET_COLORS[bracket] : C.dim;
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '3px 9px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: '700',
        color,
        background: bracket ? color + '1F' : 'rgba(196, 170, 255, .06)',
        border: '1px solid ' + (bracket ? color + '55' : C.line2),
      }}
    >
      {bracketLabel(bracket)}
    </span>
  );
}

function Trend({ rank, previous }) {
  if (!rank || !previous || rank === previous)
    return (
      <span style={{ color: C.faint }}>{rank && previous ? '=' : ''}</span>
    );
  const up = rank < previous;
  return (
    <span style={{ color: up ? C.green : C.red, fontWeight: '600' }}>
      {up ? '▲' : '▼'} {Math.abs(previous - rank)}
    </span>
  );
}

function History({ api, userId, demo }) {
  const [rows, setRows] = useState(demo ? DEMO_HISTORY[userId] : null);
  useEffect(() => {
    if (demo) return;
    let live = true;
    api
      .get('/api/admin/performance?user=' + encodeURIComponent(userId))
      .then((r) => live && setRows(r.ok ? r.data.history : []));
    return () => {
      live = false;
    };
  }, [api, userId, demo]);
  if (!rows)
    return (
      <p style={{ margin: 0, color: C.dim, fontSize: '13px' }}>
        Loading history…
      </p>
    );
  if (!rows.length)
    return (
      <p style={{ margin: 0, color: C.dim, fontSize: '13px' }}>
        No history yet.
      </p>
    );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {rows.slice(0, 20).map((h) => (
        <div
          key={h.run}
          style={{
            padding: '8px 10px',
            borderRadius: '12px',
            background: C.bg,
            border: '1px solid ' + C.line,
            fontSize: '12.5px',
            color: C.muted,
            minWidth: '120px',
          }}
        >
          <div style={{ color: C.faint }}>{dateTime(Date.parse(h.at))}</div>
          {h.eligible ? (
            <div
              style={{
                marginTop: '4px',
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
              }}
            >
              <strong style={{ color: C.white }}>{fixed(h.score)}</strong>
              <span>
                #{h.rank} of {h.of}
              </span>
            </div>
          ) : (
            <div style={{ marginTop: '4px' }}>Not eligible</div>
          )}
          {h.bracket ? (
            <div style={{ marginTop: '4px' }}>
              <Badge bracket={h.bracket} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Settings({ api, toast, settings, onSaved, readOnly }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (settings)
      setForm({
        wRetention: settings.w_retention,
        wSatisfaction: settings.w_satisfaction,
        wOrders: settings.w_orders,
        wWinrate: settings.w_winrate ?? 0,
        windowDays: settings.window_days,
        minOrders: settings.min_orders,
        minReviews: settings.min_reviews,
        minCustomers: settings.min_customers,
        minWinLossGames: settings.min_wl_games ?? 20,
      });
  }, [settings]);
  if (!form) return null;
  const total =
    form.wRetention + form.wSatisfaction + form.wOrders + form.wWinrate;
  const field = (key, labelText, min, max, suffix) => (
    <label
      key={key}
      style={{ display: 'grid', gap: '6px', fontSize: '13px', color: C.muted }}
    >
      {labelText}
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="number"
          disabled={readOnly}
          min={min}
          max={max}
          value={form[key]}
          onChange={(e) =>
            setForm({ ...form, [key]: Math.round(Number(e.target.value) || 0) })
          }
          style={{ ...input, width: '96px' }}
        />
        <span style={{ color: C.faint }}>{suffix}</span>
      </span>
    </label>
  );
  const save = async () => {
    if (readOnly) return;
    if (total !== 100)
      return toast('The four weights must add up to 100%.', 'warn');
    setBusy(true);
    const r = await api.post('/api/admin/performance', {
      action: 'settings',
      ...form,
    });
    setBusy(false);
    if (!r.ok) return toast(r.error || 'Couldn’t save the settings.', 'warn');
    toast('Saved. The next recalculation uses the new settings.');
    onSaved();
  };
  return (
    <section
      style={{ ...card, padding: '20px', marginTop: '18px' }}
      aria-labelledby="perf-set-h"
    >
      <h2 id="perf-set-h" style={h2}>
        Scoring and eligibility
      </h2>
      <p style={{ margin: '6px 0 0', fontSize: '13px', color: C.dim }}>
        {readOnly ? (
          'Sample settings only. Editing and saving are disabled.'
        ) : (
          <>
            Changes apply from the next recalculation. Last changed{' '}
            {settings.updated_by ? 'by ' + settings.updated_by + ' ' : ''}
            {ago(Date.parse(settings.updated_at), Date.now())}.
          </>
        )}
      </p>
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {field('wRetention', 'Customer retention', 0, 100, '%')}
        {field('wSatisfaction', 'Customer satisfaction', 0, 100, '%')}
        {field('wOrders', 'Completed orders', 0, 100, '%')}
        {field('wWinrate', 'Winrate', 0, 100, '%')}
      </div>
      <p
        role="status"
        style={{
          margin: '8px 0 0',
          fontSize: '13px',
          color: total === 100 ? C.green : C.red,
        }}
      >
        Weights add up to {total}%{total === 100 ? '' : ', they must make 100%'}
      </p>
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {field('windowDays', 'Window', 7, 365, 'days')}
        {field('minOrders', 'Minimum completed orders', 1, 1000, '')}
        {field('minReviews', 'Minimum reviews', 0, 1000, '')}
        {field('minCustomers', 'Minimum different customers', 1, 1000, '')}
        {field(
          'minWinLossGames',
          'Reported games before winrate counts',
          1,
          1000,
          '',
        )}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={busy || readOnly}
        style={{
          ...btn('primary'),
          marginTop: '18px',
          opacity: busy || readOnly ? 0.6 : 1,
          cursor: readOnly ? 'not-allowed' : 'pointer',
        }}
      >
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </section>
  );
}

export default function Performance({ api, toast }) {
  const [demo, setDemo] = useState(false);
  return (
    <div>
      <section
        style={{ ...card, padding: '20px', marginBottom: '18px' }}
        aria-label="Preview mode"
      >
        <button
          type="button"
          style={btn()}
          onClick={() => setDemo(!demo)}
          aria-pressed={demo}
        >
          {demo ? 'Back to live' : 'Show demo'}
        </button>
        {demo ? (
          <div>
            <h2 style={{ ...h2, marginTop: '14px' }}>Demo preview</h2>
            <p style={{ color: C.muted, fontSize: '13px' }}>
              Sample data only. Seven representative rows from 100 fictional
              eligible teammates plus one ineligible teammate. Bracket counts
              describe these representative rows, not the full cohort. No real
              accounts, database writes or Discord changes. History and Discord
              statuses are simulated. Scores use 40% winrate, 25% retention, 20%
              satisfaction and 15% completed orders.
            </p>
          </div>
        ) : null}
      </section>
      <Ranking
        key={demo ? 'demo' : 'live'}
        api={api}
        toast={toast}
        demo={demo}
      />
    </div>
  );
}

function Ranking({ api, toast, demo }) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [data, setData] = useState(demo ? DEMO_DATA : null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (demo || !active.current) return;
    const r = await api.get('/api/admin/performance');
    if (!active.current) return;

    if (r.ok) {
      setData(r.data);
      setError('');
    } else setError(r.error || 'Can’t load the rankings.');
  }, [api, demo]);
  useEffect(() => {
    if (demo) return;
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, demo]);

  const recalc = async () => {
    if (demo) return;
    setBusy(true);
    const r = await api.post('/api/admin/performance', {
      action: 'recalculate',
    });
    if (!active.current) return;

    setBusy(false);
    if (!r.ok) return toast(r.error || 'Couldn’t recalculate.', 'warn');
    toast(r.data.eligible + ' of ' + r.data.teammates + ' teammates ranked.');
    void load();
  };

  if (!data)
    return (
      <section style={{ ...card, padding: '20px' }}>
        <p style={{ margin: 0, color: error ? C.red : C.dim }}>
          {error || 'Loading rankings…'}
        </p>
      </section>
    );

  const list = data.contractors || [];
  const status = (c) => (data.discordEnabled ? c.discord.status : 'off');
  const shown = list.filter(
    (c) =>
      filter === 'All' ||
      (filter === 'Ranked' && c.eligible) ||
      (filter === 'Not eligible' && !c.eligible) ||
      (filter === 'Discord issues' &&
        ['error', 'not_member', 'no_discord'].includes(status(c))),
  );
  const perBracket = BRACKETS.map((b) => [
    b,
    list.filter((c) => c.bracket === b).length,
  ]);

  return (
    <div>
      <section style={{ ...card, padding: '20px' }} aria-labelledby="perf-h">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div>
            <h2 id="perf-h" style={h2}>
              Performance ranking
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: C.dim }}>
              {demo
                ? 'Sample snapshot: October 30, 2026. 100 eligible fictional teammates.'
                : data.run
                  ? 'Last calculated ' +
                    ago(Date.parse(data.run.at), Date.now()) +
                    (data.run.trigger === 'manual'
                      ? ' by ' + (data.run.by || 'an admin')
                      : ' automatically') +
                    ' · ' +
                    data.run.eligible +
                    ' of ' +
                    data.run.teammates +
                    ' teammates ranked · runs every 12 hours'
                  : 'Not calculated yet. It runs every 12 hours, or now with the button.'}
            </p>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '13px',
                color: data.discordEnabled ? C.green : C.gold,
              }}
            >
              {demo
                ? 'Simulated Discord statuses only. No sync is performed.'
                : data.discordEnabled
                  ? 'Discord roles sync after every recalculation ("Performance | TOP X%")'
                  : 'Discord role sync is off (DISCORD_ROLE_SYNC_ENABLED), rankings still update'}
            </p>
          </div>
          <button
            type="button"
            onClick={recalc}
            disabled={busy || demo}
            style={{
              ...btn('primary'),
              opacity: busy || demo ? 0.6 : 1,
              cursor: demo ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Recalculating…' : 'Recalculate now'}
          </button>
        </div>

        <div
          style={{
            marginTop: '16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {perBracket.map(([b, n]) => (
            <span
              key={b}
              title={bracketRoleName(b)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '12px',
                background: BRACKET_COLORS[b] + '14',
                border: '1px solid ' + BRACKET_COLORS[b] + '44',
                color: BRACKET_COLORS[b],
                fontSize: '13px',
                fontWeight: '700',
              }}
            >
              TOP {b}%
              <span style={{ color: C.text, fontFamily: DISPLAY }}>{n}</span>
            </span>
          ))}
        </div>
      </section>

      <section
        style={{ ...card, padding: '20px', marginTop: '18px' }}
        aria-label="Contractors"
      >
        <div
          role="group"
          aria-label="Filter"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={chip(filter === f)}
              aria-pressed={filter === f}
            >
              {f}
            </button>
          ))}
        </div>
        {!shown.length ? (
          <p style={{ margin: '16px 0 0', color: C.dim, fontSize: '14px' }}>
            {list.length
              ? 'Nobody matches this filter.'
              : 'No teammates in the latest calculation.'}
          </p>
        ) : (
          <div
            className="dl-scroll"
            style={{ marginTop: '14px', overflowX: 'auto' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    'Rank',
                    'Teammate',
                    'Bracket',
                    'Score',
                    'Retention',
                    'Satisfaction',
                    'Orders',
                    'Winrate',
                    'Returning',
                    'Trend',
                    'Discord',
                    '',
                  ].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const [statusText, statusColor] =
                    STATUS[status(c)] || STATUS.pending;
                  return (
                    <React.Fragment key={c.userId}>
                      <tr>
                        <td
                          style={{ ...td, color: C.white, fontWeight: '700' }}
                        >
                          {c.rank ? '#' + c.rank : ''}
                        </td>
                        <td style={{ ...td, color: C.white }}>
                          {c.name || 'Teammate'}
                          {!c.eligible ? (
                            <div style={{ fontSize: '12px', color: C.faint }}>
                              {c.reason}
                            </div>
                          ) : null}
                        </td>
                        <td style={td}>
                          <Badge bracket={c.bracket} />
                          {c.percentile !== null ? (
                            <div
                              style={{
                                fontSize: '12px',
                                color: C.faint,
                                marginTop: '3px',
                              }}
                            >
                              top {fixed(c.percentile, 0)}%
                            </div>
                          ) : null}
                        </td>
                        <td
                          style={{
                            ...td,
                            fontFamily: DISPLAY,
                            fontSize: '16px',
                            color: C.white,
                          }}
                        >
                          {fixed(c.score)}
                        </td>
                        <td style={td}>
                          {pct(c.retentionRate)}
                          <div style={{ fontSize: '12px', color: C.faint }}>
                            {fixed(c.retentionScore)} pts
                          </div>
                        </td>
                        <td style={td}>
                          {c.avgRating !== null
                            ? '★ ' + fixed(c.avgRating, 2)
                            : 'No reviews'}
                          <div style={{ fontSize: '12px', color: C.faint }}>
                            {c.reviews} reviews
                            {c.satisfactionScore !== null
                              ? ' · ' + fixed(c.satisfactionScore) + ' pts'
                              : ''}
                          </div>
                        </td>
                        <td style={td}>
                          {c.completedOrders}
                          <div style={{ fontSize: '12px', color: C.faint }}>
                            {c.ordersScore !== null
                              ? fixed(c.ordersScore) + ' pts'
                              : ''}
                          </div>
                        </td>
                        <td style={td}>
                          {(c.winLossWins ?? 0) + (c.winLossLosses ?? 0)
                            ? Math.round(
                                (100 * c.winLossWins) /
                                  (c.winLossWins + c.winLossLosses),
                              ) + '%'
                            : '—'}
                          <div style={{ fontSize: '12px', color: C.faint }}>
                            {(c.winLossWins ?? 0) +
                              'W ' +
                              (c.winLossLosses ?? 0) +
                              'L'}
                            {c.winrateScore != null
                              ? ' · ' + fixed(c.winrateScore) + ' pts'
                              : (c.winLossWins ?? 0) + (c.winLossLosses ?? 0)
                                ? ' · not counted yet'
                                : ''}
                          </div>
                        </td>
                        <td style={td}>
                          {c.returningCustomers} of {c.customers}
                        </td>
                        <td style={td}>
                          <Trend rank={c.rank} previous={c.previousRank} />
                        </td>
                        <td style={td} title={c.discord.detail || undefined}>
                          <span
                            style={{ color: statusColor, fontWeight: '600' }}
                          >
                            {demo ? 'Simulated: ' + statusText : statusText}
                          </span>
                          <div style={{ fontSize: '12px', color: C.faint }}>
                            {c.discord.username ? '@' + c.discord.username : ''}
                            {c.discord.syncedAt
                              ? ' · ' +
                                ago(Date.parse(c.discord.syncedAt), Date.now())
                              : ''}
                          </div>
                        </td>
                        <td style={td}>
                          <button
                            type="button"
                            onClick={() =>
                              setOpen(open === c.userId ? null : c.userId)
                            }
                            aria-expanded={open === c.userId}
                            style={btn()}
                          >
                            {open === c.userId ? 'Hide history' : 'History'}
                          </button>
                        </td>
                      </tr>
                      {open === c.userId ? (
                        <tr>
                          <td
                            colSpan={12}
                            style={{ ...td, whiteSpace: 'normal' }}
                          >
                            <History api={api} userId={c.userId} demo={demo} />
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Settings
        api={api}
        toast={toast}
        settings={data.settings}
        onSaved={load}
        readOnly={demo}
      />
    </div>
  );
}
