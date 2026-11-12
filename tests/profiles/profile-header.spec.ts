import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { servePhotos } from './photo-fixture';
import {
  HEADER_SLUG,
  HEADER_URL,
  PLAIN_SLUG,
  serveHeaders,
} from './header-fixture';

/*
 * The header a teammate uploads in settings, on the page a visitor sees. The picture is the
 * backdrop of the hero: it sits under the pool of light and under every word, and the hero of a
 * teammate without a header is the page that shipped before this feature.
 */

test.beforeEach(async ({ page }) => {
  await servePhotos(page);
});

/** Everything the hero promises about the header picture, measured in the browser. */
const headerFacts = (page: Page) =>
  page.evaluate(() => {
    const art = document.querySelector<HTMLElement>('.tp-hero-art')!;
    const img = art.querySelector('img')!;
    const style = getComputedStyle(img);
    const box = art.getBoundingClientRect();
    const hero = document
      .querySelector<HTMLElement>('.tp-hero')!
      .getBoundingClientRect();
    const name = document
      .querySelector<HTMLElement>('#profile-name')!
      .getBoundingClientRect();
    return {
      src: img.src,
      alt: img.alt,
      loading: img.getAttribute('loading'),
      priority: img.getAttribute('fetchpriority'),
      sized: `${img.getAttribute('width')}x${img.getAttribute('height')}`,
      fit: style.objectFit,
      position: style.objectPosition,
      /* Decoded: the fixture bytes really arrived and the browser painted them. */
      natural: `${img.naturalWidth}x${img.naturalHeight}`,
      complete: img.complete,
      /* Out of flow, at the top of the hero, as wide as the hero. */
      flow: getComputedStyle(art).position,
      top: Math.round(box.top - hero.top),
      width: Math.round(box.width - hero.width),
      ratio: Math.round((box.width / box.height) * 100) / 100,
      /* Behind the name: the name is painted later and is never pushed down the page. */
      behind:
        art.compareDocumentPosition(
          document.querySelector<HTMLElement>('#profile-name')!,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      nameOverlaps: name.top < box.bottom,
    };
  });

test('the hero carries the header, eager, sized and behind the name', async ({
  page,
  isMobile,
}) => {
  await serveHeaders(page);
  await page.goto(`/teammates/${HEADER_SLUG}`);
  const facts = await headerFacts(page);
  expect(facts).toMatchObject({
    src: HEADER_URL,
    alt: '',
    loading: 'eager',
    priority: 'high',
    sized: '1500x500',
    fit: 'cover',
    natural: '1500x500',
    complete: true,
    flow: 'absolute',
    top: 0,
    width: 0,
  });
  /* Centred on the narrow boxes, which are the ones that give up the sides of the picture. */
  expect(facts.position).toBe('50% 50%');
  expect(facts.ratio).toBe(isMobile ? 1.7 : 3);
  expect(facts.behind).toBeTruthy();
  expect(facts.nameOverlaps).toBe(true);
  /* One request for one file, and no new script on the public page. */
  expect(await page.locator('.tp-hero-art img').count()).toBe(1);
  await expect(page.locator('.tp-hero-art img')).not.toHaveAttribute('srcset');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('a teammate without a header keeps the hero that shipped', async ({
  page,
}) => {
  await serveHeaders(page);
  const response = await page.goto(`/teammates/${PLAIN_SLUG}`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('.tp-hero-art')).toHaveCount(0);
  /* Nothing of the header block reaches a page without one: no element, no request, and the
     pool of light is still the first thing in the hero. */
  expect(await response!.text()).not.toContain('profile-headers');
  expect(
    await page.evaluate(
      () =>
        document.querySelector('.tp-hero')!.firstElementChild!.className ===
        'tp-sky',
    ),
  ).toBe(true);
});

test('the header never moves the hero while it loads', async ({ page }) => {
  /* The picture arrives late on purpose: the hero has to be laid out the same before and
     after it lands, which is what the aspect ratio on the box is for. */
  await serveHeaders(page, { delay: 1500 });
  await page.goto(`/teammates/${HEADER_SLUG}`, {
    waitUntil: 'domcontentloaded',
  });
  const box = () =>
    page.evaluate(() => {
      const grid = document
        .querySelector('.tp-hero-grid')!
        .getBoundingClientRect();
      const art = document
        .querySelector('.tp-hero-art')!
        .getBoundingClientRect();
      return { top: Math.round(grid.top), height: Math.round(art.height) };
    });
  const before = await box();
  expect(
    await page.evaluate(
      () =>
        (document.querySelector('.tp-hero-art img') as HTMLImageElement)
          .complete,
    ),
  ).toBe(false);
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (document.querySelector('.tp-hero-art img') as HTMLImageElement)
            .complete,
      ),
    )
    .toBe(true);
  expect(await box()).toEqual(before);
});

/**
 * The real contrast of the hero type over the picture, measured from rendered pixels: every
 * word is hidden, the backdrop behind each line is photographed, and the brightest pixel in
 * that rectangle is the one the text has to survive.
 */
const worstContrast = async (page: Page, selectors: string[]) => {
  const targets = [];
  for (const selector of selectors) {
    const measured = await page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          color: getComputedStyle(el).color,
          x: box.x + window.scrollX,
          y: box.y + window.scrollY,
          width: box.width,
          height: box.height,
        };
      });
    targets.push({ selector, ...measured });
  }
  /* Visibility keeps every box where it is, so the rectangles measured above still hold. */
  await page.addStyleTag({
    content:
      '.tp-hero-grid,.tp-hero-top,.tp-crumbs,.tp-scoreboard,.tp-fresh,.tp-fixture{visibility:hidden}',
  });
  const results: number[] = [];
  for (const target of targets) {
    const top = await page.evaluate((y) => {
      window.scrollTo(0, Math.max(0, y - 80));
      return window.scrollY;
    }, target.y);
    const shot = await page.screenshot({
      clip: {
        x: target.x,
        y: target.y - top,
        width: target.width,
        height: target.height,
      },
      animations: 'disabled',
    });
    results.push(
      await page.evaluate(
        async ({ data, color }) => {
          const image = new Image();
          image.src = 'data:image/png;base64,' + data;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;
          const luminance = (r: number, g: number, b: number) =>
            [r, g, b]
              .map((v) => {
                const s = v / 255;
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              })
              .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
          let back = 0;
          for (let i = 0; i < pixels.length; i += 4)
            back = Math.max(
              back,
              luminance(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!),
            );
          const [r, g, b] = color.match(/[\d.]+/g)!.map(Number);
          const front = luminance(r!, g!, b!);
          return (
            Math.round(
              ((Math.max(front, back) + 0.05) /
                (Math.min(front, back) + 0.05)) *
                100,
            ) / 100
          );
        },
        { data: shot.toString('base64'), color: target.color },
      ),
    );
  }
  return targets.map((target, i) => ({
    selector: target.selector,
    ratio: results[i]!,
  }));
};

test('hero type clears 4.5:1 over a white header', async ({ page }) => {
  /* White is the brightest thing anyone can upload, so the scrim is measured against it. */
  await serveHeaders(page, { variant: 'white' });
  await page.goto(`/teammates/${HEADER_SLUG}`);
  await expect(page.locator('.tp-hero-art img')).toBeVisible();
  /* Save and Share sit where a picture is often brightest, so they carry their own dark pill:
     at 78% of #090414 over pure white the text keeps about 10:1. */
  const pill = await page
    .locator('[data-profile-share]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(pill).toBe('rgba(9, 4, 20, 0.78)');
  /* And nothing paints over them: the top element at the middle of Share is Share itself. */
  const onTop = await page.locator('[data-profile-share]').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(
      document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
    );
  });
  expect(onTop).toBe(true);
  const lines = await worstContrast(page, [
    '#profile-name',
    '.tp-rankline span',
    '.tp-bio',
    '.tp-idlist dt',
  ]);
  for (const line of lines)
    expect(
      line.ratio,
      `${line.selector} over a white header`,
    ).toBeGreaterThanOrEqual(4.5);
});

test('screenshots', async ({ page }, testInfo) => {
  const out = process.env.PROFILE_HEADER_SHOTS;
  test.skip(!out, 'set PROFILE_HEADER_SHOTS to a directory to write them');
  await mkdir(out!, { recursive: true });
  const shot = async (name: string, path: string) => {
    await page.goto(path);
    await expect(page.locator('h1')).toContainText(/\w/);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${out}/${testInfo.project.name}-${name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.locator('.tp-hero').screenshot({
      path: `${out}/${testInfo.project.name}-${name}-hero.png`,
      animations: 'disabled',
    });
  };
  await serveHeaders(page);
  await shot('profile-header', `/teammates/${HEADER_SLUG}`);
  await shot('profile-plain', `/teammates/${PLAIN_SLUG}`);
  await serveHeaders(page, { variant: 'white' });
  await shot('profile-header-white', `/teammates/${HEADER_SLUG}`);
});
