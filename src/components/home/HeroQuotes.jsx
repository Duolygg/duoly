// Short customer quotes that drift in around the hero logo: left-side slots glide in from the
// left, right-side slots from the right, each holds, then fades out while the next one arrives.
// Real reviews come in through `items` (their first sentence, if short enough); until there are
// any, the hand-written SAMPLE_HERO_QUOTES are shown. Styles: globals.css (hq-*).
import React from 'react';
import { GAME } from '../../design-reference/lib/games';
import { flagSrc } from '../../design-reference/lib/countries';
import { maskName } from './Testimonials';

// Placeholder quotes (2026-11-03), shown until real reviews are passed in. Not real customers.
// [quote, reviewer first name, country, game id]
export const SAMPLE_HERO_QUOTES = [
  ['My Duoly teammate was a game changer.', 'Lukas', 'de', 'lol'],
  ['Matched in under a minute. Won four straight.', 'Sander', 'no', 'cs2'],
  ['Felt like duoing with a coach.', 'Daan', 'nl', 'val'],
  ['Finally out of Gold. No flame, just wins.', 'Emily', 'gb', 'lol'],
  ['Booked one game, stayed for five.', 'Jake', 'us', 'fn'],
  ['Best comms I have ever had in ranked.', 'Chloé', 'fr', 'val'],
  ['Zero toxicity. All dubs.', 'Liam', 'ca', 'apex'],
  ['Calm, clear and seriously cracked.', 'Sofia', 'se', 'mr'],
].map(([quote, name, country, game]) => ({ quote, name, country, game }));

// Where the quotes sit around the logo, alternating sides so one always comes from each way.
const SLOTS = ['l1', 'r1', 'l2', 'r2'];
// a new quote every STEP ms; each stays two steps (7.2s), so two are on screen, one per side
const STEP = 3600;

/** A real review's first sentence, when it is short enough to read in passing. */
export function heroQuote(text) {
  const first = String(text || '').match(/^.+?[.!?](?=\s|$)/);
  const q = (first ? first[0] : String(text || '')).trim();
  return q.length >= 18 && q.length <= 72 ? q : null;
}

export function heroQuotes(real = []) {
  const quotes = real
    .map((t) => ({ ...t, quote: heroQuote(t.quote) }))
    .filter((t) => t.quote);
  return quotes.length >= SLOTS.length ? quotes : SAMPLE_HERO_QUOTES;
}

export default function HeroQuotes({ items }) {
  const quotes = heroQuotes(items);
  // step n fills slot n % 4 with quote n % quotes; the slot's key changes so its animation replays
  const [n, setN] = React.useState(-1);
  React.useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((x) => x + 1), STEP);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hq" aria-hidden="true">
      {SLOTS.map((slot, i) => {
        // the latest step that landed in this slot
        const at =
          n - ((((n - i) % SLOTS.length) + SLOTS.length) % SLOTS.length);
        if (n < 0 || at < 0) return null;
        const t = quotes[at % quotes.length];
        const game = GAME[t.game];
        return (
          <figure key={slot + at} className={'hq-q hq-' + slot}>
            <blockquote>
              <span className="hq-mark">“</span>
              {t.quote}
              <span className="hq-mark">”</span>
            </blockquote>
            <figcaption>
              {t.country ? (
                <img src={flagSrc(t.country)} alt="" width="16" height="12" />
              ) : null}
              <span>{maskName(t.name)}</span>
              {game ? (
                <img
                  className="hq-game"
                  src={game.img}
                  alt=""
                  width="16"
                  height="16"
                />
              ) : null}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
