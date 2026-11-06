import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';
import { GAME_IDS } from '../../src/design-reference/lib/games.js';
import {
  bookingUnitCents,
  checkSeats,
  isGroupService,
  MAX_SEATS,
  seatRule,
} from '../../src/contracts/seats';
import {
  CustomerOrderSchema,
  TeammateOrderSchema,
} from '../../src/contracts/orders';
import { ChatMessageSchema } from '../../src/contracts/chat';
import {
  buildCheckout,
  CheckoutRequestSchema,
} from '../../src/server/payments/checkout';
import {
  createRoomFetch,
  teamTarget,
  toRoomOrder,
} from '../../src/components/account/queue-room-data.js';
import { teamLine } from '../../src/components/teammate/teammate-data.js';
import { openPost } from '../../src/server/discord/order-posts';

// Team orders (docs/product/team-orders.md, 20261106190000_team_orders).

const LEAD = '44cbbcfb-ac7f-443e-b951-9b64f31a12dd';
const SEAT2 = '9dc7ec54-eaac-4338-91c3-44ee38c491cd';
const TEAM = '82340f74-b0cf-47a5-9a09-dd3d77893014';

// The customer team block exactly as public.order_team_customer_dto returned it in the dry run.
const team = {
  id: TEAM,
  seats: 2,
  filled: 1,
  status: 'started',
  members: [
    {
      seat: 1,
      status: 'in_progress',
      order_id: LEAD,
      reviewed: false,
      teammate: {
        name: 'Player One',
        image: '/assets/avatars/avatar-1.png',
        country: '',
      },
      amount_eur_cents: 900,
      public_reference: 'DL-93369',
    },
    {
      seat: 2,
      status: 'queued',
      order_id: SEAT2,
      reviewed: false,
      teammate: null,
      amount_eur_cents: 899,
      public_reference: 'DL-93370',
    },
  ],
  started_at: '2026-11-06T07:05:27.362356+00:00',
  lead_order_id: LEAD,
  amount_eur_cents: 1799,
  wallet_eur_cents: 0,
};

const customerOrder = {
  id: LEAD,
  public_reference: 'DL-93369',
  status: 'in_progress',
  game: 'apex',
  service: 'trio',
  title: 'Full Trio',
  units: 1,
  unit: 'hour',
  gg: false,
  rank: '',
  region: 'Europe',
  ign: 'Tester#1',
  note: '',
  voice: false,
  amount_eur_cents: 900,
  created_at: '2026-11-06T07:05:27.000000+00:00',
  queued_at: '2026-11-06T07:05:27.000000+00:00',
  accepted_at: '2026-11-06T07:05:28.000000+00:00',
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  rerolls: 0,
  current_assignment_id: '11111111-1111-4111-8111-111111111111',
  teammate: {
    name: 'Player One',
    image: '/assets/avatars/avatar-1.png',
    country: '',
  },
  review: null,
  seat: 1,
  team,
};

describe('seat rules', () => {
  it('gives every Teams service a seat rule, so none is silently one teammate', () => {
    for (const gameId of GAME_IDS)
      for (const mode of servicesFor(gameId).modes.filter(
        (m: { cat: string }) => m.cat === 'other',
      )) {
        const rule = seatRule(gameId, mode.id);
        expect(rule.max, `${gameId}/${mode.id}`).toBeGreaterThan(1);
        expect(rule.max).toBeLessThanOrEqual(MAX_SEATS);
        // Teams services open at the most seats ("fill my five" in one click)
        expect(rule.default).toBe(rule.max);
      }
  });

  it('lets the owner-approved party modes bring friends, starting at one', () => {
    for (const [gameId, serviceId, max] of [
      ['lol', 'swift', 4],
      ['lol', 'aram', 4],
      ['lol', 'norm', 4],
      ['cod', 'zombies', 3],
      ['mc', 'manhunt', 3],
      ['mc', 'mini', 3],
    ] as const) {
      expect(seatRule(gameId, serviceId)).toEqual({
        min: 1,
        max,
        default: 1,
      });
    }
  });

  it('keeps duo, coaching, Gamer Girl and social services at one teammate', () => {
    // the Social calls are checked on their own below
    for (const gameId of GAME_IDS.filter((g: string) => g !== 'social'))
      for (const mode of servicesFor(gameId).modes.filter(
        (m: { cat: string; fun?: boolean }) =>
          // fun modes (party modes among them) sit in the Duo tab since 2026-11-06
          ['duo', 'gg', 'training', 'social'].includes(m.cat) && !m.fun,
      ))
        expect(isGroupService(gameId, mode.id), `${gameId}/${mode.id}`).toBe(
          false,
        );
  });

  it('lets Social calls book up to 3 Gamer Girls, but Sleep Call stays one', () => {
    for (const id of ['chat', 'watch', 'karaoke'])
      expect(seatRule('social', id)).toEqual({ min: 1, max: 3, default: 1 });
    expect(isGroupService('social', 'sleep')).toBe(false);
    // Gamer Girl services may be team orders in the database too
    const sql = readFileSync(
      'supabase/migrations/20261106190000_team_orders.sql',
      'utf8',
    );
    expect(sql).toContain('pick_source_order_id is null));');
    expect(sql).not.toMatch(/pick_source_order_id is null and not gg/);
  });

  it('prices group services as one total and everything else per seat', () => {
    expect(seatRule('apex', 'trio')).toMatchObject({
      min: 2,
      max: 2,
      groupPrice: true,
    });
    expect(bookingUnitCents(1799, 'apex', 'trio', 2)).toBe(1799);
    expect(bookingUnitCents(799, 'lol', 'flex', 3)).toBe(2397);
    expect(() => checkSeats('lol', 'flex', 5)).toThrow('seat');
    expect(() => checkSeats('lol', 'duo1', 2)).toThrow('seat');
    expect(() => checkSeats('lol', 'flex', 2.5)).toThrow('seat');
  });
});

describe('checkout', () => {
  const request = {
    gameId: 'lol',
    serviceId: 'flex',
    units: 1,
    server: 'EUW',
    rank: 'Gold',
    ign: 'Tester#1',
    useWallet: false,
  };

  it('stores the seats on the checkout intent and names them for Stripe', () => {
    const built = buildCheckout(
      CheckoutRequestSchema.parse({ ...request, seats: 3 }),
      1.08,
    );
    expect(built.row).toMatchObject({ seats: 3 });
    expect(built.productName).toBe('Flex Squad · 1 game · 3 teammates');
    // every teammate earns from one seat's share
    expect(built.row.amount_eur_cents % 3).toBe(0);
  });

  it('never sends a seats column for a single teammate', () => {
    const built = buildCheckout(CheckoutRequestSchema.parse(request), 1.08);
    expect('seats' in built.row).toBe(false);
  });

  it('keeps free coaching and streamer bookings to one teammate', () => {
    expect(
      CheckoutRequestSchema.safeParse({
        ...request,
        seats: 2,
        freePerk: true,
      }).success,
    ).toBe(false);
    expect(
      CheckoutRequestSchema.safeParse({
        ...request,
        seats: 2,
        serviceId: 'stream',
        streamer: '22222222-2222-4222-8222-222222222222',
      }).success,
    ).toBe(false);
    expect(
      CheckoutRequestSchema.safeParse({ ...request, seats: 6 }).success,
    ).toBe(false);
  });
});

describe('contracts', () => {
  it('parses the team block the database returns', () => {
    expect(CustomerOrderSchema.parse(customerOrder).team?.members).toHaveLength(
      2,
    );
    // and still parses an order from before the migration
    const { seat: _seat, team: _team, ...old } = customerOrder;
    void _seat;
    void _team;
    expect(CustomerOrderSchema.parse(old).team).toBeUndefined();
  });

  it('parses the teammate view of a seat', () => {
    expect(
      TeammateOrderSchema.parse({
        id: SEAT2,
        public_reference: 'DL-93370',
        status: 'queued',
        game: 'apex',
        service: 'trio',
        title: 'Full Trio',
        units: 1,
        unit: 'hour',
        gg: false,
        rank: '',
        region: 'Europe',
        ign: 'Tester#1',
        note: '',
        voice: false,
        mood: null,
        customer_name: 'Player',
        customer_image: '/assets/avatars/avatar-1.png',
        customer_country: '',
        payout_usd_cents: 580,
        current_assignment_id: null,
        team: {
          seats: 2,
          filled: 1,
          status: 'waiting',
          started_at: null,
          members: [{ name: 'Player', image: '/assets/avatars/avatar-1.png' }],
        },
      }).team?.filled,
    ).toBe(1);
  });

  it('accepts a team-mate message in a seat chat', () => {
    expect(
      ChatMessageSchema.parse({
        id: '33333333-3333-4333-8333-333333333333',
        sequence: 6,
        kind: 'user',
        sender: 'mate',
        name: 'Mate Two',
        image: '',
        body: 'hello',
        created_at: '2026-11-06T07:05:30.000000+00:00',
        request_id: '44444444-4444-4444-8444-444444444444',
      }).sender,
    ).toBe('mate');
  });
});

describe('customer order room', () => {
  it('maps the team for the room, with a link per seat', () => {
    const room = toRoomOrder(customerOrder);
    expect(room.team).toMatchObject({
      seats: 2,
      filled: 1,
      status: 'started',
      leadOrderId: LEAD,
      total: 17.99,
    });
    expect(
      room.team!.members.map((m: { orderId: string }) => m.orderId),
    ).toEqual([LEAD, SEAT2]);
    expect(toRoomOrder({ ...customerOrder, team: undefined }).team).toBeNull();
  });

  it('chats through a seat with a teammate in it, and cancels a filling team through a free seat', () => {
    expect(teamTarget(customerOrder, 'chat', SEAT2)).toBe(LEAD);
    const waiting = { ...customerOrder, team: { ...team, status: 'waiting' } };
    expect(teamTarget(waiting, 'cancel', LEAD)).toBe(SEAT2);
    // once the team started, cancel stays on this order (the server refuses it)
    expect(teamTarget(customerOrder, 'cancel', LEAD)).toBe(LEAD);
    expect(teamTarget(null, 'chat', LEAD)).toBe(LEAD);
  });
});

describe('teammate desk and Discord', () => {
  it('says how full the team is', () => {
    const t = { seats: 3, filled: 1, status: 'waiting', members: ['Rin'] };
    expect(teamLine(t, false)).toBe('Team of 3 · 1 of 3 seats taken');
    expect(teamLine({ ...t, filled: 2 }, true)).toContain(
      'waiting for 1 more teammate.',
    );
    expect(
      teamLine(
        { ...t, filled: 3, status: 'started', members: ['Rin', 'Sam'] },
        true,
      ),
    ).toBe('Team of 3 · with Rin, Sam');
  });

  it('tells Discord a post is one seat of a team', () => {
    const post = JSON.stringify(
      openPost(
        {
          reference: 'DL-1',
          game: 'lol',
          title: 'Flex Squad',
          units: 1,
          unit: 'game',
          rank: 'Gold',
          region: 'EUW',
          voice: false,
          gg: false,
          payoutUsdCents: 517,
          queuedAt: 0,
          cancelsAt: 300000,
          seats: 4,
          seatsTaken: 1,
        },
        'https://duoly.gg/claim/x',
        { site: 'https://duoly.gg' },
      ),
    );
    expect(post).toContain('Team order · 1 of 4 seats taken.');
  });
});

describe('migration', () => {
  const sql = readFileSync(
    'supabase/migrations/20261106190000_team_orders.sql',
    'utf8',
  );

  it('keeps team money on the lead and off single seats', () => {
    // seats never settle their own payment; the team does
    expect(sql).toMatch(
      /order_payment_settle\(\)[\s\S]*?if new\.team_id is not null then return new; end if;/,
    );
    // capture once, when the last seat is taken
    expect(sql).toMatch(
      /v_filled = t\.seats then[\s\S]*?settle = 'capture'[\s\S]*?order_id = t\.lead_order_id/,
    );
    // all or nothing: a waiting team releases the payment and returns the balance
    expect(sql).toMatch(
      /t\.status = 'waiting' then[\s\S]*?settle = 'release'[\s\S]*?order_team_wallet_return/,
    );
    // other seats never create refund credits while the team waits
    expect(sql).toMatch(
      /t\.started_at is not null\) then\s+insert into public\.refund_credits/,
    );
  });

  it('charges at queue: a cancelled order gives the card part back as balance, never to the card', () => {
    // single orders: only an old hold is released to the card; a charge becomes a balance credit
    expect(sql).toMatch(
      /order_payment_settle\(\)[\s\S]*?settle = 'release'[\s\S]*?state in \('authorized','capture_failed'\);[\s\S]*?'paid_refund', p\.amount_eur_cents[\s\S]*?p\.state = 'captured'/,
    );
    // a team that didn't fill: the whole team's card part, on the lead seat
    expect(sql).toMatch(
      /select t\.lead_order_id, t\.customer_id, 'paid_refund', p\.amount_eur_cents/,
    );
    // nothing asks Stripe to refund a charged order on cancel any more
    expect(sql).not.toMatch(
      /state in \('authorized','captured','capture_failed'\)/,
    );
    expect(sql).toMatch(/kind in \('queued_refund','paid_refund'\)/);
  });

  it('locks every new function away from browser roles', () => {
    const created = [
      ...sql.matchAll(/create function public\.(\w+)\(([^)]*)\)/g),
    ].map((m) => m[1]);
    for (const name of created)
      expect(sql, name).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\(`),
      );
    expect(sql).toMatch(
      /alter table public\.order_teams enable row level security/,
    );
  });
});

describe('acting on one teammate of a team', () => {
  it('sends a switch and a report to the seat of the picked teammate', async () => {
    const calls: string[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith('data:'))
        return new Response(new Blob(['x'], { type: 'image/png' }));
      if (url.endsWith('/report'))
        return Response.json({
          report: {
            reference: 'R-1',
            type: 'toxic',
            status: 'open',
            bounty_eur_cents: 5000,
            created_at: '2026-11-06T07:05:30.000000+00:00',
            decided_at: null,
            bounty_owed: false,
          },
        });
      return Response.json({ order: customerOrder });
    }) as typeof fetch;
    try {
      const room = createRoomFetch({
        orderId: LEAD,
        csrf: 'c',
        rerollLimit: 2,
      });
      await room('/api/orders/' + LEAD); // the room reads its order first
      await room('/api/orders/' + LEAD, {
        method: 'POST',
        body: JSON.stringify({ action: 'reroll', orderId: SEAT2 }),
      });
      await room('/api/orders/' + LEAD, {
        method: 'POST',
        body: JSON.stringify({
          action: 'report',
          orderId: SEAT2,
          type: 'toxic',
          text: 'Flamed the whole game long.',
          evidence: ['data:image/png;base64,eA=='],
        }),
      });
      expect(calls).toContain('/api/orders/' + SEAT2 + '/reroll');
      expect(calls).toContain('/api/orders/' + SEAT2 + '/report');
      // an id that isn't a seat of this team never redirects anything
      calls.length = 0;
      await room('/api/orders/' + LEAD, {
        method: 'POST',
        body: JSON.stringify({
          action: 'reroll',
          orderId: '99999999-9999-4999-8999-999999999999',
        }),
      });
      expect(calls).toContain('/api/orders/' + LEAD + '/reroll');
    } finally {
      globalThis.fetch = real;
    }
  });
});
