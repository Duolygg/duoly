import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { expect, it } from 'vitest';

// supabase-js rpc reads `this`: `const rpc = client.rpc; rpc('x')` throws before any request.
// That silently broke PRO, reviews and wallet checkout (they caught the error and gave up).
it('supabase-js rpc only works bound to its client', () => {
  const client = createClient('http://127.0.0.1:1', 'key');
  const detached = client.rpc;
  expect(() => detached('anything')).toThrow();
  expect(() => client.rpc.bind(client)('anything')).not.toThrow();
});

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx|js|jsx)$/.test(name) ? [path] : [];
  });

it('no source keeps a detached rpc to call later', () => {
  const offenders = files('src').flatMap((path) =>
    readFileSync(path, 'utf8')
      .split('\n')
      .map((line, i) => [line, i + 1] as const)
      // `x = client.rpc as …` or `=> client.rpc as …` stores the method without its client;
      // `(client.rpc as …)('fn')` calls it in place and keeps `this`, so it is fine
      .filter(([line]) => /(=|=>)\s*[\w.]+\.rpc\s+as\s/.test(line))
      .map(([, n]) => path + ':' + n),
  );
  expect(offenders).toEqual([]);
});
