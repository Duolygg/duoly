'use client';

/*
 * Choosing the characters a teammate mains, in one game.
 *
 * Opens on the game's own list (Champions, Agents, Heroes, Legends, Operators, Pokémon, classes
 * and specs), searchable the way a player types and filtered by role or side where the game
 * assigns one. Picking is a draft: Apply hands the list back to the card, and the card's Save is
 * still what publishes it, which is the Discord editor's split and the one teammates expect.
 *
 * Two rules worth stating because they are easy to get wrong: filtering never deselects anything,
 * and a value the catalog has never heard of keeps its place in the list instead of vanishing
 * from a profile that has been fine for months.
 */
import React from 'react';
import PickerSheet from './PickerSheet';
import RoleGlyph, { roleColor } from './role-accents';
import {
  pickCatalog,
  pickMonogram,
  resolvePick,
  searchPicks,
} from '../../contracts/game-picks-resolve';
import { PROFILE_PICKS_MAX } from '../../contracts/teammate-profile';

/* The badge in the corner of a picked tile: the ring around the tile says it, and this says it
   again in a shape, because a ring alone is a shade of a border. */
const Check = () => (
  <span className="pk-check" aria-hidden="true">
    <svg
      viewBox="0 0 16 16"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 8.6 3.2 3.2L13 4.8" />
    </svg>
  </span>
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

export default class PicksPicker extends React.Component {
  constructor(props) {
    super(props);
    const catalog = pickCatalog(props.game);
    this.state = {
      query: '',
      filter: null,
      /* Stored ids and legacy names both come in; a known one becomes its id, an unknown one
         stays exactly as it was stored. */
      chosen: [
        ...new Set(
          (props.value ?? []).map(
            (value) => resolvePick(props.game, value)?.id ?? value,
          ),
        ),
      ],
    };
    this.catalog = catalog;
    this.max = catalog?.max ?? PROFILE_PICKS_MAX;
    this.gridRef = React.createRef();
    this.tabsRef = React.createRef();
    /* What the card holds right now, so Apply can say whether there is anything to apply. */
    this.opened = this.state.chosen.join('\u0000');
    this.state.fade = 'none';
  }
  componentDidMount() {
    this.updateFade();
    window.addEventListener('resize', this.updateFade);
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.updateFade);
  }
  /* Which edge the filter row runs past, so the mask fades that edge and only that edge. */
  updateFade = () => {
    const row = this.tabsRef.current;
    if (!row) return;
    const over = row.scrollWidth - row.clientWidth;
    const fade =
      over <= 2
        ? 'none'
        : row.scrollLeft <= 2
          ? 'end'
          : row.scrollLeft >= over - 2
            ? 'start'
            : 'both';
    if (fade !== this.state.fade) this.setState({ fade });
  };
  /** The catalog entry for a chosen value, or null when nothing in the catalog matches it. */
  option(value) {
    return resolvePick(this.props.game, value);
  }
  label(value) {
    return this.option(value)?.name ?? value;
  }
  roleOf(value) {
    return this.option(value)?.filter ?? null;
  }
  roleName(role) {
    return this.catalog?.filters.find((f) => f.id === role)?.name ?? '';
  }
  toggle(id) {
    this.setState((s) => {
      if (s.chosen.includes(id))
        return { chosen: s.chosen.filter((x) => x !== id) };
      if (s.chosen.length >= this.max) return null;
      return { chosen: [...s.chosen, id] };
    });
  }
  /** How many tiles sit side by side right now, read from the grid itself. */
  columns() {
    const grid = this.gridRef.current;
    if (!grid) return 1;
    const columns = getComputedStyle(grid).gridTemplateColumns;
    return Math.max(1, columns.split(' ').filter(Boolean).length);
  }
  tiles() {
    return [
      ...(this.gridRef.current?.querySelectorAll('[data-pk-tile]') ?? []),
    ];
  }
  focusTile(index) {
    const tiles = this.tiles();
    if (!tiles.length) return;
    tiles[Math.min(tiles.length - 1, Math.max(0, index))]?.focus();
  }
  /* Arrow keys walk the grid as it looks: left and right by one, up and down by a real row. */
  onGridKeyDown = (event) => {
    const tiles = this.tiles();
    const at = tiles.indexOf(document.activeElement);
    if (at < 0) return;
    const columns = this.columns();
    const step = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    }[event.key];
    if (step === undefined) {
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        this.focusTile(event.key === 'Home' ? 0 : tiles.length - 1);
      }
      return;
    }
    event.preventDefault();
    /* Up from the first row goes back to the search field, which is where a correction goes. */
    if (at + step < 0) return this.searchFocus();
    this.focusTile(at + step);
  };
  searchFocus() {
    this.sheet?.searchRef.current?.focus();
  }
  apply = () => this.props.onApply(this.state.chosen);
  /** Opens the support chat with a message about a character we do not list yet. */
  askSupport = () => {
    const game = this.catalog?.name ?? this.props.game;
    const typed = this.state.query.trim();
    this.props.onAsk(
      typed
        ? `${game}: "${typed}" is missing from the ${this.catalog?.label ?? 'list'} I can pick from.`
        : `${game}: one of my mains is missing from the ${this.catalog?.label ?? 'list'} I can pick from.`,
    );
  };
  render() {
    const { query, filter, chosen } = this.state;
    const catalog = this.catalog;
    const results = searchPicks(this.props.game, query, filter);
    const full = chosen.length >= this.max;
    const changed = chosen.join('\u0000') !== this.opened;
    const noun = (catalog?.label ?? 'picks').toLowerCase();
    return (
      <PickerSheet
        ref={(sheet) => {
          this.sheet = sheet;
        }}
        returnTo={this.props.returnTo}
        title={catalog?.label ?? 'Picks'}
        query={query}
        onQuery={(value) => this.setState({ query: value })}
        placeholder={`Search ${noun}`}
        searchLabel={`Search ${noun}`}
        onArrowFromSearch={(dir) =>
          this.focusTile(dir > 0 ? 0 : this.tiles().length - 1)
        }
        onCancel={this.props.onCancel}
        beneathSearch={
          <>
            {/* Toggles rather than ARIA tabs: there is no tab panel under them, pressing the
                one that is on clears the filter, and a group of pressed buttons is what a
                screen reader should hear. */}
            {catalog?.filters.length ? (
              /* One row that scrolls, rather than two rows that wrap: at 390px six filters left
                 the last one alone on a line of its own. */
              <div
                className="pk-tabs"
                role="group"
                aria-label={`Filter by ${catalog.filterLabel.toLowerCase()}`}
                data-fade={this.state.fade}
                ref={this.tabsRef}
                onScroll={this.updateFade}
              >
                <button
                  type="button"
                  className="pk-tab"
                  aria-pressed={filter === null}
                  onClick={() => this.setState({ filter: null })}
                >
                  All
                </button>
                {catalog.filters.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className="pk-tab"
                    aria-pressed={filter === tab.id}
                    style={{ '--pk-role': roleColor(tab.id) }}
                    onClick={() =>
                      this.setState({
                        filter: filter === tab.id ? null : tab.id,
                      })
                    }
                  >
                    <RoleGlyph role={tab.id} size={12} />
                    {tab.name}
                  </button>
                ))}
              </div>
            ) : null}
            {/* The count belongs to the thing it counts, and so does the one line about a
                full list: both sit on the tray rather than in the title and the footer. */}
            <div className="pk-meter">
              {chosen.length ? (
                <span className="pk-meter-label">Your order</span>
              ) : null}
              <span className="pk-meter-end">
                {full ? (
                  <span className="pk-cap">Remove one to add another.</span>
                ) : null}
                <span
                  className="pk-count"
                  data-full={String(full)}
                  aria-live="polite"
                >
                  {chosen.length} / {this.max} picked
                </span>
              </span>
            </div>
            {chosen.length ? (
              /* What is picked, in order, so the cap and the order are both visible while
                 choosing. Moving one earlier or later happens on the card, which numbers them:
                 three buttons per pill here cost two rows of the grid on a phone and said the
                 same thing twice. */
              <div className="pk-strip">
                {chosen.map((value, index) => (
                  <span
                    key={value}
                    className="pk-strip-item"
                    style={{ '--pk-role': roleColor(this.roleOf(value)) }}
                  >
                    <span className="pk-strip-order" aria-hidden="true">
                      {index + 1}
                    </span>
                    {this.label(value)}
                    <button
                      type="button"
                      className="pk-mini"
                      onClick={() =>
                        this.setState({
                          chosen: chosen.filter((x) => x !== value),
                        })
                      }
                    >
                      <Cross />
                      <span className="pk-sr">Remove {this.label(value)}</span>
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </>
        }
        foot={
          /* One button. Cancel said what the close mark, Escape and a tap on the scrim already
             do, and it sat where a thumb reaches first. */
          <button
            type="button"
            className="pk-button pk-button-accent"
            disabled={!changed}
            onClick={this.apply}
          >
            Apply{changed && chosen.length ? ` \u00b7 ${chosen.length}` : ''}
          </button>
        }
      >
        {results.length ? (
          <>
            <div
              className="pk-grid"
              ref={this.gridRef}
              onKeyDown={this.onGridKeyDown}
            >
              {results.map((option) => {
                const on = chosen.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    data-pk-tile
                    className="pk-tile"
                    aria-pressed={on}
                    disabled={!on && full}
                    style={{ '--pk-role': roleColor(option.filter) }}
                    onClick={() => this.toggle(option.id)}
                  >
                    <span
                      className="pk-mono"
                      data-long={String(
                        pickMonogram(this.props.game, option.id).length > 2,
                      )}
                      aria-hidden="true"
                    >
                      {pickMonogram(this.props.game, option.id)}
                    </span>
                    <span className="pk-tile-text">
                      <span className="pk-tile-name">{option.name}</span>
                      {option.filter ? (
                        <span className="pk-tile-role">
                          {this.roleName(option.filter)}
                        </span>
                      ) : null}
                    </span>
                    {on ? <Check /> : null}
                  </button>
                );
              })}
            </div>
            <p className="pk-hint">
              Someone missing?{' '}
              <button
                type="button"
                className="pk-link"
                onClick={this.askSupport}
              >
                Tell us
              </button>
            </p>
          </>
        ) : (
          <p className="pk-empty">
            No match for <strong>{query.trim()}</strong>. Missing someone?{' '}
            <button type="button" className="pk-link" onClick={this.askSupport}>
              Tell us
            </button>
          </p>
        )}
      </PickerSheet>
    );
  }
}
