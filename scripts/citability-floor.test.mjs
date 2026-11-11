/* global console, fetch, URL */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { chromium } from '@playwright/test';
import { extractBlocks, scorePage } from './citability.mjs';

const base = process.env.SEO_BASE || 'http://127.0.0.1:4381';

/**
 * The score every SEO content page has to keep, so an edit that strips the
 * answers out of a page fails the build instead of shipping. 85+ is the
 * editorial target; 80 is the floor a page may not fall below.
 */
const FLOOR = 80;

/**
 * Owner policy: the floor applies to editorial content, not to these pages.
 *
 * Each is excluded for a reason that is not "it fails". Legal pages sell
 * nothing and are written for a lawyer rather than an assistant, the homepage
 * copy and design are the co-founder's, and padding a support form for a prose
 * scorer would make it worse to use.
 */
const EXCLUDED = {
  '/': 'Homepage copy and design are the co-founder’s.',
  '/contact': 'Support utility page; never pad a form for a prose scorer.',
  '/terms': 'Legal page; never pad contractual text for a prose scorer.',
  '/privacy': 'Legal page; never pad privacy disclosures for a prose scorer.',
  '/games/social': 'Excluded from SEO by owner decision.',
  // Advisory only, owner decision 11 November 2026: these are trust and
  // reference pages read by customers, journalists and developers, and a
  // readable rewrite scores far below the floor. Their scores are still
  // reported below; technical SEO checks still apply.
  '/about':
    'Company page written for readers; score advisory by owner decision.',
  '/press': 'Press fact sheet; score advisory by owner decision.',
  '/ai': 'AI assistant guide; score advisory by owner decision.',
};

/**
 * Reference and listing pages hold a lower floor: they document tool
 * parameters or list articles, so they cannot be written as long answer
 * passages without padding. Scores on 9 November 2026: /ai 77.1,
 * /developers/mcp 71.9, /blog 73.0.
 *
 * /blog moved from 78.0 to 73.0 when the LFG guide was added: its one scored
 * block carries every card on the index, so a second article is about 45 more
 * words of card text in a block already past the 167-word peak. Splitting the
 * block in two scored worse (67.5), because each half then falls under the
 * peak, so the index keeps one answer.
 */
const REFERENCE_FLOOR = 70;
const REFERENCE_PAGES = {
  '/developers/mcp': 'Technical tool reference with parameter tables.',
  '/blog': 'Article index; its content lives on the article pages.',
};

/**
 * Pages that do not clear their floor yet, with the reason.
 *
 * This list is a declaration, not an exemption: the test below also fails when
 * a page listed here has reached its floor, so the only way to keep the gate
 * green is to move a URL out as it is fixed. It cannot quietly grow, and it
 * cannot quietly go stale.
 */
const BELOW_FLOOR = {};

/** Score exactly what the sitemap offers Google, read from the running build. */
async function sitemapPaths() {
  const response = await fetch(`${base}/sitemap.xml`);
  assert.equal(response.status, 200, 'sitemap.xml is served');
  const paths = [
    ...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g),
  ].map((match) => new URL(match[1]).pathname);
  assert.ok(paths.length > 10, 'sitemap did not list the content pages');
  return paths;
}

const floorFor = (path) =>
  path in EXCLUDED ? 0 : path in REFERENCE_PAGES ? REFERENCE_FLOOR : FLOOR;

test('every SEO content page holds the citability floor', async () => {
  const paths = await sitemapPaths();
  const browser = await chromium.launch();
  const scored = {};
  const failures = [];
  const report = [];
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    for (const path of paths) {
      const response = await page.goto(base + path);
      assert.equal(response.status(), 200, `${path}: not reachable`);
      const blocks = await page.evaluate(extractBlocks);
      assert.ok(blocks.length > 0, `${path}: no scoreable content blocks`);
      const { average, blocks: passages } = scorePage(blocks);
      scored[path] = average;
      const floor = floorFor(path);
      const reason = EXCLUDED[path] ?? BELOW_FLOOR[path] ?? '';
      report.push(
        `${average.toFixed(1).padStart(5)} (floor ${String(floor).padStart(2)}) ${path}${reason ? `: ${reason}` : ''}`,
      );
      if (average < floor && !(path in BELOW_FLOOR)) {
        const worst = [...passages]
          .sort((a, b) => a.total - b.total)
          .slice(0, 3)
          .map(
            (block) =>
              `    ${block.total} (${block.wordCount}w) ${block.heading}`,
          )
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

  // BELOW_FLOOR is a to-do list, so it has to shrink as pages are fixed and it
  // may not name a URL the sitemap no longer serves.
  const fixed = Object.keys(BELOW_FLOOR).filter(
    (path) => (scored[path] ?? 0) >= floorFor(path),
  );
  assert.deepEqual(
    fixed,
    [],
    `these now clear their floor and must leave BELOW_FLOOR in scripts/citability-floor.test.mjs: ${fixed
      .map((path) => `${path} at ${scored[path]}`)
      .join(', ')}`,
  );
  const unknown = [...Object.keys(BELOW_FLOOR), ...Object.keys(REFERENCE_PAGES)]
    .concat(Object.keys(EXCLUDED).filter((path) => path !== '/games/social'))
    .filter((path) => !(path in scored));
  assert.deepEqual(
    unknown,
    [],
    `these are listed in scripts/citability-floor.test.mjs but are no longer in the sitemap; remove the entries: ${unknown}`,
  );
  for (const path of Object.keys(BELOW_FLOOR))
    assert.ok(
      !EXCLUDED[path],
      `${path} cannot be both excluded and below floor`,
    );
});
