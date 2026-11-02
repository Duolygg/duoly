// Order room pieces shared by the real order room (QueueRoom.jsx) and the homepage preview
// (home/QueuePreview.jsx), so both look the same: the stage, queue timer, steps, order card, chat,
// "You’re covered" panel, review and tip form, and review thanks. The stage (default export) is the matchmaking view from the order room: your card and the teammate slot, linked in the middle.
// While searching, the slot cycles through faces inside a spinning border and two dots flow between
// you; on a match the teammate pops in with a green check and confetti bursts. Shared by the real
// order room (QueueRoom.jsx) and the homepage preview (home/QueuePreview.jsx), so both look the same.
// The keyframes (qorbit, qswap, qflow, qshimmer, qpop, qburst) live in globals.css.
import React from 'react';
import TrustBadge from '../shared/TrustBadge';
import { COUNTRY_NAME, flagSrc } from '../../design-reference/lib/countries';
import { MAX_CHAT } from '../../design-reference/lib/chatRules';

// same palette as QueueRoom.jsx
const DISPLAY = "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif";
const ACCENT = '#D6BBFF',
  GREEN = '#5EEAA8',
  PINK = '#F0A6FF',
  MUTED = '#A79DC4',
  DIM = '#8E84AB',
  GOLD = '#FFD27A';
// what a confirmed report pays out (EUR or USD, by the order's currency)
export const BOUNTY = 50;
export const STAR =
  'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';
// what customers can do once matched (kept in sync with lib/orders.js REVIEW_TAGS and lib/reports.js)
export const REVIEW_TAGS = [
  'Great comms',
  'Shotcaller',
  'Super friendly',
  'Taught me a lot',
  'Carried hard',
  'Patient',
  'Fun to play with',
];
// quick replies offered before the customer's first message
const QUICK = [
  'Invite sent?',
  'Ready when you are!',
  'Can we hop in voice?',
  'GG, thanks!',
];
const pad = (n) => String(n).padStart(2, '0');
/** m:ss, e.g. 1:07 */
export const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(s / 60) + ':' + pad(s % 60);
};
// Teammate faces the empty slot cycles through while we search
export const CANDIDATES = [2, 5, 8, 3, 6, 9, 4, 10, 7];

/**
 * phase: 'loading' | 'searching' | 'matched' | 'playing' | 'done' | 'cancelled'
 * order: { title, games, region, from? }, game: { name, img }, mate: { name, image, trustBadge? },
 * user: { name, image }, cycle: face counter while searching, burst: a new value fires the confetti
 */
export default function MatchStage({
  phase,
  mate,
  order: o,
  game: g,
  user,
  cycle = 0,
  burst = 0,
}) {
  const searching = phase === 'searching' || phase === 'loading';
  const matched =
    phase === 'matched' || phase === 'playing' || phase === 'done';
  const cancelled = phase === 'cancelled';
  const first = (n) => String(n || '').split(' ')[0];
  const face = CANDIDATES[cycle % CANDIDATES.length];
  const tone = matched ? GREEN : cancelled ? DIM : ACCENT;

  const player = (kind) => {
    const isYou = kind === 'you';
    const img = isYou
      ? user.image || '/assets/avatars/avatar-1.png'
      : matched && mate
        ? mate.image || '/assets/avatars/avatar-3.png'
        : '/assets/avatars/avatar-' + face + '.png';
    const live = !isYou && searching;
    const border = isYou
      ? 'rgba(214, 187, 255, .22)'
      : matched
        ? 'rgba(94, 234, 168, .55)'
        : cancelled
          ? 'rgba(196, 170, 255, .1)'
          : 'transparent';
    return (
      <div
        style={{
          position: 'relative',
          flex: '1 1 0',
          maxWidth: '176px',
          minWidth: '0',
          borderRadius: '24px',
          padding: '1.5px',
          background: live
            ? 'rgba(196, 170, 255, .08)'
            : isYou
              ? 'linear-gradient(160deg, rgba(214, 187, 255, .55), rgba(240, 166, 255, .12) 60%)'
              : border,
          overflow: 'hidden',
          boxShadow:
            matched && !isYou
              ? '0 0 0 1px rgba(94, 234, 168, .2), 0 18px 60px rgba(94, 234, 168, .18)'
              : '0 18px 50px rgba(0, 0, 0, .35)',
          animation: matched && !isYou ? 'qpop .55s ease-out' : 'none',
        }}
      >
        {/* spinning gradient border while searching */}
        {live ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '300%',
              aspectRatio: '1',
              marginLeft: '-150%',
              marginTop: '-150%',
              background:
                'conic-gradient(from 0deg, transparent 0 55%, ' +
                PINK +
                ' 72%, ' +
                ACCENT +
                ' 86%, transparent 100%)',
              animation: 'qorbit 2.6s linear infinite',
            }}
          />
        ) : null}
        <div
          style={{
            position: 'relative',
            height: '100%',
            borderRadius: '22.5px',
            background:
              'linear-gradient(180deg, ' +
              (matched && !isYou
                ? 'rgba(94, 234, 168, .1)'
                : 'rgba(214, 187, 255, .08)') +
              ', rgba(18, 11, 34, .2) 60%), #160D2A',
            padding: '16px 12px 18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span
            style={{
              alignSelf: 'stretch',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10.5px',
              fontWeight: '800',
              letterSpacing: '.1em',
              color: isYou ? ACCENT : matched ? GREEN : DIM,
            }}
          >
            {isYou ? 'YOU' : 'TEAMMATE'}
            {g && g.img ? (
              <img
                src={g.img}
                alt=""
                width="18"
                height="18"
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '5px',
                  opacity: isYou || matched ? 1 : 0.5,
                }}
              />
            ) : null}
          </span>
          <span
            style={{
              position: 'relative',
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              padding: '3px',
              background: isYou
                ? 'linear-gradient(135deg, ' + ACCENT + ', ' + PINK + ')'
                : matched
                  ? 'linear-gradient(135deg, ' + GREEN + ', #9EE6FF)'
                  : 'rgba(196, 170, 255, .14)',
            }}
          >
            <img
              key={isYou ? 'you' : matched ? 'mate' : face}
              src={img}
              alt=""
              width="78"
              height="78"
              referrerPolicy="no-referrer"
              style={{
                width: '78px',
                height: '78px',
                borderRadius: '50%',
                objectFit: 'cover',
                display: 'block',
                background: '#120B22',
                boxShadow: '0 0 0 3px #160D2A',
                animation: live ? 'qswap .9s ease-out' : 'none',
                filter: live
                  ? 'saturate(.6) brightness(.85)'
                  : cancelled && !isYou
                    ? 'grayscale(1) brightness(.5)'
                    : 'none',
              }}
            />
            {live ? (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: '3px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(9, 4, 20, .35)',
                  color: '#FFFFFF',
                  fontFamily: DISPLAY,
                  fontSize: '30px',
                  fontWeight: '800',
                }}
              >
                ?
              </span>
            ) : null}
            {matched && !isYou ? (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: '-2px',
                  bottom: '-2px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: GREEN,
                  boxShadow: '0 0 0 3px #160D2A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#062A1B"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            ) : null}
          </span>
          <span
            style={{
              maxWidth: '100%',
              minWidth: '0',
              textAlign: 'center',
              lineHeight: '1.3',
            }}
          >
            {isYou || matched ? (
              <span
                style={{
                  display: 'block',
                  fontWeight: '700',
                  fontSize: '15.5px',
                  color: '#FFFFFF',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {isYou ? first(user.name) : first(mate && mate.name)}
              </span>
            ) : (
              <span
                aria-hidden="true"
                style={{
                  display: 'block',
                  width: '78px',
                  height: '12px',
                  margin: '4px auto 6px',
                  borderRadius: '6px',
                  background:
                    'linear-gradient(90deg, rgba(196, 170, 255, .08), rgba(196, 170, 255, .22), rgba(196, 170, 255, .08))',
                  backgroundSize: '200% 100%',
                  animation: 'qshimmer 1.4s linear infinite',
                }}
              />
            )}
            {!isYou && matched && mate ? (
              <span
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: '6px',
                }}
              >
                <TrustBadge badge={mate.trustBadge} />
              </span>
            ) : null}
            <span
              style={{
                display: 'block',
                fontSize: '12.5px',
                color: isYou ? MUTED : matched ? GREEN : DIM,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {isYou
                ? o
                  ? o.from || o.region
                  : ''
                : matched
                  ? 'Rank-verified'
                  : cancelled
                    ? 'No match'
                    : 'Searching…'}
            </span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="q-anim"
      style={{ position: 'relative', padding: '6px 0 4px' }}
    >
      {o ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px 6px 6px',
            borderRadius: '999px',
            background: 'rgba(9, 4, 20, .6)',
            border: '1px solid rgba(196, 170, 255, .12)',
            fontSize: '12.5px',
            fontWeight: '600',
            color: '#CFC4EA',
          }}
        >
          {g && g.img ? (
            <img
              src={g.img}
              alt=""
              width="20"
              height="20"
              style={{ width: '20px', height: '20px', borderRadius: '6px' }}
            />
          ) : null}
          {o.title} ×{o.games}
          <span
            aria-hidden="true"
            style={{
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: DIM,
            }}
          />
          {o.region}
        </span>
      ) : (
        <span style={{ display: 'inline-block', height: '32px' }} />
      )}

      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          marginTop: '22px',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
        }}
      >
        {player('you')}
        {/* the link between you two */}
        <div
          style={{
            position: 'relative',
            flex: '0 0 auto',
            alignSelf: 'center',
            width: 'clamp(44px, 9vw, 76px)',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: '0',
              right: '0',
              top: '50%',
              height: '2px',
              marginTop: '-1px',
              borderRadius: '2px',
              background: matched
                ? GREEN
                : cancelled
                  ? 'rgba(196, 170, 255, .1)'
                  : 'repeating-linear-gradient(90deg, rgba(214, 187, 255, .35) 0 6px, transparent 6px 12px)',
            }}
          />
          {searching
            ? [0, 1].map((i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: '0',
                    top: '50%',
                    width: '8px',
                    height: '8px',
                    marginTop: '-4px',
                    borderRadius: '50%',
                    background: PINK,
                    boxShadow: '0 0 12px ' + PINK,
                    animation:
                      'qflow 1.6s ease-in-out ' + i * 0.8 + 's infinite',
                  }}
                />
              ))
            : null}
          <span
            style={{
              position: 'relative',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: matched ? GREEN : '#1B1033',
              border:
                '1px solid ' + (matched ? GREEN : 'rgba(214, 187, 255, .25)'),
              color: matched ? '#062A1B' : tone,
              fontFamily: DISPLAY,
              fontSize: '12px',
              fontWeight: '800',
              boxShadow: matched ? '0 0 24px rgba(94, 234, 168, .5)' : 'none',
            }}
          >
            {matched ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
                <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
              </svg>
            ) : (
              'DUO'
            )}
          </span>
        </div>
        {player('mate')}
      </div>

      {/* confetti when matched */}
      {burst ? (
        <div
          key={burst}
          aria-hidden="true"
          style={{ position: 'absolute', left: '50%', top: '55%' }}
        >
          {Array.from({ length: 26 }, (_, i) => {
            const a = (i / 26) * Math.PI * 2;
            const d = 130 + (i % 4) * 34;
            return (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  width: i % 3 ? '8px' : '6px',
                  height: i % 3 ? '14px' : '6px',
                  borderRadius: i % 3 ? '3px' : '50%',
                  background: [GREEN, ACCENT, PINK, '#FFD27A', '#9EE6FF'][
                    i % 5
                  ],
                  '--dx': (Math.cos(a) * d).toFixed(0) + 'px',
                  '--dy': (Math.sin(a) * d).toFixed(0) + 'px',
                  '--r': i * 47 + 'deg',
                  animation: 'qburst 1.3s cubic-bezier(.2, .7, .3, 1) forwards',
                }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** The "IN QUEUE  m:ss | USUAL WAIT < 2:00" box under the title while searching. */
export function QueueTimer({ waited }) {
  return (
    <div
      style={{
        marginTop: '20px',
        display: 'inline-flex',
        alignItems: 'stretch',
        borderRadius: '18px',
        background: 'rgba(9, 4, 20, .7)',
        border: '1px solid rgba(214, 187, 255, .14)',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '10px 20px',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '.08em',
            color: GREEN,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: GREEN,
              boxShadow: '0 0 10px ' + GREEN,
              animation: 'dlpulse 1.2s ease-in-out infinite',
            }}
          />
          IN QUEUE
        </span>
        <span
          role="timer"
          aria-label="Time in queue"
          style={{
            fontFamily: DISPLAY,
            fontSize: '28px',
            fontWeight: '800',
            lineHeight: '1.1',
            letterSpacing: '-.02em',
            color: '#FFFFFF',
          }}
        >
          {clock(waited)}
        </span>
      </span>
      <span
        aria-hidden="true"
        style={{
          width: '1px',
          background: 'rgba(214, 187, 255, .12)',
        }}
      />
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '10px 20px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '.08em',
            color: DIM,
          }}
        >
          USUAL WAIT
        </span>
        <span
          style={{
            fontFamily: DISPLAY,
            fontSize: '28px',
            fontWeight: '800',
            lineHeight: '1.1',
            letterSpacing: '-.02em',
            color: MUTED,
          }}
        >
          &lt; 2:00
        </span>
      </span>
    </div>
  );
}

/** Paid → In queue → Playing → Done. steps: [label, done, current][] */
export function QueueSteps({ steps }) {
  return (
    <ol
      aria-label="Order progress"
      style={{
        listStyle: 'none',
        margin: '28px auto 0',
        padding: '0',
        maxWidth: '520px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      }}
    >
      {steps.map(([label, done, active], i) => (
        <li
          key={label}
          aria-current={active ? 'step' : undefined}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            fontWeight: '600',
            color: done ? '#FFFFFF' : active ? ACCENT : DIM,
          }}
        >
          {i > 0 ? (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '13px',
                right: 'calc(50% + 18px)',
                left: 'calc(-50% + 18px)',
                height: '2px',
                borderRadius: '2px',
                background:
                  done || active
                    ? 'linear-gradient(90deg, ' +
                      GREEN +
                      ', ' +
                      (done ? GREEN : ACCENT) +
                      ')'
                    : 'rgba(196, 170, 255, .12)',
              }}
            />
          ) : null}
          <span
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: done
                ? GREEN
                : active
                  ? 'rgba(214, 187, 255, .16)'
                  : 'rgba(196, 170, 255, .06)',
              border: active
                ? '1.5px solid ' + ACCENT
                : '1.5px solid transparent',
              color: done ? '#062A1B' : ACCENT,
            }}
          >
            {done ? (
              <svg
                aria-hidden="true"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : active ? (
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: ACCENT,
                  animation: 'dlpulse 1.2s ease-in-out infinite',
                }}
              />
            ) : null}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

/** The order room's "Your order" card: game, price, server, in-game name, comms, payment, and the teammate once matched. */
export function OrderCard({ order: o, game: g, total, free, mate, ignLabel }) {
  const card = {
    borderRadius: '24px',
    background: '#120B22',
    border: '1px solid rgba(196, 170, 255, .1)',
  };
  return (
    <section aria-labelledby="q-order-h" style={{ ...card, padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <h2
          id="q-order-h"
          style={{
            margin: '0',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: DIM,
          }}
        >
          Your order
        </h2>
        <span style={{ fontSize: '12.5px', color: DIM }}>{o.ref || o.id}</span>
      </div>
      <div
        style={{
          marginTop: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        {g.img ? (
          <img
            src={g.img}
            alt=""
            width="52"
            height="52"
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              flex: '0 0 auto',
            }}
          />
        ) : null}
        <div style={{ flex: '1', minWidth: '0', lineHeight: '1.35' }}>
          <div
            style={{ fontWeight: '700', fontSize: '16px', color: '#FFFFFF' }}
          >
            {o.title}{' '}
            <span style={{ color: MUTED, fontWeight: '500' }}>×{o.games}</span>
          </div>
          <div style={{ fontSize: '13px', color: MUTED }}>{g.name}</div>
        </div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: free ? '15px' : '24px',
            fontWeight: '800',
            letterSpacing: '-.02em',
            color: free ? GREEN : '#FFFFFF',
            textAlign: 'right',
          }}
          data-free-perk={free ? 'true' : undefined}
        >
          {total}
        </div>
      </div>
      <dl
        style={{
          margin: '16px 0 0',
          padding: '14px 0 0',
          borderTop: '1px solid rgba(196, 170, 255, .08)',
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: '8px 16px',
          fontSize: '14px',
        }}
      >
        {[
          ['Server', o.region],
          o.from ? ['Your rank', o.from] : null,
          [ignLabel.charAt(0).toUpperCase() + ignLabel.slice(1), o.ign],
          ['Comms', o.voice ? 'Voice on Discord' : 'Text chat'],
          o.note ? ['Note', '“' + o.note + '”'] : null,
          ['Paid with', o.paid ? o.paid.method : '—'],
        ]
          .filter(Boolean)
          .map(([k, val]) => (
            <React.Fragment key={k}>
              <dt style={{ color: DIM }}>{k}</dt>
              <dd
                style={{
                  margin: '0',
                  color: '#F3EEFF',
                  textAlign: 'right',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {val}
              </dd>
            </React.Fragment>
          ))}
      </dl>
      {mate ? (
        <div
          style={{
            marginTop: '14px',
            padding: '12px',
            borderRadius: '16px',
            background: 'rgba(94, 234, 168, .06)',
            border: '1px solid rgba(94, 234, 168, .22)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={mate.image || '/assets/avatars/avatar-3.png'}
              alt=""
              width="40"
              height="40"
              referrerPolicy="no-referrer"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
            <span style={{ minWidth: '0', lineHeight: '1.3' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}
              >
                {mate.name}
                {mate.country ? (
                  <img
                    src={flagSrc(mate.country)}
                    alt={COUNTRY_NAME[mate.country] || ''}
                    title={COUNTRY_NAME[mate.country] || ''}
                    width="18"
                    height="13"
                    style={{
                      width: '18px',
                      height: '13px',
                      borderRadius: '2px',
                      objectFit: 'cover',
                    }}
                  />
                ) : null}
              </span>
              <span
                style={{ display: 'block', fontSize: '12.5px', color: GREEN }}
              >
                Your teammate · rank-verified
              </span>
            </span>
          </div>
          {/* from the teammate's profile */}
          {mate.bio ? (
            <p
              style={{
                margin: '10px 0 0',
                fontSize: '13.5px',
                lineHeight: '1.5',
                color: '#CFC4EA',
                overflowWrap: 'anywhere',
              }}
            >
              {mate.bio}
            </p>
          ) : null}
          {mate.languages && mate.languages.length ? (
            <div style={{ marginTop: '8px', fontSize: '12.5px', color: DIM }}>
              Speaks {mate.languages.join(', ')}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Chat with the teammate: opens on a match, read-only once the order is done. */
export function ChatPanel({
  mate,
  order: o,
  phase,
  ignLabel,
  chat,
  typing,
  draft,
  warn,
  onDraft,
  onSend,
  listRef,
}) {
  const open = phase === 'matched' || phase === 'playing';
  const name = mate ? String(mate.name).split(' ')[0] : 'Your teammate';
  const time = (at) =>
    new Date(at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  const hasText = !!draft.trim();
  return (
    <section
      id="q-chat"
      aria-labelledby="q-chat-h"
      style={{
        borderRadius: '24px',
        background: '#0E0819',
        border: '1px solid rgba(214, 187, 255, .18)',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, .35)',
        scrollMarginTop: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 16px',
          background:
            'linear-gradient(180deg, rgba(27, 16, 51, .9), rgba(27, 16, 51, .5))',
          borderBottom: '1px solid rgba(196, 170, 255, .08)',
        }}
      >
        <span
          style={{
            position: 'relative',
            flex: '0 0 auto',
            width: '40px',
            height: '40px',
          }}
        >
          <img
            src={(mate && mate.image) || '/assets/avatars/avatar-3.png'}
            alt=""
            width="40"
            height="40"
            referrerPolicy="no-referrer"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: '-1px',
              bottom: '-1px',
              width: '11px',
              height: '11px',
              borderRadius: '50%',
              background: open ? GREEN : DIM,
              boxShadow: '0 0 0 2.5px #1B1033',
            }}
          />
        </span>
        <span style={{ flex: '1', minWidth: '0', lineHeight: '1.3' }}>
          <span
            id="q-chat-h"
            style={{ display: 'block', fontWeight: '700', color: '#FFFFFF' }}
          >
            Chat with {name}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: '12.5px',
              color: typing ? GREEN : DIM,
            }}
          >
            {typing
              ? 'typing…'
              : open
                ? 'Your teammate · ' +
                  (o.voice ? 'voice on Discord' : 'text chat')
                : 'Order finished · chat closed'}
          </span>
        </span>
        <span
          title={'Your ' + ignLabel}
          style={{
            flex: '0 0 auto',
            maxWidth: '45%',
            padding: '5px 10px',
            borderRadius: '10px',
            background: 'rgba(9, 4, 20, .6)',
            border: '1px solid rgba(196, 170, 255, .12)',
            fontFamily: 'ui-monospace, Consolas, monospace',
            fontSize: '12px',
            color: '#CFC4EA',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {o.ign}
        </span>
      </div>

      <div
        ref={(el) => {
          if (listRef) listRef(el);
        }}
        aria-live="polite"
        className="dl-scroll"
        style={{
          height: '320px',
          overflowY: 'auto',
          padding: '16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {!chat.length ? (
          <p
            style={{
              margin: 'auto',
              textAlign: 'center',
              fontSize: '13.5px',
              color: DIM,
              maxWidth: '240px',
            }}
          >
            Say hi to {name}! They’ll invite {o.ign} in-game.
          </p>
        ) : null}
        {chat.map((m) => {
          if (m.from === 'system') {
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: 'center',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'rgba(214, 187, 255, .08)',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#CFC4EA',
                  textAlign: 'center',
                }}
              >
                {m.text}
              </div>
            );
          }
          const me = m.from === 'customer';
          const sending = String(m.id).startsWith('tmp');
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: me ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  padding: '9px 13px',
                  fontSize: '14px',
                  lineHeight: '1.45',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  textAlign: 'left',
                  ...(me
                    ? {
                        borderRadius: '18px 18px 6px 18px',
                        background: ACCENT,
                        color: '#17092E',
                        fontWeight: '500',
                      }
                    : {
                        borderRadius: '18px 18px 18px 6px',
                        background: '#1B1033',
                        color: '#F3EEFF',
                        border: '1px solid rgba(214, 187, 255, .12)',
                      }),
                }}
              >
                {m.text}
              </div>
              <span
                style={{
                  marginTop: '3px',
                  padding: '0 4px',
                  fontSize: '11px',
                  color: '#6A6086',
                }}
              >
                {sending ? 'Sending…' : time(m.at) + (me ? ' · Sent' : '')}
              </span>
            </div>
          );
        })}
        {typing ? (
          <div
            aria-label={name + ' is typing'}
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              gap: '4px',
              padding: '12px 14px',
              borderRadius: '18px 18px 18px 6px',
              background: '#1B1033',
              border: '1px solid rgba(214, 187, 255, .12)',
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: ACCENT,
                  animation:
                    'tmdot 1.2s ease-in-out ' + i * 0.18 + 's infinite',
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      {open ? (
        <div
          style={{
            padding: '10px 12px 12px',
            borderTop: '1px solid rgba(196, 170, 255, .08)',
          }}
        >
          {!chat.some((m) => m.from === 'customer') ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginBottom: '10px',
              }}
            >
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSend(q)}
                  style={{
                    minHeight: '32px',
                    padding: '0 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(214, 187, 255, .22)',
                    background: 'transparent',
                    color: '#CFC4EA',
                    fontSize: '12.5px',
                    fontWeight: '600',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}
          {warn ? (
            <p
              role="alert"
              style={{ margin: '0 0 8px', fontSize: '12.5px', color: PINK }}
            >
              {warn}
            </p>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            style={{ display: 'flex', gap: '8px' }}
          >
            <label
              htmlFor="q-chat-input"
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
              }}
            >
              Message {name}
            </label>
            <input
              id="q-chat-input"
              type="text"
              autoComplete="off"
              placeholder={'Message ' + name + '…'}
              value={draft}
              onChange={onDraft}
              maxLength={MAX_CHAT}
              style={{
                flex: '1',
                minWidth: '0',
                minHeight: '46px',
                padding: '0 14px',
                borderRadius: '14px',
                background: '#120B22',
                border: '1px solid rgba(196, 170, 255, .16)',
                color: '#FFFFFF',
                fontSize: '14.5px',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!hasText}
              style={{
                flex: '0 0 auto',
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: hasText ? ACCENT : 'rgba(196, 170, 255, .1)',
                color: hasText ? '#17092E' : DIM,
              }}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '11.5px',
              color: '#6A6086',
            }}
          >
            Keep payments and logins on Duoly. Teammates will never ask for
            them.
          </p>
        </div>
      ) : null}
    </section>
  );
}

/** Read-only stars, as the order room shows a given rating. */
export function ReviewStars({ n, size }) {
  return (
    <div
      aria-label={'Rated ' + n + ' out of 5'}
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: size > 30 ? '8px' : '3px',
      }}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= n;
        return (
          <span key={i}>
            <svg
              aria-hidden="true"
              width={size}
              height={size}
              viewBox="0 0 24 24"
              style={{
                display: 'block',
                transition: 'transform .15s',
                transform: 'none',
              }}
            >
              <path
                d={STAR}
                fill={on ? GOLD : 'rgba(196, 170, 255, .14)'}
                stroke={on ? GOLD : 'rgba(196, 170, 255, .25)'}
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        );
      })}
    </div>
  );
}

/** After a review: THANK YOU, the stars and what was rated (and tipped). A pending tip goes in children. */
/** A tip as the customer picked it: $5.00 for a dollar tip (charged in EUR), else €4.42. */
/** €5, or €4.58 when it has cents */
export const tipAmount = (sym, n) => sym + n.toFixed(2).replace(/\.00$/, '');
/** A tip as the customer picked it: $5 for a dollar tip (charged in EUR), else €5. */
export const tipMoney = (tip) =>
  tip.shown
    ? tipAmount('$', tip.shown.amount)
    : tipAmount(tip.currency === 'USD' ? '$' : '€', tip.amount);

export function ReviewThanks({ name, rating, tip, children }) {
  return (
    <div className="q-review" style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: '12px',
          fontWeight: '800',
          letterSpacing: '.1em',
          color: GREEN,
        }}
      >
        THANK YOU
      </div>
      <div style={{ marginTop: '10px' }}>
        <ReviewStars n={rating} size={26} />
      </div>
      <p style={{ margin: '10px 0 0', color: '#FFFFFF', fontWeight: '600' }}>
        You rated {name} {rating}/5
        {tip ? ' and left a ' + tipMoney(tip) + ' tip' : ''}.
      </p>
      <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: MUTED }}>
        {tip ? '100% of your tip goes to ' + name + '. ' : ''}Your feedback
        helps us match you with the right teammates.
      </p>
      {children}
    </div>
  );
}

/** "You're covered": re-roll in the first 5 minutes after a match, and report (with a bounty). */
export function CoveredPanel({
  order: o,
  mate,
  sym,
  now,
  reportsEnabled,
  onReroll,
  onReport,
}) {
  const name = mate ? String(mate.name).split(' ')[0] : 'your teammate';
  const left = o.rerollsLeft;
  // re-roll only in the first 5 minutes after matching (server-checked too); then it locks for the session
  const msLeft = o.rerollUntil ? o.rerollUntil - now : 0;
  const locked = msLeft <= 0;
  const rerollText =
    left <= 0
      ? 'You’ve used both re-rolls on this order. If something’s wrong, report it below.'
      : locked
        ? 'Locked now that your session is underway. If something’s wrong, report it below and we’ll step in.'
        : 'Switch to a new teammate for free in the first 5 minutes · ' +
          clock(msLeft) +
          ' left. ' +
          (o.rerollsUnlimited
            ? 'Unlimited re-rolls with Duoly PRO.'
            : left + ' of 2 re-rolls left.');
  const sent = o.reports || [];
  const row = (icon, color, title, text, action) => (
    <li className="q-protect-row">
      <span
        className="q-protect-icon"
        style={{
          color,
          background: 'color-mix(in srgb, ' + color + ' 13%, transparent)',
        }}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={icon} />
        </svg>
      </span>
      <span style={{ flex: '1', minWidth: '0', lineHeight: '1.4' }}>
        <span
          style={{
            display: 'block',
            fontWeight: '700',
            color: '#FFFFFF',
            fontSize: '14.5px',
          }}
        >
          {title}
        </span>
        <span style={{ display: 'block', fontSize: '13px', color: MUTED }}>
          {text}
        </span>
      </span>
      {action}
    </li>
  );
  const small = (label, onClick, disabled, tone) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="q-protect-btn"
      style={
        tone === 'pink'
          ? { color: PINK, borderColor: 'rgba(240, 166, 255, .35)' }
          : {}
      }
    >
      {label}
    </button>
  );
  return (
    <section aria-labelledby="q-protect-h" className="q-protect">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span className="q-protect-shield">
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#062A1B"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </span>
        <span style={{ lineHeight: '1.3' }}>
          <span
            id="q-protect-h"
            style={{
              display: 'block',
              fontFamily: DISPLAY,
              fontSize: '19px',
              fontWeight: '800',
              letterSpacing: '-.02em',
              color: '#FFFFFF',
            }}
          >
            You’re covered
          </span>
          <span style={{ display: 'block', fontSize: '13px', color: MUTED }}>
            Your session should feel great. If it doesn’t, here’s what to do.
          </span>
        </span>
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: '16px 0 0',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {row(
          locked || left <= 0
            ? 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4'
            : 'M1 4v6h6M23 20v-6h-6M20.5 9A9 9 0 0 0 5.6 5.6L1 10m22 4l-4.6 4.4A9 9 0 0 1 3.5 15',
          locked || left <= 0 ? DIM : ACCENT,
          'Not the right fit? Re-roll',
          rerollText,
          small(
            locked || left <= 0 ? 'Locked' : 'Re-roll',
            onReroll,
            locked || left <= 0,
          ),
        )}
        {reportsEnabled
          ? row(
              'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM9 10h6',
              GOLD,
              'Asked to pay or chat outside Duoly?',
              'Report it with proof and get ' +
                sym +
                BOUNTY +
                ' once we confirm it.',
              small('Report', () => onReport('off_platform'), false, 'pink'),
            )
          : null}
        {reportsEnabled
          ? row(
              'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
              PINK,
              'Toxic or disrespectful?',
              'Report ' +
                name +
                ' with proof and get ' +
                sym +
                BOUNTY +
                ' once we confirm it.',
              small('Report', () => onReport('toxic'), false, 'pink'),
            )
          : null}
      </ul>
      {reportsEnabled ? (
        <p
          style={{
            margin: '14px 0 0',
            fontSize: '12.5px',
            lineHeight: '1.5',
            color: DIM,
          }}
        >
          Bounties need solid proof, like screenshots of the messages or the
          match. Our team checks every report by hand, and false reports don’t
          count.
        </p>
      ) : null}
      {sent.length ? (
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {sent.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 12px',
                borderRadius: '12px',
                background: 'rgba(94, 234, 168, .07)',
                border: '1px solid rgba(94, 234, 168, .22)',
                fontSize: '13px',
                color: '#CFF7E4',
              }}
            >
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={GREEN}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Report {r.id}{' '}
              {r.status === 'approved'
                ? 'confirmed · bounty on its way'
                : r.status === 'rejected'
                  ? 'reviewed · not enough proof'
                  : 'received · under review'}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** After the order: stars, quick tags, a few words and a tip. `rv` is the form state
 * ({rating, hover, tags, text, tip, custom, err}); `onEdit(fn)` merges fn(rv) into it. */
export function ReviewForm({ name, sym, rv, busy, tips, onEdit, onSend }) {
  const stars = (n, size, interactive) => (
    <div
      role={interactive ? 'radiogroup' : undefined}
      aria-label={interactive ? 'Rating' : 'Rated ' + n + ' out of 5'}
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: size > 30 ? '8px' : '3px',
      }}
      onMouseLeave={
        interactive ? () => onEdit(() => ({ hover: 0 })) : undefined
      }
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= n;
        const star = (
          <svg
            aria-hidden="true"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            style={{
              display: 'block',
              transition: 'transform .15s',
              transform: interactive && i === rv.hover ? 'scale(1.15)' : 'none',
            }}
          >
            <path
              d={STAR}
              fill={on ? GOLD : 'rgba(196, 170, 255, .14)'}
              stroke={on ? GOLD : 'rgba(196, 170, 255, .25)'}
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        );
        return interactive ? (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rv.rating === i ? 'true' : 'false'}
            aria-label={i + (i === 1 ? ' star' : ' stars')}
            onMouseEnter={() => onEdit(() => ({ hover: i }))}
            onClick={() => onEdit(() => ({ rating: i, err: '' }))}
            style={{
              padding: '2px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              transform: 'none',
            }}
          >
            {star}
          </button>
        ) : (
          <span key={i}>{star}</span>
        );
      })}
    </div>
  );

  const shown = rv.hover || rv.rating;
  const words = [
    '',
    'Not great',
    'Could be better',
    'Good',
    'Great',
    'Amazing!',
  ];
  const tipVal = tips
    ? rv.tip === 'custom'
      ? Number(String(rv.custom).replace(',', '.')) || 0
      : Number(rv.tip) || 0
    : 0;
  const chip = (on) => ({
    minHeight: '36px',
    padding: '0 13px',
    borderRadius: '999px',
    fontSize: '13.5px',
    fontWeight: '600',
    cursor: 'pointer',
    transform: 'none',
    border: '1px solid ' + (on ? ACCENT : 'rgba(196, 170, 255, .16)'),
    background: on ? 'rgba(214, 187, 255, .14)' : 'transparent',
    color: on ? '#FFFFFF' : '#CFC4EA',
  });
  return (
    <div className="q-review">
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: '20px',
            fontWeight: '800',
            letterSpacing: '-.02em',
            color: '#FFFFFF',
          }}
        >
          Rate your session with {name}
        </div>
        <div style={{ marginTop: '12px' }}>{stars(shown, 40, true)}</div>
        <div
          aria-live="polite"
          style={{
            marginTop: '6px',
            minHeight: '20px',
            fontSize: '14px',
            fontWeight: '700',
            color: shown ? GOLD : DIM,
          }}
        >
          {shown ? words[shown] : 'Tap to rate'}
        </div>
      </div>

      {rv.rating ? (
        <div style={{ animation: 'dlfade .25s ease-out' }}>
          <div
            style={{
              marginTop: '14px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {REVIEW_TAGS.map((t) => {
              const on = rv.tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on ? 'true' : 'false'}
                  onClick={() =>
                    onEdit((x) => ({
                      tags: x.tags.includes(t)
                        ? x.tags.filter((y) => y !== t)
                        : x.tags.concat(t).slice(-4),
                    }))
                  }
                  style={chip(on)}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <textarea
            value={rv.text}
            onChange={(e) => {
              const text = e.target.value;
              onEdit(() => ({ text }));
            }}
            maxLength={500}
            rows={3}
            placeholder={
              'Anything you’d like ' + name + ' or us to know? (optional)'
            }
            aria-label="Your review"
            style={{
              marginTop: '14px',
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              borderRadius: '14px',
              border: '1px solid rgba(196, 170, 255, .16)',
              background: '#090414',
              color: '#FFFFFF',
              font: 'inherit',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
            }}
          />

          {tips ? (
            <div className="q-tip">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span style={{ fontWeight: '700', color: '#FFFFFF' }}>
                  Leave a tip for {name}
                </span>
                <span
                  style={{
                    fontSize: '12.5px',
                    color: GREEN,
                    fontWeight: '600',
                  }}
                >
                  100% goes to {name}
                </span>
              </div>
              <div
                role="radiogroup"
                aria-label="Tip"
                style={{
                  marginTop: '10px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                  gap: '6px',
                }}
              >
                {[
                  [0, 'No tip'],
                  [2, sym + '2'],
                  [5, sym + '5'],
                  [10, sym + '10'],
                  ['custom', 'Other'],
                ].map(([val, label]) => {
                  const on = rv.tip === val;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={on ? 'true' : 'false'}
                      onClick={() => onEdit(() => ({ tip: val, err: '' }))}
                      style={{
                        ...chip(on),
                        padding: '0 4px',
                        minHeight: '44px',
                        borderRadius: '12px',
                        fontWeight: '700',
                        ...(on && val
                          ? {
                              borderColor: GREEN,
                              background: 'rgba(94, 234, 168, .1)',
                              color: GREEN,
                            }
                          : {}),
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {rv.tip === 'custom' ? (
                <label
                  style={{
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0 14px',
                    minHeight: '44px',
                    borderRadius: '12px',
                    border: '1px solid rgba(196, 170, 255, .16)',
                    background: '#090414',
                  }}
                >
                  <span style={{ color: MUTED, fontWeight: '700' }}>{sym}</span>
                  <input
                    inputMode="decimal"
                    value={rv.custom}
                    onChange={(e) => {
                      const custom = e.target.value
                        .replace(/[^\d.,]/g, '')
                        .slice(0, 6);
                      onEdit(() => ({ custom }));
                    }}
                    placeholder="Amount"
                    aria-label="Tip amount"
                    style={{
                      flex: '1',
                      minWidth: '0',
                      border: 'none',
                      background: 'transparent',
                      color: '#FFFFFF',
                      font: 'inherit',
                      fontSize: '15px',
                      outline: 'none',
                    }}
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          {rv.err ? (
            <p
              role="alert"
              style={{
                margin: '10px 0 0',
                fontSize: '13.5px',
                color: PINK,
                textAlign: 'center',
              }}
            >
              {rv.err}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onSend}
            disabled={busy}
            className="q-review-send"
          >
            {busy
              ? 'Sending…'
              : tipVal > 0
                ? 'Send rating and ' +
                  sym +
                  tipVal.toFixed(2).replace(/\.00$/, '') +
                  ' tip'
                : 'Send rating'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** After the order: the teammate's screenshots that closed it (`children`), with a report link. */
export function ProofPanel({ reportsEnabled, onReport, children }) {
  return (
    <section
      aria-labelledby="q-proof-h"
      style={{
        borderRadius: '24px',
        background: '#120B22',
        border: '1px solid rgba(196, 170, 255, .1)',
        padding: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <h2
          id="q-proof-h"
          style={{
            margin: '0',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: DIM,
          }}
        >
          Proof from your teammate
        </h2>
        {reportsEnabled ? (
          <button
            type="button"
            onClick={onReport}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '0',
              color: PINK,
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transform: 'none',
            }}
          >
            Report
          </button>
        ) : null}
      </div>
      <div style={{ marginTop: '12px' }}>{children}</div>
    </section>
  );
}
