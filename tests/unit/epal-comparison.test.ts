import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateQuote } from '../../src/server/pricing';
import { parseBookingPreferences } from '../../src/contracts/booking-link';
import {
  CHECKED,
  comparisonExample,
  comparisonRows,
  comparisonSelection,
  epalSources,
} from '../../src/content/epal-comparison';

const eur = (minor: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
    minor / 100,
  );

describe('Duoly vs E-Pal comparison', () => {
  it('shows the prices the checkout calculator charges', () => {
    const quote = calculateQuote(comparisonSelection, {
      eurToUsd: 1,
      customerCurrency: 'EUR',
    });
    expect(comparisonExample.amountMinor).toBe(quote.customer.amountMinor);
    expect(comparisonExample.price).toBe(eur(quote.customer.amountMinor));
    expect(comparisonExample.unitPrice).toBe(eur(quote.unitPriceEurMinor));
    expect(comparisonExample.discountPercent).toBe(
      quote.quantityDiscountPercent,
    );
    // The copy names these figures in prose too, so pin them.
    expect(comparisonExample.price).toBe('€10.77');
    expect(comparisonExample.unitPrice).toBe('€3.99');

    expect(comparisonExample.discountPercent).toBe(10);
    for (const [units, percent] of [
      [5, 20],
      [10, 25],
    ])
      expect(
        calculateQuote(
          { ...comparisonSelection, units },
          { eurToUsd: 1, customerCurrency: 'EUR' },
        ).quantityDiscountPercent,
      ).toBe(percent);
  });

  it('uses neutral marks for business models and unknown refund policies', () => {
    expect(
      comparisonRows.find((row) => row.label === 'Who sets the price'),
    ).toMatchObject({ duoly: 'neutral', epal: 'neutral' });
    expect(
      comparisonRows.find(
        (row) => row.label === 'Refund to the original payment method',
      ),
    ).toMatchObject({ duoly: 'yes', epal: 'unknown' });
    for (const label of [
      'Choose a specific provider before booking',
      'Public provider reviews before booking',
    ]) {
      expect(comparisonRows.find((row) => row.label === label)).toMatchObject({
        duoly: 'no',
        epal: 'yes',
      });
    }
    for (const row of comparisonRows)
      expect(epalSources.some((source) => source.url === row.epalSource)).toBe(
        true,
      );
  });

  it('books the exact example it prices', () => {
    const url = new URL(comparisonExample.href, 'https://duoly.gg');
    expect(url.searchParams.get('game')).toBe(comparisonSelection.gameId);
    expect(url.searchParams.get('service')).toBe(comparisonSelection.serviceId);
    expect(url.searchParams.get('region')).toBe(comparisonSelection.server);
    const parsed = parseBookingPreferences(
      url.searchParams,
      comparisonSelection.gameId,
      comparisonSelection.serviceId,
    );
    expect(parsed.invalid).toEqual([]);
    expect(parsed.values).toMatchObject({
      rank: comparisonSelection.rank,
      qty: comparisonSelection.units,
    });
  });

  it('keeps dated first-party E-Pal sources', () => {
    expect(CHECKED).toBe('2026-11-08');
    expect(epalSources).toHaveLength(6);
    for (const source of epalSources) {
      expect(new URL(source.url).hostname).toMatch(/(^|\.)epal\.gg$/);
      expect(source.accessed).toBe(CHECKED);
    }
  });

  it('follows the copy rules and shows no ratings or E-Pal imagery', () => {
    const page = readFileSync('src/pages/compare/e-pal.astro', 'utf8');
    const copy = page + JSON.stringify(comparisonRows);
    expect(copy).not.toMatch(/[\u2013\u2014]| & /);
    expect(copy).not.toMatch(/\bnot [^.!?\n]+, but /i);
    expect(page).toContain('Last checked {CHECKED}');
    expect(page).not.toMatch(/AggregateRating|'Review'|ratingValue/);
    expect(page).not.toMatch(/epal\.gg[^'"\s]*\.(png|svg|jpe?g|webp)/i);
  });
});
