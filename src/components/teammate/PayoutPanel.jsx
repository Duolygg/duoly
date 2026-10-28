import React from 'react';

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
const input = {
  padding: '9px 11px',
  borderRadius: '10px',
  border: '1px solid rgba(196, 170, 255, .18)',
  background: '#090414',
  color: '#FFFFFF',
  font: 'inherit',
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

/** Payout history and the private payout details form on the teammate desk (M2). */
export default class PayoutPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
      loaded: false,
      form: empty,
      saving: false,
      message: '',
    };
  }
  open = async () => {
    this.setState({ open: true, message: '' });
    if (this.state.loaded) return;
    try {
      const response = await fetch('/api/teammate/payout-details', {
        credentials: 'same-origin',
      });
      const body = await response.json();
      this.setState({
        loaded: true,
        form: body && body.details ? { ...empty, ...body.details } : empty,
      });
    } catch {
      this.setState({ message: 'Couldn’t load your payout details.' });
    }
  };
  save = async (event) => {
    event.preventDefault();
    if (this.state.saving) return;
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
  set = (key) => (event) =>
    this.setState({ form: { ...this.state.form, [key]: event.target.value } });
  render() {
    const p = this.props.payout;
    const s = this.state;
    return (
      <div
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
                required
                type="date"
                value={s.form.dateOfBirth}
                onChange={this.set('dateOfBirth')}
                style={input}
              />
            </label>
            <label style={field}>
              Address
              <input
                required
                maxLength={300}
                value={s.form.address}
                onChange={this.set('address')}
                style={input}
              />
            </label>
            <label style={field}>
              Country
              <input
                required
                maxLength={56}
                value={s.form.country}
                onChange={this.set('country')}
                style={input}
              />
            </label>
            <label style={field}>
              Tax number
              <input
                required
                maxLength={40}
                value={s.form.taxNumber}
                onChange={this.set('taxNumber')}
                style={input}
              />
            </label>
            <label style={field}>
              Payout method
              <select
                value={s.form.method}
                onChange={this.set('method')}
                style={input}
              >
                <option value="wise">Wise</option>
                <option value="bank">Bank transfer</option>
                <option value="paypal">PayPal</option>
              </select>
            </label>
            <label style={{ ...field, gridColumn: '1 / -1' }}>
              Account (IBAN, Wise or PayPal email)
              <input
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
