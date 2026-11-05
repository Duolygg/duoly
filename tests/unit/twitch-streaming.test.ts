import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  StreamerDeskCommandSchema,
  streamPrice,
} from '../../src/contracts/streaming';
import { SetStreamAccessSchema } from '../../src/contracts/admin';
import {
  CheckoutRequestSchema,
  buildStreamCheckout,
} from '../../src/server/payments/checkout';
import {
  homeStreamers,
  mapStreamers,
} from '../../src/server/streaming/handlers';
import { calculateQuote } from '../../src/server/pricing';

// Twitch streaming bookings (migration 20261105100000_twitch_streaming.sql).
const handle = '0b9a7f8e-3f4c-4d6e-8a1b-2c3d4e5f6a7b';
const streamer = {
  streamerId: '7e000000-0000-4000-8000-000000000051',
  name: 'Lea',
  rateEurCents: 1500,
};
const request = {
  gameId: 'lol',
  serviceId: 'stream',
  streamer: handle,
  units: 2,
  server: 'EUW',
  ign: 'Viewer#EUW',
  useWallet: true,
};

describe('streaming price', () => {
  it('is rate x hours, and the streamer keeps 60% like every order', () => {
    expect(streamPrice(1500, 2, 1.1)).toEqual({
      amountEurCents: 3000,
      payoutUsdCents: Math.round(3000 * 0.6 * 1.1) - 1,
    });
    // same payout formula as a catalog order of the same price
    const catalog = calculateQuote(
      {
        gameId: 'lol',
        serviceId: 'duo1',
        units: 1,
        server: 'EUW',
        rank: 'Platinum',
        ign: 'Viewer',
      },
      { eurToUsd: 1.1, customerCurrency: 'EUR' },
    );
    expect(streamPrice(catalog.amountEurMinor, 1, 1.1).payoutUsdCents).toBe(
      catalog.teammate.amountMinor,
    );
  });
});

describe('streaming checkout', () => {
  it('accepts a streamer booking and refuses mixing it with other perks', () => {
    expect(CheckoutRequestSchema.safeParse(request).success).toBe(true);
    for (const bad of [
      { ...request, serviceId: 'duo1' },
      { ...request, streamer: undefined },
      { ...request, pickSource: handle },
      { ...request, freePerk: true, useWallet: false },
      { ...request, units: 11 },
    ])
      expect(CheckoutRequestSchema.safeParse(bad).success).toBe(false);
    // a normal order can't sneak in the stream service
    expect(
      CheckoutRequestSchema.safeParse({
        ...request,
        streamer: undefined,
        serviceId: 'stream',
      }).success,
    ).toBe(false);
  });

  it('builds the order from the streamer’s own rate with their name on it', () => {
    const parsed = CheckoutRequestSchema.parse(request);
    const built = buildStreamCheckout(parsed, streamer, 1.1);
    expect(built.row).toMatchObject({
      game: 'lol',
      service: 'stream',
      title: 'Twitch stream with Lea',
      units: 2,
      unit: 'hour',
      gg: false,
      region: 'EUW',
      amount_eur_cents: 3000,
      payout_usd_cents: Math.round(3000 * 0.6 * 1.1) - 1,
    });
    expect(built.streamer).toEqual({
      streamer_id: streamer.streamerId,
      streamer_name: 'Lea',
      streamer_rate_eur_cents: 1500,
    });
    expect(built.productName).toBe('Twitch stream with Lea · 2 hours');
  });

  it('refuses Social and games that do not exist', () => {
    const parsed = CheckoutRequestSchema.parse(request);
    expect(() =>
      buildStreamCheckout({ ...parsed, gameId: 'social' }, streamer),
    ).toThrow();
    expect(() =>
      buildStreamCheckout({ ...parsed, gameId: 'zz' }, streamer),
    ).toThrow();
  });
});

describe('streamer panel and admin commands', () => {
  it('checks rate, hours and Twitch username', () => {
    const ok = {
      csrf: 'x',
      online: true,
      rateEurCents: 1500,
      durations: [1, 2],
      twitch: 'lea_tv',
    };
    expect(StreamerDeskCommandSchema.safeParse(ok).success).toBe(true);
    // the Twitch username is required to go online, not to go offline
    expect(
      StreamerDeskCommandSchema.safeParse({ ...ok, twitch: '' }).success,
    ).toBe(false);
    expect(
      StreamerDeskCommandSchema.safeParse({ ...ok, online: false, twitch: '' })
        .success,
    ).toBe(true);
    expect(
      StreamerDeskCommandSchema.safeParse({ ...ok, rateEurCents: 999 }).success,
    ).toBe(true);
    for (const bad of [
      { ...ok, rateEurCents: 998 },
      { ...ok, rateEurCents: 500 },
      { ...ok, rateEurCents: 10001 },
      { ...ok, durations: [] },
      { ...ok, durations: [0] },
      { ...ok, twitch: 'no' },
      { ...ok, twitch: 'has space' },
    ])
      expect(StreamerDeskCommandSchema.safeParse(bad).success).toBe(false);
  });
  it('admins set streaming games per teammate', () => {
    const body = {
      csrf: 'x',
      userId: streamer.streamerId,
      streamGames: ['lol', 'val'],
    };
    expect(SetStreamAccessSchema.safeParse(body).success).toBe(true);
    expect(
      SetStreamAccessSchema.safeParse({ ...body, streamGames: ['lol', 'lol'] })
        .success,
    ).toBe(false);
  });
});

describe('public streamer list', () => {
  const row = {
    handle,
    name: 'Lea',
    image: '/assets/avatars/avatar-3.png',
    games: ['lol'],
    rateEurCents: 1500,
    durations: [1, 2],
    twitch: 'lea_tv',
    rating: 4.9,
    reviews: 12,
  };
  it('keeps valid rows, drops broken ones and unknown images', () => {
    const out = mapStreamers([
      row,
      { ...row, handle: 'not-a-uuid' },
      { ...row, games: [] },
      {
        ...row,
        handle: '1b9a7f8e-3f4c-4d6e-8a1b-2c3d4e5f6a7b',
        image: 'https://evil.test/x.png',
        rating: null,
      },
      {
        ...row,
        handle: '2b9a7f8e-3f4c-4d6e-8a1b-2c3d4e5f6a7b',
        userId: 'leak',
      },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(row);
    expect(out[1]!.image).toBeNull();
  });
  it('shows nobody when the database is unavailable', async () => {
    expect(
      await homeStreamers(async () => ({
        data: null,
        error: { message: 'down' },
      })),
    ).toEqual({ streamers: [] });
  });
});

describe('migration', () => {
  const sql = readFileSync(
    'supabase/migrations/20261105100000_twitch_streaming.sql',
    'utf8',
  );
  it('keeps bookings out of the normal queue and shows them only to the streamer', () => {
    expect(sql).toMatch(
      /order_public_queued_at[\s\S]*order_streamer_bookings[\s\S]*'infinity'::timestamptz/,
    );
    expect(sql).toMatch(
      /order_visible_at[\s\S]*b\.teammate_id = p_access\.user_id\) then\s+return p_order\.queued_at/,
    );
    expect(sql).toContain(
      'return case when v_streamer = p_access.user_id then p_order.queued_at end;',
    );
    expect(sql).toContain('can’t be rerolled');
  });
  it('only exposes what each role needs', () => {
    expect(sql).toContain(
      'grant execute on function public.home_streamers() to anon, authenticated;',
    );
    expect(sql).toContain(
      'grant execute on function public.streamer_checkout_quote(uuid,text,integer) to service_role;',
    );
    expect(sql).not.toMatch(/'userId'|'user_id', s\.user_id/);
  });
});

describe('one booking at a time', () => {
  const sql = readFileSync(
    'supabase/migrations/20261105110000_streamer_one_booking.sql',
    'utf8',
  );
  it('treats a session, a waiting booking or another checkout as taken', () => {
    expect(sql).toMatch(/streamer_busy[\s\S]*b\.status = 'in_progress'/);
    expect(sql).toMatch(/streamer_busy[\s\S]*o\.status = 'queued'/);
    expect(sql).toMatch(
      /streamer_busy[\s\S]*i\.customer_id is distinct from p_customer/,
    );
    expect(sql).toContain('not public.streamer_busy(p_user, null)');
    expect(sql).toContain(
      'is already booked. Try again when they’re back online.',
    );
  });
});

describe('Twitch username required, rate from 9.99', () => {
  const sql = readFileSync(
    'supabase/migrations/20261105150000_streamer_twitch_live.sql',
    'utf8',
  );
  it('needs a Twitch username to go online and a rate from 9.99', () => {
    expect(sql).toContain('check (not stream_online or twitch is not null)');
    expect(sql).toContain('check (rate_eur_cents between 999 and 10000)');
  });
});

describe('No Twitch live check (migration 20261105190000)', () => {
  const sql = readFileSync(
    'supabase/migrations/20261105190000_streamer_no_twitch_check.sql',
    'utf8',
  );
  it('lists streamers without asking Twitch', () => {
    expect(sql).not.toMatch(/twitch_live_at >/);
    expect(sql).toContain(
      'drop function public.streamer_twitch_seen(uuid, text, boolean);',
    );
    expect(sql).toContain('drop column twitch_live_at');
    expect(sql).toContain('Add your Twitch username to go online.');
  });
});
