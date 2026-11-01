import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

for (const [button, value, analytics, referral] of [
  ['Only necessary', 'v2.a0.m0.r0', false, false],
  ['Accept all', 'v2.a1.m1.r1', true, true],
] as const) {
  test(`${button} saves and publishes consent`, async ({ page, context }) => {
    await page.goto('/rules');
    const banner = page.getByRole('dialog', { name: 'Cookie settings' });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button')).toHaveCount(3);
    await page.evaluate(() => {
      window.addEventListener('duoly:consent', (event) => {
        (window as unknown as Record<string, unknown>).consentEvent = (
          event as CustomEvent
        ).detail;
      });
    });
    await banner
      .getByRole('button', { name: button, exact: true })
      .press('Enter');
    await expect(banner).toBeHidden();
    expect(
      (await context.cookies()).find((c) => c.name === 'duoly-consent')?.value,
    ).toBe(value);
    const state = { version: 2, analytics, marketing: analytics, referral };
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).consentEvent,
      ),
    ).toEqual(state);
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).__duolyConsent,
      ),
    ).toEqual(state);
    await page.reload();
    await expect(banner).toBeHidden();
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).__duolyConsent,
      ),
    ).toEqual(state);
    await page
      .getByRole('link', { name: 'Cookie settings', exact: true })
      .press('Enter');
    await expect(banner).toBeVisible();
    await expect(banner.getByLabel('Analytics', { exact: true })).toBeChecked({
      checked: analytics,
    });
    await expect(banner.getByLabel('Marketing', { exact: true })).toBeChecked({
      checked: analytics,
    });
    await expect(
      banner.getByLabel('Creator link', { exact: true }),
    ).toBeChecked({ checked: referral });
  });
}

test('customise saves analytics independently and fits a 390px screen', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/rules');
  const banner = page.getByRole('dialog', { name: 'Cookie settings' });
  await banner
    .getByRole('button', { name: 'Customise', exact: true })
    .press('Enter');
  await banner.getByLabel('Analytics', { exact: true }).press('Space');
  await expect(
    banner.getByLabel('Creator link', { exact: true }),
  ).not.toBeChecked();
  await expect(
    banner.getByLabel('Marketing', { exact: true }),
  ).not.toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await banner.getByRole('button', { name: 'Save choices' }).press('Enter');
  expect(
    (await context.cookies()).find((c) => c.name === 'duoly-consent')?.value,
  ).toBe('v2.a1.m0.r0');
  await page.reload();
  await expect(banner).toBeHidden();
  await page
    .getByRole('link', { name: 'Cookie settings', exact: true })
    .press('Enter');
  await expect(banner.getByLabel('Analytics', { exact: true })).toBeChecked();
  await expect(
    banner.getByLabel('Creator link', { exact: true }),
  ).not.toBeChecked();
  await expect(
    banner.getByLabel('Marketing', { exact: true }),
  ).not.toBeChecked();
});

for (const category of ['Marketing', 'Creator link'] as const) {
  test(`customise allows ${category} on its own and can withdraw`, async ({
    page,
    context,
  }) => {
    await page.goto('/rules');
    const banner = page.getByRole('dialog', { name: 'Cookie settings' });
    await banner
      .getByRole('button', { name: 'Customise', exact: true })
      .press('Enter');
    await banner.getByLabel(category, { exact: true }).press('Space');
    await banner.getByRole('button', { name: 'Save choices' }).press('Enter');
    const expected = category === 'Marketing' ? 'v2.a0.m1.r0' : 'v2.a0.m0.r1';
    expect(
      (await context.cookies()).find((c) => c.name === 'duoly-consent')?.value,
    ).toBe(expected);
    await page
      .getByRole('link', { name: 'Cookie settings', exact: true })
      .press('Enter');
    await expect(banner.getByLabel(category, { exact: true })).toBeChecked();
    await banner.getByRole('button', { name: 'Only necessary' }).press('Enter');
    expect(
      (await context.cookies()).find((c) => c.name === 'duoly-consent')?.value,
    ).toBe('v2.a0.m0.r0');
  });
}

for (const analytics of [false, true]) {
  for (const marketing of [false, true]) {
    for (const referral of [false, true]) {
      const value = `v2.a${Number(analytics)}.m${Number(marketing)}.r${Number(referral)}`;
      test(`loads ${value} without prompting and prefills every category`, async ({
        page,
        context,
        baseURL,
      }) => {
        await context.addCookies([
          { name: 'duoly-consent', value, url: baseURL! },
        ]);
        await page.goto('/rules');
        const banner = page.getByRole('dialog', { name: 'Cookie settings' });
        await expect(banner).toBeHidden();
        expect(
          await page.evaluate(
            () => (window as unknown as Record<string, unknown>).__duolyConsent,
          ),
        ).toEqual({ version: 2, analytics, marketing, referral });
        await page.evaluate(() => {
          location.hash = '#cookie-settings';
        });
        await expect(banner).toBeVisible();
        for (const [label, checked] of [
          ['Analytics', analytics],
          ['Marketing', marketing],
          ['Creator link', referral],
        ] as const)
          await expect(banner.getByLabel(label, { exact: true })).toBeChecked({
            checked,
          });
      });
    }
  }
}

test('privacy keeps its cookies anchor and opens preferences from its copy', async ({
  page,
}) => {
  await page.goto('/privacy#cookies');
  await expect(page.locator('#cookies')).toContainText(
    'Cookies and local storage',
  );
  await expect(page.locator('#analytics')).toContainText(
    'PostHog EU Cloud, Frankfurt',
  );
  await expect(page.locator('#marketing')).toContainText(
    'Meta Platforms Ireland',
  );
  await page
    .getByRole('dialog', { name: 'Cookie settings' })
    .getByRole('button', { name: 'Only necessary' })
    .press('Enter');
  await page
    .locator('#cookies')
    .getByRole('link', { name: 'Cookie settings' })
    .press('Enter');
  await expect(
    page.getByRole('checkbox', { name: 'Marketing', exact: true }),
  ).toBeVisible();
});

for (const value of ['all', 'necessary', 'garbage', 'v2.a1.r1']) {
  test(`${value} prompts again without analytics permission`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'duoly-consent', value, url: baseURL! }]);
    await page.goto('/rules');
    const banner = page.getByRole('dialog', { name: 'Cookie settings' });
    await expect(banner).toBeVisible();
    await banner
      .getByRole('button', { name: 'Customise', exact: true })
      .press('Enter');
    await expect(
      banner.getByLabel('Analytics', { exact: true }),
    ).not.toBeChecked();
    await expect(
      banner.getByLabel('Creator link', { exact: true }),
    ).toBeChecked({ checked: value === 'all' });
  });
}
