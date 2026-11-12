#!/usr/bin/env python3
"""Build the rollback-only M7 check: migration body plus test, then rollback."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[2]
guard = (root / 'scripts/sql-tests/guard.sql').read_text()
migration = (root / 'supabase/migrations/20261026110000_gold_priority_badges.sql').read_text()
test = (root / 'supabase/tests/gold_priority_badges.sql').read_text()
migration = migration.replace('begin;\n', '', 1)
migration = migration[: migration.rfind('\ncommit;')]
test = test.replace('begin;\n', '', 1)
test = test[: test.rfind('\nrollback;')]
Path(sys.argv[1]).write_text(guard + 'begin;\n' + migration + '\nsavepoint s;\n' + test + '\nrollback;\n')
