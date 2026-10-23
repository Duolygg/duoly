// Native, independent multi-session PostgreSQL. All commits are LOCAL disposable fixtures.
// Install scratch dependencies (never repository deps):
// npm install --prefix "$HOME/.hermes/cache/scratch/completion-postgres" embedded-postgres@18.4.0-beta.17 pg@8.16.3
import { readFile, readdir, mkdtemp } from 'node:fs/promises';
import console from 'node:console';
import { setTimeout } from 'node:timers';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const scratch = path.join(
  process.env.HOME,
  '.hermes/cache/scratch/completion-postgres',
);
const require = createRequire(path.join(scratch, 'package.json'));
const { default: EmbeddedPostgres } = await import(
  path.join(scratch, 'node_modules/embedded-postgres/dist/index.js')
);
const { Client } = require('pg');
const dir = await mkdtemp(path.join(scratch, 'cluster-'));
const port = Number(process.env.COMPLETION_PG_PORT || 55439);
const server = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'local-completion-only',
  port,
  persistent: false,
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: (e) => console.error(String(e)),
});
const clients = [];
async function client() {
  const c = new Client({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    password: 'local-completion-only',
    database: 'postgres',
  });
  await c.connect();
  clients.push(c);
  return c;
}
const sql = (name) => readFile(path.join(root, 'supabase/tests', name), 'utf8');
try {
  await server.initialise();
  await server.start();
  const db = await client();
  console.log((await db.query('select version()')).rows[0].version);
  await db.query(await sql('completion_local_bootstrap.sql'));
  const skipped = [];
  for (const name of (await readdir(path.join(root, 'supabase/migrations')))
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    if (
      name.startsWith('20261023200000') ||
      name.startsWith('20261023210000')
    ) {
      skipped.push(name);
      continue;
    }
    await db.query(
      await readFile(path.join(root, 'supabase/migrations', name), 'utf8'),
    );
  }
  console.log(
    'Native migrations loaded; skipped managed cron/http-only migrations:',
    skipped,
  );
  await db.query('begin');
  await db.query(await sql('completion_fixture.sql'));
  const behavioral = process.argv.slice(2);
  for (const name of behavioral.length
    ? behavioral
    : [
        'completion_happy.sql',
        'completion_replay.sql',
        'completion_immutable.sql',
        'completion_chat.sql',
        'completion_history.sql',
        'completion_tiers.sql',
        'completion_tier_integration.sql',
        'completion_security.sql',
        'completion_integrity.sql',
        'completion_constraints.sql',
        'completion_history_order.sql',
      ]) {
    await db.query(await sql(name));
    console.log('PASS', name);
  }
  await db.query('rollback');
  // Install session-local fixture helper, then remove its first sample fixture by
  // rollback. Temporary functions are transactional, so install helper alone anew.
  const fixtureSource = await sql('completion_fixture.sql');
  await db.query(
    fixtureSource.slice(
      0,
      fixtureSource.lastIndexOf("select set_config('completion.fixture'"),
    ),
  );
  const a = await client(),
    b = await client();
  const fixture = async () =>
    (await db.query('select pg_temp.completion_fixture() as f')).rows[0].f;
  const login = async (c, actor) => {
    await c.query('begin');
    await c.query(
      "set local statement_timeout='10s';set local lock_timeout='8s';set local role authenticated",
    );
    await c.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
      [actor, JSON.stringify({ sub: actor, role: 'authenticated' })],
    );
  };
  const complete = (c, f, request = f.request) =>
    c.query('select public.complete_order($1,$2,$3,$4) as result', [
      f.order,
      f.assignment,
      [f.proof],
      request,
    ]);
  const reroll = (c, f) =>
    c.query('select public.reroll_order($1) as result', [f.order]);
  const pidA = (await a.query('select pg_backend_pid() as p')).rows[0].p;
  const pidB = (await b.query('select pg_backend_pid() as p')).rows[0].p;
  assert.notEqual(pidA, pidB);
  async function blockedB() {
    for (let n = 0; n < 200; n++) {
      const q = await db.query(
        'select wait_event_type from pg_stat_activity where pid=$1',
        [pidB],
      );
      if (q.rows[0]?.wait_event_type === 'Lock') return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('second native backend did not overlap/block');
  }
  async function race(label, first, second, firstActor, secondActor, f) {
    await login(a, firstActor);
    const firstResult = (await first(a, f)).rows[0].result;
    await login(b, secondActor);
    const promise = second(b, f);
    await blockedB();
    await a.query('commit');
    const secondResult = (await promise).rows[0].result;
    await b.query('commit');
    console.log(
      'PASS overlapping native backends',
      label,
      JSON.stringify({ pidA, pidB }),
    );
    return [firstResult, secondResult];
  }
  let f = await fixture();
  let r = await race(
    'same-request replay exactly once',
    complete,
    complete,
    f.teammate,
    f.teammate,
    f,
  );
  assert.deepEqual(r[0], r[1]);
  assert.ok(r[0].completion);
  assert.equal(
    (
      await db.query(
        'select count(*)::int as n from public.teammate_earning_entries where order_id=$1',
        [f.order],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.order_chat_messages where assignment_id=$1 and system_event='completed'",
        [f.assignment],
      )
    ).rows[0].n,
    1,
  );
  f = await fixture();
  r = await race(
    'completion wins reroll',
    complete,
    reroll,
    f.teammate,
    f.customer,
    f,
  );
  assert.ok(r[0].completion);
  assert.equal(r[1].error.code, 409);
  f = await fixture();
  r = await race(
    'reroll wins completion',
    reroll,
    complete,
    f.customer,
    f.teammate,
    f,
  );
  assert.equal(r[0].order.status, 'queued');
  assert.equal(r[1].error.code, 404);
  assert.equal(
    (
      await db.query(
        'select count(*)::int as n from public.teammate_earning_entries where order_id=$1',
        [f.order],
      )
    ).rows[0].n,
    0,
  );
  console.log(
    'PASS native concurrency: independent PostgreSQL backend PIDs, observed Lock waits, legal committed outcomes',
  );
  console.log(
    'Local schema URL while running: postgresql://postgres:local-completion-only@127.0.0.1:' +
      port +
      '/postgres (server stops on exit; public schema omits cleanup_runs cron/http migration)',
  );
} finally {
  for (const c of clients.reverse()) await c.end().catch(() => {});
  await server.stop();
}
