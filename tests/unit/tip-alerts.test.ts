import { describe, expect, it } from 'vitest';

import {
  freshTips,
  tipNotificationText,
} from '../../src/components/teammate/tip-alerts';

const e = (orderId: string | null, tip: number, game = 'val') => ({
  orderId,
  at: 1,
  net: 10,
  tip,
  game,
});

describe('teammate tip alerts', () => {
  it('only remembers the tips on the first look in a browser', () => {
    const { fresh, known } = freshTips(null, [e('a', 5), e('b', 0)]);
    expect(fresh).toEqual([]);
    expect(known).toEqual({ a: 5 });
  });

  it('alerts for a tip on an order that had none', () => {
    const { fresh, known } = freshTips({ a: 5 }, [e('a', 5), e('b', 3.5)]);
    expect(fresh).toEqual([{ orderId: 'b', amount: 3.5, game: 'val' }]);
    expect(known).toEqual({ a: 5, b: 3.5 });
  });

  it('alerts for the difference when a tip goes up', () => {
    const { fresh } = freshTips({ a: 5 }, [e('a', 7)]);
    expect(fresh).toEqual([{ orderId: 'a', amount: 2, game: 'val' }]);
  });

  it('stays quiet when a tip is refunded, and skips adjustments', () => {
    const { fresh, known } = freshTips({ a: 5 }, [e('a', 0), e(null, 0)]);
    expect(fresh).toEqual([]);
    expect(known).toEqual({});
  });

  it('names the game and the payout in the text', () => {
    expect(
      tipNotificationText({ orderId: 'a', amount: 5, game: 'val' }),
    ).toEqual({
      title: 'You got a $5.00 tip!',
      body: 'A customer tipped you for your Valorant order. 100% of it is yours and goes out with Friday’s payout.',
    });
  });
});

describe('teammate tip alert text', () => {
  it('leaves the game out when it is unknown', () => {
    expect(
      tipNotificationText({ orderId: 'a', amount: 2.5, game: 'nope' }).body,
    ).toBe('100% of it is yours and goes out with Friday’s payout.');
  });
});
