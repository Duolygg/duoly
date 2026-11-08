import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { COACHING_SLUGS } from '../../src/site/seo';
import { gameBySlug } from '../../src/site/games';
import { intentPages, intentPath } from '../../src/content/intent-pages';
import { intentOffers } from '../../src/server/seo/intent-offers';
import {
  activityPriceSummary,
  priceSummary,
  seoOffers,
} from '../../src/server/seo/offers';

const context = { customerCurrency: 'EUR' as const, eurToUsd: 1 };
const pages = [
  ...COACHING_SLUGS.map((slug) => ({
    path: `/games/${slug}/coaching`,
    offers: seoOffers(gameBySlug(slug)!.id, 'training', context),
    coach: true,
  })),
  ...intentPages.map((page) => ({
    path: intentPath(page),
    offers: intentOffers(page, gameBySlug(page.gameSlug)!.id, context),
    coach: false,
  })),
  ...(['valorant', 'social'] as const).map((slug) => ({
    path: `/games/${slug}`,
    offers: seoOffers(
      gameBySlug(slug)!.id,
      slug === 'social' ? 'gg' : 'teammate',
      context,
    ),
    coach: false,
  })),
];

it.each(pages)(
  '$path summary prices cover every service unit',
  ({ offers }) => {
    const summary = priceSummary(offers);
    for (const unit of new Set(offers.map((offer) => offer.unit))) {
      const cheapest = offers
        .filter((offer) => offer.unit === unit)
        .sort((a, b) => a.amountMinor - b.amountMinor)[0]!;
      expect(summary).toContain(`per ${unit}`);
      expect(summary).toContain(cheapest.display);
    }
    if (new Set(offers.map((offer) => offer.unit)).size > 1) {
      expect(summary).not.toMatch(/^From .* per game$/);
    }
  },
);

it.each(pages)(
  '$path flat-price intro associates each service with its own price and unit',
  ({ offers, coach }) => {
    if (offers.some((offer) => offer.rank)) return;
    const summary = activityPriceSummary(offers, coach);
    for (const offer of offers) {
      const clause = summary
        .split('; ')
        .find((part) => part.includes(offer.title));
      expect(clause).toContain(`${offer.display} per ${offer.unit}`);
    }
    expect(summary).not.toMatch(/[–—]| & |\+s\b|not .*, but /);
    if (coach && new Set(offers.map((offer) => offer.provider)).size === 1) {
      expect(summary).toContain(`${offers[0]!.provider} coaches`);
    }
  },
);

it('keeps different per-unit minimum prices attached to their own units', () => {
  const offers = seoOffers('val', 'training', context).map((offer) =>
    offer.unit === 'hour'
      ? { ...offer, amountMinor: 1799, display: '€17.99', price: '17.99' }
      : offer,
  );
  expect(priceSummary(offers)).toBe('From €12.99 per game or €17.99 per hour');
  expect(activityPriceSummary(offers, true)).toBe(
    'Play and Learn is €12.99 per game; VOD Review and Aim and Crosshair are €17.99 per hour with Immortal+ coaches.',
  );
});

it('uses converted checkout prices for mixed-unit USD summaries', () => {
  const offers = seoOffers('val', 'training', {
    customerCurrency: 'USD',
    eurToUsd: 1.12,
  });
  expect(priceSummary(offers)).toBe(
    `From ${offers[0]!.display} per game or per hour`,
  );
  for (const offer of offers) {
    expect(activityPriceSummary(offers, true)).toContain(
      `${offer.display} per ${offer.unit}`,
    );
  }
});

it('uses the tested price answer in the rendered service list', () => {
  const source = readFileSync('src/components/seo/Prices.astro', 'utf8');
  expect(source).toContain('pricesAnswer(gameId, offers, coach)');
  expect(source).not.toContain('Every activity is');
});
