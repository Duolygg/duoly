import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { mockChat, state, orderId } from './fixtures';
const token = 'dos_' + 'A'.repeat(43);
test('order AI panel issues only on action, copies, never persists, and revokes after reload', async ({
  page,
  context,
}, testInfo) => {
  await mockChat(page, state());
  let issued = 0,
    revoked = 0;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route(
    `**/api/orders/${orderId}/ai-status-token`,
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({ csrf: 'fixture-csrf' });
      const issue = route.request().method() === 'POST';
      if (issue) issued++;
      else revoked++;
      await route.fulfill({
        contentType: 'application/json',
        headers: { 'Cache-Control': 'no-store' },
        body: JSON.stringify(
          issue
            ? { token, expiresAt: '2026-11-14T10:00:00Z' }
            : { revoked: true },
        ),
      });
    },
  );
  await page.goto('/?mode=queue');
  const panel = page.locator('.order-ai-panel');
  await expect(panel).toBeVisible();
  expect(issued).toBe(0);
  await panel.getByRole('button', { name: 'Generate code' }).click();
  await expect(panel.locator('code')).toHaveText(
    `${token.slice(0, 13)}…${token.slice(-4)}`,
  );
  await panel.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `Check my Duoly order with code ${token}`,
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify([
        Object.entries(localStorage),
        Object.entries(sessionStorage),
      ]),
    ),
  ).not.toContain(token);
  expect(
    await panel.evaluate((el) =>
      Array.from(el.querySelectorAll('*'))
        .flatMap((e) => Array.from(e.attributes).map((a) => a.value))
        .join(' '),
    ),
  ).not.toContain(token.slice(0, 13));
  expect(page.url()).not.toContain(token);
  await expect(panel).toHaveAttribute('data-private-block', 'true');
  const out = `${homedir()}/.hermes/cache/scratch/mcp-cards/order`;
  await mkdir(out, { recursive: true });
  await panel.screenshot({
    path: `${out}/queue-panel-${testInfo.project.name}.png`,
  });
  await page.screenshot({
    path: `${out}/queue-page-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await panel.getByRole('button', { name: 'Revoke code' }).click();
  await expect(panel.locator('code')).toHaveCount(0);
  expect(revoked).toBe(1);
  await panel.getByRole('button', { name: 'Generate code' }).click();
  await expect(panel.locator('code')).toHaveText(
    `${token.slice(0, 13)}…${token.slice(-4)}`,
  );
  await page.reload();
  await expect(panel).toBeVisible();
  await expect(panel.locator('code')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Revoke code' }).click();
  expect(revoked).toBe(2);
});
