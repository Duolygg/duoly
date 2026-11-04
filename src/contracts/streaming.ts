import { z } from 'zod';

/**
 * Twitch streaming bookings (migration 20261105100000_twitch_streaming.sql,
 * docs/product/twitch-streaming.md). Streamers set an hourly rate in EUR cents and the hours
 * customers can book; customers book a live streamer from the public list by its handle.
 */
export const STREAM_GAME_IDS = [
  'lol',
  'val',
  'cs2',
  'fn',
  'cod',
  'apex',
  'r6',
  'mr',
  'ow',
  'rl',
  'tft',
  'fc',
  'arc',
  'mc',
  'pu',
] as const;
export const StreamGameSchema = z.enum(STREAM_GAME_IDS);

export const STREAM_RATE_MIN_CENTS = 500;
export const STREAM_RATE_MAX_CENTS = 10000;
export const STREAM_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
/** Teammates keep 60% of every order (server/pricing calculateQuote). */
export const STREAM_SHARE = 0.6;
export const TWITCH_USERNAME = /^[A-Za-z0-9_]{4,25}$/;

const Hours = z.number().int().min(1).max(10);
const Rate = z
  .number()
  .int()
  .min(STREAM_RATE_MIN_CENTS)
  .max(STREAM_RATE_MAX_CENTS);

/** The streamer's own panel (GET/POST /api/teammate/streaming). */
export const StreamerDeskSchema = z.strictObject({
  games: z.array(StreamGameSchema).max(STREAM_GAME_IDS.length),
  streamOnline: z.boolean(),
  live: z.boolean(),
  deskOnline: z.boolean(),
  rateEurCents: Rate.nullable(),
  durations: z.array(Hours).max(10),
  twitch: z.string().nullable(),
  name: z.string().nullable(),
});
export type StreamerDesk = z.infer<typeof StreamerDeskSchema>;

export const StreamerDeskResponseSchema = z.strictObject({
  streaming: StreamerDeskSchema.nullable(),
});

export const StreamerDeskCommandSchema = z.strictObject({
  csrf: z.string().min(1).max(128),
  online: z.boolean(),
  rateEurCents: Rate,
  durations: z.array(Hours).min(1).max(10),
  twitch: z
    .string()
    .trim()
    .max(25)
    .refine((value) => value === '' || TWITCH_USERNAME.test(value)),
});

/** One bookable streamer on the homepage (GET /api/home/streamers). */
export const PublicStreamerSchema = z.strictObject({
  handle: z.uuid(),
  name: z.string().min(1).max(16),
  image: z.string().nullable(),
  games: z.array(StreamGameSchema).min(1).max(STREAM_GAME_IDS.length),
  rateEurCents: Rate,
  durations: z.array(Hours).min(1).max(10),
  twitch: z.string().nullable(),
  rating: z.number().nullable(),
  reviews: z.number().int().min(0),
});
export type PublicStreamer = z.infer<typeof PublicStreamerSchema>;

/** What checkout gets back from streamer_checkout_quote. */
export const StreamerQuoteSchema = z.strictObject({
  streamerId: z.uuid(),
  name: z.string().min(1).max(16),
  rateEurCents: Rate,
});

/** Customer price and teammate payout of a booking: rate x hours, 60% to the streamer. */
export function streamPrice(
  rateEurCents: number,
  hours: number,
  eurToUsd: number,
) {
  const amountEurCents = rateEurCents * hours;
  return {
    amountEurCents,
    payoutUsdCents: Math.max(
      99,
      Math.round(amountEurCents * STREAM_SHARE * eurToUsd) - 1,
    ),
  };
}
