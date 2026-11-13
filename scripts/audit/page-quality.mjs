/* global document, URL, fetch, console */
/**
 * Page quality audit: one report for every public page.
 *
 * Reads the built production bundle through scripts/seo-preview.mjs, so what it
 * measures is the HTML a crawler receives, with JavaScript off.
 *
 *   corepack pnpm build
 *   SEO_PORT=4391 PUBLIC_PROFILES_ENABLED=true PUBLIC_PROFILE_FIXTURES=true \
 *     NODE_ENV=development node scripts/seo-preview.mjs &
 *   PQ_BASE=http://127.0.0.1:4391 node scripts/audit/page-quality.mjs
 *
 * The page set is every URL in the built sitemap, plus /teammates and every
 * teammate profile route the directory links to (fixture profiles included, so
 * the routes can be read before the database has real ones).
 *
 * Everything it reports is measured inside <main>: the header, footer and site
 * nav are shared chrome rather than any one page's copy, and they are the
 * owner's design, so a dash or an ampersand there is not a finding against the
 * page that happens to render them.
 *
 * Writes <PQ_OUT>/report.json (everything) and <PQ_OUT>/summary.md (the table),
 * and prints the failure counts. Exit code is 0 even with findings: this is a
 * report, not a gate.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.PQ_BASE || 'http://127.0.0.1:4391';
const out = process.env.PQ_OUT || '.vercel/page-quality';
/** The live site, so a link to it counts as internal wherever the preview runs. */
const SITE_ORIGIN = 'https://duoly.gg';
const SITE_HOST = new URL(SITE_ORIGIN).host;

/** Google truncates around these widths; the bounds are the usual advice. */
const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 160;
/** Thin copy for a page meant to answer a search question on its own. */
const THIN_WORDS = 250;

/**
 * Words that describe how Duoly is built rather than what a customer gets. A
 * public page should never need them. Each hit is reported with its sentence,
 * because a few of these words have an honest customer meaning too ("flag a
 * teammate" on /trust-and-safety, "contract" in the terms), and that call needs
 * a reader.
 */
const INTERNAL_WORDS = [
  'worker',
  'workers',
  'pipeline',
  'engine',
  'contract',
  'contracts',
  'ledger',
  'rpc',
  'flag',
  'flags',
  'flagged',
  'our database',
  'we built',
  'todo',
  'backend',
  'webhook',
  'cron',
  'endpoint',
  'supabase',
  'postgres',
];

const sentences = (text) =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const words = (text) => text.split(/[^A-Za-z0-9'’€$%.]+/).filter(Boolean);

/** Vowel groups, minus a silent trailing e. Good enough for a grade level. */
function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return w.length > 0 ? 1 : 0;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
}

/** Flesch-Kincaid grade level, rounded to one decimal. */
function readingGrade(text) {
  const ss = sentences(text);
  const ws = words(text);
  if (ss.length === 0 || ws.length === 0) return null;
  const syl = ws.reduce((sum, w) => sum + syllables(w), 0);
  const grade =
    0.39 * (ws.length / ss.length) + 11.8 * (syl / ws.length) - 15.59;
  return Math.round(grade * 10) / 10;
}

const normalizeSentence = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const PRICE =
  /(?:€|\$|£)\s?\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s?(?:€|EUR|USD)/g;

const normalizePath = (path) => path.replace(/\/+$/, '') || '/';

/** Copy rules from the brief: no en or em dashes, no ampersands, no "not X, but Y". */
function copyViolations(text) {
  const found = [];
  for (const sentence of sentences(text)) {
    if (/[–—]/.test(sentence))
      found.push({ rule: 'dash', text: sentence.slice(0, 180) });
    if (/&/.test(sentence) && !/&\w+;/.test(sentence))
      found.push({ rule: 'ampersand', text: sentence.slice(0, 180) });
    if (/\bnot\b[^.?!]{1,70}?,?\s+but\b/i.test(sentence))
      found.push({ rule: 'not-x-but-y', text: sentence.slice(0, 180) });
  }
  return found;
}

/**
 * "a Immortal 3", "a Overwatch 2 session": copy assembled from a game or rank
 * name gets the article wrong, and it reads as machine-written immediately.
 *
 * Only "a" before a vowel is checked, since that is the direction templates get
 * wrong. Words that start with a vowel letter but a consonant sound keep their
 * "a": every u word ("a user", "a US total", "a Ubisoft page"), plus "one" and
 * "euro".
 */
const CONSONANT_SOUND = /^(?:u|eu|one|once)/i;
function articleErrors(text) {
  const found = [];
  for (const sentence of sentences(text))
    for (const match of sentence.matchAll(/\ba\s+([AEIOUaeiou][\w’'-]*)/g))
      if (!CONSONANT_SOUND.test(match[1]))
        found.push({
          text: `a ${match[1]}`,
          sentence: sentence.slice(0, 160),
        });
  return found;
}

function internalTalk(text) {
  const found = [];
  for (const sentence of sentences(text))
    for (const word of INTERNAL_WORDS) {
      const pattern = word.includes(' ')
        ? new RegExp(word.replace(/ /g, '\\s+'), 'i')
        : new RegExp(`\\b${word}\\b`, 'i');
      if (pattern.test(sentence)) {
        found.push({ word, text: sentence.slice(0, 180) });
        break;
      }
    }
  return found;
}

/** Every @type in a JSON-LD document, including @graph and nested nodes. */
function schemaTypes(node, types = []) {
  if (Array.isArray(node)) {
    for (const item of node) schemaTypes(item, types);
    return types;
  }
  if (node && typeof node === 'object') {
    if (typeof node['@type'] === 'string') types.push(node['@type']);
    if (Array.isArray(node['@type'])) types.push(...node['@type']);
    for (const value of Object.values(node)) schemaTypes(value, types);
  }
  return types;
}

/** FAQPage questions and answers, so they can be matched against the page. */
function faqEntries(node, entries = []) {
  if (Array.isArray(node)) {
    for (const item of node) faqEntries(item, entries);
    return entries;
  }
  if (node && typeof node === 'object') {
    if (node['@type'] === 'Question')
      entries.push({
        question: String(node.name ?? ''),
        answer: String(node.acceptedAnswer?.text ?? ''),
      });
    for (const value of Object.values(node)) faqEntries(value, entries);
  }
  return entries;
}

const stripTags = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

function extract() {
  const main = document.querySelector('main') || document.body;
  // Open every accordion first. A closed <details> keeps its answer out of
  // innerText, and an FAQ answer nobody measured is an FAQ answer nobody
  // proofread. This only touches the audit's own copy of the DOM.
  for (const details of main.querySelectorAll('details')) details.open = true;
  // Site chrome is what lives outside <main>: the shared header, footer and
  // site nav, which SiteLayout renders around the page. Everything inside
  // <main> is the page's own copy, including a hero <header> and an in-page
  // list of its sections, so all of it is measured.
  const inChrome = (element) => !element.closest('main');
  /** Links are stricter: a chip row inside <main> is navigation, not editorial. */
  const navLink = (element) =>
    !!element.closest(
      'nav:not(.related):not(.page-directory):not([aria-label="Breadcrumb"]):not(.tp-crumbs)',
    );
  return {
    title: document.title,
    description:
      document.querySelector('meta[name="description"]')?.content ?? null,
    robots: document.querySelector('meta[name="robots"]')?.content ?? null,
    canonical:
      document.querySelector('link[rel="canonical"]')?.getAttribute('href') ??
      null,
    h1: [...main.querySelectorAll('h1')].map((e) => e.textContent.trim()),
    h1Document: document.querySelectorAll('h1').length,
    headings: [...main.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter((e) => !inChrome(e))
      .map((e) => ({
        level: Number(e.tagName[1]),
        text: e.textContent.trim(),
      })),
    ids: [...document.querySelectorAll('[id]')].map((e) => e.id),
    schemas: [
      ...document.querySelectorAll('script[type="application/ld+json"]'),
    ].map((e) => e.textContent),
    images: [...main.querySelectorAll('img')]
      .filter((e) => !inChrome(e))
      .map((e) => ({
        src: e.getAttribute('src'),
        alt: e.getAttribute('alt'),
        ariaHidden: e.getAttribute('aria-hidden') === 'true',
      })),
    links: [...document.querySelectorAll('a[href]')].map((e) => ({
      href: e.getAttribute('href'),
      text: e.textContent.trim() || e.getAttribute('aria-label') || '',
      contextual: !!e.closest('main') && !navLink(e),
    })),
    text: main.innerText || '',
    // Every visible line in <main>, code samples removed: a query string in a
    // worked API example is not an ampersand in a sentence. Lines rather than
    // elements, so copy that sits in a link or a chip is read too.
    copyLines: (() => {
      const code = new Set(
        [...main.querySelectorAll('pre, code')].flatMap((e) =>
          (e.innerText || '').split('\n').map((line) => line.trim()),
        ),
      );
      return (main.innerText || '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !code.has(line));
    })(),
    blocks: [...main.querySelectorAll('p, li, dd, figcaption, blockquote')]
      .filter((e) => !inChrome(e))
      .map((e) => (e.innerText || '').trim())
      .filter(Boolean),
    // Prose only. A price table repeats prices by design and has no sentences,
    // so grade level and "the same price again" are read from paragraphs.
    prose: [...main.querySelectorAll('p')]
      .filter((e) => !inChrome(e))
      .map((e) => (e.innerText || '').trim())
      .filter(Boolean),
  };
}

const browser = await chromium.launch();
const context = await browser.newContext({ javaScriptEnabled: false });
const page = await context.newPage();

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const sitemapPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  normalizePath(new URL(m[1]).pathname),
);

/** Profile routes are discovered from the directory, not only from the sitemap:
 * a published profile that misses the index quality rule is still a live page a
 * reader can land on. */
await page.goto(`${base}/teammates`);
const profilePaths = await page.evaluate(() =>
  [...document.querySelectorAll('a[href^="/teammates/"]')].map(
    (e) => new URL(e.href).pathname,
  ),
);

const paths = [
  ...new Set([
    '/',
    ...sitemapPaths,
    '/teammates',
    ...profilePaths.map(normalizePath),
  ]),
].sort();

const pages = {};
for (const path of paths) {
  const response = await page.goto(base + path, { waitUntil: 'load' });
  const raw = await page.evaluate(extract);
  const data = { ...raw, status: response.status() };
  data.inSitemap = sitemapPaths.includes(path);

  const text = data.text;
  // Repetition, price and grade checks read full sentences in paragraphs: a
  // price chip or a two-word label is markup, and headings are allowed to
  // appear twice when a page carries a jump list of its own questions.
  const written = data.prose.filter((block) => words(block).length >= 10);
  data.wordCount = words(text).length;
  data.proseWords = words(written.join('\n')).length;
  data.readingGrade = readingGrade(written.join('\n'));
  const copyText = data.copyLines.join('\n');
  data.copyViolations = copyViolations(copyText);
  data.internalTalk = internalTalk(copyText);
  data.articleErrors = articleErrors(
    [copyText, data.title, data.description].filter(Boolean).join('\n'),
  );
  data.questionHeadings = data.headings.filter((h) =>
    h.text.endsWith('?'),
  ).length;

  const counts = new Map();
  for (const sentence of written.flatMap(sentences)) {
    const key = normalizeSentence(sentence);
    if (key.length < 40) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  data.repeatedSentences = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([key, n]) => ({ text: key.slice(0, 120), count: n }));

  const priceBlocks = new Map();
  for (const block of written)
    for (const price of new Set(block.match(PRICE) ?? [])) {
      const key = price.replace(/\s+/g, '');
      priceBlocks.set(key, (priceBlocks.get(key) ?? 0) + 1);
    }
  data.repeatedPrices = [...priceBlocks.entries()]
    .filter(([, n]) => n >= 3)
    .map(([price, n]) => ({ price, blocks: n }));

  data.missingAlt = data.images.filter(
    (img) => img.alt === null && !img.ariaHidden,
  );
  data.emptyAlt = data.images.filter(
    (img) => img.alt === '' && !img.ariaHidden,
  ).length;

  data.schemaTypes = [];
  data.schemaErrors = [];
  const faq = [];
  for (const source of data.schemas) {
    let parsed;
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      data.schemaErrors.push(`unparseable JSON-LD: ${error.message}`);
      continue;
    }
    // A block may hold one node or an array of nodes; each root node needs its
    // own @context.
    const roots = Array.isArray(parsed) ? parsed : [parsed];
    if (roots.some((node) => !node || !node['@context']))
      data.schemaErrors.push('JSON-LD root node without @context');
    const types = schemaTypes(parsed);
    if (types.length === 0)
      data.schemaErrors.push('JSON-LD block without any @type');
    data.schemaTypes.push(...types);
    faq.push(...faqEntries(parsed));
  }
  data.schemaTypes = [...new Set(data.schemaTypes)];
  const visible = normalizeSentence(stripTags(text));
  data.faqMismatches = faq
    .filter(
      (entry) =>
        !visible.includes(normalizeSentence(entry.question)) ||
        !visible.includes(
          normalizeSentence(stripTags(entry.answer)).slice(0, 60),
        ),
    )
    .map((entry) => entry.question);

  const internalTarget = (link) => {
    if (/^(mailto|tel|https?):/.test(link.href)) {
      const url = URL.parse(link.href, base + path);
      if (!url || ![SITE_ORIGIN, base].includes(url.origin)) return [];
      return [normalizePath(url.pathname) + url.hash];
    }
    if (link.href.startsWith('#')) return [normalizePath(path) + link.href];
    if (!link.href.startsWith('/')) return [];
    const url = new URL(link.href, base);
    return [normalizePath(url.pathname) + url.hash];
  };
  // Fragments are only checked on the page's own links. The consent banner's
  // #cookie-settings target is created by the footer's script, which never runs
  // in this crawl, so a shared-chrome fragment is not a page finding.
  data.contextualTargets = [
    ...new Set(
      data.links.filter((link) => link.contextual).flatMap(internalTarget),
    ),
  ];
  data.outLinks = [...new Set(data.links.flatMap(internalTarget))];
  data.externalLinks = [
    ...new Set(
      data.links
        .filter((link) => /^https?:/.test(link.href))
        .map((link) => new URL(link.href))
        // The site's own host, compared as a host rather than as a prefix:
        // "https://duoly.gg.example.com" starts with the same characters.
        .filter((url) => url.host !== SITE_HOST)
        .map((url) => url.origin + url.pathname),
    ),
  ];
  pages[path] = data;
  console.error(`${path} ${data.status} ${data.wordCount}w`);
}

/** Link targets outside the audited set still have to resolve. */
const statuses = {};
for (const path of paths) statuses[path] = pages[path].status;
const targets = new Set(
  Object.values(pages).flatMap((p) => p.outLinks.map((l) => l.split('#')[0])),
);
for (const target of targets) {
  if (statuses[target] !== undefined) continue;
  const response = await fetch(base + target, { redirect: 'manual' });
  statuses[target] = response.status;
}

const describes = (link, path) =>
  link.text && !/^(click here|learn more)$/i.test(link.text)
    ? normalizePath(new URL(link.href, base + path).pathname) === path
    : false;

for (const [path, data] of Object.entries(pages)) {
  data.broken = data.outLinks.filter((link) => {
    const [target, hash] = link.split('#');
    const status = statuses[target];
    if (status === undefined || status >= 400) return true;
    // A fragment is only checkable on a page this run rendered, and only on a
    // link the page itself owns.
    return hash && pages[target] && data.contextualTargets.includes(link)
      ? !pages[target].ids.includes(hash)
      : false;
  });
  data.inbound = Object.entries(pages)
    .filter(
      ([source, p]) =>
        source !== path &&
        p.links.some(
          (link) =>
            /^(\/|https:\/\/duoly\.gg|#)/.test(link.href) &&
            describes(link, path),
        ),
    )
    .map(([source]) => source);
  data.contextualInbound = Object.entries(pages)
    .filter(
      ([source, p]) =>
        source !== path &&
        source !== '/' &&
        p.links.some(
          (link) =>
            link.contextual &&
            /^(\/|https:\/\/duoly\.gg)/.test(link.href) &&
            describes(link, path),
        ),
    )
    .map(([source]) => source);
  data.internalOut = data.outLinks.filter(
    (link) => !link.startsWith(`${path}#`),
  ).length;
}

const groupBy = (field) => {
  const groups = new Map();
  for (const [path, data] of Object.entries(pages)) {
    const value = data[field];
    if (!value) continue;
    groups.set(value, [...(groups.get(value) ?? []), path]);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([value, list]) => ({ value, paths: list }));
};
const duplicateTitles = groupBy('title');
const duplicateDescriptions = groupBy('description');

/** The same sentence on three or more pages reads as a template, not as copy. */
const crossPage = new Map();
for (const [path, data] of Object.entries(pages))
  for (const sentence of new Set(sentences(data.text))) {
    const key = normalizeSentence(sentence);
    if (key.length < 45) continue;
    crossPage.set(key, [...(crossPage.get(key) ?? []), path]);
  }
const sharedSentences = [...crossPage.entries()]
  .filter(([, list]) => list.length >= 3)
  .map(([text, list]) => ({ text: text.slice(0, 120), pages: list.length }))
  .sort((a, b) => b.pages - a.pages);

for (const [path, data] of Object.entries(pages)) {
  const indexed = (data.robots ?? '').startsWith('index');
  const flags = [];
  if (!data.title) flags.push('no title');
  else if (data.title.length < TITLE_MIN)
    flags.push(`title short (${data.title.length})`);
  else if (data.title.length > TITLE_MAX)
    flags.push(`title long (${data.title.length})`);
  if (duplicateTitles.some((g) => g.paths.includes(path)))
    flags.push('duplicate title');
  if (!data.description) flags.push('no meta description');
  else if (data.description.length < DESCRIPTION_MIN)
    flags.push(`description short (${data.description.length})`);
  else if (data.description.length > DESCRIPTION_MAX)
    flags.push(`description long (${data.description.length})`);
  if (duplicateDescriptions.some((g) => g.paths.includes(path)))
    flags.push('duplicate description');
  if (data.h1Document !== 1) flags.push(`h1 count ${data.h1Document}`);
  if (!data.canonical) flags.push('no canonical');
  else if (normalizePath(new URL(data.canonical).pathname) !== path)
    flags.push(`canonical points at ${new URL(data.canonical).pathname}`);
  if (!data.robots) flags.push('no robots meta');
  if (indexed && data.wordCount < THIN_WORDS)
    flags.push(`thin copy (${data.wordCount} words)`);
  if (indexed && data.schemaTypes.length === 0) flags.push('no JSON-LD');
  if (data.schemaErrors.length) flags.push(...data.schemaErrors);
  if (data.faqMismatches.length)
    flags.push(`FAQ schema not on the page (${data.faqMismatches.length})`);
  if (data.broken.length) flags.push(`broken links: ${data.broken.join(', ')}`);
  if (data.missingAlt.length)
    flags.push(`images without alt (${data.missingAlt.length})`);
  if (data.copyViolations.length)
    flags.push(
      `copy rules: ${[...new Set(data.copyViolations.map((v) => v.rule))].join(', ')}`,
    );
  if (data.internalTalk.length)
    flags.push(
      `internal words: ${[...new Set(data.internalTalk.map((v) => v.word))].join(', ')}`,
    );
  if (data.articleErrors.length)
    flags.push(
      `wrong article: ${[...new Set(data.articleErrors.map((v) => v.text))].join(', ')}`,
    );
  if (data.repeatedSentences.length)
    flags.push(`repeated sentence (${data.repeatedSentences.length})`);
  if (data.repeatedPrices.length)
    flags.push(
      `price repeated: ${data.repeatedPrices.map((p) => `${p.price} x${p.blocks}`).join(', ')}`,
    );
  if (indexed && data.contextualInbound.length === 0)
    flags.push('no editorial inbound links');
  if (data.readingGrade !== null && data.readingGrade > 12)
    flags.push(`reading grade ${data.readingGrade}`);
  data.flags = flags;
}

await mkdir(out, { recursive: true });
await writeFile(
  `${out}/report.json`,
  JSON.stringify(
    { base, generated: new Date().toISOString(), pages, sharedSentences },
    null,
    2,
  ),
);

// A table cell: backslashes first, so an escaped pipe stays escaped rather than
// turning its own backslash into a second escape.
const cell = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|');
const table = [
  '| Page | Status | Title | Desc | H1 | Canon | Robots | JSON-LD | Words | Grade | In | Out | Q? | Findings |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...Object.entries(pages).map(([path, p]) =>
    [
      `\`${path}\``,
      p.status,
      p.title ? p.title.length : 'none',
      p.description ? p.description.length : 'none',
      p.h1Document,
      p.canonical ? 'yes' : 'no',
      (p.robots ?? 'none').startsWith('index') ? 'index' : (p.robots ?? 'none'),
      p.schemaTypes.join(', ') || 'none',
      p.wordCount,
      p.readingGrade ?? '',
      p.contextualInbound.length,
      p.internalOut,
      p.questionHeadings,
      cell(p.flags.join('; ')) || 'clean',
    ].join(' | '),
  ),
].join('\n');
await writeFile(
  `${out}/summary.md`,
  `# Page quality report\n\nBase: ${base}. Generated ${new Date().toISOString()}.\n\n${table}\n`,
);

const withFlags = Object.values(pages).filter((p) => p.flags.length > 0);
console.log(
  JSON.stringify(
    {
      pages: paths.length,
      pagesWithFindings: withFlags.length,
      findings: withFlags.reduce((sum, p) => sum + p.flags.length, 0),
      duplicateTitles: duplicateTitles.length,
      duplicateDescriptions: duplicateDescriptions.length,
      brokenLinks: Object.values(pages).reduce(
        (sum, p) => sum + p.broken.length,
        0,
      ),
      missingAlt: Object.values(pages).reduce(
        (sum, p) => sum + p.missingAlt.length,
        0,
      ),
      copyViolations: Object.values(pages).reduce(
        (sum, p) => sum + p.copyViolations.length,
        0,
      ),
      internalTalk: Object.values(pages).reduce(
        (sum, p) => sum + p.internalTalk.length,
        0,
      ),
      sharedSentences: sharedSentences.length,
      out,
    },
    null,
    2,
  ),
);
await browser.close();
