import React from 'react';
import {
  C,
  DISPLAY,
  card,
  h2,
  th,
  td,
  btn,
  input,
  pill,
  eur,
  dateOnly,
} from '../../design-reference/components/admin/ui';
import { CREATOR_RULES, REF_CODE } from '../../contracts/creators';

// Admin Creators (ledger #28). The original repo had the public /creators page and its rules
// (lib/creators.js) but no admin screen and no code tracking; this screen is new and built
// from the admin's own parts (cards, tables, pills, confirm dialog). Codes are added and paused
// here with an audit entry; attribution and commission come from the database. Nothing here
// pays anyone: commission is what the creator has earned, to be paid by hand.

const toMs = (v) => (v ? Date.parse(v) : null);
const ORDER_STATUS = {
  queued: 'Queued',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const tierName = (id) =>
  (CREATOR_RULES.tiers.find((t) => t.id === id) || { name: id }).name;
const monthLabel = (m) => {
  const [y, mo] = String(m).split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/** Server creator -> screen shape (money in EUR, times in ms). */
export function creatorRow(c) {
  return {
    ...c,
    createdAt: toMs(c.createdAt),
    owed: (c.owedCents || 0) / 100,
    months: (c.months || []).map((m) => ({
      ...m,
      base: m.baseCents / 100,
      commissionEur: m.commissionCents / 100,
    })),
  };
}
/** Server attributed order -> screen shape. Counts once completed and not refunded. */
export function referralOrder(o) {
  const refunded = ['refunded', 'voided'].includes(o.payment);
  const counts =
    o.status === 'completed' && !refunded
      ? 'Yes'
      : (o.status === 'queued' || o.status === 'in_progress') && !refunded
        ? 'When completed'
        : 'No';
  return {
    ...o,
    at: toMs(o.at),
    status: ORDER_STATUS[o.status] || o.status,
    amount: o.amountCents / 100,
    base: Math.max(0, o.amountCents - (o.refundCents || 0)) / 100,
    counts,
  };
}

export default class Creators extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      creators: [],
      orders: [],
      loaded: false,
      error: '',
      referralsEnabled: null,
      open: null,
      busy: '',
      f: { code: '', name: '', channel: '' },
      formError: '',
    };
  }
  componentDidMount() {
    this.load();
    this.props.api.get('/api/admin/settings').then((r) => {
      if (r.ok) this.setState({ referralsEnabled: !!r.data.referralsEnabled });
    });
  }
  async load() {
    const r = await this.props.api.get('/api/admin/creators');
    if (!r.ok)
      return this.setState({
        error: r.error || 'Couldn’t load creators.',
        loaded: true,
      });
    this.setState({
      creators: (r.data.creators || []).map(creatorRow),
      orders: (r.data.orders || []).map(referralOrder),
      error: '',
      loaded: true,
    });
  }
  setF = (k) => (e) =>
    this.setState({
      f: { ...this.state.f, [k]: e.target.value },
      formError: '',
    });
  add = async (e) => {
    e.preventDefault();
    const f = this.state.f;
    const code = f.code.trim().toUpperCase();
    if (!REF_CODE.test(code))
      return this.setState({
        formError: 'Codes are 3 to 20 letters or numbers.',
      });
    if (f.name.trim().length < 2)
      return this.setState({ formError: 'Add the creator’s name.' });
    this.setState({ busy: 'new' });
    const r = await this.props.api.post('/api/admin/creators', {
      action: 'create',
      code,
      name: f.name.trim(),
      channel: f.channel.trim(),
    });
    this.setState({ busy: '' });
    if (!r.ok)
      return this.setState({ formError: r.error || 'Couldn’t add that.' });
    const c = creatorRow(r.data.creator);
    this.setState((s) => ({
      creators: [c].concat(s.creators),
      f: { code: '', name: '', channel: '' },
    }));
    this.props.log();
    this.props.toast('Added ' + c.name + ' with code ' + c.code);
  };
  async setActive(c, active) {
    this.setState({ busy: c.id });
    const r = await this.props.api.post('/api/admin/creators', {
      action: 'setActive',
      creatorId: c.id,
      active,
    });
    this.setState({ busy: '' });
    if (!r.ok)
      return this.props.toast(r.error || 'Couldn’t save that.', 'warn');
    const next = creatorRow(r.data.creator);
    this.setState((s) => ({
      creators: s.creators.map((x) => (x.id === c.id ? next : x)),
    }));
    this.props.log();
    this.props.toast(
      (active ? 'Reactivated ' : 'Paused ') +
        next.name +
        ' (' +
        next.code +
        ')',
    );
  }

  renderForm() {
    const s = this.state;
    const f = s.f;
    const label = { display: 'flex', flexDirection: 'column', gap: '6px' };
    const cap = { fontSize: '13px', color: C.dim };
    return (
      <section aria-labelledby="cr-add" style={{ ...card, padding: '18px' }}>
        <h2 id="cr-add" style={h2}>
          Add a creator
        </h2>
        <p style={{ margin: '4px 0 12px', fontSize: '13px', color: C.dim }}>
          Their link is duoly.gg/?ref=CODE. Codes can’t be changed later, so
          pick the one they will share.
        </p>
        <form
          onSubmit={this.add}
          noValidate
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
            alignItems: 'end',
          }}
        >
          <label style={label}>
            <span style={cap}>Code</span>
            <input
              value={f.code}
              onChange={this.setF('code')}
              maxLength={20}
              placeholder="YOURNAME10"
              autoComplete="off"
              style={{ ...input, textTransform: 'uppercase' }}
            />
          </label>
          <label style={label}>
            <span style={cap}>Name</span>
            <input
              value={f.name}
              onChange={this.setF('name')}
              maxLength={60}
              placeholder="Alex"
              autoComplete="off"
              style={input}
            />
          </label>
          <label style={label}>
            <span style={cap}>Channel link (optional)</span>
            <input
              value={f.channel}
              onChange={this.setF('channel')}
              maxLength={160}
              placeholder="twitch.tv/yourname"
              autoComplete="off"
              style={input}
            />
          </label>
          <button
            type="submit"
            disabled={s.busy === 'new'}
            style={btn('primary')}
          >
            {s.busy === 'new' ? 'Adding…' : 'Add creator'}
          </button>
        </form>
        {s.formError ? (
          <p
            role="alert"
            style={{ margin: '10px 0 0', fontSize: '13.5px', color: C.red }}
          >
            {s.formError}
          </p>
        ) : null}
      </section>
    );
  }

  renderMonths(c) {
    if (!c.months.length)
      return (
        <p style={{ margin: '0', fontSize: '13.5px', color: C.dim }}>
          No completed orders from this code yet.
        </p>
      );
    return (
      <div className="ops-table-wrap">
        <table className="ops-table" style={{ minWidth: '520px' }}>
          <thead>
            <tr>
              <th style={th}>Month</th>
              <th style={{ ...th, textAlign: 'right' }}>Orders</th>
              <th style={{ ...th, textAlign: 'right' }}>Order value</th>
              <th style={th}>Tier</th>
              <th style={{ ...th, textAlign: 'right' }}>Commission</th>
            </tr>
          </thead>
          <tbody>
            {c.months.map((m) => (
              <tr key={m.month}>
                <td style={td}>{monthLabel(m.month)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{m.orders}</td>
                <td style={{ ...td, textAlign: 'right' }}>{eur(m.base)}</td>
                <td style={td}>
                  {tierName(m.tier)} · {m.commission}%
                </td>
                <td
                  style={{
                    ...td,
                    textAlign: 'right',
                    fontWeight: '700',
                    color: C.white,
                  }}
                >
                  {eur(m.commissionEur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  render() {
    const s = this.state;
    const ask = this.props.ask;
    const totalOwed = s.creators.reduce((n, c) => n + c.owed, 0);
    const customers = s.creators.reduce((n, c) => n + c.customers, 0);
    const kpis = [
      ['Creators', String(s.creators.filter((c) => c.active).length), 'active'],
      ['Referred customers', String(customers), 'all codes'],
      ['Commission earned', eur(totalOwed), 'nothing paid out from Duoly'],
      [
        'Referral links',
        s.referralsEnabled === null ? '…' : s.referralsEnabled ? 'On' : 'Off',
        s.referralsEnabled === false
          ? 'Links are not tracked yet'
          : 'duoly.gg/?ref=CODE',
      ],
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '10px',
          }}
        >
          {kpis.map(([label, value, sub]) => (
            <div
              key={label}
              style={{
                ...card,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '13px', color: C.dim }}>{label}</span>
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontSize: '26px',
                  fontWeight: '700',
                  color: C.white,
                }}
              >
                {value}
              </span>
              <span style={{ fontSize: '12.5px', color: C.faint }}>{sub}</span>
            </div>
          ))}
        </div>

        {this.renderForm()}

        <section aria-labelledby="cr-list" style={{ ...card, padding: '18px' }}>
          <h2 id="cr-list" style={h2}>
            Codes
          </h2>
          <p style={{ margin: '4px 0 12px', fontSize: '13px', color: C.dim }}>
            A new customer belongs to the first code they book with, for{' '}
            {CREATOR_RULES.attributionMonths} months. Tiers:{' '}
            {CREATOR_RULES.tiers
              .map(
                (t) =>
                  t.name +
                  ' ' +
                  t.commission +
                  '%' +
                  (t.from ? ' from ' + t.from + ' orders a month' : ''),
              )
              .join(', ')}
            . Payouts by hand, monthly from €{CREATOR_RULES.payoutMinEur}.
          </p>
          {!s.loaded ? (
            <p style={{ margin: '0', color: C.dim }}>Loading creators…</p>
          ) : s.error ? (
            <p role="alert" style={{ margin: '0', color: C.red }}>
              {s.error}
            </p>
          ) : !s.creators.length ? (
            <p style={{ margin: '0', color: C.dim }}>
              No creators yet. Add the first one above.
            </p>
          ) : (
            <div className="ops-table-wrap">
              <table className="ops-table" style={{ minWidth: '760px' }}>
                <thead>
                  <tr>
                    <th style={th}>Code</th>
                    <th style={th}>Creator</th>
                    <th style={th}>Status</th>
                    <th style={{ ...th, textAlign: 'right' }}>Customers</th>
                    <th style={{ ...th, textAlign: 'right' }}>Orders</th>
                    <th style={{ ...th, textAlign: 'right' }}>Earned</th>
                    <th style={th} />
                  </tr>
                </thead>
                <tbody>
                  {s.creators.map((c) => (
                    <React.Fragment key={c.id}>
                      <tr>
                        <td
                          style={{
                            ...td,
                            fontFamily: 'ui-monospace, Consolas, monospace',
                            color: C.accent,
                            fontWeight: '700',
                          }}
                        >
                          {c.code}
                        </td>
                        <td style={td}>
                          <span style={{ color: C.white, fontWeight: '600' }}>
                            {c.name}
                          </span>
                          {c.channel ? (
                            <span
                              style={{
                                display: 'block',
                                fontSize: '12.5px',
                                color: C.dim,
                              }}
                            >
                              {c.channel}
                            </span>
                          ) : null}
                        </td>
                        <td style={td}>
                          <span style={pill(c.active ? 'Active' : 'Blocked')}>
                            {c.active ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {c.customers}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {c.orders}
                          {c.openOrders ? (
                            <span
                              style={{
                                display: 'block',
                                fontSize: '12px',
                                color: C.faint,
                              }}
                            >
                              {c.openOrders} open
                            </span>
                          ) : null}
                        </td>
                        <td
                          style={{
                            ...td,
                            textAlign: 'right',
                            fontWeight: '700',
                            color: C.white,
                          }}
                        >
                          {eur(c.owed)}
                          {c.owed > 0 && c.owed < CREATOR_RULES.payoutMinEur ? (
                            <span
                              style={{
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: C.faint,
                              }}
                            >
                              below €{CREATOR_RULES.payoutMinEur} minimum
                            </span>
                          ) : null}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              gap: '8px',
                            }}
                          >
                            <button
                              type="button"
                              aria-expanded={s.open === c.id}
                              onClick={() =>
                                this.setState({
                                  open: s.open === c.id ? null : c.id,
                                })
                              }
                              style={btn()}
                            >
                              {s.open === c.id ? 'Hide months' : 'Months'}
                            </button>
                            {c.active ? (
                              <button
                                type="button"
                                disabled={s.busy === c.id}
                                style={btn('danger')}
                                onClick={() =>
                                  ask({
                                    title: 'Pause ' + c.code + '?',
                                    body:
                                      'New customers with this code won’t be attributed to ' +
                                      c.name +
                                      '. Customers who already came through it keep counting for their 12 months.',
                                    confirm: 'Pause',
                                    kind: 'danger',
                                    onConfirm: () => this.setActive(c, false),
                                  })
                                }
                              >
                                Pause
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={s.busy === c.id}
                                style={btn()}
                                onClick={() => this.setActive(c, true)}
                              >
                                Reactivate
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                      {s.open === c.id ? (
                        <tr>
                          <td
                            colSpan={7}
                            style={{ ...td, whiteSpace: 'normal' }}
                          >
                            <p
                              style={{
                                margin: '0 0 8px',
                                fontSize: '13px',
                                color: C.dim,
                              }}
                            >
                              Added {c.createdAt ? dateOnly(c.createdAt) : ''}
                              {c.createdBy ? ' by ' + c.createdBy : ''}. Months
                              by completion date (UTC); the month’s tier applies
                              to all its orders.
                            </p>
                            {this.renderMonths(c)}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          aria-labelledby="cr-orders"
          style={{ ...card, padding: '18px' }}
        >
          <h2 id="cr-orders" style={h2}>
            Orders from codes
          </h2>
          <p style={{ margin: '4px 0 12px', fontSize: '13px', color: C.dim }}>
            The latest 200. An order counts once it’s completed and its payment
            wasn’t refunded.
          </p>
          {s.loaded && !s.error && !s.orders.length ? (
            <p style={{ margin: '0', color: C.dim }}>
              No orders from creator codes yet.
            </p>
          ) : s.orders.length ? (
            <div className="ops-table-wrap">
              <table className="ops-table" style={{ minWidth: '640px' }}>
                <thead>
                  <tr>
                    <th style={th}>Order</th>
                    <th style={th}>Code</th>
                    <th style={th}>Customer</th>
                    <th style={th}>Status</th>
                    <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                    <th style={th}>Counts</th>
                  </tr>
                </thead>
                <tbody>
                  {s.orders.map((o) => (
                    <tr key={o.id}>
                      <td style={{ ...td, color: C.white, fontWeight: '600' }}>
                        {o.id}
                        <span
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            color: C.faint,
                            fontWeight: '500',
                          }}
                        >
                          {o.at ? dateOnly(o.at) : ''}
                        </span>
                      </td>
                      <td style={{ ...td, color: C.accent }}>{o.code}</td>
                      <td style={td}>{o.customer}</td>
                      <td style={td}>
                        <span style={pill(o.status)}>{o.status}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {eur(o.amount)}
                      </td>
                      <td style={td}>{o.counts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    );
  }
}
