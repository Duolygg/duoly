import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = 'supabase/tests/';
describe('SQL test isolation', () => {
  it('rejects remote arguments and ambient libpq targets before connecting', () => {
    for (const args of [
      ['--linked'],
      ['postgresql://remote/db'],
      ['--project-ref', 'omnejesspybaxuacjlah'],
      [],
    ]) {
      const result = spawnSync(
        process.execPath,
        ['scripts/sql-tests/run.mjs', ...args],
        {
          encoding: 'utf8',
          env: { ...process.env, PGHOST: 'remote.invalid' },
        },
      );
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Refusing connection overrides');
    }
  });
  it('emits the canonical guard before every historical builder migration body', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'sql-guard-'));
    try {
      for (const file of readdirSync(dir).filter((f) =>
        /^build_.*\.py$/.test(f),
      )) {
        const output = path.join(temp, 'composed.sql');
        execFileSync('python3', [dir + file, output]);
        expect(
          readFileSync(output, 'utf8').startsWith(
            readFileSync('scripts/sql-tests/guard.sql', 'utf8'),
          ),
          file,
        ).toBe(true);
      }
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
  it('guards every SQL file before any statement or role change', () => {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
      const sql = readFileSync(dir + file, 'utf8');
      expect(sql.startsWith('do $duoly_test_guard$'), file).toBe(true);
      expect(
        sql.slice(0, sql.indexOf('$duoly_test_guard$;', 30)),
        file,
      ).toContain('refusing to run tests on production');
    }
  });
  it('classifies every executable test file exactly once', () => {
    const manifest = readFileSync(dir + 'ci-manifest.txt', 'utf8');
    for (const file of readdirSync(dir).filter((f) =>
      /\.(sql|py|[cm]?js)$/.test(f),
    )) {
      expect(
        manifest.split(/\s+/).filter((word) => word === file),
        file,
      ).toHaveLength(1);
    }
  });
});
