import type { APIContext, APIRoute } from 'astro';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { rpcResponse } from '../admin/handlers';
import { adminFor, stripeFor } from '../payments/config';
import { eurToUsd } from '../fx';
import {
  CONNECT_COUNTRIES,
  connectConfig,
  connectWebhookSecret,
  type ConnectConfig,
} from './config';
import {
  accountCreateParams,
  accountFacts,
  preparedTransfer,
  stripeErrorText,
  transferErrorKind,
  transferFacts,
  transferParams,
  type PreparedTransfer,
} from './stripe';
import { handleConnectEvent, handleTransferEvent, syncAccount } from './events';

export { handleConnectEvent, handleTransferEvent, syncAccount };

/**
 * Stripe Connect Express payouts (money step M9, ledger #14 phase 2).
 * Teammates: POST /api/teammate/connect { action: 'onboard' | 'refresh' }, GET for status.
 * Admins: POST /api/admin/payout-stripe { payoutId } pays one Scheduled line with a Transfer.
 * Webhooks: platform events (transfer.*) arrive on /api/webhooks/stripe, connected-account
 * events (account.updated, payout.failed) on the separate /api/webhooks/stripe-connect.
 */

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
const rpcOf = (client: SupabaseClient) =>
  client.rpc.bind(client) as unknown as Rpc;

const UNAVAILABLE = 'Stripe payouts are unavailable right now. Try again.';

const TeammateConnectSchema = z
  .object({
    csrf: z.string().min(1).max(128),
    action: z.enum(['onboard', 'refresh']),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
  })
  .strict();

const StripePaySchema = z
  .object({ csrf: z.string().min(1).max(128), payoutId: z.uuid() })
  .strict();

/** Pure: ISO country of a payout-details country name (or code), if Connect supports it. */
export function connectCountryFor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const upper = text.toUpperCase();
  if (CONNECT_COUNTRIES[upper]) return upper;
  const lower = text.toLowerCase();
  for (const [code, name] of Object.entries(CONNECT_COUNTRIES))
    if (name.toLowerCase() === lower) return code;
  return null;
}

function links(config: ConnectConfig) {
  return {
    refresh_url: `${config.origin}/teammate?connect=refresh#payouts`,
    return_url: `${config.origin}/teammate?connect=return#payouts`,
  };
}

async function teammateStatus(
  client: NonNullable<ReturnType<typeof accountContext>['client']>,
) {
  return client.rpc('teammate_connect_status');
}

/** GET status, POST onboard (create the Express account once, then an account link) or refresh. */
export const teammateConnect: APIRoute = async (context: APIContext) => {
  let account = accountContext(context.request, context.cookies);
  try {
    const method = context.request.method;
    if (method !== 'GET' && method !== 'POST') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'GET, POST');
      return response;
    }
    let input: z.infer<typeof TeammateConnectSchema> | null = null;
    if (method === 'POST') {
      const prepared = await mutation(context, 2048);
      account = prepared.account;
      if (prepared.failure) return prepared.failure;
      const parsed = TeammateConnectSchema.safeParse(prepared.body);
      if (!parsed.success)
        return account.json({ error: 'Invalid payouts request.' }, 400);
      input = parsed.data;
    }
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'teammate')
      return account.json({ error: 'Payout details access denied.' }, 403);
    const config = connectConfig();
    if (!config) {
      if (method === 'GET') return account.json({ enabled: false });
      return account.json(
        { error: 'Stripe payouts are not switched on.' },
        404,
      );
    }
    const teammateId = identity.viewer.id;
    const admin = adminFor(config);
    const stripe = stripeFor(config);
    const existing = await rpcOf(admin)('connect_account_for', {
      p_teammate: teammateId,
    });
    if (existing.error) return account.json({ error: UNAVAILABLE }, 503);
    let accountId =
      (existing.data as { accountId?: string } | null)?.accountId ?? null;

    if (method === 'POST' || context.url.searchParams.get('sync') === '1') {
      if (input?.action === 'onboard' && !accountId) {
        const details = await account.client.rpc('teammate_payout_details');
        const saved = (
          details.data as { details?: { country?: unknown } } | null
        )?.details;
        const country = input.country ?? connectCountryFor(saved?.country);
        if (!country || !CONNECT_COUNTRIES[country])
          return account.json(
            {
              error:
                'Stripe payouts are not available in your country yet. We keep paying you manually.',
            },
            409,
          );
        // One account per teammate even on a double click: same idempotency key for a day,
        // and the database refuses a second account id.
        const params = accountCreateParams({
          teammateId,
          email: identity.viewer.email,
          country,
        });
        if (!params)
          return account.json(
            {
              error:
                'Add an email address to your Duoly account first, Stripe needs one.',
            },
            409,
          );
        const created = await stripe.v2.core.accounts.create(params, {
          idempotencyKey: `duoly-connect-account-${teammateId}-${country}`,
        });
        const linked = await rpcOf(admin)('connect_account_link', {
          p_teammate: teammateId,
          p_account_id: created.id,
          p_country: country,
        });
        if (linked.error) return account.json({ error: UNAVAILABLE }, 503);
        const refusal = (linked.data as { error?: { message?: string } } | null)
          ?.error;
        if (refusal)
          return account.json({ error: refusal.message ?? UNAVAILABLE }, 409);
        accountId = created.id;
      }
      if (accountId) {
        const live = await stripe.accounts.retrieve(accountId);
        const facts = accountFacts(live);
        if (facts) await syncAccount(admin, facts);
      }
      if (input && accountId) {
        // Express onboarding and later updates both go through an account link.
        const link = await stripe.accountLinks.create({
          account: accountId,
          type: 'account_onboarding',
          collection_options: { fields: 'eventually_due' },
          ...links(config),
        });
        return account.json({ url: link.url });
      }
    }
    const status = await teammateStatus(account.client);
    const response = rpcResponse(account, status.data, status.error);
    if (response.status !== 200) return response;
    return account.json({
      ...(status.data as Record<string, unknown>),
      enabled: true,
      countries: Object.keys(CONNECT_COUNTRIES),
    });
  } catch {
    return account.json({ error: UNAVAILABLE }, 503);
  }
};

/**
 * Sends (or re-sends) the Transfer of a prepared row. A resumed row first looks for a
 * transfer Stripe already made for it, so a retry after the 24 hour idempotency window
 * still cannot pay twice.
 */
export async function sendTransfer(
  stripe: Stripe,
  admin: SupabaseClient,
  prepared: PreparedTransfer,
): Promise<
  | { state: 'paid'; transferId: string; recorded: boolean }
  | { state: 'refused'; error: string }
  | { state: 'unknown' }
> {
  let transfer: Stripe.Transfer | null = null;
  if (prepared.resumed) {
    const list = await stripe.transfers.list({
      transfer_group: `payout_line_${prepared.lineId}`,
      limit: 20,
    });
    transfer =
      list.data.find((t) => t.metadata?.payout_transfer_id === prepared.id) ??
      null;
  }
  if (!transfer) {
    try {
      transfer = await stripe.transfers.create(transferParams(prepared), {
        idempotencyKey: prepared.idempotencyKey,
      });
    } catch (error) {
      if (transferErrorKind(error) === 'unknown') return { state: 'unknown' };
      const text = stripeErrorText(error);
      const failed = await rpcOf(admin)('payout_stripe_fail', {
        p_transfer_id: prepared.id,
        p_error: text,
      });
      if (failed.error) return { state: 'unknown' };
      return { state: 'refused', error: text };
    }
  }
  const facts = transferFacts(transfer);
  const recorded = await rpcOf(admin)('payout_stripe_record', {
    p_transfer_id: prepared.id,
    p_stripe_transfer_id: transfer.id,
    p_destination: facts?.destination ?? null,
    p_amount_minor: transfer.amount,
    p_currency: transfer.currency,
  });
  // Not recorded here: the transfer.created webhook records it. The line stays locked meanwhile.
  return {
    state: 'paid',
    transferId: transfer.id,
    recorded:
      !recorded.error &&
      (recorded.data as { recorded?: boolean; reason?: string } | null)
        ?.recorded === true,
  };
}

/** POST /api/admin/payout-stripe { payoutId }: Pay via Stripe for one Scheduled line. */
export const adminPayoutStripe: APIRoute = async (context: APIContext) => {
  let account = accountContext(context.request, context.cookies);
  try {
    if (context.request.method !== 'POST') {
      const response = account.json({ error: 'Method not allowed.' }, 405);
      response.headers.set('Allow', 'POST');
      return response;
    }
    const prepared = await mutation(context, 1024);
    account = prepared.account;
    if (prepared.failure) return prepared.failure;
    const parsed = StripePaySchema.safeParse(prepared.body);
    if (!parsed.success)
      return account.json({ error: 'Invalid admin request.' }, 400);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    if (identity.viewer.role !== 'admin')
      return account.json({ error: 'Not found.' }, 404);
    const config = connectConfig();
    if (!config)
      return account.json(
        { error: 'Stripe payouts are not switched on.' },
        404,
      );
    let fx: number | null = null;
    if (config.transferCurrency === 'eur') {
      const rate = await eurToUsd();
      // Never pay at the fallback rate: wait for a real ECB rate.
      if (rate.source !== 'ecb')
        return account.json(
          { error: 'Today’s ECB rate is not available yet. Try again later.' },
          503,
        );
      fx = rate.rate;
    }
    const admin = adminFor(config);
    const result = await rpcOf(admin)('payout_stripe_prepare', {
      p_line_id: parsed.data.payoutId,
      p_actor: identity.viewer.id,
      p_currency: config.transferCurrency,
      p_fx: fx,
      p_fx_source: fx === null ? null : 'ecb',
    });
    if (result.error) return account.json({ error: UNAVAILABLE }, 503);
    const transfer = preparedTransfer(result.data);
    if (!transfer) return rpcResponse(account, result.data, result.error);
    const sent = await sendTransfer(stripeFor(config), admin, transfer);
    if (sent.state === 'unknown')
      return account.json(
        {
          error:
            'Stripe did not confirm the transfer. Press Pay via Stripe again, it will not pay twice.',
        },
        502,
      );
    if (sent.state === 'refused')
      return account.json(
        { error: `Stripe refused the transfer: ${sent.error}` },
        409,
      );
    const payouts = await account.client.rpc('admin_payouts');
    return account.json({
      ok: true,
      transferId: sent.transferId,
      recorded: sent.recorded,
      payouts: payouts.data,
    });
  } catch {
    return account.json({ error: UNAVAILABLE }, 503);
  }
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

/** POST /api/webhooks/stripe-connect: the separate Connect endpoint ("Events on connected accounts"). */
export const stripeConnectWebhook: APIRoute = async ({ request }) => {
  const config = connectConfig();
  const secret = connectWebhookSecret();
  if (!config || !secret) return json({ error: 'not_configured' }, 503);
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();
  if (!signature || body.length > 512_000)
    return json({ error: 'bad_request' }, 400);
  const stripe = stripeFor(config);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return json({ error: 'invalid_signature' }, 400);
  }
  const admin = adminFor(config);
  const seen = await admin
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();
  if (seen.data) return json({ received: true, duplicate: true });
  let outcome: string;
  try {
    outcome =
      (await handleConnectEvent(admin, event)) ??
      (await handleTransferEvent(admin, event)) ??
      'ignored';
  } catch {
    return json({ error: 'processing_failed' }, 500);
  }
  await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  return json({ received: true, outcome });
};
