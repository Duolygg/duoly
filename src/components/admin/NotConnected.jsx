import React from 'react';
import {
  C,
  DISPLAY,
  card,
  btn,
} from '../../design-reference/components/admin/ui';

// Sections whose screens exist in the original design but whose data isn't in the database
// yet. Shows what the section will do and what it waits on, never sample numbers.
const PLAN = {
  overview: [
    'Revenue and fees for the last 60 days, average wait over 7 days and who’s online.',
    'Next up: built on the orders and payments that already exist.',
  ],
  live: [
    'The shared queue with release progress, running orders, recent and cancelled ones, and handover links.',
    'Next up: built on the orders that already exist.',
  ],
  orders: [
    'Search every order, see its payment trail, cancel or refund it with a reason.',
    'Next up: built on the orders and Stripe payments that already exist.',
  ],
  teammates: [
    'Your roster: games, Discord, status, rating, earnings, warnings, suspend and reinstate.',
    'Games and roles are already editable under Users & roles.',
  ],
  customers: [
    'Everyone who books: orders, spend, wallet and level, block and unblock, wallet adjustments.',
    'Next up: built on the orders and refund credits that already exist.',
  ],
  priority: [
    'Who sees new orders first: base priority, buffs and nerfs, missed-order penalties.',
    'The base priority and buff columns exist; missed orders aren’t tracked yet.',
  ],
  payouts: [
    'Weekly payouts per teammate (Friday to Friday): net, tips, adjustments, paid or on hold.',
    'Waits on the payout ledger and Stripe Connect.',
  ],
  support: [
    'The support inbox: reply, claim, hand back and close conversations.',
    'Waits on the support chat backend. The contact bubble currently goes to Discord and email.',
  ],
  safety: [
    'Customer reports (bounty decisions) and chat messages the safety filter stopped.',
    'Waits on order chat and reports.',
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
          Users & roles
        </button>
        <button type="button" style={btn()} onClick={() => go('applications')}>
          Applications
        </button>
        <button type="button" style={btn()} onClick={() => go('audit')}>
          Audit log
        </button>
      </div>
    </section>
  );
}
