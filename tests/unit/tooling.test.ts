import { ESLint } from 'eslint';
import { builtinModules } from 'node:module';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('rejects server-only imports from browser-safe directories', async () => {
  const eslint = new ESLint();
  for (const module of [
    ...builtinModules.filter((name) => !name.startsWith('_')),
    'fs/promises',
    '../server/secrets',
    '../auth.server',
  ]) {
    const [result] = await eslint.lintText(`import '${module}';`, {
      filePath: 'src/client/probe.ts',
    });
    expect(
      result?.messages.some(
        (message) => message.ruleId === 'no-restricted-imports',
      ),
    ).toBe(true);
  }
  expect(builtinModules.length).toBeGreaterThan(0);
});

it('rejects unchecked dynamic imports in browser-safe modules', async () => {
  const eslint = new ESLint();
  const [result] = await eslint.lintText("import('../server/secrets');", {
    filePath: 'src/client/probe.ts',
  });
  expect(
    result?.messages.some(
      (message) => message.ruleId === 'no-restricted-syntax',
    ),
  ).toBe(true);
});

it('deploys main to production automatically (no Git deployment gate)', () => {
  const config = JSON.parse(
    readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
  );
  expect(config.git?.deploymentEnabled).toBeUndefined();
});

it('configures static Vercel security headers to match SSR policy', () => {
  const config = JSON.parse(
    readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
  );
  expect(config.headers[0].source).toBe('/(.*)');
  expect(config.headers[0].headers).toContainEqual({
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  });
  expect(config.headers[0].headers).toContainEqual({
    key: 'X-Frame-Options',
    value: 'DENY',
  });
});
