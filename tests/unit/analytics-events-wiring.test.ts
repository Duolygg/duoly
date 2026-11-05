import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENT_CATALOGUE } from '../../src/contracts/analytics-events';

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? files(path)
      : /\.(astro|[jt]sx?)$/.test(path)
        ? [path]
        : [];
  });
}

// No server-provided open-intent age exists in the homepage props or API.
const skips = {
  checkout_abandon_detected:
    'No existing server signal for an open intent older than 15 minutes.',
};
const live = [...files('src/components'), ...files('src/pages')];
const calls = live.flatMap((file) =>
  [...readFileSync(file, 'utf8').matchAll(/\btrack\(\s*['"]([^'"]+)['"]/g)].map(
    (match) => ({ file, name: match[1]! }),
  ),
);

describe('live browser event wiring', () => {
  it('uses only catalogued event names', () => {
    for (const call of calls)
      expect(EVENT_CATALOGUE, call.file).toHaveProperty(call.name);
  });
  it('wires every browser catalogue event except documented skips', () => {
    for (const name of Object.keys(EVENT_CATALOGUE)) {
      if (name in skips) continue;
      expect(
        calls.some((call) => call.name === name),
        name,
      ).toBe(true);
    }
  });
  it('never instruments design references', () => {
    for (const file of files('src/design-reference'))
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\btrack\s*\(/);
  });
});
