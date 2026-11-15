import { test, expect, type Page } from '@playwright/test';

/*
 * The teammate profile pickers, driven on the fixture page (tests/fixtures/teammate-ui).
 *
 * The settings endpoint is answered here rather than reached, so a save and a reload can be
 * tested without an account: the route keeps whatever was posted and serves it back, which is
 * what proves a pick saved as an id comes back as a name.
 */
type Settings = {
  published: boolean;
  slug: string;
  featuredGame: string;
  featuredGames?: string[];
  vibeTags: string[];
  games: { game: string; roles: string[]; picks: string[] }[];
};
const RANKS: Record<string, { rank: string; peakRank: string | null }> = {
  val: { rank: 'Immortal 3', peakRank: 'Radiant' },
  lol: { rank: 'Master', peakRank: 'Grandmaster' },
  wow: { rank: 'Mythic+ 3,500+', peakRank: null },
};
/** The endpoint, as a box that remembers. Returns the posted settings on the next read. */
async function serveSettings(page: Page, games: string[]) {
  const store: { settings: Settings } = {
    settings: {
      published: true,
      slug: 'nyx',
      accent: 'lavender',
      banner: 'slash',
      featuredGame: games[0]!,
      vibeTags: [],
      showCountry: false,
      coaching: false,
      games: games.map((game) => ({
        game,
        roles: game === 'val' ? ['Controller'] : [],
        picks: game === 'val' ? ['omen'] : [],
      })),
    } as Settings,
  };
  const body = () => ({
    ...store,
    approvedGames: games,
    ranks: games
      .filter((game) => RANKS[game])
      .map((game) => ({ game, ...RANKS[game]!, verified: true })),
    hidden: false,
  });
  await page.route('**/api/teammate/public-profile', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const posted = request.postDataJSON() as Settings & { csrf?: string };
      delete posted.csrf;
      store.settings = posted;
    }
    await route.fulfill({ json: body() });
  });
  return store;
}
const open = async (page: Page, games: string[]) => {
  const store = await serveSettings(page, games);
  await page.goto(`/public-profile?load&games=${games.join(',')}`);
  await expect(page.locator('.pk-card').first()).toBeVisible();
  return store;
};
const card = (page: Page, game: string) =>
  page
    .locator('.pk-card')
    .filter({ has: page.locator(`[data-pk-card="${game}"]`) });
/* The filter row, so "Sentinel" means the filter rather than the seven agents that are one. */
const filters = (page: Page) => page.locator('.pk-sheet .pk-tabs');
/* The one button in the footer. By name it would also find Close without applying, which is
   the other half of the same sentence. */
const applyButton = (page: Page) =>
  page.locator('.pk-sheet .pk-sheet-foot .pk-button');
const expand = async (page: Page, game: string) => {
  const open = await card(page, game).getAttribute('data-open');
  if (open !== 'true') await page.locator(`[data-pk-card="${game}"]`).click();
  await expect(card(page, game)).toHaveAttribute('data-open', 'true');
};

test('a game card opens, takes roles and keeps the cap', async ({ page }) => {
  const store = await open(page, ['val']);
  /* One approved game opens itself: that card is the reason the teammate is here. */
  await expect(card(page, 'val')).toHaveAttribute('data-open', 'true');
  const roles = card(page, 'val').locator('.pk-block').first();
  await expect(roles.locator('.pk-count')).toHaveText('1 / 3');
  await roles.getByRole('button', { name: 'Duelist' }).click();
  await roles.getByRole('button', { name: 'Sentinel' }).click();
  await expect(roles.locator('.pk-count')).toHaveText('3 / 3');
  /* At the cap the unchosen roles stay on screen and stop taking a fourth. */
  await expect(roles.getByRole('button', { name: 'Initiator' })).toBeDisabled();
  await expect(roles.locator('.pk-hint')).toHaveText(
    'Remove one to add another.',
  );
  await roles.getByRole('button', { name: 'Duelist' }).click();
  await expect(roles.getByRole('button', { name: 'Initiator' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save public profile' }).click();
  await expect(page.locator('.pk-bar')).toHaveAttribute('data-state', 'saved');
  expect(store.settings.games[0]!.roles).toEqual(['Controller', 'Sentinel']);
  expect(store.settings.featuredGame).toBe('val');
  expect(store.settings.featuredGames).toEqual(['val']);
});

test('the picker searches, filters, fills to the cap, reorders and applies', async ({
  page,
  isMobile,
}) => {
  const store = await open(page, ['val']);
  await card(page, 'val').locator('[data-pk-open-picker="val"]').click();
  const sheet = page.locator('.pk-sheet');
  await expect(sheet).toBeVisible();
  const search = sheet.locator('.pk-search-input');
  /* Search takes focus on open, so the first keystroke is already a search. */
  await expect(search).toBeFocused();
  /* One counter, on the tray it counts, and Apply with nothing to apply yet. */
  await expect(sheet.locator('.pk-meter .pk-count')).toHaveText('1 / 5 picked');
  await expect(applyButton(page)).toBeDisabled();
  await expect(sheet.getByRole('button', { name: 'Cancel' })).toHaveCount(0);

  /* Punctuation and case are ignored: "kayo" is KAY/O and "brim" is Brimstone. */
  await search.fill('kayo');
  await expect(sheet.locator('.pk-tile')).toHaveCount(1);
  await expect(sheet.locator('.pk-tile-name')).toHaveText('KAY/O');
  await sheet.locator('.pk-tile').click();
  await search.fill('brim');
  await sheet.locator('.pk-tile').click();
  await expect(sheet.locator('.pk-meter .pk-count')).toHaveText('3 / 5 picked');

  /* A filter is a view of the list and never changes what is picked. */
  await search.fill('');
  await filters(page).getByRole('button', { name: 'Sentinel' }).click();
  const tiles = sheet.locator('.pk-tile');
  await expect(tiles.first()).toBeVisible();
  for (const name of await sheet.locator('.pk-tile-role').allInnerTexts())
    expect(name).toBe('Sentinel');
  await expect(sheet.locator('.pk-meter .pk-count')).toHaveText('3 / 5 picked');
  await sheet.locator('.pk-strip-item', { hasText: 'KAY/O' }).waitFor();

  /* To the cap, and then the rest of the list goes quiet instead of vanishing. */
  await filters(page).getByRole('button', { name: 'All' }).click();
  while (
    (await sheet.locator('.pk-meter .pk-count').innerText()) !== '5 / 5 picked'
  )
    await sheet
      .locator('.pk-tile:not([aria-pressed="true"]):not([disabled])')
      .first()
      .click();
  await expect(sheet.locator('.pk-meter .pk-cap')).toHaveText(
    'Remove one to add another.',
  );
  await expect(
    sheet.locator('.pk-tile:not([aria-pressed="true"])').first(),
  ).toBeDisabled();

  /* Apply is reachable without scrolling the sheet, on a phone too, and it counts what it
     would apply. */
  const apply = applyButton(page);
  await expect(apply).toHaveText('Apply · 5');
  await expect(apply).toBeInViewport();
  if (isMobile)
    expect((await sheet.boundingBox())!.height).toBeGreaterThan(600);

  /* The strip numbers what is picked and takes one off; the order itself is changed on the
     card, which is the one place that owns it. */
  await expect(sheet.locator('.pk-strip-item').first()).toContainText('1');
  await expect(sheet.locator('.pk-strip-item').nth(4)).toContainText('5');
  await expect(
    sheet
      .locator('.pk-strip-item')
      .first()
      .getByRole('button', { name: /^Move/ }),
  ).toHaveCount(0);

  await apply.click();
  await expect(sheet).toBeHidden();
  const picked = card(page, 'val').locator('.pk-picked-item');
  await expect(picked).toHaveCount(5);
  await expect(
    card(page, 'val').locator('.pk-block').nth(1).locator('.pk-count'),
  ).toHaveText('5 / 5');

  /* Reorder on the card, which numbers the picks and is what the profile shows them in. */
  const second = await picked.nth(1).locator('.pk-picked-name').innerText();
  await picked
    .nth(1)
    .getByRole('button', { name: /^Move .* earlier$/ })
    .click();
  await expect(picked.first().locator('.pk-picked-name')).toContainText(
    second.split('\n')[0]!,
  );
  await expect(
    picked.first().getByRole('button', { name: /^Move .* earlier$/ }),
  ).toBeDisabled();

  /* Save stores ids, and the reload reads names back out of them. */
  await page.getByRole('button', { name: 'Save public profile' }).click();
  await expect(page.locator('.pk-bar')).toHaveAttribute('data-state', 'saved');
  expect(store.settings.games[0]!.picks).toContain('kayo');
  expect(store.settings.games[0]!.picks).toContain('brimstone');
  expect(store.settings.games[0]!.picks).toHaveLength(5);
  await page.reload();
  await expand(page, 'val');
  await expect(
    card(page, 'val').locator('.pk-picked-name', { hasText: 'KAY/O' }),
  ).toBeVisible();
  await expect(
    card(page, 'val').locator('.pk-picked-name', { hasText: 'Brimstone' }),
  ).toBeVisible();
  await expect(card(page, 'val')).not.toContainText('kayo');
});

test('the picker is a keyboard list, and says so when nothing matches', async ({
  page,
}) => {
  await open(page, ['val']);
  await card(page, 'val').locator('[data-pk-open-picker="val"]').click();
  const sheet = page.locator('.pk-sheet');
  /* Arrow down hands the search field over to the grid, Enter picks, Escape leaves. */
  await page.keyboard.press('ArrowDown');
  const focused = sheet.locator('.pk-tile:focus');
  await expect(focused).toBeVisible();
  const name = await focused.locator('.pk-tile-name').innerText();
  await page.keyboard.press('Enter');
  await expect(
    sheet.locator('.pk-strip-item', { hasText: name }),
  ).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(sheet.locator('.pk-tile:focus .pk-tile-name')).not.toHaveText(
    name,
  );

  /* Typing anywhere in the sheet is a search. */
  await page.keyboard.type('zzz');
  await expect(sheet.locator('.pk-search-input')).toHaveValue('zzz');
  await expect(sheet.locator('.pk-empty')).toContainText('No match for');
  await expect(sheet.getByRole('button', { name: 'Tell us' })).toBeVisible();

  /* Escape closes without applying, and focus goes back to the button that opened it. */
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(
    card(page, 'val').locator('[data-pk-open-picker="val"]'),
  ).toBeFocused();
  await expect(card(page, 'val').locator('.pk-picked-item')).toHaveCount(1);
});

test('World of Warcraft asks for a class and a spec, filtered by role', async ({
  page,
}) => {
  await open(page, ['val', 'wow']);
  await expand(page, 'wow');
  const wow = card(page, 'wow');
  await expect(wow.locator('.pk-label').nth(1)).toContainText(
    'Classes and specs',
  );
  await wow.locator('[data-pk-open-picker="wow"]').click();
  const sheet = page.locator('.pk-sheet');
  await expect(sheet.locator('h3')).toHaveText('Classes and specs');
  await filters(page).getByRole('button', { name: 'Healer' }).click();
  for (const role of await sheet.locator('.pk-tile-role').allInnerTexts())
    expect(role).toBe('Healer');
  await sheet.locator('.pk-search-input').fill('aff lock');
  await expect(sheet.locator('.pk-empty')).toBeVisible();
  await filters(page).getByRole('button', { name: 'All' }).click();
  await expect(sheet.locator('.pk-tile-name')).toHaveText('Affliction Warlock');
});

test('a value the catalog cannot place keeps its place and can be removed', async ({
  page,
}) => {
  const store = await serveSettings(page, ['lol']);
  store.settings.games = [
    { game: 'lol', roles: ['Jungle'], picks: ['Hecarim', 'Some Old Pick'] },
  ];
  await page.goto('/public-profile?load&games=lol');
  await expand(page, 'lol');
  const lol = card(page, 'lol');
  /* A legacy display name reads as the catalog name; the unknown one keeps its text and says so
     rather than disappearing from a profile that has been fine for months. */
  await expect(
    lol.locator('.pk-picked-name', { hasText: 'Hecarim' }),
  ).toBeVisible();
  const unknown = lol.locator('.pk-picked-item', { hasText: 'Some Old Pick' });
  await expect(unknown).toContainText('Not in our list');
  await unknown.getByRole('button', { name: 'Remove Some Old Pick' }).click();
  await expect(lol.locator('.pk-picked-item')).toHaveCount(1);
  /* League has no filter tabs, because combat classes are not lanes. */
  await lol.locator('[data-pk-open-picker="lol"]').click();
  await expect(page.locator('.pk-tabs')).toHaveCount(0);
});

test('featured games toggle, reorder, persist and always keep one', async ({
  page,
}) => {
  const games = ['val', 'lol', 'wow', 'cs2', 'tft', 'mc', 'ow', 'fn'];
  const store = await open(page, games);
  await expect(page.locator('[data-pk-feature="val"]')).toBeDisabled();
  for (const game of games.slice(1)) {
    await page.locator(`[data-pk-feature="${game}"]`).click();
  }
  await expect(page.locator('[aria-pressed="true"].pk-star')).toHaveCount(8);
  await expect(
    page.getByRole('button', { name: 'Move Valorant up', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Move Fortnite down', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Move League of Legends up', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-pk-card]').first()).toHaveAttribute(
    'data-pk-card',
    'lol',
  );
  await page
    .getByRole('button', { name: 'Move League of Legends down', exact: true })
    .click();
  await expect(page.locator('[data-pk-card]').first()).toHaveAttribute(
    'data-pk-card',
    'val',
  );
  await page
    .getByRole('button', { name: 'Move League of Legends up', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save public profile' }).click();
  await expect(page.locator('.pk-bar')).toHaveAttribute('data-state', 'saved');
  expect(store.settings.featuredGame).toBe('lol');
  expect(store.settings.featuredGames).toEqual([
    'lol',
    'val',
    ...games.slice(2),
  ]);
  await page.reload();
  await expect(page.locator('[aria-pressed="true"].pk-star')).toHaveCount(8);
  await expect(page.locator('[data-pk-card]').first()).toHaveAttribute(
    'data-pk-card',
    'lol',
  );
  for (const game of games.filter((game) => game !== 'lol')) {
    await page.locator(`[data-pk-feature="${game}"]`).click();
  }
  await expect(page.locator('[data-pk-feature="lol"]')).toBeDisabled();
  await expect(page.locator('[aria-pressed="true"].pk-star')).toHaveCount(1);
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.locator('[aria-pressed="true"].pk-star')).toHaveCount(8);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('a closed card still says what is on it, and the bar says what is unsaved', async ({
  page,
}) => {
  await open(page, ['val', 'lol']);
  /* With more than one game everything starts closed and the summary lines do the talking. */
  await expect(card(page, 'val')).toHaveAttribute('data-open', 'false');
  await expect(card(page, 'val').locator('.pk-card-summary')).toHaveText(
    'Controller · Omen',
  );
  await expect(card(page, 'lol').locator('.pk-card-summary')).toHaveText(
    'Add roles and mains',
  );
  await expect(page.locator('.pk-bar')).toHaveAttribute('data-state', 'clean');
  await expect(
    page.getByRole('button', { name: 'Save public profile' }),
  ).toBeDisabled();
  await expand(page, 'lol');
  await card(page, 'lol').getByRole('button', { name: 'Jungle' }).click();
  await expect(page.locator('.pk-bar')).toHaveAttribute('data-state', 'dirty');
  await expect(page.locator('.pk-bar')).toContainText('Unsaved changes');
  /* Discard puts the form back to what is published. */
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.locator('.pk-bar')).toHaveAttribute('data-state', 'clean');
  await expect(card(page, 'lol').locator('.pk-card-summary')).toHaveText(
    'Add roles and mains',
  );
});

test('Add a game opens the support chat with the message already written', async ({
  page,
}) => {
  await open(page, ['val']);
  const ask = page.locator('.pk-ask');
  await expect(ask).toContainText(
    'The team approves the games on your profile',
  );
  /* Never prefilled: Ask support is dead until a game is chosen, so nobody asks for the game
     that happened to be first in the list. */
  await expect(ask.locator('select')).toHaveValue('');
  await expect(ask.locator('[data-pk-ask-game]')).toBeDisabled();
  await ask.locator('select').selectOption('dota');
  await ask.locator('[data-pk-ask-game]').click();
  const input = page.locator('#dl-support-input');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("I'd like to add Dota 2 to my profile.");
  await expect(ask).toContainText('Sent. They will reply in the chat.');
});
