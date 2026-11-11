// "What players say": the average rating, then two rows of review cards drifting in opposite
// directions, the top row to the left and the bottom row to the right. A row pauses while
// hovered so a card can be read. Each card shows the reviewer's masked name (L***s), avatar and country.
// Real reviews come in through `items`; until there are any, the hand-written SAMPLE_TESTIMONIALS are
// shown. A phone drifts through a sample of them instead of all of them (PHONE_ROW_CARDS); the
// score and the review count above the rows are always the whole set. Styles: globals.css (rv-*).
import BundledImage from '../shared/BundledImage';
import React from 'react';
import { GAME } from '../../design-reference/lib/games';
import { COUNTRY_NAME, flagSrc } from '../../design-reference/lib/countries';
import { SAMPLE_TESTIMONIALS } from './sampleTestimonials';

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

// How many reviews a row drifts through on a phone. The hundred sample reviews make 200 cards,
// about 4,900 of the homepage's 6,200 elements and 600 of its 745 images, and a phone shows
// barely more than one card at a time, so a phone gets a sample: 6 per row, which the loop
// copies into 12, 24 cards on the page. Six is the smallest number that is still a full loop
// (LOOP_CARDS), so the marquee keeps exactly the markup it has on a desktop: a phone card with
// its gap is 354px wide (globals.css, 300 + 36 padding + 2 border + 16 gap), so one loop is
// 2,124px, wider than any phone we design for, and the drift never shows a gap.
export const PHONE_ROW_CARDS = LOOP_CARDS;
// the width this component's CSS calls a phone (globals.css .rv-card, offscreen.css .rv-row)
const PHONE_WIDTH = '(max-width: 560px)';

/**
 * True until a browser says otherwise.
 *
 * The server cannot know the viewport, so it has to guess, and it guesses phone: the reviews
 * sit 12,100px down a phone homepage, past fourteen screens, which is exactly where the
 * cheapest markup belongs. Anything wider swaps the full set in from its first client render,
 * thousands of pixels before the rows can be scrolled to, so nothing visible moves. A row's
 * height comes from its cards and not from how many of them it holds, so the swap moves nothing
 * below the strip either; on a phone offscreen.css pins that height, so sampling cannot change
 * it and its contain-intrinsic-size stays exact.
 */
function usePhoneSample() {
  const [phone, setPhone] = React.useState(true);
  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setPhone(false);
      return undefined;
    }
    const query = window.matchMedia(PHONE_WIDTH);
    const sync = () => setPhone(query.matches);
    sync();
    // a tablet turned on its side crosses the breakpoint without a reload
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return phone;
}

function Stars({ n }) {
  return (
    <span className="rv-stars" role="img" aria-label={n + ' out of 5 stars'}>
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
          <BundledImage
            className="rv-game"
            src={game.img}
            alt={game.name}
            title={game.name}
            width="26"
            height="26"
            loading="lazy"
            decoding="async"
          />
        ) : null}
      </div>
      <blockquote className="rv-quote">{t.quote}</blockquote>
      <figcaption className="rv-by">
        <BundledImage
          className="rv-avatar"
          src={t.avatar}
          alt=""
          width="42"
          height="42"
          loading="lazy"
          decoding="async"
        />
        <span className="rv-who">
          <strong>{maskName(t.name)}</strong>
          {country ? (
            <span className="rv-from">
              <BundledImage
                src={flagSrc(t.country)}
                alt=""
                width="18"
                height="13"
                loading="lazy"
                decoding="async"
              />
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
  const items = real.length ? real : SAMPLE_TESTIMONIALS;
  const phone = usePhoneSample();
  // The score and the count stay the whole truth: every review still counts towards both, on
  // every screen. A phone drifts through a sample of them, never a flattering pick of them.
  const avg = items.reduce((sum, t) => sum + t.stars, 0) / items.length;
  // alternate the reviews between the rows so neither row is all one game
  const rowA = items.filter((_, i) => i % 2 === 0);
  const rowB = items.filter((_, i) => i % 2 === 1);
  // the sample is the front of each row in the order the reviews already arrive in, so it is
  // the same sample on every phone and every visit, and no review is picked for its stars
  const shown = (cards) => (phone ? cards.slice(0, PHONE_ROW_CARDS) : cards);
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
      <Row cards={shown(rowA)} label="Reviews" />
      {rowB.length ? (
        <Row cards={shown(rowB)} label="More reviews" reverse />
      ) : null}
    </section>
  );
}
