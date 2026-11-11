// The teammate rules, always on the desk right above the orders, so every teammate sees them
// every time they take an order. The full rulebook (with what happens when a rule is broken)
// stays on /rules; this is the short version that nobody can miss.
import React from 'react';

const DISPLAY = "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif";

/**
 * [title, text, highlight]. Keep these in line with the golden rules on /rules (Rules.jsx). The
 * highlighted rule spans the full width and closes the card, so the other six sit in even pairs.
 */
export const DESK_RULES = [
  [
    'Online means ready',
    'Only go online, and only take an order, when you can start playing within 2 minutes.',
  ],
  [
    'Finish what you start',
    'Play every game you were booked for. Never leave mid-game or throw.',
  ],
  [
    'Zero toxicity',
    'No flaming, insults or blaming the customer, in the game or in the chat. Stay calm, even when the game isn’t.',
  ],
  [
    'Everything stays on Duoly',
    'Payments, chat and bookings. No outside deals, socials or tips off the platform, ever.',
  ],
  [
    'Never touch a customer’s account',
    'You play with them, not for them. Never ask for a login.',
  ],
  [
    'Be the teammate you’d want',
    'Patient, honest and kind, from the first game to the last.',
  ],
  [
    'Cost them a game? Owe them one',
    'Lost a game because of how you played? Give them a free one back. Skipping it can mean a priority cut or a fine.',
    true,
  ],
];

const Check = ({ hot }) => (
  <span
    aria-hidden="true"
    style={{
      flex: '0 0 auto',
      width: '24px',
      height: '24px',
      marginTop: '1px',
      borderRadius: '8px',
      display: 'grid',
      placeItems: 'center',
      background: hot ? '#FFD27A' : 'rgba(94, 234, 168, .16)',
    }}
  >
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke={hot ? '#17092E' : '#5EEAA8'}
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  </span>
);

export default function DeskRules() {
  return (
    <section
      aria-labelledby="tm-rules-h"
      style={{
        marginTop: '20px',
        padding: '24px',
        borderRadius: '24px',
        background:
          'radial-gradient(120% 90% at 100% 0%, rgba(255, 210, 122, .07), transparent 60%), #120B22',
        border: '1px solid rgba(255, 210, 122, .22)',
      }}
    >
      <style>{`
        .tm-rules-list{list-style:none;margin:16px 0 0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .tm-rules-list li{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:16px;background:#090414;border:1px solid rgba(196,170,255,.08)}
        .tm-rules-list li.hot{grid-column:1 / -1;background:rgba(255,210,122,.06);border-color:rgba(255,210,122,.3)}
        @media (max-width:760px){.tm-rules-list{grid-template-columns:minmax(0,1fr);gap:6px}.tm-rules-list li{padding:10px 12px}.tm-rules-list li:not(.hot) .tm-rule-text{display:none}}
      `}</style>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '6px 14px',
        }}
      >
        <h2
          id="tm-rules-h"
          style={{
            margin: '0',
            fontFamily: DISPLAY,
            fontSize: '22px',
            fontWeight: '700',
            letterSpacing: '-.02em',
            color: '#FFFFFF',
          }}
        >
          Teammate rules
        </h2>
        <a
          href="/rules"
          style={{
            fontSize: '13.5px',
            fontWeight: '600',
            color: '#D6BBFF',
          }}
        >
          Full rules and what happens if one is broken
        </a>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#A79DC4' }}>
        Taking an order means you agree to these. Admins check them on every
        report.
      </p>
      <ul className="tm-rules-list">
        {DESK_RULES.map(([title, text, hot]) => (
          <li key={title} className={hot ? 'hot' : undefined}>
            <Check hot={hot} />
            <span style={{ minWidth: '0', lineHeight: '1.4' }}>
              <strong
                style={{
                  display: 'block',
                  fontSize: '14.5px',
                  color: hot ? '#FFD27A' : '#FFFFFF',
                }}
              >
                {title}
              </strong>
              {/* on a phone the six short rules show just their title, so the orders below stay close */}
              <span
                className="tm-rule-text"
                style={{ fontSize: '13.5px', color: '#A79DC4' }}
              >
                {text}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
