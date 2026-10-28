import { describe, expect, it } from 'vitest';
import {
  ReviewInputSchema,
  ReviewSchema,
  TeammateStatsResponseSchema,
} from '../../src/contracts/reviews';

const review = {
  rating: 5,
  text: 'Great teammate',
  tags: ['Great comms', 'Patient'],
  at: '2026-10-24T12:00:00.000Z',
};

describe('review contracts', () => {
  it('accepts the original 1 to 5 stars, 500 character text and four known tags', () => {
    expect(ReviewSchema.parse(review)).toEqual(review);
    expect(
      ReviewInputSchema.parse({
        csrf: 'token',
        rating: review.rating,
        text: review.text,
        tags: review.tags,
      }),
    ).toEqual({
      csrf: 'token',
      rating: 5,
      text: 'Great teammate',
      tags: ['Great comms', 'Patient'],
      tip_cents: 0,
    });
  });

  it.each([
    { rating: 0 },
    { rating: 6 },
    { rating: 4.5 },
    { text: 'x'.repeat(501) },
    { tags: ['Unknown'] },
    { tags: ['Patient', 'Patient'] },
    {
      tags: [
        'Great comms',
        'Shotcaller',
        'Super friendly',
        'Taught me a lot',
        'Patient',
      ],
    },
    { tip: 5 },
  ])('rejects malformed or tip-bearing review input %j', (patch) => {
    expect(
      ReviewInputSchema.safeParse({
        csrf: 'token',
        rating: 5,
        text: '',
        tags: [],
        ...patch,
      }).success,
    ).toBe(false);
  });

  it('validates privacy-safe teammate rating and tip stats', () => {
    const payload = {
      now: 1792843200000,
      me: '11111111-1111-4111-8111-111111111111',
      stats: {
        completed: 1,
        tier: { name: 'Rookie', deposit: 10 },
        held: 0.6,
        saved: 0,
        rating: 5,
        reviews: 1,
        tipsTotal: 0,
        recent: [
          {
            orderId: '22222222-2222-4222-8222-222222222222',
            at: 1792843200000,
            net: 5.4,
            tip: 0,
            game: 'lol',
          },
        ],
        latestReviews: [
          {
            ...review,
            customer: 'Review Customer',
            game: 'lol',
            at: 1792843200000,
          },
        ],
        adjustments: [],
      },
      leaderboard: {},
    };
    expect(TeammateStatsResponseSchema.parse(payload)).toEqual(payload);
  });
  it('accepts only public leaderboard rows for week, month and all', () => {
    const base = {
      now: 1,
      me: '11111111-1111-4111-8111-111111111111',
      stats: {
        completed: 0,
        tier: { name: 'Rookie', deposit: 10 },
        held: 0,
        saved: 0,
        rating: null,
        reviews: 0,
        tipsTotal: 0,
        recent: [],
        latestReviews: [],
        adjustments: [],
      },
    };
    const entry = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Fabian',
      image: '/assets/avatars/avatar-1.png',
      orders: 3,
      main: 'lol',
      rating: 4.67,
      fives: 2,
      points: 40,
    };
    const board = {
      week: { global: [entry], lol: [entry] },
      month: { global: [] },
      all: { global: [{ ...entry, rating: null }] },
    };
    const parse = (leaderboard: unknown) =>
      TeammateStatsResponseSchema.safeParse({ ...base, leaderboard }).success;
    expect(parse(board)).toBe(true);
    expect(parse({})).toBe(true);
    expect(parse({ week: board.week })).toBe(false);
    // country is public, like the original leaderboard flags
    expect(
      parse({ ...board, week: { global: [{ ...entry, country: 'de' }] } }),
    ).toBe(true);
    for (const extra of [{ email: 'x@y.z' }, { earnings: 10 }])
      expect(
        parse({ ...board, week: { global: [{ ...entry, ...extra }] } }),
      ).toBe(false);
    expect(
      parse({ ...board, week: { global: [{ ...entry, rating: 6 }] } }),
    ).toBe(false);
  });
});
