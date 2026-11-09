import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { INDEXABLE_PATHS } from '../../src/site/seo';
import { CONTENT_SOURCES, CONTENT_UPDATED } from '../../src/site/content-dates';
import { howToSchema, officialPageSchema } from '../../src/server/seo/official';
import { renderLlms } from '../../src/server/seo/llms';
import { TERMS, PRIVACY } from '../../src/design-reference/lib/legal';
import {
  FREE_REROLLS,
  PROOF_MAX,
  PROOF_MIN,
  REROLL_MINUTES,
} from '../../src/server/seo/booking';

/**
 * The four owned "official" pages: /how-it-works, /trust-and-safety, /pricing
 * and /press.
 *
 * Each one describes how Duoly works, which means each one is a claim about the
 * product or the legal documents. This suite checks the parts a reader would
 * hold us to and the registration a new indexable page needs: the sitemap, the
 * content date, llms.txt and the schema nodes. The derived figures are checked
 * in booking-facts, price-table and press.
 */

const PAGES = {
  '/how-it-works': 'src/pages/how-it-works.astro',
  '/trust-and-safety': 'src/pages/trust-and-safety.astro',
  '/pricing': 'src/pages/pricing.astro',
  '/press': 'src/pages/press.astro',
} as const;

const source = Object.fromEntries(
  Object.entries(PAGES).map(([path, file]) => [
    path,
    readFileSync(file, 'utf8'),
  ]),
) as Record<keyof typeof PAGES, string>;

const paths = Object.keys(PAGES) as (keyof typeof PAGES)[];

/** The page's own copy, without the frontmatter imports and the JSON-LD. */
const body = (path: keyof typeof PAGES) =>
  source[path].split('---').slice(2).join('---');

describe('registration of the official pages', () => {
  it.each(paths)('lists %s in the sitemap exactly once', (path) => {
    expect(INDEXABLE_PATHS.filter((entry) => entry === path)).toEqual([path]);
  });

  it.each(paths)('declares the copy sources of %s', (path) => {
    const sources = CONTENT_SOURCES[path];
    expect(sources, path).toBeTruthy();
    expect(sources).toContain(PAGES[path]);
    expect(CONTENT_UPDATED[path], path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(paths)('links %s from llms.txt with a description', (path) => {
    const line = renderLlms()
      .split('\n')
      .find((entry) => entry.includes(`https://duoly.gg${path})`));
    expect(line, path).toBeTruthy();
    // "- [Name](url): description", with a description worth reading.
    expect(line!.split('): ')[1]!.length, path).toBeGreaterThan(40);
  });

  it.each(paths)('sets an indexable self-canonical title on %s', (path) => {
    const page = source[path];
    expect(page).toContain('indexing="index, follow"');
    const title = page.match(/^const title = '(.+)';$/m)?.[1];
    expect(title, path).toBeTruthy();
    // Google truncates past 60 characters, and scripts/seo-built.test.mjs
    // enforces the same ceiling on the built page.
    expect(title!.length, `${path}: ${title}`).toBeLessThanOrEqual(60);
    expect(title!.endsWith(' | Duoly'), path).toBe(true);
  });
});

describe('the customer copy rules on the official pages', () => {
  it.each(paths)('writes %s without dashes or ampersands', (path) => {
    const text = body(path)
      // Game and service names come from the catalog, which uses "&" and is
      // never edited here; src/server/seo/offers.ts cleanCopy strips it before
      // render, and tests/unit/price-table.test.ts proves that.
      .replace(/<[^>]+>/g, ' ');
    expect(text, path).not.toMatch(/[–—]/);
    expect(text, path).not.toMatch(/ & /);
    expect(text, path).not.toMatch(/\bnot [^.?!]{3,40}, but /i);
  });

  it.each(paths)('asks a question in every section heading on %s', (path) => {
    const headings = [...body(path).matchAll(/<h2 id="([^"]+)">([^<]*)/g)]
      .map((match) => match[2]!.trim())
      .filter(Boolean);
    expect(headings.length, path).toBeGreaterThan(3);
    // Answer-first pages: a section heading is the question its first sentence
    // answers. Headings built from an expression are checked by the built-page
    // citability gate instead.
    for (const heading of headings)
      expect(heading.endsWith('?'), `${path}: ${heading}`).toBe(true);
  });
});

describe('what the official pages quote from the legal documents', () => {
  const terms = JSON.stringify(TERMS);
  const privacy = JSON.stringify(PRIVACY);
  const normalise = (text: string) =>
    text.replaceAll('’', "'").replace(/\s+/g, ' ');

  it('quotes the refund rule verbatim where it quotes it', () => {
    const sentence =
      'No-show, a teammate leaving, toxic behaviour: report it from your order room. A real person reviews it and can refund the order to your balance.';
    expect(normalise(terms)).toContain(normalise(sentence));
    for (const path of ['/how-it-works'] as const)
      expect(normalise(body(path)), path).toContain(normalise(sentence));
  });

  it('states rules the terms really contain', () => {
    for (const rule of [
      // Conduct, payment and age rules /trust-and-safety summarises.
      'never ask for, give or use someone else’s login',
      'not cheat, script, exploit or use third-party tools the game doesn’t allow',
      'not arrange payment outside Duoly',
      'You must be at least **18 years old** to book or to work as a teammate.',
      'Teammates earn **60%** of each order’s price.',
      'Earnings are paid weekly (Friday to Friday).',
      'a wrong rank can make a session impossible to play, and isn’t a reason for a refund',
      'Prices can change over time, but never for an order you already placed.',
    ])
      expect(normalise(terms), rule).toContain(normalise(rule));
  });

  it('states payment handling the privacy policy really contains', () => {
    for (const rule of [
      'Your payment details go straight to the payment provider. We only see the amount and the method.',
      'we never ask for your game account password',
      'They don’t see your email or what you paid',
      'Orders and payment records: 7 years',
      'We reply within one month',
    ])
      expect(normalise(privacy), rule).toContain(normalise(rule));
  });

  it('names the same auto-cancel window as the terms', () => {
    expect(terms).toContain('Nobody accepts within 5 minutes');
    expect(body('/how-it-works')).toContain('AUTO_CANCEL_MINUTES');
  });

  it('describes the re-roll and proof limits from the shared facts', () => {
    const how = body('/how-it-works');
    expect(how).toContain('FREE_REROLLS');
    expect(how).toContain('REROLL_MINUTES');
    expect(how).toContain('PROOF_MIN');
    expect(how).toContain('PROOF_MAX');
    // The trust page states the window in its FAQ, which lives in the
    // frontmatter, so the whole file is the right place to look.
    expect(source['/trust-and-safety']).toContain('FREE_REROLLS');
    // Sanity on the values themselves, so the page cannot read "0 re-rolls".
    expect(FREE_REROLLS).toBeGreaterThan(0);
    expect(REROLL_MINUTES).toBeGreaterThan(0);
    expect(PROOF_MIN).toBeLessThan(PROOF_MAX);
  });
});

describe('no official page hardcodes a price', () => {
  /**
   * Prices come from the pricing engine, always. A euro figure typed into a
   * page is the one failure these pages exist to prevent, so the template may
   * not contain one at all.
   */
  it.each(paths)('%s contains no literal euro amount', (path) => {
    const matches = [...body(path).matchAll(/€\s?\d/g)].map(
      (match) => match[0],
    );
    expect(matches, path).toEqual([]);
  });

  it.each(paths)('%s contains no literal percentage', (path) => {
    // "{QUANTITY_PERCENT}%" is fine; "20%" is not. "100%" is allowed: it is
    // the whole of a refunded order, a rule from the terms rather than a
    // discount the pricing engine decides.
    const matches = [...body(path).matchAll(/(?<![{a-zA-Z_])\d+%/g)]
      .map((match) => match[0])
      .filter((match) => match !== '100%');
    expect(matches, path).toEqual([]);
  });
});

describe('the structured data of the official pages', () => {
  const site = new URL('https://duoly.gg');

  it('publishes a WebPage node tied to the one Organization', () => {
    const node = officialPageSchema(
      '/pricing',
      'Duoly Pricing',
      'Every price',
      '2026-11-09',
      site,
    );
    expect(node['@type']).toBe('WebPage');
    expect(node.url).toBe('https://duoly.gg/pricing');
    expect(node.publisher).toEqual({
      '@id': 'https://duoly.gg/#organization',
    });
    expect(node.isPartOf).toEqual({ '@id': 'https://duoly.gg/#website' });
    expect(node.dateModified).toBe('2026-11-09');
  });

  it('publishes a HowTo whose steps are positioned and anchored', () => {
    const steps = [
      { name: 'One', text: 'Pick the game.', anchor: 'steps-h' },
      { name: 'Two', text: 'Pay once.', anchor: 'steps-h' },
    ];
    const node = howToSchema(
      '/how-it-works',
      'How to book a Duoly teammate',
      'Three steps',
      steps,
      site,
    );
    expect(node['@type']).toBe('HowTo');
    expect(node.step.map((step) => step.position)).toEqual([1, 2]);
    expect(node.step[0]!.url).toBe('https://duoly.gg/how-it-works#steps-h');
    expect(node.step[1]!.name).toBe('Two');
    // No estimatedCost: a Duoly total depends on game, service and rank, so a
    // single figure on the procedure would be uncheckable.
    expect(node).not.toHaveProperty('estimatedCost');
    expect(node).not.toHaveProperty('totalTime');
  });

  it('renders the HowTo steps from the same list the page shows', () => {
    const how = body('/how-it-works');
    // One array drives the visible list and the JSON-LD, which is the only way
    // the two cannot drift apart.
    expect(source['/how-it-works']).toContain(
      'const HOW_TO_STEPS = STEPS.map(',
    );
    expect(how).toContain('steps={STEPS.map(([, text]) => text)}');
    expect(how).toContain('HOW_TO_STEPS');
  });

  it.each(paths)(
    'renders the FAQ JSON-LD from the visible items on %s',
    (path) => {
      // faqSchema maps the same [question, answer] array the Faq component
      // renders, so the JSON-LD equals the visible questions by construction.
      expect(source[path]).toContain('items={faq}');
      expect(source[path]).toContain('faqSchema(faq, path, Astro.site!)');
      const questions = [...source[path].matchAll(/^ {4}'([^']+\?)',$/gm)]
        .length;
      expect(questions, path).toBeGreaterThanOrEqual(5);
    },
  );
});
