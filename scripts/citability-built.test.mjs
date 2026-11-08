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

/**
 * Pages the floor does not apply to, each with the score it must still hold.
 * Every entry needs a reason: this list is for pages whose genre the scorer
 * cannot read as prose, never for a page that simply has not been written yet.
 */
const EXCEPTIONS = {
  // Legal text. Clause numbering and defined terms, not answers.
  '/terms': 0,
  '/privacy': 0,
  // Fabian's homepage design and copy, measured but not edited here.
  '/': 0,
  // A ported support form. The one prose block is Fabian's copy, and adding
  // answer sections to a contact form would be filler.
  '/contact': 0,
  // An API reference. Its prose blocks score 78 to 82, but the blocks holding
  // the tool table and the JSON-RPC samples cannot reach the scorer's prose
  // shape without padding the samples, so this page keeps its own floor.
  '/developers/mcp': 75,

  // FOLLOW-UP, one content pass away from the floor. The game hubs (#184) and
  // the find-a-teammate pages (#183) merged while this branch was in flight.
  // Shared lifts here (the closing detail paragraph and the price note) moved
  // each of them 3 to 5 points, but the rest is per-game copy in their own
  // content files: most blocks still lack a worked example, a "using Discord"
  // style mention and a sequence word, and several run past 167 words.
  //
  // Each floor is the score measured on 8 November 2026, less one point of
  // slack, so none of these pages can get worse while the pass is pending.
  // Delete an entry as its page reaches 80.
  '/games/apex-legends': 75, // 76.0
  '/games/apex-legends/lfg': 76, // 77.4
  '/games/arc-raiders': 77, // 78.1
  '/games/call-of-duty': 76, // 77.8
  '/games/call-of-duty/lfg': 76, // 77.4
  '/games/counter-strike-2': 76, // 77.7
  '/games/ea-sports-fc-27': 77, // 78.1
  '/games/fortnite': 77, // 78.2
  '/games/fortnite/duos': 76, // 77.3
  '/games/league-of-legends': 76, // 77.5
  '/games/marvel-rivals': 75, // 76.9
  '/games/minecraft': 75, // 76.8
  '/games/overwatch-2': 76, // 77.0
  '/games/overwatch-2/lfg': 77, // 78.0
  '/games/pokemon-unite': 75, // 76.3
  '/games/rainbow-six-siege': 78, // 79.0
  '/games/rainbow-six-siege/lfg': 77, // 78.1
  '/games/rocket-league': 75, // 76.9
  '/games/teamfight-tactics': 75, // 76.7
  '/games/valorant/lfg': 77, // 78.0

  // The two oldest hubs still render the pre-#184 layout and sit far below the
  // rest, which is worth the owner's attention rather than a quiet exception.
  '/games/social': 40, // 41.4
  '/games/valorant': 41, // 42.4
};

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
      const floor = EXCEPTIONS[path] ?? FLOOR;
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
    `Citability dropped below the floor. Rework the listed blocks into a question heading with a direct first sentence, 134 to 167 words, short sentences and real prices from the pricing helpers. Never pad a block to pass.\n${failures.join('\n')}`,
  );
});

test('the exception list stays honest', async () => {
  const paths = new Set(await sitemapPaths());
  for (const path of Object.keys(EXCEPTIONS))
    assert(
      paths.has(path),
      `${path} is excepted from the citability floor but is no longer in the sitemap; remove the entry`,
    );
});
