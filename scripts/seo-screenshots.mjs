/* global console, document, innerWidth */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const out = process.env.SEO_SCREENSHOTS;
if (!out)
  throw new Error('Set SEO_SCREENSHOTS to the screenshot output directory');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const [name, path] of Object.entries({
  coaching: '/games/valorant/coaching',
  social: '/games/social',
  guide: '/blog/what-is-an-egirl',
  valorant: '/games/valorant',
  getpaid: '/get-paid-to-play-games',
})) {
  for (const [device, width] of [
    ['desktop', 1440],
    ['mobile', 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await context.addCookies([
      {
        name: 'duoly-consent',
        value: 'v2.a0.m0.r0',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4381' + path);
    await page.evaluate(() => document.fonts.ready);
    if (await page.locator('astro-dev-toolbar').count())
      throw new Error('Dev toolbar in production');
    await page.screenshot({
      path: `${out}/${name}-${device}-v3.png`,
      fullPage: true,
    });
    await page.screenshot({ path: `${out}/${name}-${device}-hero-v3.png` });
    console.log(
      name,
      device,
      await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
      })),
    );
    await context.close();
  }
}
await browser.close();
