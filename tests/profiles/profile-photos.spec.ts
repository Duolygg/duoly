import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import {
  PHOTO_NAME,
  PHOTO_SLUG,
  PHOTO_URL,
  servePhotos,
} from './photo-fixture';

/*
 * Teammates who uploaded a profile picture see their own face on their public page, their card,
 * the directory and the game hub row, instead of the mascot the read function used to substitute
 * (20261112163000_public_profile_photos.sql).
 */

test.beforeEach(async ({ page }) => {
  await servePhotos(page);
});

/** Everything the page promises about one avatar image, measured in the browser. */
const avatarFacts = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const img = document.querySelector<HTMLImageElement>(s)!;
    const style = getComputedStyle(img);
    const box = img.getBoundingClientRect();
    return {
      src: img.src,
      alt: img.alt,
      loading: img.getAttribute('loading'),
      priority: img.getAttribute('fetchpriority'),
      sized: Boolean(img.getAttribute('width') && img.getAttribute('height')),
      fit: style.objectFit,
      round: style.borderTopLeftRadius,
      width: Math.round(box.width),
      height: Math.round(box.height),
      /* Decoded: the fixture bytes really arrived and the browser painted them. */
      natural: `${img.naturalWidth}x${img.naturalHeight}`,
      complete: img.complete,
    };
  }, selector);

test('the hero shows the uploaded photo, round, covered and eager', async ({
  page,
}) => {
  await page.goto(`/teammates/${PHOTO_SLUG}`);
  const hero = await avatarFacts(page, '.tp-hero .tp-figure img');
  expect(hero).toMatchObject({
    src: PHOTO_URL,
    alt: `${PHOTO_NAME}, teammate on Duoly`,
    loading: 'eager',
    priority: 'high',
    sized: true,
    fit: 'cover',
    natural: '256x256',
    complete: true,
  });
  /* A circle, and never printed above 160 CSS px: the file is 256 px, so 2x density holds. */
  expect(hero.round).toBe(`${hero.width / 2}px`);
  expect(hero.width).toBe(hero.height);
  expect(hero.width).toBeLessThanOrEqual(160);
  /* The ring and the live dot are still centred on the photo they frame. */
  expect(
    await page.evaluate(() => {
      const figure = document
        .querySelector('.tp-hero .tp-figure')!
        .getBoundingClientRect();
      const img = document
        .querySelector('.tp-hero .tp-figure img')!
        .getBoundingClientRect();
      const ring = document
        .querySelector('.tp-hero .tp-ring')!
        .getBoundingClientRect();
      return {
        centred:
          Math.round(figure.left + figure.width / 2) ===
            Math.round(img.left + img.width / 2) &&
          Math.round(figure.top + figure.height / 2) ===
            Math.round(img.top + img.height / 2),
        ringRound: Math.round(ring.width) === Math.round(ring.height),
        inside: ring.width >= img.width && ring.height >= img.height,
      };
    }),
  ).toEqual({ centred: true, ringRound: true, inside: true });
  /* The photo is what search engines are told the person looks like. */
  const schema = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(JSON.parse(schema!)[0].mainEntity.image).toBe(PHOTO_URL);
  /* The closing band repeats the same photo, lazily. */
  const closing = await avatarFacts(page, '.tp-closing img');
  expect(closing).toMatchObject({
    src: PHOTO_URL,
    loading: 'lazy',
    fit: 'cover',
  });
  expect(closing.width).toBeLessThanOrEqual(160);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('a teammate without a photo still gets the mascot, drawn as before', async ({
  page,
}) => {
  await page.goto('/teammates/nyx');
  const hero = await avatarFacts(page, '.tp-hero .tp-figure img');
  expect(hero).toMatchObject({
    alt: "Nyx's robot avatar",
    fit: 'contain',
    priority: 'high',
    complete: true,
  });
  expect(hero.src).toMatch(/\/assets\/avatars\/avatar-3\.png$/);
  expect(hero.round).toBe('0px');
});

test('cards and the directory carry the photo too', async ({ page }) => {
  await page.goto('/teammates?game=val');
  const card = page.locator(`.tp-card[href="/teammates/${PHOTO_SLUG}"]`);
  await expect(card).toHaveCount(1);
  const facts = await avatarFacts(
    page,
    `.tp-card[href="/teammates/${PHOTO_SLUG}"] img`,
  );
  expect(facts).toMatchObject({
    src: PHOTO_URL,
    loading: 'lazy',
    sized: true,
    fit: 'cover',
    natural: '256x256',
    complete: true,
  });
  expect(facts.round).toBe(`${facts.width / 2}px`);
  expect(facts.width).toBeLessThanOrEqual(160);
  /* Mascot cards in the same grid are unchanged. */
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLImageElement>('.tp-card img')]
        .filter((img) => img.src.includes('/assets/avatars/'))
        .map((img) => getComputedStyle(img).objectFit),
    ),
  ).not.toContain('cover');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('the game hub row and the related row show the photo', async ({
  page,
}) => {
  await page.goto('/games/valorant');
  await expect(
    page.locator(`.tp-row .tp-card[href="/teammates/${PHOTO_SLUG}"] img`),
  ).toHaveAttribute('src', PHOTO_URL);
  await page.goto('/teammates/nyx');
  const related = page.locator(
    `#more .tp-card[href="/teammates/${PHOTO_SLUG}"] img`,
  );
  await expect(related).toHaveAttribute('src', PHOTO_URL);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

/* Design review: the photo in place of the mascot, at both widths. */
test('screenshots', async ({ page }, testInfo) => {
  const out = process.env.PROFILE_PHOTO_SHOTS;
  test.skip(!out, 'set PROFILE_PHOTO_SHOTS to a directory to write them');
  await mkdir(out!, { recursive: true });
  const shot = async (name: string, path: string) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${out}/${testInfo.project.name}-${name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  };
  await shot('profile-photo', `/teammates/${PHOTO_SLUG}`);
  await page.locator('.tp-hero .tp-figure').screenshot({
    path: `${out}/${testInfo.project.name}-hero-figure.png`,
    animations: 'disabled',
  });
  await shot('directory', '/teammates?game=val');
  await shot('profile-mascot', '/teammates/nyx');
});
