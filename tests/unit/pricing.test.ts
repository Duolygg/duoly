import { describe, expect, it } from 'vitest';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';
import { GAME_IDS } from '../../src/design-reference/lib/games.js';
import { rankPrice, ranksOf } from '../../src/design-reference/lib/ranks.js';
import { serversFor } from '../../src/design-reference/lib/servers.js';
import {
  calculateQuote,
  parseQuoteInput,
} from '../../src/server/pricing/index';
import { seatRule } from '../../src/contracts/seats';

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

  // Team orders (docs/product/team-orders.md): every Teams service is sold by seat.
  for (const gameId of GAME_IDS) {
    for (const service of servicesFor(gameId).modes.filter(
      (mode: { cat: string; id: string }) => mode.cat === 'other',
    )) {
      it(`sells Teams service ${gameId}/${service.id} by seat`, () => {
        const rule = seatRule(gameId, service.id);
        expect(rule.max).toBeGreaterThan(1);
        const rank = ranksOf(gameId, service.id)[0];
        const input = {
          gameId,
          serviceId: service.id,
          units: 1,
          server: gameId === 'mc' ? 'Hypixel' : serversFor(gameId)[0]![0],
          ...(gameId === 'mc' ? { edition: 'Java' } : {}),
          ...(rank ? { rank } : {}),
          seats: rule.default,
        };
        const quote = calculateQuote(input, trusted);
        const seatCents = Math.round(
          rankPrice(gameId, service.id, service.price, rank) * 100,
        );
        expect(quote.seats).toBe(rule.default);
        // The group price is the listed price; everything else is per seat.
        expect(quote.amountEurMinor).toBe(
          rule.groupPrice ? seatCents : seatCents * rule.default,
        );
        // Each teammate earns 60% of one seat's share.
        expect(quote.teammate.amountMinor).toBe(
          Math.max(
            99,
            Math.round(
              Math.floor(quote.amountEurMinor / rule.default) * 0.6 * 1.08,
            ) - 1,
          ),
        );
        expect(() =>
          calculateQuote({ ...input, seats: rule.max + 1 }, trusted),
        ).toThrow('seat');
        if (rule.min > 1)
          expect(() =>
            calculateQuote({ ...input, seats: rule.min - 1 }, trusted),
          ).toThrow('seat');
      });
    }
  }

  it('prices Flex Squad per seat with the 5-game discount on the whole team', () => {
    const seat = Math.round(rankPrice('lol', 'flex', 7.99, 'Gold') * 100);
    const quote = calculateQuote(
      {
        gameId: 'lol',
        serviceId: 'flex',
        units: 5,
        server: 'EUW',
        rank: 'Gold',
        seats: 3,
      },
      trusted,
    );
    // seat price × 3 seats × 5 games, minus the 20% five-game discount on the whole team
    expect(quote.unitPriceEurMinor).toBe(seat * 3);
    expect(quote.subtotalEurMinor).toBe(seat * 15);
    expect(quote.amountEurMinor).toBe(Math.round(seat * 15 * 0.8));
    expect(quote.teammate.amountMinor).toBe(
      Math.round(Math.floor(quote.amountEurMinor / 3) * 0.6 * 1.08) - 1,
    );
  });

  it('keeps the listed total for group-priced services', () => {
    const trio = {
      gameId: 'apex',
      serviceId: 'trio',
      units: 1,
      server: 'Europe',
      ...(ranksOf('apex', 'trio').length
        ? { rank: ranksOf('apex', 'trio')[0] }
        : {}),
    };
    const listed = Math.round(
      rankPrice('apex', 'trio', 17.99, ranksOf('apex', 'trio')[0]) * 100,
    );
    const quote = calculateQuote({ ...trio, seats: 2 }, trusted);
    expect(quote.amountEurMinor).toBe(listed);
    expect(() => calculateQuote(trio, trusted)).toThrow('seat');
  });

  it('lets party modes bring friends but keeps single services to one teammate', () => {
    const base = { gameId: 'lol', units: 1, server: 'EUW' };
    expect(calculateQuote({ ...base, serviceId: 'aram' }, trusted).seats).toBe(
      1,
    );
    expect(
      calculateQuote({ ...base, serviceId: 'aram', seats: 4 }, trusted)
        .amountEurMinor,
    ).toBe(349 * 4);
    expect(() =>
      calculateQuote({ ...base, serviceId: 'aram', seats: 5 }, trusted),
    ).toThrow('seat');
    expect(() => parseQuoteInput({ ...selection, seats: 2 })).toThrow('seat');
  });

  // Owner decision 2026-11-08: the picker sells 1 to 5 and only 5 is discounted (20%).
  it.each([
    [1, 0, 399],
    [2, 0, 798],
    [3, 0, 1197],
    [4, 0, 1596],
    [5, 20, 1596],
  ])(
    'prices %i picker units with 20%% off only at 5',
    (units, percent, expected) => {
      const quote = calculateQuote({ ...selection, units }, trusted);
      expect(quote.amountEurMinor).toBe(expected);
      expect(quote.quantityDiscountPercent).toBe(percent);
      expect(quote.subtotalEurMinor - quote.discountEurMinor).toBe(expected);
    },
  );

  it.each([6, 7, 8, 9, 10])('refuses %i units outside a bundle', (units) => {
    expect(() => calculateQuote({ ...selection, units }, trusted)).toThrow(
      'Invalid quantity',
    );
  });

  // The Bundles tab is unchanged: the main service in packs of 3, 5 and 10.
  it.each([
    [3, 10, 1077],
    [5, 20, 1596],
    [10, 25, 2993],
  ])('prices a %i-unit bundle at %i%% off', (units, percent, expected) => {
    const quote = calculateQuote(
      { ...selection, units, bundle: true },
      trusted,
    );
    expect(quote.amountEurMinor).toBe(expected);
    expect(quote.quantityDiscountPercent).toBe(percent);
  });

  it('only sells bundles of the main service, one teammate, in 3, 5 or 10', () => {
    for (const bad of [
      { ...selection, units: 4, bundle: true },
      { ...selection, units: 1, bundle: true },
      { ...selection, serviceId: 'duo1', units: 3, bundle: true },
      {
        ...selection,
        serviceId: 'vod',
        units: 3,
        bundle: true,
        rank: undefined,
      },
    ])
      expect(() => calculateQuote(bad, trusted)).toThrow('Invalid bundle');
  });

  // Owner decision 2026-11-08: a cheaper tier is always cheaper, at every rank.
  for (const gameId of GAME_IDS) {
    const modes = servicesFor(gameId).modes as { id: string; price: number }[];
    const tiers = ['duo1', 'duo2', 'duo3']
      .map((id) => modes.find((m) => m.id === id))
      .filter((m): m is { id: string; price: number } => !!m);
    if (tiers.length < 2) continue;
    it(`keeps Plus < Pro < Apex at every rank: ${gameId}`, () => {
      const ladder = ranksOf(gameId, tiers[0]!.id);
      for (const rank of ladder.length ? ladder : [undefined]) {
        for (let i = 1; i < tiers.length; i++) {
          const lower = tiers[i - 1]!;
          const upper = tiers[i]!;
          // only tiers on the same ladder compete (CS2 FACEIT, TFT Double Up are other products)
          if (
            ranksOf(gameId, upper.id).join() !==
            ranksOf(gameId, lower.id).join()
          )
            continue;
          expect(
            rankPrice(gameId, upper.id, upper.price, rank),
            `${gameId} ${rank} ${upper.id}`,
          ).toBeGreaterThan(rankPrice(gameId, lower.id, lower.price, rank));
        }
      }
    });
  }

  for (const gameId of GAME_IDS) {
    for (const service of servicesFor(gameId).modes.filter(
      (mode: { cat: string; id: string }) => mode.cat === 'training',
    )) {
      it(`excludes coaching from quantity discounts: ${gameId}/${service.id}`, () => {
        const input = {
          gameId,
          serviceId: service.id,
          units: 5,
          server: gameId === 'mc' ? 'Hypixel' : serversFor(gameId)[0]![0],
          ...(gameId === 'mc' ? { edition: 'Java' } : {}),
        };
        const fullPrice = Math.round((service.was ?? service.price) * 100);
        for (const context of [
          trusted,
          { ...trusted, firstCoachingSessionEligible: false },
        ]) {
          const quote = calculateQuote(input, context);
          expect(quote.amountEurMinor).toBe(fullPrice * 5);
          expect(quote.quantityDiscountPercent).toBe(0);
        }
        const eligible = calculateQuote(input, {
          ...trusted,
          firstCoachingSessionEligible: true,
        });
        const promotionalPrice = service.was
          ? Math.round(service.price * 100)
          : fullPrice;
        expect(eligible.amountEurMinor).toBe(fullPrice * 4 + promotionalPrice);
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
      const input = { ...selection, units: 3, bundle: true };
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
