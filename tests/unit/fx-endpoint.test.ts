import { describe, expect, it } from 'vitest';
import { fxInfo, resetFxCache } from '../../src/server/fx';

describe('public FX snapshot', () => {
  it('returns mid and customer rates with provenance and age', async () => {
    resetFxCache();
    const now = Date.parse('2026-10-28T12:00:00Z');
    const fetcher = async () =>
      new Response(
        "<Cube time='2026-10-27'><Cube currency='USD' rate='1.1234'/></Cube>",
      );
    await expect(fxInfo(fetcher as typeof fetch, now)).resolves.toEqual({
      rate: 1.1234,
      customerRate: 1.1346,
      markup: 0.01,
      source: 'ecb',
      date: '2026-10-27',
      ageMs: 0,
      live: true,
      fallback: false,
    });
  });
});
