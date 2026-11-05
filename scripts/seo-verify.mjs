/* global fetch */
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import process from 'node:process';
const server = spawn(process.execPath, ['scripts/seo-preview.mjs'], {
  stdio: 'inherit',
});
async function run(args) {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  const code = await new Promise((resolve) => child.once('exit', resolve));
  if (code !== 0) throw new Error(`${args.join(' ')} exited ${code}`);
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('Production preview exited');
    ready = await fetch('http://127.0.0.1:4381/robots.txt')
      .then((r) => r.ok)
      .catch(() => false);
    if (ready) break;
    await setTimeout(250);
  }
  if (!ready) throw new Error('Production preview did not start');
  await run(['scripts/seo-audit.mjs']);
  await run(['--test', 'scripts/seo-built.test.mjs']);
} finally {
  server.kill();
}
