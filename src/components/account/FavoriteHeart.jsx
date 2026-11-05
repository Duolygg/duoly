import React from 'react';

// The heart that favorites a teammate (migration 20261106150000_customer_favorites.sql), in the
// order room (teammate card and review thanks) and on the dashboard.
const PINK = '#F0A6FF',
  MUTED = '#A79DC4';

export const HEART =
  'M12 20.7s-7.6-4.6-9.6-9.3C1 8.2 2.9 4.6 6.4 4.3c2.1-.2 3.9 1 5.6 3 1.7-2 3.5-3.2 5.6-3 3.5.3 5.4 3.9 4 7.1-2 4.7-9.6 9.3-9.6 9.3z';

/**
 * Favorite the teammate (20261106150000). compact: the icon alone, for the teammate card; otherwise
 * a labelled button, for the review screen.
 */
export default function FavoriteHeart({
  name,
  on,
  busy,
  onToggle,
  compact = false,
}) {
  const label = on
    ? 'Remove ' + name + ' from your favorites'
    : 'Add ' + name + ' to your favorites';
  return (
    <button
      type="button"
      className="q-fav"
      aria-pressed={on ? 'true' : 'false'}
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      disabled={busy}
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        flex: '0 0 auto',
        minWidth: '44px',
        minHeight: '44px',
        marginLeft: compact ? 'auto' : '0',
        padding: compact ? '0' : '0 18px',
        borderRadius: compact ? '50%' : '14px',
        border:
          '1px solid ' +
          (on ? 'rgba(240, 166, 255, .45)' : 'rgba(196, 170, 255, .2)'),
        background: on ? 'rgba(240, 166, 255, .12)' : 'transparent',
        color: on ? PINK : '#F3EEFF',
        fontSize: '14.5px',
        fontWeight: '700',
        cursor: busy ? 'progress' : 'pointer',
        transition: 'background .15s, border-color .15s',
      }}
    >
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        style={{ display: 'block' }}
      >
        <path
          d={HEART}
          fill={on ? PINK : 'none'}
          stroke={on ? PINK : MUTED}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {compact ? null : (
        <span>{on ? name + ' is in your favorites' : 'Favorite ' + name}</span>
      )}
    </button>
  );
}

/**
 * Under the review thanks: "Want to play with Alex again?" and the labelled heart. fav is the
 * heart's { on, busy, err, onToggle }; rating 4 or 5 adds the question.
 */
export function FavoriteAsk({ name, rating, fav }) {
  return (
    <div className="q-fav-ask" style={{ marginTop: '16px' }}>
      {!fav.on ? (
        <p style={{ margin: '0 0 10px', fontSize: '13.5px', color: MUTED }}>
          {rating >= 4 ? 'Want to play with ' + name + ' again? ' : ''}
          Favorites see your orders first, and show on your dashboard with who’s
          online.
        </p>
      ) : null}
      <FavoriteHeart
        name={name}
        on={fav.on}
        busy={fav.busy}
        onToggle={fav.onToggle}
      />
      {fav.err ? (
        <p
          role="alert"
          style={{ margin: '8px 0 0', color: PINK, fontSize: '13.5px' }}
        >
          {fav.err}
        </p>
      ) : null}
    </div>
  );
}
