// Short customer quotes that travel edge to edge across the hero logo in two lanes: the top lane
// goes left to right, the bottom lane right to left. Each quote comes in from one edge, glides
// across and leaves at the other, and the other lane starts halfway, so two are on screen at a time.
// Real reviews come in through `items` (their first sentence, if short enough); until there are
// any, the hand-written SAMPLE_HERO_QUOTES are shown. Styles: globals.css (hq-*).
import HomeImage from './HomeImage';
import React from 'react';
import { GAME } from '../../design-reference/lib/games';
import { flagSrc } from '../../design-reference/lib/countries';
import { maskName } from './Testimonials';

// Placeholder quotes (2026-11-03), shown until real reviews are passed in. Not real customers.
// Every one names Duoly, and neighbouring quotes are different games.
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
    'Booked a Duoly social session just to chill. Best night in weeks.',
    'Mia',
    9,
    'at',
    'social',
  ],
  ['Duoly found me a duo before my queue even popped.', 'Daan', 4, 'nl', 'cs2'],
  ['Opening Duoly before ranked is a ritual now.', 'Jake', 8, 'us', 'fn'],
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
  [
    'Finally hit Diamond with a Duoly duo calling the rotates.',
    'Mateo',
    10,
    'es',
    'cod',
  ],
  [
    'Best money I have spent on gaming. Duoly just works.',
    'Chloé',
    7,
    'fr',
    'ow',
  ],
  ['Duoly made solo queue feel like a team game.', 'Sofia', 2, 'se', 'r6'],
  [
    'Came for one Duoly game, stayed the whole evening.',
    'Noah',
    1,
    'ie',
    'social',
  ],
  [
    'My Duoly teammate taught me more in an hour than a month of VODs.',
    'Jonas',
    3,
    'dk',
    'val',
  ],
  ['Duoly got me out of Gold Nova in a weekend.', 'Kacper', 4, 'pl', 'cs2'],
  [
    'Duoly pairs you with people who actually talk. Huge.',
    'Ella',
    6,
    'fi',
    'mr',
  ],
  ['Champ in Rocket League thanks to my Duoly duo.', 'Tom', 5, 'au', 'rl'],
  ['Duoly support sorted my booking in two minutes.', 'Giulia', 7, 'it', 'lol'],
  ['Hot drops with a Duoly duo hit different.', 'Lucas', 8, 'br', 'fn'],
  [
    'Duoly is my go-to for chill late-night games.',
    'Hannah',
    2,
    'ch',
    'social',
  ],
  ['Top 4 every game with my Duoly coach next to me.', 'Elias', 9, 'be', 'tft'],
  [
    'Duoly teammates are friendlier than my actual friends.',
    'Ryan',
    10,
    'us',
    'apex',
  ],
  [
    'From Silver to Plat with Duoly. No toxicity, just wins.',
    'Inês',
    1,
    'pt',
    'ow',
  ],
  [
    'Extraction runs are way less scary with a Duoly duo.',
    'Felix',
    3,
    'de',
    'arc',
  ],
  ['Duoly made Siege fun again for me.', 'Oscar', 4, 'gb', 'r6'],
  [
    'Booked Duoly for one match, now it is every Friday.',
    'Lena',
    6,
    'nl',
    'val',
  ],
].map(([quote, name, avatar, country, game]) => ({
  quote,
  name,
  avatar: '/assets/avatars/avatar-' + avatar + '.png',
  country,
  game,
  stars: 5,
}));

// top lane drifts left to right, bottom lane right to left; lane i shows quotes i, i + 2, i + 4…
const LANES = ['a', 'b'];
// one crossing (globals.css: hq-q, 12s)
const CROSS = 12000;
// a card that ends up to this late still keeps its slot (it starts a few px in, under the fade)
const SLACK = 400;
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

// the clock CSS animations run on
const now = () =>
  typeof document !== 'undefined' && document.timeline
    ? document.timeline.currentTime
    : performance.now();

export default function HeroQuotes({ items }) {
  const quotes = heroQuotes(items);
  // The quote each lane is showing, and how long its card waits off-screen before it sets off.
  // A lane moves on only when its card's crossing has ended, so a card is never swapped
  // mid-screen, even when timers are throttled in a background tab or the page comes back from
  // the back/forward cache. The new key replays the animation.
  const [lanes, setLanes] = React.useState(() =>
    LANES.map((_, i) => ({ at: i, wait: i * (CROSS / 2) })),
  );
  // when lane a's first crossing started (document timeline ms); lane i sets off at
  // start + i * CROSS / 2 + k * CROSS, so the lanes stay half a crossing apart
  const start = React.useRef(null);
  const first = React.useRef(null);
  React.useEffect(() => {
    const anim = first.current?.getAnimations?.()[0];
    start.current = anim?.startTime ?? now();
  }, []);

  const next = (i) => (e) => {
    if (e.target !== e.currentTarget) return;
    // a crossing that ended while the page was hidden is only noticed when it is shown again;
    // the next card then waits for the lane's next slot instead of setting off in step with
    // the other lane
    const offset = (start.current ?? now()) + (i * CROSS) / 2;
    const k = Math.max(1, Math.ceil((now() - offset - SLACK) / CROSS));
    const wait = offset + k * CROSS - now();
    setLanes((cur) =>
      cur.map((l, j) => (j === i ? { at: l.at + LANES.length, wait } : l)),
    );
  };

  return (
    <div data-private-block="" className="hq" aria-hidden="true">
      {LANES.map((lane, i) => {
        const { at, wait } = lanes[i];
        const t = quotes[at % quotes.length];
        const game = GAME[t.game];
        return (
          <figure
            key={lane + at}
            ref={at === 0 ? first : undefined}
            className={'hq-q hq-' + lane}
            style={
              wait ? { animationDelay: Math.round(wait) + 'ms' } : undefined
            }
            onAnimationEnd={next(i)}
          >
            {t.avatar ? (
              <HomeImage
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
                    <span>{game.name}</span>
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
