// Sparky evaluation (ledger #25, S3). NOT part of CI.
//
//   node scripts/sparky/run-eval.ts [--only C01,A05] [--verbose] [--out file.json]
//
// Runs tests/eval/sparky-eval.json through the real answer pipeline
// (answerWithAi with the real tools) against live data, read only:
// - Test askers are existing accounts picked by role from the database
//   (admin, teammate, the customer with the most orders, another customer).
//   Nothing is created or changed.
// - Customer and teammate tools read with the service role, bound to the
//   asker's user id, exactly as /api/support does.
// - Admin tools call the real admin read RPCs as that admin: each call runs in
//   `begin; set local role authenticated; <jwt claims>; select rpc; rollback;`
//   through the linked Supabase CLI, so admin_caller() checks the real role.
// - The OpenAI key and the Supabase secret key come from the macOS Keychain and
//   are never printed.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type {
  AdminReadFn,
  AdminRpc,
} from '../../src/server/support/admin-lookup.ts';
import type { SupportPerson } from '../../src/server/support/sparky.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SUPABASE_URL = 'https://omnejesspybaxuacjlah.supabase.co';
const CLI = join(ROOT, 'node_modules/.bin/supabase');

// The app imports siblings without extensions (Vite style); let Node find them.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!/^\.\.?\//.test(specifier) || /\.[cm]?[jt]sx?$/.test(specifier))
        throw error;
      for (const ext of ['.ts', '.js']) {
        try {
          return nextResolve(specifier + ext, context);
        } catch {
          // try the next extension
        }
      }
      throw error;
    }
  },
});

const keychain = (service: string, account: string) =>
  execFileSync(
    'security',
    ['find-generic-password', '-s', service, '-a', account, '-w'],
    { encoding: 'utf8' },
  ).trim();

type Json = Record<string, unknown>;

/** One read-only SQL statement through the linked CLI; returns the rows. */
function sql(statement: string): Json[] {
  const dir = mkdtempSync(join(tmpdir(), 'sparky-eval-'));
  const file = join(dir, 'q.sql');
  try {
    writeFileSync(file, statement);
    const out = execFileSync(
      CLI,
      ['db', 'query', '--linked', '-o', 'json', '-f', file],
      {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    return (JSON.parse(out) as { rows: Json[] }).rows;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_FNS: AdminReadFn[] = [
  'admin_orders_page',
  'admin_order_reports',
  'admin_accounts',
  'admin_customers',
  'admin_teammates',
];

/** The admin read RPCs, executed as `adminId` inside a rolled-back transaction. */
function adminRpcAs(adminId: string): AdminRpc {
  if (!UUID.test(adminId)) throw new Error('bad admin id');
  const cache = new Map<string, { data: unknown; error: unknown }>();
  return async (fn, args = {}) => {
    if (!ADMIN_FNS.includes(fn)) throw new Error('not an admin read');
    const named = Object.entries(args).map(([key, value]) => {
      if (!/^p_[a-z_]+$/.test(key) || !Number.isInteger(value))
        throw new Error('unexpected admin argument');
      return `${key} => ${Number(value)}`;
    });
    const call = `public.${fn}(${named.join(', ')})`;
    const hit = cache.get(call);
    if (hit) return hit;
    const claims = JSON.stringify({ sub: adminId, role: 'authenticated' });
    const rows = sql(`begin;
select set_config('request.jwt.claims', '${claims}', true),
       set_config('request.jwt.claim.sub', '${adminId}', true);
set local role authenticated;
select ${call} as r;
rollback;`);
    const result = { data: rows[0]?.r ?? null, error: null };
    cache.set(call, result);
    return result;
  };
}

type Question = {
  id: string;
  asker: 'guest' | 'customer' | 'customer_other' | 'teammate' | 'admin';
  topic: string;
  question: string;
  expect: string[][];
  forbid: string[];
};

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function fill(template: string, facts: Record<string, string>, regex: boolean) {
  return template.replace(/\{([a-z_]+)\}/g, (match, key: string) =>
    key in facts ? (regex ? escape(facts[key]!) : facts[key]!) : match,
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only')
    ? new Set((argv[argv.indexOf('--only') + 1] ?? '').split(','))
    : null;
  const verbose = argv.includes('--verbose');
  const outFile = argv.includes('--out')
    ? argv[argv.indexOf('--out') + 1]
    : null;

  const load = (path: string) =>
    import(pathToFileURL(join(ROOT, path)).href) as Promise<unknown>;
  const { createClient } =
    (await import('@supabase/supabase-js')) as typeof import('@supabase/supabase-js');
  const { answerWithAi } = (await load(
    'src/server/support/ai.ts',
  )) as typeof import('../../src/server/support/ai.ts');
  const { sparkyLookup } = (await load(
    'src/server/support/lookup.ts',
  )) as typeof import('../../src/server/support/lookup.ts');
  const { sparkyAdminLookup } = (await load(
    'src/server/support/admin-lookup.ts',
  )) as typeof import('../../src/server/support/admin-lookup.ts');
  const { supportPerson } = (await load(
    'src/server/support/person.ts',
  )) as typeof import('../../src/server/support/person.ts');
  const { GAME } = (await load('src/design-reference/lib/games.js')) as {
    GAME: Record<string, { name: string }>;
  };

  const apiKey = keychain('duoly-openai-api-key', 'sparky');
  const service = createClient(
    SUPABASE_URL,
    keychain('duoly-supabase-secret-key', 'duoly-dev'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Pick existing accounts by role and the facts the expectations need.
  const [picked] = sql(`select pg_catalog.jsonb_build_object(
  'admin', (select r.user_id from public.account_roles r join auth.users u on u.id = r.user_id
             where r.role = 'admin' order by u.created_at limit 1),
  'teammate', (select r.user_id from public.account_roles r join auth.users u on u.id = r.user_id
                where r.role = 'teammate' order by u.created_at limit 1),
  'customer', (select r.user_id from public.account_roles r
                where r.role = 'customer'
                order by (select count(*) from public.orders o where o.customer_id = r.user_id) desc, r.user_id limit 1),
  'customer_other', (select r.user_id from public.account_roles r
                where r.role = 'customer'
                order by (select count(*) from public.orders o where o.customer_id = r.user_id), r.user_id limit 1)
) as p;`);
  const ids = picked?.p as Record<string, string>;
  for (const role of ['admin', 'teammate', 'customer', 'customer_other'])
    if (!ids[role]) throw new Error(`No ${role} account in the database.`);
  if (ids.customer === ids.customer_other)
    throw new Error('Need two different customers.');

  const [factRow] = sql(`select pg_catalog.jsonb_build_object(
  'own_ref', o.public_reference, 'own_game', o.game,
  'customer_a_id', c.id, 'customer_a_email', c.email, 'customer_a_name', coalesce(cp.name, ''),
  'customer_a_orders', (select count(*) from public.orders x where x.customer_id = c.id)::text,
  'customer_a_loyalty', public.loyalty_summary(c.id) -> 'level' ->> 'name',
  'teammate_id', t.id, 'teammate_email', t.email,
  'teammate_trust', public.completion_trust(public.payout_valid_count(t.id)) ->> 'trust_tier',
  'priority_base', (select a.priority_base::text from public.teammate_order_access a where a.user_id = t.id)
) as f
from auth.users c left join public.profiles cp on cp.id = c.id
cross join auth.users t
left join lateral (select * from public.orders x where x.customer_id = c.id order by x.created_at desc limit 1) o on true
where c.id = '${ids.customer}' and t.id = '${ids.teammate}';`);
  const facts = Object.fromEntries(
    Object.entries((factRow?.f ?? {}) as Record<string, unknown>).map(
      ([key, value]) => [key, value === null ? '' : String(value)],
    ),
  ) as Record<string, string>;
  if (!facts.own_ref) throw new Error('The chosen customer has no orders.');
  facts.own_game = GAME[facts.own_game!]?.name ?? facts.own_game!;
  facts.priority_base ||= 'no-priority-base';

  const persons = new Map<string, SupportPerson>();
  persons.set('guest', await supportPerson(service, null));
  for (const asker of ['admin', 'teammate', 'customer', 'customer_other']) {
    const id = ids[asker]!;
    const [user] =
      sql(`select pg_catalog.jsonb_build_object('id', u.id, 'email', u.email,
  'name', coalesce(p.name, ''), 'image', coalesce(p.image, ''), 'role', r.role) as v
from auth.users u join public.account_roles r on r.user_id = u.id
left join public.profiles p on p.id = u.id where u.id = '${id}';`);
    const viewer = user?.v as {
      id: string;
      role: 'customer' | 'teammate' | 'admin';
      name: string;
      email: string | null;
      image: string;
    };
    persons.set(asker, await supportPerson(service, { viewer }));
  }

  const file = JSON.parse(
    readFileSync(join(ROOT, 'tests/eval/sparky-eval.json'), 'utf8'),
  ) as { questions: Question[] };
  const questions = file.questions.filter((q) => !only || only.has(q.id));

  type Outcome = {
    id: string;
    asker: string;
    topic: string;
    pass: boolean;
    reasons: string[];
    tools: string[];
    source: string;
    reply: string;
  };
  const results: Outcome[] = [];
  const queue = [...questions];
  async function worker() {
    for (;;) {
      const q = queue.shift();
      if (!q) return;
      const person = persons.get(q.asker)!;
      const question = fill(q.question, facts, false);
      const answer = await answerWithAi({
        person,
        question,
        apiKey,
        timeoutMs: 30_000,
        totalTimeoutMs: 90_000,
        lookup: person.userId ? sparkyLookup(service, person.userId) : null,
        adminLookup:
          person.accountRole === 'admin'
            ? sparkyAdminLookup(adminRpcAs(person.userId!))
            : null,
      });
      const reply = answer.reply;
      const reasons: string[] = [];
      if (answer.source !== 'ai') reasons.push('fallback answer, not AI');
      for (const group of q.expect) {
        const alternatives = group.map(
          (pattern) => new RegExp(fill(pattern, facts, true), 'i'),
        );
        if (!alternatives.some((re) => re.test(reply)))
          reasons.push(`missing ${group.join(' | ')}`);
      }
      for (const pattern of q.forbid) {
        const re = new RegExp(fill(pattern, facts, true), 'i');
        if (re.test(reply)) reasons.push(`forbidden ${pattern}`);
      }
      if (/[\u2013\u2014]/.test(reply)) reasons.push('dash in reply');
      results.push({
        id: q.id,
        asker: q.asker,
        topic: q.topic,
        pass: reasons.length === 0,
        reasons,
        tools: (answer.tools ?? []).map((t) => `${t.name}:${t.status}`),
        source: answer.source,
        reply,
      });
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  results.sort(
    (a, b) =>
      questions.findIndex((q) => q.id === a.id) -
      questions.findIndex((q) => q.id === b.id),
  );

  const pad = (value: string, width: number) =>
    value.length > width
      ? value.slice(0, width - 1) + '…'
      : value.padEnd(width);
  console.log(
    `${pad('ID', 5)} ${pad('ASKER', 15)} ${pad('TOPIC', 15)} ${pad('RESULT', 6)} ${pad('TOOLS', 40)} REASON`,
  );
  for (const r of results) {
    console.log(
      `${pad(r.id, 5)} ${pad(r.asker, 15)} ${pad(r.topic, 15)} ${pad(r.pass ? 'PASS' : 'FAIL', 6)} ${pad(r.tools.join(',') || '-', 40)} ${r.reasons.join('; ')}`,
    );
    if (verbose || !r.pass)
      console.log(`      > ${r.reply.replace(/\s+/g, ' ')}`);
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (outFile)
    writeFileSync(outFile, JSON.stringify({ results, passed }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Eval failed.');
  process.exit(1);
});
