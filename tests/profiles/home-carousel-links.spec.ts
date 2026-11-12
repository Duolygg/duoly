/*
 * "Meet your teammates" on the homepage opens the public profiles (owner approval 12 Nov 2026).
 *
 * The homepage reads its cards from public.home_teammates(), which needs a database, so the
 * carousel is rendered here from the island's own component on fixture teammates and served from
 * the site's own origin. The markup, the real stylesheet and the real profile pages are all the
 * ones the site ships: the drift animation, the strip's overflow and /teammates/<slug> behave as
 * they do in production, and only the teammates are invented. Same pattern as
 * tests/e2e/pro-ui.spec.ts, which renders Fabian's dashboard on real props.
 */
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, type Locator, type Page } from '@playwright/test';
import Home from '../../src/components/home/Home.jsx';

const css =
  readFileSync('src/design-reference/globals.css', 'utf8') +
  readFileSync('src/components/home/carousel-links.css', 'utf8');

/** Nyx and Rhea are fixture profiles (profile-fixtures.ts); Kite has none. */
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
    games: ['lol'],
    gg: true,
    online: false,
    rating: 4.8,
    reviews: 41,
    sessions: 96,
    slug: 'rhea',
  },
  {
    name: 'Kite',
    image: '/assets/avatars/avatar-2.png',
    games: ['cs2'],
    gg: false,
    online: false,
    rating: null,
    reviews: 0,
    sessions: 7,
  },
];

const FIXTURE = '/tc-carousel-fixture';

async function openCarousel(page: Page, teammates = crew) {
  await page.route(`**${FIXTURE}`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body:
        '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        `<style>${css}</style></head><body>` +
        renderToStaticMarkup(
          React.createElement(Home, { teammates, recentMatches: [] }),
        ) +
        '</body></html>',
    }),
  );
  await page.goto(FIXTURE);
  await expect(page.locator('.tc-row')).toBeVisible();
}

/*
 * The same carousel with React actually running on it, for the one behaviour that only the
 * browser can show. carousel-mount.jsx explains the arrangement; the preamble is what
 * @vitejs/plugin-react expects a page serving one of its modules to have installed.
 */
async function openMounted(page: Page, teammates = crew) {
  const cards = teammates.map((t) => ({
    ...t,
    plays: t.games.includes('lol'),
    icons: t.games.map((id) => ({
      id,
      name: id.toUpperCase(),
      img: `/assets/games/${id}.png`,
    })),
    stars: t.rating ? '★ ' + t.rating.toFixed(1) : '',
    sessionsText: `${t.sessions} sessions`,
  }));
  await page.route('**/tc-mounted', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body:
        '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        `<style>${css}</style>` +
        '<script type="module">import R from "/@react-refresh";R.injectIntoGlobalHook(window);' +
        'window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(t)=>t;' +
        'window.__vite_plugin_react_preamble_installed__=true;</script>' +
        '</head><body><div id="tc-root"></div>' +
        `<script type="application/json" id="tc-crew">${JSON.stringify(cards)}</script>` +
        '<script type="module" src="/tests/profiles/carousel-mount.jsx"></script>' +
        '</body></html>',
    }),
  );
  await page.goto('/tc-mounted');
  await page.waitForFunction(() => 'tcMounted' in window);
  await expect(page.locator('a.tc-link').first()).toBeAttached();
}

const strip = (page: Page) =>
  page.locator('.tc-set[role="list"] a.tc-link').first();

/*
 * The strip drifts without stopping (the carousels keep their slow pace even under reduced
 * motion, globals.css), and nothing can be clicked while it moves. Focusing a card is what a
 * keyboard visitor does and what the page already answers with a pause
 * (.tc-row:focus-within), so it is how these tests hold the strip still too.
 */
async function hold(page: Page, card: Locator) {
  await card.focus();
  await expect(page.locator('.tc-track')).toHaveCSS(
    'animation-play-state',
    'paused',
  );
}

test('a card opens that teammate’s profile', async ({ page }) => {
  await openCarousel(page);
  const card = strip(page);
  await expect(card).toHaveAttribute('href', '/teammates/nyx');
  await expect(card).toHaveAccessibleName('Nyx, view profile');
  await hold(page, card);
  await card.click();
  await expect(page).toHaveURL(/\/teammates\/nyx$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Nyx' })).toBeVisible();
});

test('Enter on a focused card opens the same profile', async ({ page }) => {
  await openCarousel(page);
  await hold(page, strip(page));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/teammates\/nyx$/);
});

test('the heading opens the directory', async ({ page }) => {
  await openCarousel(page);
  const heading = page.locator('.tc-title a');
  await expect(heading).toHaveText('Meet your teammates');
  await heading.click();
  await expect(page).toHaveURL(/\/teammates$/);
  await expect(
    page.getByRole('heading', { level: 1, name: /great teammate/ }),
  ).toBeVisible();
});

test('the heading stays plain text while no card has a profile', async ({
  page,
}) => {
  await openCarousel(page, [crew[2]]);
  await expect(page.locator('.tc-title')).toHaveText('Meet your teammates');
  await expect(page.locator('.tc-title a')).toHaveCount(0);
  await expect(page.locator('a.tc-link')).toHaveCount(0);
});

test('only the cards screen readers see are tab stops', async ({ page }) => {
  await openCarousel(page);
  // Two teammates have a profile, and the strip repeats them to fill the loop.
  expect(await page.locator('a.tc-link').count()).toBeGreaterThan(2);
  await expect(page.locator('.tc-set[role="list"] a.tc-link')).toHaveCount(2);
  await expect(
    page.locator('.tc-set[aria-hidden="true"] a.tc-link:not([tabindex="-1"])'),
  ).toHaveCount(0);
  // Tabbing from the first card reaches the second teammate, never a copy of the first.
  await strip(page).focus();
  await expect(strip(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.tc-set[role="list"] a.tc-link').nth(1)).toBeFocused();
});

test('a focused card shows a ring and holds the strip still', async ({
  page,
}) => {
  await openCarousel(page);
  const card = strip(page);
  await card.focus();
  const ring = await card.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      width: style.outlineWidth,
      style: style.outlineStyle,
      color: style.outlineColor,
      offset: style.outlineOffset,
    };
  });
  expect(ring.style).not.toBe('none');
  expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
  expect(ring.color).not.toBe('rgba(0, 0, 0, 0)');
  // The drift pauses on focus (globals.css .tc-row:focus-within), so the ring cannot slide away.
  await expect(page.locator('.tc-track')).toHaveCSS(
    'animation-play-state',
    'paused',
  );
  // The card is fully inside the strip, so the ring is not clipped by its overflow.
  const row = await page.locator('.tc-row').boundingBox();
  const box = await card.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(row!.y + 5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(row!.y + row!.height);
});

test('the strip is not left shifted after tabbing through it', async ({
  page,
}) => {
  /*
   * A card too far right for the screen is scrolled into view when it takes focus, which is what
   * makes tabbing through the strip usable. The strip hides its overflow rather than scrolling,
   * so a scroll left behind would keep the loop shifted and let its end drift into view.
   */
  // Eight teammates, each with a profile: the last card then starts beyond the right edge of
  // both screen sizes, so the browser has to scroll the strip to show it.
  await openMounted(
    page,
    Array.from({ length: 8 }, (_, i) => ({
      ...crew[0],
      name: 'Mate' + i,
      slug: 'mate-' + i,
    })),
  );
  const scrolled = () =>
    page.locator('.tc-row').evaluate((node) => node.scrollLeft);
  const cards = page.locator('.tc-set[role="list"] a.tc-link');
  expect(await scrolled()).toBe(0);
  // Focus the first card, which holds the strip still, and then the last one, which is past the
  // right edge of every screen size at that point and so has to be scrolled to.
  await hold(page, cards.first());
  await cards.last().focus();
  expect(await scrolled()).toBeGreaterThan(0);
  // Focus leaving the strip puts it back.
  await page.locator('.tc-title a').focus();
  await expect.poll(scrolled).toBe(0);
});

test('a linked card still lifts under the pointer', async ({ page }) => {
  // The lift and the pause are the card's own behaviour (globals.css .tc-card:hover,
  // .tc-row:hover). Wrapping the card in a link must not take either away.
  await openCarousel(page);
  const card = strip(page);
  await hold(page, card);
  const at = () =>
    card.locator('.tc-card').evaluate((node) => getComputedStyle(node).transform);
  const resting = await at();
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(at).not.toBe(resting);
  await expect(card.locator('.tc-who strong')).toHaveCSS(
    'color',
    'rgb(214, 187, 255)',
  );
});

test('the links cost no request of their own', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (request) => asked.push(request.url()));
  await openCarousel(page);
  await hold(page, strip(page));
  await strip(page).hover();
  await page.locator('.tc-title a').hover();
  await page.waitForTimeout(500);
  // Nothing is prefetched: the profile pages are only fetched when somebody follows a link.
  expect(asked.filter((url) => url.includes('/teammates'))).toEqual([]);
  // Images still wait to be scrolled towards.
  for (const img of await page.locator('.tc-card img').all())
    await expect(img).toHaveAttribute('loading', 'lazy');
  await expect(page.locator('a.tc-link[rel]')).toHaveCount(0);
  await expect(page.locator('a.tc-link[data-astro-prefetch]')).toHaveCount(0);
});

test('the real homepage asks for no profile page', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (request) => asked.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#tc-h')).toBeVisible();
  expect(asked.filter((url) => url.includes('/teammates'))).toEqual([]);
});

test('the directory the heading points at is gone while profiles are off', async ({
  browser,
}, testInfo) => {
  // Why the heading is a link only when a card carries a slug: with PUBLIC_PROFILES_ENABLED off
  // the server sends no slug at all (src/server/home/live.ts) and /teammates answers 404.
  const page = await browser.newPage();
  const port = Number(new URL(testInfo.project.use.baseURL!).port) + 1;
  const response = await page.goto(`http://127.0.0.1:${port}/teammates`);
  expect(response!.status()).toBe(404);
  await page.close();
});
