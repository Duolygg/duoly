import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('runs the completion browser suite in the full verification gate', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  expect(manifest.scripts['test:e2e']).toContain(
    'playwright test --config playwright.completion.config.ts',
  );
});
