import { describe, expect, it } from 'vitest';
import {
  ADJ_DURATIONS,
  ADJ_TIERS,
  AdminPriorityCommandSchema,
  PRIORITY_RULES,
  signed,
  tierById,
  tierByPoints,
} from '../../src/contracts/priority';

const id = '6f1d2c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const csrf = 'csrf-token';

describe('priority tiers (original lib/prioTiers.js)', () => {
  it('keeps the six original tiers and three durations', () => {
    expect(ADJ_TIERS.map((t) => [t.id, t.points])).toEqual([
      ['small', 10],
      ['buff', 20],
      ['bigbuff', 35],
      ['nerf', -10],
      ['bignerf', -20],
      ['heavy', -35],
    ]);
    expect(ADJ_DURATIONS.map((d) => d.id)).toEqual(['1d', '7d', 'perm']);
    expect(ADJ_DURATIONS.find((d) => d.id === 'perm')?.ms).toBe(0);
  });
  it('maps points back to a unique tier (the database only stores points)', () => {
    for (const t of ADJ_TIERS) expect(tierByPoints(t.points)?.id).toBe(t.id);
    expect(tierByPoints(15)).toBeNull();
    expect(tierById('buff')?.points).toBe(20);
    expect(tierById('nope')).toBeNull();
  });
  it('formats signed points like the original', () => {
    expect(signed(20)).toBe('+20');
    expect(signed(-10)).toBe('−10');
    expect(signed(0)).toBe('±0');
  });
  it('keeps the original fixed rules', () => {
    expect(PRIORITY_RULES).toEqual({
      default: 50,
      perMiss: 10,
      cap: 50,
      days: 7,
      missVisibleSec: 60,
    });
  });
});

describe('admin priority commands', () => {
  it('accepts every action of the original POST', () => {
    for (const body of [
      { action: 'set', prio: 0 },
      { action: 'set', prio: 100 },
      { action: 'reset' },
      { action: 'adjust', tier: 'buff', duration: '7d' },
      {
        action: 'adjust',
        tier: 'heavy',
        duration: 'perm',
        reason: 'late to lobbies',
      },
      { action: 'clearAdjust' },
      { action: 'forgive' },
    ])
      expect(
        AdminPriorityCommandSchema.safeParse({ csrf, userId: id, ...body })
          .success,
        JSON.stringify(body),
      ).toBe(true);
  });
  it('rejects out of range base, unknown tiers and durations', () => {
    for (const body of [
      { action: 'set', prio: 101 },
      { action: 'set', prio: -1 },
      { action: 'set', prio: 30.5 },
      { action: 'set', prio: '30' },
      { action: 'adjust', tier: 'huge', duration: '7d' },
      { action: 'adjust', tier: 'buff', duration: '30d' },
      { action: 'nothing' },
    ])
      expect(
        AdminPriorityCommandSchema.safeParse({ csrf, userId: id, ...body })
          .success,
        JSON.stringify(body),
      ).toBe(false);
  });
  it('rejects extra fields and long reasons', () => {
    expect(
      AdminPriorityCommandSchema.safeParse({
        csrf,
        userId: id,
        action: 'reset',
        admin: true,
      }).success,
    ).toBe(false);
    expect(
      AdminPriorityCommandSchema.safeParse({
        csrf,
        userId: id,
        action: 'adjust',
        tier: 'buff',
        duration: '1d',
        reason: 'x'.repeat(141),
      }).success,
    ).toBe(false);
  });
});
