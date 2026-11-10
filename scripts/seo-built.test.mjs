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
/**
 * Editorial inbound links every indexable page has to have, counted from real
 * anchors in page content rather than shared chrome.
 *
 * Six, raised from four on 10 November 2026. Four was the floor while the five
 * newest coaching pages sat at four or five; the related ring in
 * src/pages/games/[game]/coaching.astro is symmetric now, so the whole sitemap
 * clears six and the gate can hold the number the linking plan actually
 * targets.
 */
const MIN_INBOUND = 6;
const coaches = [
  'valorant',
  'league-of-legends',
  'rocket-league',
  'fortnite',
  'teamfight-tactics',
  'apex-legends',
  'marvel-rivals',
  // Added 2026-11-09 from the keyword gap analysis.
  'call-of-duty',
  'dota-2',
  'minecraft',
  'world-of-warcraft',
  'deadlock',
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
    assert(
      page.inbound.length >= MIN_INBOUND,
      `${path}: ${page.inbound.length} inbound`,
    );
    assert(
      page.contextualInbound.length >= MIN_INBOUND,
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
    assert.match(schema.dateModified, /^\d{4}-\d{2}-\d{2}$/);
    assert(page.schemas.some((item) => item['@type'] === 'BreadcrumbList'));
    const entry = sitemapEntries.find((entry) => entry.url === schema.url);
    if (path === '/ai' && !aiLaunchState().showSetup)
      assert.equal(entry, undefined);
    else assert.equal(entry?.lastmod, schema.dateModified);
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
    assert.match(
      sitemapEntries.find((entry) => entry.url === `https://duoly.gg${path}`)
        .lastmod,
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
}

/**
 * Pages that sell nothing, so no offer link belongs in their copy: the
 * homepage is the checkout itself, and the legal and support pages are written
 * for a reader with a question rather than a basket. /press joins them for the
 * same reason: it is a fact sheet for a journalist, and a prefilled checkout in
 * a press kit would be an advert where a source belongs. It links /pricing
 * instead, which carries the offers. Everything else in the sitemap has to
 * reach a prefilled checkout from its own content.
 */
const NO_OFFER_LINK = [
  '/',
  '/contact',
  '/terms',
  '/privacy',
  '/imprint',
  '/press',
];

test(`every sitemap URL is a finished page with ${MIN_INBOUND} inbound links`, () => {
  for (const entry of sitemapEntries) {
    const path = new URL(entry.url).pathname;
    const page = pages[path];
    assert(page, `${path} reachable from real anchors`);
    assert(
      page.inbound.length >= MIN_INBOUND,
      `${path}: ${page.inbound.length} inbound internal links`,
    );
    assert(
      page.contextualInbound.length >= MIN_INBOUND,
      `${path}: ${page.contextualInbound.length} contextual inbound links from ${page.contextualInbound}`,
    );
  }
});

test('every sitemap URL that sells something links to an offer', () => {
  for (const entry of sitemapEntries) {
    const path = new URL(entry.url).pathname;
    if (NO_OFFER_LINK.includes(path)) continue;
    const page = pages[path];
    assert(page, `${path} reachable from real anchors`);
    assert(
      page.bookingLinks.length >= 1,
      `${path}: no booking link in the page's own content`,
    );
    // A booking link opens the real checkout on the game it names. Beyond the
    // game it may prefill the tab, the service and the figures a worked
    // example quotes (src/content/epal-comparison.ts does all four), so the
    // parameter set is allowlisted rather than ordered.
    const PREFILL = ['game', 'tab', 'service', 'rank', 'region', 'qty'];
    for (const href of page.bookingLinks) {
      const url = new URL(href, 'https://duoly.gg');
      assert.equal(url.pathname, '/', `${path}: ${href} leaves the checkout`);
      assert.equal(url.hash, '#modes-h', `${path}: ${href} misses #modes-h`);
      assert.match(
        url.searchParams.get('game') ?? '',
        /^[a-z0-9]+$/,
        `${path}: ${href} names no game`,
      );
      for (const key of url.searchParams.keys())
        assert(
          PREFILL.includes(key),
          `${path}: ${href} carries the unknown parameter ${key}`,
        );
    }
  }
});

test('E-Pal comparison page is factual, dated and internally linked', () => {
  const path = '/compare/e-pal';
  const page = pages[path];
  assert(page, 'crawl discovered the comparison page');
  assert(page.inbound.length >= 2, 'two inbound links');
  const html = readFileSync('.vercel/seo-audit/compare__e-pal.html', 'utf8');
  assert.match(html, /Last checked 2026-11-08/);
  assert.match(html, /€16\.17/);
  assert.match(html, /€5\.99/);
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

// The two comparisons added on 9 November 2026. Each one is sourced from the
// rival's own pages, so the checks are: the dated label, the coaching price out
// of the engine, a source link per rival cell, FAQ answers that match the
// FAQPage markup, and no borrowed rating or logo.
for (const [slug, rival, host] of [
  ['metafy', 'Metafy', 'metafy.gg'],
  ['queueup', 'QueueUp', 'queueup.gg'],
]) {
  const path = `/compare/${slug}`;
  test(`${rival} comparison is factual, dated and internally linked`, () => {
    const page = pages[path];
    assert(page, `crawl discovered ${path}`);
    const html = readFileSync(
      `.vercel/seo-audit/compare__${slug}.html`,
      'utf8',
    );
    assert.match(html, /Last checked 2026-11-09/);
    // The flat coaching hour, from the pricing engine through the page.
    assert.match(html, /€12\.99/);
    assert(html.includes('/coaching'), 'links the coaching directory');
    assert(
      html.includes('/blog/how-to-choose-a-gaming-coach'),
      'links the coach guide',
    );
    assert(html.includes('/developers/mcp'));
    // Sourced cells: one anchor per rival cell, into the page's own list.
    const cells = (html.match(/Source<\/a>/g) || []).length;
    assert(cells >= 10, `${path}: ${cells} sourced cells`);
    assert(
      new RegExp(`id="${slug}-source-0"`).test(html),
      `${path}: numbered source list`,
    );
    assert(
      !new RegExp(
        `${host.replace('.', '\\.')}[^"'\\s]*\\.(png|svg|jpe?g|webp)`,
        'i',
      ).test(html),
      `${path}: no ${rival} imagery`,
    );
    const webPage = page.schemas.find((s) => s['@type'] === 'WebPage');
    assert.equal(webPage.url, `https://duoly.gg${path}`);
    assert.equal(webPage.dateModified, '2026-11-09');
    const faq = page.schemas.find((s) => s['@type'] === 'FAQPage');
    assert(faq && faq.mainEntity.length >= 5, 'FAQPage questions');
    for (const question of faq.mainEntity) {
      assert(html.includes(question.name), `${path}: visible ${question.name}`);
      assert(
        html.includes(question.acceptedAnswer.text),
        `${path}: visible answer for ${question.name}`,
      );
    }
    assert(
      !page.schemas.some(
        (s) => s['@type'] === 'AggregateRating' || s['@type'] === 'Review',
      ),
    );
  });
}

// The three answer-first guides. Each one answers in the first block, dates its
// external claims and keeps its FAQPage markup equal to the visible questions.
for (const slug of [
  'how-to-find-a-valorant-duo',
  'how-to-choose-a-gaming-coach',
  'free-lfg-or-paid-teammate',
]) {
  const path = `/blog/${slug}`;
  test(`guide is answer-first, dated and linked: ${path}`, () => {
    const page = pages[path];
    assert(page, `crawl discovered ${path}`);
    const html = readFileSync(`.vercel/seo-audit/blog__${slug}.html`, 'utf8');
    const article = page.schemas.find((s) => s['@type'] === 'Article');
    assert.equal(article.author.name, 'Duoly');
    assert.equal(article.author['@type'], 'Organization');
    assert(article.datePublished && article.dateModified && article.image);
    const faq = page.schemas.find((s) => s['@type'] === 'FAQPage');
    assert(faq && faq.mainEntity.length >= 5, 'FAQPage questions');
    for (const question of faq.mainEntity) {
      assert(html.includes(question.name), `${path}: visible ${question.name}`);
      assert(
        html.includes(question.acceptedAnswer.text),
        `${path}: visible answer for ${question.name}`,
      );
    }
    assert((html.match(/<details/g) || []).length >= 5, 'visible FAQs');
    assert.match(html, /data-cta="closing"/);
    assert.match(html, /9 November 2026/, 'a dated check or byline');
    assert.doesNotMatch(html, /\{\{\w+\}\}/, 'price tokens filled');
    // Two different bookable offers per guide, in the guide's own content. A
    // game and service pair, because the same lesson in two games is two
    // offers and the same service id twice is one.
    const offers = new Set(
      page.bookingLinks.map((href) => {
        const { searchParams } = new URL(href, 'https://duoly.gg');
        return `${searchParams.get('game')}/${searchParams.get('service')}`;
      }),
    );
    assert(
      offers.size >= 2,
      `${path}: ${[...offers].join(', ')} bookable offers`,
    );
    link(path, '/blog');
  });
}

// The 2026 price survey: original research with a dataset beside it. The
// checks are the ones that make it citable: dated Article and Dataset markup, a
// CSV the Dataset actually points at, the survey date on the page, FAQ markup
// equal to the visible questions, and editorial inbound links from the five
// pages a reader would arrive from.
test('the price report publishes its dataset, its sources and its inbound links', async () => {
  const path = '/reports/gaming-coaching-and-teammate-prices-2026';
  const page = pages[path];
  assert(page, `crawl discovered ${path}`);
  const html = readFileSync(
    `.vercel/seo-audit/${path.slice(1).replaceAll('/', '__')}.html`,
    'utf8',
  );
  const article = page.schemas.find((s) => s['@type'] === 'Article');
  assert.equal(article.author['@type'], 'Organization');
  assert.equal(article.datePublished, '2026-11-10');
  assert.equal(article.dateModified, '2026-11-10');
  const dataset = page.schemas.find((s) => s['@type'] === 'Dataset');
  assert(dataset, 'Dataset markup');
  assert.equal(dataset.isAccessibleForFree, true);
  assert.equal(
    dataset.license,
    'https://creativecommons.org/licenses/by/4.0/',
    'the dataset states its reuse licence',
  );
  assert.equal(dataset.temporalCoverage, '2026-11-10');
  const download = dataset.distribution[0];
  assert.equal(download.encodingFormat, 'text/csv');
  assert.equal(download.contentUrl, `https://duoly.gg${path}.csv`);
  assert(
    dataset.variableMeasured.includes('source_url') &&
      dataset.variableMeasured.includes('checked_date'),
    'every row names its source and date',
  );
  // The download the markup promises, served as CSV with its source column.
  const csv = await fetch(`${base}${path}.csv`);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const body = await csv.text();
  const header = body.split('\n').find((line) => line.startsWith('platform,'));
  assert.equal(
    header,
    'platform,game,service,service_type,billing_unit,currency,amount,amount_eur,source_url,checked_date,note',
  );
  assert(
    body.split('\n').filter((line) => line.startsWith('WeCoach,')).length >= 60,
    'the hourly rates are in the download',
  );
  // The survey date, the recorded rate and the median, all in the visible copy.
  assert.match(html, /10 November 2026/, 'the survey date');
  assert.match(html, /1\.1193/, 'the recorded ECB rate');
  assert.match(html, /USD 25\.00/, 'the median hourly rate');
  assert.match(html, /€12\.99/, 'the Duoly coaching hour from the engine');
  assert.doesNotMatch(html, /\{\{\w+\}\}/, 'price tokens filled');
  assert.doesNotMatch(html, /[–—]/, 'no em or en dashes');
  // One table row per platform, each with its sources listed underneath.
  assert(
    (html.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<tr>/g) || []).length ===
      13,
    'twelve platforms plus Duoly',
  );
  for (const host of [
    'wecoach.gg',
    'metafy.gg',
    'queueup.gg',
    'epal.gg',
    'corsair.com',
    'fiverr.com',
    'silhouette.gg',
    'kakigaming.com',
    'gametree.me',
    'gamerlinkapp.com',
    'eloboost24.eu',
    'proguides.com',
    'ecb.europa.eu',
  ])
    assert(html.includes(host), `${path}: source link for ${host}`);
  const faq = page.schemas.find((s) => s['@type'] === 'FAQPage');
  assert(faq && faq.mainEntity.length >= 5, 'FAQPage questions');
  for (const question of faq.mainEntity) {
    assert(html.includes(question.name), `${path}: visible ${question.name}`);
    assert(
      html.includes(question.acceptedAnswer.text),
      `${path}: visible answer for ${question.name}`,
    );
  }
  assert.match(html, /data-cta="closing"/, 'a booking link in the closing');
  assert(page.bookingLinks.length >= 2, 'bookable offers');
  // Editorial inbound links, which is what the four-link gate is about.
  for (const source of [
    '/pricing',
    '/coaching',
    '/compare/metafy',
    '/compare/queueup',
    '/blog',
  ])
    link(source, path);
  assert(
    page.contextualInbound.length >= 4,
    `${path}: ${page.contextualInbound.length} contextual inbound`,
  );
});

test('llms-full.txt is served and carries the catalog price date', async () => {
  const response = await fetch(`${base}/llms-full.txt`);
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.match(text, /^# Duoly: full text/);
  assert.match(text, /9 November 2026/, 'the catalog price date');
  assert.match(text, /## The complete price list/);
  assert(text.includes('€12.99'), 'the coaching hour from the engine');
  assert(
    (await (await fetch(`${base}/llms.txt`)).text()).includes(
      'https://duoly.gg/llms-full.txt',
    ),
    'llms.txt links the full text',
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
// game, slug, catalog id, preselected service
const intentRoutes = [
  ['league-of-legends', 'play-with-someone', 'lol', 'norm'],
  ['marvel-rivals', 'duo-partner', 'mr', 'quick'],
  ['pokemon-unite', 'teammate', 'pu', 'quick'],
  ['valorant', 'lfg', 'val', 'duo2'],
  ['fortnite', 'duos', 'fn', 'duo2'],
  ['overwatch-2', 'lfg', 'ow', 'qp'],
  ['apex-legends', 'lfg', 'apex', 'duos'],
  ['call-of-duty', 'lfg', 'cod', 'duo2'],
  ['rainbow-six-siege', 'lfg', 'r6', 'duo2'],
  ['counter-strike-2', 'lfg', 'cs2', 'duo2'],
  ['rocket-league', 'lfg', 'rl', 'duo2'],
  ['world-of-warcraft', 'lfg', 'wow', 'duo2'],
  ['minecraft', 'player-finder', 'mc', 'duo2'],
  ['arc-raiders', 'lfg', 'arc', 'duo2'],
  ['deadlock', 'lfg', 'dl', 'duo2'],
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
    //
    // Three measured changes stack in these ceilings. #187 added the shared
    // price note (server/seo/citable-answers priceNote), the closing detail
    // paragraph and the shared teammate facts, a measured 179 words on every
    // intent page. Withdrawing the rank rule in #193 gave part of that back.
    // The November 2026 keyword gap pass then took the registry from 9 pages
    // to 15, and every teammate page links every other one, so the
    // related-link chips grew by about 100 words on all of them.
    //
    // The 10 November 2026 conversion pass added three shared blocks to every
    // teammate page: the hero offer card (service, tier, its own starting
    // price and a labelled button), one line of refund microcopy under the
    // primary CTA, and the quantity-discount chips on each price card. That is
    // about 110 words on a page with one price grid and more where a game
    // sells six teammate services.
    //
    // #199 then gave every teammate page five LFG price FAQs on the same day,
    // which is the larger of the two additions on the plain pages.
    //
    // Measured on 10 November 2026 against this build, worst page per bucket:
    // templated 3201 (/games/call-of-duty/lfg), guided 2691
    // (/games/league-of-legends/play-with-someone) and plain 2418
    // (/games/counter-strike-2/lfg, the longest plain page because CS2 sells
    // six teammate services on one card). Each ceiling sits 100 words above
    // its worst page. The headroom is for those reviewed, shared paragraphs
    // and not for padding, so move a ceiling only with the same kind of
    // measurement written down.
    const guided = html.includes('id="free-or-paid"');
    const templated = html.includes('id="lfg-post-h"');
    const [minWords, maxWords] = templated
      ? [1900, 3301]
      : guided
        ? [1500, 2791]
        : [1200, 2518];
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
    // Every teammate page, which includes all ten /lfg pages, publishes its
    // FAQ as FAQPage markup equal to the visible questions and answers.
    const faq = page.schemas.find((schema) => schema['@type'] === 'FAQPage');
    assert(faq && faq.mainEntity.length >= 5, `${path}: FAQPage questions`);
    // Every marked-up question is visible. The reverse is not asserted,
    // because the free-versus-paid block uses <details> of its own and the
    // FAQPage node covers the FAQ section only.
    assert(
      (html.match(/<details/g) || []).length >= faq.mainEntity.length,
      `${path}: fewer visible FAQs than FAQPage questions`,
    );
    for (const question of faq.mainEntity) {
      assert(html.includes(question.name), `${path}: visible ${question.name}`);
      assert(
        html.includes(question.acceptedAnswer.text),
        `${path}: visible answer for ${question.name}`,
      );
    }
    // An LFG page answers the question its URL promises: where the free routes
    // are, and what paying instead costs.
    if (slug === 'lfg') {
      const questions = faq.mainEntity.map((entry) => entry.name).join(' ');
      assert.match(questions, /free/i, `${path}: a free-route question`);
      assert.match(questions, /cost|pay/i, `${path}: a price question`);
    }
    assert.match(
      html,
      new RegExp(`game=${id}(?:&amp;|&)service=${serviceId}#modes-h`),
    );
    assert.match(html, /data-cta="closing"/);
    assert.match(
      sitemapEntries.find((entry) => entry.url === `https://duoly.gg${path}`)
        .lastmod,
      /^\d{4}-\d{2}-\d{2}$/,
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
        // Intent pages must not be reachable from navigation shared across the
        // site, nor from the homepage. Three in-content navs are the page's own
        // content and stay allowed: related-links chips, breadcrumbs, and the
        // games index directory (nav.page-directory).
        const allowed =
          'nav:not(.related):not(.page-directory):not([aria-label="Breadcrumb"])';
        return [...document.querySelectorAll(selector)]
          .filter(
            (el) =>
              !el.closest('main') ||
              el.closest(allowed) ||
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
    // Sibling coaching pages only: /coaching is the all-games directory and
    // every coaching page links it, so it would otherwise pass this on its own.
    assert(
      new Set(
        pages[path].editorialLinks.filter(
          (p) => /^\/games\/[^/]+\/coaching$/.test(p) && p !== path,
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
