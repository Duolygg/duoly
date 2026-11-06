import type { APIContext, APIRoute } from 'astro';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { eurToUsd } from '../fx';
import { proEnabled } from '../pro/config';
import { applyOrderDiscounts } from '../pro/discounts';
import { isProMember } from '../pro/status';
import {
  CREATOR_FIRST_ORDER_PERCENT,
  CheckoutRequestSchema,
  SESSION_MINUTES,
  buildCheckout,
  sessionParams,
  type CheckoutRequest,
} from './checkout';
import { adminFor, paymentsConfig, stripeFor } from './config';
import { billingCustomer, existingBillingCustomer } from './customer';
import { confirmEmail } from './confirm-email';
import { walletSplit } from './wallet';
import {
  OrderCommandSchema,
  PlayAgainCheckSchema,
  PlayAgainConfirmSchema,
  PlayAgainInputSchema,
  type PlayAgainOffer,
} from '../../contracts/orders';

// Play again (docs/product/play-again.md, migration 20261106180000_play_again.sql): the same session
// again from the order room, with one tap. The balance pays first, then a card the customer saved
// at checkout (Stripe's "save my payment details" box). It is the customer's own click on our site,
// so the saved card is charged on-session: if the bank asks for 3D Secure, the order room shows it.
// No saved card, or a declined one: the normal payment page with this order ready.
// The intent carries pick_source_order_id, so the same teammate gets the order alone for 60 s.

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
const rpcOf = (client: SupabaseClient) =>
  client.rpc.bind(client) as unknown as Rpc;

/** The columns a Play again copies from the order it replays. */
export interface ReplaySource {
  id: string;
  customer_id: string;
  game: string;
  service: string;
  units: number;
  rank: string;
  region: string;
  ign: string;
  note: string;
  voice: boolean;
  mood: string | null;
  // 20261106190000: the role and coaching character; missing before that migration
  role?: string | null;
  character_name?: string | null;
}
// The whole row, so the role and character come along once the migration added them, and nothing
// breaks before it does.
const SOURCE_COLUMNS = '*';

/**
 * Pure: the checkout request that books the same session again. Minecraft stores
 * "server · edition" as its region; everything else stores the server. null if the order can't
 * be booked any more as it was (a service or option that no longer exists).
 */
export function replayRequest(order: ReplaySource): CheckoutRequest | null {
  let server = order.region;
  let edition: string | undefined;
  if (order.game === 'mc') {
    const at = order.region.lastIndexOf(' · ');
    if (at < 0) return null;
    server = order.region.slice(0, at);
    edition = order.region.slice(at + 3);
  }
  const parsed = CheckoutRequestSchema.safeParse({
    gameId: order.game,
    serviceId: order.service,
    units: order.units,
    server,
    ...(order.rank ? { rank: order.rank } : {}),
    ...(edition ? { edition } : {}),
    ign: order.ign,
    ...(order.note ? { note: order.note } : {}),
    voice: order.voice,
    ...(order.mood ? { mood: order.mood } : {}),
    ...(order.role ? { role: order.role } : {}),
    ...(order.character_name ? { character: order.character_name } : {}),
    useWallet: true,
  });
  return parsed.success ? parsed.data : null;
}

/** Pure: the card Play again uses: a card the customer chose to save (newest first). */
export function savedCard(
  methods: readonly Pick<
    Stripe.PaymentMethod,
    'id' | 'type' | 'card' | 'allow_redisplay' | 'created'
  >[],
): { id: string; brand: string; last4: string } | null {
  const card = [...methods]
    .filter(
      (m) => m.type === 'card' && m.card && m.allow_redisplay === 'always',
    )
    .sort((a, b) => b.created - a.created)[0];
  return card?.card
    ? { id: card.id, brand: card.card.brand, last4: card.card.last4 }
    : null;
}

async function loadSavedCard(
  stripe: Stripe,
  admin: SupabaseClient,
  userId: string,
) {
  const customer = await existingBillingCustomer(admin, userId);
  if (!customer) return null;
  try {
    const list = await stripe.customers.listPaymentMethods(customer, {
      type: 'card',
      limit: 10,
    });
    const card = savedCard(list.data);
    return card ? { ...card, customer } : null;
  } catch {
    return null;
  }
}

type Account = ReturnType<typeof accountContext>;

/** Shared checks: signed-in customer, own order, Play again allowed right now, priced. */
async function prepare(
  context: APIContext,
  account: Account,
  admin: SupabaseClient,
) {
  const identity = await account.identity();
  if (!identity || !account.client)
    return {
      failure: account.json({ error: 'Authentication required.' }, 401),
    };
  if (identity.viewer.role !== 'customer')
    return { failure: account.json({ error: 'Order access denied.' }, 403) };
  const command = OrderCommandSchema.safeParse({ order_id: context.params.id });
  if (!command.success || context.url.search)
    return { failure: account.json({ error: 'Invalid order request.' }, 400) };
  const checked = await rpcOf(account.client)('customer_play_again', {
    p_order: command.data.order_id,
  });
  const check = PlayAgainCheckSchema.safeParse(checked.data);
  if (checked.error || !check.success)
    return {
      failure: account.json(
        { error: 'Play again is unavailable right now.' },
        checked.error ? 503 : 404,
      ),
    };
  const { data: source } = await admin
    .from('orders')
    .select(SOURCE_COLUMNS)
    .eq('id', command.data.order_id)
    .eq('customer_id', identity.viewer.id)
    .maybeSingle();
  const request = source ? replayRequest(source as ReplaySource) : null;
  if (!request)
    return {
      failure: account.json(
        {
          error: 'This session can’t be booked again. Book from the homepage.',
        },
        409,
      ),
    };
  const fx = (await eurToUsd()).rate;
  let built: ReturnType<typeof buildCheckout>;
  try {
    built = buildCheckout(request, fx);
  } catch {
    return {
      failure: account.json(
        {
          error: 'This session can’t be booked again. Book from the homepage.',
        },
        409,
      ),
    };
  }
  const pro = proEnabled()
    ? await isProMember(admin, identity.viewer.id)
    : false;
  // PRO applies again; the creator discount is for a first order only.
  const priced = applyOrderDiscounts(
    built,
    { pro, creator: false },
    CREATOR_FIRST_ORDER_PERCENT,
  );
  return {
    failure: null,
    identity,
    sourceId: command.data.order_id,
    check: check.data,
    built,
    priced,
  };
}

type Ready = Extract<Awaited<ReturnType<typeof prepare>>, { failure: null }>;

/**
 * A checkout intent for the replayed session (pick_source_order_id = the order it replays, so its
 * teammate gets the new order alone for 60 s), with the balance reserved first. null on failure
 * (nothing is left held).
 */
async function replayIntent(admin: SupabaseClient, ready: Ready) {
  const rpc = rpcOf(admin);
  const now = Math.floor(Date.now() / 1000);
  const { data: intent, error } = await admin
    .from('checkout_intents')
    .insert({
      ...ready.priced.row,
      pick_source_order_id: ready.sourceId,
      customer_id: ready.identity.viewer.id,
      expires_at: new Date(
        (now + SESSION_MINUTES * 60 + 60) * 1000,
      ).toISOString(),
    })
    .select('id')
    .single();
  if (error || !intent) return null;
  const release = async () => {
    await rpc('checkout_release_wallet', {
      p_intent_id: intent.id,
      p_status: 'failed',
    });
  };
  const reserved = await rpc('checkout_reserve_wallet', {
    p_intent_id: intent.id,
  });
  const split = reserved.data as {
    wallet_eur_cents?: number;
    card_eur_cents?: number;
  } | null;
  if (
    reserved.error ||
    !split ||
    !Number.isInteger(split.card_eur_cents) ||
    !Number.isInteger(split.wallet_eur_cents) ||
    split.card_eur_cents! < 0 ||
    split.wallet_eur_cents! < 0 ||
    split.card_eur_cents! + split.wallet_eur_cents! !==
      ready.priced.row.amount_eur_cents
  ) {
    await release();
    return null;
  }
  return { id: intent.id as string, card: split.card_eur_cents!, release };
}

const unavailable = (account: Account) =>
  account.json({ error: 'Play again is unavailable right now.' }, 503);

/** GET /api/orders/:id/play-again -> PlayAgainOffer */
export const playAgainOffer: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  const config = paymentsConfig();
  if (!config) return unavailable(account);
  try {
    if (context.request.method !== 'GET') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET');
      return response;
    }
    const admin = adminFor(config);
    const ready = await prepare(context, account, admin);
    if (ready.failure) return ready.failure;
    const amount = ready.priced.row.amount_eur_cents;
    let wallet = 0;
    let card: PlayAgainOffer['card'] = null;
    if (ready.check.available) {
      const balance = await rpcOf(account.client!)('customer_wallet_balance');
      const total = (balance.data as { total_eur_cents?: unknown } | null)
        ?.total_eur_cents;
      wallet = walletSplit(
        amount,
        typeof total === 'number' ? total : 0,
      ).wallet;
      if (wallet < amount) {
        const saved = await loadSavedCard(
          stripeFor(config),
          admin,
          ready.identity.viewer.id,
        );
        card = saved ? { brand: saved.brand, last4: saved.last4 } : null;
      }
    }
    return account.json({
      available: ready.check.available,
      reason: ready.check.reason,
      amountEurCents: amount,
      walletEurCents: wallet,
      cardEurCents: amount - wallet,
      card,
    } satisfies PlayAgainOffer);
  } catch {
    return unavailable(account);
  }
};

/**
 * Turns an authorized Play again card payment into the order (the same checks as a checkout
 * session in webhook.ts fulfil). Used by the button, the 3D Secure confirm and the webhook backup.
 */
export async function fulfilPlayAgain(
  stripe: Stripe,
  admin: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent,
): Promise<
  | { state: 'order'; orderId: string }
  | { state: 'pending' | 'failed' | 'conflict' | 'mismatch' }
> {
  const intentId = paymentIntent.metadata?.intent_id;
  if (!intentId || !paymentIntent.metadata?.play_again)
    return { state: 'mismatch' };
  const { data: row } = await admin
    .from('checkout_intents')
    .select('id, amount_eur_cents, wallet_eur_cents, stripe_payment_intent_id')
    .eq('id', intentId)
    .maybeSingle();
  if (!row || row.stripe_payment_intent_id !== paymentIntent.id)
    return { state: 'mismatch' };
  if (paymentIntent.status === 'requires_action') return { state: 'pending' };
  if (
    paymentIntent.status !== 'requires_capture' &&
    paymentIntent.status !== 'succeeded'
  ) {
    await rpcOf(admin)('checkout_release_wallet', {
      p_intent_id: row.id,
      p_status: 'failed',
    });
    return { state: 'failed' };
  }
  if (
    paymentIntent.currency !== 'eur' ||
    paymentIntent.amount !== row.amount_eur_cents - row.wallet_eur_cents
  )
    return { state: 'mismatch' };
  const created = await rpcOf(admin)('create_paid_order', {
    p_intent_id: row.id,
    p_payment_intent: paymentIntent.id,
    p_amount_minor: paymentIntent.amount,
    p_currency: paymentIntent.currency,
    p_method: 'card',
    p_state:
      paymentIntent.status === 'requires_capture' ? 'authorized' : 'captured',
  });
  if (created.error) throw new Error('create_paid_order failed');
  const outcome = created.data as {
    order_id?: string;
    created?: boolean;
    conflict?: boolean;
  } | null;
  if (outcome?.conflict) {
    // An order opened meanwhile: give the money back at once.
    if (paymentIntent.status === 'requires_capture')
      await stripe.paymentIntents.cancel(
        paymentIntent.id,
        { cancellation_reason: 'duplicate' },
        { idempotencyKey: `void_conflict_${row.id}` },
      );
    else
      await stripe.refunds.create(
        { payment_intent: paymentIntent.id, reason: 'duplicate' },
        { idempotencyKey: `refund_conflict_${row.id}` },
      );
    return { state: 'conflict' };
  }
  if (!outcome?.order_id) return { state: 'mismatch' };
  if (outcome.created)
    await confirmEmail(
      admin,
      outcome.order_id,
      paymentIntent.receipt_email ?? null,
      'card',
    ).catch(() => undefined);
  return { state: 'order', orderId: outcome.order_id };
}

/**
 * POST /api/orders/:id/play-again { csrf, amountEurCents }
 * -> { url } (the new order room, or the payment page) | { clientSecret, intentId } (3D Secure)
 */
export const playAgain: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  const config = paymentsConfig();
  if (!config) return unavailable(account);
  if (context.request.method !== 'POST') {
    const response = account.json({ error: 'Method not allowed.' }, 405);
    response.headers.set('Allow', 'POST');
    return response;
  }
  const prepared = await mutation(context);
  account = prepared.account;
  if (prepared.failure) return prepared.failure;
  const input = PlayAgainInputSchema.safeParse(prepared.body);
  if (!input.success)
    return account.json({ error: 'Invalid order request.' }, 400);
  const admin = adminFor(config);
  const rpc = rpcOf(admin);
  try {
    const ready = await prepare(context, account, admin);
    if (ready.failure) return ready.failure;
    if (!ready.check.available)
      return account.json(
        {
          error: playAgainRefusal(ready.check.reason),
          reason: ready.check.reason,
        },
        409,
      );
    const viewer = ready.identity.viewer;
    const blocked = await admin
      .from('customer_blocks')
      .select('user_id')
      .eq('user_id', viewer.id)
      .maybeSingle();
    if (blocked.error) return unavailable(account);
    if (blocked.data)
      return account.json(
        {
          error:
            'Your account can’t book right now. Contact us at hello@duoly.gg.',
        },
        403,
      );
    const amount = ready.priced.row.amount_eur_cents;
    if (amount !== input.data.amountEurCents)
      return account.json(
        {
          error: 'The price of this session changed. Check it and try again.',
          amountEurCents: amount,
        },
        409,
      );
    const intent = await replayIntent(admin, ready);
    if (!intent) return unavailable(account);
    const release = intent.release;
    const queue = (orderId: string) =>
      account.json({ url: `/queue/${orderId}`, orderId });
    // The balance covers it: no card at all.
    if (intent.card === 0) {
      const paid = await rpc('create_wallet_order', { p_intent_id: intent.id });
      const result = paid.data as {
        order_id?: string;
        conflict?: boolean;
      } | null;
      if (paid.error || !result) {
        await release();
        return unavailable(account);
      }
      if (result.conflict)
        return account.json({ error: 'You already have an open order.' }, 409);
      if (!result.order_id) {
        await release();
        return unavailable(account);
      }
      return queue(result.order_id);
    }
    const stripe = stripeFor(config);
    const saved = await loadSavedCard(stripe, admin, viewer.id);
    let declined = false;
    if (saved) {
      let paymentIntent: Stripe.PaymentIntent | null = null;
      try {
        paymentIntent = await stripe.paymentIntents.create(
          {
            amount: intent.card,
            currency: 'eur',
            customer: saved.customer,
            payment_method: saved.id,
            // a saved card: 3D Secure, if the bank wants it, runs in the order room (no redirect)
            automatic_payment_methods: {
              enabled: true,
              allow_redirects: 'never',
            },
            confirm: true,
            // charged now, like every order (charge at queue, 2026-11-06); a cancelled order gives
            // it back as Duoly balance
            description: `Duoly · ${ready.built.productName} · Play again`,
            ...(viewer.email ? { receipt_email: viewer.email } : {}),
            metadata: {
              intent_id: intent.id,
              customer_id: viewer.id,
              play_again: ready.sourceId,
            },
          },
          { idempotencyKey: `play_again_${intent.id}` },
        );
      } catch (failure) {
        // Declined (Stripe answers 402 with the failed PaymentIntent): use the payment page.
        paymentIntent =
          (failure as { raw?: { payment_intent?: Stripe.PaymentIntent } })?.raw
            ?.payment_intent ?? null;
        declined = true;
      }
      if (paymentIntent?.id) {
        await admin
          .from('checkout_intents')
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', intent.id);
        if (paymentIntent.status === 'requires_action')
          return account.json({
            clientSecret: paymentIntent.client_secret,
            intentId: intent.id,
          });
        const done = await fulfilPlayAgain(stripe, admin, paymentIntent);
        if (done.state === 'order') return queue(done.orderId);
        if (done.state === 'conflict')
          return account.json(
            { error: 'You already have an open order.' },
            409,
          );
        if (done.state === 'failed') declined = true;
        else return unavailable(account);
      }
      if (declined) {
        await release();
        // A new intent for the payment page, so the declined one stays closed.
        const fresh = await replayIntent(admin, ready);
        if (!fresh) return unavailable(account);
        return openPaymentPage(account, admin, stripe, ready, fresh, true);
      }
    }
    // No saved card: this intent goes to the payment page.
    return openPaymentPage(account, admin, stripe, ready, intent, false);
  } catch {
    return unavailable(account);
  }
};

/** No saved card or a declined one: the normal payment page with this session ready. */
async function openPaymentPage(
  account: Account,
  admin: SupabaseClient,
  stripe: Stripe,
  ready: Ready,
  intent: NonNullable<Awaited<ReturnType<typeof replayIntent>>>,
  declined: boolean,
) {
  const config = paymentsConfig()!;
  const viewer = ready.identity.viewer;
  const now = Math.floor(Date.now() / 1000);
  const release = intent.release;
  if (intent.card <= 0) {
    await release();
    return unavailable(account);
  }
  const stripeCustomer = await billingCustomer(stripe, admin, {
    id: viewer.id,
    email: viewer.email,
  }).catch(() => null);
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      sessionParams({
        intentId: intent.id,
        customerId: viewer.id,
        email: viewer.email,
        origin: config.origin,
        amountEurCents: intent.card,
        productName: ready.built.productName,
        description: ready.built.description,
        nowSeconds: now,
        stripeCustomer,
      }),
      { idempotencyKey: `checkout_${intent.id}` },
    );
  } catch {
    await release();
    return unavailable(account);
  }
  const updated = await admin
    .from('checkout_intents')
    .update({
      stripe_session_id: session.id,
      stripe_client_secret: session.client_secret,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intent.id);
  if (updated.error) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    await release();
    return unavailable(account);
  }
  return account.json({ url: `/checkout/${intent.id}`, declined });
}

/** POST /api/orders/:id/play-again/confirm { csrf, intentId }: after 3D Secure in the order room. */
export const playAgainConfirm: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  const config = paymentsConfig();
  if (!config) return unavailable(account);
  if (context.request.method !== 'POST') {
    const response = account.json({ error: 'Method not allowed.' }, 405);
    response.headers.set('Allow', 'POST');
    return response;
  }
  const prepared = await mutation(context);
  account = prepared.account;
  if (prepared.failure) return prepared.failure;
  const input = PlayAgainConfirmSchema.safeParse(prepared.body);
  if (!input.success)
    return account.json({ error: 'Invalid order request.' }, 400);
  try {
    const identity = await account.identity();
    if (!identity)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'customer')
      return account.json({ error: 'Order access denied.' }, 403);
    const admin = adminFor(config);
    const { data: row } = await admin
      .from('checkout_intents')
      .select(
        'id, customer_id, pick_source_order_id, order_id, stripe_payment_intent_id',
      )
      .eq('id', input.data.intentId)
      .maybeSingle();
    if (
      !row ||
      row.customer_id !== identity.viewer.id ||
      row.pick_source_order_id !== context.params.id ||
      !row.stripe_payment_intent_id
    )
      return account.json({ error: 'Order not found.' }, 404);
    if (row.order_id)
      return account.json({
        url: `/queue/${row.order_id}`,
        orderId: row.order_id,
      });
    const stripe = stripeFor(config);
    const paymentIntent = await stripe.paymentIntents.retrieve(
      row.stripe_payment_intent_id,
    );
    const done = await fulfilPlayAgain(stripe, admin, paymentIntent);
    if (done.state === 'order')
      return account.json({
        url: `/queue/${done.orderId}`,
        orderId: done.orderId,
      });
    if (done.state === 'pending')
      return account.json({ error: 'Confirm the payment to continue.' }, 409);
    if (done.state === 'conflict')
      return account.json({ error: 'You already have an open order.' }, 409);
    if (done.state === 'failed')
      return account.json(
        { error: 'Your bank didn’t confirm the payment. Nothing was charged.' },
        402,
      );
    return unavailable(account);
  } catch {
    return unavailable(account);
  }
};

/** Customer copy for a Play again the server refused. */
export function playAgainRefusal(reason: string | null | undefined): string {
  switch (reason) {
    case 'teammate_busy':
      return 'Your teammate is playing another order right now.';
    case 'teammate_away':
      return 'Your teammate is offline right now.';
    case 'teammate_unavailable':
      return 'Your teammate can’t take this session right now.';
    case 'open_order':
      return 'You already have an open order.';
    case 'streamer':
      return 'Book the streamer again from the homepage.';
    case 'free_coaching':
      return 'Book your next coaching session from the homepage.';
    default:
      return 'You can play again once your teammate has finished the order.';
  }
}
