// Short customer quotes that travel edge to edge across the hero logo in two lanes: the top lane
// goes left to right, the bottom lane right to left. Each quote comes in from one edge, glides
// across and leaves at the other, and the other lane starts halfway, so two are on screen at a time.
// Real reviews come in through `items` (their first sentence, if short enough); until there are
// any, the hand-written SAMPLE_HERO_QUOTES are shown. Styles: globals.css (hq-*).
import React from 'react';
import { GAME } from '../../design-reference/lib/games';
import { flagSrc } from '../../design-reference/lib/countries';
import { maskName } from './Testimonials';

// Placeholder quotes (2026-11-03), shown until real reviews are passed in. Not real customers.
// [quote, reviewer first name, avatar (1-10), country, game id]
export const SAMPLE_HERO_QUOTES = [
  ['My Duoly teammate was a game changer.', 'Lukas', 1, 'de', 'lol'],
  [
    'Tried three duo sites. Duoly is the only one I kept.',
    'Sander',
    3,
    'no',
    'val',
  ],
  [
    'Duoly turned my worst ranked season into my best.',
    'Emily',
    6,
    'gb',
    'lol',
  ],
  [
    'Every Duoly teammate I have played with has been elite.',
    'Liam',
    5,
    'ca',
    'apex',
  ],
  ['Duoly found me a duo before my queue even popped.', 'Daan', 4, 'nl', 'cs2'],
  ['Opening Duoly before ranked is a ritual now.', 'Jake', 8, 'us', 'fn'],
  [
    'Best money I have spent on gaming. Duoly just works.',
    'Chloé',
    7,
    'fr',
    'ow',
  ],
  ['Duoly made solo queue feel like a team game.', 'Sofia', 2, 'se', 'r6'],
].map(([quote, name, avatar, country, game]) => ({
  quote,
  name,
  avatar: '/assets/avatars/avatar-' + avatar + '.png',
  country,
  game,
  stars: 5,
}));

// top lane drifts left to right, bottom lane right to left
const LANES = ['a', 'b'];
// a new quote every STEP ms, alternating lanes; each crossing takes two steps (globals.css: 12s)
const STEP = 6000;
const STARS = [1, 2, 3, 4, 5];

/** A real review's first sentence, when it is short enough to read while it drifts by. */
export function heroQuote(text) {
  const first = String(text || '').match(/^.+?[.!?](?=\s|$)/);
  const q = (first ? first[0] : String(text || '')).trim();
  return q.length >= 18 && q.length <= 72 ? q : null;
}

export function heroQuotes(real = []) {
  const quotes = real
    .map((t) => ({ ...t, quote: heroQuote(t.quote) }))
    .filter((t) => t.quote);
  return quotes.length >= 4 ? quotes : SAMPLE_HERO_QUOTES;
}

export default function HeroQuotes({ items }) {
  const quotes = heroQuotes(items);
  // step n starts quote n in lane n % 2; the lane's key changes so its animation replays
  const [n, setN] = React.useState(-1);
  React.useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((x) => x + 1), STEP);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hq" aria-hidden="true">
      {LANES.map((lane, i) => {
        // the latest step that started in this lane
        const at = n - ((((n - i) % 2) + 2) % 2);
        if (n < 0 || at < 0) return null;
        const t = quotes[at % quotes.length];
        const game = GAME[t.game];
        return (
          <figure key={lane + at} className={'hq-q hq-' + lane}>
            {t.avatar ? (
              <img
                className="hq-avatar"
                src={t.avatar}
                alt=""
                width="40"
                height="40"
              />
            ) : null}
            <div className="hq-body">
              <span className="hq-stars">
                {STARS.map((s) => (
                  <svg
                    key={s}
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    className={s <= (t.stars || 5) ? 'is-on' : ''}
                  >
                    <path d="M12 2.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.7l7.1-.6z" />
                  </svg>
                ))}
              </span>
              <blockquote>“{t.quote}”</blockquote>
              <figcaption>
                <span>{maskName(t.name)}</span>
                {t.country ? (
                  <img src={flagSrc(t.country)} alt="" width="16" height="12" />
                ) : null}
                {game ? (
                  <>
                    <span className="hq-dot" />
                    <img
                      className="hq-game"
                      src={game.img}
                      alt=""
                      width="14"
                      height="14"
                    />
                    <span>{game.short || game.name}</span>
                  </>
                ) : null}
              </figcaption>
            </div>
          </figure>
        );
      })}
    </div>
  );
}
