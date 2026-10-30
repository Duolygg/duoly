import { describe, expect, it } from 'vitest';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';
import {
  ACCESS_GAMES,
  GAME,
  GAME_IDS,
} from '../../src/design-reference/lib/games.js';
import { canTake } from '../../src/design-reference/lib/access.js';
import { ranksOf } from '../../src/design-reference/lib/ranks.js';
import { isServer } from '../../src/design-reference/lib/servers.js';
import {
  calculateQuote,
  parseQuoteInput,
} from '../../src/server/pricing/index';
import { knowledgeMatch } from '../../src/server/support/knowledge';
import { GAME_IDS as QUEUE_GAME_IDS } from '../../src/contracts/queue-settings';
import { GAME_IDS as ADMIN_GAME_IDS } from '../../src/contracts/admin';
import { POST_GAMES } from '../../src/server/discord/order-posts';
import {
  buildCheckout,
  CheckoutRequestSchema,
} from '../../src/server/payments/checkout';

const trusted = { eurToUsd: 1.08 };

describe('Social sessions', () => {
  it('is a game entry with only hourly Gamer Girl services and no ranks', () => {
    expect(GAME_IDS).toContain('social');
    expect(GAME.social).toMatchObject({ name: 'Social', ign: 'Discord name' });
    const { unit, main, modes } = servicesFor('social');
    expect(unit).toBe('hour');
    expect(main).toBe('chat');
    expect(modes.map((m: { id: string }) => m.id)).toEqual([
      'chat',
      'watch',
      'sleep',
      'karaoke',
    ]);
    for (const m of modes) {
      expect(m.cat).toBe('gg');
      expect(m.unit).toBe('hour');
      expect(ranksOf('social', m.id)).toEqual([]);
    }
  });

  it('prices on the server like every other order, 60% to the teammate', () => {
    const input = parseQuoteInput({
      gameId: 'social',
      serviceId: 'sleep',
      units: 2,
      server: 'Europe',
      ign: 'hiroko',
    });
    const quote = calculateQuote(input, trusted);
    expect(quote.amountEurMinor).toBe(1998);
    expect(quote.unit).toBe('hour');
    // 60% of €19.98 at 1.08, minus 1 cent
    expect(quote.teammate.amountMinor).toBe(Math.round(1998 * 0.6 * 1.08) - 1);
    expect(isServer('social', 'Europe')).toBe(true);
    expect(() =>
      parseQuoteInput({
        gameId: 'social',
        serviceId: 'sleep',
        units: 1,
        server: 'Europe',
        rank: 'Gold',
      }),
    ).toThrow();
  });

  it('only reaches Gamer Girl teammates', () => {
    const order = { game: 'social', gg: true, title: 'Sleep Call' };
    expect(canTake(order, { games: [], gg: true })).toBe(true);
    expect(
      canTake(order, { games: GAME_IDS as unknown as string[], gg: false }),
    ).toBe(false);
  });

  it('stays out of per-game admin approval but in queue settings and Discord posts', () => {
    expect(ACCESS_GAMES.map((g) => g.id)).not.toContain('social');
    expect(ADMIN_GAME_IDS).not.toContain('social');
    expect(QUEUE_GAME_IDS).toContain('social');
    expect(POST_GAMES.social).toMatchObject({ name: 'Social' });
  });

  it('lets Sparky explain it without matching unrelated questions', () => {
    expect(knowledgeMatch('customer', 'can I book a sleep call?')?.id).toBe(
      'social',
    );
    expect(knowledgeMatch('customer', 'do you have egirls')?.id).toBe('social');
    expect(knowledgeMatch('customer', 'my order is missing')?.id).not.toBe(
      'social',
    );
  });

  it('books as a Gamer Girl order that is always on voice', () => {
    const request = CheckoutRequestSchema.parse({
      gameId: 'social',
      serviceId: 'watch',
      units: 3,
      server: 'Europe',
      ign: 'hiroko#0',
      voice: false,
    });
    const { row } = buildCheckout(request, 1.08);
    expect(row).toMatchObject({
      game: 'social',
      service: 'watch',
      title: 'Watch Together',
      unit: 'hour',
      units: 3,
      gg: true,
      voice: true,
      region: 'Europe',
    });
  });
});
