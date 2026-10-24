import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AdminCancelOrderSchema,
  AdminCreateHandoverSchema,
  AdminRefundOrderSchema,
} from '../../src/contracts/admin';
import {
  handoverTokenHash,
  handoverUrl,
} from '../../src/server/orders/handover';

const migration = readFileSync(
  new URL(
    '../../supabase/migrations/20261024170000_handover_admin_actions.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('handover and admin action contracts', () => {
  const orderId = '6f1d2c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

  it('accepts only strict admin commands with reasons where money changes', () => {
    expect(
      AdminCreateHandoverSchema.safeParse({
        csrf: 'csrf',
        action: 'handover',
        orderId,
      }).success,
    ).toBe(true);
    expect(
      AdminCancelOrderSchema.safeParse({
        csrf: 'csrf',
        action: 'cancel',
        orderId,
        reason: 'Customer asked us to cancel.',
      }).success,
    ).toBe(true);
    expect(
      AdminRefundOrderSchema.safeParse({
        csrf: 'csrf',
        action: 'refund',
        orderId,
        reason: 'Teammate left the session.',
      }).success,
    ).toBe(true);
    expect(
      AdminRefundOrderSchema.safeParse({
        csrf: 'csrf',
        action: 'refund',
        orderId,
        reason: ' ',
      }).success,
    ).toBe(false);
    expect(
      AdminCancelOrderSchema.safeParse({
        csrf: 'csrf',
        action: 'cancel',
        orderId,
        reason: 'x',
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('hashes claim tokens before they reach the database and builds encoded links', async () => {
    const token = 'AbCdEfghijklmnopqrstuvwx';
    expect(await handoverTokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(await handoverTokenHash(token)).not.toContain(token);
    expect(handoverUrl('https://duoly.gg/', token)).toBe(
      'https://duoly.gg/claim/AbCdEfghijklmnopqrstuvwx',
    );
  });
});

describe('handover migration security and lifecycle', () => {
  it('stores only token hashes and expires links at the queue deadline', () => {
    expect(migration).toContain('token_hash text not null unique');
    expect(migration).not.toMatch(/\btoken text\b/);
    expect(migration).toContain("v_order.queued_at + interval '5 minutes'");
    expect(migration).toContain('returning expires_at into v_expires');
  });

  it('keeps game, Gamer Girl, Discord and suspension checks while bypassing priority and reroll exclusion', () => {
    const claim =
      migration.split('create function public.accept_handover(')[1] ?? '';
    expect(claim).toContain("r.role = 'teammate'");
    expect(claim).toContain('not a.suspended');
    expect(claim).toContain('a.discord_id is not null');
    expect(claim).toContain('a.discord_verified_at is not null');
    expect(claim).toContain('a.gg_access and v_order.gg');
    expect(claim).toContain('v_order.game = any(a.approved_games)');
    expect(claim).not.toContain('priority_base');
    expect(claim).not.toContain("end_reason = 'customer_reroll'");
  });

  it('revokes active links on accept, cancellation and reroll and audits admin commands', () => {
    expect(migration).toContain("new.status <> 'queued'");
    expect(migration).toContain('new.queued_at is distinct from old.queued_at');
    expect(migration).toContain(
      "perform public.admin_log(v_actor, v_actor_name, 'Created handover link'",
    );
    expect(migration).toContain(
      "perform public.admin_log(v_actor, v_actor_name, 'Cancelled order'",
    );
    expect(migration).toContain(
      "perform public.admin_log(v_actor, v_actor_name, 'Refunded order'",
    );
  });
});
