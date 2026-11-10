/* global console */
/**
 * The dev server Playwright owns, started through Astro's JavaScript API.
 *
 * `astro dev` no longer stays in the foreground everywhere. Astro 7.4.5 asks
 * am-i-vibing whether an AI coding agent started the command, and on every
 * platform except Windows it then re-spawns itself detached and exits
 * (node_modules/astro/dist/cli/dev/index.js, `wantsBackground`). Playwright
 * watches the process it spawned, so the moment that parent exits it reports
 * "Process from config.webServer exited early" and the run dies before a single
 * test loads. The configs with `--root tests/fixtures/...` never reached ready
 * at all, and the two that share the repo root silently reused whichever stray
 * daemon an earlier run had left listening.
 *
 * Calling `dev()` directly removes the question: there is no CLI, no agent
 * detection, no lock file and no second process. This script is the server, so
 * Playwright's SIGTERM reaches the thing holding the port, and the handlers
 * below give Astro the chance to close its sockets before the process goes.
 *
 * Usage: node scripts/dev-server.mjs --port 4334 [--host 127.0.0.1] [--root <dir>]
 */
import { dev } from 'astro';

/** Read `--flag value` pairs; anything else is a usage error worth failing on. */
function parseFlags(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name.startsWith('--') || value === undefined || value.startsWith('--'))
      throw new Error(
        `scripts/dev-server.mjs: expected "--flag value" pairs, got ${argv.slice(index).join(' ')}`,
      );
    flags[name.slice(2)] = value;
  }
  return flags;
}

const {
  port,
  host = '127.0.0.1',
  root = '.',
} = parseFlags(process.argv.slice(2));
if (!port) throw new Error('scripts/dev-server.mjs: --port is required');

const server = await dev({
  root,
  server: { host, port: Number(port) },
});

let stopping = false;
/** Stop once, then leave by the signal's own exit code. */
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  try {
    await server.stop();
  } catch (error) {
    console.error(error);
  }
  process.exit(signal === 'SIGINT' ? 130 : 143);
}

for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => stop(signal));
