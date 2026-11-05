import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  selectCreatorCode,
  checkCreatorCode,
} from '../../src/server/creators/code';

describe('explicit creator codes', () => {
  it('keeps attribution in the existing idempotent paid-order trigger (schema contract)', () => {
    const sql = readFileSync(
      'supabase/migrations/20261025110000_creator_referrals.sql',
      'utf8',
    );
    expect(sql).toContain("new.status <> 'paid' or old.status = 'paid'");
    expect(sql).toContain('on conflict (customer_id) do nothing');
    expect(sql).toContain('on conflict (order_id) do nothing');
    expect(sql).toContain("v_ref.attributed_at + interval '12 months'");
    expect(sql).toContain('customer_id uuid primary key');
  });
  it.each(['unknown', 'inactive'])(
    'does not distinguish %s codes or disclose their display names',
    async () => {
      const rpc = vi.fn();
      const result = await checkCreatorCode(
        { rpc, name: async () => null },
        'customer',
        'ALPHA',
      );
      expect(result).toEqual({
        valid: false,
        displayName: null,
        discountPercent: 0,
        reason: 'That creator code is not available.',
      });
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it('rejects a previous order or an outstanding discounted intent through the existing rule', async () => {
    const result = await checkCreatorCode(
      {
        rpc: async () => ({ data: false, error: null }),
        name: async () => 'Alpha',
      },
      'customer',
      'ALPHA',
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('first order');
  });
  it('excludes streamer and free bookings before looking up creators', async () => {
    const rpc = vi.fn();
    const name = vi.fn();
    expect(
      (await checkCreatorCode({ rpc, name }, 'customer', 'ALPHA', true)).valid,
    ).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(name).not.toHaveBeenCalled();
  });
  it('fails closed on eligibility errors', async () => {
    const result = await checkCreatorCode(
      {
        rpc: async () => ({ data: true, error: 'unavailable' }),
        name: async () => 'Alpha',
      },
      'customer',
      'ALPHA',
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Try again');
  });
  it('typed code wins over the link without requiring consent and empty removes it', () => {
    expect(selectCreatorCode(' beta ', 'ALPHA')).toBe('BETA');
    expect(selectCreatorCode('', 'ALPHA')).toBeNull();
    expect(selectCreatorCode('bad code', 'ALPHA')).toBeNull();
    expect(selectCreatorCode(undefined, 'ALPHA')).toBe('ALPHA');
  });
  it('uses the existing database eligibility rule and only returns public display data', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const name = vi.fn().mockResolvedValue('Alpha');
    expect(
      await checkCreatorCode({ rpc, name }, 'customer', ' alpha '),
    ).toEqual({
      valid: true,
      displayName: 'Alpha',
      discountPercent: 10,
      reason: null,
    });
    expect(rpc).toHaveBeenCalledWith('referral_first_order_discount_eligible', {
      p_customer: 'customer',
      p_code: 'ALPHA',
    });
  });
});
