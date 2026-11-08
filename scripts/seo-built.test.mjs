/* global URL, document, innerWidth, getComputedStyle, location, fetch */
// Run after pnpm build, scripts/seo-preview.mjs and scripts/seo-audit.mjs.
import { test } from 'node:test';
import { aiLaunchState } from '../src/site/ai.ts';
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
    assert(page.inbound.length >= 3, `${path}: ${page.inbound.length} inbound`);
    assert(
      page.contextualInbound.length >= 3,
      `${path}: ${page.contextualInbound.length} contextual inbound from ${page.contextualInbound}`,
    );
    assert.equal(page.socialMeta['og:title'], page.title);
    assert.equal(page.socialMeta['twitter:title'], page.title);
    assert.equal(page.socialMeta['og:description'], page.description);
    assert.equal(page.socialMeta['twitter:description'], page.description);
    // The homepage title and description are the owner's design (CONTRIBUTING.md,
    // "Protected design"), so length targets apply to the SEO pages only.
    if (path !== '/') assert(page.title.length <= 60, `${path}: title length`);
    if (
      ['/games', '/blog', '/compare'].some(
        (prefix) => path === prefix || path.startsWith(prefix + '/'),
      )
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
    if (service) {
      assert.deepEqual(
        service.offers.map((o) => Number(o.price) * 100).map(Math.round),
        page.prices.map((p) => Number(p.minor)),
      );
      const units = new Set(
        service.offers.map((o) => o.priceSpecification.unitText),
      );
      for (const unit of units) {
        assert(
          page.description.includes(`per ${unit}`),
          `${path}: description unit ${unit}`,
        );
        assert(
          html
            .match(/<p class="(?:price-chip|hero-price)">([\s\S]*?)<\/p>/)?.[1]
            .includes(`per ${unit}`),
          `${path}: summary unit ${unit}`,
        );
      }
      const intro = html.match(/<p class="section-intro">([\s\S]*?)<\/p>/)?.[1];
      if (intro && /\bis|\bare/.test(intro) && /€/.test(intro)) {
        for (const offer of service.offers) {
          const title = offer.name.replace(/, per \w+$/, '');
          const clause = intro.split('; ').find((part) => part.includes(title));
          assert(clause, `${path}: intro names ${title}`);
          assert(
            clause.includes(
              `€${offer.price} per ${offer.priceSpecification.unitText}`,
            ),
            `${path}: intro price and unit for ${title}`,
          );
        }
      }
    }
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
test('AI pages expose matching structured data, launch status and links', () => {
  for (const [path, type] of [
    ['/ai', 'WebPage'],
    ['/developers/mcp', 'TechArticle'],
  ]) {
    const page = pages[path];
    assert(page, `${path} is reachable from real anchors`);
    assert.equal(
      page.robots,
      path === '/ai' ? aiLaunchState().indexing : 'index, follow',
    );
    assert(page.description.length >= 140 && page.description.length <= 160);
    const schema = page.schemas.find((item) => item['@type'] === type);
    assert(schema);
    assert.equal(schema.url, `https://duoly.gg${path}`);
    assert.equal(schema.description, page.description);
    assert.equal(schema.dateModified, '2026-11-06');
    assert(page.schemas.some((item) => item['@type'] === 'BreadcrumbList'));
    const entry = sitemapEntries.find((entry) => entry.url === schema.url);
    if (path === '/ai' && !aiLaunchState().showSetup)
      assert.equal(entry, undefined);
    else assert.equal(entry?.lastmod, '2026-11-06');
    const html = readFileSync(
      `.vercel/seo-audit/${path.slice(1).replaceAll('/', '__')}.html`,
      'utf8',
    );
    if (!aiLaunchState().showSetup)
      assert.match(html, /[Cc]oming soon|Launching soon/);
    if (path === '/developers/mcp')
      assert.match(html, /https:\/\/duoly.gg\/mcp/);
  }
  link('/games', '/ai');
  link('/games', '/developers/mcp');
  link('/get-paid-to-play-games', '/ai');
  link('/ai', '/developers/mcp');
  link('/developers/mcp', '/ai');
});

// Every game hub in the sitemap, apart from the two older hubs that keep their
// own copy (src/content/hubs.ts). Driven by the sitemap so this test needs no
// source imports.
const hubPaths = sitemapEntries
  .map((entry) => new URL(entry.url).pathname)
  .filter((path) => /^\/games\/[^/]+$/.test(path));
const dataHubs = hubPaths.filter(
  (path) => !['/games/valorant', '/games/social'].includes(path),
);
test('the sitemap lists a hub for every game Duoly sells', () => {
  // 20 games plus Social (src/design-reference/lib/games.js), 19 of them
  // rendered from src/content/game-hubs.
  assert.equal(hubPaths.length, 21, `hubs in sitemap: ${hubPaths.length}`);
  assert.equal(dataHubs.length, 19);
});
for (const path of dataHubs) {
  test(`game hub is finished, indexable and the linking centre: ${path}`, () => {
    const page = pages[path];
    assert(page, `crawl discovered ${path}`);
    assert.equal(page.robots, 'index, follow');
    const service = page.schemas.find((s) => s['@type'] === 'Service');
    const faq = page.schemas.find((s) => s['@type'] === 'FAQPage');
    assert(service && service.offers.length > 0, 'Service offers');
    assert(faq && faq.mainEntity.length >= 5, 'FAQPage questions');
    const html = readFileSync(
      `.vercel/seo-audit/${path.slice(1).replaceAll('/', '__')}.html`,
      'utf8',
    );
    assert.doesNotMatch(html, /\{\{\w+\}\}/, 'price tokens filled');
    // FAQPage JSON-LD has to repeat the visible questions and answers.
    for (const question of faq.mainEntity) {
      assert(html.includes(question.name), `${path}: visible ${question.name}`);
      assert(
        html.includes(question.acceptedAnswer.text),
        `${path}: visible answer for ${question.name}`,
      );
    }
    // The required hub sections: prices, how it works, the decision visual, the FAQ.
    for (const id of [
      'prices',
      'steps-h',
      'hub-decide-h',
      'faq-h',
      'closing-h',
    ])
      assert(html.includes(`id="${id}"`), `${path}: #${id}`);
    assert((html.match(/<details/g) || []).length >= 5, 'visible FAQs');
    assert.match(html, /data-cta="closing"/);
    // Guides block: the hub is the internal-linking centre for its game.
    const guides = page.editorialLinks;
    for (const target of ['/games', '/compare/e-pal', '/blog', '/ai'])
      assert(guides.includes(target), `${path} -> ${target}`);
    const siblings = new Set(
      guides.filter(
        (target) => /^\/games\/[^/]+$/.test(target) && target !== path,
      ),
    );
    assert(siblings.size >= 3, `${path}: ${siblings.size} sibling hub links`);
    const slug = path.split('/')[2];
    if (coaches.includes(slug)) {
      link(path, `${path}/coaching`);
      link(`${path}/coaching`, path);
    }
    assert.equal(
      sitemapEntries.find((entry) => entry.url === `https://duoly.gg${path}`)
        .lastmod,
      '2026-11-08',
    );
  });
}

test('every sitemap URL is a finished page with three inbound links', () => {
  for (const entry of sitemapEntries) {
    const path = new URL(entry.url).pathname;
    const page = pages[path];
    assert(page, `${path} reachable from real anchors`);
    assert(
      page.inbound.length >= 3,
      `${path}: ${page.inbound.length} inbound internal links`,
    );
    assert(
      page.contextualInbound.length >= 3,
      `${path}: ${page.contextualInbound.length} contextual inbound links`,
    );
  }
});

test('E-Pal comparison page is factual, dated and internally linked', () => {
  const path = '/compare/e-pal';
  const page = pages[path];
  assert(page, 'crawl discovered the comparison page');
  assert(page.inbound.length >= 2, 'two inbound links');
  const html = readFileSync('.vercel/seo-audit/compare__e-pal.html', 'utf8');
  assert.match(html, /Last checked 2026-11-08/);
  assert.match(html, /€10\.77/);
  assert.match(html, /€3\.99/);
  assert(html.includes('/games/league-of-legends/play-with-someone'));
  assert(html.includes('/games/valorant'));
  assert(html.includes('/developers/mcp'));
  assert(!/epal\.gg[^"'\s]*\.(png|svg|jpg)/i.test(html), 'no E-Pal imagery');
  const webPage = page.schemas.find((s) => s['@type'] === 'WebPage');
  assert.equal(webPage.url, 'https://duoly.gg/compare/e-pal');
  assert.equal(webPage.dateModified, '2026-11-08');
  assert(
    !page.schemas.some(
      (s) => s['@type'] === 'AggregateRating' || s['@type'] === 'Review',
    ),
  );
});

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
// game, slug, catalog id, preselected service, sitemap lastmod
const intentRoutes = [
  ['league-of-legends', 'play-with-someone', 'lol', 'norm', '2026-11-06'],
  ['marvel-rivals', 'duo-partner', 'mr', 'quick', '2026-11-06'],
  ['pokemon-unite', 'teammate', 'pu', 'quick', '2026-11-06'],
  ['valorant', 'lfg', 'val', 'duo2', '2026-11-08'],
  ['fortnite', 'duos', 'fn', 'duo2', '2026-11-08'],
  ['overwatch-2', 'lfg', 'ow', 'qp', '2026-11-08'],
  ['apex-legends', 'lfg', 'apex', 'duos', '2026-11-08'],
  ['call-of-duty', 'lfg', 'cod', 'duo2', '2026-11-08'],
  ['rainbow-six-siege', 'lfg', 'r6', 'duo2', '2026-11-08'],
];
for (const [game, slug, id, serviceId, lastmod] of intentRoutes) {
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
    // Coaching pages exist for some games only; where one exists it links back.
    if (coaches.includes(game)) link(`/games/${game}/coaching`, path);
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
    // Pages with the free-versus-paid guide carry two extra sections, and the
    // teammate pages add the LFG post template on top of that. Keep substantive
    // guides without requiring repeated prices or filler in Unite.
    const guided = html.includes('id="free-or-paid"');
    const templated = html.includes('id="lfg-post-h"');
    const [minWords, maxWords] = templated
      ? [1900, 2900]
      : guided
        ? [1500, 2400]
        : [1200, 1800];
    assert(
      wordCount >= minWords && wordCount <= maxWords,
      `${path}: ${wordCount} words`,
    );
    if (guided) {
      assert.match(html, /id="duo-decision"/, 'decision flow');
      assert.doesNotMatch(html, /\{\{\w+\}\}/, 'price tokens filled');
    }
    if (templated) {
      // Every verified free route has to stay a real, attributed link.
      assert.match(html, /class="lfg-chip"/, 'post template chips');
      assert.match(html, /We found (?:every|both) link/, 'dated link check');
      assert.match(html, /8 November 2026/, 'link check date');
      assert(
        [...html.matchAll(/<a href="(https:\/\/[^"]+)" rel="noopener"/g)]
          .length >= 2,
        `${path}: external free routes`,
      );
    }
    assert((html.match(/<details/g) || []).length >= 5, 'visible FAQs');
    assert.match(
      html,
      new RegExp(`game=${id}(?:&amp;|&)service=${serviceId}#modes-h`),
    );
    assert.match(html, /data-cta="closing"/);
    assert.equal(
      sitemapEntries.find((entry) => entry.url === `https://duoly.gg${path}`)
        .lastmod,
      lastmod,
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
    const intentSelector = [
      ...new Set(intentRoutes.map(([, slug]) => `a[href$="/${slug}"]`)),
    ].join(', ');
    for (const path of Object.keys(pages)) {
      await page.goto(base + path);
      const forbidden = await page.evaluate((selector) => {
        return [...document.querySelectorAll(selector)]
          .filter(
            (el) =>
              !el.closest('main') ||
              el.closest('nav:not(.related):not([aria-label="Breadcrumb"])') ||
              location.pathname === '/',
          )
          .map((el) => el.getAttribute('href'));
      }, intentSelector);
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
