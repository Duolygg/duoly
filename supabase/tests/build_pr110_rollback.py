#!/usr/bin/env python3
"""Build one rollback-only transaction for the five PR110 migrations and SQL checks."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[2]
guard = (root / 'scripts/sql-tests/guard.sql').read_text()
names = [
    '20261029130000_social_sessions.sql',
    '20261030100000_home_teammates.sql',
    '20261030120000_performance_ranking.sql',
    '20261030140000_duo_tiers.sql',
    '20261030150000_performance_role_identity.sql',
]
if '--before-identity' in sys.argv:
    names.pop()

def body(path):
    text = path.read_text()
    # Only outer, standalone transaction statements. Never strip PL/pgSQL BEGIN blocks.
    text, starts = re.subn(r'^begin;\s*$', '', text, count=1, flags=re.M | re.I)
    text, ends = re.subn(r'^(?:commit|rollback);\s*$', '', text, count=1, flags=re.M | re.I)
    assert starts == ends == 1, path
    return text

test_name = sys.argv[sys.argv.index('--test') + 1] if '--test' in sys.argv else 'pr110.sql'
allowed = {'pr110.sql', 'perks.sql', 'priority_admin.sql', 'gold_priority_badges.sql', 'handover_admin_actions.sql', 'discord_links.sql', 'discord_role_sync.sql'}
assert test_name in allowed, 'Choose an allowlisted rollback test'
parts = [body(root / 'supabase/migrations' / name) for name in names]
parts.append(body(root / 'supabase/tests' / test_name))
Path(sys.argv[1]).write_text(guard + 'begin;\nset local statement_timeout = \'120s\';\n' + '\n'.join(parts) + '\nrollback;\n')
