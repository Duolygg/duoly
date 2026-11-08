// Checkout "session mood": four cards (Chill, Tryhard, Teach me, Just for fun), each in its own colour
// with an icon that comes alive when picked. Optional: tapping the picked card again clears it.
// The teammate sees the mood before accepting. Moods: shared/moods.jsx; styles: globals.css (mp-*).
import React from 'react';
import { MOODS, MoodIcon, moodOf } from '../shared/moods';

export default function MoodPicker({ value, onPick }) {
  const picked = moodOf(value);
  return (
    <div className="mp" role="group" aria-labelledby="mp-l">
      <div className="mp-head">
        <span id="mp-l" className="mp-label">
          Session mood{' '}
          <span className="mp-opt" style={{ color: '#80759C' }}>
            · optional
          </span>
        </span>
      </div>
      <div className="mp-grid">
        {MOODS.map((m) => {
          const on = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              className={'mp-card' + (on ? ' is-on' : '')}
              aria-pressed={on ? 'true' : 'false'}
              onClick={() => onPick(on ? '' : m.id)}
              style={{ '--mc': m.color }}
            >
              <span className="mp-ico">
                <MoodIcon mood={m} />
              </span>
              <span className="mp-name">{m.name}</span>
              <span className="mp-line">{m.line}</span>
              <span className="mp-check" aria-hidden="true">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
      <p
        className="mp-note"
        aria-live="polite"
        key={value || 'none'}
        style={picked ? { '--mc': picked.color } : undefined}
      >
        {picked ? (
          <>
            <b>{picked.name}</b> it is. Your teammate sees this before they
            accept.
          </>
        ) : (
          'Tell your teammate the vibe you’re after. Skip it and anything goes.'
        )}
      </p>
    </div>
  );
}
