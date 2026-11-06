import { expect, test, type Page } from '@playwright/test';

// A signed-in render fixture, not a real session. No checkout request is submitted.
async function withCustomer(page: Page) {
  await page.route('http://127.0.0.1:4321/?**', async (route) => {
    const response = await route.fetch();
    const viewer = JSON.stringify([
      0,
      {
        id: [0, 'b9000000-0000-4000-8000-000000000001'],
        role: [0, 'customer'],
        name: [0, 'Booking link fixture'],
      },
    ]).replaceAll('"', '&quot;');
    const body = (await response.text()).replace(
      /<astro-island\b[^>]*component-url="[^"]*LiveHome[^>]*>/,
      (island) =>
        island.replace(
          '&quot;viewer&quot;:[0,null]',
          '&quot;viewer&quot;:' + viewer,
        ),
    );
    await route.fulfill({ response, body });
  });
}

// Consent is preset by playwright.config.ts. Dispatch avoids the sticky bar/header on phones.
test('booking link prefills rank and three-game bundle with the manual total', async ({
  page,
}) => {
  await withCustomer(page);
  await page.goto(
    '/?game=val&service=duo2&rank=Gold&region=NA&qty=3&agent=claude&keep=1#modes-h',
  );
  await expect(page).toHaveURL('/?agent=claude&keep=1#modes-h');
  await expect(page.locator('.dl-bar')).toContainText('Spike Plant · 3 games');
  await expect(page.locator('.dl-bar')).toContainText('from Gold');
  await expect(page.locator('[aria-labelledby="dl-rank-l"]')).toContainText(
    'Gold',
  );
  const linkedTotal = await page.locator('.dl-bar-total').innerText();
  // Server lives in the existing confirmation picker, not the sticky order bar.
  await page.locator('.dl-bar-cta').dispatchEvent('click');
  await expect(page.locator('[aria-labelledby="qc-server-l"]')).toContainText(
    'NA',
  );

  await page.goto('/?game=val&service=duo2');
  await expect(page).toHaveURL('/');
  await page.locator('[aria-labelledby="dl-rank-l"]').dispatchEvent('click');
  await page.getByRole('option', { name: /^Gold/ }).dispatchEvent('click');
  await page.getByRole('tab', { name: /Bundles/ }).dispatchEvent('click');
  await page
    .getByRole('button', { name: /Spike Plant/ })
    .dispatchEvent('click');
  await expect(page.locator('.dl-bar')).toContainText('Spike Plant · 3 games');
  await expect(page.locator('.dl-bar-total')).toHaveText(linkedTotal);
  await page.locator('.dl-bar-cta').dispatchEvent('click');
  await page.locator('[aria-labelledby="qc-server-l"]').dispatchEvent('click');
  await page
    .getByRole('radio', { name: /^NA North America$/ })
    .dispatchEvent('click');
  await expect(page.locator('[aria-labelledby="qc-server-l"]')).toContainText(
    'NA',
  );
});

test('invalid booking values preserve the service defaults and clear only booking params', async ({
  page,
}) => {
  await withCustomer(page);
  await page.addInitScript(() =>
    localStorage.setItem('duoly-server-val', 'KR'),
  );
  await page.goto('/?game=val&service=duo2');
  await expect(page).toHaveURL('/');
  const defaultTotal = await page.locator('.dl-bar-total').innerText();
  await page.goto(
    '/?game=val&service=duo2&rank=gold&region=eu&qty=2.5&agent=chatgpt',
  );
  await expect(page).toHaveURL('/?agent=chatgpt');
  await expect(page.locator('.dl-bar')).toContainText('Duo Pro · 1 game');
  await expect(page.locator('.dl-bar')).toContainText('from Platinum');
  await expect(page.locator('.dl-bar-total')).toHaveText(defaultTotal);
  await page.locator('.dl-bar-cta').dispatchEvent('click');
  await expect(page.locator('[aria-labelledby="qc-server-l"]')).toContainText(
    'KR',
  );
});

test('booking quantity clamps for games and coaching hours without changing the service', async ({
  page,
}) => {
  await page.goto('/?game=val&service=duo2&qty=999');
  await expect(page).toHaveURL('/');
  await expect(page.locator('.dl-bar')).toContainText('Ace · 10 games');
  await page.goto('/?game=val&service=vod&qty=999');
  await expect(page).toHaveURL('/');
  await expect(page.locator('.dl-bar')).toContainText('VOD Review · 10 hours');
});
