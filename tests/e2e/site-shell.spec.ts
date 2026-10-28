import { expect, test, type Page } from '@playwright/test';

const settle = async (page: Page) => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await expect.poll(() => page.locator('astro-island[ssr]').count()).toBe(0);
};

const shellPages = [
  ['/apply', 'Become a teammate | Duoly'],
  ['/contact', 'Contact | Duoly'],
  ['/creators', 'Creator program | Duoly'],
  ['/rules', 'Rules | Duoly'],
  ['/terms', 'Terms | Duoly'],
  ['/privacy', 'Privacy | Duoly'],
  ['/imprint', 'Imprint | Duoly'],
  ['/games', 'Games | Duoly'],
  ['/games/valorant', 'Valorant teammates | Duoly'],
  ['/blog', 'Blog | Duoly'],
  ['/reset-password', 'Reset password | Duoly'],
  ['/login', ''],
] as const;

for (const [path, title] of shellPages) {
  test(`${path} renders in the site shell without overflow or errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    if (title) await expect(page).toHaveTitle(title);
    await expect(page.locator('header.site-header')).toBeVisible();
    await expect(page.locator('footer.site-footer')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await expect(page.getByText('Design preview', { exact: true })).toHaveCount(
      0,
    );
    await settle(page);
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      broken: [...document.querySelectorAll('img')]
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.getAttribute('src')),
    }));
    expect(metrics.broken).toEqual([]);
    expect(metrics.width).toBeLessThanOrEqual(metrics.viewport + 1);
    expect(errors).toEqual([]);
  });
}

test('homepage uses its design header and the shared footer links', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /Duo up in\s*under 2 minutes\./,
  );
  await expect(page.locator('header.site-header')).toHaveCount(0);
  await expect(page.getByText('Design preview', { exact: true })).toHaveCount(
    0,
  );
  for (const [name, href] of [
    ['Imprint', '/imprint'],
    ['Blog', '/blog'],
    ['Discord', 'https://discord.gg/xkKGf9bKz'],
  ] as const)
    await expect(
      page.locator('footer').getByRole('link', { name, exact: true }),
    ).toHaveAttribute('href', href);
  await settle(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('signed-out header offers sign in and the main sections', async ({
  page,
  isMobile,
}) => {
  await page.goto('/imprint');
  const header = page.locator('header.site-header');
  await expect(header.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/login',
  );
  if (isMobile) {
    await header.getByLabel('Menu').click();
    await expect(
      header
        .getByRole('navigation', { name: 'Mobile' })
        .getByRole('link', { name: 'Become a teammate' }),
    ).toBeVisible();
  } else {
    const nav = header.getByRole('navigation', { name: 'Main' });
    for (const name of ['Games', 'How it works', 'FAQ', 'Blog'])
      await expect(nav.getByRole('link', { name })).toBeVisible();
  }
});

test('imprint lists the operator details', async ({ page }) => {
  await page.goto('/imprint');
  for (const text of [
    'Fabian Nöbauer',
    'Jesuitenmühlstraße 10, 2320 Schwechat, Austria',
    '38381850',
    'District Authority of Bruck an der Leitha',
  ])
    await expect(page.getByText(text).first()).toBeVisible();
});

test('unfinished forms show an honest state and never post sample data', async ({
  page,
}) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') posts.push(request.url());
  });
  for (const [path, title] of [
    ['/apply', 'Applications open soon'],
    ['/contact', 'Talk to us'],
    ['/creators', 'Creator applications open soon'],
  ] as const) {
    await page.goto(path);
    await settle(page);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Join our Discord' }),
    ).toHaveAttribute('href', 'https://discord.gg/xkKGf9bKz');
  }
  expect(posts).toEqual([]);
});

test('removed preview routes and unknown pages are branded 404s', async ({
  page,
  request,
}) => {
  for (const path of [
    '/preview/dashboard',
    '/preview/admin',
    '/queue/preview-order',
    '/games/not-a-game',
    '/blog/not-an-article',
    '/missing',
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
  }
  await page.goto('/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'This lobby is empty.',
  );
  await expect(page.locator('header.site-header')).toBeVisible();
  // the short 404 block is centred with a minimum height, not floating above a void
  const box = await page.locator('section.page.centered').boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(300);
});

test('login page has no duplicate header sign in and spaced links', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(
    page.locator('header.site-header').getByRole('link', { name: 'Sign in' }),
  ).toHaveCount(0);
  const links = page.locator('.login-links');
  await expect(
    links.getByRole('link', { name: 'Create an account', exact: true }),
  ).toBeVisible();
  expect(await links.evaluate((el) => getComputedStyle(el).columnGap)).not.toBe(
    'normal',
  );
});

test('admin sections are invisible to signed-out visitors', async ({
  request,
}) => {
  for (const path of ['/admin', '/admin/orders', '/admin/applications'])
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(
      404,
    );
});

test('sitemap lists public pages and every game page', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  for (const path of ['/imprint', '/games', '/blog', '/games/valorant'])
    expect(xml).toContain(`${path}</loc>`);
  expect(xml).not.toContain('/admin');
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');
});

test('reset password asks for an email and confirms without revealing accounts', async ({
  page,
}) => {
  await page.goto('/reset-password');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.locator('main form')).toHaveAttribute(
    'action',
    '/auth/password/forgot',
  );
  await page.goto('/reset-password?sent=1');
  await expect(page.getByRole('status')).toContainText('reset link');
});

test('support bubble opens Sparky with prepared answers, never Discord or a preview', async ({
  page,
}) => {
  await page.route('**/api/support', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          json: {
            csrf: 'token',
            role: 'guest',
            chips: ['How does it work?'],
            greeting: 'Hey, I am Sparky.',
            team: [],
            conversation: null,
          },
        })
      : route.abort(),
  );
  await page.goto('/');
  await settle(page);
  const bubble = page
    .locator('button[aria-label*="chat" i], button[aria-label*="support" i]')
    .first();
  await bubble.click();
  const chat = page.getByRole('dialog', { name: 'Duoly support chat' });
  await expect(chat.getByText('Hey, I am Sparky.')).toBeVisible();
  await expect(
    chat.getByRole('button', { name: 'How does it work?' }),
  ).toBeVisible();
  await expect(chat.getByRole('link', { name: /discord/i })).toHaveCount(0);
  await expect(page.getByText(/design preview/i)).toHaveCount(0);
});
