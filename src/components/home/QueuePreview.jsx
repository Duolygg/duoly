// "Watch your order, live": the real order room inside a browser window, playing one scripted order
// from start to finish: searching (faces cycle, the timer runs fast), a teammate accepts, the chat
// opens and they talk, then the order is done and reviewed. Every card is the order room's own
// component (account/MatchStage.jsx: stage, queue timer, steps, order card, chat, "You’re covered"
// panel, review thanks) in the room's own two-column layout; titles, sublines and buttons copy the
// room's wording.
// It is a picture: nothing in it can be clicked or focused. Runs only while on screen and starts
// from the search each time it comes into view. Styles: globals.css (qp-*).
import React from 'react';
import MatchStage, {
  ChatPanel,
  CoveredPanel,
  OrderCard,
  QueueSteps,
  QueueTimer,
  ReviewThanks,
} from '../account/MatchStage';
import { GAME, IGN_LABEL } from '../../design-reference/lib/games';
import { servicesFor } from '../../design-reference/lib/catalog';
import { rankPrice } from '../../design-reference/lib/ranks';

// a Pokémon Unite Duo Pro order (lib/catalog.js: 5.99 a game, Master teammate; Veteran is the
// base-price rank, 3 games take 10% off) on the Asia servers, with itskeikooo from Japan
const GAME_ID = 'pu';
// priced like the homepage prices the same order: the per-game price for the rank, converted to the
// selected currency (Home.jsx conv), times the games, minus the 3-game discount (Home.jsx disc[3])
const SERVICE = 'duo2';
const RANK = 'Veteran';
const THREE_GAMES_OFF = 0.1;
const BASE_EUR = rankPrice(
  GAME_ID,
  SERVICE,
  servicesFor(GAME_ID).modes.find((m) => m.id === SERVICE).price,
  RANK,
);
const ORDER = {
  ref: 'DL-48321',
  title: 'Duo Pro',
  games: 3,
  region: 'Asia',
  from: RANK,
  ign: 'Alex',
  voice: true,
};
const USER = { name: 'Alex', image: '/assets/avatars/avatar-1.png' };
const MATE = {
  name: 'itskeikooo',
  image: '/assets/avatars/itskeikooo.jpg',
  country: 'jp',
  bio: 'Master in Unite. Calm comms and rotations planned around Zapdos.',
  languages: ['Japanese', 'English'],
};
const DISPLAY = "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif";

// Paced for someone seeing the order room for the first time: about 32 s a loop.
// the search: 33 ticks of 250 ms (about 8 s) take the timer to 1:23
const TICK_MS = 250;
const TICK_WAIT_MS = 2600;
const SEARCH_TICKS = 33;
const REROLL_LEFT_MS = 271000; // the re-roll window shows 4:31 left right after the match
const CYCLE_MS = 900; // how often the order room swaps the searching face
// after the match, in ms: [when, what]
const AFTER_MATCH = [
  [2500, { typing: true }],
  [
    4500,
    {
      typing: false,
      say: ['teammate', 'Hey! Accepted 🙌 Sending the invite to Alex now.'],
    },
  ],
  [7000, { say: ['customer', 'Ready when you are!'] }],
  [8500, { typing: true }],
  [
    10500,
    {
      typing: false,
      say: ['teammate', 'Invite sent, see you in the lobby. GL HF!'],
    },
  ],
  [14000, { phase: 'done' }],
  // GG holds for 10 s: time to read the review, the steps and the covered panel
  [24000, { restart: true }],
];

export default class QueuePreview extends React.Component {
  constructor(props) {
    super(props);
    // `frozen` pins one moment of the script (tests); the homepage passes nothing and it plays
    this.state = { ...this.fresh(), ...(props.frozen || {}) };
    this._root = React.createRef();
    this._timers = [];
  }
  fresh() {
    return {
      phase: 'searching',
      waited: 0,
      cycle: 0,
      burst: 0,
      chat: [],
      typing: false,
      matchedAt: 0, // when the teammate accepted: the re-roll window counts down from here
      now: 0,
    };
  }
  componentDidMount() {
    if (this.props.frozen) return;
    const el = this._root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return this.play();
    this._io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? this.play() : this.stop()),
      { threshold: 0.25 },
    );
    this._io.observe(el);
  }
  componentWillUnmount() {
    this.stop();
    if (this._io) this._io.disconnect();
  }
  play() {
    this.stop();
    this.setState(this.fresh());
    let ticks = 0;
    this._cycle = setInterval(
      () => this.setState((s) => ({ cycle: s.cycle + 1 })),
      CYCLE_MS,
    );
    this._tick = setInterval(() => {
      ticks++;
      if (ticks < SEARCH_TICKS)
        return this.setState((s) => ({ waited: s.waited + TICK_WAIT_MS }));
      clearInterval(this._tick);
      clearInterval(this._cycle);
      const at = Date.now();
      this.setState({ phase: 'matched', burst: at, matchedAt: at, now: at });
      // the covered panel's re-roll countdown ticks like the order room's clock
      this._now = setInterval(() => this.setState({ now: Date.now() }), 1000);
      this.afterMatch();
    }, TICK_MS);
  }
  afterMatch() {
    for (const [at, step] of AFTER_MATCH)
      this._timers.push(
        setTimeout(() => {
          if (step.restart) return this.play();
          this.setState((s) => ({
            ...(step.phase ? { phase: step.phase } : {}),
            ...('typing' in step ? { typing: step.typing } : {}),
            ...(step.say
              ? {
                  chat: s.chat.concat({
                    id: 'p' + s.chat.length,
                    from: step.say[0],
                    text: step.say[1],
                    at: Date.now(),
                  }),
                }
              : {}),
          }));
        }, at),
      );
  }
  stop() {
    clearInterval(this._tick);
    clearInterval(this._cycle);
    clearInterval(this._now);
    this._timers.forEach(clearTimeout);
    this._timers = [];
  }
  render() {
    const { phase, waited, cycle, burst, chat, typing, matchedAt, now } =
      this.state;
    const game = GAME[GAME_ID];
    // Home passes the selected currency and its converter; on its own the preview shows euros
    const { cur = 'EUR', conv = (p) => p } = this.props;
    const sym = cur === 'USD' ? '$' : '€';
    const paid =
      Math.round(conv(BASE_EUR) * ORDER.games * (1 - THREE_GAMES_OFF) * 100) /
      100;
    const order = {
      ...ORDER,
      paid: { method: 'PayPal', total: paid, currency: cur },
    };
    const ignLabel = IGN_LABEL[GAME_ID] || 'in-game name';
    const searching = phase === 'searching';
    const done = phase === 'done';
    const mate = searching ? null : MATE;
    // [label, done, current], as the order room computes them
    const steps = [
      ['Paid', true, false],
      ['In queue', !searching, searching],
      ['Playing', done, phase === 'matched'],
      ['Done', done, false],
    ];
    const head = searching
      ? [
          'Finding your teammate',
          'Your order is live for rank-verified ' +
            game.name +
            ' teammates. We’ll show you who took it the second they accept.',
        ]
      : done
        ? ['GG!', 'Your 3 games with ' + MATE.name + ' are done. How was it?']
        : [
            MATE.name + ' is on it!',
            'They accepted your order and will invite ' +
              ORDER.ign +
              ' in-game. Keep ' +
              game.name +
              ' open.',
          ];
    const orderCard = (
      <OrderCard
        order={order}
        game={game}
        total={sym + paid.toFixed(2)}
        free={false}
        mate={mate}
        ignLabel={ignLabel}
      />
    );
    return (
      <div className="qp" ref={this._root}>
        <div className="qp-copy">
          <div className="qp-eyebrow">After you pay</div>
          <h3 className="qp-title">Watch your order, live.</h3>
          <p className="qp-text">
            Your order room shows everything as it happens: the search, who
            accepted, your chat with them, and the finish.
          </p>
        </div>
        <figure className="qp-win">
          <figcaption className="qp-sr">
            Preview of the order room: it searches for a teammate, shows who
            accepted, opens a chat with them and marks the order done.
          </figcaption>
          <div className="qp-bar" aria-hidden="true">
            <span className="qp-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="qp-url">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              duoly.gg/queue/{ORDER.ref}
            </span>
          </div>
          {/* the order room page itself (QueueRoom.jsx render), driven by the script above */}
          <div className="qp-body" aria-hidden="true" inert>
            <div className="qp-top">
              <img
                src="/assets/brand/logo-wordmark.webp"
                alt=""
                width="96"
                height="36"
              />
              <span className="qp-user">
                <img src={USER.image} alt="" width="30" height="30" />
                {USER.name}
              </span>
            </div>
            <div className="q-grid">
              <div className="qp-col">
                <div className="qp-card">
                  <MatchStage
                    phase={phase}
                    order={order}
                    game={game}
                    user={USER}
                    mate={mate}
                    cycle={cycle}
                    burst={burst}
                  />
                  <div className="qp-head" style={{ fontFamily: DISPLAY }}>
                    {head[0]}
                    {searching ? (
                      <span className="qp-dotsline">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            style={{ animationDelay: i * 0.2 + 's' }}
                          />
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <p className="qp-sub">{head[1]}</p>
                  {searching ? <QueueTimer waited={waited} /> : null}
                  {done ? (
                    <ReviewThanks name={MATE.name} rating={5} tip={null} />
                  ) : null}
                  {searching ? null : (
                    <div className="qp-btns">
                      {done ? (
                        <>
                          <span className="qp-btn is-primary">Queue again</span>
                          <span className="qp-btn">Go to my dashboard</span>
                        </>
                      ) : (
                        <>
                          <span className="qp-btn is-primary">
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                            </svg>
                            Message {MATE.name}
                          </span>
                          <span className="qp-btn">Dashboard</span>
                        </>
                      )}
                    </div>
                  )}
                  <QueueSteps steps={steps} />
                </div>
                {searching ? null : <div className="qp-order">{orderCard}</div>}
              </div>
              <div className="qp-col">
                {searching ? (
                  <div className="qp-order">{orderCard}</div>
                ) : (
                  <>
                    <ChatPanel
                      mate={MATE}
                      order={order}
                      phase={phase}
                      ignLabel={ignLabel}
                      chat={chat}
                      typing={typing}
                      draft=""
                      warn=""
                      onDraft={() => {}}
                      onSend={() => {}}
                    />
                    <CoveredPanel
                      order={{
                        ...order,
                        rerollsLeft: 2,
                        rerollsUnlimited: false,
                        reports: [],
                        // 4:31 left at the match; once done the window is long over (locked)
                        rerollUntil: done ? 0 : matchedAt + REROLL_LEFT_MS,
                      }}
                      mate={MATE}
                      sym={sym}
                      now={now}
                      reportsEnabled
                      onReroll={() => {}}
                      onReport={() => {}}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </figure>
      </div>
    );
  }
}
