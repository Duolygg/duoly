'use client';

/*
 * Free text labels, for a game we ship no list for (Fortnite, Call of Duty, PUBG, Rocket League,
 * ARC Raiders, Minecraft, Teamfight Tactics).
 *
 * The old screen asked for "up to 5, comma separated" in one text field and showed whatever came
 * back, so a teammate could not tell what had been saved. This keeps the same free text and makes
 * each label a thing: typed, added, visible, removable. Enter and a comma both add, Backspace in
 * an empty field takes the last one off.
 */
import React from 'react';

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

/** The database rejects these in a public label, so the field says so before a save does. */
const UNSAFE = /[@:/\\.]/;
export const LABEL_MAX_CHARS = 24;

export default class LabelInput extends React.Component {
  constructor(props) {
    super(props);
    this.state = { text: '', note: '' };
  }
  add(raw) {
    const value = raw.trim();
    if (!value) return this.setState({ text: '' });
    if (value.length > LABEL_MAX_CHARS)
      return this.setState({
        note: `Keep each one to ${LABEL_MAX_CHARS} characters.`,
      });
    if (UNSAFE.test(value))
      return this.setState({
        note: 'Leave out punctuation like @ : / and full stops.',
      });
    if (this.props.value.some((x) => x.toLowerCase() === value.toLowerCase()))
      return this.setState({
        text: '',
        note: `${value} is already on the list.`,
      });
    if (this.props.value.length >= this.props.max)
      return this.setState({ note: 'Remove one to add another.' });
    this.props.onChange([...this.props.value, value]);
    this.setState({ text: '', note: '' });
  }
  onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.add(this.state.text);
      return;
    }
    if (
      event.key === 'Backspace' &&
      !this.state.text &&
      this.props.value.length
    ) {
      event.preventDefault();
      this.props.onChange(this.props.value.slice(0, -1));
    }
  };
  render() {
    const { value, max, inputId, placeholder } = this.props;
    const full = value.length >= max;
    return (
      <div className="pk-tags">
        {value.length ? (
          <div className="pk-tag-row">
            {value.map((label) => (
              <span key={label} className="pk-tag">
                {label}
                <button
                  type="button"
                  className="pk-mini"
                  onClick={() =>
                    this.props.onChange(value.filter((x) => x !== label))
                  }
                >
                  <Cross />
                  <span className="pk-sr">Remove {label}</span>
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          id={inputId}
          value={this.state.text}
          placeholder={full ? 'That is the maximum' : placeholder}
          disabled={full}
          autoComplete="off"
          onChange={(event) =>
            this.setState({ text: event.target.value, note: '' })
          }
          onKeyDown={this.onKeyDown}
          onBlur={() => this.add(this.state.text)}
        />
        <p className="pk-hint" aria-live="polite">
          {this.state.note ||
            (full
              ? 'Remove one to add another.'
              : 'Type a name and press Enter.')}
        </p>
      </div>
    );
  }
}
