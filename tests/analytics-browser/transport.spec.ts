import { expect, test } from '@playwright/test';
import { capture, hideAutomation } from './helpers';

test.beforeEach(async ({ page }) => hideAutomation(page));

test('no cookie choice: the SDK sends nothing', async ({ page }) => {
  const { requests } = await capture(page);
  await page.goto('/games');
  await expect(page.locator('#duoly-analytics')).toHaveCount(1);
  await page.waitForTimeout(2500);
  expect(requests.map((r) => r.url())).toEqual([]);
});

test('only necessary: one cookieless pageview, templated, nothing else', async ({
  page,
  context,
}) => {
  const { events } = await capture(page);
  await page.goto('/games?utm_source=tiktok&email=someone%40mail.com');
  await page.locator('[data-consent="necessary"]').click();
  await expect.poll(() => events().map((e) => e.event)).toContain('$pageview');
  await page.waitForTimeout(1000);
  const sent = events();
  expect(new Set(sent.map((e) => e.event))).toEqual(new Set(['$pageview']));
  const pv = sent[0]!;
  expect(pv.properties.$current_url).toBe(
    `http://127.0.0.1:${process.env.DUOLY_TEST_PORT ?? '4361'}/games`,
  );
  expect(pv.properties.route).toBe('/games');
  expect(pv.properties.utm_source).toBeUndefined();
  expect(JSON.stringify(sent)).not.toContain('someone');
  // Cookieless: no PostHog identity cookie or storage.
  const cookies = await context.cookies();
  expect(cookies.filter((c) => c.name.startsWith('ph_'))).toEqual([]);
  const storage = await page.evaluate(() => Object.keys(localStorage));
  expect(storage.filter((k) => /^ph_.*_posthog$/.test(k))).toEqual([]);
});

test('accept all: pageview with campaign data and no secrets', async ({
  page,
}) => {
  const { events } = await capture(page);
  await page.goto('/games?utm_source=tiktok&session_id=cs_live_secret#frag');
  await page.locator('[data-consent="all"]').click();
  await expect.poll(() => events().map((e) => e.event)).toContain('$pageview');
  const pv = events().find((e) => e.event === '$pageview')!;
  expect(pv.properties.$current_url).toBe(
    `http://127.0.0.1:${process.env.DUOLY_TEST_PORT ?? '4361'}/games?utm_source=tiktok`,
  );
  expect(pv.properties.token).toBe('phc_testtesttesttesttest0123456789');
  expect(JSON.stringify(events())).not.toMatch(/cs_live_secret|frag/);
  // Next page: one more pageview, leave event for the first.
  await page.goto('/games/valorant');
  await expect
    .poll(() => events().filter((e) => e.event === '$pageview').length)
    .toBeGreaterThanOrEqual(2);
});

test('withdrawing consent in the banner switches to anonymous counting', async ({
  page,
}) => {
  const { events } = await capture(page);
  await page.goto('/games');
  await page.locator('[data-consent="all"]').click();
  await expect.poll(() => events().length).toBeGreaterThan(0);
  // Footer link equivalent: the banner reopens on #cookie-settings.
  await page.evaluate(() => (location.hash = 'cookie-settings'));
  await expect(page.locator('#cookie-analytics')).toBeVisible();
  await page.locator('#cookie-analytics').uncheck();
  await page.locator('#cookie-marketing').uncheck();
  await page.locator('[data-save-choices]').press('Enter');
  const before = events().length;
  await page.goto('/games/valorant?utm_source=tiktok');
  await expect
    .poll(() =>
      events()
        .slice(before)
        .map((e) => e.event),
    )
    .toContain('$pageview');
  const after = events()
    .slice(before)
    .filter((e) => e.event !== '$pageleave');
  expect(new Set(after.map((e) => e.event))).toEqual(new Set(['$pageview']));
  expect(after[0]!.properties.utm_source).toBeUndefined();
  expect(after[0]!.$set_once).toBeUndefined();
});

/** Fires a same-origin fetch and returns the session header the server would see. */
async function sessionHeader(page: import('@playwright/test').Page) {
  const seen = page.waitForRequest((r) => r.url().endsWith('/__probe'));
  await page.route('**/__probe', (route) => route.fulfill({ body: '' }));
  await page.evaluate(() => fetch('/__probe').catch(() => undefined));
  return (await seen).headers()['x-posthog-session-id'];
}

test('server events join the replay only with Analytics consent', async ({
  page,
}) => {
  const { events } = await capture(page);
  await page.goto('/games');
  await page.locator('[data-consent="necessary"]').click();
  await expect.poll(() => events().length).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  expect(await sessionHeader(page)).toBeUndefined();

  await page.evaluate(() => (location.hash = 'cookie-settings'));
  await page.locator('#cookie-analytics').check();
  await page.locator('[data-save-choices]').press('Enter');
  await expect
    .poll(() => sessionHeader(page), { timeout: 10_000 })
    .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
  // On the next page the header is the SDK's live session, the one events and replay use.
  await page.goto('/games/valorant');
  await expect
    .poll(() => events().filter((e) => e.event === '$pageview').length)
    .toBeGreaterThan(1);
  const sid = await sessionHeader(page);
  const pv = events()
    .filter((e) => e.event === '$pageview')
    .at(-1)!;
  expect(pv.properties.$session_id).toBe(sid);

  // Withdrawal: the header disappears on the same page.
  await page.evaluate(() => (location.hash = 'cookie-settings'));
  await page.locator('#cookie-analytics').uncheck();
  await page.locator('[data-save-choices]').press('Enter');
  await expect
    .poll(() => sessionHeader(page), { timeout: 10_000 })
    .toBeUndefined();
});

test('secret-link pages never get analytics', async ({ page }) => {
  const { requests } = await capture(page);
  await page.goto('/claim/some-secret-token');
  await expect(page.locator('#duoly-analytics')).toHaveCount(0);
  await page.waitForTimeout(1000);
  expect(requests).toEqual([]);
});
