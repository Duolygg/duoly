import React from 'react';
import {
  C,
  card,
  th,
  td,
  btn,
  input,
  dateTime,
} from '../../design-reference/components/admin/ui';

// Port of the original components/admin/AuditLog.jsx. Rows are written by the database inside
// each admin command (who, action, target, detail), so they can't be skipped or edited.
export default class AuditLog extends React.Component {
  constructor(props) {
    super(props);
    this.state = { q: '' };
  }
  componentDidMount() {
    this.props.log();
  }
  exportCsv(list) {
    const rows = [['Time', 'Admin', 'Action', 'Target', 'Details']].concat(
      list.map((x) => [
        new Date(x.at).toISOString(),
        x.who,
        x.action,
        x.target,
        x.detail,
      ]),
    );
    const csv = rows
      .map((r) =>
        r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(','),
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'duoly-audit-log.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  render() {
    const { audit, auditLoaded } = this.props;
    const q = this.state.q.trim().toLowerCase();
    const list = audit.filter(
      (x) =>
        !q ||
        [x.action, x.target, x.detail, x.who].some((v) =>
          String(v).toLowerCase().includes(q),
        ),
    );
    return (
      <section aria-label="Audit log" style={{ ...card, padding: '18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <input
            type="search"
            aria-label="Search the audit log"
            placeholder="Search actions, targets, admins…"
            value={this.state.q}
            onChange={(e) => this.setState({ q: e.target.value })}
            style={{ ...input, flex: '1 1 240px' }}
          />
          <button
            type="button"
            disabled={!list.length}
            onClick={() => this.exportCsv(list)}
            style={{ ...btn(), opacity: list.length ? '1' : '.4' }}
          >
            Export CSV
          </button>
        </div>
        <div className="ops-table-wrap" style={{ marginTop: '12px' }}>
          <table className="ops-table">
            <thead>
              <tr>
                <th style={th}>When</th>
                <th style={th}>Admin</th>
                <th style={th}>Action</th>
                <th style={th}>Target</th>
                <th style={th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td style={{ ...td, color: C.dim }}>{dateTime(x.at)}</td>
                  <td style={td}>{x.who}</td>
                  <td style={{ ...td, fontWeight: '600', color: C.white }}>
                    {x.action}
                  </td>
                  <td style={{ ...td, color: C.accent }}>{x.target}</td>
                  <td
                    style={{
                      ...td,
                      whiteSpace: 'normal',
                      color: C.muted,
                      minWidth: '220px',
                    }}
                  >
                    {x.detail || '—'}
                  </td>
                </tr>
              ))}
              {!list.length ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      ...td,
                      whiteSpace: 'normal',
                      textAlign: 'center',
                      color: C.dim,
                      padding: '36px 12px',
                    }}
                  >
                    {!auditLoaded
                      ? 'Loading…'
                      : audit.length
                        ? 'Nothing matches that search.'
                        : 'No admin actions yet. Every refund, approval, suspension, credit and payout will be recorded here with who did it and why.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: '13px', color: C.dim }}>
          Stored on the server and can’t be edited. The newest 2,000 entries are
          kept.
        </p>
      </section>
    );
  }
}
