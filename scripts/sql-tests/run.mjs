import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import console from 'node:console';
import process from 'node:process';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const dir = path.join(root, 'supabase/tests');
const guard = readFileSync(
  path.join(root, 'scripts/sql-tests/guard.sql'),
  'utf8',
);
export function inventory() {
  const lines = readFileSync(path.join(dir, 'ci-manifest.txt'), 'utf8')
    .trim()
    .split('\n');
  const seen = new Set();
  const entries = [];
  const skipped = [];
  for (const line of lines) {
    if (!line || (line.startsWith('# ') && !line.startsWith('# skip ')))
      continue;
    const words = line.split(/\s+/);
    const skip = words[0] === '#';
    const names = skip
      ? [words[2]]
      : words[0] === 'suite'
        ? words.slice(1)
        : words.slice(2);
    if (!skip && !['suite', 'group'].includes(words[0]))
      throw new Error(`Invalid entry: ${line}`);
    for (const name of names) {
      if (!/^[\w.-]+\.(sql|py|[cm]?js)$/.test(name) || seen.has(name))
        throw new Error(`Invalid/duplicate: ${name}`);
      readFileSync(path.join(dir, name));
      seen.add(name);
    }
    if (skip) skipped.push(line);
    else entries.push({ name: words[1], files: names });
  }
  for (const name of readdirSync(dir).filter((f) =>
    /\.(sql|py|[cm]?js)$/.test(f),
  )) {
    if (!seen.has(name)) throw new Error(`Unclassified test: ${name}`);
  }
  return { entries, skipped };
}
function command(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', cwd: root }).trim();
}
function run() {
  const { entries, skipped } = inventory();
  if (process.argv.includes('--inventory')) {
    console.log(
      JSON.stringify(
        {
          suites: entries.length,
          skipped: skipped.length,
          entries,
          reasons: skipped,
        },
        null,
        2,
      ),
    );
    return;
  }
  // No caller URL, credentials, linked project or inherited libpq routing accepted.
  if (
    process.argv.length !== 2 ||
    Object.keys(process.env).some((k) =>
      /^PG|DATABASE_URL|SUPABASE_DB_URL/.test(k),
    )
  ) {
    throw new Error(
      'Refusing connection overrides; disposable local Docker identity required',
    );
  }
  const config = readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
  const project = config.match(/^project_id\s*=\s*"([\w-]+)"/m)?.[1];
  if (!project) throw new Error('Missing local project identity');
  const container = `supabase_db_${project}`;
  const info = JSON.parse(command('docker', ['inspect', container]))[0];
  if (
    !info.State.Running ||
    info.Name !== `/${container}` ||
    !info.Config.Image.startsWith('public.ecr.aws/supabase/postgres:17.')
  ) {
    throw new Error('Refusing non-disposable/non-PG17 container');
  }
  const ports = info.NetworkSettings.Ports['5432/tcp'];
  if (!ports?.length || ports.some((p) => !/^\d+$/.test(p.HostPort))) {
    throw new Error('Refusing missing or invalid disposable container port');
  }
  // Supabase explicitly publishes wildcard ports; the CLIENT target is still
  // literal loopback, and system_identifier must match this disposable container.
  const url = `postgresql://postgres:postgres@127.0.0.1:${ports[0].HostPort}/postgres`;
  const args = ['-X', '-v', 'ON_ERROR_STOP=1', url];
  const query = (sql) => command('psql', [...args, '-Atc', sql]);
  const identitySql = 'select system_identifier from pg_control_system()';
  // Block DB-container internet egress before any fixture or fake secret exists.
  // Return traffic to loopback-published client connections remains permitted.
  command('sudo', [
    'iptables',
    '-I',
    'DOCKER-USER',
    '1',
    '-m',
    'conntrack',
    '--ctstate',
    'ESTABLISHED,RELATED',
    '-j',
    'ACCEPT',
  ]);
  for (const network of Object.values(info.NetworkSettings.Networks)) {
    command('sudo', [
      'iptables',
      '-I',
      'DOCKER-USER',
      '2',
      '-s',
      network.IPAddress,
      '-j',
      'REJECT',
    ]);
  }
  const expected = command('docker', [
    'exec',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-Atc',
    identitySql,
  ]);
  if (query(identitySql) !== expected)
    throw new Error('Container/connection identity mismatch');
  const probe = (sql, shouldPass, label, target = url) => {
    const result = spawnSync('psql', [...args.slice(0, -1), target], {
      input: sql,
      encoding: 'utf8',
    });
    if (
      (result.status === 0) !== shouldPass ||
      (!shouldPass &&
        !result.stderr.includes('refusing to run tests on production'))
    ) {
      throw new Error(`Guard probe failed: ${label}: ${result.stderr}`);
    }
    console.log(`PASS guard: ${label}`);
  };
  probe(guard, false, 'missing marker refuses before fixtures');
  // First SQL write: fail closed on the secondary production sentinel before marker creation.
  query(`do $$ declare found boolean; begin
    if to_regclass('vault.secrets') is not null then
      execute 'select exists(select 1 from vault.secrets where name = ''payments_tick_secret'')' into found;
      if found then raise exception 'refusing to run tests on production'; end if;
    end if;
  end $$; create schema duoly_test_marker;`);
  probe(guard, true, 'marker without production sentinel accepts');
  probe(
    `begin; select vault.create_secret(repeat('local-only-',5),'payments_tick_secret');\n${guard}\nrollback;`,
    false,
    'production sentinel refuses (fake secret rolled back)',
  );
  query('create database duoly_guard_probe template template0');
  try {
    probe(
      `create schema duoly_test_marker;\n${guard}`,
      true,
      'absent vault branches safely',
      url.replace(/\/postgres$/, '/duoly_guard_probe'),
    );
  } finally {
    query('drop database duoly_guard_probe');
  }
  // Scheduling assertions inspect migration state, while the worker is stopped globally.
  command('docker', [
    'exec',
    container,
    'psql',
    '-U',
    'supabase_admin',
    '-d',
    'postgres',
    '-c',
    'alter system set cron.launch_active_jobs = off',
  ]);
  query('select pg_reload_conf()');
  const results = [];
  for (const entry of entries) {
    let sql = '';
    for (const name of entry.files) {
      const text = readFileSync(path.join(dir, name), 'utf8');
      if (!text.startsWith(guard))
        throw new Error(`Missing leading guard: ${name}`);
      // Explicit transaction suites keep their boundaries. Fragment groups share one session.
      sql += `\nreset role;\n${text}\n`;
    }
    const own = /^begin(?: read only)?;\s*$/im.test(sql);
    if (
      /^commit\s*;/im.test(sql) ||
      /^\\(?:i|ir|include|!|connect|c)\b/m.test(sql)
    )
      throw new Error(`Unsafe transaction/include: ${entry.name}`);
    if (!own) sql = `begin;\nsavepoint s;\n${sql}\nrollback;`;
    const result = spawnSync('psql', args, {
      input: sql,
      encoding: 'utf8',
      timeout: 240000,
      maxBuffer: 16 * 1024 * 1024,
    });
    const passed = result.status === 0 && !result.error;
    console.log(`${passed ? 'PASS' : 'FAIL'} ${entry.name}`);
    if (!passed) console.log(result.stdout, result.stderr, result.error ?? '');
    results.push({ name: entry.name, passed, files: entry.files });
  }
  const report = {
    ran: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    skipped: skipped.length,
    reasons: skipped,
    results,
  };
  writeFileSync(
    path.join(root, 'sql-test-results.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  if (report.failed) process.exitCode = 1;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) run();
