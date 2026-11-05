import { expect, test } from '@playwright/test';
import { capture, hideAutomation } from './helpers';

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => hideAutomation(page));

test('real replay includes public copy but never fabricated quotes or teammate names', async ({
  page,
}) => {
  const { requests, events } = await capture(page, true);
  // A deterministic teammate enters through real Astro island props, never a database.
  await page.route('**/', async (route) => {
    if (new URL(route.request().url()).pathname !== '/')
      return route.continue();
    const response = await route.fetch();
    const html = await response.text();
    const teammate = [
      0,
      {
        name: [0, 'CANARY-TEAMMATE-7781'],
        image: [0, '/assets/avatars/avatar-1.png'],
        games: [1, [[0, 'valorant']]],
        gg: [0, false],
        online: [0, true],
        rating: [0, 5],
        reviews: [0, 1],
        sessions: [0, 1],
      },
    ];
    expect(html).toContain('&quot;teammates&quot;:[1,[]]');
    const encoded = JSON.stringify([1, [teammate]]).replaceAll('"', '&quot;');
    await route.fulfill({
      response,
      body: html.replace(
        '&quot;teammates&quot;:[1,[]]',
        '&quot;teammates&quot;:' + encoded,
      ),
    });
  });
  await page.goto('/');
  await expect(page.locator('.tc-who').first()).toContainText(
    'CANARY-TEAMMATE-7781',
  );
  // The hero logo area shows hero quotes only when four or more real ones
  // arrive; it must never fall back to fabricated samples.
  const quoteCount = await page.locator('.hq blockquote').count();
  const publicCopy = await page
    .getByText('Not matched? You get your money back.', { exact: true })
    .first()
    .innerText();
  await page.evaluate(() => {
    const masked = document.createElement('div');
    masked.dataset.private = '';
    masked.textContent = 'CANARY-MASKED-7781';
    document.body.append(masked);
  });
  await page.locator('[data-consent="all"]').press('Enter');
  await expect
    .poll(() => events().filter((e) => e.event === '$snapshot').length, {
      timeout: 25000,
    })
    .toBeGreaterThan(0);
  await expect
    .poll(
      () =>
        JSON.stringify(
          events().filter((e) => e.event === '$snapshot'),
        ).includes(publicCopy.split('\n')[0]!.trim()),
      { timeout: 25000 },
    )
    .toBe(true);
  await page.waitForTimeout(3000);
  const snapshots = JSON.stringify(
    events().filter((e) => e.event === '$snapshot'),
  );
  expect(
    requests.some(
      (r) => new URL(r.url()).pathname === '/s/' && r.method() === 'POST',
    ),
  ).toBe(true);
  expect(snapshots).toContain(publicCopy.split('\n')[0]!.trim());
  expect(snapshots).not.toContain('CANARY-TEAMMATE-7781');
  expect(snapshots).not.toContain('CANARY-MASKED-7781');
  // No fabricated hero quotes may appear in the DOM or in the replay.
  expect(quoteCount).toBe(0);
});

test('real replay never sends contact form input', async ({ page }) => {
  const { events } = await capture(page, true);
  // Preview has support disabled. Open the real form via its existing island prop,
  // without configuring or contacting Supabase or submitting any data.
  await page.route('**/contact', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    expect(html).toContain('&quot;closed&quot;:[0,true]');
    await route.fulfill({
      response,
      body: html.replace(
        '&quot;closed&quot;:[0,true]',
        '&quot;closed&quot;:[0,false]',
      ),
    });
  });
  await page.goto('/contact');
  await page.locator('[data-consent="all"]').press('Enter');
  await expect
    .poll(() => events().filter((e) => e.event === '$snapshot').length, {
      timeout: 25000,
    })
    .toBeGreaterThan(0);
  const before = events().filter((e) => e.event === '$snapshot').length;
  await page
    .locator('.ct-form-card input[autocomplete="name"]')
    .first()
    .fill('CANARY-7781');
  await page.locator('.ct-form-card textarea').fill('CANARY-7781');
  await page.mouse.move(100, 100);
  await expect
    .poll(() => events().filter((e) => e.event === '$snapshot').length, {
      timeout: 25000,
    })
    .toBeGreaterThan(before);
  expect(
    JSON.stringify(events().filter((e) => e.event === '$snapshot')),
  ).not.toContain('CANARY-7781');
  await expect(page.locator('.ct-form-card')).toHaveAttribute(
    'data-private-block',
    '',
  );
});
