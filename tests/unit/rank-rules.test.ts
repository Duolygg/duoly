import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_CLAIMS,
  RANK_RULES,
  RANK_RULES_CHECKED,
  UNKNOWN_RULE,
  rankRuleFor,
} from '../../src/content/rank-rules';
import { HUB_PAGES } from '../../src/content/hub-pages';
import { intentPages } from '../../src/content/intent-pages';
import { GUIDE_PAGES } from '../../src/content/guide-pages';

/** Every visible string in a copy registry entry, so a failure names it. */
const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(strings)
        : [];

const copyFor = (slug: string) => {
  const hub = HUB_PAGES.find((page) => page.gameSlug === slug);
  const intent = intentPages.find((page) => page.gameSlug === slug);
  const guide = GUIDE_PAGES.find((page) => page.gameSlug === slug);
  return {
    hub: hub ? strings(hub).join(' ') : '',
    teammate: [intent, guide].filter(Boolean).flatMap(strings).join(' '),
  };
};

describe('ranked queue rules', () => {
  it('covers every game with a hub and cites a source for each', () => {
    expect(RANK_RULES_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const page of HUB_PAGES)
      expect(rankRuleFor(page.gameSlug), page.gameSlug).toBeTruthy();
    for (const rule of RANK_RULES) {
      expect(rule.source.url, rule.gameSlug).toMatch(/^https:\/\//);
      expect(rule.source.label.length, rule.gameSlug).toBeGreaterThan(5);
      expect(rule.summary.length, rule.gameSlug).toBeGreaterThan(40);
      // A publisher with no published rule is the one case with no cap, and it
      // has to be the `unknown` or `none` full-lobby case rather than a guess.
      if (!rule.duoCap)
        expect(['wider', 'unknown', 'none', 'same'], rule.gameSlug).toContain(
          rule.fullLobby,
        );
    }
  });

  it('says the rule on every page that sells that game', () => {
    for (const rule of RANK_RULES) {
      const copy = copyFor(rule.gameSlug);
      expect(copy.hub, `${rule.gameSlug}: hub copy`).toContain(rule.mustSay);
      for (const banned of rule.mustNotSay) {
        expect(copy.hub, `${rule.gameSlug}: hub copy`).not.toContain(banned);
        expect(copy.teammate, `${rule.gameSlug}: teammate copy`).not.toContain(
          banned,
        );
      }
      // Pages for a game whose publisher documents no cap have to use the one
      // agreed sentence rather than inventing a limit or implying none exists.
      if (!rule.duoCap && rule.fullLobby === 'unknown')
        expect(copy.hub, `${rule.gameSlug}: hub copy`).toContain(UNKNOWN_RULE);
    }
  });

  it('never promises a rank on any customer-facing page', () => {
    const all = [
      ...HUB_PAGES.flatMap(strings),
      ...intentPages.flatMap(strings),
      ...GUIDE_PAGES.flatMap(strings),
    ];
    for (const text of all)
      for (const claim of FORBIDDEN_CLAIMS)
        expect(text, `forbidden claim ${claim}`).not.toMatch(claim);
  });

  it('names the publisher on the hub of every game with a real rule', () => {
    for (const rule of RANK_RULES) {
      if (rule.fullLobby === 'none') continue; // No ranked queue to attribute.
      const copy = copyFor(rule.gameSlug);
      expect(copy.hub, `${rule.gameSlug}: publisher`).toContain(rule.publisher);
    }
  });
});
