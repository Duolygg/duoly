"""Offline scope/transport tests, NOT PostgreSQL acceptance tests."""
import ast
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

PATH = Path(__file__).with_name('order_concurrency.py')


def load_runner():
    spec = importlib.util.spec_from_file_location('order_concurrency', PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError('test import specification unavailable')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SafetyTests(unittest.TestCase):
    def test_import_has_no_cli_or_artifact_side_effects(self):
        with patch('subprocess.run', side_effect=AssertionError('transport during import')):
            with patch.object(sys, 'argv', ['runner']):
                module = load_runner()
        self.assertTrue(callable(module.main))
        self.assertTrue(callable(module.run))
        self.assertFalse(any(isinstance(node, ast.Assert) for node in ast.walk(ast.parse(PATH.read_text()))))

    def test_explicit_confirmation_and_project_format_refuse_before_transport(self):
        m = load_runner()
        for ref, confirmed in [('a'*20, False), ('../unsafe', True), ('', True)]:
            with self.subTest(ref=ref, confirmed=confirmed):
                calls = []
                with self.assertRaises(m.RunnerError):
                    m.run(ref, confirmed, transport=lambda *a: calls.append(a))
                self.assertEqual(calls, [])


class OwnershipTests(unittest.TestCase):
    def setUp(self):
        self.m = load_runner()

    def test_random_scope_identities_and_guarded_atomic_sql(self):
        a, b = self.m.Scope(), self.m.Scope()
        self.assertNotEqual(a.namespace, b.namespace)
        self.assertTrue(set(a.users).isdisjoint(b.users))
        self.assertNotEqual(a.owner, b.owner)
        for scope in (a, b):
            sql = scope.setup_sql()
            self.assertTrue(sql.startswith('/* setup */\nbegin;'))
            self.assertIn('pg_advisory_xact_lock', sql)
            self.assertNotIn('create schema if not exists', sql.lower())
            self.assertIn(scope.owner, sql)
            self.assertIn('commit; select', sql)
            self.assertIn('revoke all on schema', sql)
            self.assertIn('runner_owner', scope.cleanup_sql())
            self.assertIn("raise exception 'OWNERSHIP_REFUSED'", scope.cleanup_sql())
            self.assertNotIn('drop schema if exists', scope.cleanup_sql())
            self.assertIn('pg_advisory_xact_lock', scope.reconcile_sql())
            self.assertNotIn(b.namespace if scope is a else a.namespace, scope.cleanup_sql())
            self.assertEqual(len(set(scope.users)), 17)
            self.assertEqual(len(set(scope.orders)), 14)

    def exercise_failure(self, setup_result, reconciled, fail_reconcile=False):
        calls = []
        def transport(sql, timeout=40):
            calls.append(sql)
            if sql.startswith('/* setup */'):
                if isinstance(setup_result, Exception):
                    raise setup_result
                return setup_result
            if sql.startswith('/* reconcile */'):
                if fail_reconcile:
                    raise RuntimeError('password=SECRET')
                return [{'owned': reconciled}]
            if sql.startswith('/* cleanup */'):
                return [{'cleaned': True}]
            if sql.startswith('/* post */'):
                return [{'ns': None, 'fixtures': 0}]
            raise RuntimeError('password=SECRET')
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(self.m.RunnerError) as ctx:
                self.m.run('a'*20, True, transport=transport, scratch=tmp)
            self.assertNotIn('SECRET', str(ctx.exception))
            artifacts = list(Path(tmp).glob('*'))
            self.assertTrue(artifacts)
            for artifact in artifacts:
                self.assertNotIn('SECRET', artifact.read_text())
            return calls, [p.name for p in artifacts]

    def test_rolled_back_setup_or_foreign_collision_never_cleans(self):
        for result in (RuntimeError('collision SECRET'), [], [{'ready': 'foreign'}]):
            with self.subTest(result=type(result).__name__):
                calls, _ = self.exercise_failure(result, False)
                self.assertTrue(any(s.startswith('/* reconcile */') for s in calls))
                self.assertFalse(any(s.startswith('/* cleanup */') for s in calls))

    def test_ambiguous_commit_reconciles_exact_ownership_then_cleans(self):
        calls, _ = self.exercise_failure(RuntimeError('timeout SECRET'), True)
        self.assertEqual(sum(s.startswith('/* cleanup */') for s in calls), 1)
        self.assertTrue(calls[-1].startswith('/* post */'))

    def test_unavailable_reconciliation_never_cleans_and_leaves_recovery(self):
        calls, names = self.exercise_failure(RuntimeError('timeout'), False, True)
        self.assertFalse(any(s.startswith('/* cleanup */') for s in calls))
        self.assertTrue(any(n.endswith('-cleanup.sql') for n in names))
        self.assertTrue(all(n != 'duoly-order-concurrency-cleanup.sql' for n in names))

    def test_confirmed_setup_partial_acceptance_failure_cleans(self):
        calls = []
        def transport(sql, timeout=40):
            calls.append(sql)
            if sql.startswith('/* setup */'):
                import re
                return [{'ready': re.search(r"select '([0-9a-f-]+)' as ready", sql)[1]}]
            if sql.startswith('/* cleanup */'):
                return [{'cleaned': True}]
            if sql.startswith('/* post */'):
                return [{'ns': None, 'fixtures': 0}]
            raise RuntimeError('SECRET')
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(self.m.RunnerError):
                self.m.run('a'*20, True, transport=transport, scratch=tmp)
        self.assertTrue(any(s.startswith('/* cleanup */') for s in calls))

    def test_artifact_collision_refuses_before_setup(self):
        scope = self.m.Scope()
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / f'duoly-order-concurrency-{scope.run_id}-cleanup.sql'
            target.write_text('foreign')
            calls = []
            with patch.object(self.m, 'Scope', return_value=scope):
                with self.assertRaises(self.m.RunnerError):
                    self.m.run('a'*20, True, transport=lambda *a: calls.append(a), scratch=tmp)
            self.assertEqual(calls, [])
            self.assertEqual(target.read_text(), 'foreign')

    def test_transport_errors_are_sanitized(self):
        cli = self.m.CLITransport('a'*20)
        for response in (subprocess.CompletedProcess([], 1, 'SECRET', 'password=SECRET'),
                         subprocess.CompletedProcess([], 0, 'invalid SECRET', '')):
            with patch('subprocess.run', return_value=response):
                with self.assertRaises(self.m.RunnerError) as ctx:
                    cli('select 1')
                self.assertNotIn('SECRET', str(ctx.exception))
        with patch('subprocess.run', side_effect=subprocess.TimeoutExpired('SECRET', 1)):
            with self.assertRaises(self.m.RunnerError) as ctx:
                cli('select 1')
            self.assertNotIn('SECRET', str(ctx.exception))

    def test_concurrent_invocations_do_not_share_cleanup_resources(self):
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda _: self.exercise_failure(RuntimeError('collision'), False), range(2)))
        self.assertTrue(set(results[0][1]).isdisjoint(results[1][1]))
        self.assertNotEqual(results[0][0][0], results[1][0][0])

    def test_sqlstate_diagnostics_are_reduced_to_allowlisted_codes(self):
        cli = self.m.CLITransport('a'*20)
        response = subprocess.CompletedProcess([], 1, '', 'password=SECRET SQLSTATE 40P01 raw details')
        with patch('subprocess.run', return_value=response):
            with self.assertRaises(self.m.RunnerError) as ctx:
                cli('select 1')
        self.assertEqual(str(ctx.exception), 'CLI_SQLSTATE_40P01')

    def test_run_preserves_only_allowlisted_failure_codes(self):
        scope = self.m.Scope()
        def transport(sql, timeout=40):
            if sql.startswith('/* setup */'): return [{'ready': scope.owner}]
            if sql.startswith('/* cleanup */'): return [{'cleaned': True}]
            if sql.startswith('/* post */'): return [{'ns': None, 'fixtures': 0}]
            raise self.m.RunnerError('CLI_SQLSTATE_40P01')
        with tempfile.TemporaryDirectory() as tmp, patch.object(self.m, 'Scope', return_value=scope):
            with self.assertRaises(self.m.RunnerError) as ctx:
                self.m.run('a'*20, True, transport=transport, scratch=tmp)
            self.assertEqual(str(ctx.exception), 'CLI_SQLSTATE_40P01')
        # Even a transport mistakenly raising RunnerError with a raw message must
        # not bypass the outer boundary's allowlist.
        self.exercise_failure(self.m.RunnerError('password=SECRET'), False)

    def test_same_namespace_foreign_owner_collision_cannot_cleanup(self):
        # Force the UUID namespace collision, while retaining distinct invocation
        # tokens. Mock only transport; SQL ownership guards are inspected above.
        a, b = self.m.Scope(), self.m.Scope()
        b.namespace, b.run_id, b.users, b.orders = a.namespace, a.run_id, a.users, a.orders
        owner_setup = __import__('threading').Event()
        contender_finished = __import__('threading').Event()
        calls = []
        def transport(sql, timeout=40):
            calls.append(sql)
            if sql.startswith('/* setup */'):
                if a.owner in sql:
                    owner_setup.set()
                    return [{'ready': a.owner}]
                owner_setup.wait(2)
                raise RuntimeError('schema collision SECRET')
            if sql.startswith('/* reconcile */'):
                self.assertIn(b.owner, sql)
                return [{'owned': False}]
            if sql.startswith('/* attempt */'):
                contender_finished.wait(2)
                raise RuntimeError('stop before SQL acceptance')
            if sql.startswith('/* cleanup */'):
                self.assertIn(a.owner, sql)
                self.assertNotIn(b.owner, sql)
                return [{'cleaned': True}]
            if sql.startswith('/* post */'): return [{'ns': None, 'fixtures': 0}]
            self.fail('unexpected transport request')
        def invoke(scope, tmp):
            with patch.object(self.m, 'Scope', return_value=scope):
                with self.assertRaises(self.m.RunnerError):
                    self.m.run('a'*20, True, transport=transport, scratch=tmp)
        import concurrent.futures
        with tempfile.TemporaryDirectory() as t1, tempfile.TemporaryDirectory() as t2:
            with concurrent.futures.ThreadPoolExecutor(1) as pool:
                owner = pool.submit(invoke, a, t1)
                self.assertTrue(owner_setup.wait(2))
                invoke(b, t2)
                contender_finished.set()
                owner.result()
        self.assertEqual(sum(s.startswith('/* cleanup */') for s in calls), 1)

    def test_cleanup_transport_failure_cannot_report_success(self):
        scope = self.m.Scope()
        def transport(sql, timeout=40):
            if sql.startswith('/* setup */'): return [{'ready': scope.owner}]
            raise RuntimeError('SECRET')
        with tempfile.TemporaryDirectory() as tmp, patch.object(self.m, 'Scope', return_value=scope):
            with self.assertRaises(self.m.RunnerError) as ctx:
                self.m.run('a'*20, True, transport=transport, scratch=tmp)
            self.assertEqual(str(ctx.exception), 'CLEANUP_UNCONFIRMED_RECOVERY_REQUIRED')
            import json
            result = json.loads(next(Path(tmp).glob('*-result.json')).read_text())
            self.assertFalse(result['passed'])
            self.assertNotIn('cleanup_verified', result)
            self.assertTrue(list(Path(tmp).glob('*-cleanup.sql')))

    def test_optimized_interpreter_keeps_guards_and_setup(self):
        code = '''
import importlib.util, tempfile
s = importlib.util.spec_from_file_location('runner', %r)
m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
calls=[]
def transport(sql, timeout=40):
    calls.append(sql)
    if sql.startswith('/* reconcile */'): return [{'owned': False}]
    raise RuntimeError('SECRET')
with tempfile.TemporaryDirectory() as tmp:
    try: m.run('a'*20, True, transport=transport, scratch=tmp)
    except m.RunnerError: pass
if len(calls) != 2 or not calls[0].startswith('/* setup */'): raise SystemExit(9)
''' % str(PATH)
        env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
        result = subprocess.run([sys.executable, '-O', '-c', code], capture_output=True, text=True, env=env)
        self.assertEqual(result.returncode, 0, result.stderr)


class CoverageTests(unittest.TestCase):
    def setUp(self):
        self.m = load_runner()
        self.scope = self.m.Scope()

    def test_expiry_uses_customer_owned_targets_instrumented_real_sweep(self):
        sql = self.scope.expiry_sql()
        self.assertIn('alter function', sql)
        self.assertIn('runner_original_sweep', sql)
        self.assertIn('auth.uid()', sql)
        self.assertIn('txid_current()', sql)
        self.assertIn('pg_backend_pid()', sql)
        self.assertIn('pg_sleep(3)', sql)
        self.assertIn('create trigger test_expiry_overlap', sql)
        self.assertIn('pg_locks', sql)
        for actor, oid in ((7,4),(17,14)):
            attempt = self.scope.attempt_sql(actor, oid, 'customer_order', True)
            self.assertIn(f"customer_order('{self.scope.order(oid)}')", attempt)
            self.assertIn(self.scope.user(actor), attempt)
            self.assertNotIn('accept_order(', attempt)
        # Clone only: never install instrumentation into the public schema.
        self.assertNotIn('create function public.', sql)

    def rows(self):
        return [dict(pid=100+n, xid=str(1000+n), started_at='2026-01-01T00:00:00+00:00',
                     finished_at='2026-01-01T00:00:02+00:00', result={'order': {'status': 'cancelled', 'cancel_reason': 'queue_expired'}})
                for n in range(2)]

    def test_overlap_validation_is_explicit_and_checks_independent_transactions(self):
        rows = self.rows()
        self.m.validate_overlap(rows)
        for field in ('pid', 'xid'):
            changed = self.rows()
            changed[1][field] = changed[0][field]
            with self.assertRaises(self.m.RunnerError):
                self.m.validate_overlap(changed)
        rows[1]['started_at'] = '2026-01-01T00:00:03+00:00'
        with self.assertRaises(self.m.RunnerError):
            self.m.validate_overlap(rows)

    def test_sweep_evidence_must_match_both_jwts_and_transactions(self):
        rows = self.rows()
        actors = (self.scope.user(7), self.scope.user(17))
        markers = [dict(actor=actor, pid=row['pid'], xid=row['xid'],
                        entered_at=row['started_at'], exited_at=row['finished_at'])
                   for actor, row in zip(actors, rows)]
        self.m.validate_sweep(rows, actors, markers)
        for corrupt in (markers[:1], [markers[0], markers[0]],
                        [dict(markers[0], xid='foreign'), markers[1]],
                        [dict(markers[0], exited_at=None), markers[1]]):
            with self.assertRaises(self.m.RunnerError):
                self.m.validate_sweep(rows, actors, corrupt)

    def test_setup_and_extra_are_executed_under_optimization(self):
        # Run this same test under python -O as well: CLI transport is replaced,
        # never SQL business logic; fake responses exercise orchestration only.
        calls = []
        def transport(sql, timeout=40):
            calls.append(sql)
            if sql.startswith('/* setup */'):
                import re
                match = re.search(r"select '([0-9a-f-]+)' as ready", sql)
                return [{'ready': match[1]}]
            if sql.startswith('/* attempt */'):
                import re
                # Every pair's first actor wins, independently of thread order.
                winner = self.scope.user(4) in sql or (self.scope.user(6) in sql and self.scope.order(2) in sql)
                rows = self.rows()
                row = rows[0 if winner else 1]
                row['result'] = {'order': {'status': 'in_progress'}} if winner else {'error': {'code': 409}}
                return [row]
            if sql.startswith('/* cleanup */'): return [{'cleaned': True}]
            if sql.startswith('/* post */'): return [{'ns': None, 'fixtures': 0}]
            if sql.startswith('/* extra */'): raise RuntimeError('SECRET')
            raise RuntimeError('unexpected SECRET')
        with tempfile.TemporaryDirectory() as tmp, patch.object(self.m, 'Scope', return_value=self.scope):
            with self.assertRaises(self.m.RunnerError):
                self.m.run('a'*20, True, transport=transport, scratch=tmp)
        self.assertEqual(sum(s.startswith('/* setup */') for s in calls), 1)
        self.assertEqual(sum(s.startswith('/* attempt */') for s in calls), 4)
        self.assertEqual(sum(s.startswith('/* extra */') for s in calls), 1)
        self.assertEqual(sum(s.startswith('/* cleanup */') for s in calls), 1)


if __name__ == '__main__':
    unittest.main()
