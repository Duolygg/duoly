"""Compose the tentative migration + SQL tests into ONE rollback-only transaction.
No persistent hosted schema/fixture writes, no sequence defaults in fixtures.
Usage: python3 supabase/tests/completion_run.py [completion_happy.sql ...]
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SCRATCH = Path.home() / '.hermes/cache/scratch'
MIGRATION = ROOT / 'supabase/migrations/20261024130000_order_completion.sql'
parts = ['begin; set local lock_timeout=\'5s\'; set local statement_timeout=\'120s\';']
if MIGRATION.exists():
    parts.append(re.sub(r'^\s*(begin|commit);\s*$', '', MIGRATION.read_text(), flags=re.M | re.I))
parts.append((ROOT / 'supabase/tests/completion_fixture.sql').read_text())
suites = sys.argv[1:] or [
    'completion_happy.sql', 'completion_replay.sql', 'completion_immutable.sql',
    'completion_chat.sql', 'completion_history.sql', 'completion_tiers.sql',
    'completion_tier_integration.sql', 'completion_security.sql',
    'completion_integrity.sql', 'completion_constraints.sql', 'completion_history_order.sql',
]
for name in suites:
    assert Path(name).name == name and name.startswith('completion')
    parts.append((ROOT / 'supabase/tests' / name).read_text())
parts.append("rollback; select to_regclass('public.teammate_earning_entries') is null as migration_rolled_back;")
SCRATCH.mkdir(parents=True, exist_ok=True)
path = SCRATCH / 'completion-rollback.sql'
path.write_text('\n'.join(parts))
env = dict(os.environ)
env['PATH'] = str(Path.home() / '.hermes/tools/node-v24.21.0-darwin-arm64/bin') + ':' + env['PATH']
p = subprocess.run([str(ROOT / 'node_modules/.bin/supabase'), 'db', 'query', '--linked', '--project-ref', 'omnejesspybaxuacjlah', '--file', str(path), '--output-format', 'json'], cwd=ROOT, env=env, text=True, capture_output=True)
print(p.stdout)
if p.returncode:
    print(p.stderr, file=sys.stderr)
    sys.exit(p.returncode)
d = json.loads(p.stdout)
rows = d if isinstance(d, list) else d['rows']
assert rows == [{'migration_rolled_back': True}], rows
print(f'PASS: {len(suites)} real hosted PostgreSQL suites; migration + fixtures rolled back')
