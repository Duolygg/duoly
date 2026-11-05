import { copyFile, readFile, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import console from 'node:console';
import { resolve, join } from 'node:path';

async function deleteMaps(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await deleteMaps(path);
    else if (entry.name.endsWith('.map')) await rm(path);
  }
}

// The Vercel adapter traces JS into the final function but omits hidden maps.
// Restore only maps whose original bundle survived tracing byte-for-byte.
async function prepareServerMaps(outputDir) {
  async function copyMatching(source, target) {
    let entries;
    try {
      entries = await readdir(source, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const from = join(source, entry.name);
      const to = join(target, entry.name);
      if (entry.isDirectory()) await copyMatching(from, to);
      else if (entry.name.endsWith('.map')) {
        try {
          const original = await readFile(from.slice(0, -4));
          const served = await readFile(to.slice(0, -4));
          if (original.equals(served)) await copyFile(from, to);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
    }
  }
  await copyMatching(
    join(outputDir, '_functions'),
    join(outputDir, 'functions/_render.func/dist/server'),
  );
}

export async function processSourcemaps({
  outputDir = resolve('.vercel/output'),
  env = process.env,
  run = async (args, commandEnv) => {
    // Invoke only the repository-pinned binary, not a global CLI or npx download.
    execFileSync(
      resolve(
        fileURLToPath(
          new URL('../node_modules/.bin/posthog-cli', import.meta.url),
        ),
      ),
      args,
      {
        env: commandEnv,
        stdio: 'pipe',
        timeout: 120_000,
      },
    );
  },
  log = console.log,
  warn = console.warn,
} = {}) {
  const sha = env.VERCEL_GIT_COMMIT_SHA ?? '';
  const configured =
    env.VERCEL_ENV === 'production' &&
    env.POSTHOG_CLI_API_KEY &&
    env.POSTHOG_CLI_PROJECT_ID &&
    /^[0-9a-f]{7,40}$/i.test(sha);
  try {
    if (configured) {
      await prepareServerMaps(outputDir);
      const common = [
        '--directory',
        outputDir,
        '--exclude',
        '**/_functions/**',
        '--release-name',
        'duoly',
        '--release-version',
        sha.slice(0, 12),
        '--release-mode',
        'event',
      ];
      await run(
        ['--host', 'https://eu.posthog.com', 'sourcemap', 'inject', ...common],
        env,
      );
      await run(
        [
          '--host',
          'https://eu.posthog.com',
          'sourcemap',
          'upload',
          ...common,
          '--delete-after',
        ],
        env,
      );
      log('[posthog] Source maps uploaded.');
    } else {
      log(
        '[posthog] Source map upload skipped (not configured for production).',
      );
    }
  } catch {
    // CLI output/errors may contain credentials. Never forward them to build logs.
    warn(
      '[posthog] WARNING: source map injection/upload failed; continuing without telemetry.',
    );
  } finally {
    await deleteMaps(outputDir);
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  await processSourcemaps();
}
