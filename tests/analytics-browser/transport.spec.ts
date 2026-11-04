import { expect, test, type Page, type Request } from '@playwright/test';
import { gunzipSync } from 'node:zlib';

const HOST = 'https://ph.analytics.test';

// posthog-js treats automated browsers (navigator.webdriver, HeadlessChrome brand) as bots
// and sends nothing.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => false,
    });
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      get: () => undefined,
    });
  });
});

type Sent = {
  event: string;
  properties: Record<string, unknown>;
  $set_once?: unknown;
};

/** Decode a posthog-js batch whatever the transport encoding (json, gzip, base64 form). */
function decode(request: Request): Sent[] {
  const body = request.postDataBuffer();
  if (!body || body.length === 0) return [];
  let text: string;
  try {
    text = gunzipSync(body).toString('utf8');
  } catch {
    text = body.toString('utf8');
  }
  if (text.startsWith('data=')) {
    text = Buffer.from(decodeURIComponent(text.slice(5)), 'base64').toString(
      'utf8',
    );
  }
  try {
    const parsed: unknown = JSON.parse(text);
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as { batch?: unknown[] }).batch ?? [parsed]);
    return list as Sent[];
  } catch {
    return [];
  }
}

async function capture(page: Page) {
  const requests: Request[] = [];
  await page.route(`${HOST}/**`, async (route) => {
    requests.push(route.request());
    const url = route.request().url();
    if (url.endsWith('.js'))
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    return route.fulfill({ contentType: 'application/json', body: '{}' });
  });
  const events = () =>
    requests
      .filter((r) => r.method() === 'POST')
      .flatMap((r) => decode(r))
      .filter((e) => e && typeof e.event === 'string');
  return { requests, events };
}

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
  expect(pv.properties.$current_url).toBe('http://127.0.0.1:4361/games');
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
    'http://127.0.0.1:4361/games?utm_source=tiktok',
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

test('secret-link pages never get analytics', async ({ page }) => {
  const { requests } = await capture(page);
  await page.goto('/claim/some-secret-token');
  await expect(page.locator('#duoly-analytics')).toHaveCount(0);
  await page.waitForTimeout(1000);
  expect(requests).toEqual([]);
});
