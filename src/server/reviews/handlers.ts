import { trackRequest } from '../analytics/client';
import type { APIRoute } from 'astro';
import {
  ReviewInputSchema,
  TeammateStatsResponseSchema,
} from '../../contracts/reviews';
import {
  TIP_MAX_CENTS,
  TIP_MIN_CENTS,
  TIP_USD_MAX_CENTS,
  TIP_USD_MIN_CENTS,
  TipPreparedSchema,
  type TipShown,
} from '../../contracts/tips';
import { customerUsdRate, eurToUsd } from '../fx';
import { adminFor, paymentsConfig, stripeFor } from '../payments/config';
import { createTipIntent } from '../tips/handler';
import {
  OrderCommandSchema,
  OrderRpcErrorSchema,
} from '../../contracts/orders';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { decodeOrderRpcResult } from '../orders/results';

// Original customer copy from lib/orders.js review() (lines 278 to 282). Any other
// backend message falls back to the generic order boundary text.
const REVIEW_MESSAGES = new Set([
  'You can rate your teammate once the order is done.',
  'You already rated this order. Thank you!',
  'Pick 1 to 5 stars.',
]);

export const review: APIRoute = async (context) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (context.request.method !== 'POST') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'POST');
      return response;
    }
    const prepared = await mutation(context);
    account = prepared.account;
    if (prepared.failure) return prepared.failure;
    const input = ReviewInputSchema.safeParse(prepared.body);
    if (!input.success)
      return account.json({ error: 'Invalid order request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'customer')
      return account.json({ error: 'Order access denied.' }, 403);
    const command = OrderCommandSchema.safeParse({
      order_id: context.params.id,
    });
    if (!command.success || context.url.search)
      return account.json({ error: 'Invalid order request.' }, 400);
    // A US customer picks the tip in dollars; it is charged in EUR at the customer rate (the
    // rate the homepage shows USD prices at), and the dollar amount is kept to show back to them.
    const pickedCents = input.data.tip_cents;
    const usd = pickedCents > 0 && input.data.tip_currency === 'USD';
    if (
      usd &&
      (pickedCents < TIP_USD_MIN_CENTS || pickedCents > TIP_USD_MAX_CENTS)
    )
      return account.json({ error: 'Tips can be from $2 to $100.' }, 400);
    const config = pickedCents ? paymentsConfig() : null;
    if (pickedCents && !config)
      return account.json(
        { error: 'Tip payments are unavailable right now.' },
        503,
      );
    const admin = config ? adminFor(config) : null;
    const fx = pickedCents ? await eurToUsd() : null;
    const tipCents = usd
      ? Math.round(pickedCents / customerUsdRate(fx!.rate))
      : pickedCents;
    if (tipCents && (tipCents < TIP_MIN_CENTS || tipCents > TIP_MAX_CENTS))
      return account.json({ error: 'Tips can be from $2 to $100.' }, 400);
    const reviewRpc = account.client.rpc.bind(account.client) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
    const { data, error } = await reviewRpc('order_review_tip', {
      p_order_id: command.data.order_id,
      p_rating: input.data.rating,
      p_text: input.data.text,
      p_tags: input.data.tags,
      p_amount_cents: tipCents || null,
    });
    const raw = data as { order?: unknown; tipPrepared?: unknown } | null;
    let result = decodeOrderRpcResult(
      'customerOrder',
      raw?.order ? { order: raw.order } : data,
      error,
    );
    // Record only the original successful write, before the tip retry can replace result.
    if (result.ok)
      trackRequest(context, identity.viewer.id, 'review_submitted', {
        rating: input.data.rating,
        tag_count: input.data.tags.length,
        has_tip: tipCents > 0,
      });
    let preparedValue = raw?.tipPrepared;
    const refusal = OrderRpcErrorSchema.safeParse(data);
    if (
      !result.ok &&
      tipCents &&
      (error === null || error === undefined) &&
      refusal.success &&
      refusal.data.error.message === 'You already rated this order. Thank you!'
    ) {
      const pending = await admin!.rpc('order_tip_pending', {
        p_order_id: command.data.order_id,
        p_customer_id: identity.viewer.id,
      });
      const parsedPending = TipPreparedSchema.safeParse(pending.data);
      if (
        !pending.error &&
        parsedPending.success &&
        parsedPending.data.amountCents === tipCents
      ) {
        const current = await reviewRpc('customer_order', {
          p_order_id: command.data.order_id,
        });
        result = decodeOrderRpcResult(
          'customerOrder',
          current.data,
          current.error,
        );
        preparedValue = parsedPending.data;
      }
    }
    if (!result.ok && (error === null || error === undefined)) {
      if (refusal.success && REVIEW_MESSAGES.has(refusal.data.error.message))
        return account.json(
          { error: refusal.data.error.message },
          result.status,
        );
    }
    if (!result.ok) return account.json(result.payload, result.status);
    if (!tipCents) return account.json(result.payload, result.status);
    const tipPrepared = TipPreparedSchema.safeParse(preparedValue);
    if (!tipPrepared.success)
      return account.json(
        {
          ...result.payload,
          tipError: 'Your rating was saved. The tip could not open.',
        },
        200,
      );
    // a new tip picked in dollars: remember the dollar amount (the stored tip is in EUR)
    let shown: TipShown | null = tipPrepared.data.tip.shown ?? null;
    if (usd && tipPrepared.data.paymentIntentId === null) {
      const picked: TipShown = { currency: 'USD', amount: pickedCents / 100 };
      const set = await admin!
        .rpc('order_tip_set_shown', {
          p_tip_id: tipPrepared.data.tipId,
          p_currency: 'USD',
          p_amount_cents: pickedCents,
        })
        .then(
          (r: { data: unknown; error: unknown }) => !r.error && r.data === true,
          () => false,
        );
      if (set) {
        shown = picked;
        const order = (result.payload as { order?: { tip?: object | null } })
          .order;
        if (order?.tip) order.tip = { ...order.tip, shown };
      }
    }
    try {
      const tipPayment = await createTipIntent({
        stripe: stripeFor(config!),
        rpc: admin!.rpc.bind(admin!) as unknown as (
          name: string,
          args: Record<string, unknown>,
        ) => PromiseLike<{ data: unknown; error: unknown }>,
        prepared: tipPrepared.data,
        email: identity.viewer.email,
        fx: fx!.rate,
        publishableKey: config!.publishableKey,
        shown,
      });
      return account.json({ ...result.payload, tipPayment });
    } catch {
      return account.json(
        {
          ...result.payload,
          tipError: 'Your rating was saved. The tip could not open.',
        },
        200,
      );
    }
  } catch {
    return account.json({ error: 'Order service unavailable.' }, 503);
  }
};

export const stats: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    if (context.request.method !== 'GET') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET');
      return response;
    }
    if (context.url.search)
      return account.json({ error: 'Invalid stats request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json({ error: 'Stats access denied.' }, 403);
    const { data, error } = await account.client.rpc('teammate_stats');
    if (error !== null && error !== undefined)
      return account.json({ error: 'Stats service unavailable.' }, 503);
    const refusal = OrderRpcErrorSchema.safeParse(data);
    if (refusal.success)
      return account.json(
        { error: 'Stats unavailable.' },
        refusal.data.error.code,
      );
    const parsed = TeammateStatsResponseSchema.safeParse(data);
    if (!parsed.success)
      return account.json({ error: 'Invalid stats service response.' }, 502);
    return account.json(parsed.data);
  } catch {
    return account.json({ error: 'Stats service unavailable.' }, 503);
  }
};
