import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Play again (docs/product/play-again.md): the replayed request, the saved card, every payment
// branch of the button against a mocked Stripe and database, and the migration's rules.
const SOURCE = 'c7000000-0000-4000-8000-0000000000a1';
const INTENT = 'c7000000-0000-4000-8000-0000000000c1';
const ORDER = 'c7000000-0000-4000-8000-0000000000b1';
const USER = 'c7000000-0000-4000-8000-000000000001';

const state = vi.hoisted(() => ({
  body: {} as Record<string, unknown>,
  check: { available: true, reason: null } as {
    available: boolean;
    reason: string | null;
  },
  balance: 0,
  split: { wallet_eur_cents: 0, card_eur_cents: 0 },
  source: null as Record<string, unknown> | null,
  intentRow: null as Record<string, unknown> | null,
  inserted: [] as Record<string, unknown>[],
  adminCalls: [] as { fn: string; args: Record<string, unknown> }[],
  cards: [] as unknown[],
  customer: 'cus_1' as string | null,
  piResult: null as unknown,
  piError: null as unknown,
  piCreated: [] as Record<string, unknown>[],
  cancelled: [] as string[],
  sessions: 0,
  paidOrder: { order_id: '', created: true } as Record<string, unknown>,
}));

const account = {
  json: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status }),
  identity: async () => ({
    viewer: { id: USER, role: 'customer', email: 'p@example.com' },
  }),
  client: {
    rpc: async (fn: string) => {
      if (fn === 'customer_play_again')
        return { data: state.check, error: null };
      if (fn === 'customer_wallet_balance')
        return { data: { total_eur_cents: state.balance }, error: null };
      throw new Error(`unexpected user rpc ${fn}`);
    },
  },
};
vi.mock('../../src/server/auth/context', () => ({
  accountContext: () => account,
}));
vi.mock('../../src/server/auth/handlers', () => ({
  mutation: async () => ({
    account,
    body: { csrf: 'csrf', ...state.body },
    failure: null,
  }),
}));
vi.mock('../../src/server/payments/confirm-email', () => ({
  confirmEmail: async () => undefined,
}));
vi.mock('../../src/server/fx', () => ({
  eurToUsd: async () => ({ rate: 1.08 }),
  FALLBACK_EUR_TO_USD: 1.08,
}));
vi.mock('../../src/server/pro/config', async (original) => ({
  ...(await original<typeof import('../../src/server/pro/config')>()),
  proEnabled: () => false,
}));
vi.mock('../../src/server/payments/config', () => {
  const chain = (data: unknown) => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.maybeSingle = async () => ({ data, error: null });
    c.single = async () => ({ data, error: null });
    return c;
  };
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.adminCalls.push({ fn, args });
      if (fn === 'checkout_reserve_wallet')
        return { data: state.split, error: null };
      if (fn === 'pro_billing_customer')
        return { data: state.customer, error: null };
      if (fn === 'create_paid_order' || fn === 'create_wallet_order')
        return { data: state.paidOrder, error: null };
      return { data: null, error: null };
    },
    from: (table: string) => {
      if (table === 'orders') return chain(state.source);
      if (table === 'customer_blocks') return chain(null);
      if (table === 'checkout_intents')
        return {
          insert: (row: Record<string, unknown>) => {
            state.inserted.push(row);
            return chain({ id: INTENT });
          },
          update: (row: Record<string, unknown>) => {
            state.intentRow = { ...state.intentRow, ...row };
            return { eq: async () => ({ error: null }) };
          },
          select: () => chain(state.intentRow),
        };
      throw new Error(`unexpected table ${table}`);
    },
  };
  const stripe = {
    customers: {
      listPaymentMethods: async () => ({ data: state.cards }),
      create: async () => ({ id: 'cus_new' }),
    },
    paymentIntents: {
      create: async (params: Record<string, unknown>) => {
        state.piCreated.push(params);
        if (state.piError) throw state.piError;
        return state.piResult;
      },
      cancel: async (id: string) => {
        state.cancelled.push(id);
      },
    },
    refunds: { create: async () => undefined },
    checkout: {
      sessions: {
        create: async () => {
          state.sessions += 1;
          return { id: 'cs_1', client_secret: 'cs_secret' };
        },
        expire: async () => undefined,
      },
    },
  };
  return {
    paymentsConfig: () => ({
      origin: 'https://duoly.gg',
      publishableKey: 'pk',
    }),
    adminFor: () => admin,
    stripeFor: () => stripe,
    AUTHORIZE_ONLY_METHODS: ['card'],
  };
});

const {
  playAgain,
  playAgainOffer,
  replayRequest,
  savedCard,
  playAgainRefusal,
} = await import('../../src/server/payments/play-again');
const { sessionParams } = await import('../../src/server/payments/checkout');
const { playAgainNote, paymentLines } =
  await import('../../src/components/account/PlayAgain.jsx');

const ctx = (method: string) => {
  const request = new Request(
    `http://localhost/api/orders/${SOURCE}/play-again`,
    { method },
  );
  return {
    request,
    url: new URL(request.url),
    params: { id: SOURCE },
    cookies: { get: () => undefined },
  } as never;
};
const post = async () => (await playAgain(ctx('POST'))) as Response;
const card = {
  id: 'pm_1',
  type: 'card',
  allow_redisplay: 'always',
  created: 2,
  card: { brand: 'visa', last4: '4242' },
};
const source = {
  id: SOURCE,
  customer_id: USER,
  game: 'lol',
  service: 'duo1',
  units: 3,
  rank: 'Gold',
  region: 'EUW',
  ign: 'Me#EUW',
  note: '',
  voice: true,
  mood: 'chill',
};
// what the button shows for that source (today's server price)
let PRICE = 0;

beforeEach(async () => {
  state.check = { available: true, reason: null };
  state.balance = 0;
  state.source = { ...source };
  state.intentRow = null;
  state.inserted = [];
  state.adminCalls = [];
  state.cards = [card];
  state.customer = 'cus_1';
  state.piResult = null;
  state.piError = null;
  state.piCreated = [];
  state.cancelled = [];
  state.sessions = 0;
  state.paidOrder = { order_id: ORDER, created: true };
  const offer = await (await playAgainOffer(ctx('GET'))).json();
  PRICE = offer.amountEurCents;
  state.split = { wallet_eur_cents: 0, card_eur_cents: PRICE };
  state.body = { amountEurCents: PRICE };
});

describe('the replayed session', () => {
  it('copies game, service, units, server, rank, ign, voice and mood', () => {
    expect(replayRequest(source)).toMatchObject({
      gameId: 'lol',
      serviceId: 'duo1',
      units: 3,
      server: 'EUW',
      rank: 'Gold',
      ign: 'Me#EUW',
      voice: true,
      mood: 'chill',
      useWallet: true,
    });
  });
  it('splits Minecraft back into server and edition', () => {
    expect(
      replayRequest({
        ...source,
        game: 'mc',
        service: 'manhunt',
        units: 1,
        rank: '',
        region: 'play.hypixel.net · Java',
        mood: null,
      }),
    ).toMatchObject({ server: 'play.hypixel.net', edition: 'Java' });
    expect(
      replayRequest({ ...source, game: 'mc', region: 'no edition' }),
    ).toBeNull();
  });
  it('uses only a card the customer chose to save, newest first', () => {
    expect(
      savedCard([
        { ...card, id: 'pm_old', created: 1 },
        { ...card, id: 'pm_limited', created: 9, allow_redisplay: 'limited' },
        { ...card, id: 'pm_new', created: 5 },
        { id: 'pm_paypal', type: 'paypal', created: 10 },
      ] as never),
    ).toEqual({ id: 'pm_new', brand: 'visa', last4: '4242' });
    expect(savedCard([])).toBeNull();
  });
});

describe('checkout offers to save the card', () => {
  const base = {
    intentId: INTENT,
    customerId: USER,
    email: 'p@example.com',
    origin: 'https://duoly.gg',
    amountEurCents: 999,
    productName: 'Duo · 3 games',
    description: 'League',
    nowSeconds: 1_000_000,
  };
  it('with the account’s Stripe customer', () => {
    const params = sessionParams({ ...base, stripeCustomer: 'cus_1' });
    expect(params).toMatchObject({
      customer: 'cus_1',
      saved_payment_method_options: { payment_method_save: 'enabled' },
    });
    expect(params).not.toHaveProperty('customer_email');
    // the receipt still goes to the customer
    expect(params.payment_intent_data?.receipt_email).toBe('p@example.com');
  });
  it('and falls back to the email without one', () => {
    const params = sessionParams(base);
    expect(params.customer_email).toBe('p@example.com');
    expect(params).not.toHaveProperty('saved_payment_method_options');
  });
});

describe('GET offer', () => {
  it('prices the session and shows the saved card', async () => {
    // the price every test below compares against is a real server price
    expect(Number.isInteger(PRICE) && PRICE > 200).toBe(true);
    state.balance = 200;
    const offer = await (await playAgainOffer(ctx('GET'))).json();
    expect(offer).toMatchObject({
      available: true,
      reason: null,
      amountEurCents: PRICE,
      walletEurCents: 200,
      cardEurCents: PRICE - 200,
      card: { brand: 'visa', last4: '4242' },
    });
  });
  it('says why it is off, without a card lookup', async () => {
    state.check = { available: false, reason: 'teammate_away' };
    const offer = await (await playAgainOffer(ctx('GET'))).json();
    expect(offer).toMatchObject({
      available: false,
      reason: 'teammate_away',
      card: null,
    });
  });
});

describe('POST play again', () => {
  it('one tap: charges the saved card and creates the order', async () => {
    state.piResult = {
      id: 'pi_1',
      status: 'succeeded',
      amount: PRICE,
      currency: 'eur',
      metadata: { intent_id: INTENT, play_again: SOURCE },
    };
    state.intentRow = {
      id: INTENT,
      amount_eur_cents: PRICE,
      wallet_eur_cents: 0,
    };
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: `/queue/${ORDER}`,
      orderId: ORDER,
    });
    expect(state.inserted[0]).toMatchObject({
      pick_source_order_id: SOURCE,
      customer_id: USER,
      mood: 'chill',
    });
    expect(state.piCreated[0]).toMatchObject({
      amount: PRICE,
      currency: 'eur',
      customer: 'cus_1',
      payment_method: 'pm_1',
      confirm: true,
      metadata: { intent_id: INTENT, play_again: SOURCE },
    });
    // charge at queue (2026-11-06): charged now, never held
    expect(state.piCreated[0]).not.toHaveProperty('capture_method');
    expect(state.piCreated[0]).not.toHaveProperty('off_session');
    expect(
      state.adminCalls.find((c) => c.fn === 'create_paid_order')?.args,
    ).toMatchObject({
      p_intent_id: INTENT,
      p_payment_intent: 'pi_1',
      p_state: 'captured',
    });
    expect(state.sessions).toBe(0);
  });
  it('3D Secure: hands the check to the order room', async () => {
    state.piResult = {
      id: 'pi_2',
      status: 'requires_action',
      client_secret: 'pi_2_secret',
      metadata: { intent_id: INTENT, play_again: SOURCE },
    };
    const response = await post();
    expect(await response.json()).toEqual({
      clientSecret: 'pi_2_secret',
      intentId: INTENT,
    });
    expect(state.adminCalls.some((c) => c.fn === 'create_paid_order')).toBe(
      false,
    );
  });
  it('declined card: frees the balance and opens the payment page', async () => {
    state.piError = {
      raw: {
        payment_intent: {
          id: 'pi_3',
          status: 'requires_payment_method',
          metadata: { intent_id: INTENT, play_again: SOURCE },
        },
      },
    };
    state.intentRow = {
      id: INTENT,
      amount_eur_cents: PRICE,
      wallet_eur_cents: 0,
    };
    const response = await post();
    expect(await response.json()).toEqual({
      url: `/checkout/${INTENT}`,
      declined: true,
    });
    expect(
      state.adminCalls.filter((c) => c.fn === 'checkout_release_wallet').length,
    ).toBeGreaterThan(0);
    // a fresh intent for the payment page
    expect(state.inserted).toHaveLength(2);
    expect(state.sessions).toBe(1);
  });
  it('no saved card: the payment page with this session ready', async () => {
    state.cards = [];
    const response = await post();
    expect(await response.json()).toEqual({
      url: `/checkout/${INTENT}`,
      declined: false,
    });
    expect(state.piCreated).toHaveLength(0);
    expect(state.inserted).toHaveLength(1);
  });
  it('balance covers it: no card at all', async () => {
    state.split = { wallet_eur_cents: PRICE, card_eur_cents: 0 };
    const response = await post();
    expect(await response.json()).toEqual({
      url: `/queue/${ORDER}`,
      orderId: ORDER,
    });
    expect(state.piCreated).toHaveLength(0);
    expect(state.adminCalls.some((c) => c.fn === 'create_wallet_order')).toBe(
      true,
    );
  });
  it('a changed price charges nothing', async () => {
    state.body = { amountEurCents: PRICE + 100 };
    const response = await post();
    expect(response.status).toBe(409);
    expect((await response.json()).amountEurCents).toBe(PRICE);
    expect(state.inserted).toHaveLength(0);
  });
  it('an order opened meanwhile voids the authorization', async () => {
    state.piResult = {
      id: 'pi_4',
      status: 'requires_capture',
      amount: PRICE,
      currency: 'eur',
      metadata: { intent_id: INTENT, play_again: SOURCE },
    };
    state.intentRow = {
      id: INTENT,
      amount_eur_cents: PRICE,
      wallet_eur_cents: 0,
    };
    state.paidOrder = { conflict: true };
    const response = await post();
    expect(response.status).toBe(409);
    expect(state.cancelled).toEqual(['pi_4']);
  });
  it('teammate away: refused before anything is created', async () => {
    state.check = { available: false, reason: 'teammate_away' };
    const response = await post();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(
      'Your teammate is offline right now.',
    );
    expect(state.inserted).toHaveLength(0);
  });
});

describe('customer copy', () => {
  it('names why the button is off', () => {
    expect(playAgainNote('teammate_busy', 'Mia')).toContain(
      'Mia is playing another order',
    );
    expect(playAgainNote('teammate_away', 'Mia')).toContain('Mia is offline');
    expect(playAgainNote('streamer', 'Mia')).toBeNull();
    expect(playAgainRefusal('open_order')).toBe(
      'You already have an open order.',
    );
  });
  it('shows where the money comes from', () => {
    expect(
      paymentLines({
        walletEurCents: 200,
        cardEurCents: 607,
        card: { brand: 'visa', last4: '4242' },
      }),
    ).toEqual([
      ['From your Duoly balance', '€2'],
      ['Visa •••• 4242', '€6.07'],
    ]);
    expect(
      paymentLines({ walletEurCents: 0, cardEurCents: 999, card: null }),
    ).toEqual([['On the payment page', '€9.99']]);
  });
});

describe('migrations', () => {
  const pick = readFileSync(
    'supabase/migrations/20261106170000_gold_rerolls_no_pick.sql',
    'utf8',
  );
  const sql = readFileSync(
    'supabase/migrations/20261106180000_play_again.sql',
    'utf8',
  );
  it('the pick window opens for Play again, without the Diamond check', () => {
    const start = pick.slice(
      pick.indexOf('create or replace function public.order_pick_start('),
    );
    const body = start.slice(0, start.indexOf('end $$;'));
    expect(body).toContain("o.queued_at + interval '60 seconds'");
    expect(body).not.toContain('loyalty_level');
    expect(body).toContain(
      'public.order_pick_candidate(o.customer_id, p_source',
    );
  });
  it('customer_play_again checks the order, the customer and the teammate', () => {
    expect(sql).toContain('where id = p_order and customer_id = v_actor');
    for (const reason of [
      'not_done',
      'streamer',
      'free_coaching',
      'open_order',
      'teammate_busy',
      'teammate_away',
      'teammate_unavailable',
    ])
      expect(sql).toContain(`'${reason}'`);
    expect(sql).toContain(
      'grant execute on function public.customer_play_again(uuid) to authenticated;',
    );
  });
});
