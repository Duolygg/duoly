import { describe, expect, it } from 'vitest';
import { coachFormats } from '../../src/content/coaching-formats';
import { lessons } from '../../src/content/coaching';
import { COACHING_SLUGS } from '../../src/site/seo';
import { gameBySlug } from '../../src/site/games';
import { withPrices } from '../../src/server/seo/coaching-examples';
import { seoOffers } from '../../src/server/seo/offers';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';

const currencies = ['EUR', 'USD'] as const;
const context = (customerCurrency: (typeof currencies)[number]) => ({
  customerCurrency,
  eurToUsd: 1.17,
});

/** Every catalog service title for a game, whatever tab it sits in. */
const catalogTitles = (gameId: string) =>
  (servicesFor(gameId).modes as { title: string }[]).map((mode) =>
    // Catalog titles use a typographic ampersand; the copy spells it out.
    mode.title.replace(' & ', ' and '),
  );

describe('every coaching page describes the formats the catalog sells', () => {
  it('covers each indexed coaching slug with a lesson and a formats block', () => {
    expect(Object.keys(coachFormats).sort()).toEqual(
      [...COACHING_SLUGS].sort(),
    );
    for (const slug of COACHING_SLUGS)
      expect(lessons[slug], `${slug} lesson copy`).toBeTruthy();
  });

  it('shows three formats per game, each asking its question', () => {
    for (const [slug, copy] of Object.entries(coachFormats)) {
      expect(copy.rows, `${slug} rows`).toHaveLength(3);
      expect(copy.heading.endsWith('?'), `${slug} heading asks`).toBe(true);
      for (const row of copy.rows)
        expect([0, 1, 2, 3], `${slug} ${row.label} weight`).toContain(
          row.weight,
        );
      expect(
        copy.rows.filter((row) => row.lead),
        `${slug} marks exactly one lead format`,
      ).toHaveLength(1);
    }
  });

  // The guard that replaced the rank-rule scanner: a page may promote only what
  // the catalog actually sells for that game, so an invented format fails here.
  it('names only services the catalog sells for that game', () => {
    for (const [slug, copy] of Object.entries(coachFormats)) {
      const titles = catalogTitles(gameBySlug(slug)!.id);
      for (const row of copy.rows)
        expect(titles, `${slug}: ${row.label} is not in the catalog`).toContain(
          row.label,
        );
    }
  });

  it('fills every price token from the checkout engine, in both currencies', () => {
    for (const slug of COACHING_SLUGS)
      for (const customerCurrency of currencies) {
        const copy = coachFormats[slug]!;
        const offers = seoOffers(
          gameBySlug(slug)!.id,
          'training',
          context(customerCurrency),
        );
        for (const field of [copy.answer, copy.detail, copy.choice]) {
          const filled = withPrices(field, offers);
          expect(filled, `${slug} ${customerCurrency}`).not.toMatch(
            /\{(?:price|amount):/,
          );
          expect(filled, `${slug} ${customerCurrency}`).not.toMatch(/\{\{/);
        }
      }
  });
});
