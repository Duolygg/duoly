import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import HeroTimer from '../../src/components/home/HeroTimer';

it('shows the hero match timer', () => {
  const html = renderToStaticMarkup(React.createElement(HeroTimer));
  expect(html).toMatch(/Finding your duo/);
  expect(html).toMatch(/2:00/);
});
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

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
import {
  CONTENT_SOURCES,
  CONTENT_UPDATED,
  lastmodProblem,
} from '../../src/site/content-dates';
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
  // Every URL carries a lastmod, and no lastmod is today-by-accident: the
  // sitemap renders per request, so a request-time date would show up here.
  const stamps = [...xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map(
    (match) => match[1]!,
  );
  expect(stamps).toHaveLength(INDEXABLE_PATHS.length);
  for (const stamp of stamps) expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

/**
 * lastmod has to mean "the day this page's copy changed". The runtime value is
 * declared in src/site/content-dates.ts, so this is the check that holds the
 * declaration to what git records for that copy, under the window
 * `lastmodProblem` documents.
 *
 * A source file with uncommitted edits is being changed right now, so its page
 * has to claim today. That is also the date to commit it on, which is what
 * keeps the two in step.
 */
it('derives every sitemap lastmod from the real content change date', () => {
  const git = (args: string[]) =>
    spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8' });
  const probe = git(['rev-parse', '--is-shallow-repository']);
  if (probe.status !== 0) {
    expect(probe.error?.message ?? probe.stderr).toBeTruthy();
    return; // No git in this environment: nothing to compare against.
  }
  expect(
    probe.stdout.trim(),
    'shallow clone: fetch full history so lastmod can be verified',
  ).toBe('false');
  const today = new Date().toISOString().slice(0, 10);
  const dirty = new Set(
    git(['status', '--porcelain', '--'])
      .stdout.split('\n')
      .map((line) => line.slice(3).trim())
      .filter(Boolean),
  );
  // Every indexable path declares its sources, and nothing declares sources it
  // does not need: a stale entry here would silently stop verifying a page.
  expect(Object.keys(CONTENT_SOURCES).sort()).toEqual(
    [...INDEXABLE_PATHS].sort(),
  );
  // Committer dates of the two newest commits that touched any of the page's
  // own copy files. Two, because the window's floor is the change before the
  // newest one.
  const history = (files: string[]) =>
    git(['log', '-2', '--format=%cs', '--', ...files])
      .stdout.split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  const problems: string[] = [];
  for (const [path, files] of Object.entries(CONTENT_SOURCES)) {
    for (const file of files)
      expect(existsSync(file), `${path}: missing source ${file}`).toBe(true);
    if (files.some((file) => dirty.has(file))) {
      if (CONTENT_UPDATED[path] !== today)
        problems.push(
          `${path}: its copy has uncommitted edits, so lastmod has to be today (${today}), not ${CONTENT_UPDATED[path]}. Set CONTENT_UPDATED['${path}'] to '${today}'.`,
        );
      continue;
    }
    const [landed, previous] = history(files);
    if (!landed) {
      problems.push(`${path}: no git history for ${files.join(', ')}`);
      continue;
    }
    const problem = lastmodProblem(CONTENT_UPDATED[path], { landed, previous });
    if (problem) problems.push(`${path}: ${problem}.`);
  }
  expect(problems).toEqual([]);
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
