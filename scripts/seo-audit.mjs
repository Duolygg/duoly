/* global document, URL, fetch, console */
// Crawl only real anchors, preserving source paths and descriptive link text.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.SEO_BASE || 'http://127.0.0.1:4381';
const out = process.env.SEO_OUT || '.vercel/seo-audit';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ javaScriptEnabled: false });
const page = await context.newPage();
const queue = ['/'];
const pages = {};
while (queue.length) {
  const path = queue.shift();
  if (pages[path]) continue;
  const response = await page.goto(base + path);
  const data = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content,
    robots: document.querySelector('meta[name="robots"]')?.content,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    h1: [...document.querySelectorAll('h1')].map((e) => e.textContent.trim()),
    headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((e) => ({
      level: Number(e.tagName[1]),
      text: e.textContent.trim(),
    })),
    schemas: [
      ...document.querySelectorAll('script[type="application/ld+json"]'),
    ].map((e) => JSON.parse(e.textContent)),
    links: [...document.querySelectorAll('a[href]')].map((e) => ({
      href: e.getAttribute('href'),
      text: e.textContent.trim() || e.getAttribute('aria-label') || '',
      // Contextual = editorial body copy: inside <main>, outside the shared
      // header, footer and site navigation. Breadcrumbs, .related blocks and
      // the games index directory (nav.page-directory) belong to the page
      // itself, so they count. scripts/seo-built.test.mjs draws the same line.
      contextual:
        !!e.closest('main') &&
        !e.closest('header, footer') &&
        !e.closest(
          'nav:not(.related):not(.page-directory):not([aria-label="Breadcrumb"])',
        ),
    })),
    // Offer links: a prefilled checkout selection (src/site/seo.ts bookingHref)
    // the page offers in its own content. The shared header and footer live
    // outside <main> in SiteLayout, so <main> is the whole test here: a hero
    // inside a page is the page's own header and its call to action counts.
    bookingLinks: [...document.querySelectorAll('a[href*="#modes-h"]')]
      .filter(
        (e) =>
          !!e.closest('main') &&
          !e.closest(
            'nav:not(.related):not(.page-directory):not([aria-label="Breadcrumb"])',
          ),
      )
      .map((e) => e.getAttribute('href')),
    prices: [...document.querySelectorAll('[data-price-minor]')].map((e) => ({
      minor: e.getAttribute('data-price-minor'),
      text: e.textContent.trim(),
    })),
    editorialLinks: [
      ...document.querySelectorAll('article.seo-page .related a[href]'),
    ].map((e) => new URL(e.href).pathname),
    breadcrumb: [
      ...document.querySelectorAll('nav[aria-label="Breadcrumb"] a'),
    ].map((e) => ({
      name: e.textContent.trim(),
      path: new URL(e.href).pathname,
    })),
    socialMeta: Object.fromEntries(
      [
        ...document.querySelectorAll(
          'meta[property^="og:"],meta[name^="twitter:"]',
        ),
      ].map((e) => [e.getAttribute('property') || e.name, e.content]),
    ),
    toolbar: !!document.querySelector('astro-dev-toolbar'),
  }));
  const html = await page.content();
  await writeFile(
    `${out}/${path === '/' ? 'home' : path.slice(1).replaceAll('/', '__')}.html`,
    html,
  );
  data.status = response.status();
  data.links = data.links.flatMap((link) => {
    const url = new URL(link.href, base + path);
    if (![base, 'https://duoly.gg'].includes(url.origin)) return [];
    const target = url.pathname.replace(/\/$/, '') || '/';
    if (/^\/(api|auth|checkout|queue)\b/.test(target)) return [];
    return [{ path: target, text: link.text, contextual: link.contextual }];
  });
  pages[path] = data;
  // Public noindex utility routes are checked, but do not open authenticated areas.
  if (
    response.status() === 200 &&
    !/^\/(login|apply|creators|reset-password|pro|profile|dashboard|teammate|admin)/.test(
      path,
    )
  ) {
    for (const link of data.links)
      if (!pages[link.path] && !queue.includes(link.path))
        queue.push(link.path);
  }
}
const sitemap = await (await fetch(base + '/sitemap.xml')).text();
const sitemapEntries = [
  ...sitemap.matchAll(
    /<url><loc>(.*?)<\/loc><lastmod>(.*?)<\/lastmod><\/url>/g,
  ),
].map((m) => ({ url: m[1], lastmod: m[2] }));
const depth = { '/': 0 };
const pending = ['/'];
while (pending.length) {
  const source = pending.shift();
  for (const link of pages[source]?.links || [])
    if (depth[link.path] === undefined) {
      depth[link.path] = depth[source] + 1;
      pending.push(link.path);
    }
}
const describes = (link, path) =>
  link.path === path &&
  link.text &&
  !/^(click here|learn more)$/i.test(link.text);
for (const [path, data] of Object.entries(pages)) {
  data.depth = depth[path];
  data.inbound = Object.entries(pages)
    .filter(
      ([source, p]) =>
        source !== path && p.links.some((link) => describes(link, path)),
    )
    .map(([source]) => source);
  // Editorial inbound links only: the homepage, header, footer and site nav are
  // the owner's design, so they never count towards internal-linking coverage.
  data.contextualInbound = Object.entries(pages)
    .filter(
      ([source, p]) =>
        source !== path &&
        source !== '/' &&
        p.links.some((link) => describes(link, path) && link.contextual),
    )
    .map(([source]) => source);
}
await writeFile(
  `${out}/report.json`,
  JSON.stringify({ pages, sitemapEntries }, null, 2),
);
await browser.close();
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(pages)
        .filter(([, p]) => p.robots === 'index, follow')
        .map(([path, p]) => [
          path,
          {
            title: p.title,
            description: p.description,
            h1: p.h1,
            inbound: p.inbound.length,
            depth: p.depth,
          },
        ]),
    ),
    null,
    2,
  ),
);
