"""Destructive development-only concurrency acceptance; no HTTP/application layer.

Uses only the repository-pinned Supabase CLI. Recovery SQL is ownership-guarded
and scoped to a random run UUID. Raw CLI diagnostics are never printed or saved.
Offline unittest coverage is NOT evidence of PostgreSQL acceptance.
"""
import argparse
import concurrent.futures
import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import threading
import uuid

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / 'node_modules/.bin/supabase'
SOURCE = ROOT / 'supabase/migrations/20261022093000_order_foundation.sql'


class RunnerError(RuntimeError):
    """Fixed, credential-free runner error."""


def require(condition, code):
    if not condition:
        raise RunnerError(code)


SQLSTATES = frozenset(('40P01', '55P03', '57014', '42P06', '23505'))
SAFE_FAILURES = frozenset('''
CLI_FAILED CLI_TIMEOUT CLI_INVALID_RESPONSE CLI_TRANSPORT_OR_RESPONSE_FAILED
SETUP_FAILED_OR_UNCONFIRMED SETUP_OUTCOME_UNKNOWN_RECOVERY_REQUIRED
EXPECTED_TWO_SESSIONS SESSIONS_OR_TRANSACTIONS_NOT_INDEPENDENT
TRANSACTIONS_DID_NOT_OVERLAP INVALID_TRANSACTION_TIMESTAMPS
BOTH_JWTS_MUST_ENTER_SWEEP SWEEP_MARKER_SESSION_MISMATCH SWEEP_DID_NOT_EXIT
SWEEP_MARKER_TIME_MISMATCH SWEEPS_DID_NOT_OVERLAP ATTEMPT_RESPONSE_INVALID
ACCEPT_RACE_WINNER_COUNT ACCEPT_RACE_RESULT EXPIRY_SETUP_UNCONFIRMED
EXPIRY_TARGET_NOT_CANCELLED EXPIRY_REFUND_INVARIANT_FAILED
FINAL_ASSIGNMENT_INVARIANT_FAILED
'''.split()) | frozenset('CLI_SQLSTATE_' + state for state in SQLSTATES)


class CLITransport:
    def __init__(self, project_ref):
        self.project_ref = project_ref

    def __call__(self, sql, timeout=40):
        try:
            result = subprocess.run(
                [str(CLI), 'db', 'query', '--linked', '--project-ref',
                 self.project_ref, '--output', 'json', sql],
                cwd=ROOT, capture_output=True, text=True, timeout=timeout)
            if result.returncode != 0:
                # Recognize only explicit SQLSTATE labels, never echo arbitrary
                # stderr/stdout or a fragment that could contain credentials.
                match = re.search(r'SQLSTATE[ :]+([0-9A-Z]{5})\b', result.stderr + '\n' + result.stdout)
                if match and match[1] in SQLSTATES:
                    raise RunnerError('CLI_SQLSTATE_' + match[1])
                raise RunnerError('CLI_FAILED')
            data = json.loads(result.stdout)
            rows = data.get('rows', []) if isinstance(data, dict) else data
            require(isinstance(rows, list), 'CLI_INVALID_RESPONSE')
            return rows
        except subprocess.TimeoutExpired:
            raise RunnerError('CLI_TIMEOUT') from None
        except RunnerError:
            raise
        except Exception:
            raise RunnerError('CLI_TRANSPORT_OR_RESPONSE_FAILED') from None


class Scope:
    def __init__(self):
        seed = uuid.uuid4()
        self.run_id = str(seed)
        self.owner = str(uuid.uuid4())
        self.namespace = 'duoly_order_test_' + seed.hex
        self.users = [str(uuid.uuid5(seed, f'user:{n}')) for n in range(1, 18)]
        self.orders = [str(uuid.uuid5(seed, f'order:{n}')) for n in range(1, 15)]
        self.reference_prefix = str(seed.int)
        self.discord_prefix = str(10**16 + seed.int % (9 * 10**16))

    def user(self, n):
        return self.users[n-1]

    def order(self, n):
        return self.orders[n-1]

    def lock_sql(self):
        # Every setup/reconcile/cleanup serializes on this exact namespace. A
        # timed-out setup still running remotely must finish before reconciliation.
        return ("set local statement_timeout='35s'; set local lock_timeout='30s'; "
                f"select pg_advisory_xact_lock(hashtextextended('{self.namespace}',0));\n")

    def marker_check(self):
        ns = self.namespace
        return f"""do $ownership$
        declare owned boolean := false;
        begin
          if to_regclass('{ns}.runner_owner') is not null then
            execute 'select count(*) = 1 and bool_and(run_id = ''{self.run_id}''::uuid and owner_token = ''{self.owner}''::uuid) from {ns}.runner_owner' into owned;
          end if;
          perform set_config('duoly.runner_owned', coalesce(owned,false)::text, true);
        end $ownership$;
        """

    def reconcile_sql(self):
        return ('/* reconcile */\nbegin; ' + self.lock_sql() + self.marker_check() +
                "select current_setting('duoly.runner_owned')::boolean as owned; commit;")

    def cleanup_sql(self):
        ids = ','.join(f"'{u}'" for u in self.users)
        return ('/* cleanup */\nbegin; ' + self.lock_sql() + self.marker_check() + f"""
        do $cleanup$ begin
          if current_setting('duoly.runner_owned') <> 'true' then
            raise exception 'OWNERSHIP_REFUSED';
          end if;
          -- Marker and identity metadata must both agree before deleting users.
          if exists(select 1 from auth.users where id in ({ids})
            and raw_user_meta_data->>'duoly_concurrency_owner' is distinct from '{self.owner}') then
            raise exception 'OWNERSHIP_REFUSED';
          end if;
          drop schema {self.namespace} cascade;
          delete from auth.users where id in ({ids})
            and raw_user_meta_data->>'duoly_concurrency_owner' = '{self.owner}';
        end $cleanup$;
        commit; select true as cleaned;""")

    def post_sql(self):
        ids = ','.join(f"'{u}'" for u in self.users)
        return (f"/* post */\nselect to_regnamespace('{self.namespace}')::text as ns,"
                f"(select count(*) from auth.users where id in ({ids})) as fixtures;")

    def insert_order(self, n, customer, expired=False):
        # Strict queue ordering makes the first/last expiry targets reproducible.
        created = "clock_timestamp()-interval '10 minutes'"
        queued = (f"clock_timestamp()-interval '{500-n} seconds'" if expired
                  else "clock_timestamp()-interval '2 minutes'")
        return f"""insert into {self.namespace}.orders
        (id,public_reference,customer_id,game,service,title,units,unit,region,ign,
         customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at)
        values('{self.order(n)}','DL-{self.reference_prefix}{n:03d}','{self.user(customer)}',
        'lol','duo','Concurrency fixture',1,'game','EUW','FixturePlayer','Fixture',999,1.08,646,{created},{queued});\n"""

    def setup_sql(self):
        source = SOURCE.read_text()
        require(source.startswith('-- Durable foundation only.'), 'SOURCE_SHAPE_CHANGED')
        require(len(re.findall(r'^begin;\s*$', source, re.M)) == 1 and
                len(re.findall(r'^commit;\s*$', source, re.M)) == 1, 'SOURCE_TRANSACTION_CHANGED')
        source = re.sub(r'^begin;\s*', '', source, count=1, flags=re.M)
        source = re.sub(r'commit;\s*$', '', source)
        ns = self.namespace
        source = source.replace('public.', ns + '.').replace(ns+'.profiles', 'public.profiles').replace(ns+'.account_roles', 'public.account_roles')
        sql = f'/* setup */\nbegin; {self.lock_sql()}create schema {ns};\n'
        sql += f'revoke all on schema {ns} from public, anon, authenticated, service_role; grant usage on schema {ns} to authenticated;\n'
        sql += f"""create table {ns}.runner_owner(run_id uuid not null, owner_token uuid not null);
        revoke all on {ns}.runner_owner from public, anon, authenticated, service_role;
        insert into {ns}.runner_owner values('{self.run_id}','{self.owner}');\n"""
        sql += source
        for uid in self.users:
            sql += f"insert into auth.users(id,raw_user_meta_data) values('{uid}','{{\"duoly_concurrency_owner\":\"{self.owner}\"}}'::jsonb);\n"
        ids = ','.join(f"'{self.user(n)}'" for n in (4,5,6))
        sql += f"update public.account_roles set role='teammate' where user_id in ({ids});\n"
        for n in (4,5,6):
            sql += f"insert into {ns}.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at,priority_base) values('{self.user(n)}',array['lol'],'{self.discord_prefix}{n:03d}',clock_timestamp(),0);\n"
        for n in (1,2,3):
            sql += self.insert_order(n, n)
        return sql + f"commit; select '{self.owner}' as ready;"

    def expiry_sql(self):
        ns = self.namespace
        # Instrument the clone, not the migration. The wrapper delegates to the
        # unchanged sweep and records JWT/backend/xid-correlated entry AND exit.
        group = uuid.UUID(self.run_id).int % (2**30)
        sql = '/* extra */\nbegin; ' + self.lock_sql()
        for n in range(4,15):
            sql += self.insert_order(n, n+3, expired=True)
        sql += f"""
        create table {ns}.runner_sweep_markers(
          actor uuid primary key, pid integer not null, xid text not null,
          entered_at timestamptz not null, exited_at timestamptz);
        revoke all on {ns}.runner_sweep_markers from public,anon,authenticated,service_role;
        alter function {ns}.order_sweep(integer) rename to runner_original_sweep;
        create function {ns}.order_sweep(p_limit integer) returns integer
        language plpgsql security invoker set search_path='' as $sweep$
        declare v_actor uuid := auth.uid(); v_count integer;
          v_deadline timestamptz := clock_timestamp()+interval '8 seconds';
        begin
          insert into {ns}.runner_sweep_markers(actor,pid,xid,entered_at)
            values(v_actor,pg_backend_pid(),txid_current()::text,clock_timestamp());
          if v_actor not in ('{self.user(7)}'::uuid,'{self.user(17)}'::uuid) then
            raise exception 'UNEXPECTED_SWEEP_ACTOR';
          end if;
          -- Both sessions must enter sweep before either may leave the gate.
          perform pg_advisory_xact_lock({group},case when v_actor='{self.user(7)}' then 1 else 2 end);
          while (select count(distinct pid) from pg_catalog.pg_locks
            where locktype='advisory' and classid={group}::oid and objid in (1,2)
              and objsubid=2 and granted and database=(select oid from pg_catalog.pg_database where datname=current_database())) < 2 loop
            if clock_timestamp() > v_deadline then raise exception 'SWEEP_BARRIER_TIMEOUT'; end if;
            perform pg_sleep(0.05);
          end loop;
          -- Under sweep-before-target ordering user17 takes target4 first and
          -- sleeps in the trigger; user7 skips it, takes target14 and sleeps.
          -- Each then needs the other's target: a real deadlock, not two early
          -- accept_order(410) returns that never enter sweep. With target-first
          -- locking each already owns its target and SKIP LOCKED stays safe.
          if v_actor='{self.user(7)}' then perform pg_sleep(1); end if;
          v_count := {ns}.runner_original_sweep(p_limit);
          update {ns}.runner_sweep_markers set exited_at=clock_timestamp() where actor=v_actor;
          return v_count;
        end $sweep$;
        revoke all on function {ns}.order_sweep(integer) from public,anon,authenticated,service_role;
        create function {ns}.slow_expiry() returns trigger
        language plpgsql security invoker set search_path='' as $delay$
        begin
          if old.status='queued' and new.status='cancelled'
            and new.id in ('{self.order(4)}'::uuid,'{self.order(14)}'::uuid) then
            perform pg_sleep(3);
          end if;
          return new;
        end $delay$;
        revoke all on function {ns}.slow_expiry() from public,anon,authenticated,service_role;
        create trigger test_expiry_overlap after update on {ns}.orders
          for each row execute function {ns}.slow_expiry();
        commit; select true as ready;
        """
        return sql

    def attempt_sql(self, actor, oid, rpc, expiry=False):
        require(rpc in ('accept_order', 'customer_order'), 'INVALID_TEST_RPC')
        return f"""/* attempt */
        begin; set local statement_timeout='20s'; set local lock_timeout='15s';
        set local role authenticated;
        select set_config('request.jwt.claim.sub','{self.user(actor)}',true);
        select set_config('request.jwt.claims','{{"sub":"{self.user(actor)}","role":"authenticated"}}',true);
        with started as materialized
          (select clock_timestamp() as started_at,pg_backend_pid() as pid,txid_current()::text as xid),
        attempted as materialized
          (select s.*, {self.namespace}.{rpc}('{self.order(oid)}') as result from started s),
        held as materialized (select pg_sleep(2) from attempted)
        select a.*,clock_timestamp() as finished_at from attempted a cross join held;
        commit;"""


def instant(value):
    return datetime.datetime.fromisoformat(value)


def validate_overlap(rows):
    require(len(rows) == 2, 'EXPECTED_TWO_SESSIONS')
    require(rows[0]['pid'] != rows[1]['pid'] and rows[0]['xid'] != rows[1]['xid'],
            'SESSIONS_OR_TRANSACTIONS_NOT_INDEPENDENT')
    for a, b in ((rows[0], rows[1]), (rows[1], rows[0])):
        require(instant(a['started_at']) < instant(b['finished_at']), 'TRANSACTIONS_DID_NOT_OVERLAP')
        require(instant(a['started_at']) < instant(a['finished_at']), 'INVALID_TRANSACTION_TIMESTAMPS')


def validate_sweep(rows, actors, markers):
    validate_overlap(rows)
    require(len(markers) == 2 and {m['actor'] for m in markers} == set(actors),
            'BOTH_JWTS_MUST_ENTER_SWEEP')
    by_actor = {m['actor']: m for m in markers}
    for row, actor in zip(rows, actors):
        marker = by_actor[actor]
        require(marker['pid'] == row['pid'] and str(marker['xid']) == str(row['xid']),
                'SWEEP_MARKER_SESSION_MISMATCH')
        require(marker['exited_at'] is not None, 'SWEEP_DID_NOT_EXIT')
        require(instant(row['started_at']) <= instant(marker['entered_at']) <=
                instant(marker['exited_at']) <= instant(row['finished_at']), 'SWEEP_MARKER_TIME_MISMATCH')
    require(max(instant(m['entered_at']) for m in markers) <=
            min(instant(m['exited_at']) for m in markers), 'SWEEPS_DID_NOT_OVERLAP')


def race(scope, query, pairs, rpc):
    barrier = threading.Barrier(2)
    def attempt(pair):
        sql = scope.attempt_sql(*pair, rpc)
        barrier.wait(timeout=10)
        result = query(sql, 35)
        require(len(result) == 1, 'ATTEMPT_RESPONSE_INVALID')
        return result[0]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        rows = list(pool.map(attempt, pairs))
    validate_overlap(rows)
    return rows


def acceptance(scope, query):
    receipt = {}
    for label, pairs in (
        ('two_teammates_one_order', [(4,1),(5,1)]),
        ('one_teammate_two_orders', [(6,2),(6,3)]),
    ):
        rows = race(scope, query, pairs, 'accept_order')
        winners = [r for r in rows if 'order' in r['result']]
        losers = [r for r in rows if 'error' in r['result']]
        require(len(winners) == 1 and len(losers) == 1, 'ACCEPT_RACE_WINNER_COUNT')
        require(winners[0]['result']['order']['status'] == 'in_progress' and
                losers[0]['result']['error']['code'] == 409, 'ACCEPT_RACE_RESULT')
        receipt[label] = {'passed': True, 'distinct_backend_pids': [r['pid'] for r in rows],
                          'distinct_xids': [r['xid'] for r in rows], 'overlap_verified': True,
                          'winner_status': 'in_progress', 'loser_error': 409}
    extra = query(scope.expiry_sql())
    require(extra == [{'ready': True}], 'EXPIRY_SETUP_UNCONFIRMED')
    pairs = [(7,4),(17,14)]
    rows = race(scope, query, pairs, 'customer_order')
    for row, (_, oid) in zip(rows, pairs):
        order = row['result'].get('order', {})
        require(order.get('id') == scope.order(oid) and order.get('status') == 'cancelled'
                and order.get('cancel_reason') == 'queue_expired', 'EXPIRY_TARGET_NOT_CANCELLED')
    ns = scope.namespace
    markers = query(f'/* markers */ select actor::text,pid,xid,entered_at,exited_at from {ns}.runner_sweep_markers;')
    validate_sweep(rows, [scope.user(7), scope.user(17)], markers)
    expired_ids = ','.join(f"'{scope.order(n)}'" for n in range(4,15))
    refunds = query(f"""/* refunds */ select count(distinct o.id) as expired,
      count(c.id) as credits,
      count(c.id) filter(where o.id in ('{scope.order(4)}','{scope.order(14)}')) as target_credits,
      bool_and(o.status='cancelled' and o.cancel_reason='queue_expired'
        and c.id is not null and c.customer_id=o.customer_id and c.kind='queued_refund'
        and c.amount_eur_cents=o.amount_eur_cents) as refunds_valid
      from {ns}.orders o left join {ns}.refund_credits c on c.order_id=o.id
      where o.id in ({expired_ids});""")
    require(refunds == [{'expired': 11, 'credits': 11, 'target_credits': 2, 'refunds_valid': True}],
            'EXPIRY_REFUND_INVARIANT_FAILED')
    receipt['cross_target_expiry_sweep'] = {
        'passed': True, 'rpc': 'customer_order', 'distinct_backend_pids': [r['pid'] for r in rows],
        'distinct_xids': [r['xid'] for r in rows], 'overlap_verified': True,
        'both_jwts_entered_and_exited_sweep': True, 'sweep_markers': markers,
        'refunds': refunds[0]}
    counts = query(f"""/* counts */ select
      (select count(*) from {ns}.orders where status='in_progress') as active,
      (select count(*) from {ns}.order_assignments where ended_at is null) as assignments;""")
    require(counts == [{'active': 2, 'assignments': 2}], 'FINAL_ASSIGNMENT_INVARIANT_FAILED')
    receipt['final_counts'] = counts[0]
    return receipt


def run(project_ref, confirm_development=False, *, transport=None, scratch=None):
    require(confirm_development is True and isinstance(project_ref, str) and
            re.fullmatch(r'[a-z]{20}', project_ref) is not None,
            'REFUSED: explicit development confirmation and valid project ref required')
    scope = Scope()
    query = transport if transport is not None else CLITransport(project_ref)
    owned = False
    receipt = {'run_id': scope.run_id, 'namespace': scope.namespace, 'passed': False}
    try:
        directory = Path(scratch) if scratch is not None else Path(tempfile.gettempdir())
        directory.mkdir(parents=True, exist_ok=True)
        prefix = directory / f'duoly-order-concurrency-{scope.run_id}'
        # Exclusive creation refuses even an astronomically unlikely filename
        # collision. Recovery SQL is safe to run only for this invocation's marker.
        with Path(str(prefix)+'-cleanup.sql').open('x') as handle:
            os.chmod(handle.name, 0o600)
            handle.write(scope.cleanup_sql())
        setup = scope.setup_sql()
    except Exception:
        raise RunnerError('PREPARATION_OR_ARTIFACT_REFUSED') from None
    failure = None
    try:
        try:
            ready = query(setup)
            require(ready == [{'ready': scope.owner}], 'SETUP_UNCONFIRMED')
            owned = True
        except BaseException:
            # Even connection failure may mean COMMIT succeeded. Serialize with
            # the setup transaction, then check the exact random owner marker.
            try:
                owned = query(scope.reconcile_sql()) == [{'owned': True}]
            except BaseException:
                owned = False
                raise RunnerError('SETUP_OUTCOME_UNKNOWN_RECOVERY_REQUIRED') from None
            raise RunnerError('SETUP_FAILED_OR_UNCONFIRMED') from None
        receipt.update(acceptance(scope, query))
        receipt['passed'] = True
    except RunnerError as exc:
        failure = str(exc) if str(exc) in SAFE_FAILURES else 'ACCEPTANCE_OR_SETUP_FAILED'
    except BaseException:
        failure = 'ACCEPTANCE_OR_SETUP_FAILED'
    finally:
        if owned:
            try:
                cleaned = query(scope.cleanup_sql())
                require(cleaned == [{'cleaned': True}], 'CLEANUP_UNCONFIRMED')
                post = query(scope.post_sql())
                require(post == [{'ns': None, 'fixtures': 0}], 'CLEANUP_READBACK_FAILED')
                receipt['cleanup_verified'] = True
            except BaseException:
                failure = 'CLEANUP_UNCONFIRMED_RECOVERY_REQUIRED'
        else:
            receipt['cleanup_verified'] = False
        receipt['passed'] = receipt['passed'] and failure is None
        if failure:
            receipt['error'] = failure
        try:
            with Path(str(prefix)+'-result.json').open('x') as handle:
                os.chmod(handle.name, 0o600)
                json.dump(receipt, handle, indent=2)
        except Exception:
            failure = 'RESULT_ARTIFACT_FAILED'
    if failure:
        raise RunnerError(failure) from None
    return receipt


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project-ref', required=True)
    parser.add_argument('--confirm-development', required=True, action='store_true')
    args = parser.parse_args(argv)
    try:
        receipt = run(args.project_ref, args.confirm_development)
        print(json.dumps(receipt, indent=2))
    except RunnerError as exc:
        print(str(exc))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit('Hosted fixture transport disabled; use disposable local SQL CI')
    raise SystemExit(main())
