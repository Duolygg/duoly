import { test, expect, type Page } from '@playwright/test';

// Admin permissions per dashboard section (migration 20261105130000), against fictional API answers.

const defaults = [
  'overview',
  'live',
  'priority',
  'performance',
  'teammates',
  'users',
  'support',
  'safety',
  'audit',
  'settings',
];
const account = (id: string, name: string, role: string, extra = {}) => ({
  id,
  name,
  email: name.toLowerCase().replace(' ', '.') + '@example.test',
  image: '',
  country: 'at',
  provider: 'email',
  role,
  owner: false,
  you: false,
  roleBy: '',
  roleAt: '2026-11-01T10:00:00.000Z',
  firstSeen: '2026-10-01T10:00:00.000Z',
  lastSeen: '2026-11-04T10:00:00.000Z',
  discord: null,
  access: { games: [], gg: false, suspended: false, stream: [] },
  busy: false,
  ...extra,
});
const samId = '77777777-7777-4777-8777-777777777777';
const accounts = [
  account(samId, 'Sam Admin', 'admin', { permissions: defaults }),
  account('88888888-8888-4888-8888-888888888888', 'Cara Customer', 'customer'),
];

async function mock(page: Page, posts: Record<string, unknown>[]) {
  await page.route('**/api/**', async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/admin/users') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        posts.push(body);
        return r.fulfill({ json: { permissions: body.permissions } });
      }
      return r.fulfill({ json: { accounts } });
    }
    return r.fulfill({ json: {} });
  });
}
const nav = (page: Page) =>
  page.getByRole('navigation', { name: 'Admin sections' });

test('a restricted admin sees only their sections and cannot touch admins', async ({
  page,
}) => {
  await mock(page, []);
  await page.goto('/admin/users?access=restricted');
  await expect(page.getByText('Sam Admin').first()).toBeVisible({
    timeout: 15_000,
  });
  for (const name of ['Live desk', 'Priority', 'Users and roles', 'Audit log'])
    await expect(
      nav(page).getByRole('link', { name: new RegExp('^' + name) }),
    ).toBeVisible();
  for (const name of ['Orders', 'Payouts', 'Customers', 'Creators'])
    await expect(
      nav(page).getByRole('link', { name: new RegExp('^' + name) }),
    ).toHaveCount(0);

  const main = page.getByRole('main');
  // another admin: locked
  const samRoles = main.getByRole('radiogroup', { name: 'Role for Sam Admin' });
  await expect(
    samRoles.getByRole('radio', { name: 'Customer' }),
  ).toBeDisabled();
  // a customer: can become a teammate, never an admin
  const caraRoles = main.getByRole('radiogroup', {
    name: 'Role for Cara Customer',
  });
  await expect(
    caraRoles.getByRole('radio', { name: 'Teammate' }),
  ).toBeEnabled();
  await expect(caraRoles.getByRole('radio', { name: 'Admin' })).toBeDisabled();
  // no permission editor for non-owners
  await expect(
    main.getByRole('button', { name: 'Edit permissions' }),
  ).toHaveCount(0);
});

test('an owner changes what an admin can see', async ({ page }) => {
  const posts: Record<string, unknown>[] = [];
  await mock(page, posts);
  await page.goto('/admin/users?access=owner');
  const main = page.getByRole('main');
  await expect(main.getByText('Sam Admin').first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(nav(page).getByRole('link', { name: /^Payouts/ })).toBeVisible();
  const box = main.locator('[data-admin-permissions]');
  await expect(box).toContainText('10 of 14 sections');
  await box.getByRole('button', { name: 'Edit permissions' }).click();
  await box.getByRole('button', { name: 'Payouts' }).click();
  await box.getByRole('button', { name: 'Save permissions' }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toMatchObject({
    userId: samId,
    permissions: [...defaults, 'payouts'],
  });
  await expect(box).toContainText('11 of 14 sections');
});
