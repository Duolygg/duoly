import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  BOOKING_REASSURANCE,
  REASSURANCE_SOURCES,
} from '../../src/server/seo/reassurance';
import { AUTO_CANCEL_MINUTES } from '../../src/server/seo/fees';

describe('the line under a booking button', () => {
  it('states the refund window the fees module declares', () => {
    expect(BOOKING_REASSURANCE).toContain(`${AUTO_CANCEL_MINUTES} minutes`);
  });

  it('only repeats rules the linked pages already state in full', () => {
    const pages = REASSURANCE_SOURCES.map((path) =>
      readFileSync(`src/pages${path}.astro`, 'utf8'),
    ).join('\n');
    expect(pages).toContain('no subscription');
    expect(pages).toContain('until a teammate accepts');
    expect(pages).toContain('AUTO_CANCEL_MINUTES');
  });

  it('promises nothing Duoly does not publish', () => {
    // No rating, no wait time, no customer count, no outcome guarantee: the
    // page has no data for any of them, so the microcopy may not imply one.
    expect(BOOKING_REASSURANCE).not.toMatch(
      /\b(guarantee|guaranteed|rated|rating|reviews?|stars?|instant|instantly|within \d+ (seconds|minutes) of|\d[\d,.]*\+? (players|customers|users|sessions))\b/i,
    );
    // The house copy rules: no dashes, no ampersand, no "not X, but Y".
    expect(BOOKING_REASSURANCE).not.toMatch(/[–—]| & |not .*, but /i);
  });
});
