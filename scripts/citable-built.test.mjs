/* global document */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { chromium } from '@playwright/test';

const base = process.env.SEO_BASE || 'http://127.0.0.1:4381';
/** Every indexed coaching page, which has to carry its own formats block. */
const slugs = [
  'valorant',
  'league-of-legends',
  'rocket-league',
  'fortnite',
  'teamfight-tactics',
  'apex-legends',
  'marvel-rivals',
  'counter-strike-2',
  'overwatch-2',
  'rainbow-six-siege',
  'call-of-duty',
  'dota-2',
  'minecraft',
  'world-of-warcraft',
  'deadlock',
];
const paths = [
  ...slugs.map((slug) => `/games/${slug}/coaching`),
  '/games/pokemon-unite/teammate',
];

test('every built coaching page exposes exactly the visible FAQ answers and readable prices', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    for (const path of paths) {
      const response = await page.goto(base + path);
      assert.equal(response.status(), 200);
      const data = await page.evaluate(() => ({
        visible: [
          ...document.querySelectorAll('[aria-labelledby="faq-h"] details'),
        ].map((item) => ({
          question: item.querySelector('summary').textContent.trim(),
          answer: item.querySelector('p').textContent.trim(),
        })),
        schema: [
          ...document.querySelectorAll('script[type="application/ld+json"]'),
        ]
          .map((script) => JSON.parse(script.textContent))
          .find((schema) => schema['@type'] === 'FAQPage'),
        prices: document
          .querySelector('[aria-labelledby="prices"] > p')
          .textContent.trim(),
        heading: document.getElementById('prices').textContent.trim(),
        closing: document
          .querySelector('section[aria-labelledby="closing-h"]')
          ?.textContent.trim(),
        priceDates: [
          ...document.querySelectorAll('[aria-labelledby="prices"] time'),
        ].map((item) => item.textContent.trim()),
        formats: [
          ...document.querySelectorAll('.lesson-formats .format-row dt'),
        ].map((item) => item.textContent.trim()),
        text: document.querySelector('article.seo-page').textContent,
      }));
      assert.deepEqual(
        data.schema.mainEntity.map((item) => ({
          question: item.name,
          answer: item.acceptedAnswer.text,
        })),
        data.visible,
        `${path}: FAQPage equals visible copy`,
      );
      assert(data.heading.endsWith('?'), `${path}: price question`);
      assert.doesNotMatch(
        data.prices,
        /We found|0% quantity|paid lesson|Check each description/,
      );
      // One dated fact lives on a coaching page: the day the prices were read
      // from the checkout engine. It is stated once, under the prices.
      assert.deepEqual(
        data.priceDates,
        ['8 November 2026'],
        `${path}: price date appears once, under the prices`,
      );
      // The formats block promotes what the catalog sells, so every row names a
      // service and every page shows three of them.
      if (path.endsWith('/coaching')) {
        assert.equal(data.formats.length, 3, `${path}: three format rows`);
        for (const title of data.formats)
          assert(title.length > 3, `${path}: empty format row`);
      }
      assert.doesNotMatch(
        data.text,
        /Step 1 is to|match results remain uncertain|familiar setup or a basic decision|Quantity discount: 0%/,
      );
      assert(data.closing, `${path}: closing is a headed section`);
      assert.doesNotMatch(
        data.text,
        /[–—]| & |not [^.!?]+, but |\{\{\w+\}\}|\{price:/i,
        `${path}: editorial constraints`,
      );
    }
  } finally {
    await browser.close();
  }
});
