import React, { useCallback, useEffect, useState } from 'react';
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

// Admin → Performance (migration 20261030120000, docs/product/performance-ranking.md). Every
// number comes from /api/admin/performance; the database computes scores, ranks and brackets.
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

function History({ api, userId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    api
      .get('/api/admin/performance?user=' + encodeURIComponent(userId))
      .then((r) => live && setRows(r.ok ? r.data.history : []));
    return () => {
      live = false;
    };
  }, [api, userId]);
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

function Settings({ api, toast, settings, onSaved }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (settings)
      setForm({
        wRetention: settings.w_retention,
        wSatisfaction: settings.w_satisfaction,
        wOrders: settings.w_orders,
        windowDays: settings.window_days,
        minOrders: settings.min_orders,
        minReviews: settings.min_reviews,
        minCustomers: settings.min_customers,
      });
  }, [settings]);
  if (!form) return null;
  const total = form.wRetention + form.wSatisfaction + form.wOrders;
  const field = (key, labelText, min, max, suffix) => (
    <label
      key={key}
      style={{ display: 'grid', gap: '6px', fontSize: '13px', color: C.muted }}
    >
      {labelText}
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="number"
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
    if (total !== 100)
      return toast('The three weights must add up to 100%.', 'warn');
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
        Changes apply from the next recalculation. Last changed{' '}
        {settings.updated_by ? 'by ' + settings.updated_by + ' ' : ''}
        {ago(Date.parse(settings.updated_at), Date.now())}.
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
      </div>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        style={{
          ...btn('primary'),
          marginTop: '18px',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </section>
  );
}

export default function Performance({ api, toast }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get('/api/admin/performance');
    if (r.ok) {
      setData(r.data);
      setError('');
    } else setError(r.error || 'Can’t load the rankings.');
  }, [api]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const recalc = async () => {
    setBusy(true);
    const r = await api.post('/api/admin/performance', {
      action: 'recalculate',
    });
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
              {data.run
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
              {data.discordEnabled
                ? 'Discord roles sync after every recalculation ("Performance | TOP X%")'
                : 'Discord role sync is off (DISCORD_ROLE_SYNC_ENABLED), rankings still update'}
            </p>
          </div>
          <button
            type="button"
            onClick={recalc}
            disabled={busy}
            style={{ ...btn('primary'), opacity: busy ? 0.6 : 1 }}
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
                          {c.returningCustomers} of {c.customers}
                        </td>
                        <td style={td}>
                          <Trend rank={c.rank} previous={c.previousRank} />
                        </td>
                        <td style={td} title={c.discord.detail || undefined}>
                          <span
                            style={{ color: statusColor, fontWeight: '600' }}
                          >
                            {statusText}
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
                            colSpan={11}
                            style={{ ...td, whiteSpace: 'normal' }}
                          >
                            <History api={api} userId={c.userId} />
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
      />
    </div>
  );
}
