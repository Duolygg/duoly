import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
it('renders the original teammate under the bare site shell with a fresh teammate-only session', () => {
  const page = readFileSync('src/pages/teammate.astro', 'utf8');
  expect(page).toContain('SiteLayout');
  expect(page).toContain('bare');
  expect(page).toContain('<LiveTeammate');
  expect(page).not.toContain('OrderDesk');
  expect(page).toContain("identity.viewer.role !== 'teammate'");
  expect(page).toContain('discordLinked={!!identity.discord}');
});
it('includes the original teammate browser suite in full verification', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  expect(manifest.scripts['test:e2e']).toContain(
    'playwright test --config playwright.teammate.config.ts',
  );
});
