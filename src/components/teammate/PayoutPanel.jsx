import React from 'react';
import Pick from '../../design-reference/components/Pick.jsx';
import { COUNTRIES, flagSrc } from '../../design-reference/lib/countries';

const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);
const day = (t) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const statusColor = {
  Paid: '#5EEAA8',
  Scheduled: '#C4AAFF',
  'On hold': '#FFC46B',
  Carried: '#8E84AB',
};
const field = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  fontSize: '12.5px',
  color: '#A79DC4',
};
// Same field look as the profile page (globals.css .pf-input), sized to match the dropdowns.
const FIELD_HEIGHT = '46px';
const input = { height: FIELD_HEIGHT, borderRadius: '14px' };
const METHODS = [
  { value: 'wise', label: 'Wise' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'payoneer', label: 'Payoneer' },
];
// Stored as the English country name, like before this was a free-text field.
const COUNTRY_OPTIONS = COUNTRIES.map(([code, name]) => ({
  value: name,
  label: name,
  icon: flagSrc(code),
}));
const connectLabel = {
  not_started: 'Not started',
  pending: 'Pending verification',
  ready: 'Ready',
  restricted: 'Restricted',
};
const connectColor = {
  not_started: '#8E84AB',
  pending: '#C4AAFF',
  ready: '#5EEAA8',
  restricted: '#FFC46B',
};
const connectHelp = {
  not_started:
    'Get paid straight to your bank with Stripe. Stripe checks your identity and keeps your bank details. Until then we pay you manually.',
  pending:
    'Stripe is checking your details. We keep paying you manually until Stripe is ready.',
  ready:
    'Your payouts are sent with Stripe to the bank account you added there.',
  restricted:
    'Stripe needs more information before it can pay you. Until then we pay you manually.',
};
const smallButton = {
  alignSelf: 'flex-start',
  padding: '8px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(196, 170, 255, .25)',
  background: 'transparent',
  color: '#C4AAFF',
  font: 'inherit',
  fontSize: '13px',
  cursor: 'pointer',
};
const empty = {
  legalName: '',
  address: '',
  country: '',
  dateOfBirth: '',
  taxNumber: '',
  method: 'wise',
  account: '',
};

/**
 * Payout history and the private payout details form on the teammate desk (M2). With
 * connect (CONNECT_PAYOUTS_ENABLED) it also shows Stripe payouts setup (M9).
 */
export default class PayoutPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
      loaded: false,
      form: empty,
      saving: false,
      message: '',
      connect: null,
      connectBusy: false,
      connectMessage: '',
    };
  }
  componentDidMount() {
    if (!this.props.connect) return;
    const back =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('connect')
        : null;
    // Stripe sends people to refresh_url when an onboarding link expired: make a new one.
    if (back === 'refresh') this.startConnect('refresh');
    else this.loadConnect(back === 'return');
  }
  loadConnect = async (sync, keepMessage = false) => {
    try {
      const response = await fetch(
        '/api/teammate/connect' + (sync ? '?sync=1' : ''),
        { credentials: 'same-origin' },
      );
      const body = await response.json();
      if (response.ok && body && body.enabled && body.connect)
        this.setState(
          keepMessage
            ? { connect: body.connect }
            : { connect: body.connect, connectMessage: '' },
        );
      else if (!response.ok)
        this.setState({
          connectMessage: body.error || 'Couldn’t load your Stripe status.',
        });
    } catch {
      this.setState({ connectMessage: 'Couldn’t load your Stripe status.' });
    }
  };
  startConnect = async (action) => {
    if (this.state.connectBusy) return;
    this.setState({ connectBusy: true, connectMessage: '' });
    try {
      const response = await fetch('/api/teammate/connect', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrf: this.props.csrf, action }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.url) {
        window.location.assign(body.url);
        return;
      }
      this.setState({
        connectBusy: false,
        connectMessage: body.error || 'Couldn’t open Stripe. Try again.',
      });
      this.loadConnect(false, true);
    } catch {
      this.setState({
        connectBusy: false,
        connectMessage: 'Couldn’t open Stripe. Try again.',
      });
    }
  };
  open = async () => {
    this.setState({ open: true, message: '' });
    if (this.state.loaded) return;
    try {
      const response = await fetch('/api/teammate/payout-details', {
        credentials: 'same-origin',
      });
      const body = await response.json();
      // Never overwrite what the teammate already typed while the details were loading.
      this.setState((state) =>
        state.dirty
          ? { loaded: true }
          : {
              loaded: true,
              form:
                body && body.details
                  ? {
                      ...empty,
                      ...body.details,
                      taxNumber: body.details.taxNumber || '',
                    }
                  : empty,
            },
      );
    } catch {
      this.setState({ message: 'Couldn’t load your payout details.' });
    }
  };
  save = async (event) => {
    event.preventDefault();
    if (this.state.saving) return;
    if (!this.state.form.country || !this.state.form.method) {
      this.setState({
        message: 'Pick your country and how you want to be paid.',
      });
      return;
    }
    this.setState({ saving: true, message: '' });
    const {
      legalName,
      address,
      country,
      dateOfBirth,
      taxNumber,
      method,
      account,
    } = this.state.form;
    try {
      const response = await fetch('/api/teammate/payout-details', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          csrf: this.props.csrf,
          legalName,
          address,
          country,
          dateOfBirth,
          taxNumber,
          method,
          account,
        }),
      });
      const body = await response.json().catch(() => ({}));
      this.setState({
        saving: false,
        message: response.ok
          ? 'Payout details saved.'
          : body.error || 'Couldn’t save your payout details.',
      });
    } catch {
      this.setState({
        saving: false,
        message: 'Couldn’t save your payout details.',
      });
    }
  };
  set = (key) => (event) => this.put(key)(event.target.value);
  put = (key) => (value) => {
    this.setState((state) => ({
      dirty: true,
      form: { ...state.form, [key]: value },
    }));
  };
  renderConnect() {
    const c = this.state.connect;
    const status = connectLabel[c.status] ? c.status : 'not_started';
    return (
      <div
        aria-label="Stripe payouts"
        role="group"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '10px 12px',
          borderRadius: '12px',
          background: '#090414',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
          <span style={{ fontSize: '13px', color: '#CFC4EA' }}>
            Stripe payouts
          </span>
          <span
            data-connect-status={status}
            style={{ fontSize: '13px', color: connectColor[status] }}
          >
            {connectLabel[status]}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '12.5px', color: '#8E84AB' }}>
          {connectHelp[status]}
          {c.payoutFailed
            ? ' Your last bank payout failed. Check your bank details in Stripe.'
            : ''}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={this.state.connectBusy}
            onClick={() => this.startConnect(c.account ? 'refresh' : 'onboard')}
            style={smallButton}
          >
            {this.state.connectBusy
              ? 'Opening Stripe…'
              : !c.account
                ? 'Set up payouts with Stripe'
                : status === 'ready'
                  ? 'Update details in Stripe'
                  : 'Continue setup with Stripe'}
          </button>
          {c.account ? (
            <button
              type="button"
              onClick={() => this.loadConnect(true)}
              style={smallButton}
            >
              Refresh status
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  render() {
    const p = this.props.payout;
    const s = this.state;
    return (
      <div
        data-private-block=""
        id="payouts"
        style={{
          marginTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <p style={{ margin: 0, fontSize: '12.5px', color: '#8E84AB' }}>
          You are paid every Friday for the week before, once your balance is at
          least {money(p.minimum)}. Smaller amounts carry forward.
          {p.owed ? ' Waiting to be paid: ' + money(p.owed) + '.' : ''}
        </p>
        {!p.details ? (
          <p
            role="status"
            style={{ margin: 0, fontSize: '13px', color: '#FFC46B' }}
          >
            Add your payout details so we can pay you.
          </p>
        ) : null}
        {this.props.connect && s.connect ? this.renderConnect() : null}
        {this.props.connect && s.connectMessage ? (
          <p
            role="status"
            style={{ margin: 0, fontSize: '13px', color: '#FFC46B' }}
          >
            {s.connectMessage}
          </p>
        ) : null}
        {p.history.length ? (
          <ul
            aria-label="Payout history"
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {p.history.map((h) => (
              <li
                key={h.start}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'baseline',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  background: '#090414',
                  fontSize: '13px',
                }}
              >
                <span style={{ color: '#CFC4EA' }}>
                  {day(h.start)} to {day(h.end - 1)}
                </span>
                <span style={{ color: statusColor[h.status] }}>
                  {h.status}
                  {h.paidAt ? ' ' + day(h.paidAt) : ''}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontWeight: '700',
                    color: '#FFFFFF',
                  }}
                >
                  {money(h.total)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          aria-expanded={s.open}
          onClick={() =>
            s.open ? this.setState({ open: false }) : this.open()
          }
          style={{
            alignSelf: 'flex-start',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(196, 170, 255, .25)',
            background: 'transparent',
            color: '#C4AAFF',
            font: 'inherit',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          {p.details ? 'Edit payout details' : 'Add payout details'}
        </button>
        {s.open ? (
          <form
            aria-label="Payout details"
            onSubmit={this.save}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '10px',
            }}
          >
            <label style={field}>
              Full legal name
              <input
                className="pf-input"
                required
                maxLength={120}
                value={s.form.legalName}
                onChange={this.set('legalName')}
                style={input}
              />
            </label>
            <label style={field}>
              Date of birth
              <input
                className="pf-input"
                required
                type="date"
                value={s.form.dateOfBirth}
                onChange={this.set('dateOfBirth')}
                style={{ ...input, colorScheme: 'dark' }}
              />
            </label>
            <label style={field}>
              Address
              <input
                className="pf-input"
                required
                maxLength={300}
                value={s.form.address}
                onChange={this.set('address')}
                style={input}
              />
            </label>
            <div style={field}>
              <label htmlFor="payout-country">Country</label>
              <Pick
                id="payout-country"
                label="Countries"
                search
                height={FIELD_HEIGHT}
                placeholder="Search countries"
                value={s.form.country}
                options={
                  s.form.country &&
                  !COUNTRY_OPTIONS.some((o) => o.value === s.form.country)
                    ? [
                        { value: s.form.country, label: s.form.country },
                        ...COUNTRY_OPTIONS,
                      ]
                    : COUNTRY_OPTIONS
                }
                onPick={this.put('country')}
              />
            </div>
            <label style={field}>
              <span>
                Tax number <span style={{ color: '#6A6086' }}>(optional)</span>
              </span>
              <input
                className="pf-input"
                maxLength={40}
                value={s.form.taxNumber}
                onChange={this.set('taxNumber')}
                style={input}
              />
            </label>
            <div style={field}>
              <label htmlFor="payout-method">Payout method</label>
              <Pick
                id="payout-method"
                label="Payout methods"
                height={FIELD_HEIGHT}
                placeholder="Choose…"
                value={s.form.method}
                options={METHODS}
                onPick={this.put('method')}
              />
            </div>
            <label style={{ ...field, gridColumn: '1 / -1' }}>
              Account (IBAN, or Wise, PayPal or Payoneer email)
              <input
                className="pf-input"
                required
                maxLength={200}
                value={s.form.account}
                onChange={this.set('account')}
                style={input}
              />
            </label>
            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
              }}
            >
              <button
                type="submit"
                disabled={s.saving}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#C4AAFF',
                  color: '#120A24',
                  fontWeight: '700',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {s.saving ? 'Saving…' : 'Save payout details'}
              </button>
              <span style={{ fontSize: '12px', color: '#6A6086' }}>
                Only you and Duoly admins can see these.
              </span>
            </div>
          </form>
        ) : null}
        {s.message ? (
          <p
            role="status"
            style={{ margin: 0, fontSize: '13px', color: '#CFC4EA' }}
          >
            {s.message}
          </p>
        ) : null}
      </div>
    );
  }
}
