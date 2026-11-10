import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CONNECTOR_OPENERS,
  MAX_CONNECTORS_PER_PARAGRAPH,
  STEP_WORDS,
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
 *  2. No paragraph ends on a "For example," sentence that names nothing
 *     concrete: a digit, a price token, a markdown link or a capitalised name.
 *     An example is the evidence for the sentence before it, so an example
 *     that names nothing and is never picked up again is padding. A
 *     mid-paragraph example without a number is left alone on purpose: the
 *     sentences after it do the work.
 *  3. No "Step 1" opener in prose. A real sequence goes in an ordered list,
 *     where the markers count the steps; a paragraph that numbers its own
 *     sentences is the same scaffolding rule 1 removed, wearing a number.
 *     Pointing at a real list from inside it ("No: go to step 2.") passes.
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
    // The paragraph the reviewer flagged, caught by both rules at once: three
    // openers, and it closes on an example naming neither a booking nor a
    // discount.
    const flagged =
      'Every figure above is a base price. First, your own rank moves a ranked price. Second, book 1 to 5 games. For example, a longer booking reaches the largest discount shown.';
    expect(plainCopyProblems(flagged).map((problem) => problem.rule)).toEqual([
      'too-many-connectors',
      'closing-example-names-nothing',
    ]);
    // One opener, and the example names a number: nothing to fix.
    expect(
      plainCopyProblems(
        'Every figure is a base price. For example, 5 games take 20% off.',
      ),
    ).toEqual([]);
    // An example in the middle of a paragraph is the next sentences' problem,
    // not this rule's, so it passes without a number of its own.
    expect(
      plainCopyProblems(
        'A missed shot starts before the peek. For example, the entry player turns a corner while the second player is behind a smoke. Pause the recording a second earlier.',
      ),
    ).toEqual([]);
  });

  it('rejects a numbered step opener outside a real ordered list', () => {
    expect(STEP_WORDS).toEqual(['step', 'tip', 'point']);
    // The sentences a reviewer found on the live pages: a "Step 1" that never
    // reaches a Step 2, and a numbered sentence inside a plain paragraph.
    for (const flagged of [
      'A Duoly price is set in euros. Step 1 for a dollar total is switching the currency, which the site remembers for a year.',
      'Step 1 is the report, and the terms then allow a warning or a blocked account.',
      'Choosing a coach is a sequence of 5 checks. Tip 1 is proof of rank.',
      'Booking takes three steps: choose the session, pay, then agree a time. Step 2 always happens on Duoly.',
      '**Before booking:** Point 3 is the refund rule.',
    ])
      expect(
        plainCopyProblems(flagged).map((problem) => problem.rule),
        flagged,
      ).toContain('numbered-step-in-prose');
    // A reference into a list that really is numbered, and the plain sentences
    // the pages now use instead. Neither numbers a sentence of its own.
    for (const clean of [
      'No: go to step 2.',
      'Yes: go to step 3.',
      'No: go back to step 1 and post again tomorrow. Free is enough.',
      'A dollar total needs the currency switched at checkout, which the site then remembers for a year.',
      'A rotation loses damage in 3 places: a cooldown held too long, a filler pressed during a proc window and movement spent where standing still was safe.',
    ])
      expect(plainCopyProblems(clean), clean).toEqual([]);
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
    // Every page at once, so one run names every page that needs a rewrite.
    const problems = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      // Every string literal in the file: template literals carry the prose
      // a page passes to a component, plain quotes carry the rest.
      const literals = [
        ...source.matchAll(/`((?:[^`\\]|\\.)*)`/g),
        ...source.matchAll(/'((?:[^'\\\n]|\\.)*)'/g),
        ...source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g),
      ].map((match) => match[1]!.replace(/\$\{[^}]*\}/g, '{value}'));
      return [...literals, ...markupParagraphs(source)].flatMap((paragraph) =>
        plainCopyProblems(paragraph).map(
          (problem) => `${file}: ${problem.rule}: ${problem.detail}`,
        ),
      );
    });
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

/**
 * The prose written straight into a page's markup, one paragraph per `<p>`.
 *
 * Half of the copy on these pages is not a string literal at all: it is the
 * text between the tags, with `{price}` expressions inline. Tags are dropped,
 * expressions become `{value}` (a price or a count by the time it renders) and
 * JSX spacers collapse, which leaves the sentences a reader sees.
 */
function markupParagraphs(source: string) {
  const body = source
    .replace(/^---[\s\S]*?\n---/, '')
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/g, '');
  return [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((match) =>
    match[1]!
      .replace(/\{'\s*'\}|\{' '\}/g, ' ')
      .replace(/\{[^{}]*\}/g, '{value}')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}
