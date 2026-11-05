import React from 'react';
import { track } from '../../client/analytics/track';
import { GAME } from '../../design-reference/lib/games';
import { flagSrc } from '../../design-reference/lib/countries';
import FavoriteHeart from './FavoriteHeart';

// The dashboard's Favorites card (migration 20261106150000_customer_favorites.sql): the teammates
// the customer hearted, online first. Rebook opens checkout on the game they last played together;
// a favorite sees the order before teammates who aren't (the queue rule in that migration).

const STATUS = {
  online: { label: 'Online now', color: '#5EEAA8', dot: '#5EEAA8' },
  busy: { label: 'In a game right now', color: '#FFD27A', dot: '#FFD27A' },
  offline: { label: 'Offline', color: '#8E84AB', dot: '#6A6086' },
};

/** Where Rebook goes: checkout on the game they last played together. */
export function rebookHref(fav) {
  return '/?rebook=' + encodeURIComponent(fav.game) + '#checkout';
}

export default function Favorites({ favs, busy, err, onToggle, card, h2 }) {
  const list = favs ? favs.favorites : [];
  const online = list.filter((f) => f.status === 'online').length;
  return (
    <section
      id="favorites"
      aria-labelledby="favs-h"
      style={{ ...card, padding: '24px', scrollMarginTop: '24px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        <h2 id="favs-h" style={h2}>
          Favorites
        </h2>
        {online ? (
          <span style={{ fontSize: '13px', color: '#5EEAA8' }}>
            {online} online
          </span>
        ) : null}
      </div>
      {list.length ? (
        <ul
          style={{
            listStyle: 'none',
            margin: '0',
            padding: '0',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {list.map((f) => {
            const st = STATUS[f.status] || STATUS.offline;
            const first = String(f.name).split(' ')[0];
            const game = GAME[f.game] || { name: f.game, img: '' };
            return (
              <li
                key={f.handle}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '18px',
                  background: '#090414',
                  border: '1px solid rgba(196, 170, 255, .08)',
                }}
              >
                <span
                  style={{
                    position: 'relative',
                    flex: '0 0 auto',
                    width: '46px',
                    height: '46px',
                  }}
                >
                  <img
                    src={f.image || '/assets/avatars/avatar-3.png'}
                    alt=""
                    width="46"
                    height="46"
                    referrerPolicy="no-referrer"
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      display: 'block',
                      objectFit: 'cover',
                    }}
                  />
                  {f.country ? (
                    <img
                      src={flagSrc(f.country)}
                      alt=""
                      width="16"
                      height="16"
                      style={{
                        position: 'absolute',
                        right: '-2px',
                        bottom: '-2px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        boxShadow: '0 0 0 2px #090414',
                      }}
                    />
                  ) : null}
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: '-1px',
                      bottom: '-1px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      boxShadow: '0 0 0 3px #090414',
                      background: st.dot,
                    }}
                  />
                </span>
                <span
                  style={{
                    flex: '1 1 140px',
                    minWidth: '0',
                    display: 'flex',
                    flexDirection: 'column',
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
                    }}
                  >
                    {first}
                    {game.img ? (
                      <img
                        src={game.img}
                        alt={game.name}
                        title={game.name}
                        width="16"
                        height="16"
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                        }}
                      />
                    ) : null}
                  </span>
                  <span style={{ fontSize: '12.5px', color: st.color }}>
                    {st.label}
                  </span>
                  <span style={{ fontSize: '12px', color: '#8E84AB' }}>
                    {f.orders} {f.orders === 1 ? 'game' : 'games'} together
                  </span>
                </span>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginLeft: 'auto',
                  }}
                >
                  <a
                    href={rebookHref(f)}
                    onClick={() =>
                      track('rebook_clicked', { source: 'favorites' })
                    }
                    aria-label={'Rebook ' + first}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      minHeight: '44px',
                      padding: '0 14px',
                      borderRadius: '12px',
                      background:
                        f.status === 'online' ? '#D6BBFF' : 'transparent',
                      border:
                        '1px solid ' +
                        (f.status === 'online'
                          ? '#D6BBFF'
                          : 'rgba(196, 170, 255, .2)'),
                      color: f.status === 'online' ? '#120B22' : '#F3EEFF',
                      fontSize: '14px',
                      fontWeight: '700',
                      textDecoration: 'none',
                    }}
                  >
                    Rebook
                  </a>
                  <FavoriteHeart
                    compact
                    name={first}
                    on
                    busy={busy === f.handle}
                    onToggle={() => onToggle(f.handle, false)}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p style={{ margin: '0', fontSize: '13.5px', color: '#8E84AB' }}>
          {favs
            ? 'Tap the heart on a teammate after your game, or in Your teammates, and they show up here with who’s online.'
            : 'Loading your favorites…'}
        </p>
      )}
      {err ? (
        <p
          role="alert"
          style={{ margin: '10px 0 0', fontSize: '13.5px', color: '#F0A6FF' }}
        >
          {err}
        </p>
      ) : null}
      {list.length ? (
        <p style={{ margin: '12px 0 0', fontSize: '12.5px', color: '#8E84AB' }}>
          Your favorites see your orders first, as soon as you queue.
        </p>
      ) : null}
    </section>
  );
}
