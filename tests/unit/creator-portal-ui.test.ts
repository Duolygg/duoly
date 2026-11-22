import { describe, expect, it } from 'vitest';
import {
  ORDER_STATES,
  RANGE_LABELS,
  dayLabel,
  eur,
  monthLabel,
} from '../../src/components/site/CreatorPortal.jsx';
import { applicationRow } from '../../src/components/admin/Creators.jsx';
import {
  CREATOR_RANGES,
  creatorPayoutProgress,
  nextCreatorTier,
} from '../../src/contracts/creator-portal';

describe('creator dashboard formatting', () => {
  it('shows euro amounts from integer cents', () => {
    expect(eur(0)).toBe('€0.00');
    expect(eur(271)).toBe('€2.71');
    expect(eur(123456)).toBe('€1,234.56');
    expect(eur(undefined)).toBe('€0.00');
  });
  it('names every order state the database can send', () => {
    expect(Object.keys(ORDER_STATES).sort()).toEqual([
      'available',
      'cancelled',
      'open',
      'paid',
      'pending',
      'reversed',
    ]);
    expect(ORDER_STATES.available).toBe('Available');
    expect(ORDER_STATES.open).toBe('Not finished yet');
  });
  it('labels every range the contract offers', () => {
    expect(Object.keys(RANGE_LABELS)).toEqual([...CREATOR_RANGES]);
  });
  it('reads months and days the way the rest of the site does', () => {
    expect(monthLabel('2026-11')).toBe('November 2026');
    expect(monthLabel('')).toBe('');
    expect(dayLabel(Date.UTC(2026, 10, 17, 12))).toContain('2026');
    expect(dayLabel(null)).toBe('');
  });
  it('builds the two progress bars from the shared rules', () => {
    expect(creatorPayoutProgress(2500).percent).toBe(50);
    expect(nextCreatorTier(10)).toMatchObject({ name: 'Partner', at: 25 });
  });
});

describe('admin application rows', () => {
  it('keeps the open ones apart and reads both time shapes', () => {
    const open = applicationRow({
      id: 'a1',
      code: 'ALEX10',
      status: 'applied',
      createdAt: 1763000000000,
      decidedAt: null,
    });
    expect(open.open).toBe(true);
    expect(open.createdAt).toBe(1763000000000);
    expect(open.decidedAt).toBeNull();
    const decided = applicationRow({
      id: 'a2',
      code: 'BETA',
      status: 'rejected',
      createdAt: '2026-11-01T10:00:00Z',
      decidedAt: 1763100000000,
      reason: 'No gaming content yet.',
    });
    expect(decided.open).toBe(false);
    expect(decided.createdAt).toBe(Date.parse('2026-11-01T10:00:00Z'));
    expect(decided.decidedAt).toBe(1763100000000);
    expect(decided.reason).toBe('No gaming content yet.');
  });
});
