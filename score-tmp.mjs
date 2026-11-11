/* global console, process */
// Per-block citability detail for one or more paths, so a copy edit can be
// aimed at a real gap (a heading that lost its question mark, a block with no
// price in it) instead of guessed at.
import { chromium } from '@playwright/test';
import { extractBlocks, scorePassage } from './scripts/citability.mjs';

const base = process.env.SEO_BASE || 'http://127.0.0.1:4480';
const paths = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ javaScriptEnabled: false });
for (const path of paths) {
  await page.goto(base + path);
  const blocks = await page.evaluate(extractBlocks);
  const scored = blocks.map((block) => scorePassage(block.text, block.heading));
  const average =
    scored.reduce((sum, block) => sum + block.total, 0) / scored.length;
  console.log(`\n=== ${path}  avg ${average.toFixed(1)}`);
  for (const block of scored) {
    const s = block.scores;
    console.log(
      `${String(block.total).padStart(3)} ${String(block.wordCount).padStart(4)}w ` +
        `abq${String(s.answerBlockQuality).padStart(3)} sc${String(s.selfContainment).padStart(3)} ` +
        `sr${String(s.structuralReadability).padStart(3)} sd${String(s.statisticalDensity).padStart(3)} ` +
        `us${String(s.uniquenessSignals).padStart(3)}  ${block.heading.slice(0, 60)}`,
    );
  }
}
await browser.close();
