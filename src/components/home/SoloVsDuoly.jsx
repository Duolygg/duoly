// "… vs. Duoly": one board, switchable between solo queue and boosting. Each row names what is being
// compared (a chip on the glowing centre line), the other side's way on the left (✕) and Duoly's on
// the highlighted right (✓). Rows replay their entrance on every switch; phones stack them.
//
// Boosting is compared as a business model, not as named companies, and covers duo boosts too: a
// boost sells a result (a rank, delivered); Duoly sells the game itself, with a teammate. The Duoly
// side only repeats what the site already says (hero, FAQ, terms: no result is promised, trust
// points in lib/legal.js, catalog descriptions, checkout moods). Styles: globals.css (sv-*).
import BundledImage from '../shared/BundledImage';
import React from 'react';

// [what is compared, the other side, Duoly]; `{from}` becomes the cheapest per-game price
export const OPPONENTS = [
  {
    id: 'solo',
    tab: 'Solo queue',
    name: 'Solo queue',
    emoji: '🙃',
    sub: 'Same game. Very different evening.',
    rows: [
      [
        'Teammates',
        'Four randoms. One is already typing.',
        'A rank-verified teammate, reviewed after every session',
      ],
      ['Comms', 'Silence, or flame', 'Voice on Discord if you want it'],
      [
        'Vibe’s off?',
        'Stuck with them all game',
        'Re-roll your teammate, up to twice',
      ],
      ['Waiting', 'Long queues to lose', 'Usually matched in under 2 minutes'],
      [
        'Bad night',
        'Nobody owes you anything',
        'Not matched in 5 minutes? You pay nothing',
      ],
    ],
  },
  {
    id: 'boost',
    tab: 'Boosting',
    name: 'Boosting',
    emoji: '📦',
    sub: 'Boosting sells you a rank. Duoly gives you a teammate.',
    rows: [
      [
        'What you buy',
        'A rank, delivered',
        'The games themselves, with a teammate',
      ],
      ['Price', 'A whole division, paid up front', 'Pay per game, from {from}'],
      [
        'Your account',
        'Classic boosts log into it',
        'Nobody ever asks for your password',
      ],
      [
        'In the game',
        'Built to hit a target fast',
        'Playing with you, not for you',
      ],
      [
        'Afterwards',
        'The rank, not the skill to keep it',
        'Pick “Teach me” and learn as you play',
      ],
      [
        'Beyond ranked',
        'It ends at the target rank',
        'Casual modes, coaching, or just hanging out',
      ],
    ],
  },
];

const Mark = ({ ok }) => (
  <span className={'sv-mark' + (ok ? ' is-ok' : '')} aria-hidden="true">
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ok ? <path d="M20 6L9 17l-5-5" /> : <path d="M18 6L6 18M6 6l12 12" />}
    </svg>
  </span>
);

// `initial` picks the opening tab (0 solo queue, 1 boosting)
export default function SoloVsDuoly({ fromPrice = '€2.99', initial = 0 }) {
  const [pick, setPick] = React.useState(initial);
  const o = OPPONENTS[pick];
  return (
    <section className="sv" aria-labelledby="sv-h">
      <div className="sv-eyebrow">Why Duoly</div>
      <h2 id="sv-h" className="sv-title" key={'t' + o.id}>
        {o.name} <span className="sv-vs-word">vs.</span>{' '}
        <span className="sv-brand">Duoly</span>
      </h2>
      <p className="sv-sub" key={'s' + o.id}>
        {o.sub}
      </p>
      <div className="sv-switch" role="group" aria-label="Compare Duoly with">
        <span
          className="sv-switch-pill"
          aria-hidden="true"
          style={{ transform: 'translateX(' + pick * 100 + '%)' }}
        />
        {OPPONENTS.map((x, i) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={i === pick ? 'true' : 'false'}
            onClick={() => setPick(i)}
          >
            vs. {x.tab}
          </button>
        ))}
      </div>
      <div className="sv-board">
        <div className="sv-row sv-heads" aria-hidden="true">
          <div className="sv-them">
            <span className="sv-emoji">{o.emoji}</span>
            {o.name}
          </div>
          <div className="sv-mid">
            <span className="sv-vs">VS</span>
          </div>
          <div className="sv-us">
            <BundledImage
              src="/assets/brand/logo-mascots.webp"
              alt=""
              width="40"
              height="25"
            />
            Duoly
            <span className="sv-ribbon">Better pick</span>
          </div>
        </div>
        {/* keyed by opponent so the rows replay their entrance on every switch */}
        <dl className="sv-rows" key={o.id}>
          {o.rows.map(([what, them, us], i) => (
            <div className="sv-row" key={what} style={{ '--i': i }}>
              <dt className="sv-mid">
                <span className="sv-chip">{what}</span>
              </dt>
              <dd className="sv-them">
                <span className="sv-line">{them}</span>
                <Mark />
              </dd>
              <dd className="sv-us">
                <Mark ok />
                <span className="sv-line">
                  {us.replace('{from}', fromPrice)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="sv-foot">
          <a href="#games" className="sv-cta">
            Find my duo
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </a>
          <span>Cancel for free until a teammate accepts.</span>
        </div>
      </div>
    </section>
  );
}
