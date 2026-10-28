'use client';

import React from 'react';
import { LEVELS, levelFor } from '../../design-reference/lib/rewards';

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

// Customer loyalty levels live in lib/rewards.js (the server computes cashback with them too).
export { LEVELS, levelFor };
// Perks: unlocked from the level at index `at`
const PERKS = [
  {
    at: 0,
    title: 'Cashback on every order',
    text: 'Paid into your wallet as gifted balance',
  },
  {
    at: 0,
    title: '2 free re-rolls',
    text: 'Swap your teammate, no questions asked',
  },
  {
    at: 1,
    title: 'Level-up gifts',
    text: 'Gifted balance every time you level up',
  },
  {
    at: 2,
    title: 'Priority matching',
    text: 'Jump the queue at busy times',
  },
  {
    at: 3,
    title: 'Free monthly Play and Learn',
    text: 'One coaching game on us, every month',
    comingSoon: true,
  },
  {
    at: 4,
    title: 'Pick any teammate',
    text: 'Book the top 1% and personal support',
    comingSoon: true,
  },
];

const eur = (n) => '€' + n.toFixed(2);
const BURST = [
  [-46, -38],
  [44, -42],
  [-58, 4],
  [60, 0],
  [-30, 40],
  [34, 42],
  [0, -56],
  [8, 54],
];

export default class Rewards extends React.Component {
  renderVals() {
    const {
      orders = 0,
      name = 'Player',
      cashbackTotal = 0,
      cashbackMonth = 0,
      cashbackPending = 0,
      pendingOrders = 0,
    } = this.props;
    const level = levelFor(orders);
    const idx = LEVELS.indexOf(level);
    const next = LEVELS[idx + 1] || null;
    const pct = next
      ? Math.min(1, (orders - level.from) / (next.from - level.from))
      : 1;
    const ladder = LEVELS.map((l, i) => {
      const state = i < idx ? 'done' : i === idx ? 'now' : 'locked';
      return {
        ...l,
        now: state === 'now',
        locked: state === 'locked',
        threshold: l.from ? l.from + '+ orders' : 'Start',
        giftLabel: l.gift ? '€' + l.gift + ' gift' : 'None',
        style:
          'position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px 12px; border-radius: 18px; text-align: center; min-width: 0; ' +
          (state === 'now'
            ? 'background: #1B1033; border: 1.5px solid ' +
              l.color +
              '; box-shadow: 0 0 30px ' +
              l.color +
              '22;'
            : state === 'done'
              ? 'background: #120B22; border: 1px solid rgba(196, 170, 255, .12);'
              : 'background: #0D0819; border: 1px dashed rgba(196, 170, 255, .14);'),
        swatch:
          'width: 34px; height: 22px; border-radius: 6px; background: ' +
          l.card +
          '; box-shadow: 0 6px 14px rgba(0, 0, 0, .4); ' +
          (state === 'locked' ? 'filter: grayscale(.7) brightness(.55);' : ''),
      };
    });
    const perks = PERKS.map((p) => ({
      ...p,
      unlocked: p.at <= idx && !p.comingSoon,
      lockName: LEVELS[p.at].name,
      lockColor: LEVELS[p.at].color,
      style:
        'display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 16px; ' +
        (p.at <= idx && !p.comingSoon
          ? 'background: #120B22; border: 1px solid rgba(196, 170, 255, .1);'
          : 'background: #0D0819; border: 1px dashed rgba(196, 170, 255, .12);'),
    }));
    const giftLevel = level.gift ? level : null;
    return {
      level,
      idx,
      next,
      ladder,
      perks,
      levelNum: 'Level ' + (idx + 1) + ' of ' + LEVELS.length,
      name: name.toUpperCase(),
      orders: String(orders),
      toNext: next ? String(next.from - orders) : '0',
      nextText: next
        ? next.name +
          ' · ' +
          next.cashback +
          '% cashback + €' +
          next.gift +
          ' gift'
        : '',
      bar:
        'display: block; height: 100%; border-radius: 999px; transition: width .6s ease; width: ' +
        (pct * 100).toFixed(1) +
        '%; background: linear-gradient(90deg, ' +
        level.color +
        ', ' +
        (next ? next.color : level.color) +
        ');',
      cardStyle:
        'position: relative; overflow: hidden; aspect-ratio: 1.586; border-radius: 22px; padding: 22px; display: flex; flex-direction: column; color: #17092E; background: ' +
        level.card +
        '; box-shadow: 0 30px 70px rgba(0, 0, 0, .55), 0 0 60px ' +
        level.color +
        '33, inset 0 1px 0 rgba(255, 255, 255, .6);',
      showGift: !!giftLevel,
      giftClaimed: true,
      giftAmount: giftLevel ? eur(giftLevel.gift) : '',
      giftLevelName: giftLevel ? giftLevel.name : '',
      cashbackTotal: eur(cashbackTotal),
      cashbackMonth: eur(cashbackMonth),
      cashbackPending: eur(cashbackPending),
      pendingOrders,
    };
  }

  render() {
    const v = this.renderVals();
    const L = v.level;
    return (
      <section
        id="rewards"
        aria-labelledby="rw-h"
        className="lb-wrap"
        style={{
          marginTop: '20px',
          padding: '28px',
          borderRadius: '28px',
          background:
            'radial-gradient(45% 60% at 12% 35%, ' +
            L.color +
            '1f, transparent 70%), #120B22',
          border: '1px solid rgba(196, 170, 255, .08)',
          scrollMarginTop: '90px',
        }}
      >
        <div style={{ marginBottom: '22px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: L.color,
              letterSpacing: '.02em',
            }}
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="8" width="18" height="13" rx="2" />
              <path d="M12 8v13M3 12h18M12 8S10.5 3 7.5 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4.5-5a2.5 2.5 0 0 1 0 5" />
            </svg>
            Duoly Rewards
          </div>
          <h2
            id="rw-h"
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
            Play more, get more back
          </h2>
          <p
            style={{
              margin: '8px 0 0',
              maxWidth: '560px',
              fontSize: '14px',
              color: '#A79DC4',
            }}
          >
            Every order levels you up. Higher levels pay back more of every
            order as gifted balance, plus a gift each time you level up.
          </p>
        </div>

        <div className="rw-grid">
          <div
            className="rw-left"
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div
              className="rw-card"
              role="img"
              aria-label={
                'Duoly Rewards ' +
                L.name +
                ' card for ' +
                v.name +
                ', ' +
                v.orders +
                ' orders, ' +
                L.cashback +
                '% cashback'
              }
              style={css(v.cardStyle)}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: '0',
                  background:
                    'linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, .55) 45%, rgba(214, 187, 255, .35) 50%, transparent 62%)',
                  backgroundSize: '250% 100%',
                  animation: 'rwholo 5.5s ease-in-out infinite',
                  mixBlendMode: 'overlay',
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: '-40px',
                  bottom: '-60px',
                  width: '220px',
                  height: '220px',
                  borderRadius: '50%',
                  border: '28px solid rgba(255, 255, 255, .16)',
                }}
              />
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: '24px',
                    fontWeight: '800',
                    letterSpacing: '-.04em',
                  }}
                >
                  duoly
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    letterSpacing: '.14em',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'rgba(23, 9, 46, .14)',
                  }}
                >
                  {L.name.toUpperCase()}
                </span>
              </div>
              <div
                style={{
                  position: 'relative',
                  marginTop: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '44px',
                    height: '34px',
                    borderRadius: '8px',
                    background:
                      'linear-gradient(135deg, rgba(255, 255, 255, .7), rgba(23, 9, 46, .25))',
                    boxShadow: 'inset 0 0 0 1px rgba(23, 9, 46, .25)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: '0',
                      right: '0',
                      top: '50%',
                      height: '1px',
                      background: 'rgba(23, 9, 46, .3)',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: '0',
                      bottom: '0',
                      left: '50%',
                      width: '1px',
                      background: 'rgba(23, 9, 46, .3)',
                    }}
                  />
                </span>
                <svg
                  aria-hidden="true"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#17092E"
                  strokeOpacity=".55"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M8.5 7.5a6 6 0 0 1 0 9M12 5a10 10 0 0 1 0 14M15.5 2.5a14 14 0 0 1 0 19" />
                </svg>
              </div>
              <div
                style={{
                  position: 'relative',
                  marginTop: '14px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span style={{ minWidth: '0' }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '10px',
                      fontWeight: '700',
                      letterSpacing: '.14em',
                      opacity: '.6',
                    }}
                  >
                    MEMBER
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '15px',
                      fontWeight: '700',
                      letterSpacing: '.08em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v.name}
                  </span>
                </span>
                <span style={{ textAlign: 'right', flex: '0 0 auto' }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '10px',
                      fontWeight: '700',
                      letterSpacing: '.14em',
                      opacity: '.6',
                    }}
                  >
                    {v.orders} ORDERS
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: DISPLAY,
                      fontSize: '20px',
                      fontWeight: '800',
                    }}
                  >
                    {L.cashback}% back
                  </span>
                </span>
              </div>
            </div>

            {v.showGift ? (
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px',
                  borderRadius: '20px',
                  background: v.giftClaimed
                    ? 'rgba(94, 234, 168, .08)'
                    : 'linear-gradient(135deg, rgba(240, 166, 255, .14), rgba(214, 187, 255, .06))',
                  border:
                    '1px solid ' +
                    (v.giftClaimed
                      ? 'rgba(94, 234, 168, .3)'
                      : 'rgba(240, 166, 255, .32)'),
                }}
              >
                <span
                  style={{
                    position: 'relative',
                    flex: '0 0 auto',
                    width: '52px',
                    height: '52px',
                    borderRadius: '16px',
                    background: v.giftClaimed
                      ? 'rgba(94, 234, 168, .14)'
                      : 'rgba(240, 166, 255, .16)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {v.giftClaimed ? (
                    <>
                      <svg
                        aria-hidden="true"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={GREEN}
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      {BURST.map(([x, y], i) => (
                        <span
                          key={i}
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: [
                              GREEN,
                              '#F0A6FF',
                              '#FFD27A',
                              '#D6BBFF',
                            ][i % 4],
                            '--x': x + 'px',
                            '--y': y + 'px',
                            animation: 'rwburst .8s ease-out forwards',
                          }}
                        />
                      ))}
                    </>
                  ) : (
                    <svg
                      aria-hidden="true"
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#F0A6FF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ animation: 'rwgift 2.4s ease-in-out infinite' }}
                    >
                      <rect x="3" y="8" width="18" height="13" rx="2" />
                      <path d="M12 8v13M3 12h18M12 8S10.5 3 7.5 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4.5-5a2.5 2.5 0 0 1 0 5" />
                    </svg>
                  )}
                </span>
                <span style={{ flex: '1', minWidth: '0', lineHeight: '1.35' }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '700',
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: GREEN,
                    }}
                  >
                    Received
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: DISPLAY,
                      fontSize: '22px',
                      fontWeight: '800',
                      color: '#FFFFFF',
                    }}
                  >
                    {v.giftAmount}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      color: '#A79DC4',
                    }}
                  >
                    Added to your wallet as gifted balance
                  </span>
                </span>
              </div>
            ) : null}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '10px',
              }}
            >
              <div
                style={{
                  padding: '14px',
                  borderRadius: '16px',
                  background: '#090414',
                  border: '1px solid rgba(196, 170, 255, .08)',
                }}
              >
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: '20px',
                    fontWeight: '700',
                    color: GREEN,
                  }}
                >
                  {v.cashbackMonth}
                </div>
                <div style={{ fontSize: '12px', color: '#8E84AB' }}>
                  cashback this month
                </div>
              </div>
              <div
                style={{
                  padding: '14px',
                  borderRadius: '16px',
                  background: '#090414',
                  border: '1px solid rgba(196, 170, 255, .08)',
                }}
              >
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#FFFFFF',
                  }}
                >
                  {v.cashbackTotal}
                </div>
                <div style={{ fontSize: '12px', color: '#8E84AB' }}>
                  cashback all time
                </div>
              </div>
              <div
                style={{
                  padding: '14px',
                  borderRadius: '16px',
                  background: '#090414',
                  border: '1px solid rgba(196, 170, 255, .08)',
                }}
              >
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#D6BBFF',
                  }}
                >
                  {v.cashbackPending}
                </div>
                <div style={{ fontSize: '12px', color: '#8E84AB' }}>
                  pending from {v.pendingOrders}{' '}
                  {v.pendingOrders === 1 ? 'order' : 'orders'}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              minWidth: '0',
            }}
          >
            <div
              style={{
                padding: '18px 20px',
                borderRadius: '20px',
                background: '#090414',
                border: '1px solid rgba(196, 170, 255, .08)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '6px 12px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    color: '#8E84AB',
                  }}
                >
                  {v.levelNum}
                </span>
                <span style={{ fontSize: '13px', color: '#8E84AB' }}>
                  <b style={{ color: '#FFFFFF' }}>{v.orders}</b> orders
                </span>
              </div>
              <div
                style={{
                  marginTop: '4px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: '6px 12px',
                }}
              >
                <span
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: '34px',
                    fontWeight: '800',
                    letterSpacing: '-.03em',
                    color: L.color,
                  }}
                >
                  {L.name}
                </span>
                <span style={{ fontSize: '15px', color: '#CFC4EA' }}>
                  {L.cashback}% back on every order
                </span>
              </div>
              <div
                style={{
                  marginTop: '14px',
                  height: '10px',
                  borderRadius: '999px',
                  background: 'rgba(196, 170, 255, .1)',
                  overflow: 'hidden',
                }}
              >
                <span style={css(v.bar)} />
              </div>
              <p
                style={{
                  margin: '10px 0 0',
                  fontSize: '13.5px',
                  color: '#A79DC4',
                }}
              >
                {v.next ? (
                  <>
                    <b style={{ color: '#FFFFFF' }}>{v.toNext} more orders</b>{' '}
                    to {v.nextText}
                  </>
                ) : (
                  <span style={{ color: '#D6BBFF', fontWeight: '600' }}>
                    Diamond reached. You get the most back on every order.
                  </span>
                )}
              </p>
            </div>

            <ol
              className="rw-ladder"
              aria-label="Reward levels"
              style={{ listStyle: 'none' }}
            >
              {v.ladder.map((l) => (
                <li
                  key={l.id}
                  aria-current={l.now ? 'step' : undefined}
                  style={css(l.style)}
                >
                  <span aria-hidden="true" style={css(l.swatch)} />
                  <span
                    style={{
                      fontWeight: '700',
                      fontSize: '14px',
                      color: l.locked ? '#8E84AB' : '#FFFFFF',
                    }}
                  >
                    {l.name}
                  </span>
                  <span style={{ fontSize: '11px', color: '#6A6086' }}>
                    {l.threshold}
                  </span>
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: '20px',
                      fontWeight: '800',
                      color: l.locked ? '#6A6086' : l.color,
                      lineHeight: '1',
                    }}
                  >
                    {l.cashback}%
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: l.locked ? '#6A6086' : '#CFC4EA',
                    }}
                  >
                    {l.giftLabel}
                  </span>
                  {l.now ? (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-9px',
                        fontSize: '10px',
                        fontWeight: '800',
                        letterSpacing: '.06em',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: l.color,
                        color: '#17092E',
                      }}
                    >
                      YOU
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>

            <div>
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  marginBottom: '10px',
                }}
              >
                Your perks
              </div>
              <ul className="rw-perks" style={{ listStyle: 'none' }}>
                {v.perks.map((p, i) => (
                  <li key={i} style={css(p.style)}>
                    <span
                      style={{
                        flex: '0 0 auto',
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: p.unlocked
                          ? 'rgba(94, 234, 168, .14)'
                          : 'rgba(196, 170, 255, .06)',
                        color: p.unlocked ? GREEN : '#6A6086',
                      }}
                    >
                      {p.unlocked ? (
                        <svg
                          aria-hidden="true"
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="5" y="11" width="14" height="10" rx="2.5" />
                          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                        </svg>
                      )}
                    </span>
                    <span style={{ minWidth: '0', lineHeight: '1.35' }}>
                      <span
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '600',
                          fontSize: '14px',
                          color: p.unlocked ? '#FFFFFF' : '#8E84AB',
                        }}
                      >
                        {p.title}
                        {p.unlocked ? null : (
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: '700',
                              padding: '1px 7px',
                              borderRadius: '6px',
                              border: '1px solid ' + p.lockColor + '66',
                              color: p.lockColor,
                            }}
                          >
                            {p.comingSoon ? 'coming soon' : p.lockName}
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '12.5px',
                          color: p.unlocked ? '#A79DC4' : '#6A6086',
                        }}
                      >
                        {p.text}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    );
  }
}
