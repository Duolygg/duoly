import { describe, expect, it } from 'vitest';
import { FORBIDDEN_CLAIMS } from '../../src/content/claim-guard';
import { HUB_PAGES } from '../../src/content/hub-pages';
import { socialContent } from '../../src/content/hubs';
import { intentPages } from '../../src/content/intent-pages';
import { GUIDE_PAGES } from '../../src/content/guide-pages';
import { lessons } from '../../src/content/coaching';
import { coachFormats } from '../../src/content/coaching-formats';
import { sessionExamples } from '../../src/content/coaching-examples';
import { comparisonRows } from '../../src/content/epal-comparison';

/** Every visible string in a copy registry entry, so a failure names it. */
const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(strings)
        : [];

/**
 * Every copy registry a customer-facing page renders from. Listed one by one on
 * purpose: a new registry has to be added here, which is the moment to notice
 * it is customer copy at all.
 */
const REGISTRIES: Record<string, unknown> = {
  'game-hubs': HUB_PAGES,
  'hubs (social)': socialContent,
  'intent-pages': intentPages,
  'guide-pages': GUIDE_PAGES,
  coaching: lessons,
  'coaching-formats': coachFormats,
  'coaching-examples': sessionExamples,
  'epal-comparison': comparisonRows,
};

describe('no customer copy promises a rank', () => {
  for (const [where, registry] of Object.entries(REGISTRIES))
    it(`${where} makes none of the forbidden claims`, () => {
      const texts = strings(registry);
      expect(texts.length, `${where} has copy to scan`).toBeGreaterThan(0);
      for (const text of texts)
        for (const claim of FORBIDDEN_CLAIMS)
          expect(text, `${where} vs ${claim}`).not.toMatch(claim);
    });

  it('still catches the claims it exists to keep out', () => {
    const caught = [
      'We boost your rank in three games.',
      'Rank boosting from Diamond to Master.',
      'A guaranteed rank by the weekend.',
      'Book three games and we get you to Immortal.',
    ].map((text) => FORBIDDEN_CLAIMS.some((claim) => claim.test(text)));
    expect(caught).toEqual([true, true, true, true]);
  });
});
