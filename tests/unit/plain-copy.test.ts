import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CONNECTOR_OPENERS,
  MAX_CONNECTORS_PER_PARAGRAPH,
  copyStrings,
  plainCopyProblems,
} from '../../src/content/plain-copy';
import { GAME_HUBS } from '../../src/content/game-hubs';
import { intentPages } from '../../src/content/intent-pages';
import { GUIDE_PAGES } from '../../src/content/guide-pages';
import { lessons } from '../../src/content/coaching';
import { coachFormats } from '../../src/content/coaching-formats';
import { sessionExamples } from '../../src/content/coaching-examples';
import { socialContent } from '../../src/content/hubs';
import { ABOUT_STORY } from '../../src/content/about-story';
import { seoOffers } from '../../src/server/seo/offers';
import {
  closingAnswer,
  closingDetail,
  priceNote,
  pricesAnswer,
  quantityAnswer,
} from '../../src/server/seo/citable-answers';
import {
  BOOKING_REASSURANCE,
  COACHING_REASSURANCE,
} from '../../src/server/seo/reassurance';
import { SITE_GAMES } from '../../src/site/games';

/**
 * The plain-language guard. src/content/plain-copy.ts states the two rules and
 * why they exist; this file applies them to every string a reader can see.
 *
 *  1. At most one "First," / "Second," / "Third," / "For example," opener per
 *     paragraph. A paragraph with three of them is a scorer's outline, not
 *     prose, and the list components already number real sequences.
 *  2. Every "For example," sentence names something concrete: a digit, a price
 *     token, a markdown link or a capitalised name. An example that names
 *     nothing is not an example. This also bans a paragraph that ends on
 *     "For example, a longer booking reaches the largest discount shown.",
 *     because the rule holds wherever the sentence sits.
 *
 * Copy objects are walked whole, so a new game hub or guide is covered the day
 * it is added. Astro pages are scanned as source text for their own string
 * literals, which is where their prose with price tokens lives.
 */

const report = (label: string, paragraphs: string[]) => {
  const problems = paragraphs.flatMap((paragraph) =>
    plainCopyProblems(paragraph).map(
      (problem) => `${problem.rule}: ${problem.detail}`,
    ),
  );
  expect(problems, `${label}\n${problems.join('\n')}`).toEqual([]);
};

describe('copy reads like a player wrote it', () => {
  it('states the rule it enforces', () => {
    expect(CONNECTOR_OPENERS).toEqual([
      'First,',
      'Second,',
      'Third,',
      'For example,',
    ]);
    expect(MAX_CONNECTORS_PER_PARAGRAPH).toBe(1);
    // The sentence the reviewer flagged, and the fixed version beside it.
    expect(
      plainCopyProblems(
        'Every figure is a base price. For example, a longer booking reaches the largest discount shown.',
      ).map((problem) => problem.rule),
    ).toEqual(['example-names-nothing']);
    expect(
      plainCopyProblems(
        'Every figure is a base price. For example, 5 games take 20% off.',
      ),
    ).toEqual([]);
    expect(
      plainCopyProblems('First, pick the mode. Second, read the rank list.')
        .map((problem) => problem.rule)
        .sort(),
    ).toEqual(['too-many-connectors']);
  });

  for (const hub of GAME_HUBS)
    it(`${hub.gameSlug} hub copy`, () =>
      report(hub.gameSlug, copyStrings(hub)));

  for (const page of intentPages)
    it(`${page.gameSlug} intent copy`, () =>
      report(page.gameSlug, copyStrings(page)));

  for (const guide of GUIDE_PAGES)
    it(`${guide.gameSlug} guide copy`, () =>
      report(guide.gameSlug, copyStrings(guide)));

  for (const [slug, lesson] of Object.entries(lessons))
    it(`${slug} coaching copy`, () => report(slug, copyStrings(lesson)));

  for (const [slug, formats] of Object.entries(coachFormats))
    it(`${slug} coaching formats`, () => report(slug, copyStrings(formats)));

  it('coaching session examples, Social hub and the about story', () => {
    report('session examples', copyStrings(sessionExamples));
    report('social hub', copyStrings(socialContent));
    report('about story', copyStrings(ABOUT_STORY));
  });

  it('shared booking answers, for every game and category', () => {
    const context = { eurToUsd: 1.17, customerCurrency: 'EUR' as const };
    const paragraphs = [BOOKING_REASSURANCE, COACHING_REASSURANCE];
    for (const game of SITE_GAMES) {
      for (const category of ['teammate', 'other', 'gg', 'training'] as const) {
        const offers = seoOffers(game.id, category, context);
        if (!offers.length) continue;
        const coach = category === 'training';
        paragraphs.push(
          pricesAnswer(game.id, offers, coach),
          quantityAnswer(offers),
          closingDetail(offers),
          priceNote(offers, coach),
        );
      }
      paragraphs.push(closingAnswer(game.name));
    }
    report('shared answers', paragraphs);
  });

  it('prose in the SEO pages and their components', () => {
    const files = [
      ...globSync('src/pages/**/*.astro'),
      ...globSync('src/components/seo/*.astro'),
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      // Every string literal in the file: template literals carry the prose
      // with price tokens, plain quotes carry the rest.
      const literals = [
        ...source.matchAll(/`((?:[^`\\]|\\.)*)`/g),
        ...source.matchAll(/'((?:[^'\\\n]|\\.)*)'/g),
        ...source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g),
      ].map((match) => match[1]!.replace(/\$\{[^}]*\}/g, '{value}'));
      report(file, literals);
    }
  });
});
