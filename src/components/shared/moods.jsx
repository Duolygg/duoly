// Order moods: how the customer wants the session to feel. Picked at checkout (home/MoodPicker.jsx),
// shown to teammates on the queue card and the accepted order (teammate/Teammate.jsx). Ids match
// ORDER_MOODS in contracts/orders.ts and the check constraint in 20261101120000_order_moods.
import React from 'react';

export const MOODS = [
  {
    id: 'chill',
    name: 'Chill',
    line: 'Relaxed games, good vibes, zero pressure.',
    color: '#5EEAA8',
    // a mug with steam (the steam lines rise when picked)
    paths: [
      'M4 9h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z',
      'M16 11h1.5a2.5 2.5 0 0 1 0 5H16',
    ],
    extra: ['M8 3.5c-.6.8-.6 1.7 0 2.5', 'M12 3.5c-.6.8-.6 1.7 0 2.5'],
  },
  {
    id: 'tryhard',
    name: 'Tryhard',
    line: 'Comms on, focus up, we play to win.',
    color: '#FF8A4C',
    // a flame (flickers when picked)
    paths: [
      'M12 21c-3.6 0-6.5-2.6-6.5-6.3 0-2.6 1.4-4.3 2.8-5.6.3 1.6 1.2 2.6 2.3 2.9-.5-3.3.9-6.4 3.6-9 .3 2.8 1.9 4.6 3.3 6.1 1.2 1.3 1 3.1 1 5.6 0 3.7-2.9 6.3-6.5 6.3z',
    ],
    extra: [
      'M12 18c-1.2 0-2.2-.9-2.2-2.2 0-1.2.9-2 1.6-2.6.2 1 .8 1.5 1.4 1.5.9 0 1.4.9 1.4 1.4 0 1-.9 1.9-2.2 1.9z',
    ],
  },
  {
    id: 'teach',
    name: 'Teach me',
    line: 'They explain the why and drop tips as you play.',
    color: '#7CC4FF',
    // a graduation cap (bobs when picked)
    paths: [
      'M2.5 9.5 12 5l9.5 4.5L12 14z',
      'M6.5 11.6V15c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-3.4',
      'M21.5 9.5V15',
    ],
    extra: [],
  },
  {
    id: 'fun',
    name: 'Just for fun',
    line: 'Banter, memes and off-meta picks.',
    color: '#FF5FBF',
    // a laughing face (wobbles when picked)
    paths: [
      'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z',
      'M7.5 13h9a4.5 4.5 0 0 1-9 0z',
    ],
    extra: ['M8.5 9.5 10 8.5', 'M15.5 9.5 14 8.5'],
  },
];

export const moodOf = (id) => MOODS.find((m) => m.id === id) || null;

/** The mood's line icon; `extra` strokes animate separately (steam, inner flame, eyes). */
export function MoodIcon({ mood, size = 22, strokeWidth = 2 }) {
  return (
    <svg
      className={'mood-ico mood-ico-' + mood.id}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {mood.paths.map((d) => (
        <path key={d} d={d} />
      ))}
      {mood.extra.map((d) => (
        <path key={d} d={d} className="mood-ico-x" />
      ))}
    </svg>
  );
}

/** Small coloured pill for a mood, e.g. on the teammate's queue card. */
export function MoodBadge({ id, style }) {
  const mood = moodOf(id);
  if (!mood) return null;
  return (
    <span
      className="mood-badge"
      title={mood.name + ': ' + mood.line}
      style={{ '--mc': mood.color, ...style }}
    >
      <MoodIcon mood={mood} size={13} strokeWidth={2.4} />
      {mood.name}
    </span>
  );
}
