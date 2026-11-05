// "What players say": the average rating, then two rows of review cards drifting in opposite
// directions, the top row to the left and the bottom row to the right. A row pauses while
// hovered so a card can be read. Each card shows the reviewer's masked name (L***s), avatar and country.
// Real reviews come in through `items`; the section stays hidden until they are
// shown. Styles: globals.css (rv-*).
import React from 'react';
import { GAME } from '../../design-reference/lib/games';
import { COUNTRY_NAME, flagSrc } from '../../design-reference/lib/countries';

const STARS = [1, 2, 3, 4, 5];

/** Reviewers stay anonymous: first and last letter, a star for each one between ("Lukas" → "L***s"). */
export function maskName(name) {
  const letters = Array.from(String(name || '').trim());
  if (letters.length <= 2) return (letters[0] || '') + '*';
  return (
    letters[0] + '*'.repeat(letters.length - 2) + letters[letters.length - 1]
  );
}
// One loop of a row holds at least this many cards (6 × 446px is wider than any screen we design
// for), so a short row repeats instead of showing a gap; the track holds two loops.
const LOOP_CARDS = 6;
// a card is 380px wide plus 48px padding, 2px border and the 16px gap
const CARD_PX = 446;
// pixels per second: slow enough to read while it moves
const SPEED = 26;

function Stars({ n }) {
  return (
    <span className="rv-stars" aria-label={n + ' out of 5 stars'}>
      {STARS.map((i) => (
        <svg
          key={i}
          width="15"
          height="15"
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={i <= n ? 'is-on' : ''}
        >
          <path d="M12 2.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.7l7.1-.6z" />
        </svg>
      ))}
    </span>
  );
}

function Card({ t }) {
  const game = GAME[t.game];
  const country = COUNTRY_NAME[t.country] || '';
  return (
    <figure className="rv-card">
      <div className="rv-card-top">
        <Stars n={t.stars} />
        {game ? (
          <img
            className="rv-game"
            src={game.img}
            alt={game.name}
            title={game.name}
            width="26"
            height="26"
          />
        ) : null}
      </div>
      <blockquote className="rv-quote">{t.quote}</blockquote>
      <figcaption className="rv-by">
        <img
          className="rv-avatar"
          src={t.avatar}
          alt=""
          width="42"
          height="42"
        />
        <span className="rv-who">
          <strong>{maskName(t.name)}</strong>
          {country ? (
            <span className="rv-from">
              <img src={flagSrc(t.country)} alt="" width="18" height="13" />
              {country}
            </span>
          ) : null}
        </span>
        <span className="rv-with">
          {t.game === 'social'
            ? 'Social session'
            : 'Played ' + (game ? game.name : 'a session')}
          <br />
          with <b>{t.teammate}</b>
        </span>
      </figcaption>
    </figure>
  );
}

function Row({ cards, label, reverse }) {
  const perLoop = Math.max(1, Math.ceil(LOOP_CARDS / cards.length));
  const duration = Math.round((cards.length * perLoop * CARD_PX) / SPEED) + 's';
  return (
    <div className="rv-row">
      <div
        className={'rv-track' + (reverse ? ' rv-rev' : '')}
        style={{ animationDuration: duration }}
      >
        <div className="rv-set" role="list" aria-label={label}>
          {cards.map((t, i) => (
            <div role="listitem" key={i}>
              <Card t={t} />
            </div>
          ))}
        </div>
        {/* the copies that fill the loop; screen readers skip them */}
        {Array.from({ length: perLoop * 2 - 1 }, (_, n) => (
          <div className="rv-set" aria-hidden="true" key={n}>
            {cards.map((t, i) => (
              <Card t={t} key={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Testimonials({ items: real = [] }) {
  const items = real;
  if (!items.length) return null;
  const avg = items.reduce((sum, t) => sum + t.stars, 0) / items.length;
  // alternate the reviews between the rows so neither row is all one game
  const rowA = items.filter((_, i) => i % 2 === 0);
  const rowB = items.filter((_, i) => i % 2 === 1);
  return (
    <section className="rv" aria-labelledby="rv-h">
      <div className="rv-inner">
        <div className="rv-head">
          <div>
            <div className="rv-eyebrow">Reviews</div>
            <h2 id="rv-h" className="rv-title">
              What players say after the match
            </h2>
          </div>
          <div className="rv-score">
            <strong>{avg.toFixed(1)}</strong>
            <span>
              <Stars n={Math.round(avg)} />
              <span className="rv-count">
                from {items.length} review{items.length === 1 ? '' : 's'}
              </span>
            </span>
          </div>
        </div>
      </div>
      <Row cards={rowA} label="Reviews" />
      {rowB.length ? <Row cards={rowB} label="More reviews" reverse /> : null}
    </section>
  );
}
