/* global document, fetch, console, URL */
// Run after npm run build and scripts/seo-preview.mjs with local profile fixtures.
// Fixtures are existing fictional test data, never evidence of production inventory.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { chromium } from '@playwright/test';
import { GAMES } from '../src/design-reference/lib/games.js';

const base = process.env.SEO_BASE || 'http://127.0.0.1:4387';
const output = new URL('../dist/seo-link-check/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
const page = await browser.newPage();
const results = [];
async function load(path) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  const html = await response.text();
  await writeFile(
    new URL(`${path.slice(1).replace(/[^a-z0-9-]/gi, '_')}.html`, output),
    html,
  );
  await page.setContent(html);
  return page.evaluate(() => ({
    robots: document.querySelector('meta[name="robots"]')?.content,
    links: [...document.querySelectorAll('a[href]')].map((a) => ({
      href: a.getAttribute('href'),
      rel: a.getAttribute('rel') || '',
      text: a.textContent.trim(),
      name:
        a.getAttribute('aria-label') ||
        a.textContent.trim() ||
        [...a.querySelectorAll('img[alt]')].map((img) => img.alt).join(' '),
      directory: Boolean(a.closest('[data-directory]')),
      save: a.hasAttribute('data-dc-signin'),
    })),
  }));
}
try {
  for (const game of GAMES) {
    const slug = game.img
      .split('/')
      .at(-1)
      .replace(/\.png$/, '');
    const { links } = await load(`/games/${slug}`);
    assert(
      links.some(
        (a) =>
          a.href === `/games/${slug}/teammates` &&
          a.text === `${game.name} teammates` &&
          !a.rel.includes('nofollow'),
      ),
      `${slug}: missing descriptive followed teammate-directory link`,
    );
    results.push(`PASS hub -> /games/${slug}/teammates`);
  }
  for (const path of [
    '/teammates',
    '/teammates?online=1',
    '/teammates?online=1&sort=rated',
    '/games/league-of-legends/teammates',
    '/games/league-of-legends/teammates?online=1',
  ]) {
    const { links, robots } = await load(path);
    const directory = links.filter((a) => a.directory);
    assert(directory.length > 0, `${path}: directory did not render`);
    if (path.includes('?')) assert.equal(robots, 'noindex, follow');
    for (const a of directory) {
      const facet = /^\/(?:teammates|games\/[^/]+\/teammates)(?:\?|$)/.test(
        a.href,
      );
      if (facet)
        assert.equal(
          a.rel.includes('nofollow'),
          a.href.includes('?'),
          `${path}: ${a.href}`,
        );
      assert(a.name, `${path}: unnamed link to ${a.href}`);
      if (a.save)
        assert(a.text.startsWith('Save '), `${path}: empty save anchor`);
    }
    if (!path.includes('?')) {
      const targets = new Set(
        directory
          .filter((a) => /^\/games\/[^/]+\/teammates$/.test(a.href))
          .map((a) => a.href),
      );
      assert.equal(targets.size, GAMES.length);
    }
    results.push(
      `PASS directory follow policy, filter robots and anchor names: ${path}`,
    );
  }
  const how = await load('/how-it-works');
  const proLink = how.links.find((a) => a.href === '/pro');
  if (process.env.VERIFY_PRO_LINK === '1') {
    assert.equal(proLink?.text, 'Duoly PRO membership');
    assert(!proLink.rel.includes('nofollow'));
    results.push(
      'PASS contextual PRO membership link with PRO configured locally',
    );
  } else {
    assert(!proLink, 'PRO must stay hidden when not configured');
    results.push('PASS disabled PRO does not create a dead link');
  }
  const report = { games: GAMES.length, results };
  await writeFile(
    new URL('report.json', output),
    JSON.stringify(report, null, 2),
  );
  console.log(results.join('\n'));
  console.log(
    `${results.length} checks passed; ${GAMES.length} game hubs. HTML and report saved under dist/seo-link-check/.`,
  );
} finally {
  await browser.close();
}
