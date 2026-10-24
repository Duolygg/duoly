import React from 'react';
import {
  C,
  DISPLAY,
  card,
  h2,
  chip,
  btn,
  ago,
} from '../../design-reference/components/admin/ui';
import ChatModeration from './ChatModeration';

// Port of the customer reports tab from Fabian's Safety.jsx. Evidence URLs are private,
// five-minute signed links returned only after the admin checks at the API and database layers.
class CustomerReports extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      reports: [],
      bounty: 50,
      loaded: false,
      error: '',
      filter: 'open',
      busy: '',
    };
  }
  componentDidMount() {
    this.load();
    this._timer = setInterval(() => this.load(), 20000);
  }
  componentWillUnmount() {
    clearInterval(this._timer);
  }
  load = async () => {
    const result = await this.props.api.get('/api/admin/reports');
    if (!result.ok)
      return this.setState({
        error: result.error || 'Couldn’t load reports.',
        loaded: true,
      });
    this.setState({
      reports: (result.data.reports || []).map((r) => ({
        ...r,
        at: Date.parse(r.at),
        decidedAt: r.decidedAt ? Date.parse(r.decidedAt) : null,
      })),
      bounty: (result.data.bounty_eur_cents || 5000) / 100,
      loaded: true,
      error: '',
    });
  };
  decide = async (report, decision, reason) => {
    this.setState({ busy: report.id });
    const result = await this.props.api.post('/api/admin/reports', {
      id: report.id,
      decision,
      reason,
    });
    if (!result.ok)
      this.props.toast(result.error || 'Couldn’t save that.', 'warn');
    else {
      await this.load();
      this.props.log();
      this.props.toast(
        decision === 'approved'
          ? `Approved. ${report.byName} is owed the €${this.state.bounty} bounty`
          : 'Report rejected',
      );
    }
    this.setState({ busy: '' });
  };
  render() {
    const s = this.state;
    const list = s.reports.filter(
      (r) => s.filter === 'all' || r.status === 'open',
    );
    const status = {
      open: ['Open', C.gold, 'rgba(255, 210, 122, .12)'],
      approved: ['Approved · bounty owed', C.green, 'rgba(94, 234, 168, .12)'],
      rejected: ['Rejected', C.dim, 'rgba(142, 132, 171, .14)'],
    };
    return (
      <section
        aria-labelledby="sf-r-h"
        style={{
          ...card,
          padding: '18px',
          borderColor: s.reports.some((r) => r.status === 'open')
            ? 'rgba(255, 138, 155, .3)'
            : C.line,
        }}
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
          <h2 id="sf-r-h" style={h2}>
            Customer reports
          </h2>
          <div
            role="group"
            aria-label="Filter"
            style={{ display: 'flex', gap: '6px' }}
          >
            {[
              ['open', 'Open'],
              ['all', 'All'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={s.filter === id}
                onClick={() => this.setState({ filter: id })}
                style={chip(s.filter === id)}
              >
                {label}
                <span style={{ opacity: '.65', fontWeight: '500' }}>
                  {id === 'all'
                    ? s.reports.length
                    : s.reports.filter((r) => r.status === 'open').length}
                </span>
              </button>
            ))}
          </div>
        </div>
        <p style={{ margin: '6px 0 14px', fontSize: '13.5px', color: C.dim }}>
          Off-platform attempts and toxicity reported by customers, with their
          proof. Approve only with solid evidence. The customer is then owed the
          €{s.bounty} bounty.
        </p>
        {s.error ? (
          <p role="status" style={{ margin: '0 0 12px', color: C.pink }}>
            {s.error}
          </p>
        ) : null}
        <div style={{ display: 'grid', gap: '10px' }}>
          {list.map((r) => {
            const st = status[r.status] || status.open;
            return (
              <article
                key={r.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  padding: '16px',
                  borderRadius: '18px',
                  background: C.bg,
                  border: `1px solid ${r.status === 'open' ? 'rgba(255, 138, 155, .28)' : C.line}`,
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontWeight: '700',
                      fontSize: '17px',
                      color: C.white,
                    }}
                  >
                    {r.typeLabel}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: st[2],
                      color: st[1],
                    }}
                  >
                    {st[0]}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: C.muted }}>
                  <b style={{ color: C.white }}>{r.byName}</b> reported{' '}
                  <b style={{ color: C.white }}>{r.against.name}</b> ·{' '}
                  {r.reference} · bounty €{r.bounty}
                </div>
                <p
                  style={{
                    margin: 0,
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: C.panel,
                    fontSize: '14px',
                    color: '#CFC4EA',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  “{r.text}”
                </p>
                <div className="tm-proof">
                  {(r.evidence || []).map((e, i) => (
                    <a
                      key={e.id}
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="tm-proof-thumb"
                      title="Open full size"
                    >
                      <img src={e.url} alt={`Evidence ${i + 1}`} />
                    </a>
                  ))}
                </div>
                <div style={{ fontSize: '12.5px', color: C.faint }}>
                  Sent {ago(r.at, Date.now())} on order {r.orderId}
                  {r.decidedBy
                    ? ` · ${r.status === 'approved' ? 'approved' : 'rejected'} by ${r.decidedBy}: ${r.decisionNote}`
                    : ''}
                </div>
                {r.status === 'open' ? (
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
                  >
                    <button
                      type="button"
                      style={btn('good')}
                      disabled={s.busy === r.id}
                      onClick={() =>
                        this.props.ask({
                          title: `Approve report ${r.reference}?`,
                          body: `The proof holds up. ${r.byName} will be recorded as owed €${s.bounty}. Pay the bounty by hand.`,
                          confirm: 'Approve · bounty owed',
                          kind: 'good',
                          field: {
                            label: 'Reason (required, shown in the audit log)',
                            placeholder:
                              'e.g. screenshot shows a PayPal request',
                            required: true,
                          },
                          onConfirm: (reason) =>
                            this.decide(r, 'approved', reason),
                        })
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      style={btn()}
                      disabled={s.busy === r.id}
                      onClick={() =>
                        this.props.ask({
                          title: `Reject report ${r.reference}?`,
                          body: 'There is not enough proof. The customer sees that it was reviewed and no bounty is owed.',
                          confirm: 'Reject report',
                          field: {
                            label: 'Reason (required, shown in the audit log)',
                            placeholder:
                              'e.g. screenshot does not show the message',
                            required: true,
                          },
                          onConfirm: (reason) =>
                            this.decide(r, 'rejected', reason),
                        })
                      }
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      style={btn()}
                      onClick={() => this.props.go('orders')}
                    >
                      View orders
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
          {s.loaded && !list.length ? (
            <p style={{ margin: 0, color: C.dim }}>
              {s.filter === 'open' ? 'No open reports.' : 'No reports yet.'}
            </p>
          ) : null}
        </div>
      </section>
    );
  }
}

export default function Safety(props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {props.reportsEnabled ? <CustomerReports {...props} /> : null}
      {props.chatEnabled ? <ChatModeration csrf={props.csrf} /> : null}
    </div>
  );
}
