/* global URL, document, innerWidth, getComputedStyle, location, fetch */
// Run after pnpm build, scripts/seo-preview.mjs and scripts/seo-audit.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import process from 'node:process';
const base = process.env.SEO_BASE || 'http://127.0.0.1:4381';
const { pages, sitemapEntries } = JSON.parse(
  readFileSync('.vercel/seo-audit/report.json', 'utf8'),
);
const indexed = Object.entries(pages).filter(
  ([, p]) => p.robots === 'index, follow',
);
const coaches = [
  'valorant',
  'league-of-legends',
  'rocket-league',
  'fortnite',
  'teamfight-tactics',
  'apex-legends',
  'marvel-rivals',
];
function link(source, target) {
  assert(
    pages[source]?.links.some(
      (l) =>
        l.path === target &&
        l.text &&
        !/^(click here|learn more)$/i.test(l.text),
    ),
    `${source} -> ${target}`,
  );
}
for (const [path, page] of indexed) {
  test(`production HTML metadata, JSON-LD and reachability: ${path}`, () => {
    assert.equal(page.status, 200);
    assert.equal(page.canonical, 'https://duoly.gg' + path);
    assert.equal(page.h1.length, 1);
    assert(!page.toolbar);
    assert(page.depth <= 3);
    assert(page.inbound.length >= 2);
    assert.equal(page.socialMeta['og:title'], page.title);
    assert.equal(page.socialMeta['twitter:title'], page.title);
    assert.equal(page.socialMeta['og:description'], page.description);
    assert.equal(page.socialMeta['twitter:description'], page.description);
    // The homepage title and description are the owner's design (CONTRIBUTING.md,
    // "Protected design"), so length targets apply to the SEO pages only.
    if (path !== '/') assert(page.title.length <= 60, `${path}: title length`);
    if (
      path === '/games' ||
      path.startsWith('/games/') ||
      path.startsWith('/blog/')
    )
      assert(
        page.description.length >= 140 && page.description.length <= 160,
        `${path}: description length ${page.description.length}`,
      );
    for (let i = 1; i < page.headings.length; i++)
      assert(page.headings[i].level <= page.headings[i - 1].level + 1);
    // Parse the scripts from the actual built HTML, not source helper objects.
    const html = readFileSync(
      `.vercel/seo-audit/${path === '/' ? 'home' : path.slice(1).replaceAll('/', '__')}.html`,
      'utf8',
    );
    const scripts = [
      ...html.matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
      ),
    ].map((m) => JSON.parse(m[1]));
    assert.deepEqual(scripts, page.schemas);
    if (path === '/')
      assert.deepEqual(
        scripts[0]['@graph'].map((s) => s['@type']),
        ['Organization', 'WebSite'],
      );
    const service = scripts.find((s) => s['@type'] === 'Service');
    if (service)
      assert.deepEqual(
        service.offers.map((o) => Number(o.price) * 100).map(Math.round),
        page.prices.map((p) => Number(p.minor)),
      );
    const crumbs = scripts.find((s) => s['@type'] === 'BreadcrumbList');
    if (crumbs)
      assert.deepEqual(
        crumbs.itemListElement.map((item) => ({
          name: item.name,
          path: new URL(item.item).pathname,
        })),
        page.breadcrumb,
      );
    if (path === '/blog/what-is-an-egirl') {
      const article = scripts.find((s) => s['@type'] === 'Article');
      assert.equal(article.author.name, 'Duoly');
      assert.equal(article.author['@type'], 'Organization');
      assert(article.datePublished && article.dateModified && article.image);
    }
  });
}
test('sitemap has exactly the indexable self-canonical 200 URLs in both directions', () => {
  assert.deepEqual(
    sitemapEntries.map((e) => new URL(e.url).pathname).sort(),
    indexed.map(([path]) => path).sort(),
  );
  for (const entry of sitemapEntries) {
    assert.match(entry.lastmod, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(pages[new URL(entry.url).pathname].canonical, entry.url);
  }
  assert.equal(
    new Set(sitemapEntries.map((e) => e.url)).size,
    sitemapEntries.length,
  );
});
const intentRoutes = [
  ['league-of-legends', 'play-with-someone', 'lol', 'norm'],
  ['marvel-rivals', 'duo-partner', 'mr', 'quick'],
  ['pokemon-unite', 'teammate', 'pu', 'quick'],
];
for (const [game, slug, id, serviceId] of intentRoutes) {
  const path = `/games/${game}/${slug}`;
  test(`intent page content, prices, booking and editorial links: ${path}`, () => {
    const page = pages[path];
    assert(page, `crawl discovered ${path}`);
    const service = page.schemas.find(
      (schema) => schema['@type'] === 'Service',
    );
    assert(service && service.offers.length > 0);
    link('/games', path);
    link(`/games/${game}`, path);
    for (const [other, otherSlug] of intentRoutes) {
      if (other !== game) {
        const target = `/games/${other}/${otherSlug}`;
        assert(page.editorialLinks.includes(target));
      }
    }
    if (game !== 'pokemon-unite') link(`/games/${game}/coaching`, path);
    const html = readFileSync(
      `.vercel/seo-audit/${path.slice(1).replaceAll('/', '__')}.html`,
      'utf8',
    );
    // Price cards contain nested articles. Slice through the outer closing article.
    const start = html.search(/<article\b[^>]*\bdata-intent-page(?:\s|=|>)/);
    assert(start >= 0, 'server-rendered intent article');
    const content = html.slice(start, html.lastIndexOf('</article>'));
    const text = content
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#\d+;|&[a-z]+;/gi, ' ');
    const wordCount = text.trim().split(/\s+/).length;
    assert(
      wordCount >= 600 && wordCount <= 1000,
      `${path}: ${wordCount} words`,
    );
    assert((html.match(/<details/g) || []).length >= 5, 'visible FAQs');
    assert.match(
      html,
      new RegExp(`game=${id}(?:&amp;|&)service=${serviceId}#modes-h`),
    );
    assert.match(html, /data-cta="closing"/);
    assert.equal(
      sitemapEntries.find((entry) => entry.url === `https://duoly.gg${path}`)
        .lastmod,
      '2026-11-06',
    );
  });
}

test('intent heroes fit desktop and mobile without changing shared navigation', async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        javaScriptEnabled: false,
      });
      for (const [game, slug] of intentRoutes) {
        const path = `/games/${game}/${slug}`;
        await page.goto(base + path);
        await page.evaluate(() => document.fonts.ready);
        const layout = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          priceBottom: document
            .querySelector('.hero-price')
            .getBoundingClientRect().bottom,
          actions: [...document.querySelectorAll('.hero-actions a')].map(
            (el) => {
              const { left, right, bottom } = el.getBoundingClientRect();
              return { left, right, bottom };
            },
          ),
          leadingSeparators: [
            ...document.querySelectorAll('nav[aria-label="Breadcrumb"] li'),
          ].some(
            (el) =>
              !['none', 'normal'].includes(
                getComputedStyle(el, '::before').content,
              ),
          ),
        }));
        assert.equal(
          layout.overflow,
          false,
          `${path}: horizontal overflow at ${width}`,
        );
        assert(layout.priceBottom < 667, `${path}: price above mobile fold`);
        for (const action of layout.actions) {
          assert(
            action.left >= 0 && action.right <= width && action.bottom < 844,
            `${path}: CTA fits at ${width}`,
          );
        }
        assert.equal(
          layout.leadingSeparators,
          false,
          `${path}: no orphaned leading slash`,
        );
      }
      await page.close();
    }
    const page = await browser.newPage({ javaScriptEnabled: false });
    for (const path of Object.keys(pages)) {
      await page.goto(base + path);
      const forbidden = await page.evaluate(() => {
        const selector =
          'a[href$="/play-with-someone"], a[href$="/duo-partner"], a[href$="/teammate"]';
        return [...document.querySelectorAll(selector)]
          .filter(
            (el) =>
              !el.closest('main') ||
              el.closest('nav:not(.related):not([aria-label="Breadcrumb"])') ||
              location.pathname === '/',
          )
          .map((el) => el.getAttribute('href'));
      });
      assert.deepEqual(
        forbidden,
        [],
        `${path}: no shared navigation or homepage intent links`,
      );
    }
  } finally {
    await browser.close();
  }
});
test('unknown intent routes are real 404s and the IndexNow key is public', async () => {
  for (const path of [
    '/games/league-of-legends/unknown-intent',
    '/games/unknown-game/teammate',
  ]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  const key = 'ef93dbc5aa33702f80250d826948b1cf';
  const response = await fetch(`${base}/${key}.txt`);
  assert.equal(response.status, 200);
  assert.equal((await response.text()).trim(), key);
});

test('all crawled internal anchor targets resolve without a 404', () => {
  for (const [path, p] of Object.entries(pages))
    assert(p.status < 400, `${path}: ${p.status}`);
});
test('required editorial links and two related coaching pages exist', () => {
  // Homepage and footer links are owner-designed; coaching pages are reached via /games.
  for (const slug of coaches) {
    const path = `/games/${slug}/coaching`;
    link('/games', path);
    link('/games', `/games/${slug}`);
    link(`/games/${slug}`, path);
    link(path, `/games/${slug}`);
    link(path, '/games');
    assert(
      new Set(
        pages[path].editorialLinks.filter(
          (p) => /\/coaching$/.test(p) && p !== path,
        ),
      ).size >= 2,
    );
  }
  link('/games/social', '/blog/what-is-an-egirl');
  for (const path of [
    '/games/social',
    '/games/valorant',
    '/games/valorant/coaching',
  ])
    link('/blog/what-is-an-egirl', path);
  link('/apply', '/get-paid-to-play-games');
  link('/blog', '/blog/what-is-an-egirl');
});
