import { afterEach, expect, it, vi } from 'vitest';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { processSourcemaps } from '../../scripts/posthog-sourcemaps.mjs';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'duoly-sourcemaps-'));
  roots.push(root);
  const assets = join(root, 'static/_astro');
  await mkdir(assets, { recursive: true });
  await writeFile(join(assets, 'app.js'), 'console.log("app");');
  await writeFile(join(assets, 'app.js.map'), '{}');
  return { root, assets };
}

it('skips upload without credentials and removes hidden public maps', async () => {
  const { root, assets } = await fixture();
  const run = vi.fn();
  await expect(
    processSourcemaps({ outputDir: root, env: {}, run, log: vi.fn() }),
  ).resolves.toBeUndefined();
  expect(run).not.toHaveBeenCalled();
  expect(await readdir(assets)).toEqual(['app.js']);
});

const production = {
  VERCEL_ENV: 'production',
  VERCEL_GIT_COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567',
  POSTHOG_CLI_API_KEY: 'secret-not-for-logs',
  POSTHOG_CLI_PROJECT_ID: '329587',
};

it('injects final output then uploads to EU with the browser short commit version', async () => {
  const { root, assets } = await fixture();
  const run = vi.fn();
  const log = vi.fn();
  await processSourcemaps({ outputDir: root, env: production, run, log });
  expect(run).toHaveBeenCalledTimes(2);
  for (const [index, action] of ['inject', 'upload'].entries()) {
    const [args, env] = run.mock.calls[index]!;
    expect(args).toEqual([
      '--host',
      'https://eu.posthog.com',
      'sourcemap',
      action,
      '--directory',
      root,
      '--exclude',
      '**/_functions/**',
      '--release-name',
      'duoly',
      '--release-version',
      '0123456789ab',
      '--release-mode',
      'event',
      ...(action === 'upload' ? ['--delete-after'] : []),
    ]);
    expect(env.POSTHOG_CLI_API_KEY).toBe(production.POSTHOG_CLI_API_KEY);
  }
  expect(await readdir(assets)).toEqual(['app.js']);
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    production.POSTHOG_CLI_API_KEY,
  );
});

it.each(['inject', 'upload'])(
  'warns on %s failure, resolves and deletes every output map',
  async (action) => {
    const { root, assets } = await fixture();
    const functions = join(root, 'functions/_render.func');
    await mkdir(functions, { recursive: true });
    await writeFile(join(functions, 'entry.mjs.map'), '{}');
    const warn = vi.fn();
    const run = vi.fn(async (args: string[]) => {
      if (args[3] === action) throw new Error(production.POSTHOG_CLI_API_KEY);
    });
    await expect(
      processSourcemaps({
        outputDir: root,
        env: production,
        run,
        warn,
        log: vi.fn(),
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      production.POSTHOG_CLI_API_KEY,
    );
    expect(await readdir(assets)).toEqual(['app.js']);
    expect(await readdir(functions)).toEqual([]);
  },
);

it.each([
  { ...production, VERCEL_ENV: 'preview' },
  { ...production, POSTHOG_CLI_API_KEY: '' },
  { ...production, POSTHOG_CLI_PROJECT_ID: '' },
  { ...production, VERCEL_GIT_COMMIT_SHA: '' },
])('skips incomplete or non-production configuration', async (env) => {
  const { root, assets } = await fixture();
  const run = vi.fn();
  await processSourcemaps({ outputDir: root, env, run, log: vi.fn() });
  expect(run).not.toHaveBeenCalled();
  expect(await readdir(assets)).toEqual(['app.js']);
});

it('copies adapter-omitted server maps only beside byte-identical final bundles before injection', async () => {
  const { root } = await fixture();
  const source = join(root, '_functions/chunks');
  const target = join(root, 'functions/_render.func/dist/server/chunks');
  await mkdir(source, { recursive: true });
  await mkdir(target, { recursive: true });
  for (const name of ['same', 'changed']) {
    await writeFile(join(source, `${name}.mjs`), 'original');
    await writeFile(join(source, `${name}.mjs.map`), '{}');
    await writeFile(
      join(target, `${name}.mjs`),
      name === 'same' ? 'original' : 'rebundled',
    );
  }
  const run = vi.fn(async () => {
    expect(await readFile(join(target, 'same.mjs.map'), 'utf8')).toBe('{}');
    expect(await readdir(target)).not.toContain('changed.mjs.map');
  });
  await processSourcemaps({
    outputDir: root,
    env: production,
    run,
    log: vi.fn(),
  });
  expect(run).toHaveBeenCalledTimes(2);
  expect(await readdir(target)).toEqual(['changed.mjs', 'same.mjs']);
});

it('allows a build with no output directory', async () => {
  const { root } = await fixture();
  await expect(
    processSourcemaps({
      outputDir: join(root, 'absent'),
      env: {},
      log: vi.fn(),
    }),
  ).resolves.toBeUndefined();
});
