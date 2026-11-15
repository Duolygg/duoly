'use client';

/*
 * Your games, as cards (DESIGN decision 7).
 *
 * One card per game an administrator approved: the game's art, its verified rank, the Featured
 * star, and one line that says what the card holds ("Jungle, Support · Hecarim, Nami, Yuumi").
 * Opening a card is what shows the editor, so a teammate with four games reads four lines and
 * opens the one that is wrong instead of scrolling eight text fields.
 *
 * Ranks are not editable here and never were: an administrator verifies them. Featuring replaced
 * the old select, because a star on the card it describes cannot drift out of step with the list
 * underneath it. The last card is the only way to ask for a game, and it says plainly that the
 * team decides.
 */
import React from 'react';
import { GAME, GAMES } from '../../design-reference/lib/games';
import {
  PROFILE_PICKS_MAX,
  PROFILE_ROLES_MAX,
} from '../../contracts/teammate-profile';
import {
  hasPickCatalog,
  hasRoleCatalog,
  pickCatalog,
  pickDisplayName,
  picksLabel,
  resolvePick,
} from '../../contracts/game-picks-resolve';
import RoleGlyph, { roleColor } from './role-accents';
import PicksPicker from './PicksPicker';
import LabelInput from './LabelInput';
import { openSupportChat } from '../support/open-chat';

const gameName = (id) => GAME[id]?.name || id;
/* Social is time without a match: no lanes, no characters. */
const SOCIAL = 'social';

const Caret = ({ dir }) => (
  <svg
    viewBox="0 0 16 16"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={dir === 'up' ? 'm4 10 4-4 4 4' : 'm4 6 4 4 4-4'} />
  </svg>
);
const Cross = () => (
  <svg
    viewBox="0 0 16 16"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
const Plus = () => (
  <svg
    viewBox="0 0 16 16"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M8 3.2v9.6M3.2 8h9.6" />
  </svg>
);
const Star = ({ on }) => (
  <svg
    viewBox="0 0 20 20"
    width="20"
    height="20"
    fill={on ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10 2.4l2.35 4.76 5.25.77-3.8 3.7.9 5.23L10 14.4l-4.7 2.46.9-5.23-3.8-3.7 5.25-.77Z" />
  </svg>
);
const Tick = () => (
  <svg
    viewBox="0 0 16 16"
    width="11"
    height="11"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m3 8.6 3.2 3.2L13 4.8" />
  </svg>
);

/*
 * A game dropdown in the screen's own look: icon and name on the button and in every row. The
 * native select opened an OS-grey list that matched nothing else here. Keyboard: arrows and
 * Home/End move, Enter or Space picks, Escape closes, typing a letter jumps to the next game
 * starting with it.
 */
function GameSelect({ id, options, value, placeholder, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const root = React.useRef(null);
  const button = React.useRef(null);
  const list = React.useRef(null);
  const chosen = options.find((g) => g.id === value) || null;
  const listId = id + '-list';

  React.useEffect(() => {
    if (!open) return undefined;
    const away = (event) => {
      if (root.current && !root.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  React.useEffect(() => {
    if (!open || !list.current) return;
    list.current.focus({ preventScroll: true });
    list.current
      .querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const show = () => {
    const at = options.findIndex((g) => g.id === value);
    setActive(at < 0 ? 0 : at);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const pick = (index) => {
    const game = options[index];
    if (game) onChange(game.id);
    close();
  };
  const onKey = (event) => {
    const last = options.length - 1;
    const keys = {
      ArrowDown: () => setActive((i) => Math.min(last, i + 1)),
      ArrowUp: () => setActive((i) => Math.max(0, i - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => pick(active),
      ' ': () => pick(active),
      Escape: close,
      Tab: () => setOpen(false),
    };
    if (keys[event.key]) {
      if (event.key !== 'Tab') event.preventDefault();
      keys[event.key]();
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      const letter = event.key.toLowerCase();
      const order = options
        .map((g, i) => ({ g, i }))
        .filter(({ g }) => g.name.toLowerCase().startsWith(letter));
      if (!order.length) return;
      const next = order.find(({ i }) => i > active) || order[0];
      setActive(next.i);
    }
  };

  return (
    <div className="pk-select" ref={root} data-open={String(open)}>
      <button
        type="button"
        id={id}
        ref={button}
        className="pk-select-button"
        data-empty={String(!chosen)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault();
            show();
          }
        }}
      >
        {chosen ? (
          <img
            className="pk-select-art"
            src={chosen.img}
            width={26}
            height={26}
            alt=""
            decoding="async"
          />
        ) : (
          <span className="pk-select-art" data-blank="true" aria-hidden="true">
            <Plus />
          </span>
        )}
        <span className="pk-select-text">
          {chosen ? chosen.name : placeholder}
        </span>
        <span className="pk-select-caret" aria-hidden="true">
          <Caret dir="down" />
        </span>
      </button>
      {open ? (
        <ul
          id={listId}
          ref={list}
          className="pk-select-list"
          role="listbox"
          tabIndex={-1}
          aria-label={placeholder}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={onKey}
        >
          {options.map((g, index) => (
            <li
              key={g.id}
              id={`${id}-opt-${index}`}
              data-index={index}
              role="option"
              aria-selected={g.id === value}
              data-active={String(index === active)}
              onPointerMove={() => index !== active && setActive(index)}
              onClick={() => pick(index)}
            >
              <img
                src={g.img}
                width={26}
                height={26}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span>{g.name}</span>
              {g.id === value ? <Tick /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default class GameCards extends React.Component {
  constructor(props) {
    super(props);
    /* One game is the common case, and its card is the whole reason the teammate is here, so it
       opens itself. With several, everything starts closed and the summary lines do the talking. */
    this.state = {
      open: props.games.length === 1 ? props.games[0].game : '',
      picking: '',
      /** The button the picker was opened from, so closing it hands focus back. */
      pickingFrom: null,
      ask: '',
      /** Set once the draft is in the chat, so the button is not a thing that appears to do
          nothing on a screen where the chat opens over the corner. */
      asked: false,
    };
  }
  entry(game) {
    return this.props.games.find((g) => g.game === game);
  }
  /** Writes one game's roles or picks back, leaving every other game alone. */
  patch(game, change) {
    this.props.onChange(
      this.props.games.map((g) => (g.game === game ? { ...g, ...change } : g)),
    );
  }
  rankLine(game) {
    const rank = this.props.ranks.find((r) => r.game === game);
    if (game === SOCIAL) return <>Social sessions, no rank</>;
    if (!rank?.rank) return <>Rank not verified yet</>;
    return (
      <>
        {/* The rank is what gets cut when the line will not fit, never the badge that says
            somebody checked it. */}
        <span className="pk-rank-text">{rank.rank}</span>
        {rank.verified ? (
          <span className="pk-badge">
            <Tick />
            Verified
          </span>
        ) : null}
        {rank.peakRank ? (
          <span className="pk-card-peak">Peak {rank.peakRank}</span>
        ) : null}
      </>
    );
  }
  /** The one line a closed card shows: what is on it, or what is missing from it. */
  summary(entry) {
    const { game, roles, picks } = entry;
    if (game === SOCIAL)
      return { text: 'Just chatting, no lanes to pick', empty: true };
    const names = picks.map((p) => pickDisplayName(game, p));
    const parts = [roles.join(', '), names.join(', ')].filter(Boolean);
    if (parts.length) return { text: parts.join(' · '), empty: false };
    /* "Add your roles and classes and specs" is what naming the field gave World of Warcraft.
       Mains is the word a player uses, and it is true in every game. */
    return { text: 'Add roles and mains', empty: true };
  }
  renderRoles(entry) {
    const { game, roles } = entry;
    const catalog = pickCatalog(game);
    const full = roles.length >= PROFILE_ROLES_MAX;
    return (
      <div className="pk-block">
        <header>
          <span className="pk-label">Roles</span>
          <span
            className="pk-count"
            data-full={String(full)}
            aria-live="polite"
          >
            {roles.length} / {PROFILE_ROLES_MAX}
          </span>
        </header>
        {hasRoleCatalog(game) ? (
          <>
            <div className="pk-row">
              {catalog.roles.map((role) => {
                const on = roles.includes(role.name);
                return (
                  <button
                    key={role.id}
                    type="button"
                    className="pk-chip"
                    aria-pressed={on}
                    disabled={!on && full}
                    style={{ '--pk-role': roleColor(role.id) }}
                    onClick={() =>
                      this.patch(game, {
                        roles: on
                          ? roles.filter((r) => r !== role.name)
                          : [...roles, role.name],
                      })
                    }
                  >
                    <RoleGlyph role={role.id} />
                    {role.name}
                  </button>
                );
              })}
            </div>
            <p className="pk-hint">
              {full
                ? 'Remove one to add another.'
                : 'Pick the roles you want to be booked for.'}
            </p>
          </>
        ) : (
          <LabelInput
            value={roles}
            max={PROFILE_ROLES_MAX}
            inputId={'pk-roles-' + game}
            placeholder="Builder"
            onChange={(next) => this.patch(game, { roles: next })}
          />
        )}
      </div>
    );
  }
  renderPicks(entry) {
    const { game, picks } = entry;
    const label = picksLabel(game);
    const catalog = pickCatalog(game);
    const max = catalog?.max ?? PROFILE_PICKS_MAX;
    const full = picks.length >= max;
    return (
      <div className="pk-block">
        <header>
          <span className="pk-label">{label}</span>
          <span
            className="pk-count"
            data-full={String(full)}
            aria-live="polite"
          >
            {picks.length} / {max}
          </span>
        </header>
        {hasPickCatalog(game) ? (
          <>
            {picks.length ? (
              <div className="pk-picked">
                {picks.map((value, index) => {
                  const option = resolvePick(game, value);
                  const role = option?.filter ?? null;
                  const name = option?.name ?? value;
                  return (
                    <div
                      key={value}
                      className="pk-picked-item"
                      style={{ '--pk-role': roleColor(role) }}
                    >
                      <span className="pk-order" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className="pk-picked-name">
                        {name}
                        {/* The role, when the game assigns one; nothing when it does not,
                            because repeating "Champions" under every champion says nothing. */}
                        {!option ? (
                          <span className="pk-picked-note">
                            Not in our list
                          </span>
                        ) : role ? (
                          <span className="pk-picked-note">
                            {catalog.filters.find((f) => f.id === role)?.name}
                          </span>
                        ) : null}
                      </span>
                      <span className="pk-mini-group">
                        <button
                          type="button"
                          className="pk-mini"
                          disabled={index === 0}
                          onClick={() => this.move(game, index, -1)}
                        >
                          <Caret dir="up" />
                          <span className="pk-sr">Move {name} earlier</span>
                        </button>
                        <button
                          type="button"
                          className="pk-mini"
                          disabled={index === picks.length - 1}
                          onClick={() => this.move(game, index, 1)}
                        >
                          <Caret dir="down" />
                          <span className="pk-sr">Move {name} later</span>
                        </button>
                        <button
                          type="button"
                          className="pk-mini"
                          onClick={() =>
                            this.patch(game, {
                              picks: picks.filter((p) => p !== value),
                            })
                          }
                        >
                          <Cross />
                          <span className="pk-sr">Remove {name}</span>
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <button
              type="button"
              className="pk-add"
              data-pk-open-picker={game}
              onClick={(event) =>
                this.setState({
                  picking: game,
                  pickingFrom: event.currentTarget,
                })
              }
            >
              <Plus />
              {picks.length ? `Edit ${label}` : `Choose ${label}`}
            </button>
            <p className="pk-hint">
              {picks.length > 1
                ? 'The order is the order your profile shows them in.'
                : 'Search by name or nickname. Up to ' + max + '.'}
            </p>
          </>
        ) : (
          <LabelInput
            value={picks}
            max={max}
            inputId={'pk-picks-' + game}
            placeholder="Your main"
            onChange={(next) => this.patch(game, { picks: next })}
          />
        )}
      </div>
    );
  }
  move(game, index, by) {
    const entry = this.entry(game);
    const to = index + by;
    if (!entry || to < 0 || to >= entry.picks.length) return;
    const picks = [...entry.picks];
    [picks[index], picks[to]] = [picks[to], picks[index]];
    this.patch(game, { picks });
  }
  moveFeatured(index, by) {
    const games = [...this.props.featuredGames];
    const to = index + by;
    if (to < 0 || to >= games.length) return;
    [games[index], games[to]] = [games[to], games[index]];
    this.props.onFeature(games);
  }
  renderAsk() {
    /* Only games nobody approved yet, and never Social: that one comes with Gamer Girl access. */
    const mine = new Set(this.props.games.map((g) => g.game));
    const open = GAMES.filter((g) => g.id !== SOCIAL && !mine.has(g.id));
    if (!open.length) return null;
    const chosen = this.state.ask;
    return (
      <div className="pk-ask">
        <h4>
          <Plus />
          Add a game
        </h4>
        <p>
          The team approves the games on your profile. Pick the one you play and
          we take it from there.
        </p>
        <div className="pk-ask-row">
          <label className="pk-sr" htmlFor="pk-ask-game">
            Which game
          </label>
          {/* Never opens on a game nobody chose: the first in the list was one press away from
              a request for a game the teammate had not read. */}
          {/* Buttons, not a required form control: this sits inside the settings form, and a
              required control with nothing in it would block the Save button at the bottom. */}
          <GameSelect
            id="pk-ask-game"
            options={open}
            value={chosen}
            placeholder="Choose a game"
            onChange={(id) => this.setState({ ask: id, asked: false })}
          />
          <button
            type="button"
            className="pk-button"
            data-pk-ask-game
            disabled={!chosen}
            onClick={() => {
              this.setState({ asked: true });
              openSupportChat(
                `I'd like to add ${gameName(chosen)} to my profile.`,
              );
            }}
          >
            Ask support
          </button>
        </div>
        {this.state.asked ? (
          <p className="pk-sent" role="status">
            <Tick />
            Sent. They will reply in the chat.
          </p>
        ) : null}
      </div>
    );
  }
  render() {
    const { games, featuredGames } = this.props;
    const ordered = [
      ...featuredGames
        .map((game) => games.find((entry) => entry.game === game))
        .filter(Boolean),
      ...games.filter((entry) => !featuredGames.includes(entry.game)),
    ];
    if (!games.length)
      return (
        <div className="pk-games">
          <p className="pk-hint">
            You have no approved games yet, so there is nothing to set up here.
          </p>
          {this.renderAsk()}
        </div>
      );
    const picking = this.state.picking ? this.entry(this.state.picking) : null;
    return (
      <div className="pk-games">
        {ordered.map((entry) => {
          const game = entry.game;
          const open = this.state.open === game;
          const featuredIndex = featuredGames.indexOf(game);
          const featured = featuredIndex !== -1;
          const summary = this.summary(entry);
          return (
            <div
              key={game}
              className="pk-card"
              data-open={String(open)}
              data-featured={String(featured)}
            >
              <div className="pk-card-row">
                <button
                  type="button"
                  className="pk-card-open"
                  aria-expanded={open}
                  data-pk-card={game}
                  onClick={() => this.setState({ open: open ? '' : game })}
                >
                  {/* The name is right beside it, so the art is decoration and says nothing
                      a screen reader needs. Lazy because a teammate with four games has four of
                      these and none of them is the reason the page is open. */}
                  <img
                    className="pk-art"
                    src={GAME[game]?.img}
                    width={48}
                    height={48}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <span>
                    <span className="pk-card-name">
                      {gameName(game)}
                      {featured ? (
                        <span className="pk-badge" data-kind="featured">
                          Featured
                        </span>
                      ) : null}
                    </span>
                    <span className="pk-card-rank">{this.rankLine(game)}</span>
                    <span className="pk-card-summary">
                      {summary.empty ? (
                        <span className="pk-card-cta">
                          <Plus />
                          {summary.text}
                        </span>
                      ) : (
                        summary.text
                      )}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="pk-star"
                  aria-pressed={featured}
                  disabled={featured && featuredGames.length === 1}
                  title={
                    featured
                      ? featuredGames.length === 1
                        ? 'Keep at least one game featured'
                        : `Stop featuring ${gameName(game)}`
                      : 'Make featured'
                  }
                  data-pk-feature={game}
                  onClick={() =>
                    this.props.onFeature(
                      featured
                        ? featuredGames.filter((id) => id !== game)
                        : [...featuredGames, game],
                    )
                  }
                >
                  <Star on={featured} />
                  <span className="pk-sr">
                    {featured
                      ? `${gameName(game)} is featured`
                      : `Feature ${gameName(game)}`}
                  </span>
                </button>
                {/* The whole row opens the card, so the mark that says so sits at the end of
                    it rather than beside the art, and the star keeps its own target. */}
                <span className="pk-chevron" aria-hidden="true">
                  <Caret dir="down" />
                </span>
              </div>
              {featured && featuredGames.length > 1 ? (
                <div className="pk-feature-order">
                  <span>Position {featuredIndex + 1}</span>
                  <span className="pk-mini-group">
                    <button
                      type="button"
                      className="pk-mini"
                      disabled={featuredIndex === 0}
                      onClick={() => this.moveFeatured(featuredIndex, -1)}
                      aria-label={`Move ${gameName(game)} up`}
                    >
                      <Caret dir="up" />
                      Up
                    </button>
                    <button
                      type="button"
                      className="pk-mini"
                      disabled={featuredIndex === featuredGames.length - 1}
                      onClick={() => this.moveFeatured(featuredIndex, 1)}
                      aria-label={`Move ${gameName(game)} down`}
                    >
                      <Caret dir="down" />
                      Down
                    </button>
                  </span>
                </div>
              ) : null}
              {open ? (
                <div className="pk-card-body">
                  {game === SOCIAL ? (
                    <p className="pk-hint">
                      Social sessions have no roles and no characters. Your vibe
                      tags and your bio are what they go on.
                    </p>
                  ) : (
                    <>
                      {this.renderRoles(entry)}
                      {this.renderPicks(entry)}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
        <p className="pk-fine">Ranks are checked by the team.</p>
        {this.renderAsk()}
        {picking ? (
          <PicksPicker
            game={picking.game}
            value={picking.picks}
            returnTo={this.state.pickingFrom}
            onAsk={(draft) => {
              this.setState({ picking: '' });
              openSupportChat(draft);
            }}
            onApply={(picks) => {
              this.patch(picking.game, { picks });
              this.setState({ picking: '' });
            }}
            onCancel={() => this.setState({ picking: '' })}
          />
        ) : null}
      </div>
    );
  }
}
