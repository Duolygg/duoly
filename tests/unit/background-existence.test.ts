import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { timerPorts } from '../../src/server/background/handlers';

describe('timer eligibility reads existence, not an exact count', () => {
  for (const size of [0, 1, 10000]) {
    it(`preserves analytics eligibility with ${size} matches`, async () => {
      let selected: unknown[] = [];
      let limit: number | undefined;
      const result = {
        is() {
          return result;
        },
        or() {
          return result;
        },
        limit(n: number) {
          limit = n;
          return result;
        },
        then(resolve: (value: unknown) => void) {
          resolve({ data: size ? [{ id: 'one' }] : [], error: null });
        },
      };
      const db = {
        from(table: string) {
          expect(table).toBe('analytics_outbox');
          return {
            select(...args: unknown[]) {
              selected = args;
              return result;
            },
          };
        },
      } as unknown as SupabaseClient;
      expect(await timerPorts(db, 'https://duoly.gg').eligibleAnalytics()).toBe(
        size > 0 ? 1 : 0,
      );
      expect(selected).toEqual(['id']);
      expect(limit).toBe(1);
    });
  }
  it('keeps the existing fail-open analytics policy', async () => {
    const chain = {
      select() {
        return chain;
      },
      is() {
        return chain;
      },
      or() {
        return chain;
      },
      limit() {
        return chain;
      },
      then(resolve: (value: unknown) => void) {
        resolve({ data: null, error: { message: 'unavailable' } });
      },
    };
    const db = { from: () => chain } as unknown as SupabaseClient;
    expect(await timerPorts(db, 'https://duoly.gg').eligibleAnalytics()).toBe(
      1,
    );
  });
});
