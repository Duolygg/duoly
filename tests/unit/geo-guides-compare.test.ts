import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateQuote } from '../../src/server/pricing';
import { parseBookingPreferences } from '../../src/contracts/booking-link';
import { formatPrice, seoOffers } from '../../src/server/seo/offers';
import {
  coachingDirectory,
  directoryPrice,
  teammateDirectory,
} from '../../src/server/seo/directories';
import { COACHABLE_GAMES } from '../../src/server/seo/teammate-facts';
import { renderLlms } from '../../src/server/seo/llms';
import {
  COMPARE_PATHS,
  GUIDE_PATHS,
  INDEXABLE_PATHS,
} from '../../src/site/seo';
import { CONTENT_SOURCES, CONTENT_UPDATED } from '../../src/site/content-dates';
import type {
  CompareRow,
  CompareSource,
} from '../../src/content/compare-marks';
import { MARK_ICONS, MARK_WORDS } from '../../src/content/compare-marks';
import {
  METAFY_CHECKED,
  metafyExample,
  metafyRows,
  metafySelection,
  metafySources,
} from '../../src/content/metafy-comparison';
import {
  QUEUEUP_CHECKED,
  duolyShare,
  queueupExample,
  queueupRows,
  queueupSelection,
  queueupSources,
} from '../../src/content/queueup-comparison';

const EUR = { eurToUsd: 1, customerCurrency: 'EUR' as const };
const quoteOf = (selection: typeof metafySelection) =>
  calculateQuote(selection as never, EUR);

/** The pages this branch adds, with the file each one renders from. */
const PAGES: [string, string][] = [
  [
    '/blog/how-to-find-a-valorant-duo',
    'src/pages/blog/how-to-find-a-valorant-duo.astro',
  ],
  [
    '/blog/how-to-choose-a-gaming-coach',
    'src/pages/blog/how-to-choose-a-gaming-coach.astro',
  ],
  [
    '/blog/free-lfg-or-paid-teammate',
    'src/pages/blog/free-lfg-or-paid-teammate.astro',
  ],
  ['/compare/metafy', 'src/pages/compare/metafy.astro'],
  ['/compare/queueup', 'src/pages/compare/queueup.astro'],
];
const source = (file: string) => readFileSync(file, 'utf8');

describe('the November 2026 guides and comparisons', () => {
  it('prices both comparison examples through the checkout engine', () => {
    for (const [example, selection] of [
      [metafyExample, metafySelection],
      [queueupExample, queueupSelection],
    ] as const) {
      const quote = quoteOf(selection);
      expect(example.amountMinor).toBe(quote.customer.amountMinor);
      expect(example.price).toBe(
        formatPrice(quote.customer.amountMinor, 'EUR'),
      );
      // Both pages call the example an hour, so the service has to be sold by
      // the hour rather than per game.
      expect(example.unit).toBe('hour');
      const offer = seoOffers(selection.gameId, 'training', EUR).find(
        (each) => each.id === selection.serviceId,
      )!;
      expect(offer.unit).toBe(example.unit);
      expect(offer.display).toBe(example.price);
    }
    // One flat lesson price, which is the claim both comparisons make.
    expect(metafyExample.price).toBe(queueupExample.price);
    expect(directoryPrice(coachingDirectory(EUR))).toContain(
      metafyExample.price,
    );
  });

  it('books the exact example each comparison prices', () => {
    for (const [example, selection] of [
      [metafyExample, metafySelection],
      [queueupExample, queueupSelection],
    ] as const) {
      const url = new URL(example.href, 'https://duoly.gg');
      expect(url.pathname).toBe('/');
      expect(url.hash).toBe('#modes-h');
      expect(url.searchParams.get('game')).toBe(selection.gameId);
      expect(url.searchParams.get('service')).toBe(selection.serviceId);
      const parsed = parseBookingPreferences(
        url.searchParams,
        selection.gameId,
        selection.serviceId,
      );
      expect(parsed.invalid).toEqual([]);
    }
  });

  it('keeps every comparison cell attached to a dated first-party source', () => {
    for (const [rows, sources, checked, host] of [
      [metafyRows, metafySources, METAFY_CHECKED, /(^|\.)metafy\.gg$/],
      [queueupRows, queueupSources, QUEUEUP_CHECKED, /(^|\.)queueup\.gg$/],
    ] as [CompareRow[], CompareSource[], string, RegExp][]) {
      expect(checked).toBe('2026-11-09');
      expect(rows.length).toBeGreaterThanOrEqual(10);
      for (const row of rows) {
        expect(
          sources.some((item) => item.url === row.rivalSource),
          `${row.label} cites a listed source`,
        ).toBe(true);
        expect(Object.keys(MARK_ICONS)).toContain(row.duoly);
        expect(Object.keys(MARK_WORDS)).toContain(row.rival);
        expect(row.duolyNote.length).toBeGreaterThan(20);
        expect(row.rivalNote.length).toBeGreaterThan(20);
      }
      for (const item of sources) {
        expect(new URL(item.url).hostname).toMatch(host);
        expect(item.accessed).toBe(checked);
      }
      // A comparison that never credits the rival is a sales page. Each one has
      // to mark the rival ahead on something Duoly does not do today.
      expect(
        rows.filter((row) => row.duoly === 'no' && row.rival === 'yes').length,
      ).toBeGreaterThanOrEqual(3);
      // And it may never present an unverified policy as a refusal.
      for (const row of rows.filter((row) => row.rival === 'unknown'))
        expect(row.rivalNote).toMatch(/not stated|no .* is stated|without/i);
    }
  });

  it('states the facts Duoly can defend about itself', () => {
    const notes = [...metafyRows, ...queueupRows].map((row) => row.duolyNote);
    const reviews = notes.filter((note) => /review volume/.test(note));
    expect(reviews).toHaveLength(2);
    for (const note of reviews) expect(note).toContain('Duoly is new');
    expect(duolyShare).toMatch(/^\d{2}%$/);
    // No invented count: the coached-games figure comes from the catalog.
    expect(
      queueupRows.find((row) => row.label === 'Games that sell coaching')!
        .duolyNote,
    ).toBe(`${COACHABLE_GAMES} games, each at the same lesson price.`);
  });

  it('shows no hand-typed Duoly price on any new page', () => {
    for (const [path, file] of PAGES) {
      const text = source(file);
      // €0 is the price of a free community post and is not a Duoly price.
      const prices = [...text.matchAll(/€(?!0\b)[\d.,]+/g)].map((m) => m[0]);
      expect(prices, `${path} hand-types a euro price`).toEqual([]);
      expect(text).toMatch(/seoOffers|directoryPrice|Example|example/);
    }
  });

  it('follows the customer copy rules on every new page', () => {
    const copy = [
      ...PAGES.map(([, file]) => source(file)),
      source('src/content/metafy-comparison.ts'),
      source('src/content/queueup-comparison.ts'),
    ].join('\n');
    expect(copy).not.toMatch(/[–—]/);
    expect(copy).not.toMatch(/ & /);
    expect(copy).not.toMatch(/\bnot [^.!?\n]+, but /i);
    // No borrowed trust: no rating markup and no competitor imagery.
    for (const [, file] of PAGES) {
      expect(source(file)).not.toMatch(/AggregateRating|ratingValue/);
      expect(source(file)).not.toMatch(
        /(metafy|queueup)\.gg[^'"\s]*\.(png|svg|jpe?g|webp)/i,
      );
    }
  });

  it('answers first, with a question heading and a dated check', () => {
    for (const [path, file] of PAGES) {
      const text = source(file);
      const headings = [...text.matchAll(/<h2[^>]*>([^<]+)</g)].map((m) =>
        m[1]!.trim(),
      );
      expect(headings.length, `${path} has sections`).toBeGreaterThanOrEqual(4);
      expect(
        headings.filter((heading) => heading.endsWith('?')).length,
        `${path}: ${headings.join(' | ')}`,
      ).toBeGreaterThanOrEqual(3);
      // Every page dates its own claims, either in words or through the
      // CHECKED constant its sourced content module exports.
      expect(text).toMatch(/9 November 2026|Last checked \{CHECKED\}/);
      expect(text).toContain('faqSchema');
    }
  });

  it('registers all five pages for the sitemap, dates and llms.txt', () => {
    const llms = renderLlms();
    for (const path of [...GUIDE_PATHS, ...COMPARE_PATHS]) {
      expect(INDEXABLE_PATHS).toContain(path);
      expect(Object.keys(CONTENT_SOURCES)).toContain(path);
      expect(CONTENT_UPDATED[path]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(llms).toContain(`https://duoly.gg${path})`);
    }
    expect(Object.keys(CONTENT_SOURCES).sort()).toEqual(
      [...INDEXABLE_PATHS].sort(),
    );
  });

  it('links each new page from at least four pages of existing content', () => {
    const linkers = [
      'src/pages/blog/index.astro',
      'src/pages/blog/what-does-lfg-mean.astro',
      'src/pages/coaching.astro',
      'src/pages/find-gaming-buddies.astro',
      'src/pages/compare/e-pal.astro',
      'src/pages/ai.astro',
      'src/pages/games/[game]/[intent].astro',
      'src/pages/games/[game]/coaching.astro',
      ...PAGES.map(([, file]) => file),
    ].map((file) => [file, source(file)] as const);
    for (const [path] of PAGES) {
      const from = linkers
        .filter(([file]) => !file.endsWith(path + '.astro'))
        .filter(([, text]) => text.includes(`"${path}"`))
        .map(([file]) => file);
      expect(
        from.length,
        `${path} inbound from ${from.join(', ')}`,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it('offers two bookable Duoly sessions in each guide', () => {
    for (const path of GUIDE_PATHS) {
      const file = PAGES.find(([page]) => page === path)![1];
      const text = source(file);
      const offers = new Set(
        [
          ...text.matchAll(
            /bookingHref\('([a-z0-9]+)', \{ service: '(\w+)' \}/g,
          ),
        ].map((match) => `${match[1]}/${match[2]}`),
      );
      expect(
        offers.size,
        `${path}: ${[...offers].join(', ')}`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('names games that really sell what each guide points at', () => {
    const teammates = teammateDirectory(EUR).map((game) => game.slug);
    const coaching = coachingDirectory(EUR).map((game) => game.slug);
    for (const slug of ['valorant', 'marvel-rivals', 'league-of-legends'])
      expect(teammates).toContain(slug);
    for (const slug of ['valorant', 'league-of-legends', 'overwatch-2'])
      expect(coaching).toContain(slug);
  });
});
