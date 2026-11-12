import { test, expect } from '@playwright/test';
import { seoOffers } from '../../src/server/seo/offers';
const port = Number(process.env.DUOLY_PROFILE_TEST_PORT ?? 4389);
for (const slug of ['nyx', 'sola', 'kairo'])
  test(`${slug}: SSR, one name, one live price and no overflow`, async ({
    page,
    isMobile,
  }) => {
    const response = await page.goto(`/teammates/${slug}`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control']).toBe('no-store');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveText(
      slug === 'nyx' ? 'Nyx' : slug === 'sola' ? 'Sola' : 'Kairo',
    );
    const game = slug === 'kairo' ? 'lol' : 'val';
    const offer = seoOffers(game, 'teammate', {
      eurToUsd: 1,
      customerCurrency: 'EUR',
    }).sort((a, b) => a.amountMinor - b.amountMinor)[0]!;
    await expect(page.locator('[data-profile-price]')).toContainText(
      offer.display,
    );
    const text = await page.locator('article.tp-page').innerText();
    expect(text.split(offer.display)).toHaveLength(2);
    expect(text).not.toMatch(/[–—&]/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator('.tp-mobile-booking')).toBeVisible({
      visible: isMobile,
    });
    /* Nothing on a profile is allowed to render below 13px. */
    expect(
      await page.evaluate(() =>
        [...document.querySelectorAll('article.tp-page *')]
          .filter(
            (el) =>
              [...el.childNodes].some(
                (n) => n.nodeType === 3 && n.textContent!.trim(),
              ) && el.getClientRects().length,
          )
          .map((el) => ({
            at: el.className || el.tagName,
            size: parseFloat(getComputedStyle(el).fontSize),
          }))
          .filter((row) => row.size < 13),
      ),
    ).toEqual([]);
    expect((await response!.text()).includes('profile-name')).toBe(true);
    const schema = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    expect(schema).not.toMatch(/AggregateRating|ratingValue|"@type":"Review"/);
    if (slug === 'sola') {
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, follow',
      );
      await expect(page.locator('.tp-scoreboard')).toContainText(
        'A fresh face',
      );
      await expect(page.locator('.tp-scoreboard')).not.toContainText(
        'Customer rating',
      );
      await expect(page.locator('.tp-cta .tp-primary')).toHaveText(
        'Book a Valorant teammate',
      );
      await expect(page.locator('.tp-cta .tp-ghost')).toHaveCount(0);
    }
  });
test('301, 410 and missing status codes', async ({ request }) => {
  const moved = await request.get('/teammates/nyxie', { maxRedirects: 0 });
  expect(moved.status()).toBe(301);
  expect(moved.headers().location).toBe('/teammates/nyx');
  const gone = await request.get('/teammates/ghost');
  expect(gone.status()).toBe(410);
  expect(await gone.text()).toContain('noindex, follow');
  expect((await request.get('/teammates/unknown')).status()).toBe(404);
});
test('flag off uses normal 404 and sitemap omits discovery', async ({
  request,
}) => {
  for (const path of ['/teammates/nyx', '/teammates', '/teammates/ghost'])
    expect(
      (await request.get(`http://127.0.0.1:${port + 1}${path}`)).status(),
    ).toBe(404);
  expect(
    await (
      await request.get(`http://127.0.0.1:${port + 1}/sitemap.xml`)
    ).text(),
  ).not.toContain('/teammates');
});
test('directory filters on the server and sitemap uses quality', async ({
  page,
  request,
}) => {
  await page.goto('/teammates?game=lol');
  await expect(page.locator('.tp-card')).toHaveCount(4);
  expect(await page.locator('.tp-card').first().getAttribute('href')).toBe(
    '/teammates/nyx',
  );
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml).toContain('/teammates/nyx');
  expect(xml).not.toContain('/teammates/sola');
  expect(xml).toContain('<lastmod>2026-11-12T12:00:00.000Z</lastmod>');
});
test('core content and booking links work without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/teammates/nyx`);
  await expect(page.locator('#games')).toContainText('Immortal 3');
  await expect(page.locator('.tp-cta .tp-primary')).toHaveAttribute(
    'href',
    /game=val.*teammate=nyx/,
  );
  await expect(page.locator('.tp-mobile-booking')).toHaveCount(1);
  await context.close();
});

test('one booking verb, one arrow glyph and reviews without text stay quiet', async ({
  page,
}) => {
  await page.goto('/teammates/nyx');
  const article = page.locator('article.tp-page');
  await expect(article).not.toContainText('Queue with');
  await expect(article).not.toContainText('Fictional review');
  for (const label of await page
    .locator('a:has-text("Book"), .tp-mobile-booking a')
    .allInnerTexts())
    expect(label.trim().startsWith('Book')).toBe(true);
  /* Every arrow on the page is the same inline SVG, and no card carries one. */
  expect(
    await page.evaluate(() => {
      const text = document.querySelector('article.tp-page')!.textContent ?? '';
      return [...text].filter((c) => '\u2192\u2191\u2197\u279C'.includes(c))
        .length;
    }),
  ).toBe(0);
  await expect(page.locator('.tp-card svg')).toHaveCount(0);
  /* Four written reviews minus the one with no text: a lead plus an even grid. */
  await expect(page.locator('.tp-review-lead')).toHaveCount(1);
  await expect(
    page.locator('.tp-review-wrap .tp-review:not(.tp-review-lead)'),
  ).toHaveCount(2);
  await expect(page.locator('.tp-tags .tp-tag').first()).toContainText(
    '74 mentions',
  );
  /* Tabs and the headings they point at use the same names. */
  for (const tab of await page.locator('.tp-tabs a').all()) {
    const name = (await tab.innerText()).trim();
    await expect(
      page.locator(`${await tab.getAttribute('href')} h2`),
    ).toHaveText(name);
  }
});

test('the hero carries one online signal, one booking unit and no upscaled mascot', async ({
  page,
  isMobile,
}) => {
  await page.goto('/teammates/nyx');
  const hero = page.locator('.tp-hero');
  /* The live dot on the ring plus one availability line, and no separate status row. */
  await expect(hero.locator('.tp-ring-dot')).toHaveCount(1);
  await expect(hero.locator('.tp-availability')).toHaveCount(1);
  await expect(hero.locator('.tp-availability')).toContainText('Online now');
  expect((await hero.innerText()).toLowerCase().split('online').length).toBe(2);
  /* The coaching price is the one other price the page is allowed to show. */
  await expect(page.locator('.tp-price-quiet')).toHaveCount(1);
  /* The art only exists at 160 px, so nothing may paint it larger than that. */
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLImageElement>('article.tp-page img')]
        .map((img) => img.getBoundingClientRect().width)
        .filter((width) => width > 160),
    ),
  ).toEqual([]);
  /* Both buttons share one column, so they come out the same size at every width, and
     each price line is centred on its own button. */
  const sizes = await page.evaluate(() =>
    ['.tp-cta .tp-primary', '.tp-cta .tp-ghost'].map((selector) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      return { h: Math.round(box.height), w: Math.round(box.width) };
    }),
  );
  expect(sizes[0]!.h).toBe(56);
  expect(sizes[1]!.h).toBe(56);
  expect(sizes[0]!.w).toBe(sizes[1]!.w);
  if (!isMobile)
    expect(
      await page.evaluate(() => {
        const prices = document.querySelectorAll('.tp-cta .tp-price');
        return ['.tp-cta .tp-primary', '.tp-cta .tp-ghost'].map(
          (selector, i) => {
            const button = document
              .querySelector(selector)!
              .getBoundingClientRect();
            const price = prices[i]!.getBoundingClientRect();
            const off =
              price.top + price.height / 2 - (button.top + button.height / 2);
            return Math.abs(off) <= 1;
          },
        );
      }),
    ).toEqual([true, true]);
  /* The availability line closes the block under the pair, on its own full width row. */
  expect(
    await page.evaluate(() => {
      const line = document
        .querySelector('.tp-cta .tp-availability')!
        .getBoundingClientRect();
      const ghost = document
        .querySelector('.tp-cta .tp-ghost')!
        .getBoundingClientRect();
      return {
        below: line.top >= ghost.bottom,
        left: Math.round(line.left - ghost.left),
      };
    }),
  ).toEqual({ below: true, left: 0 });
  /* The fallback promise reads at body size, never as fine print. */
  expect(
    await page
      .locator('.tp-note')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(15);
  await expect(page.locator('.tp-note')).toContainText('so you never wait');
});

test('nothing in the profile touches the viewport edge', async ({ page }) => {
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/teammates/nyx');
    const gutters = await page.evaluate(() => {
      let left = Infinity;
      let right = Infinity;
      for (const el of document.querySelectorAll('article.tp-page *')) {
        /* The booking bar is a deliberate full width bar; the decorative light and the
           outlined name are measured on their own in the hero test below. */
        if (el.closest('.tp-mobile-booking, [aria-hidden="true"]')) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        const box = el.getBoundingClientRect();
        if (box.width < 1 || box.height < 1) continue;
        left = Math.min(left, box.left);
        right = Math.min(right, innerWidth - box.right);
      }
      return {
        left,
        right,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(gutters.overflow, `overflow at ${width}`).toBeLessThanOrEqual(0);
    expect(gutters.left, `left gutter at ${width}`).toBeGreaterThanOrEqual(16);
    expect(gutters.right, `right gutter at ${width}`).toBeGreaterThanOrEqual(
      16,
    );
  }
});

test('the section nav sticks under the header and follows the scroll', async ({
  page,
}) => {
  await page.goto('/teammates/nyx');
  const tabs = page.locator('.tp-tabs');
  const header = await page
    .locator('.site-header')
    .evaluate((el) => el.getBoundingClientRect().height);
  for (const [anchor, label] of [
    ['#games', 'Games'],
    ['#reviews', 'Reviews'],
    ['#more', 'More teammates'],
  ] as const) {
    await page.evaluate((id) => {
      const el = document.querySelector(id)!;
      scrollTo(0, el.getBoundingClientRect().top + scrollY - 120);
    }, anchor);
    await expect(page.locator('.tp-tabs a.is-current')).toHaveText(label);
    await expect(page.locator('.tp-tabs a[aria-current]')).toHaveCount(1);
    expect(
      Math.round(await tabs.evaluate((el) => el.getBoundingClientRect().top)),
    ).toBeCloseTo(Math.round(header), -1);
  }
});

test('the sticky bar steps aside while a booking block is on screen', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the sticky bar only exists on small screens');
  await page.goto('/teammates/nyx');
  const bar = page.locator('.tp-mobile-booking');
  await expect(bar).toHaveClass(/is-stowed/);
  await page.locator('#games').scrollIntoViewIfNeeded();
  await expect(bar).not.toHaveClass(/is-stowed/);
  await page.locator('[data-closing]').scrollIntoViewIfNeeded();
  await expect(bar).toHaveClass(/is-stowed/);
});

test('the hero light and the outlined name end inside the page, and no card is chamfered', async ({
  page,
}) => {
  for (const width of [1440, 1280, 1024, 920, 768, 390, 360]) {
    await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
    await page.goto('/teammates/nyx');
    const hero = await page.evaluate(() => {
      const box = (s: string) =>
        document.querySelector(s)!.getBoundingClientRect();
      const article = box('article.tp-page');
      const sky = box('.tp-sky');
      const ghost = box('.tp-ghostname');
      const inside = (r: DOMRect) =>
        Math.round(r.left - article.left) >= 0 &&
        Math.round(article.right - r.right) >= 0;
      return {
        /* Both decorative layers end inside the container and are transparent there, so
           the clip on the hero never cuts a visible pixel: no panel edge at the container
           sides, no sliced glyph. */
        skyInside: inside(sky),
        ghostInside: inside(ghost),
        /* The light starts above the first hero row, so it has room to fade in. */
        skyAboveGrid: sky.top < box('.tp-hero-grid').top,
      };
    });
    expect(hero, `hero light at ${width}`).toEqual({
      skyInside: true,
      ghostInside: true,
      skyAboveGrid: true,
    });
  }
  /* The slash motif keeps the tab marker and the tier plaque. Cards are plain. */
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.tp-game, .tp-card')]
        .map((el) => getComputedStyle(el).clipPath)
        .filter((value) => value !== 'none'),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector('.tp-plate')!).clipPath,
    ),
  ).toContain('polygon');
  /* The tier reads as one full width rule on the card, never as a short stub. */
  expect(
    await page.evaluate(() => {
      const card = document.querySelector('.tp-card')!;
      const style = getComputedStyle(card);
      return {
        width: style.borderTopWidth,
        colour: style.borderTopColor === getComputedStyle(card).borderTopColor,
        stub: getComputedStyle(card, '::before').content,
      };
    }),
  ).toEqual({ width: '2px', colour: true, stub: 'none' });
});

test('the lockup carries the rank once and the stats row reads as one set', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/teammates/nyx');
  /* Rank, game and the verified tick live under the name, and nowhere else. */
  await expect(page.locator('.tp-rankline')).toHaveText(/Valorant, Immortal 3/);
  await expect(page.locator('.tp-rankline .tp-verified')).toHaveCount(1);
  await expect(page.locator('.tp-idlist')).not.toContainText('Immortal 3');
  await expect(page.locator('h1 .tp-verified')).toHaveCount(0);
  expect(
    (await page.locator('.tp-hero').innerText()).split('Immortal 3').length,
  ).toBe(2);
  /* No label in the stats row is underlined, including the one that is a link. */
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.tp-stat-name, .tp-stat-sub')].map(
        (el) => getComputedStyle(el).textDecorationLine,
      ),
    ),
  ).toEqual(Array(6).fill('none'));
  await expect(page.locator('a.tp-stat')).toHaveAttribute('href', '#reviews');
  /* The whole stats row, captions included, is in the first viewport at 1440x900. */
  expect(
    await page.evaluate(
      () =>
        document.querySelector('.tp-scoreboard')!.getBoundingClientRect()
          .bottom,
    ),
  ).toBeLessThanOrEqual(900);
  /* A section opens 48 px under the one before it and gives its rule 24 px of air; the
     closing band carries no rule, so it simply keeps the same 72 px gap. */
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.tp-section')].slice(1).map((el) => {
        const style = getComputedStyle(el);
        return parseFloat(style.marginTop) + parseFloat(style.paddingTop);
      }),
    ),
  ).toEqual([72, 72]);
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector('.tp-closing')!).marginTop,
    ),
  ).toBe('72px');
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.tp-section-head')].map(
        (el) => getComputedStyle(el).marginBottom,
      ),
    ),
  ).toEqual(['24px', '24px', '24px']);
  /* One grid for the reviews: the featured quote spans it, the rest sit under it in
     equal columns that start on the same left edge as the tag bars. */
  expect(
    await page.evaluate(() => {
      const left = (el: Element) => Math.round(el.getBoundingClientRect().left);
      const reviews = [...document.querySelectorAll('.tp-review')];
      return {
        tags: left(document.querySelector('.tp-tag')!),
        lead: left(reviews[0]!),
        leadWidth: Math.round(reviews[0]!.getBoundingClientRect().width),
        wrapWidth: Math.round(
          document.querySelector('.tp-review-wrap')!.getBoundingClientRect()
            .width,
        ),
        rest: reviews.slice(1).map(left),
        captions: reviews.map((el) =>
          Math.round(
            el.querySelector('figcaption')!.getBoundingClientRect().top -
              el.querySelector('blockquote')!.getBoundingClientRect().bottom,
          ),
        ),
      };
    }),
  ).toEqual({
    tags: 96,
    lead: 96,
    leadWidth: 1248,
    wrapWidth: 1248,
    rest: [96, 720],
    captions: [16, 16, 16],
  });
});
