import type { APIContext, APIRoute } from 'astro';
import {
  CREATOR_AUDIENCE_BUCKETS,
  CreatorApplySchema,
  CreatorCodeCheckSchema,
  CreatorPayoutDetailsSchema,
  creatorShortLink,
} from '../../contracts/creator-portal';
import type { AccountContext } from '../auth/context';
import { accountContext } from '../auth/context';
import { mutation } from '../auth/handlers';
import { rpcResponse } from '../admin/handlers';
import { trackRequest } from '../analytics/client';
import { notifyCreatorApplication } from './inbox';
import { qrPng } from './qr';

/**
 * The creator portal endpoints. Everything a creator sees comes from `creator_portal()`, which
 * reads the caller's own data from auth.uid() and never takes an id, so one creator can never ask
 * for another's numbers. Every mutation goes through `mutation()` for the CSRF check and the body
 * size bound, and every body is checked against its schema in src/contracts/creator-portal.ts
 * before the database sees it.
 */

const onlyGet = (account: ReturnType<typeof accountContext>) => {
  const response = account.json({ error: 'Method not allowed.' }, 405);
  response.headers.set('Allow', 'GET');
  return response;
};

/**
 * The generated database types (src/server/auth/database.types.ts) are regenerated from the live
 * schema, which does not have this migration yet, so the creator functions are called by name like
 * the other post-generation RPCs in src/server/admin/handlers.ts.
 */
type Rpc = PromiseLike<{ data: unknown; error: unknown }>;
const call = (
  client: NonNullable<AccountContext['client']>,
  fn: string,
  args?: Record<string, unknown>,
): Rpc => {
  // Bound: supabase-js rpc reads `this`, so a detached copy throws (tests/unit/rpc-binding).
  const rpc = client.rpc.bind(client) as unknown as (
    name: string,
    values?: Record<string, unknown>,
  ) => Rpc;
  return args === undefined ? rpc(fn) : rpc(fn, args);
};

/** Signed-in callers only, with the client the row level policies apply to. */
async function caller(context: APIContext) {
  const account = accountContext(context.request, context.cookies);
  const identity = await account.identity();
  return { account, identity: account.client ? identity : null };
}

export const portal: APIRoute = async (context) => {
  const account = accountContext(context.request, context.cookies);
  try {
    if (context.request.method !== 'GET') return onlyGet(account);
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    const { data, error } = await call(account.client, 'creator_portal');
    const response = rpcResponse(account, data, error);
    if (
      response.status === 200 &&
      (data as { status?: string } | null)?.status === 'creator'
    )
      trackRequest(context, identity.viewer.id, 'creator_dashboard_viewed');
    return response;
  } catch {
    return account.json({ error: 'Creator portal unavailable.' }, 503);
  }
};

export const apply: APIRoute = async (context) => {
  const prepared = await mutation(context, 8192);
  if (prepared.failure || !prepared.body) return prepared.failure!;
  const { account, body } = prepared;
  const parsed = CreatorApplySchema.safeParse(body);
  if (!parsed.success)
    return account.json(
      { error: 'Check your application and try again.' },
      400,
    );
  const form = parsed.data;
  // Honeypot: bots fill every field. Pretend it worked, like the contact form.
  if (form.website) return account.json({ ok: true });
  try {
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json(
        { error: 'Sign in with your Duoly account to apply.' },
        401,
      );
    const { data, error } = await call(account.client, 'creator_apply', {
      p_code: form.code,
      p_name: form.name,
      p_email: form.email,
      p_platform: form.platform,
      p_channel: form.channel,
      p_audience: form.audience,
      p_game: form.game,
      p_country: form.country,
      p_message: form.message,
      p_adult: form.adult,
      p_terms: form.terms,
    });
    const refusal = rpcResponse(account, data, error);
    if (refusal.status !== 200) return refusal;
    const application = (
      data as unknown as {
        application: Record<string, unknown>;
      }
    ).application;
    // The support inbox still gets every application, like the old contact form did.
    await notifyCreatorApplication(context, account, form).catch(
      () => undefined,
    );
    trackRequest(context, identity.viewer.id, 'creator_applied', {
      platform: form.platform.toLowerCase(),
      audience: CREATOR_AUDIENCE_BUCKETS[form.audience],
      game: form.game,
    });
    return account.json({ application }, 201);
  } catch {
    return account.json(
      { error: 'Could not send your application. Please try again.' },
      503,
    );
  }
};

// Bounded, per-account burst protection for the live code check, next to CSRF and the body bound.
// Like the other application limits this is not a replacement for edge abuse protection.
const checks = new Map<string, { at: number; count: number }>();
export function allowCreatorApplyCheck(id: string, now = Date.now()): boolean {
  const previous = checks.get(id);
  if (previous && now - previous.at < 60_000) return ++previous.count <= 20;
  checks.delete(id);
  if (checks.size >= 2000) checks.delete(checks.keys().next().value!);
  checks.set(id, { at: now, count: 1 });
  return true;
}

export const codeCheck: APIRoute = async (context) => {
  const prepared = await mutation(context, 512);
  if (prepared.failure || !prepared.body) return prepared.failure!;
  const { account, body } = prepared;
  const parsed = CreatorCodeCheckSchema.safeParse(body);
  if (!parsed.success)
    return account.json({
      code: '',
      available: false,
      reason: 'Codes are 3 to 20 letters or numbers.',
    });
  try {
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json(
        { error: 'Sign in with your Duoly account to apply.' },
        401,
      );
    if (!allowCreatorApplyCheck(identity.viewer.id))
      return account.json(
        { error: 'Too many checks. Try again in a minute.' },
        429,
      );
    const { data, error } = await call(
      account.client,
      'creator_code_available',
      {
        p_code: parsed.data.code,
      },
    );
    return rpcResponse(account, data, error);
  } catch {
    return account.json({ error: 'Could not check that code.' }, 503);
  }
};

export const payoutDetails: APIRoute = async (context) => {
  const prepared = await mutation(context, 4096);
  if (prepared.failure || !prepared.body) return prepared.failure!;
  const { account, body } = prepared;
  const parsed = CreatorPayoutDetailsSchema.safeParse(body);
  if (!parsed.success)
    return account.json(
      { error: 'Check every payout detail and try again.' },
      400,
    );
  try {
    const identity = await account.identity();
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    const details = parsed.data;
    const { data, error } = await call(
      account.client,
      'creator_save_payout_details',
      {
        p_legal_name: details.legalName,
        p_address: details.address,
        p_country: details.country,
        p_method: details.method,
        p_account: details.account,
        p_business: details.business,
        p_vat_id: details.vatId,
        p_self_billing: details.selfBilling,
      },
    );
    return rpcResponse(account, data, error);
  } catch {
    return account.json({ error: 'Payout details unavailable.' }, 503);
  }
};

/** The QR code for the caller's own short link, as a PNG download. */
export const qr: APIRoute = async (context) => {
  const { account, identity } = await caller(context).catch(() => ({
    account: accountContext(context.request, context.cookies),
    identity: null,
  }));
  try {
    if (context.request.method !== 'GET') return onlyGet(account);
    if (!identity || !account.client)
      return account.json({ error: 'Authentication required.' }, 401);
    const { data, error } = await call(account.client, 'creator_portal');
    const code = (data as { creator?: { code?: string } } | null)?.creator
      ?.code;
    if (error || typeof code !== 'string' || !code)
      return account.json({ error: 'Creator account required.' }, 403);
    const origin =
      account.config?.origin ?? new URL(context.request.url).origin;
    const png = qrPng(creatorShortLink(code, origin), 10, 4);
    // A plain ArrayBuffer, which is a body type in both the DOM and the Node typings.
    const body = png.buffer.slice(
      png.byteOffset,
      png.byteOffset + png.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(png.length),
        'Content-Disposition': `attachment; filename="duoly-${code.toLowerCase()}-qr.png"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return account.json({ error: 'Creator portal unavailable.' }, 503);
  }
};
