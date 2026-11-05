import { describe, expect, it } from 'vitest';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';
import { GAME_IDS } from '../../src/design-reference/lib/games.js';
import { rankPrice, ranksOf } from '../../src/design-reference/lib/ranks.js';
import { serversFor } from '../../src/design-reference/lib/servers.js';
import {
  calculateQuote,
  parseQuoteInput,
} from '../../src/server/pricing/index';

const selection = {
  gameId: 'lol',
  serviceId: 'duo2',
  units: 1,
  server: 'EUW',
  rank: 'Platinum',
};
const trusted = { eurToUsd: 1.08 };

describe('server-owned quote preview', () => {
  it.each([
    'total',
    'amount',
    'amountEurMinor',
    'currency',
    'eurToUsd',
    'payout',
    'firstCoachingSessionEligible',
    'title',
    'cat',
  ])('rejects client-controlled %s', (key) => {
    expect(() => parseQuoteInput({ ...selection, [key]: 0.01 })).toThrow();
    expect(() =>
      calculateQuote({ ...selection, [key]: 0.01 }, trusted),
    ).toThrow();
  });

  it.each([
    { gameId: 'unknown' },
    { gameId: '__proto__' },
    { serviceId: 'nope' },
    { gameId: 'lol ', serviceId: 'duo2' },
    { serviceId: 'constructor' },
    ...[0, -1, 11, 1.5, '3', null, NaN, Infinity].map((units) => ({ units })),
    { server: 'EU' },
    { server: 'EUW ' },
    { server: null },
    { rank: 'Gladiator' },
    { rank: undefined },
    { rank: '' },
    { ign: 'x' },
    { ign: 'x'.repeat(41) },
    { ign: 12 },
    { edition: 'Java' },
  ])('fails closed on invalid selection %j', (patch) => {
    expect(() => parseQuoteInput({ ...selection, ...patch })).toThrow();
  });

  it('does not require an IGN for a price preview', () => {
    expect(parseQuoteInput(selection)).toEqual(selection);
    expect(parseQuoteInput({ ...selection, ign: 'xy' }).ign).toBe('xy');
    expect(
      parseQuoteInput({ ...selection, ign: 'x'.repeat(40) }).ign,
    ).toHaveLength(40);
  });

  it.each(['Java', 'Bedrock'] as const)(
    'accepts Minecraft free-text server with %s edition',
    (edition) => {
      const input = {
        gameId: 'mc',
        serviceId: 'duo2',
        units: 1,
        server: 'my own world',
        edition,
      };
      expect(calculateQuote(input, trusted).amountEurMinor).toBe(1299);
    },
  );

  it.each([
    { server: '' },
    { server: 'x' },
    { server: ' '.repeat(3) },
    { edition: undefined },
    { edition: 'java' },
    { edition: 'Other' },
  ])('rejects invalid Minecraft selection %j', (patch) => {
    expect(() =>
      parseQuoteInput({
        gameId: 'mc',
        serviceId: 'duo2',
        units: 1,
        server: 'Hypixel',
        edition: 'Java',
        ...patch,
      }),
    ).toThrow();
  });

  for (const gameId of GAME_IDS) {
    for (const service of servicesFor(gameId).modes.filter(
      (mode: { cat: string; id: string }) =>
        mode.cat !== 'other' &&
        !(mode.cat === 'training' && mode.id === 'learn'),
    )) {
      const ranks = ranksOf(gameId, service.id);
      for (const rank of ranks.length ? ranks : [undefined]) {
        it(`preserves source rank rounding: ${gameId}/${service.id}/${rank ?? 'flat'}`, () => {
          const input = {
            gameId,
            serviceId: service.id,
            units: 1,
            server: gameId === 'mc' ? 'Hypixel' : serversFor(gameId)[0]![0],
            ...(gameId === 'mc' ? { edition: 'Java' } : {}),
            ...(rank ? { rank } : {}),
          };
          const quote = calculateQuote(input, trusted);
          expect(quote.unitPriceEurMinor).toBe(
            Math.round(
              rankPrice(gameId, service.id, service.price, rank) * 100,
            ),
          );
          expect(quote.unit).toBe(service.unit);
          expect(() =>
            parseQuoteInput({ ...input, rank: 'not-a-rank' }),
          ).toThrow();
        });
      }
    }
  }

  for (const gameId of GAME_IDS) {
    for (const service of servicesFor(gameId).modes.filter(
      (mode: { cat: string; id: string }) => mode.cat === 'other',
    )) {
      it(`does not sell unsupported Teams service ${gameId}/${service.id}`, () => {
        const input = {
          gameId,
          serviceId: service.id,
          units: 1,
          server: gameId === 'mc' ? 'Hypixel' : serversFor(gameId)[0]![0],
          ...(gameId === 'mc' ? { edition: 'Java' } : {}),
          ...(ranksOf(gameId, service.id).length
            ? { rank: ranksOf(gameId, service.id)[0] }
            : {}),
        };
        expect(() => calculateQuote(input, trusted)).toThrow('Teams');
        expect(() => parseQuoteInput(input)).toThrow('Teams');
      });
    }
  }

  it.each([
    [1, 0, 399],
    [2, 0, 798],
    [3, 10, 1077],
    [4, 0, 1596],
    [5, 15, 1696],
    [6, 0, 2394],
    [7, 0, 2793],
    [8, 0, 3192],
    [9, 0, 3591],
    [10, 25, 2993],
  ])(
    'prices %i units with only exact source quantity tiers',
    (units, percent, expected) => {
      const quote = calculateQuote({ ...selection, units }, trusted);
      expect(quote.amountEurMinor).toBe(expected);
      expect(quote.quantityDiscountPercent).toBe(percent);
      expect(quote.subtotalEurMinor - quote.discountEurMinor).toBe(expected);
    },
  );

  for (const gameId of GAME_IDS) {
    for (const service of servicesFor(gameId).modes.filter(
      (mode: { cat: string; id: string }) => mode.cat === 'training',
    )) {
      it(`excludes coaching from quantity discounts: ${gameId}/${service.id}`, () => {
        const input = {
          gameId,
          serviceId: service.id,
          units: 10,
          server: gameId === 'mc' ? 'Hypixel' : serversFor(gameId)[0]![0],
          ...(gameId === 'mc' ? { edition: 'Java' } : {}),
        };
        const fullPrice = Math.round((service.was ?? service.price) * 100);
        for (const context of [
          trusted,
          { ...trusted, firstCoachingSessionEligible: false },
        ]) {
          const quote = calculateQuote(input, context);
          expect(quote.amountEurMinor).toBe(fullPrice * 10);
          expect(quote.quantityDiscountPercent).toBe(0);
        }
        const eligible = calculateQuote(input, {
          ...trusted,
          firstCoachingSessionEligible: true,
        });
        const promotionalPrice = service.was
          ? Math.round(service.price * 100)
          : fullPrice;
        expect(eligible.amountEurMinor).toBe(fullPrice * 9 + promotionalPrice);
        expect(eligible.firstSessionDiscountEurMinor).toBe(
          fullPrice - promotionalPrice,
        );
        expect(eligible.discountEurMinor).toBe(0);
      });
    }
  }

  it.each([0, -1, NaN, Infinity, -Infinity, '1.08', null, undefined])(
    'rejects invalid trusted FX %s',
    (eurToUsd) => {
      expect(() => calculateQuote(selection, { eurToUsd } as never)).toThrow();
    },
  );

  it.each([
    { eurToUsd: 1.08, customerCurrency: 'GBP' },
    { eurToUsd: 1.08, firstCoachingSessionEligible: 'true' },
    null,
    undefined,
  ])('rejects malformed server context %j', (context) => {
    expect(() => calculateQuote(selection, context as never)).toThrow();
  });

  it.each([1.08, 1.123456, 0.75, 2.4])(
    'splits marked-up customer FX from mid-rate teammate FX at %s',
    (rate) => {
      const input = { ...selection, units: 3 };
      const eur = calculateQuote(input, { eurToUsd: rate });
      const usd = calculateQuote(input, {
        eurToUsd: rate,
        customerCurrency: 'USD',
      });
      const customerRate = Math.round(rate * 1.01 * 10000) / 10000;
      expect(usd.fx).toEqual({ eurToUsd: rate, customerUsdRate: customerRate });
      expect(usd.customer).toEqual({
        currency: 'USD',
        amountMinor: Math.round(1077 * customerRate),
      });
      expect(eur.customer).toEqual({ currency: 'EUR', amountMinor: 1077 });
      expect(usd.teammate).toEqual({
        currency: 'USD',
        amountMinor: Math.max(99, Math.round(1077 * 0.6 * rate) - 1),
      });
      expect(usd.teammate).toEqual(eur.teammate);
    },
  );

  it('keeps the source teammate payout minimum at low mid-rates', () => {
    expect(
      calculateQuote(selection, { eurToUsd: 0.01 }).teammate.amountMinor,
    ).toBe(99);
  });

  it.each([Number.MAX_VALUE, Number.MIN_VALUE, 1e20])(
    'fails closed on unrepresentable FX-derived money %s',
    (eurToUsd) => {
      expect(() =>
        calculateQuote(selection, { eurToUsd, customerCurrency: 'USD' }),
      ).toThrow();
    },
  );

  it('exposes a deeply frozen read-only preview', () => {
    const quote = calculateQuote(selection, trusted);
    for (const part of [
      quote,
      quote.selection,
      quote.customer,
      quote.teammate,
      quote.fx,
    ]) {
      expect(Object.isFrozen(part)).toBe(true);
    }
    expect(() => Object.assign(quote.customer, { amountMinor: 1 })).toThrow();
    expect(() => Object.assign(quote.selection, { units: 10 })).toThrow();
    expect(selection.units).toBe(1);
  });

  it.each([null, [], 'lol', 42, {}, { gameId: 'lol' }])(
    'rejects malformed body %j',
    (input) => {
      expect(() => parseQuoteInput(input)).toThrow();
    },
  );

  it('calculates the catalog EUR price without client money', () => {
    const quote = calculateQuote(parseQuoteInput(selection), trusted);
    expect(quote.amountEurMinor).toBe(399);
    expect(quote.kind).toBe('preview');
    expect(quote.customer).toEqual({ currency: 'EUR', amountMinor: 399 });
  });
});
