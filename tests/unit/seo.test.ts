import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import HeroTimer from '../../src/components/home/HeroTimer';

it('does not simulate matching or claim an unmeasured wait time', () => {
  const html = renderToStaticMarkup(React.createElement(HeroTimer));
  expect(html).not.toMatch(/2:00|Duo found|Finding your duo/);
});
import { readFileSync } from 'node:fs';

import {
  INDEXABLE_PATHS,
  COACHING_SLUGS,
  breadcrumbs,
  homeSchema,
  serializeJsonLd,
} from '../../src/site/seo';
import { seoOffers, serviceSchema } from '../../src/server/seo/offers';
import { gameBySlug } from '../../src/site/games';
import { calculateQuote } from '../../src/server/pricing';
import { GET } from '../../src/pages/sitemap.xml';
import type { APIContext } from 'astro';

it('lists only finished canonical URLs from the configured site', async () => {
  const response = await GET({
    site: new URL('https://duoly.gg'),
    url: new URL('https://attacker.example/sitemap.xml'),
  } as APIContext);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  expect(urls).toEqual(
    INDEXABLE_PATHS.map((path) => `https://duoly.gg${path}`),
  );
  expect(xml).not.toMatch(/attacker|imprint|checkout|login|dashboard/);
  expect(urls).not.toContain('https://duoly.gg/games/fortnite');
});

it.each(['EUR', 'USD'] as const)(
  'uses actual checkout pricing and matching schema for %s',
  (currency) => {
    for (const slug of [...COACHING_SLUGS, 'social', 'valorant']) {
      const game = gameBySlug(slug)!;
      const offers = seoOffers(game.id, slug === 'social' ? 'gg' : 'training', {
        customerCurrency: currency,
        eurToUsd: 1.12,
      });
      expect(offers.length).toBeGreaterThan(0);
      for (const offer of offers) {
        const quote = calculateQuote(offer.selection, {
          customerCurrency: currency,
          eurToUsd: 1.12,
        });
        expect(offer.amountMinor).toBe(quote.customer.amountMinor);
        expect(offer.price).toBe((quote.customer.amountMinor / 100).toFixed(2));
      }
      const schema = JSON.parse(
        serializeJsonLd(
          serviceSchema(
            game.name,
            `/games/${slug}`,
            offers,
            new URL('https://duoly.gg'),
          ),
        ),
      );
      expect(
        schema.offers.map((offer: { price: string }) => offer.price),
      ).toEqual(offers.map((offer) => offer.price));
    }
  },
);

it('safely serializes parseable breadcrumb and home schemas', () => {
  const site = new URL('https://duoly.gg');
  expect(JSON.parse(serializeJsonLd(homeSchema(site)))['@graph']).toHaveLength(
    2,
  );
  const value = breadcrumbs([{ name: '</script>', path: '/games' }], site);
  expect(serializeJsonLd(value)).not.toContain('</script>');
  expect(JSON.parse(serializeJsonLd(value)).itemListElement[0].item).toBe(
    'https://duoly.gg/games',
  );
});

it('keeps both layout policies private by default and uses a canonical', () => {
  for (const name of ['SiteLayout', 'BaseLayout']) {
    const source = readFileSync(`src/layouts/${name}.astro`, 'utf8');
    expect(source).toContain("indexing = 'noindex, nofollow'");
    expect(source).toContain('content={indexing}');
    expect(source.match(/rel="canonical"/g)).toHaveLength(1);
  }
});

it('allows crawlers to read page-level indexing policies', () => {
  expect(readFileSync('public/robots.txt', 'utf8')).toBe(
    'User-agent: *\nAllow: /\n\nSitemap: https://duoly.gg/sitemap.xml\n',
  );
});
