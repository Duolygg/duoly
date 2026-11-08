import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import HeroTimer from '../../src/components/home/HeroTimer';

it('shows the hero match timer', () => {
  const html = renderToStaticMarkup(React.createElement(HeroTimer));
  expect(html).toMatch(/Finding your duo/);
  expect(html).toMatch(/2:00/);
});
import { readFileSync } from 'node:fs';

import {
  HUB_PATHS,
  INDEXABLE_PATHS,
  COACHING_SLUGS,
  OFFICIAL_PROFILES,
  SAME_AS,
  breadcrumbs,
  homeSchema,
  organizationSchema,
  serializeJsonLd,
} from '../../src/site/seo';
import { DISCORD_INVITE } from '../../src/site/nav';
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
  // Every game hub with finished copy is listed, and nothing else under /games.
  for (const path of HUB_PATHS)
    expect(urls).toContain(`https://duoly.gg${path}`);
  expect(urls.filter((url) => /\/games\/[^/]+$/.test(url!))).toHaveLength(
    HUB_PATHS.length,
  );
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

// robots.txt groups never merge: a crawler obeys only the most specific group that
// names it. So every named group has to repeat whatever the wildcard group says, or
// that crawler silently keeps access the wildcard group was meant to take away.
it('allows crawlers to read page-level indexing policies', () => {
  const robots = readFileSync('public/robots.txt', 'utf8');
  const groups = new Map<string, string[]>();
  let agents: string[] = [];
  let ruled = false;
  for (const raw of robots.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const split = line.indexOf(':');
    const directive = line.slice(0, split).trim().toLowerCase();
    const value = line.slice(split + 1).trim();
    if (directive === 'user-agent') {
      if (ruled) {
        agents = [];
        ruled = false;
      }
      agents.push(value);
      groups.set(value, groups.get(value) ?? []);
    } else if (directive === 'allow' || directive === 'disallow') {
      for (const agent of agents)
        groups
          .get(agent)!
          .push(`${directive === 'allow' ? 'Allow' : 'Disallow'}: ${value}`);
      ruled = true;
    }
  }
  expect(robots).toContain('Sitemap: https://duoly.gg/sitemap.xml\n');
  expect(groups.get('*')).toEqual(['Allow: /']);
  // Every AI crawler, AI search bot and Bing has its own group saying the same thing.
  for (const agent of [
    'GPTBot',
    'ChatGPT-User',
    'OAI-SearchBot',
    'ClaudeBot',
    'Claude-User',
    'Claude-SearchBot',
    'anthropic-ai',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'Applebot-Extended',
    'Bingbot',
    'Bytespider',
    'CCBot',
    'FacebookBot',
    'Amazonbot',
  ])
    expect(groups.get(agent), agent).toEqual(['Allow: /']);
  // Keep every group identical, so no crawler escapes a rule meant for all of them.
  for (const [agent, rules] of groups)
    expect(rules, agent).toEqual(groups.get('*'));
});

it('publishes one Organization entity with only profiles we really own', () => {
  const site = new URL('https://duoly.gg');
  const organization = organizationSchema(site);
  expect(organization['@id']).toBe('https://duoly.gg/#organization');
  expect(organization.logo).toBe('https://duoly.gg/icon-512.png');
  expect(organization.description.length).toBeGreaterThan(50);
  // Only accounts that exist. An empty slot in OFFICIAL_PROFILES never reaches sameAs.
  expect(SAME_AS).toEqual([DISCORD_INVITE]);
  expect(organization.sameAs).toEqual(SAME_AS);
  for (const url of SAME_AS) expect(url).toMatch(/^https:\/\//);
  expect(SAME_AS.join(' ')).not.toMatch(/wikipedia|wikidata/i);
  expect(Object.keys(OFFICIAL_PROFILES)).toContain('x');
  // The whole point of the shared constant: one edit reaches every Organization node.
  const home = JSON.parse(serializeJsonLd(homeSchema(site)))['@graph'][0];
  expect(home).toEqual(organization);
  const service = JSON.parse(
    serializeJsonLd(
      serviceSchema(
        'Valorant',
        '/games/valorant',
        seoOffers('valorant', 'training', {
          customerCurrency: 'EUR',
          eurToUsd: 1.12,
        }),
        site,
      ),
    ),
  );
  expect(service.provider).toEqual(organization);
});
