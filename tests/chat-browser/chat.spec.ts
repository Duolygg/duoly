import { expect, test } from '@playwright/test';
import { mockChat, state } from './fixtures';

test('native composer supports Unicode emojis, multiline text and escaped delivery', async ({
  page,
}) => {
  const session = state();
  await mockChat(page, session);
  await page.goto('/?mode=chat');
  const input = page.getByRole('textbox', { name: 'Message your teammate' });
  await expect(input).toBeVisible();
  await page.getByRole('button', { name: 'Choose emoji', exact: true }).click();
  await page.getByRole('button', { name: 'Wave', exact: true }).click();
  await expect(input).toHaveValue('👋');
  await expect(page.getByText('1 / 500', { exact: true })).toBeVisible();
  await input.fill('Hello <script>safe</script> 🎮');
  await input.press('Shift+Enter');
  await input.press('x');
  await expect(input).toHaveValue('Hello <script>safe</script> 🎮\nx');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(
    page
      .locator('.oc-bubble')
      .filter({ hasText: 'Hello <script>safe</script> 🎮' }),
  ).toHaveCount(1);
  expect(session.attempts).toHaveLength(1);
  expect(await page.locator('.order-chat script').count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('moderation keeps the draft private and uncertain retries reuse the same request', async ({
  page,
}) => {
  const session = state();
  await mockChat(page, session);
  await page.goto('/?mode=chat');
  const input = page.getByRole('textbox', { name: 'Message your teammate' });
  await input.fill('Pay me on paypal');
  await input.press('Enter');
  await expect(page.getByText(/Not sent: keep payments/)).toBeVisible();
  await expect(input).toHaveValue('Pay me on paypal');
  expect(session.messages.some((m) => m.body.includes('paypal'))).toBe(false);
  session.uncertain = true;
  await input.fill('Ready for game two');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  await page.getByRole('button', { name: /retry/i }).click();
  await expect(input).toHaveValue('');
  expect(session.attempts).toHaveLength(3);
  expect(session.attempts[1]).toEqual(session.attempts[2]);
  expect(
    session.messages.filter((m) => m.body === 'Ready for game two'),
  ).toHaveLength(1);
});
test('two isolated browser contexts read the same fictional conversation and clear revoked access', async ({
  browser,
}) => {
  const session = state();
  const customer = await browser.newContext(),
    teammate = await browser.newContext();
  try {
    const a = await customer.newPage(),
      b = await teammate.newPage();
    await mockChat(a, session);
    await mockChat(b, session, 'teammate');
    await a.goto('/?mode=chat');
    await b.goto('/?mode=chat&view=teammate');
    await expect(
      b.getByRole('textbox', { name: 'Message your customer' }),
    ).toBeVisible();
    await a.getByRole('textbox').fill('Hello from Alex');
    await a.getByRole('textbox').press('Enter');
    await expect(a.getByRole('textbox')).toHaveValue('');
    await b.bringToFront();
    await b.evaluate(() =>
      document.dispatchEvent(new Event('visibilitychange')),
    );
    await expect(
      b.locator('.oc-bubble').filter({ hasText: 'Hello from Alex' }),
    ).toHaveCount(1);
    session.denied = true;
    await b.evaluate(() =>
      document.dispatchEvent(new Event('visibilitychange')),
    );
    await expect(
      b.getByText('This conversation is no longer available.'),
    ).toBeVisible();
    await expect(b.getByRole('textbox')).toHaveCount(0);
    await expect(b.getByText('Hello from Alex', { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await customer.close();
    await teammate.close();
  }
});
test('thread stays anchored on resize and preserves deliberate history scrolling', async ({
  page,
}) => {
  const session = state();
  for (let i = 0; i < 25; i++)
    session.messages.push({
      id: crypto.randomUUID(),
      sequence: i + 3,
      kind: 'user',
      sender: 'teammate',
      name: 'Mina',
      image: '/assets/avatars/avatar-3.png',
      body: `Message ${i}: Let's coordinate the next game with a careful plan and play together.`,
      created_at: '2026-10-23T08:02:00Z',
      request_id: crypto.randomUUID(),
    });
  await mockChat(page, session);
  await page.goto('/?mode=chat');
  const thread = page.locator('.oc-transcript');
  await expect(page.getByRole('textbox')).toBeVisible();
  await expect
    .poll(() =>
      thread.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
    )
    .toBeLessThan(2);
  await page.setViewportSize({ width: 320, height: 700 });
  await expect
    .poll(() =>
      thread.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
    )
    .toBeLessThan(2);
  await thread.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  session.messages.push({
    ...session.messages.at(-1)!,
    id: crypto.randomUUID(),
    sequence: 28,
    body: 'New message while reading history',
    request_id: crypto.randomUUID(),
  });
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  );
  await expect(
    page.getByRole('button', { name: /new messages/i }),
  ).toBeVisible();
  expect(await thread.evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByRole('button', { name: /new messages/i }).click();
  await expect
    .poll(() =>
      thread.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
    )
    .toBeLessThan(2);
});
test('composer blocks over-limit code points and IME Enter does not send', async ({
  page,
}) => {
  const session = state();
  await mockChat(page, session);
  await page.goto('/?mode=chat');
  const input = page.getByRole('textbox', { name: 'Message your teammate' });
  await input.fill('🎮'.repeat(501));
  await expect(
    page.getByRole('button', { name: 'Send message', exact: true }),
  ).toBeDisabled();
  await input.fill('Composition in progress');
  await input.evaluate((el) =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
      }),
    ),
  );
  expect(session.attempts).toHaveLength(0);
  await expect(input).toHaveValue('Composition in progress');
});
