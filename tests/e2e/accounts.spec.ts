import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('retired email OTP endpoints have no routes, regardless of provider flags', async ({
  request,
}) => {
  for (const action of ['request', 'verify']) {
    const path = `/auth/email/${action}`;
    for (const method of ['GET', 'POST']) {
      const response = await request.fetch(path, { method, maxRedirects: 0 });
      expect(response.status(), `${method} ${path}`).toBe(404);
    }
    expect(
      existsSync(
        new URL(`../../src/pages/auth/email/${action}.ts`, import.meta.url),
      ),
    ).toBe(false);
  }
});

test('there is no sign-in page: /login sends visitors to the sign-in popup', async ({
  page,
}) => {
  await page.goto('/login?mode=register');
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(
    page.getByRole('heading', { name: 'Sign in to Duoly' }),
  ).toHaveCount(0);
});

test('untrusted POSTs cannot mutate account state', async ({ request }) => {
  for (const path of [
    '/auth/oauth',
    '/auth/password/login',
    '/auth/password/register',
    '/auth/logout',
    '/api/me/profile',
    '/api/me/currency',
  ]) {
    const response = await request.post(path, {
      headers: {
        Origin: 'https://attacker.invalid',
        'content-type': 'application/x-www-form-urlencoded',
      },
      data: 'csrf=invalid',
    });
    expect(response.status(), path).toBe(403);
  }
});

test('real account routes do not expose sample identities to anonymous visitors', async ({
  request,
}) => {
  for (const path of ['/dashboard', '/profile']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe('/?signin=1');
  }
  expect((await request.get('/api/me/profile')).status()).toBe(401);
});
