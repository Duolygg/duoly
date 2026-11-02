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

test('account login is a real route, explicitly unavailable until providers are configured', async ({
  page,
}) => {
  const response = await page.goto('/login');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Sign in to Duoly' }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Preview pages' }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Account sign-in is not configured yet.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Google', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Continue with Discord', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Sign in with email', exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'minlength',
    '8',
  );
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
  await page
    .getByRole('link', { name: 'Create an account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Create your Duoly account' }),
  ).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'autocomplete',
    'new-password',
  );
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
