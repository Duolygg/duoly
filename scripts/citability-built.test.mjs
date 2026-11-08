/* global console, fetch, URL */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { chromium } from '@playwright/test';
import { extractBlocks, scorePage } from './citability.mjs';

const base = process.env.SEO_BASE || 'http://127.0.0.1:4381';

/**
 * The floor every content page in the sitemap has to clear, so an edit that
 * strips the answers out of a page fails the build instead of shipping. The
 * score comes from scripts/citability.mjs, a documented approximation of the
 * research citability scorer.
 */
const FLOOR = 80;

/** Owner policy: the 80 floor applies to editorial content, not these pages. */
const EXCLUDED = {
  '/': "Homepage is the owner's protected design.",
  '/contact': 'Support utility page; never pad a form for a prose scorer.',
  '/terms': 'Legal page; never pad contractual text for a prose scorer.',
  '/privacy': 'Legal page; never pad privacy disclosures for a prose scorer.',
  '/games/social': 'Excluded from SEO by owner decision.',
};

// TODO(feat/seo-rank-titles-quotability): remove this temporary list after the
// sibling PR lands. That worker owns hub copy and these six LFG pages.
const PENDING_SEO_RANK_TITLES_QUOTABILITY = [
  '/games/valorant/lfg',
  '/games/fortnite/duos',
  '/games/overwatch-2/lfg',
  '/games/apex-legends/lfg',
  '/games/call-of-duty/lfg',
  '/games/rainbow-six-siege/lfg',
];
const pendingSiblingRewrite = (path) =>
  (/^\/games\/[^/]+$/.test(path) && path !== '/games/social') ||
  PENDING_SEO_RANK_TITLES_QUOTABILITY.includes(path);

const sitemapPaths = async () => {
  const response = await fetch(`${base}/sitemap.xml`);
  assert.equal(response.status, 200, 'sitemap.xml is served');
  const xml = await response.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => new URL(match[1]).pathname,
  );
  assert(paths.length > 0, 'sitemap lists at least one URL');
  return paths;
};

test('every sitemap content page stays citable', async () => {
  const paths = await sitemapPaths();
  const browser = await chromium.launch();
  const failures = [];
  const report = [];
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    for (const path of paths) {
      const response = await page.goto(base + path);
      assert.equal(response.status(), 200, `${path} responds 200`);
      const blocks = await page.evaluate(extractBlocks);
      const { average, blocks: scored } = scorePage(blocks);
      const reason =
        EXCLUDED[path] ||
        (pendingSiblingRewrite(path)
          ? 'pending feat/seo-rank-titles-quotability'
          : '');
      const floor = reason ? 0 : FLOOR;
      report.push(
        `${average.toFixed(1).padStart(5)} (floor ${String(floor).padStart(2)}) ${path}`,
      );
      if (average < floor) {
        const worst = [...scored]
          .sort((a, b) => a.total - b.total)
          .slice(0, 3)
          .map((b) => `    ${b.total} (${b.wordCount}w) ${b.heading}`)
          .join('\n');
        failures.push(
          `${path}: ${average} is below the floor of ${floor}\n${worst}`,
        );
      }
    }
  } finally {
    await browser.close();
  }
  console.log(report.join('\n'));
  assert.equal(
    failures.join('\n'),
    '',
    `Citability is below the required floor. Improve useful answers without repeating prices, inventing evidence or padding prose to pass. Additional exclusions require an explicit owner decision.\n${failures.join('\n')}`,
  );
});

test('the exception list stays honest', async () => {
  const paths = new Set(await sitemapPaths());
  // Social may already be absent from the sitemap, as intended by SEO policy.
  for (const path of Object.keys(EXCLUDED).filter(
    (path) => path !== '/games/social',
  ))
    assert(
      paths.has(path),
      `${path} is excepted from the citability floor but is no longer in the sitemap; remove the entry`,
    );
});
