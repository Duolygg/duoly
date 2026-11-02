import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canTake, whyNot } from '../../src/design-reference/lib/access.js';
import { QueueSettingsResponseSchema } from '../../src/contracts/queue-settings';

// Gamer Girl access and approved comp games are independent (migration 20261102140000).
describe('Gamer Girl plus comp access', () => {
  const comp = { game: 'val', gg: false, title: 'Duo Pro' };
  const gg = { game: 'val', gg: true, title: 'Gamer Girl Duo' };
  const social = { game: 'social', gg: true, title: 'Gamer Girl Chat' };

  it('a Gamer Girl teammate approved for a game takes both kinds of order there', () => {
    const both = { games: ['val'], gg: true };
    expect(canTake(comp, both)).toBe(true);
    expect(canTake(gg, both)).toBe(true);
    expect(canTake(social, both)).toBe(true);
    // comp orders only in her approved games
    expect(canTake({ ...comp, game: 'lol' }, both)).toBe(false);
    expect(canTake({ ...gg, game: 'lol' }, both)).toBe(true);
  });

  it('keeps Gamer Girl only and comp only exactly as before', () => {
    expect(canTake(comp, { games: [], gg: true })).toBe(false);
    expect(canTake(gg, { games: [], gg: true })).toBe(true);
    expect(canTake(comp, { games: ['val'], gg: false })).toBe(true);
    expect(canTake(gg, { games: ['val'], gg: false })).toBe(false);
    expect(whyNot(gg, { games: ['val'], gg: false })).toBe(
      'Gamer Girl orders only go to Gamer Girl teammates.',
    );
    expect(whyNot(comp, { games: [], gg: true }, 'Valorant')).toContain(
      'not approved for Valorant',
    );
  });

  it('queue settings carry the comp games, or not yet', () => {
    const base = {
      allowed_games: ['val'],
      enabled_games: ['val'],
      gg_access: true,
      voice_opt_in: true,
    };
    expect(QueueSettingsResponseSchema.safeParse(base).success).toBe(true);
    expect(
      QueueSettingsResponseSchema.safeParse({
        ...base,
        approved_games: ['val'],
      }).success,
    ).toBe(true);
  });

  it('the migration drops the either/or rule from every access check', () => {
    const sql = readFileSync(
      'supabase/migrations/20261102140000_gg_plus_comp.sql',
      'utf8',
    );
    expect(sql).not.toMatch(/not [a-z_]+\.gg_access and not/);
    for (const fn of [
      'order_eligible',
      'order_expire_locked',
      'teammate_current_assignment',
      'order_proof_player',
      'order_chat_viewer',
      'handover_info',
      'accept_handover',
      'order_pick_candidate',
      'admin_set_access',
      'teammate_queue_settings',
    ])
      expect(sql).toContain('create or replace function public.' + fn + '(');
  });
});
