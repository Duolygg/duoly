import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const path = 'supabase/migrations/20261118110000_sql_efficiency.sql';
const functions = [
  [
    'admin_orders_page(p_limit integer DEFAULT 200, p_offset integer DEFAULT 0)',
    'jsonb',
    'plpgsql',
    '2d3cc10d9e3bdcf89a9602e829b6998a3d3bdc86d411e390d9e4a77a51c990dd',
  ],
  [
    'customer_favorite_slugs()',
    'jsonb',
    'sql',
    'e9310913887b227836c16c8d4b101377f91a52969d08614a8e2b332cbed7d3d5',
  ],
  [
    'public_teammate_indexable()',
    'jsonb',
    'sql',
    '81d6a3c3b269cf0bbc47d3c2ae531a60c56255a3ec77321f3266319d2fd2f228',
  ],
  [
    'admin_accounts()',
    'jsonb',
    'plpgsql',
    '68750a5e45d5b98c99bd210d8ae1d03f54902d862c4d449f682a6f99f1f2c789',
  ],
  [
    'loyalty_valid_count(p_customer uuid, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)',
    'bigint',
    'sql',
    'c1daf3f9b729ac6527a9b2225aeea701cdccd393948a8c9fbfc62e6913c9618d',
  ],
  [
    'admin_me()',
    'jsonb',
    'plpgsql',
    '2281555b0c2777847e5b8db6fe7a69a34b78ff0e8d287303688133233962cae7',
  ],
];

it('ships only the six audited functions with unchanged contracts and exact proposal bytes', () => {
  expect(existsSync(path)).toBe(true);
  const sql = readFileSync(path, 'utf8');
  const statements =
    sql.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$\s*;/g) ?? [];
  expect(statements).toHaveLength(functions.length);
  for (const [
    index,
    [signature, returns, language, digest],
  ] of functions.entries()) {
    const statement = statements[index] ?? '';
    expect(statement).toContain(
      `CREATE OR REPLACE FUNCTION public.${signature}\n RETURNS ${returns}\n LANGUAGE ${language}\n STABLE SECURITY DEFINER\n SET search_path TO ''\nAS $function$`,
    );
    // Hashes pin the reviewed proposal statements, not reformatted copies.
    expect(createHash('sha256').update(statement).digest('hex')).toBe(digest);
  }
  expect(sql).not.toMatch(/\b(?:grant|revoke|alter|drop)\b/i);
  expect(sql).not.toMatch(/CREATE(?: OR REPLACE)? (?:POLICY|TABLE|INDEX)/i);
});
