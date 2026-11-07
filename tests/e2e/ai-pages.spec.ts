import { expect, test } from '@playwright/test';
import { aiLaunchState, MCP } from '../../src/site/ai';
import { calculateQuote } from '../../src/server/pricing';

test('AI launch state, example price and progressive prompts', async ({
  page,
  request,
}) => {
  const launch = aiLaunchState();
  await page.goto('/ai');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://duoly.gg/ai',
  );
  expect(await page.locator('.ai-tools code').allTextContents()).toEqual(
    expect.arrayContaining(MCP.tools.map((tool) => tool.name)),
  );
  await expect(page.locator('.ai-tools li')).toHaveCount(7);
  await expect(page.locator('article')).toContainText('interactive cards');
  await expect(page.locator('article')).toContainText('private status code');
  await expect(page.locator('article')).toContainText(
    'It is not listed in the Claude directory or the ChatGPT store.',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    launch.indexing,
  );
  await expect(page.locator('.hero-copy .eyebrow')).toHaveText(launch.label);
  await expect(page.locator('.ai-assistant')).toHaveCount(5);
  await expect(page.locator('.ai-assistant ol')).toHaveCount(
    launch.showSetup ? 1 : 0,
  );
  await expect(page.locator('.ai-endpoint')).toHaveCount(
    launch.showSetup ? 1 : 0,
  );
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml.includes('https://duoly.gg/ai</loc>')).toBe(launch.showSetup);
  const quote = calculateQuote(
    { gameId: 'val', serviceId: 'vod', server: 'EU', units: 1 },
    { customerCurrency: 'EUR', eurToUsd: 1 },
  );
  await expect(page.locator('.ai-chat-price')).toHaveAttribute(
    'data-price-minor',
    String(quote.customer.amountMinor),
  );
  await expect(page.locator('.ai-chat .btn-sm')).toHaveAttribute(
    'href',
    '/?game=val&service=vod#modes-h',
  );
  await expect(page.locator('.ai-prompts li:visible')).toHaveCount(3);
  await page.getByText('More prompts', { exact: true }).click();
  await expect(page.locator('.ai-prompts li:visible')).toHaveCount(6);
  const text = await page.locator('article').innerText();
  expect(text).not.toMatch(/[—–&]|not [^.]*, but/i);
  expect(text).not.toMatch(
    /Streamable HTTP|v1|per IP|authentication|eligibility is reviewed/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (page.viewportSize()!.width < 700) {
    // Status rows stack name, detail and badge; every badge stays on screen.
    const badges = await page
      .locator('.ai-assistant .ai-badge')
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth && r.height > 0;
        }),
      );
    expect(badges).toEqual([true, true, true, true, true]);
  }
});

test('developer guide explains distinct protocol flows and limits', async ({
  page,
}) => {
  await page.goto('/developers/mcp');
  // Astro's development toolbar adds headings in shadow roots on CI.
  // Production-wide heading counts are also checked by seo-verify.
  await expect(page.locator('article.seo-page h1')).toHaveCount(1);
  await expect(
    page.getByText('server/discover', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.ai-table tbody tr')).toHaveCount(7);
  await expect(
    page.locator('.ai-table tbody tr').filter({ hasText: 'find_session' }),
  ).toContainText('missingInputs');
  const text = await page.locator('article').evaluate((article) => {
    const prose = article.cloneNode(true) as HTMLElement;
    prose.querySelectorAll('pre, code').forEach((node) => node.remove());
    return prose.innerText || prose.textContent || '';
  });
  expect(text).toContain('16,384');
  expect(text).toContain('65,536');
  expect(text).toContain('preserves supplied rank, region and quantity');
  expect(text).toContain('without JSON duplicated into text');
  expect(text).toContain('Card-only data stays in result metadata');
  expect(text).toContain('exact totals include bundle savings');
  expect(text).not.toMatch(/[—–&]|not [^.]*, but/i);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
