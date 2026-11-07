import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('assistant coaching link selects existing controls without changing page layout', async ({
  page,
}, testInfo) => {
  await page.goto('/?game=lol&service=learn');
  await expect(page).toHaveURL('/');
  const role = page.getByRole('group', { name: 'Your role' });
  await expect(
    role.getByRole('button', { name: 'Fill', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const layout = async () =>
    page
      .locator('header, #modes-h, .dl-bar')
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          tag: node.tagName,
          width: Math.round(node.getBoundingClientRect().width),
          height: Math.round(node.getBoundingClientRect().height),
        })),
      );
  const baseline = await layout();
  const out = process.env.PREFILL_SCREENSHOTS;
  if (out) {
    await mkdir(out, { recursive: true });
    await page.screenshot({
      path: `${out}/${testInfo.project.name}-without-params.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.goto(
    '/?game=lol&service=learn&role=Jungle&character=Ahri&voice=false&mood=teach&region=EUW&qty=3&agent=claude',
  );
  await expect(page).toHaveURL('/?agent=claude');
  await expect(
    role.getByRole('button', { name: 'Jungle', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: /Champion/ })).toHaveValue(
    'Ahri',
  );
  await expect(
    page.getByRole('switch', { name: 'Voice on Discord' }),
  ).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('button', { name: /Teach me/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.dl-bar')).toContainText('3');
  expect(await layout()).toEqual(baseline);
  if (out)
    await page.screenshot({
      path: `${out}/${testInfo.project.name}-with-params.png`,
      fullPage: true,
      animations: 'disabled',
    });
  // Anonymous prefill never starts payment. Sign-in preserves the existing selections.
  await page.locator('.dl-bar-cta').dispatchEvent('click');
  const pending = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('duoly-pending-queue') || 'null'),
  );
  expect(pending).toMatchObject({
    game: 'lol',
    mode: 'learn',
    role: 'Jungle',
    character: 'Ahri',
    voice: false,
    mood: 'teach',
    qty: 3,
  });
});

test('team link selects the existing teammate count', async ({ page }) => {
  await page.goto('/?game=lol&service=ranked5&seats=2&role=Jungle&qty=1');
  await expect(page).toHaveURL('/');
  const group = page.getByRole('group', { name: /teammates/i });
  await expect(
    group.getByRole('button', { name: '2', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
