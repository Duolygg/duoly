/* global fetch, URL */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { chromium } from '@playwright/test';
import { extractBlocks, scorePage } from './citability.mjs';

const base = process.env.SEO_BASE || 'http://127.0.0.1:4381';

/** Score exactly what the sitemap offers Google, read from the running build. */
async function sitemapPaths() {
  const xml = await fetch(`${base}/sitemap.xml`).then((r) => r.text());
  const paths = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (match) => new URL(match[1]).pathname,
  );
  assert.ok(paths.length > 10, 'sitemap did not list the content pages');
  return paths;
}

/** The score every SEO content page has to keep. 85+ is the editorial target. */
const FLOOR = 80;

/**
 * Pages excluded from the floor, each for a reason that is not "it fails".
 *
 * Legal pages sell nothing and are written for a lawyer rather than an
 * assistant, and the homepage copy and design belong to the co-founder.
 */
const EXCLUDED = {
  '/terms': 'legal page, wording is fixed',
  '/privacy': 'legal page, wording is fixed',
  '/': 'homepage copy and design are the co-founder’s',
};

/**
 * Pages that do not clear the floor yet, with the reason and who is on it.
 *
 * This list is a declaration, not an exemption: the test below also fails when
 * a page listed here has actually reached the floor, so the only way to keep
 * the gate green is to move the URL out of this list as it is fixed. It cannot
 * quietly grow, and it cannot quietly go stale.
 */
const BELOW_FLOOR = {
  '/ai':
    'short status page, being rewritten in the parallel quotability branch',
  '/developers/mcp': 'developer reference, mostly code blocks the scorer skips',
  '/blog': 'index page: one intro paragraph plus post cards',
  '/contact': 'one short block by design',
  '/games': 'index page: game cards rather than prose',
  '/games/social': 'pre-template hub, not yet ported',
  '/get-paid-to-play-games':
    'being rewritten in the parallel quotability branch',
  '/blog/what-is-an-egirl':
    'being rewritten in the parallel quotability branch',
};

test('every SEO content page holds the citability floor', async () => {
  const paths = await sitemapPaths();
  const browser = await chromium.launch();
  const scored = {};
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    for (const path of paths) {
      if (path in EXCLUDED) continue;
      const response = await page.goto(base + path);
      assert.equal(response.status(), 200, `${path}: not reachable`);
      const blocks = await page.evaluate(extractBlocks);
      assert.ok(blocks.length > 0, `${path}: no scoreable content blocks`);
      scored[path] = scorePage(blocks).average;
    }
  } finally {
    await browser.close();
  }
  const dropped = Object.entries(scored).filter(
    ([path, average]) => !(path in BELOW_FLOOR) && average < FLOOR,
  );
  assert.deepEqual(
    dropped,
    [],
    `below the ${FLOOR} citability floor: ${dropped
      .map(([path, average]) => `${path} at ${average}`)
      .join(', ')}`,
  );
  const fixed = Object.keys(BELOW_FLOOR).filter(
    (path) => (scored[path] ?? 0) >= FLOOR,
  );
  assert.deepEqual(
    fixed,
    [],
    `these now clear ${FLOOR} and must leave BELOW_FLOOR in scripts/citability-floor.test.mjs: ${fixed
      .map((path) => `${path} at ${scored[path]}`)
      .join(', ')}`,
  );
  const missing = Object.keys(BELOW_FLOOR).filter((path) => !(path in scored));
  assert.deepEqual(missing, [], `BELOW_FLOOR lists unknown paths: ${missing}`);
});
