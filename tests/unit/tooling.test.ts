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

/**
 * `astro dev` detaches itself when an AI coding agent started the run (Astro
 * 7.4.5, `wantsBackground`), and Playwright ends a run whose web server process
 * exits before the URL answers. Every suite therefore starts its own server
 * through scripts/dev-server.mjs, which is the server rather than a launcher.
 */
it('starts every Playwright web server in the foreground', () => {
  const configs = [
    'playwright.config.ts',
    'playwright.chat.config.ts',
    'playwright.completion.config.ts',
    'playwright.teammate.config.ts',
    'playwright.analytics.config.ts',
  ];
  const commands = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ).scripts['test:e2e'];
  for (const config of configs) {
    const source = readFileSync(
      new URL(`../../${config}`, import.meta.url),
      'utf8',
    );
    const command = source.match(/command:\s*\n?\s*[`'"]([^`'"]+)/)?.[1];
    expect(command, `${config} declares a webServer command`).toBeDefined();
    expect(command, `${config} runs the foreground dev server`).toContain(
      'node scripts/dev-server.mjs',
    );
    expect(command, `${config} does not run the detaching CLI`).not.toContain(
      'astro.mjs dev',
    );
    // pnpm test:e2e has to run this config, or the suite starts no server at all.
    if (config !== 'playwright.config.ts')
      expect(commands, `test:e2e runs ${config}`).toContain(config);
  }
  expect(commands).toContain('playwright test &&');
});
