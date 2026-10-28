'use client';

import React from 'react';
import { PAYOUT_DAY, PLATFORM_FEE } from '../../design-reference/lib/adminData';
import { RELEASE_DAYS, TIERS } from '../../design-reference/lib/trust';
import {
  C,
  DISPLAY,
  card,
  th,
  td,
  chip,
  btn,
  pill,
  usd,
} from '../../design-reference/components/admin/ui';

const sum = (list, k) => list.reduce((a, x) => a + x[k], 0);
const day = (t) =>
  new Date(t).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
// Fri 9 Oct → Thu 15 Oct (the week ends at Friday 00:00, so its last full day is Thursday)
const weekLabel = (p) =>
  new Date(p.start).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  }) +
  ' to ' +
  new Date(p.end - 1).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

export default class Payouts extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      filter: 'All',
      payouts: [],
      loaded: false,
      error: '',
      busy: false,
    };
  }
  componentDidMount() {
    this.load();
  }
  load = async () => {
    const response = await this.props.api.get('/api/admin/payouts');
    if (!response.ok)
      return this.setState({
        loaded: true,
        error: response.error || 'Couldn’t load payouts.',
      });
    this.setState({
      loaded: true,
      error: '',
      payouts: (response.data.payouts || []).map((p) => ({
        ...p,
        tierColor:
          (TIERS.find((t) => t.name === p.tier) || {}).color || C.accent,
      })),
    });
  };
  command = async (body, success) => {
    if (this.state.busy) return;
    this.setState({ busy: true });
    const response = await this.props.api.post('/api/admin/payouts', body);
    this.setState({ busy: false });
    if (!response.ok)
      return this.props.toast(
        response.error || 'Couldn’t update that payout.',
        'warn',
      );
    this.props.toast(success);
    this.props.log();
    this.load();
  };
  paymentPrompt = (title, body, onConfirm) =>
    this.props.ask({
      title,
      body,
      confirm: 'Mark paid',
      field: {
        label: 'Payment method',
        options: ['wise', 'bank', 'paypal', 'other'],
        value: 'wise',
        required: true,
      },
      field2: {
        label: 'Transfer reference',
        placeholder: 'Bank or Wise reference',
        required: true,
      },
      onConfirm,
    });
  exportCsv = () => {
    const rows = this.state.payouts.filter((p) => p.status === 'Scheduled');
    const quote = (value) =>
      '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const csv = [
      ['name', 'email', 'country', 'payout method', 'amount USD'],
      ...rows.map((p) => [
        p.legalName || p.teammate,
        p.email,
        p.country,
        p.payoutMethod,
        Number(p.total).toFixed(2),
      ]),
    ]
      .map((row) => row.map(quote).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'duoly-scheduled-payouts.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  render() {
    const data = { payouts: this.state.payouts };
    const ask = this.props.ask;
    const actions = {
      payAll: () =>
        this.paymentPrompt(
          'Mark all scheduled payouts as paid?',
          'Pay every transfer outside Duoly first. On hold and running weeks are skipped.',
          (method, reference) =>
            this.command(
              { action: 'payAll', method, reference },
              'Marked scheduled payouts paid.',
            ),
        ),
      payPayout: (id) =>
        this.paymentPrompt(
          'Mark this payout as paid?',
          'Send the transfer outside Duoly first, then record its method and reference.',
          (method, reference) =>
            this.command(
              { action: 'pay', payoutId: id, method, reference },
              'Marked payout paid.',
            ),
        ),
      holdPayout: (id, reason) =>
        this.command(
          { action: 'hold', payoutId: id, reason },
          'Payout placed on hold.',
        ),
      releasePayout: (id) =>
        this.command(
          { action: 'release', payoutId: id },
          'Payout hold released.',
        ),
    };
    const s = this.state;
    if (!s.loaded)
      return <p style={{ margin: 0, color: C.dim }}>Loading payouts…</p>;
    if (s.error)
      return (
        <p role="alert" style={{ margin: 0, color: C.red }}>
          {s.error}
        </p>
      );
    const scheduled = data.payouts.filter((p) => p.status === 'Scheduled');
    const hold = data.payouts.filter((p) => p.status === 'On hold');
    const paid = data.payouts.filter((p) => p.status === 'Paid');
    const accruing = data.payouts.filter((p) => p.status === 'Accruing');
    // newest week first, biggest payout first within a week
    const list = data.payouts
      .filter((p) => s.filter === 'All' || p.status === s.filter)
      .slice()
      .sort((a, b) => b.start - a.start || b.total - a.total);
    const tiles = [
      [
        usd(sum(scheduled, 'total')),
        'ready to pay · ' +
          scheduled.length +
          (scheduled.length === 1 ? ' payout' : ' payouts'),
        C.cyan,
      ],
      [
        usd(sum(accruing, 'total')),
        'this week so far · paid next ' + PAYOUT_DAY,
        C.accent,
      ],
      [usd(sum(hold, 'total')), 'on hold · ' + hold.length, C.red],
      [
        usd(sum(accruing, 'held')),
        'deposits held this week (back after ' + RELEASE_DAYS + ' days)',
        C.gold,
      ],
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <section aria-label="Payout totals" className="ops-kpis">
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
          aria-label="Payouts by week"
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
            <div
              role="group"
              aria-label="Status"
              style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}
            >
              {[
                ['All', data.payouts.length],
                ['Scheduled', scheduled.length],
                ['Accruing', accruing.length],
                ['On hold', hold.length],
                ['Paid', paid.length],
              ].map(([f, n]) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={s.filter === f ? 'true' : 'false'}
                  onClick={() => this.setState({ filter: f })}
                  style={chip(s.filter === f)}
                >
                  {f}
                  <span style={{ opacity: '.65', fontWeight: '500' }}>{n}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={!scheduled.length}
                style={{ ...btn(), opacity: scheduled.length ? '1' : '.4' }}
                onClick={this.exportCsv}
              >
                Export CSV
              </button>
              <button
                type="button"
                disabled={!scheduled.length || s.busy}
                style={{
                  ...btn('primary'),
                  opacity: scheduled.length && !s.busy ? '1' : '.4',
                }}
                onClick={() =>
                  ask({
                    title:
                      'Pay ' +
                      scheduled.length +
                      (scheduled.length === 1 ? ' payout' : ' payouts') +
                      ' · ' +
                      usd(sum(scheduled, 'total')) +
                      '?',
                    body: 'Marks every payout from finished weeks as paid. Payouts on hold and this week’s running total are skipped. No money is sent. Pay each transfer yourself first.',
                    confirm: 'Continue',
                    onConfirm: () => actions.payAll(),
                  })
                }
              >
                Pay all scheduled
              </button>
            </div>
          </div>
          <div className="ops-table-wrap" style={{ marginTop: '12px' }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th style={th}>Teammate</th>
                  <th style={th}>Week</th>
                  <th style={th}>Level</th>
                  <th style={{ ...th, textAlign: 'right' }}>Earned + tips</th>
                  <th style={{ ...th, textAlign: 'right' }}>Deposit held</th>
                  <th style={{ ...th, textAlign: 'right' }}>
                    Deposit released
                  </th>
                  <th style={{ ...th, textAlign: 'right' }}>Payout</th>
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
                {list.map((p) => (
                  <tr key={p.id}>
                    <td style={td}>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <img
                          src={p.av}
                          alt=""
                          width="30"
                          height="30"
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                          }}
                        />
                        <span style={{ lineHeight: '1.3' }}>
                          <span
                            style={{
                              display: 'block',
                              fontWeight: '600',
                              color: C.white,
                            }}
                          >
                            {p.teammate}
                          </span>
                          <span
                            style={{
                              display: 'block',
                              fontSize: '12px',
                              color: C.dim,
                            }}
                          >
                            {p.orders} {p.orders === 1 ? 'order' : 'orders'}
                            {p.tips ? ' · ' + usd(p.tips) + ' tips' : ''}
                            {p.adjust ? (
                              <span
                                title={(p.adjustments || [])
                                  .map(
                                    (a) =>
                                      (a.amount < 0 ? '−$' : '+$') +
                                      Math.abs(a.amount).toFixed(2) +
                                      ' ' +
                                      a.reason +
                                      ' (' +
                                      a.by +
                                      ')',
                                  )
                                  .join('\n')}
                                style={{
                                  color: p.adjust < 0 ? C.red : C.green,
                                }}
                              >
                                {' · ' +
                                  (p.adjust < 0
                                    ? '−' + usd(-p.adjust)
                                    : '+' + usd(p.adjust)) +
                                  ' adjusted'}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {weekLabel(p)}
                      <span
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          color: C.dim,
                        }}
                      >
                        {p.status === 'Accruing'
                          ? 'paid ' + day(p.dueAt)
                          : p.status === 'Paid' && p.paidAt
                            ? 'paid ' + day(p.paidAt)
                            : 'due ' + day(p.dueAt)}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{ fontWeight: '700', color: p.tierColor }}>
                        {p.tier}
                      </span>{' '}
                      <span style={{ color: C.dim, fontSize: '12.5px' }}>
                        · {p.deposit}%
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {usd(p.gross)}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: 'right',
                        color: p.held ? C.gold : C.faint,
                      }}
                    >
                      {p.held ? '- ' + usd(p.held) : '-'}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: 'right',
                        color: p.releasing ? C.green : C.faint,
                      }}
                    >
                      {p.releasing ? '+ ' + usd(p.releasing) : '-'}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: 'right',
                        color: C.white,
                        fontWeight: '700',
                      }}
                    >
                      {usd(p.total)}
                    </td>
                    <td style={td}>
                      <span
                        title={p.reason || undefined}
                        style={pill(p.status)}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {p.status === 'Paid' || p.status === 'Accruing' ? (
                        <span style={{ fontSize: '13px', color: C.dim }}>
                          {p.status === 'Paid' ? 'Done' : 'Week running'}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: '6px' }}>
                          {p.status === 'Scheduled' ? (
                            <button
                              type="button"
                              style={btn()}
                              onClick={() =>
                                ask({
                                  title:
                                    'Mark ' +
                                    usd(p.total) +
                                    ' to ' +
                                    p.teammate +
                                    ' as paid?',
                                  body: 'Only records it. Send the money yourself first: no payout provider is connected yet.',
                                  confirm: 'Mark paid',
                                  onConfirm: () => actions.payPayout(p.id),
                                })
                              }
                            >
                              Mark paid
                            </button>
                          ) : null}
                          {p.status === 'On hold' ? (
                            <button
                              type="button"
                              style={btn()}
                              onClick={() =>
                                ask({
                                  title:
                                    'Release the hold on ' + p.teammate + '?',
                                  body:
                                    'Their payout goes back to scheduled.' +
                                    (p.reason ? ' Held for: ' + p.reason : ''),
                                  confirm: 'Release hold',
                                  onConfirm: () => actions.releasePayout(p.id),
                                })
                              }
                            >
                              Release
                            </button>
                          ) : (
                            <button
                              type="button"
                              style={btn('danger')}
                              onClick={() =>
                                ask({
                                  title: 'Hold ' + p.teammate + '’s payout?',
                                  body: 'Nothing is paid until you release it.',
                                  confirm: 'Hold payout',
                                  kind: 'danger',
                                  field: {
                                    label: 'Reason',
                                    placeholder:
                                      'e.g. open customer report R-3',
                                    required: true,
                                  },
                                  onConfirm: (reason) =>
                                    actions.holdPayout(p.id, reason),
                                })
                              }
                            >
                              Hold
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!list.length ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        ...td,
                        textAlign: 'center',
                        color: C.dim,
                        padding: '36px 12px',
                      }}
                    >
                      {data.payouts.length
                        ? 'No payouts here.'
                        : 'No payouts yet. They show up once teammates complete orders.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '12px 0 0', fontSize: '13px', color: C.dim }}>
            {'All in USD, from completed orders. A week runs Friday to Friday and is paid on the Friday it ends. Earned = ' +
              Math.round((1 - PLATFORM_FEE) * 100) +
              '% of the order converted from EUR, plus tips (100% to the teammate). Manual adjustments (Teammates → Adjust balance) are added to the week they were made in. The deposit % comes from the teammate’s trust level and is paid back after ' +
              RELEASE_DAYS +
              ' days.'}
          </p>
        </section>
      </div>
    );
  }
}
