/* global URL */
// Run after pnpm build, scripts/seo-preview.mjs and scripts/seo-audit.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
