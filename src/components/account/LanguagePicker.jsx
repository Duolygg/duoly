'use client';

/*
 * The languages a teammate plays in, in the profile's About you block (DESIGN decision 6).
 *
 * The stored value is unchanged: the same English names PROFILE_LANGUAGES already holds, in the
 * teammate's own order, saved by the profile form it sits in. What is new is how they are chosen:
 * a searchable list with a short Suggested group and then every language A to Z, each row showing
 * the English name, the language's own name for itself and its ISO code.
 *
 * No flags anywhere. A flag names a country, and English, German, French, Portuguese, Arabic and
 * Chinese all cross borders, so a flag would be wrong before it was decorative.
 *
 * Order is kept because the directory card shows the first three, and the chip says exactly that
 * ("Shown first"). It never claims a main or a native language, which the schema does not store
 * and nobody has approved.
 */
import React from 'react';
import PickerSheet from './PickerSheet';
import {
  LANGUAGES_SUGGESTED,
  PROFILE_LANGUAGE_DETAIL,
} from '../../contracts/profile-languages';
import { LANGUAGES_MAX } from '../../contracts/account';

const DETAIL = Object.fromEntries(
  PROFILE_LANGUAGE_DETAIL.map((l) => [l.id, l]),
);
/**
 * The languages this screen offers. `allowed` is the caller's own list (LiveProfile hands over
 * PROFILE_LANGUAGES, the only names the endpoint accepts), so the picker can never offer one a
 * save would drop. Suggested leads, then every language by name.
 */
const offered = (allowed) => {
  const keep = allowed?.length ? new Set(allowed) : null;
  const list = keep
    ? PROFILE_LANGUAGE_DETAIL.filter((l) => keep.has(l.id))
    : PROFILE_LANGUAGE_DETAIL;
  return {
    suggested: list.slice(0, LANGUAGES_SUGGESTED),
    all: [...list].sort((a, b) => a.id.localeCompare(b.id, 'en')),
  };
};

/** Accents folded so "Türkçe" answers to "turkce" and "español" to "espanol". */
const fold = (value) =>
  value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
/**
 * How well a language answers what was typed, lowest first, or -1 for not at all. The code wins
 * outright, then the English name, then the language's own name, then anything that merely holds
 * the letters somewhere: "de" has to be German rather than Nederlands.
 */
const rank = (language, query) => {
  if (!query) return 0;
  const code = fold(language.code);
  const name = fold(language.id);
  const endonym = fold(language.endonym);
  if (code === query) return 0;
  if (name.startsWith(query)) return 1;
  if (endonym.startsWith(query)) return 2;
  if (code.startsWith(query)) return 3;
  if (name.includes(query) || endonym.includes(query)) return 4;
  return -1;
};

const Check = () => (
  <svg
    className="pk-check"
    viewBox="0 0 16 16"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.1"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m3 8.6 3.2 3.2L13 4.8" />
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

/** One row in the sheet. */
function Row({ language, on, full, onToggle }) {
  return (
    <button
      type="button"
      className="pk-lang"
      aria-pressed={on}
      disabled={!on && full}
      onClick={onToggle}
    >
      <span className="pk-lang-name">
        {language.id}
        {language.endonym !== language.id ? (
          <bdi className="pk-lang-endonym" lang={language.code.toLowerCase()}>
            {language.endonym}
          </bdi>
        ) : null}
      </span>
      <span className="pk-code">{language.code}</span>
      <Check />
    </button>
  );
}

export default class LanguagePicker extends React.Component {
  constructor(props) {
    super(props);
    /** `from` is the button the sheet was opened with, so closing it hands focus back. */
    this.state = { open: false, query: '', draft: [], from: null };
  }
  openSheet = (event) =>
    this.setState({
      open: true,
      query: '',
      draft: [...this.props.value],
      from: event?.currentTarget ?? null,
    });
  closeSheet = () => this.setState({ open: false, query: '' });
  toggle(id) {
    this.setState((s) => {
      if (s.draft.includes(id))
        return { draft: s.draft.filter((x) => x !== id) };
      if (s.draft.length >= LANGUAGES_MAX) return null;
      return { draft: [...s.draft, id] };
    });
  }
  apply = () => {
    this.props.onChange(this.state.draft);
    this.closeSheet();
  };
  remove(id) {
    this.props.onChange(this.props.value.filter((x) => x !== id));
  }
  /** Moves one language to the front, which is the one the directory card shows first. */
  showFirst(id) {
    this.props.onChange([id, ...this.props.value.filter((x) => x !== id)]);
  }
  renderList(language, draft, full) {
    return (
      <Row
        key={language.id}
        language={language}
        on={draft.includes(language.id)}
        full={full}
        onToggle={() => this.toggle(language.id)}
      />
    );
  }
  renderSheet() {
    const { query, draft } = this.state;
    const { suggested, all } = offered(this.props.allowed);
    const folded = fold(query);
    const full = draft.length >= LANGUAGES_MAX;
    const found = all
      .map((l) => ({ l, at: rank(l, folded) }))
      .filter((row) => row.at >= 0)
      .sort((a, b) => a.at - b.at || a.l.id.localeCompare(b.l.id, 'en'))
      .map((row) => row.l);
    return (
      <PickerSheet
        returnTo={this.state.from}
        title="Languages"
        count={
          <span
            className="pk-count"
            data-full={String(full)}
            aria-live="polite"
          >
            {draft.length} of {LANGUAGES_MAX}
          </span>
        }
        query={query}
        onQuery={(value) => this.setState({ query: value })}
        placeholder="Search languages"
        searchLabel="Search languages"
        onCancel={this.closeSheet}
        foot={
          <>
            <span className="pk-count" data-full={String(full)}>
              {full
                ? 'Remove one to add another.'
                : `${draft.length} of ${LANGUAGES_MAX} chosen`}
            </span>
            <button
              type="button"
              className="pk-button"
              onClick={this.closeSheet}
            >
              Cancel
            </button>
            <button
              type="button"
              className="pk-button pk-button-primary"
              onClick={this.apply}
            >
              Apply
            </button>
          </>
        }
      >
        {!found.length ? (
          <p className="pk-empty">
            No match for <strong>{query.trim()}</strong>. Try the English name
            or the language&apos;s own name.
          </p>
        ) : folded ? (
          <div className="pk-lang-list">
            {found.map((l) => this.renderList(l, draft, full))}
          </div>
        ) : (
          <>
            <p className="pk-lang-group">Suggested</p>
            <div className="pk-lang-list">
              {suggested.map((l) => this.renderList(l, draft, full))}
            </div>
            <p className="pk-lang-group">All languages</p>
            <div className="pk-lang-list">
              {all.map((l) => this.renderList(l, draft, full))}
            </div>
          </>
        )}
      </PickerSheet>
    );
  }
  render() {
    const value = this.props.value;
    const full = value.length >= LANGUAGES_MAX;
    return (
      <div className="pk-langs pk-scope">
        {value.length ? (
          <div className="pk-pills">
            {value.map((id, index) => (
              <span
                key={id}
                className="pk-pill"
                data-first={String(index === 0)}
                data-pk-language={id}
              >
                {id}
                <span className="pk-code">{DETAIL[id]?.code ?? ''}</span>
                {index === 0 ? (
                  <span className="pk-pill-note">Shown first</span>
                ) : (
                  <button
                    type="button"
                    className="pk-pill-first"
                    onClick={() => this.showFirst(id)}
                  >
                    Show first
                  </button>
                )}
                <button
                  type="button"
                  className="pk-mini"
                  onClick={() => this.remove(id)}
                >
                  <Cross />
                  <span className="pk-sr">Remove {id}</span>
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="pk-add"
          data-pk-add-language
          onClick={this.openSheet}
        >
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
          {value.length ? 'Add a language' : 'Choose your languages'}
        </button>
        <p className="pk-hint">
          {full
            ? 'That is all six. Remove one to add another.'
            : 'The first three show on your card in the directory.'}
        </p>
        {this.state.open ? this.renderSheet() : null}
      </div>
    );
  }
}
