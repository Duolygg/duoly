import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(process.cwd(), 'supabase/migrations');

// The newest migration that redefines public_teammate_profile decides what production serves.
const latest = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) =>
    /create or replace function public\.public_teammate_profile\(/.test(
      readFileSync(join(dir, f), 'utf8'),
    ),
  )
  .at(-1)!;
const sql = readFileSync(join(dir, latest), 'utf8');

describe('latest public_teammate_profile definition', () => {
  it('keeps teammates’ own uploaded photos', () => {
    expect(sql).toContain('storage/v1/object/public/avatars/');
    expect(sql).toContain("|| pr.id::text || '/[0-9a-f]{16}");
  });
  it('serves the header field', () => {
    expect(sql).toContain("'header',p.header_image");
  });
});
