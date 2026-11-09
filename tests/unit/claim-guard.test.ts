import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_CLAIMS,
  RANK_GAP_PHRASES,
} from '../../src/content/claim-guard';
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

/**
 * The whole source tree rather than the registries alone: the rank-gap rule
 * also lived in page templates, FAQ answers and llms.txt copy, and #193 left
 * seven passages behind in files this test now reads directly.
 *
 * src/design-reference is the co-founder's catalog and is never edited here,
 * and claim-guard.ts itself quotes every withdrawn phrase in its comments.
 */
const SRC = new URL('../../src', import.meta.url).pathname;
const SKIP = new Set(['design-reference', 'content/claim-guard.ts']);
const SCANNED = /\.(?:ts|tsx|js|jsx|mjs|astro|md)$/;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (SKIP.has(relative(SRC, path))) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return SCANNED.test(entry) ? [path] : [];
  });

describe('no source file carries the withdrawn rank-gap wording', () => {
  const files = sourceFiles(SRC);

  it('reads the source tree it means to scan', () => {
    expect(files.length).toBeGreaterThan(300);
  });

  for (const phrase of RANK_GAP_PHRASES)
    it(`${phrase} appears nowhere under src/`, () => {
      const hits = files.flatMap((path) => {
        const lines = readFileSync(path, 'utf8').split('\n');
        return lines.flatMap((line, index) =>
          phrase.test(line)
            ? [`${relative(SRC, path)}:${index + 1}: ${line.trim()}`]
            : [],
        );
      });
      expect(hits).toEqual([]);
    });

  it('still catches every passage it was written from', () => {
    const withdrawn = [
      'Ranked 3.0 applies both players limits at once, so that partner tops out at Emerald rather than Diamond.',
      'Book a paid session for a set time, or for the highest rank Ranked 3.0 admits beside your own.',
      'Emerald for a Gold account, because Diamond carries its own two-rank window.',
      'Do you need a set hour tonight or the top rank Ranked Play allows?',
      'Book a paid hour for a set time, or for the top rank Ranked Play admits.',
      'Activision holds Crimson and above to one rank, so Diamond reaches Crimson.',
      'Activision keeps Crimson and above in parties of one or two inside one rank, and a four-player party mixes ranks only at Diamond or below.',
      'Send your server and your division, so the coach assigned is one ranked lets you queue with.',
      'Play and Learn is sold per game: one live match beside a coach the queue accepts.',
      'A Gold player may only queue with Platinum I, and a wider gap belongs in Flex.',
      'Platinum I is the ceiling, so a Gold player cannot duo with a Challenger teammate.',
      'The rule caps a Gold duo at Platinum I, so book a five-stack instead.',
    ].map((text) => RANK_GAP_PHRASES.some((phrase) => phrase.test(text)));
    expect(withdrawn).toEqual(withdrawn.map(() => true));
  });
});
