'use client';

import React from 'react';
import TrustBadge, { trustBadgeForCompleted } from '../shared/TrustBadge';

// Turns a CSS declaration string ("color: red; margin-top: 4px") into a React style object.
function css(str) {
  const out = {};
  String(str || '')
    .split(';')
    .forEach((decl) => {
      const i = decl.indexOf(':');
      if (i < 0) return;
      const k = decl.slice(0, i).trim();
      const val = decl.slice(i + 1).trim();
      if (!k) return;
      out[
        k.startsWith('--')
          ? k
          : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      ] = val;
    });
  return out;
}

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const GREEN = '#5EEAA8';
const SHIELD = 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z';

import {
  TIERS as BASE_TIERS,
  RELEASE_DAYS,
} from '../../design-reference/lib/trust';

const TIERS = BASE_TIERS.map((tier) => ({
  ...tier,
  perk:
    // Live with migration 20261026160000 (MONEY-RULES section 9). Never a delay number here.
    tier.id === 'veteran'
      ? 'Orders of €20 or more reach you first'
      : tier.id === 'elite'
        ? 'You get matched faster'
        : tier.id === 'legend'
          ? 'No deposit plus Legend badge'
          : tier.perk,
}));

function tierFor(completed) {
  let tier = TIERS[0];
  TIERS.forEach((candidate) => {
    if (completed >= candidate.from) tier = candidate;
  });
  return tier;
}

// Trust levels live in lib/trust.js (the server's earnings ledger uses them too).
export { TIERS, RELEASE_DAYS, tierFor };

const usd = (n) => '$' + n.toFixed(2);

export default class TrustScore extends React.Component {
  renderVals() {
    const { completed = 0, held = 0, saved = 0 } = this.props;
    const tier = tierFor(completed);
    const idx = TIERS.indexOf(tier);
    const next = TIERS[idx + 1] || null;
    const span = next ? next.from - tier.from : 1;
    const into = next ? completed - tier.from : 1;
    const pct = Math.min(1, into / span);
    // progress ring
    const R = 52,
      C = 2 * Math.PI * R;
    const ladder = TIERS.map((t, i) => {
      const state = i < idx ? 'done' : i === idx ? 'now' : 'locked';
      return {
        ...t,
        state,
        done: state === 'done',
        now: state === 'now',
        locked: state === 'locked',
        range: TIERS[i + 1]
          ? t.from + '-' + (TIERS[i + 1].from - 1) + ' orders'
          : t.from + '+ orders',
        depositLabel: t.deposit ? t.deposit + '%' : '0%',
        card:
          'position: relative; display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 20px; min-width: 0; transition: transform .2s; ' +
          (state === 'now'
            ? 'background: linear-gradient(180deg, ' +
              t.glow.replace(/[\d.]+\)$/, '.16)') +
              ', rgba(18, 11, 34, .6)); border: 1.5px solid ' +
              t.color +
              '; box-shadow: 0 0 40px ' +
              t.glow.replace(/[\d.]+\)$/, '.18)') +
              '; transform: translateY(-4px);'
            : state === 'done'
              ? 'background: #120B22; border: 1px solid rgba(196, 170, 255, .14);'
              : 'background: #0D0819; border: 1px dashed rgba(196, 170, 255, .14);'),
        shieldFill: state === 'locked' ? 'rgba(196, 170, 255, .08)' : t.color,
        shieldOpacity:
          state === 'locked' ? '1' : state === 'done' ? '.55' : '1',
        nameColor: state === 'locked' ? '#8E84AB' : '#FFFFFF',
        // Matching perks: on for this tier and every tier above it.
        perkActive:
          (t.id === 'veteran' || t.id === 'elite') && state !== 'locked',
        pctColor: state === 'locked' ? '#6A6086' : t.color,
      };
    });
    return {
      tier,
      next,
      ladder,
      completed: String(completed),
      tierNum: 'Level ' + (idx + 1) + ' of ' + TIERS.length,
      depositLabel: tier.deposit ? tier.deposit + '%' : '0%',
      isElite: !next,
      toNext: next ? String(next.from - completed) : '0',
      nextLabel: next
        ? next.name +
          ' · ' +
          (next.deposit ? next.deposit + '% deposit' : 'no deposit')
        : '',
      ringBox: '0 0 128 128',
      R,
      C: C.toFixed(1),
      dash: (C * (1 - pct)).toFixed(1),
      pctLabel: Math.round(pct * 100) + '%',
      track:
        'position: absolute; left: 10%; right: 10%; top: 37px; height: 3px; border-radius: 999px; background: rgba(196, 170, 255, .1); overflow: hidden;',
      trackFill:
        'display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, ' +
        TIERS[0].color +
        ', ' +
        tier.color +
        '); width: ' +
        Math.min(100, ((idx + pct) / (TIERS.length - 1)) * 100).toFixed(1) +
        '%;',
      emblemGlow:
        'position: absolute; inset: 10%; border-radius: 50%; background: radial-gradient(closest-side, ' +
        tier.glow +
        ', transparent);',
      held: usd(held),
      saved: usd(saved),
      badge: trustBadgeForCompleted(completed),
    };
  }

  render() {
    const v = this.renderVals();
    const t = v.tier;
    return (
      <section
        id="trust"
        aria-labelledby="ts-h"
        className="lb-wrap"
        style={{
          marginTop: '20px',
          padding: '28px',
          borderRadius: '28px',
          background:
            'radial-gradient(50% 60% at 15% 30%, ' +
            t.glow.replace(/[\d.]+\)$/, '.12)') +
            ', transparent 70%), #120B22',
          border: '1px solid rgba(196, 170, 255, .08)',
          scrollMarginTop: '90px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '22px',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: '600',
                color: t.color,
                letterSpacing: '.02em',
              }}
            >
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
              >
                <path d={SHIELD} fill={t.color} />
              </svg>
              Trust level
            </div>
            <h2
              id="ts-h"
              style={{
                margin: '6px 0 0',
                fontFamily: DISPLAY,
                fontWeight: '800',
                fontSize: 'clamp(30px, 4vw, 42px)',
                lineHeight: '1',
                letterSpacing: '-.035em',
                color: '#FFFFFF',
              }}
            >
              Loyalty lowers your deposit
            </h2>
            <p
              style={{
                margin: '8px 0 0',
                maxWidth: '560px',
                fontSize: '14px',
                color: '#A79DC4',
              }}
            >
              A security deposit is held from each payout and paid back after{' '}
              {RELEASE_DAYS} days without a dispute. The more orders you
              complete, the less we hold.
            </p>
          </div>
        </div>

        <div className="ts-grid">
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '22px 18px',
              borderRadius: '24px',
              background: '#090414',
              border: '1px solid ' + t.color + '33',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '150px',
                height: '150px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span aria-hidden="true" style={css(v.emblemGlow)} />
              <svg
                aria-hidden="true"
                viewBox={v.ringBox}
                style={{
                  position: 'absolute',
                  inset: '0',
                  width: '100%',
                  height: '100%',
                  transform: 'rotate(-90deg)',
                }}
              >
                <circle
                  cx="64"
                  cy="64"
                  r={v.R}
                  fill="none"
                  stroke="rgba(196, 170, 255, .1)"
                  strokeWidth="6"
                />
                <circle
                  cx="64"
                  cy="64"
                  r={v.R}
                  fill="none"
                  stroke={t.color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={v.C}
                  strokeDashoffset={v.dash}
                  style={{ transition: 'stroke-dashoffset .6s ease' }}
                />
              </svg>
              <svg
                role="img"
                aria-label={t.name + ' trust level'}
                width="64"
                height="64"
                viewBox="0 0 24 24"
                style={{
                  position: 'relative',
                  filter: 'drop-shadow(0 6px 18px ' + t.glow + ')',
                  animation: 'tsfloat 4s ease-in-out infinite',
                }}
              >
                <path d={SHIELD} fill={t.color} />
                <path
                  d="M12 6.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5L12 6.5z"
                  fill="#120B22"
                  fillOpacity=".55"
                />
              </svg>
            </div>
            <div
              style={{
                marginTop: '6px',
                fontSize: '12px',
                fontWeight: '700',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: '#8E84AB',
              }}
            >
              {v.tierNum}
            </div>
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: '32px',
                fontWeight: '800',
                letterSpacing: '-.03em',
                color: t.color,
                lineHeight: '1.1',
              }}
            >
              {t.name}
            </div>
            <div style={{ marginTop: '8px' }}>
              <TrustBadge badge={v.badge} />
            </div>
            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontSize: '44px',
                  fontWeight: '800',
                  letterSpacing: '-.04em',
                  color: '#FFFFFF',
                  lineHeight: '1',
                }}
              >
                {v.depositLabel}
              </span>
              <span style={{ fontSize: '13px', color: '#A79DC4' }}>
                deposit per order
              </span>
            </div>
            {v.isElite ? (
              <p
                style={{
                  margin: '14px 0 0',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  color: '#FFD27A',
                }}
              >
                Top level reached. Nothing is held from your payouts.
              </p>
            ) : (
              <p
                style={{
                  margin: '14px 0 0',
                  fontSize: '13.5px',
                  color: '#A79DC4',
                }}
              >
                <b style={{ color: '#FFFFFF' }}>{v.toNext} more orders</b> to{' '}
                {v.nextLabel}
              </p>
            )}
            <div
              style={{
                marginTop: '16px',
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
              }}
            >
              <div
                style={{
                  padding: '10px 8px',
                  borderRadius: '14px',
                  background: '#120B22',
                }}
              >
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#FFFFFF',
                  }}
                >
                  {v.held}
                </div>
                <div style={{ fontSize: '11.5px', color: '#8E84AB' }}>
                  held right now
                </div>
              </div>
              <div
                style={{
                  padding: '10px 8px',
                  borderRadius: '14px',
                  background: '#120B22',
                }}
              >
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: '18px',
                    fontWeight: '700',
                    color: GREEN,
                  }}
                >
                  {v.saved}
                </div>
                <div style={{ fontSize: '11.5px', color: '#8E84AB' }}>
                  saved vs Rookie
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              minWidth: '0',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}
              >
                Your path
              </span>
              <span style={{ fontSize: '13px', color: '#8E84AB' }}>
                <b style={{ color: '#FFFFFF' }}>{v.completed}</b> orders
                completed
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <div className="ts-track" aria-hidden="true" style={css(v.track)}>
                <span style={css(v.trackFill)} />
              </div>
              <ol className="ts-ladder" style={{ listStyle: 'none' }}>
                {v.ladder.map((l) => (
                  <li
                    key={l.id}
                    aria-current={l.now ? 'step' : undefined}
                    style={css(l.card)}
                  >
                    <span
                      style={{
                        position: 'relative',
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        alignSelf: 'center',
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="44"
                        height="44"
                        viewBox="0 0 24 24"
                        style={{ opacity: l.shieldOpacity }}
                      >
                        <path d={SHIELD} fill={l.shieldFill} />
                      </svg>
                      <span
                        style={{
                          position: 'absolute',
                          inset: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: l.locked ? '#6A6086' : '#120B22',
                        }}
                      >
                        {l.done ? (
                          <svg
                            aria-hidden="true"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : l.locked ? (
                          <svg
                            aria-hidden="true"
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="5"
                              y="11"
                              width="14"
                              height="10"
                              rx="2.5"
                            />
                            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                          </svg>
                        ) : (
                          <svg
                            aria-hidden="true"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M12 4l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.3l5-.7L12 4z" />
                          </svg>
                        )}
                      </span>
                    </span>
                    <span style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'block',
                          fontWeight: '700',
                          fontSize: '15px',
                          color: l.nameColor,
                        }}
                      >
                        {l.name}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '11.5px',
                          color: '#8E84AB',
                        }}
                      >
                        {l.range}
                      </span>
                    </span>
                    <span
                      style={{
                        textAlign: 'center',
                        fontFamily: DISPLAY,
                        fontSize: '26px',
                        fontWeight: '800',
                        letterSpacing: '-.03em',
                        color: l.pctColor,
                        lineHeight: '1',
                      }}
                    >
                      {l.depositLabel}
                      <span
                        style={{
                          display: 'block',
                          marginTop: '2px',
                          fontFamily: 'Geist, system-ui, sans-serif',
                          fontSize: '11px',
                          fontWeight: '600',
                          letterSpacing: '0',
                          color: '#8E84AB',
                        }}
                      >
                        deposit
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        lineHeight: '1.35',
                        color: l.locked ? '#6A6086' : '#CFC4EA',
                        textAlign: 'center',
                      }}
                    >
                      {l.perk}
                      {l.perkActive ? (
                        <span
                          data-perk-active
                          style={{
                            display: 'block',
                            marginTop: '4px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            color: GREEN,
                          }}
                        >
                          Active for you
                        </span>
                      ) : null}
                    </span>
                    {l.now ? (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-10px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '10.5px',
                          fontWeight: '800',
                          letterSpacing: '.06em',
                          padding: '2px 9px',
                          borderRadius: '999px',
                          background: t.color,
                          color: '#120B22',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        YOU
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '16px',
                background: '#090414',
                border: '1px solid rgba(196, 170, 255, .08)',
                fontSize: '13.5px',
                color: '#A79DC4',
              }}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#D6BBFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flex: '0 0 auto' }}
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8h.01M11 12h1v4h1" />
              </svg>
              <span>
                Only completed orders count. Cancelled or disputed orders do not
                move you up.
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }
}
