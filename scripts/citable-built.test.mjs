/* global document */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { chromium } from '@playwright/test';

const base = process.env.SEO_BASE || 'http://127.0.0.1:4381';
const slugs = [
  'valorant',
  'league-of-legends',
  'rocket-league',
  'fortnite',
  'teamfight-tactics',
  'apex-legends',
  'marvel-rivals',
];
const paths = [
  ...slugs.map((slug) => `/games/${slug}/coaching`),
  '/games/pokemon-unite/teammate',
];

test('all eight built pages expose exactly the visible FAQ answers and readable prices', async () => {
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
      assert.equal(
        (data.text.match(/8 November 2026/g) || []).length,
        1,
        `${path}: price date appears once`,
      );
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
