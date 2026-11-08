// Hero "match timer" under the headline: once, shortly after the page loads, a bar fills toward the
// 2:00 mark and flips from "Finding your duo…" to "Duo found". It shows the promise ("usually under
// 2 minutes", same as the FAQ) and no made-up match time. Pure CSS; styles: globals.css (ht-*).
import React from 'react';

export default function HeroTimer() {
  return (
    <div
      className="ht"
      role="img"
      aria-label="Duos are usually matched in under 2 minutes"
    >
      <div className="ht-top">
        <span className="ht-state">
          <span className="ht-s1">
            <span className="ht-dot" />
            Finding your duo…
          </span>
          <span className="ht-s2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Duo found
          </span>
        </span>
        <span className="ht-limit" style={{ color: '#7C7199' }}>
          2:00
        </span>
      </div>
      <div className="ht-track">
        <span className="ht-fill" />
      </div>
    </div>
  );
}
