import { describe, expect, it } from 'vitest';

import {
  renderPricingMarkdown,
  servicePriceLine,
} from '../../src/server/seo/pricing-md';
import { GET, prerender } from '../../src/pages/pricing.md';
import { calculateQuote } from '../../src/server/pricing';
import { formatPrice, offerSelection } from '../../src/server/seo/offers';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';
import { ranksOf } from '../../src/design-reference/lib/ranks.js';
import { SITE_GAMES } from '../../src/site/games';
import { FINISHED_HUB_SLUGS } from '../../src/content/hub-pages';
import { DISAMBIGUATION } from '../../src/site/entity';
import {
  BUNDLE_DISCOUNT_PERCENT,
  BUNDLE_UNITS,
} from '../../src/contracts/pricing';
import { CATALOG_PRICES_UPDATED } from '../../src/server/seo/fees';
import { INDEXABLE_PATHS } from '../../src/site/seo';

const EUR = { customerCurrency: 'EUR' as const, eurToUsd: 1 };
const text = renderPricingMarkdown();

type Mode = { id: string; cat: string; title: string; tier: string };
const modesOf = (gameId: string) =>
  ((servicesFor(gameId) as { modes?: Mode[] }).modes ?? []) as Mode[];

const enginePrice = (gameId: string, mode: Mode, rank?: string) => {
  const result = calculateQuote(
    {
      gameId,
      serviceId: mode.id,
      units: 1,
      ...offerSelection(gameId, mode.id),
      ...(rank ? { rank } : {}),
    } as Parameters<typeof calculateQuote>[0],
    EUR,
  );
  return {
    display: formatPrice(result.customer.amountMinor, 'EUR'),
    unit: result.unit,
  };
};

/**
 * /pricing.md is the whole price list as plain markdown, and its only claim to
 * being worth citing is that it is right. So this suite re-derives every price
 * on every line from `calculateQuote`, the function checkout charges on. A
 * catalog edit either shows up in the document or breaks the build.
 */
describe('the generated /pricing.md document', () => {
  it('is served as plain text from the function, not as a download', async () => {
    // Deliberately not prerendered: a static .md would be served as
    // text/markdown and a browser would download it. See src/pages/pricing.md.ts.
    expect(prerender).toBe(false);
    const response = await GET({} as Parameters<typeof GET>[0]);
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8',
    );
    expect(await response.text()).toBe(text);
    // Machine-readable, so it stays out of the sitemap like /llms.txt does.
    expect(INDEXABLE_PATHS).not.toContain('/pricing.md');
  });

  it('opens with the definition, the disambiguation and the price date', () => {
    expect(text.startsWith('# Duoly pricing\n')).toBe(true);
    expect(text).toContain(DISAMBIGUATION);
    expect(text).toContain(`Catalog prices as of ${CATALOG_PRICES_UPDATED}`);
    expect(text).toContain('https://duoly.gg/fees-and-refunds');
    expect(text).toContain('https://duoly.gg/about');
    expect(text).toContain('https://duoly.gg/terms');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('follows the customer copy rules', () => {
    // No en or em dash, no ampersand as a word, no "not X, but Y".
    expect(text).not.toMatch(/[–—]| & |not .*, but /i);
  });

  it('states the bundle discounts the pricing contract defines', () => {
    for (const units of BUNDLE_UNITS)
      expect(text).toContain(
        `${units} units ${BUNDLE_DISCOUNT_PERCENT[units]}% off`,
      );
  });

  it('lists every game in the catalog exactly once', () => {
    for (const game of SITE_GAMES)
      expect(
        text.match(new RegExp(`^### ${game.name}$`, 'gm')),
        game.name,
      ).toHaveLength(1);
    expect(text.match(/^### /gm)).toHaveLength(SITE_GAMES.length);
  });

  it('links a game page only where a finished hub exists', () => {
    for (const game of SITE_GAMES) {
      const link = `Game page: https://duoly.gg/games/${game.slug}`;
      if (FINISHED_HUB_SLUGS.includes(game.slug)) expect(text).toContain(link);
      else expect(text).not.toContain(link);
    }
  });

  it('prints every bookable service with its own line', () => {
    for (const game of SITE_GAMES)
      for (const mode of modesOf(game.id))
        expect(text, `${game.name} ${mode.title}`).toContain(
          `- ${mode.title.replaceAll('&', 'and')} (`,
        );
  });
});

describe('every price in /pricing.md against the pricing engine', () => {
  const cases = SITE_GAMES.flatMap((game) =>
    modesOf(game.id).map((mode) => ({
      name: `${game.name} ${mode.title}`,
      gameId: game.id,
      mode,
    })),
  );

  it.each(cases)('$name', ({ gameId, mode }) => {
    const line = servicePriceLine(gameId, mode);
    // The line is in the document verbatim, so testing the line tests the file.
    expect(text).toContain(line);
    const ranks = ranksOf(gameId, mode.id) as string[];
    if (!ranks.length) {
      const { display, unit } = enginePrice(gameId, mode);
      expect(line).toBe(`${display} per ${unit}`);
      return;
    }
    // Expand the grouped line back into one price per rank and compare each one
    // with the engine, so grouping can never hide a wrong figure.
    const groups = line.split('; ').map((group) => {
      const match = /^(€[\d.]+) per (game|hour) at (.+)$/.exec(group);
      expect(match, group).not.toBeNull();
      const [, display, unit, labels] = match!;
      return {
        display: display!,
        unit: unit!,
        ranks: labels!.split(' / '),
      };
    });
    // The groups name the catalog's ranks in order, with no gap and no extra.
    expect(groups.flatMap((group) => group.ranks)).toEqual(
      ranks.map((rank) => rank.replaceAll('&', 'and').replace(/[–—]/g, ' to ')),
    );
    let index = 0;
    for (const group of groups)
      for (let seen = 0; seen < group.ranks.length; seen += 1) {
        const rank = ranks[index]!;
        const { display, unit } = enginePrice(gameId, mode, rank);
        expect(display, `${mode.title} ${rank}`).toBe(group.display);
        expect(unit, `${mode.title} ${rank}`).toBe(group.unit);
        index += 1;
      }
    expect(index).toBe(ranks.length);
  });
});
