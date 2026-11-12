"""Legacy entrypoint: only the local, Docker-verified manifest runner may execute SQL."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
if len(sys.argv) != 1:
    sys.exit("Refusing project refs, credentials, file selections or remote targets; use local CI")
sys.exit(subprocess.call(['node', 'scripts/sql-tests/run.mjs'], cwd=ROOT))
