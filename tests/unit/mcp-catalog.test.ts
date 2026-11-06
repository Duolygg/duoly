import { afterEach, expect, it, vi } from 'vitest';
import * as pricing from '../../src/server/pricing';
import { services, games } from '../../src/server/mcp/catalog';
afterEach(() => vi.restoreAllMocks());
it('derives bookability from the pricing parser so future Teams support is automatic', () => {
  const original = pricing.parseQuoteInput;
  vi.spyOn(pricing, 'parseQuoteInput').mockImplementation((input) => {
    const selection = input as Parameters<typeof pricing.calculateQuote>[0] & {
      gameId: string;
      serviceId: string;
      units: number;
      server: string;
    };
    if (selection.gameId === 'val' && selection.serviceId === 'stack')
      return selection;
    return original(input);
  });
  expect(services('val').some((s) => s.id === 'stack')).toBe(true);
  expect(games().some((g) => g.id === 'social')).toBe(false);
  for (const g of games())
    expect(services(g.id).filter((s) => s.category === 'gg')).toEqual([]);
});
