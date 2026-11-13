import { test, expect } from '@playwright/test';
import { seoOffers } from '../../src/server/seo/offers';
import { servePhotos } from './photo-fixture';
import { serveHeaders } from './header-fixture';
const port = Number(process.env.DUOLY_PROFILE_TEST_PORT ?? 4389);
/* One fixture teammate has an uploaded photo and one has an uploaded header. Both are answered
   from disk, never from Supabase. */
test.beforeEach(async ({ page }) => {
  await servePhotos(page);
  await serveHeaders(page);
});
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
      /* No stat has reached its sample minimum, so the row is replaced by the new
         state instead of printing an empty scoreboard. */
      await expect(page.locator('.tp-scoreboard')).toHaveCount(0);
      /* Quiet: an eyebrow and one sentence at body size, with no headline announcing the
         one thing the page has nothing to say about. */
      await expect(page.locator('[data-profile-new]')).toHaveText(
        "New on DuolyRatings and sessions show here after Sola's first games.",
      );
      await expect(page.locator('[data-profile-new] strong')).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          [...document.querySelectorAll('[data-profile-new] p')].map((el) =>
            Math.round(parseFloat(getComputedStyle(el).fontSize)),
          ),
        ),
      ).toEqual([13, 15]);
      await expect(page.locator('article.tp-page')).not.toContainText(
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
  /* Nyx, Kairo and Rhea. Lumi and Echo used to carry Nyx's second game because both were
     spread from the Nyx fixture; they are their own Valorant players now, so the League
     filter returns three. */
  await expect(page.locator('.tp-card')).toHaveCount(3);
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
  /* The plain booking link the rest of the site uses: no ?teammate= slug it never read. */
  await expect(page.locator('.tp-cta .tp-primary')).toHaveAttribute(
    'href',
    '/?game=val#modes-h',
  );
  await expect(page.locator('.tp-mobile-booking')).toHaveCount(1);
  await context.close();
});

/*
 * Booking with a named teammate. The e2e server has no account, so these are the signed-out
 * paths: nothing stands between a visitor and the booking page, and the slug they were booking
 * rides along in a cookie that the sign-in checkout asks for spends for them. The Save heart is
 * the one thing left that takes a visitor to sign-in first.
 */
test('a signed-out visitor books at once and is remembered in a cookie', async ({
  page,
}) => {
  await page.goto('/teammates/nyx');
  await page.locator('.tp-cta [data-profile-book="primary"]').click();
  /* Straight to booking: no /login in between. */
  await page.waitForURL(/\/\?game=val/);
  const pending = (await page.context().cookies()).find(
    (c) => c.name === 'duoly_pending_favorite',
  );
  expect(pending?.value).toBe('nyx');
  expect(pending?.sameSite).toBe('Lax');
  /* Two hours, give or take the round trip. */
  expect(pending!.expires - Date.now() / 1000).toBeGreaterThan(7000);
  expect(pending!.expires - Date.now() / 1000).toBeLessThanOrEqual(7200);
  expect(
    (await page.context().cookies()).find((c) => c.name === 'duoly_resume'),
  ).toBeUndefined();
});

test('the Save heart is the only thing that still asks a visitor to sign in', async ({
  page,
}) => {
  await page.goto('/teammates/nyx');
  const heart = page.locator('[data-profile-signin]');
  await expect(heart).toHaveAttribute('href', '/login');
  await expect(heart).toContainText('Save Nyx');
  /* No heart to toggle while signed out, so no button pretends to be one. */
  await expect(page.locator('[data-profile-save]')).toHaveCount(0);
  await heart.click();
  await page.waitForURL('**/login');
  expect(
    (await page.context().cookies()).find((c) => c.name === 'duoly_resume')
      ?.value,
  ).toBe('profile-save:nyx');
});

test('the per-game buttons keep booking that game straight away', async ({
  page,
}) => {
  await page.goto('/teammates/nyx');
  const link = page.locator('.tp-game-book').first();
  await expect(link).toHaveAttribute('data-profile-book', 'game');
  await link.click();
  await page.waitForURL(/\/\?game=/);
  const jar = await page.context().cookies();
  expect(jar.find((c) => c.name === 'duoly_resume')).toBeUndefined();
  /* They still leave the same note behind, so checkout can save the teammate. */
  expect(jar.find((c) => c.name === 'duoly_pending_favorite')?.value).toBe(
    'nyx',
  );
});

/*
 * The signed-in path. There is no account on the fixture server, so the page is served as it
 * would be to a customer: the same markup with saveMode switched over and a CSRF token on it.
 * What is under test is the page's own behaviour, that it saves first and books either way.
 */
const asCustomer = async (
  page: import('@playwright/test').Page,
  answer: { status: number; body: unknown } = {
    status: 200,
    body: { favorite: true, slug: 'nyx', game: 'val' },
  },
) => {
  const posts: unknown[] = [];
  await page.route('**/teammates/nyx*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        'data-save-mode="signin"',
        `data-save-mode="customer" data-csrf="${'t'.repeat(64)}"`,
      ),
    });
  });
  await page.route('**/api/favorites/by-slug', async (route) => {
    posts.push(JSON.parse(route.request().postData() ?? '{}'));
    await route.fulfill({
      status: answer.status,
      contentType: 'application/json',
      body: JSON.stringify(answer.body),
    });
  });
  return posts;
};

test('a customer is saved first, then booking opens', async ({ page }) => {
  const posts = await asCustomer(page);
  await page.goto('/teammates/nyx');
  await page.locator('.tp-cta [data-profile-book="primary"]').click();
  await page.waitForURL(/\/\?game=val/);
  expect(posts).toEqual([{ csrf: 't'.repeat(64), slug: 'nyx' }]);
  /* No sign-in detour and nothing remembered: they were already signed in. */
  expect(
    (await page.context().cookies()).find((c) => c.name === 'duoly_resume'),
  ).toBeUndefined();
});

test('booking still opens when saving fails', async ({ page }) => {
  const posts = await asCustomer(page, {
    status: 503,
    body: { error: 'Favorites are unavailable right now.' },
  });
  await page.goto('/teammates/nyx');
  await page.locator('.tp-game-book').first().click();
  await page.waitForURL(/\/\?game=/);
  expect(posts).toHaveLength(1);
});

test('?save=1 saves the teammate and stays on the profile', async ({
  page,
}) => {
  const posts = await asCustomer(page);
  await page.goto('/teammates/nyx?save=1');
  await expect
    .poll(() => posts)
    .toEqual([{ csrf: 't'.repeat(64), slug: 'nyx' }]);
  /* Saving only: the heart path never moves the visitor on to booking, and the parameter
     is spent off the URL so a reload does not save again. */
  await expect(page).toHaveURL(/\/teammates\/nyx$/);
  await expect(page.locator('main h1')).toHaveText('Nyx');
});

test('a resume parameter is cleaned off the URL and never saves for a visitor', async ({
  page,
}) => {
  const failures: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/favorites/')) failures.push(request.url());
  });
  await page.goto('/teammates/nyx?save=1');
  await expect(page.locator('main h1')).toHaveText('Nyx');
  await expect(page).toHaveURL(/\/teammates\/nyx$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://duoly.gg/teammates/nyx',
  );
  expect(failures).toEqual([]);
  /* The retired booking detour is simply a parameter nothing reads now. */
  await page.goto('/teammates/nyx?book=1');
  await expect(page.locator('main h1')).toHaveText('Nyx');
  expect(failures).toEqual([]);
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
  /* One line, at body size, never as fine print, and inside the booking block rather than
     a paragraph that follows it. */
  const note = page.locator('.tp-cta .tp-note');
  await expect(note).toHaveText(
    'Nyx sees your order with no queue delay. Busy? Another verified teammate takes it.',
  );
  expect(
    await note.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(15);
  /* Readable contrast: the same secondary ink the rest of the body copy uses. */
  expect(
    await page.evaluate(() => {
      const ink = (value: string) =>
        value
          .match(/\d+(\.\d+)?/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => v / 255)
          .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((sum, v, i) => sum + [0.2126, 0.7152, 0.0722][i]! * v, 0);
      const text = ink(
        getComputedStyle(document.querySelector('.tp-cta .tp-note')!).color,
      );
      const page = ink(getComputedStyle(document.body).backgroundColor);
      return (
        Math.round(
          ((Math.max(text, page) + 0.05) / (Math.min(text, page) + 0.05)) * 10,
        ) / 10
      );
    }),
  ).toBeGreaterThanOrEqual(4.5);
});

test('the live dot wears a ring on every side, not a crescent', async ({
  page,
}) => {
  /* This line starts exactly on the container edge and the hero clips there, so a ring
     painted outside the dot's own box came out sliced flat on the left. */
  await page.goto('/teammates/nyx');
  expect(
    await page.evaluate(() => {
      const dot = document.querySelector('.tp-cta .tp-availability i')!;
      const style = getComputedStyle(dot);
      const inner = getComputedStyle(dot, '::before');
      const article = document
        .querySelector('article.tp-page')!
        .getBoundingClientRect();
      const box = dot.getBoundingClientRect();
      return {
        shadow: style.boxShadow,
        ring:
          (parseFloat(style.width) - parseFloat(inner.width)) / 2 ===
          (parseFloat(style.height) - parseFloat(inner.height)) / 2,
        inside: Math.round(box.left - article.left) >= 0,
      };
    }),
  ).toEqual({ shadow: 'none', ring: true, inside: true });
});

test('the hero light sits over the avatar column, not the empty middle', async ({
  page,
  isMobile,
}) => {
  await page.goto('/teammates/nyx');
  expect(
    await page.evaluate(() => {
      const box = (s: string) =>
        document.querySelector(s)!.getBoundingClientRect();
      const sky = box('.tp-sky');
      const art = box('.tp-hero .tp-figure');
      /* The pool is a closest-side ellipse, so its centre is where the light is. */
      const centre =
        sky.left +
        (sky.width *
          parseFloat(
            getComputedStyle(
              document.querySelector('.tp-sky')!,
            ).getPropertyValue('--sky-x'),
          )) /
          100;
      return Math.round(Math.abs(centre - (art.left + art.width / 2)));
    }),
  ).toBeLessThanOrEqual(isMobile ? 40 : 30);
});

test('a teammate with one game gets a band that ends where its content ends', async ({
  page,
  isMobile,
}) => {
  await page.goto('/teammates/pip');
  await expect(page.locator('.tp-game')).toHaveCount(1);
  const geometry = await page.evaluate(() => {
    const card = document.querySelector('.tp-game')!.getBoundingClientRect();
    const list = document.querySelector('.tp-game dl')!.getBoundingClientRect();
    const book = document
      .querySelector('.tp-game-book')!
      .getBoundingClientRect();
    return {
      stacked: book.top > list.bottom,
      /* The booking link closes the row instead of leaving a dead right third. */
      rightGap: Math.round(card.right - book.right),
      /* The detail pairs stay a stat line, never stretched across the whole band. */
      listWidth: Math.round(list.width),
      rule: getComputedStyle(document.querySelector('.tp-game-book')!)
        .borderTopWidth,
    };
  });
  if (isMobile) {
    /* Narrow: back to a stacked card, with the rule above its booking link. */
    expect(geometry.stacked).toBe(true);
    expect(geometry.rule).toBe('1px');
  } else {
    expect(geometry.stacked).toBe(false);
    expect(geometry.rightGap).toBeLessThanOrEqual(30);
    expect(geometry.listWidth).toBeLessThanOrEqual(560);
    expect(geometry.rule).toBe('0px');
  }
});

test('narrow: the price comes before the button it belongs to, with no lit band', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/teammates/nyx');
  expect(
    await page.evaluate(() => {
      const row = (buy: Element) => {
        const price = buy.querySelector('.tp-price')!.getBoundingClientRect();
        const button = buy.querySelector('.tp-button')!.getBoundingClientRect();
        return {
          priceFirst: price.bottom <= button.top,
          size: Math.round(
            parseFloat(
              getComputedStyle(buy.querySelector('.tp-price strong')!).fontSize,
            ),
          ),
        };
      };
      const buys = [...document.querySelectorAll('.tp-cta .tp-buy')];
      return {
        rows: buys.map(row),
        /* The button is as wide as the hero, which clips its own box, so a glow here
           came out as a band sliced flat at both gutters. */
        shadow: getComputedStyle(document.querySelector('.tp-cta .tp-primary')!)
          .boxShadow,
      };
    }),
  ).toEqual({
    rows: [
      { priceFirst: true, size: 20 },
      /* The coaching price is a step quieter than the one it is an alternative to. */
      { priceFirst: true, size: 17 },
    ],
    shadow: 'none',
  });
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

test('the hero light ends inside the page, with no outlined name, and no card is chamfered', async ({
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
      const inside = (r: DOMRect) =>
        Math.round(r.left - article.left) >= 0 &&
        Math.round(article.right - r.right) >= 0;
      return {
        /* The light ends inside the container and is transparent there, so the clip on
           the hero never cuts a visible pixel: no panel edge at the container sides. */
        skyInside: inside(sky),
        /* The outlined repeat of the name is gone: it read as noise, and at 390 it was
           still cut flat against the gutter. */
        ghost: document.querySelectorAll('.tp-ghostname').length,
        /* The light starts above the first hero row, so it has room to fade in. */
        skyAboveGrid: sky.top < box('.tp-hero-grid').top,
      };
    });
    expect(hero, `hero light at ${width}`).toEqual({
      skyInside: true,
      ghost: 0,
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
  /* Rank, game and the verified tick live under the name, and nowhere else. The game is
     named by its own icon at text size, never by a coloured crest that read as a warning. */
  await expect(page.locator('.tp-rankline')).toHaveText(/Valorant, Immortal 3/);
  await expect(page.locator('.tp-rankline .tp-verified')).toHaveCount(1);
  await expect(page.locator('.tp-rankline-icon')).toHaveAttribute(
    'src',
    /\/assets\/games\//,
  );
  await expect(
    page.locator('.tp-rankline svg:not(.tp-verified svg)'),
  ).toHaveCount(0);
  await expect(page.locator('.tp-idlist')).not.toContainText('Immortal 3');
  await expect(page.locator('h1 .tp-verified')).toHaveCount(0);
  /* The mascot starts on the cap of the name, not above it and not halfway down the hero.
     The cap of a capital, not of this name's own tallest glyph, so a name with an ascender
     and a name without one put the mascot in the same place. */
  const capOffset = () =>
    page.evaluate(() => {
      const h1 = document.querySelector('h1')!;
      const style = getComputedStyle(h1);
      const pen = document.createElement('canvas').getContext('2d')!;
      pen.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = pen.measureText('H');
      const line = h1.getBoundingClientRect();
      const baseline =
        line.top +
        line.height / 2 +
        (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
      const art = document
        .querySelector('.tp-hero .tp-figure img')!
        .getBoundingClientRect();
      return Math.round(
        Math.abs(art.top - (baseline - metrics.actualBoundingBoxAscent)),
      );
    });
  expect(await capOffset()).toBeLessThanOrEqual(2);
  /* An unverified teammate gets the icon and the game, with no rank and no tick. */
  await page.goto('/teammates/rhea');
  await expect(page.locator('.tp-rankline')).toHaveText('League of Legends');
  await expect(page.locator('.tp-rankline .tp-verified')).toHaveCount(0);
  await expect(page.locator('.tp-rankline-icon')).toHaveCount(1);
  expect(await capOffset()).toBeLessThanOrEqual(2);
  await page.goto('/teammates/nyx');
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
     closing band carries no rule, so it simply keeps the same 72 px gap. Three sections
     follow the first on this profile: reviews, more teammates and the booking answers. */
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.tp-section')].slice(1).map((el) => {
        const style = getComputedStyle(el);
        return parseFloat(style.marginTop) + parseFloat(style.paddingTop);
      }),
    ),
  ).toEqual([72, 72, 72]);
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
  ).toEqual(['24px', '24px', '24px', '24px']);
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
