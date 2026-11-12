/* Scratch-only: screenshots of the carousel for the PR. Not committed. */
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from '@playwright/test';
import Home from '../../src/components/home/Home.jsx';

const out = process.env.TC_SHOTS!;
const css =
  readFileSync('src/design-reference/globals.css', 'utf8') +
  readFileSync('src/components/home/carousel-links.css', 'utf8');
const crew = [
  {
    name: 'Nyx',
    image: '/assets/avatars/avatar-3.png',
    games: ['val', 'lol'],
    gg: false,
    online: true,
    rating: 4.9,
    reviews: 128,
    sessions: 312,
    slug: 'nyx',
  },
  {
    name: 'Rhea',
    image: '/assets/avatars/avatar-5.png',
    games: ['lol', 'cs2'],
    gg: true,
    online: false,
    rating: 4.8,
    reviews: 41,
    sessions: 96,
    slug: 'rhea',
  },
  {
    name: 'Kairo',
    image: '/assets/avatars/avatar-7.png',
    games: ['cs2'],
    gg: false,
    online: true,
    rating: 4.7,
    reviews: 18,
    sessions: 54,
    slug: 'kairo',
  },
  {
    name: 'Kite',
    image: '/assets/avatars/avatar-2.png',
    games: ['fn'],
    gg: false,
    online: false,
    rating: null,
    reviews: 0,
    sessions: 7,
  },
];

test('carousel shots', async ({ page }, testInfo) => {
  const width = testInfo.project.use.viewport!.width;
  await page.route('**/tc-shots', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body:
        '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        `<style>${css}body{background:#0B0516;margin:0}</style></head><body>` +
        renderToStaticMarkup(
          React.createElement(Home, { teammates: crew, recentMatches: [] }),
        ) +
        '</body></html>',
    }),
  );
  await page.goto('/tc-shots');
  const section = page.locator('section.tc');
  await expect(section).toBeVisible();
  await section.scrollIntoViewIfNeeded();
  const card = page.locator('.tc-set[role="list"] a.tc-link').first();
  // Resting state, with the strip held still so the shot is readable.
  await card.focus();
  await expect(page.locator('.tc-track')).toHaveCSS(
    'animation-play-state',
    'paused',
  );
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.waitForTimeout(150);
  await section.screenshot({ path: `${out}/carousel-${width}.png` });
  // Focus ring on the first card.
  await card.focus();
  await page.waitForTimeout(150);
  await section.screenshot({ path: `${out}/carousel-${width}-focus.png` });
  // Hover state: the name turns lavender and the card lifts.
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  await section.screenshot({ path: `${out}/carousel-${width}-hover.png` });
  // The heading link under focus.
  await page.locator('.tc-title a').focus();
  await page.waitForTimeout(150);
  await page
    .locator('.tc-top')
    .screenshot({ path: `${out}/heading-${width}-focus.png` });
  // No horizontal overflow at this width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
