import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('GEO measurement harness', () => {
  it('passes dependency-free parser and consumer capture regression tests', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--test',
        'scripts/ai-panel/panel.test.mjs',
        'scripts/ai-panel/geo.test.mjs',
        'scripts/ai-panel/browser.test.mjs',
      ],
      { cwd: root, encoding: 'utf8' },
    );
    expect(output).toMatch(/fail 0/);
  });
});
