'use client';

import React from 'react';
import { GAMES, gameOf } from '../../design-reference/lib/games';
import { flagSrc } from '../../design-reference/lib/countries';

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
const MEDALS = [
  {
    color: '#FFD27A',
    glow: 'rgba(255, 210, 122, .35)',
    tint: 'rgba(255, 210, 122, .16)',
    label: '1st',
  },
  {
    color: '#D9E1F2',
    glow: 'rgba(217, 225, 242, .25)',
    tint: 'rgba(217, 225, 242, .1)',
    label: '2nd',
  },
  {
    color: '#E8A37C',
    glow: 'rgba(232, 163, 124, .28)',
    tint: 'rgba(232, 163, 124, .12)',
    label: '3rd',
  },
];

const PERIODS = [
  ['week', 'This week'],
  ['month', 'This month'],
  ['all', 'All time'],
];

// Real rankings from completed orders (teammate_stats().leaderboard[period][tab], rules from lib/ledger.js).
// Points: +10 per completed order, +5 per five-star review.
// Ported from design-reference/components/Leaderboard.jsx. Only change: an unrated row shows "New" instead of a dash.
export default class Leaderboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { tab: 'global', period: 'week' };
  }
  board() {
    const { tab, period } = this.state;
    const all =
      (this.props.board &&
        this.props.board[period] &&
        this.props.board[period][tab]) ||
      [];
    const meId = this.props.meId;
    return all.map((r, i) => ({
      ...r,
      pos: i + 1,
      you: r.id === meId,
      // your own row uses your current picture and name
      ...(r.id === meId && this.props.me
        ? {
            name: this.props.me.name || r.name,
            image: this.props.me.avatar || r.image,
          }
        : {}),
    }));
  }
  renderVals() {
    const s = this.state;
    const rows = this.board();
    const top = rows[0] ? rows[0].points : 1;
    const fmt = (n) => n.toLocaleString('en-US');
    const view = (row) => ({
      ...row,
      key: row.id,
      avatar:
        row.image ||
        '/assets/avatars/avatar-' +
          (1 +
            (row.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 10)) +
          '.png',
      flagImg: flagSrc(row.country),
      gameImg: gameOf(row.main).img,
      gameName: gameOf(row.main).name,
      rank:
        row.orders +
        (row.orders === 1 ? ' order' : ' orders') +
        ' · mostly ' +
        gameOf(row.main).short,
      pointsLabel: fmt(row.points),
      ordersLabel: fmt(row.orders),
      fivesLabel: fmt(row.fives || 0),
      ratingLabel: row.rating ? row.rating.toFixed(2) : 'New',
      bar:
        'height: 100%; border-radius: 999px; width: ' +
        Math.max(6, (row.points / top) * 100).toFixed(1) +
        '%; background: ' +
        (row.you ? '#D6BBFF' : 'rgba(214, 187, 255, .45)') +
        ';',
    });

    // podium order on screen: 2nd, 1st, 3rd
    const podium = [1, 0, 2]
      .filter((i) => rows[i])
      .map((i) => {
        const m = MEDALS[i];
        const row = view(rows[i]);
        const first = i === 0;
        return {
          ...row,
          first,
          medal: m.label,
          medalColor: m.color,
          avatarSize: first ? 92 : 72,
          ring:
            'position: relative; display: block; border-radius: 50%; box-shadow: 0 0 40px ' +
            m.glow +
            ';',
          img:
            'display: block; width: ' +
            (first ? 92 : 72) +
            'px; height: ' +
            (first ? 92 : 72) +
            'px; border-radius: 50%; object-fit: cover;',
          flagSize: first ? 26 : 20,
          plinth:
            'position: relative; overflow: hidden; width: 100%; margin-top: 14px; border-radius: 18px 18px 8px 8px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 14px; ' +
            'height: ' +
            (first ? 132 : i === 1 ? 104 : 84) +
            'px; background: linear-gradient(180deg, ' +
            m.tint +
            ', rgba(18, 11, 34, 0) 90%); border-top: 1px solid ' +
            m.tint +
            '; border-left: 1px solid ' +
            m.tint +
            '; border-right: 1px solid ' +
            m.tint +
            ';',
          numeral:
            'font-family: ' +
            DISPLAY +
            '; font-weight: 800; line-height: 1; letter-spacing: -.04em; font-size: ' +
            (first ? 54 : 42) +
            'px; color: ' +
            m.color +
            ';',
        };
      });
    const list = rows.slice(3, 12).map(view);
    const meRow = rows.find((r) => r.you);
    const meVisible = meRow && meRow.pos <= 12;
    const ahead = meRow && meRow.pos > 1 ? rows[meRow.pos - 2] : null;
    const tabs = [{ id: 'global', name: 'Global', img: '' }]
      .concat(GAMES.map((g) => ({ id: g.id, name: g.short, img: g.img })))
      .map((t) => {
        const a = s.tab === t.id;
        return {
          ...t,
          pressed: a ? 'true' : 'false',
          style:
            'display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 14px 0 ' +
            (t.img ? '6px' : '12px') +
            '; border-radius: 12px; font-size: 14px; font-weight: 600; white-space: nowrap; ' +
            (a
              ? 'background: #F3EEFF; color: #17092E; border: 1px solid #F3EEFF;'
              : 'background: #090414; color: #CFC4EA; border: 1px solid rgba(196, 170, 255, .12);'),
          imgStyle: 'width: 30px; height: 30px; border-radius: 8px;',
          pick: () => this.setState({ tab: t.id }),
        };
      });
    const periods = PERIODS.map(([id, label]) => {
      const a = s.period === id;
      return {
        label,
        pressed: a ? 'true' : 'false',
        style:
          'min-height: 36px; padding: 0 12px; border-radius: 9px; border: none; font-size: 13px; font-weight: 600; ' +
          (a
            ? 'background: #1B1033; color: #FFFFFF;'
            : 'background: transparent; color: #8E84AB;'),
        pick: () => this.setState({ period: id }),
      };
    });
    const tabName = s.tab === 'global' ? 'Global' : gameOf(s.tab).name;
    const periodName = PERIODS.find((p) => p[0] === s.period)[1];
    return {
      podium,
      list,
      tabs,
      periods,
      tabName,
      periodName,
      count: String(rows.length),
      empty: !rows.length,
      me: meRow ? view(meRow) : null,
      meVisible,
      meHidden: meRow && !meVisible,
      meGap: meRow && ahead ? fmt(ahead.points - meRow.points + 1) : '',
      meAhead: ahead ? ahead.name : '',
      meTop: meRow && meRow.pos === 1,
      notRanked: !meRow,
    };
  }

  render() {
    const v = this.renderVals();
    const head = {
      fontSize: '12px',
      fontWeight: '600',
      color: '#6A6086',
      textTransform: 'uppercase',
      letterSpacing: '.06em',
    };
    const Row = (r, i) => (
      <li
        key={r.key}
        className="lb-row"
        style={{
          padding: '10px 12px',
          borderRadius: '16px',
          background: r.you
            ? '#1B1033'
            : i % 2
              ? 'transparent'
              : 'rgba(196, 170, 255, .025)',
          border: r.you ? '1.5px solid #D6BBFF' : '1.5px solid transparent',
        }}
      >
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: '1.1',
          }}
        >
          <span
            style={{
              fontFamily: DISPLAY,
              fontSize: '18px',
              fontWeight: '800',
              color: '#FFFFFF',
            }}
          >
            {r.pos}
          </span>
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '0',
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
              src={r.avatar}
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
            {r.flagImg ? (
              <img
                src={r.flagImg}
                alt=""
                width="15"
                height="15"
                style={{
                  position: 'absolute',
                  right: '-2px',
                  bottom: '-2px',
                  width: '15px',
                  height: '15px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
            ) : null}
          </span>
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: '0',
              lineHeight: '1.3',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '600',
                color: '#FFFFFF',
                minWidth: '0',
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.name}
              </span>
              {r.you ? (
                <span
                  style={{
                    flex: '0 0 auto',
                    fontSize: '10.5px',
                    fontWeight: '800',
                    padding: '1px 7px',
                    borderRadius: '6px',
                    background: '#D6BBFF',
                    color: '#17092E',
                  }}
                >
                  YOU
                </span>
              ) : null}
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12.5px',
                color: '#8E84AB',
                minWidth: '0',
              }}
            >
              <img
                src={r.gameImg}
                alt={r.gameName}
                width="16"
                height="16"
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  flex: '0 0 auto',
                }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.rank}
              </span>
            </span>
          </span>
        </span>
        <span
          className="lb-hide-sm"
          style={{ textAlign: 'right', fontWeight: '600', color: '#CFC4EA' }}
        >
          {r.ordersLabel}
        </span>
        <span
          className="lb-hide-sm"
          style={{ textAlign: 'right', fontWeight: '600', color: '#CFC4EA' }}
        >
          {r.fivesLabel}
        </span>
        <span
          className="lb-hide-sm"
          style={{ textAlign: 'right', fontWeight: '600', color: '#CFC4EA' }}
        >
          ★ {r.ratingLabel}
        </span>
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '6px',
          }}
        >
          <span
            style={{
              fontFamily: DISPLAY,
              fontSize: '17px',
              fontWeight: '700',
              color: '#FFFFFF',
            }}
          >
            {r.pointsLabel}
          </span>
          <span
            style={{
              width: '100%',
              maxWidth: '130px',
              height: '4px',
              borderRadius: '999px',
              background: 'rgba(196, 170, 255, .08)',
              overflow: 'hidden',
            }}
          >
            <span style={{ display: 'block', ...css(r.bar) }} />
          </span>
        </span>
      </li>
    );

    return (
      <section
        id="leaderboard"
        aria-labelledby="lb-h"
        className="lb-wrap"
        style={{
          position: 'relative',
          overflow: 'hidden',
          marginTop: '20px',
          padding: '28px',
          borderRadius: '28px',
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(255, 210, 122, .08), transparent 70%), #120B22',
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
            gap: '16px',
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
                color: '#FFD27A',
                letterSpacing: '.02em',
              }}
            >
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="#FFD27A"
              >
                <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z" />
              </svg>
              {v.periodName} · {v.tabName}
            </div>
            <h2
              id="lb-h"
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
              Duoly Leaderboard
            </h2>
            <p
              style={{ margin: '8px 0 0', fontSize: '14px', color: '#A79DC4' }}
            >
              Points: +10 per completed order, +5 for every five-star review.
            </p>
          </div>
          <div
            role="group"
            aria-label="Time range"
            style={{
              display: 'flex',
              gap: '2px',
              padding: '4px',
              borderRadius: '12px',
              background: '#090414',
              border: '1px solid rgba(196, 170, 255, .1)',
            }}
          >
            {v.periods.map((p, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={p.pressed}
                onClick={p.pick}
                style={css(p.style)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Leaderboard"
          className="dl-scroll"
          style={{
            marginTop: '18px',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '10px',
          }}
        >
          {v.tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.pressed}
              onClick={t.pick}
              style={css(t.style)}
            >
              {t.img ? (
                <img
                  src={t.img}
                  alt=""
                  width="30"
                  height="30"
                  style={css(t.imgStyle)}
                />
              ) : (
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                </svg>
              )}
              {t.name}
            </button>
          ))}
        </div>

        <ol
          aria-label="Top 3"
          className="lb-podium"
          style={{
            listStyle: 'none',
            margin: '36px auto 0',
            padding: '0',
            maxWidth: '640px',
          }}
        >
          {v.podium.map((p) => (
            <li
              key={p.key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                minWidth: '0',
              }}
            >
              <span style={{ position: 'relative', display: 'block' }}>
                {p.first ? (
                  <svg
                    aria-hidden="true"
                    width="40"
                    height="30"
                    viewBox="0 0 24 18"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '-30px',
                      marginLeft: '-20px',
                      filter: 'drop-shadow(0 4px 12px rgba(255, 210, 122, .6))',
                      animation: 'lbcrown 3s ease-in-out infinite',
                    }}
                  >
                    <path
                      fill="#FFD27A"
                      d="M1 4l5.5 5L12 1l5.5 8L23 4l-2.2 12.5H3.2L1 4z"
                    />
                    <circle cx="1" cy="4" r="1.6" fill="#FFE7B0" />
                    <circle cx="12" cy="1.4" r="1.6" fill="#FFE7B0" />
                    <circle cx="23" cy="4" r="1.6" fill="#FFE7B0" />
                  </svg>
                ) : null}
                <span style={css(p.ring)}>
                  <img
                    src={p.avatar}
                    alt=""
                    width={p.avatarSize}
                    height={p.avatarSize}
                    referrerPolicy="no-referrer"
                    style={css(p.img)}
                  />
                </span>
                {p.flagImg ? (
                  <img
                    src={p.flagImg}
                    alt=""
                    width={p.flagSize}
                    height={p.flagSize}
                    style={{
                      position: 'absolute',
                      right: '0',
                      bottom: '0',
                      width: p.flagSize + 'px',
                      height: p.flagSize + 'px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                ) : null}
              </span>
              <span
                className="lb-pod-name"
                style={{
                  marginTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  maxWidth: '100%',
                  fontWeight: '700',
                  fontSize: '16px',
                  color: '#FFFFFF',
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                </span>
                {p.you ? (
                  <span
                    style={{
                      flex: '0 0 auto',
                      fontSize: '10.5px',
                      fontWeight: '800',
                      padding: '1px 7px',
                      borderRadius: '6px',
                      background: '#D6BBFF',
                      color: '#17092E',
                    }}
                  >
                    YOU
                  </span>
                ) : null}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  color: '#8E84AB',
                  maxWidth: '100%',
                }}
              >
                <img
                  src={p.gameImg}
                  alt=""
                  width="14"
                  height="14"
                  style={{ width: '14px', height: '14px', borderRadius: '4px' }}
                />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.rank}
                </span>
              </span>
              <span
                className="lb-pod-pts"
                style={{
                  marginTop: '4px',
                  fontFamily: DISPLAY,
                  fontSize: '22px',
                  fontWeight: '800',
                  letterSpacing: '-.02em',
                  color: p.medalColor,
                }}
              >
                {p.pointsLabel}
                <span
                  style={{
                    marginLeft: '4px',
                    fontFamily: 'Geist, system-ui, sans-serif',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#8E84AB',
                  }}
                >
                  pts
                </span>
              </span>
              <span style={css(p.plinth)}>
                {p.first ? (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: '0',
                      bottom: '0',
                      left: '0',
                      width: '30%',
                      background:
                        'linear-gradient(90deg, transparent, rgba(255, 231, 176, .14), transparent)',
                      animation: 'lbshine 4s ease-in-out infinite',
                    }}
                  />
                ) : null}
                <span style={css(p.numeral)}>{p.pos}</span>
                <span
                  style={{
                    marginTop: '4px',
                    fontSize: '11.5px',
                    color: '#A79DC4',
                  }}
                >
                  {p.ordersLabel} {p.orders === 1 ? 'order' : 'orders'} · ★{' '}
                  {p.ratingLabel}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <div
          style={{
            marginTop: '8px',
            borderTop: '1px solid rgba(196, 170, 255, .08)',
            paddingTop: '16px',
          }}
        >
          <div
            className="lb-row"
            aria-hidden="true"
            style={{ padding: '0 12px 8px' }}
          >
            <span style={{ ...head, textAlign: 'center' }}>#</span>
            <span style={head}>Teammate</span>
            <span
              className="lb-hide-sm"
              style={{ ...head, textAlign: 'right' }}
            >
              Orders
            </span>
            <span
              className="lb-hide-sm"
              style={{ ...head, textAlign: 'right' }}
            >
              5★ reviews
            </span>
            <span
              className="lb-hide-sm"
              style={{ ...head, textAlign: 'right' }}
            >
              Rating
            </span>
            <span style={{ ...head, textAlign: 'right' }}>Points</span>
          </div>
          <ol
            start="4"
            style={{
              listStyle: 'none',
              margin: '0',
              padding: '0',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {v.list.map((r, i) => Row(r, i))}
          </ol>
          {v.meHidden ? (
            <>
              <div
                aria-hidden="true"
                style={{
                  textAlign: 'center',
                  color: '#4A3B70',
                  letterSpacing: '.3em',
                  padding: '4px 0',
                }}
              >
                •••
              </div>
              <ol style={{ listStyle: 'none', margin: '0', padding: '0' }}>
                {Row(v.me, 1)}
              </ol>
            </>
          ) : null}
          {v.me ? (
            <p
              style={{
                margin: '14px 0 0',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13.5px',
                color: '#A79DC4',
                textAlign: 'center',
              }}
            >
              {v.meTop ? (
                <span style={{ color: '#FFD27A', fontWeight: '600' }}>
                  You’re #1 in {v.tabName}. Defend that crown.
                </span>
              ) : (
                <span>
                  You’re <b style={{ color: '#FFFFFF' }}>#{v.me.pos}</b> of{' '}
                  {v.count} · <b style={{ color: '#D6BBFF' }}>{v.meGap} pts</b>{' '}
                  to pass {v.meAhead}. Complete orders to climb.
                </span>
              )}
            </p>
          ) : (
            <p
              style={{
                margin: '14px 0 0',
                fontSize: '13.5px',
                color: '#8E84AB',
                textAlign: 'center',
              }}
            >
              {v.empty
                ? 'No completed ' +
                  (v.tabName === 'Global' ? '' : v.tabName + ' ') +
                  'orders ' +
                  v.periodName.toLowerCase() +
                  ' yet. Complete one to take the top spot.'
                : 'You’re not ranked in ' +
                  v.tabName +
                  ' ' +
                  v.periodName.toLowerCase() +
                  ' yet. Complete an order to get on the board.'}
            </p>
          )}
        </div>
      </section>
    );
  }
}
