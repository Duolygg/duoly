import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const path = resolve('supabase/migrations/20261022140000_order_proofs.sql');
const migration = () => {
  expect(existsSync(path), 'private proof migration exists').toBe(true);
  return readFileSync(path, 'utf8')
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

describe('private proof safeguards (static only; NOT SQL acceptance)', () => {
  it('reserves idempotently under the order mutex with a fresh playing role and five slots', () => {
    const sql = migration();
    expect(sql).toContain(
      'create function public.begin_order_proof_upload(p_order_id uuid, p_assignment_id uuid, p_request_id uuid)',
    );
    const begin =
      sql.split('create function public.begin_order_proof_upload(')[1] ?? '';
    expect(begin).toContain('auth.uid()');
    expect(begin.indexOf('from public.orders')).toBeLessThan(
      begin.indexOf('from public.order_proof_uploads'),
    );
    expect(begin).toContain("state in ('pending','ready')");
    expect(begin).toContain('>= 5');
    expect(sql).toContain("r.role = 'teammate'");
    expect(sql).toContain('not a.suspended');
    expect(sql).toContain('a.discord_verified_at is not null');
    expect(sql).toContain(
      'grant execute on function public.begin_order_proof_upload(uuid,uuid,uuid) to authenticated',
    );
  });
  it('finalizes only a reserved current actor against real provider metadata, preserving a private digest', () => {
    const sql = migration();
    expect(sql).toContain(
      'create function public.finalize_order_proof_upload(p_proof_id uuid, p_mime text, p_byte_size integer, p_sha256 text)',
    );
    expect(sql).toContain('from storage.objects');
    expect(sql).toContain("metadata ->> 'size'");
    expect(sql).toContain("metadata ->> 'mimetype'");
    expect(sql).toContain('public.order_proof_player(v_order, v.uploader_id)');
    expect(sql).toContain("old.state = 'ready'");
    expect(sql).toContain('before update on public.order_proof_uploads');
    expect(sql).not.toContain('before delete on public.order_proof_uploads');
    expect(sql).toContain(
      'grant execute on function public.finalize_order_proof_upload(uuid,text,integer,text) to service_role',
    );
  });
  it('authorizes strict ready-only reads independently for historical owner/admin and current teammate', () => {
    const sql = migration();
    for (const name of [
      'list_order_proofs(p_order_id uuid)',
      'get_order_proof(p_order_id uuid, p_proof_id uuid)',
    ])
      expect(sql).toContain(`create function public.${name}`);
    expect(sql).toContain("raise sqlstate 'pt404'");
    expect(sql).toContain("r.role = 'admin'");
    expect(sql).toContain("r.role = 'customer'");
    expect(sql).toContain("p.state = 'ready'");
    expect(sql).toContain('p.assignment_id = v_order.current_assignment_id');
    expect(sql).toContain('p.order_id = p_order_id and p.id = p_proof_id');
    const dto =
      sql
        .split('create function public.order_proof_dto(')[1]
        ?.split('$$;')[0] ?? '';
    for (const field of [
      "'uploader_id'",
      "'storage_key'",
      "'sha256'",
      "'request_id'",
    ])
      expect(dto).not.toContain(field);
  });
  it('abandons only pending work and claims bounded stale rows in stable order-before-proof lock order', () => {
    const sql = migration();
    expect(sql).toContain(
      'create function public.abandon_order_proof_upload(p_proof_id uuid)',
    );
    expect(sql).toContain(
      'create function public.claim_stale_order_proof_uploads(p_limit integer default 100)',
    );
    expect(sql).toContain('p_limit not between 1 and 500');
    expect(sql).toContain("interval '1 hour'");
    expect(sql).toContain('order by o.id');
    expect(sql).toContain('order by p.id');
    expect(sql).toContain('for update skip locked');
    expect(sql).toContain(
      'after update of ended_at on public.order_assignments',
    );
    expect(sql).toContain("where assignment_id = new.id and state = 'pending'");
    expect(sql).toContain("if v.state = 'ready' then");
    expect(sql).toContain("jsonb_build_object('abandoned',false)");
    expect(sql).toContain(
      'grant execute on function public.abandon_order_proof_upload(uuid), public.claim_stale_order_proof_uploads(integer) to service_role',
    );
  });
  it('ships rollback-only role-switched acceptance assertions with hostile storage policies and no claimed SQL execution', () => {
    const file = resolve('supabase/tests/order_proofs.sql');
    expect(existsSync(file), 'SQL acceptance fixture exists').toBe(true);
    const sql = readFileSync(file, 'utf8')
      .replace(/--[^\n]*/g, '')
      .toLowerCase();
    expect(sql.trim()).toMatch(/^begin;/);
    expect(sql.trim()).toMatch(/rollback;$/);
    for (const role of ['anon', 'authenticated', 'service_role'])
      expect(sql).toContain(`set local role ${role}`);
    for (const token of [
      'fixture collision',
      'when insufficient_privilege',
      "when sqlstate 'pt409'",
      "when sqlstate 'pt404'",
      'has_table_privilege',
      'has_function_privilege',
      'create policy proof_test_permissive',
      'reroll_order',
      'claim_stale_order_proof_uploads',
      'raw_user_meta_data',
    ])
      expect(sql).toContain(token);
    expect(sql).not.toMatch(/\bcommit\s*;/);
  });
  it('keeps metadata private and bucket isolated even under permissive storage policies', () => {
    const sql = migration();
    expect(sql).toContain(
      'alter table public.order_proof_uploads enable row level security',
    );
    expect(sql).toContain(
      'revoke all on table public.order_proof_uploads from public, anon, authenticated, service_role',
    );
    expect(sql).toContain('foreign key (assignment_id, order_id, uploader_id)');
    expect(sql).toContain(
      'references public.order_assignments(id, order_id, teammate_id)',
    );
    expect(sql).toContain('unique (assignment_id, request_id)');
    expect(sql).toContain('as restrictive for all to anon, authenticated');
    expect(sql).toContain("bucket_id <> 'order-proof'");
    expect(sql).toContain('1572864');
    for (const mime of ['image/png', 'image/jpeg', 'image/webp'])
      expect(sql).toContain(mime);
    expect(sql).not.toMatch(/grant[^;]*on table public\.order_proof_uploads/);
    expect(sql).not.toMatch(
      /raw_user_meta_data|raw_app_meta_data|alter publication|create publication/,
    );
  });
});
