import {
  CustomerPerksSchema,
  type CustomerPerks,
} from '../../contracts/orders';
import { servicesFor } from '../../design-reference/lib/catalog.js';

/** Order value at or above which Veteran and up see an order 15 seconds earlier (euro cents). */
export const HIGH_VALUE_EUR_CENTS = 2000;

interface CatalogMode {
  id: string;
  cat: string;
  unit: 'game' | 'hour';
}

/**
 * Pure: the free monthly Play and Learn order is one coaching session (catalog category
 * training) of exactly one unit: 1 hour, or 1 game for the per-game Play and Learn. Bundles are
 * 3, 5 or 10 units, so units === 1 rules them out.
 */
export function freeCoachingFits(request: {
  gameId: string;
  serviceId: string;
  units: number;
}): boolean {
  let modes: CatalogMode[];
  try {
    modes = (servicesFor(request.gameId) as { modes: CatalogMode[] }).modes;
  } catch {
    return false;
  }
  const mode = modes.find((entry) => entry.id === request.serviceId);
  return !!mode && mode.cat === 'training' && request.units === 1;
}

/** Pure: every (game, service) pair that can be the free coaching order. */
export function freeCoachingServices(
  gameIds: readonly string[],
): [string, string][] {
  const pairs: [string, string][] = [];
  for (const gameId of gameIds) {
    const modes = (servicesFor(gameId) as { modes: CatalogMode[] }).modes;
    for (const mode of modes)
      if (mode.cat === 'training') pairs.push([gameId, mode.id]);
  }
  return pairs;
}

/** Customer copy for a free coaching order the database refused. */
export function freeCoachingRefusal(
  reason: 'level' | 'used' | 'service' | string | undefined,
): string {
  if (reason === 'used')
    return 'You already used this month’s free coaching. It comes back on the 1st.';
  if (reason === 'service')
    return 'Free coaching is one coaching session (1 hour or 1 game).';
  return 'Free monthly coaching unlocks at Platinum.';
}

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;

export type PerkCheck =
  | { ok: true; perks: CustomerPerks | null }
  | { ok: false; status: 400 | 409 | 503; error: string };

/**
 * Checks the perks a checkout asks for, as the signed-in customer (RLS client). The database
 * checks again when it creates the order; this only gives a clear answer before any payment.
 */
export async function checkCheckoutPerks(
  rpc: Rpc,
  input: {
    free: boolean;
    gameId: string;
    serviceId: string;
    units: number;
    gg: boolean;
    voice: boolean;
  },
): Promise<PerkCheck> {
  if (!input.free) return { ok: true, perks: null };
  if (input.free && (input.gg || !freeCoachingFits(input)))
    return { ok: false, status: 400, error: freeCoachingRefusal('service') };
  const loaded = await rpc('customer_perks');
  const perks = CustomerPerksSchema.safeParse(loaded.data);
  if (loaded.error || !perks.success)
    return {
      ok: false,
      status: 503,
      error: 'Checkout is unavailable. Try again.',
    };
  if (input.free && !perks.data.freeCoaching.available)
    return {
      ok: false,
      status: 409,
      error: freeCoachingRefusal(
        perks.data.freeCoaching.eligible ? 'used' : 'level',
      ),
    };
  return { ok: true, perks: perks.data };
}

/**
 * Pure: the checkout intent row for a free coaching order. Full list price (teammates see a
 * normal order and get the normal payout), and explicitly no wallet part, no creator code and
 * no creator discount (the database constraint checkout_intents_free_coaching agrees).
 */
export function freeCoachingIntentRow<T extends Record<string, unknown>>(
  row: T,
  input: { customerId: string; expiresAt: string },
) {
  return {
    ...row,
    free_coaching: true,
    wallet_eur_cents: 0,
    first_order_discount_cents: 0,
    ref_code: null,
    customer_id: input.customerId,
    expires_at: input.expiresAt,
  };
}

export type FreeCoachingOutcome =
  | { ok: true; orderId: string }
  | { ok: false; status: 409 | 503; error: string };

/** Pure: maps the create_free_coaching_order answer to what the checkout endpoint returns. */
export function freeCoachingOutcome(created: {
  data: unknown;
  error: unknown;
}): FreeCoachingOutcome {
  const result = (
    created.data && typeof created.data === 'object' ? created.data : null
  ) as {
    order_id?: unknown;
    conflict?: unknown;
    error?: unknown;
    reason?: unknown;
  } | null;
  if (created.error == null && result?.conflict === true)
    return { ok: false, status: 409, error: 'You already have an open order.' };
  if (created.error == null && result?.error === 'free_perk_unavailable')
    return {
      ok: false,
      status: 409,
      error: freeCoachingRefusal(
        typeof result.reason === 'string' ? result.reason : undefined,
      ),
    };
  if (
    created.error != null ||
    result?.error !== undefined ||
    typeof result?.order_id !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(result.order_id)
  )
    return {
      ok: false,
      status: 503,
      error: 'Checkout is unavailable. Try again.',
    };
  return { ok: true, orderId: result.order_id };
}
