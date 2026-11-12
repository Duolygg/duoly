// "Meet your teammates": real teammates (public.home_teammates) drifting right to left on cards
// between "Pick a mode" and "Check out". People who play the picked game come first; each card
// shows only that teammate's own games. Pauses while hovered. Without teammates it falls back to the live online line.
// A card whose teammate has a public profile (HeroTeammate.slug) opens it; the rest are unchanged.
// Styles: globals.css (tc-*), link states in carousel-links.css (imported by LiveHome.tsx).
import BundledImage from '../shared/BundledImage';
import React from 'react';

// One loop holds at least this many cards (5 × 288px is wider than the 1240px page), so a short
// list repeats and the strip never shows a gap; the track holds two loops and slides by one.
const LOOP_CARDS = 5;
// pixels per second, the same calm pace whatever the number of cards
const SPEED = 32;
const CARD_PX = 288;

function Card({ t, hidden = false }) {
  const card = (
    <div
      className={
        'tc-card' + (t.gg ? ' tc-gg' : '') + (t.plays ? ' tc-plays' : '')
      }
    >
      <div className="tc-head">
        <span className="tc-avatar">
          <BundledImage
            src={t.image}
            alt=""
            width="52"
            height="52"
            loading="lazy"
            decoding="async"
          />
          {t.online ? <span className="tc-dot" /> : null}
        </span>
        <span className="tc-who">
          <strong>{t.name}</strong>
          <span className={t.online ? 'tc-on' : ''}>
            {t.online ? 'Online now' : t.sessionsText}
          </span>
        </span>
        {t.gg ? <span className="tc-pill">Gamer Girl</span> : null}
      </div>
      <div className="tc-foot">
        <span className="tc-games">
          {t.icons.map((g) => (
            <BundledImage
              key={g.id}
              src={g.img}
              alt={g.name}
              title={g.name}
              width="26"
              height="26"
              loading="lazy"
              decoding="async"
            />
          ))}
        </span>
        {t.stars ? (
          <span className="tc-stars">
            {t.stars}
            <span>({t.reviews})</span>
          </span>
        ) : (
          <span className="tc-new">No reviews yet</span>
        )}
      </div>
    </div>
  );
  if (!t.slug) return card;
  // The name and the games are already in the card, so the link says what following it does
  // instead of reading the whole card out a second time. In the copied loops below the card is
  // inside an aria-hidden wrapper, where a focusable element would be a tab stop with no
  // accessible name: there the same link is taken out of the tab order.
  return (
    <a
      className="tc-link"
      href={'/teammates/' + t.slug}
      aria-label={t.name + ', view profile'}
      tabIndex={hidden ? -1 : undefined}
    >
      {card}
    </a>
  );
}

export default function TeammateCarousel({ crew, game, onlineText }) {
  const online = Number(game.online || 0);
  const perLoop = crew.length
    ? Math.max(1, Math.ceil(LOOP_CARDS / crew.length))
    : 0;
  const duration = Math.round((crew.length * perLoop * CARD_PX) / SPEED) + 's';
  // One card with a profile means /teammates has at least that teammate on it, so the heading can
  // lead there. It is the signal the page already holds: no second read, no extra request.
  const directory = crew.some((t) => t.slug);
  return (
    <section data-private-block="" className="tc" aria-labelledby="tc-h">
      <div className="tc-top">
        <h2 id="tc-h" className="tc-title">
          {directory ? (
            <a href="/teammates">Meet your teammates</a>
          ) : (
            'Meet your teammates'
          )}
        </h2>
        {game.online !== '' ? (
          <span className={'tc-live' + (online ? ' is-on' : '')}>
            <span className="tc-live-dot" />
            {online
              ? online + ' online for ' + game.name
              : 'Nobody online for ' + game.name + ' right now'}
          </span>
        ) : null}
      </div>
      <p className="tc-sub">
        The first free teammate takes your order. Re-roll twice if the vibe is
        off.
      </p>
      {crew.length ? (
        <div className="tc-row">
          <div className="tc-track" style={{ animationDuration: duration }}>
            <div className="tc-set" role="list" aria-label="Our teammates">
              {crew.map((t, i) => (
                <div role="listitem" key={i}>
                  <Card t={t} />
                </div>
              ))}
            </div>
            {/* the copies that fill the loop; screen readers skip them */}
            {Array.from({ length: perLoop * 2 - 1 }, (_, n) => (
              <div className="tc-set" aria-hidden="true" key={n}>
                {crew.map((t, i) => (
                  <Card t={t} hidden key={i} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="tc-empty">{onlineText}</p>
      )}
    </section>
  );
}
