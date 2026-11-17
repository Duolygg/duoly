import { expect, test } from '@playwright/test';
import { CREATOR_TERMS_VERSION } from '../../src/content/creator-terms';

/**
 * The creator portal from the outside. This environment has no auth provider configured, so the
 * signed-in flow (apply, then the dashboard) cannot run here; what it can prove is the boundary:
 * the dashboard belongs to an account, the endpoints refuse anonymous and cross-origin callers,
 * and /creators publishes the terms a creator accepts.
 */

test('the creator dashboard belongs to an account', async ({ request }) => {
  const response = await request.get('/creators/dashboard', {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe('/?signin=1');
});

test('creator endpoints answer nobody without an account', async ({
  request,
}) => {
  for (const path of ['/api/creators/portal', '/api/creators/qr.png']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(401);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
});

test('creator mutations refuse an untrusted origin', async ({ request }) => {
  for (const path of [
    '/api/creators/apply',
    '/api/creators/code/available',
    '/api/creators/payout-details',
    '/api/admin/creator-applications',
  ]) {
    const response = await request.post(path, {
      headers: {
        Origin: 'https://attacker.invalid',
        'content-type': 'application/json',
      },
      data: { csrf: 'invalid', code: 'ALEX10' },
    });
    expect(response.status(), path).toBe(403);
  }
});

test('creator endpoints have no GET or stray method surface', async ({
  request,
}) => {
  for (const path of ['/api/creators/apply', '/api/creators/payout-details']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(405);
    expect(response.headers().allow).toBe('POST');
  }
  const portal = await request.post('/api/creators/portal', {
    headers: { Origin: 'http://127.0.0.1' },
    data: {},
  });
  expect(portal.status()).toBe(405);
});

test('/creators publishes the terms a creator accepts', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/creators');
  await expect(page).toHaveTitle('Creator program | Duoly');
  const terms = page.locator('#terms');
  await expect(terms).toBeVisible();
  await expect(terms).toContainText(`Version ${CREATOR_TERMS_VERSION}`);
  await expect(terms).toContainText('Hold, threshold and payout date');
  await expect(terms).toContainText('What is not allowed');
  // The program numbers stay on the page, from the one rules module.
  await expect(page.locator('#tiers')).toContainText('Rising');
  expect(errors).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
});
