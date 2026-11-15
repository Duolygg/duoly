import { test, expect, type Page } from '@playwright/test';

/*
 * The spoken languages picker, on the profile screen it lives on
 * (tests/fixtures/teammate-ui/src/pages/profile.astro). Nothing here saves: the field keeps its
 * own Save in the form around it, so these are the picker's own rules.
 */
const field = (page: Page) => page.locator('.pk-langs');
/* The one button in the footer. By name it would also find Close without applying. */
const applyButton = (page: Page) =>
  page.locator('.pk-sheet .pk-sheet-foot .pk-button');
const openSheet = async (page: Page) => {
  await field(page).locator('[data-pk-add-language]').click();
  const sheet = page.locator('.pk-sheet');
  await expect(sheet).toBeVisible();
  return sheet;
};

test.beforeEach(async ({ page }) => {
  await page.goto('/profile');
  await expect(field(page)).toBeVisible();
});

test('searches by English name, by the language itself and by code', async ({
  page,
}) => {
  const sheet = await openSheet(page);
  await expect(sheet.locator('.pk-search-input')).toBeFocused();
  /* Suggested leads, then every language A to Z. */
  await expect(sheet.locator('.pk-lang-group').first()).toHaveText('Suggested');
  await expect(sheet.locator('.pk-lang-group').nth(1)).toHaveText(
    'All languages',
  );
  await expect(
    sheet.locator('.pk-lang-list').first().locator('.pk-lang'),
  ).toHaveCount(6);
  for (const query of ['german', 'Deutsch', 'de']) {
    await sheet.locator('.pk-search-input').fill(query);
    await expect(sheet.locator('.pk-lang-name').first()).toContainText(
      'German',
    );
  }
  /* Accents are folded, so the endonym answers to plain letters. */
  await sheet.locator('.pk-search-input').fill('turkce');
  await expect(sheet.locator('.pk-lang-name')).toHaveCount(1);
  await expect(sheet.locator('.pk-lang-name')).toContainText('Turkish');
  await sheet.locator('.pk-search-input').fill('zzz');
  await expect(sheet.locator('.pk-empty')).toContainText('No match for');
  /* Never a flag: a flag names a country and a language is not one. */
  expect(await sheet.locator('img').count()).toBe(0);
});

test('adds a language, moves one to the front and removes one', async ({
  page,
}) => {
  await expect(field(page).locator('.pk-pill')).toHaveCount(1);
  await expect(field(page).locator('.pk-pill').first()).toContainText(
    'Shown first',
  );
  const sheet = await openSheet(page);
  await sheet.locator('.pk-search-input').fill('polish');
  await sheet.locator('.pk-lang').first().click();
  await expect(sheet.locator('.pk-meter .pk-count')).toHaveText('2 / 6 chosen');
  await applyButton(page).click();
  await expect(sheet).toBeHidden();
  const pills = field(page).locator('.pk-pill');
  await expect(pills).toHaveCount(2);
  await expect(pills.nth(0)).toContainText('English');
  await expect(pills.nth(1)).toContainText('Polish');

  /* The card in the directory shows the first three, which is what "Show first" means. */
  await pills.nth(1).getByRole('button', { name: 'Show first' }).click();
  await expect(field(page).locator('.pk-pill').nth(0)).toContainText('Polish');
  await expect(field(page).locator('.pk-pill').nth(0)).toContainText(
    'Shown first',
  );
  expect(await field(page).locator('.pk-pill-note').count()).toBe(1);

  await field(page)
    .locator('.pk-pill', { hasText: 'English' })
    .getByRole('button', { name: 'Remove English' })
    .click();
  await expect(field(page).locator('.pk-pill')).toHaveCount(1);
  await expect(field(page).locator('.pk-pill').first()).toContainText('Polish');
});

test('cancels without changing the field, and stops at six', async ({
  page,
}) => {
  let sheet = await openSheet(page);
  /* There is no Cancel: the close mark and Escape are the way out, and Apply is dead until
     something has changed. */
  await expect(applyButton(page)).toBeDisabled();
  await sheet.locator('.pk-search-input').fill('french');
  await sheet.locator('.pk-lang').first().click();
  await sheet.getByRole('button', { name: 'Close without applying' }).click();
  await expect(field(page).locator('.pk-pill')).toHaveCount(1);

  sheet = await openSheet(page);
  await applyButton(page).waitFor();
  for (const language of ['German', 'French', 'Dutch', 'Polish', 'Spanish']) {
    await sheet.locator('.pk-search-input').fill(language);
    await sheet.locator('.pk-lang').first().click();
  }
  await expect(sheet.locator('.pk-meter .pk-count')).toHaveText('6 / 6 chosen');
  await expect(sheet.locator('.pk-meter .pk-cap')).toHaveText(
    'Remove one to add another.',
  );
  /* At the cap the rest of the list stays readable and stops taking a seventh. */
  await sheet.locator('.pk-search-input').fill('italian');
  await expect(sheet.locator('.pk-lang').first()).toBeDisabled();
  await applyButton(page).click();
  await expect(field(page).locator('.pk-pill')).toHaveCount(6);
  await expect(field(page).locator('.pk-hint')).toHaveText(
    'That is all six. Remove one to add another.',
  );
});
