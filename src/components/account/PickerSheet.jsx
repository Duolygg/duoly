'use client';

/*
 * The one picker shell: characters and languages both open this.
 *
 * A phone gets a near full height bottom sheet, a desktop gets a panel docked over the settings
 * card; the markup is the same and profile-pickers.css decides which. It is a dialog either way:
 * focus moves in, Tab cycles inside it, Escape leaves without applying, and focus goes back to
 * the control that opened it.
 *
 * Search takes focus on open and keeps it: typing a letter anywhere in the sheet goes to the
 * search field, which is what makes finding one of 173 champions feel like a command palette
 * rather than a form. The arrow keys hand focus from the search field to the results, and the
 * caller decides what that means for its own layout.
 */
import React from 'react';
import './profile-pickers.css';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let sequence = 0;

export default class PickerSheet extends React.Component {
  constructor(props) {
    super(props);
    /*
     * Where focus goes when the sheet closes. `returnTo` is the control that opened it, which the
     * caller passes because Safari does not focus a button when it is clicked: reading
     * document.activeElement would find the body there and drop focus to the top of the page.
     * The active element is the fallback, for a sheet opened by keyboard.
     */
    const active =
      typeof document !== 'undefined' ? document.activeElement : null;
    this.opener =
      props.returnTo ??
      (active && active !== document.body && active !== document.documentElement
        ? active
        : null);
    this.sheetRef = React.createRef();
    this.searchRef = React.createRef();
    this.id = 'pk-sheet-' + ++sequence;
  }
  componentDidMount() {
    this.searchRef.current?.focus();
    /* The page behind a full height sheet must not scroll under a finger that misses the grid. */
    this.bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    /* Listened for on the document rather than on the sheet, because Safari does not focus a
       button when it is clicked: after tapping a filter tab the keyboard would otherwise be
       talking to the page behind the sheet, and Escape would close nothing. */
    document.addEventListener('keydown', this.onKeyDown, true);
  }
  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.body.style.overflow = this.bodyOverflow ?? '';
    const opener = this.opener;
    if (
      opener &&
      document.contains(opener) &&
      typeof opener.focus === 'function'
    )
      opener.focus();
  }
  /** Everything inside the sheet a Tab can reach right now, in document order. */
  focusable() {
    const sheet = this.sheetRef.current;
    return sheet
      ? [...sheet.querySelectorAll(FOCUSABLE)].filter(
          (el) => el.offsetParent !== null || el === document.activeElement,
        )
      : [];
  }
  onKeyDown = (event) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      return this.props.onCancel();
    }
    const sheet = this.sheetRef.current;
    const inside = Boolean(sheet?.contains(document.activeElement));
    if (event.key === 'Tab') {
      const items = this.focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      /* Focus may have drifted out of the sheet, so Tab brings it back in rather than walking
         off into the page the sheet is covering. */
      if (!inside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    /* Type anywhere, search anyway. A printable key outside the field is a search, not a
       shortcut, so it lands in the field with the character already in it. */
    const input = this.searchRef.current;
    if (
      input &&
      document.activeElement !== input &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      input.focus();
      this.props.onQuery((this.props.query ?? '') + event.key);
      return;
    }
    /* Arrow keys reach the results from anywhere in the sheet, which is what a tap on a filter
       tab in Safari leaves behind. */
    if (!inside && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      this.props.onArrowFromSearch?.(event.key === 'ArrowDown' ? 1 : -1);
    }
  };
  onSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.props.onArrowFromSearch?.(event.key === 'ArrowDown' ? 1 : -1);
    }
  };
  render() {
    const { title, count, placeholder, searchLabel, beneathSearch, foot } =
      this.props;
    return (
      <div
        className="pk-scrim pk-scope"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) this.props.onCancel();
        }}
      >
        <div
          className="pk-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby={this.id + '-title'}
          ref={this.sheetRef}
        >
          <div className="pk-sheet-head">
            <div className="pk-sheet-title">
              <h3 id={this.id + '-title'}>{title}</h3>
              {count}
              <button
                type="button"
                className="pk-close"
                onClick={() => this.props.onCancel()}
              >
                <svg
                  viewBox="0 0 20 20"
                  width="19"
                  height="19"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
                <span className="pk-sr">Close</span>
              </button>
            </div>
            <label className="pk-search">
              <svg
                viewBox="0 0 20 20"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="8.6" cy="8.6" r="5.4" />
                <path d="M12.6 12.6 17 17" />
              </svg>
              <input
                className="pk-search-input"
                type="search"
                value={this.props.query ?? ''}
                placeholder={placeholder}
                aria-label={searchLabel}
                autoComplete="off"
                spellCheck={false}
                ref={this.searchRef}
                onChange={(event) => this.props.onQuery(event.target.value)}
                onKeyDown={this.onSearchKeyDown}
              />
            </label>
            {beneathSearch}
          </div>
          <div className="pk-results">{this.props.children}</div>
          <div className="pk-sheet-foot">{foot}</div>
        </div>
      </div>
    );
  }
}
