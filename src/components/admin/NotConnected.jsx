import React from 'react';
import {
  C,
  DISPLAY,
  card,
  btn,
} from '../../design-reference/components/admin/ui';

// Sections whose screens exist in the original design but whose data isn't in the database
// yet (only Payouts today). Shows what the section will do, never sample numbers.
const PLAN = {
  payouts: [
    'Weekly payouts per teammate (Friday to Friday): net, tips, adjustments, paid or on hold.',
    'Not connected yet. Earnings are already recorded for every completed order; the weekly payout ledger and Stripe Connect come next.',
  ],
};

export default function NotConnected({ section, go }) {
  const [what, status] = PLAN[section] || ['', ''];
  return (
    <section style={{ ...card, padding: '28px', maxWidth: '720px' }}>
      <p
        style={{
          margin: '0',
          fontSize: '12px',
          fontWeight: '800',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: C.faint,
        }}
      >
        What this section does
      </p>
      <p
        style={{
          margin: '8px 0 0',
          fontFamily: DISPLAY,
          fontSize: '21px',
          lineHeight: '1.35',
          fontWeight: '700',
          letterSpacing: '-.015em',
          color: C.white,
        }}
      >
        {what}
      </p>
      <p style={{ margin: '14px 0 0', fontSize: '14px', color: C.muted }}>
        {status}
      </p>
      <div
        style={{
          marginTop: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <button
          type="button"
          style={btn('primary')}
          onClick={() => go('users')}
        >
          Users and roles
        </button>
        <button type="button" style={btn()} onClick={() => go('teammates')}>
          Teammates
        </button>
        <button type="button" style={btn()} onClick={() => go('audit')}>
          Audit log
        </button>
      </div>
    </section>
  );
}
