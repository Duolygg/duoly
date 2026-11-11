import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const dir = 'supabase/tests/';
describe('SQL test isolation', () => {
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
      /\.(sql|py|mjs|cjs)$/.test(f),
    )) {
      expect(
        manifest.split(/\s+/).filter((word) => word === file),
        file,
      ).toHaveLength(1);
    }
  });
});
