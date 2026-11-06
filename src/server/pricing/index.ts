import { z } from 'zod';
import { servicesFor as sourceServicesFor } from '../../design-reference/lib/catalog.js';
import { GAME_IDS } from '../../design-reference/lib/games.js';
import { rankPrice, ranksOf } from '../../design-reference/lib/ranks.js';
import { isServer } from '../../design-reference/lib/servers.js';
import {
  bookingUnitCents,
  checkSeats,
  isGroupService,
  MAX_SEATS,
} from '../../contracts/seats';
import type {
  QuoteContext,
  QuoteInput,
  QuotePreview,
} from '../../contracts/pricing';

// Type-only adapter for the existing JS catalog; no copied catalog or price table.
interface CatalogService {
  id: string;
  cat: string;
  price: number;
  was?: number;
  unit: 'game' | 'hour';
}
const servicesFor = sourceServicesFor as (gameId: string) => {
  modes: CatalogService[];
};

const selectionSchema = z.strictObject({
  gameId: z.string(),
  serviceId: z.string(),
  units: z.number().int().min(1).max(10),
  server: z.string(),
  rank: z.string().optional(),
  edition: z.enum(['Java', 'Bedrock']).optional(),
  ign: z
    .string()
    .min(2)
    .max(40)
    .refine((value) => value.trim().length >= 2)
    .optional(),
  seats: z.number().int().min(1).max(MAX_SEATS).optional(),
});

/** Throws on invalid selections; revalidated by calculateQuote at the trust boundary. */
export function parseQuoteInput(input: unknown): QuoteInput {
  const selection = selectionSchema.parse(input);
  if (!GAME_IDS.includes(selection.gameId)) throw new Error('Unknown game');
  const service = servicesFor(selection.gameId).modes.find(
    (mode) => mode.id === selection.serviceId,
  );
  if (!service) throw new Error('Unknown service');
  // Teams tab services are booked by seat (team orders, 20261106190000_team_orders); a Teams
  // listing without a seat rule stays unbookable rather than silently becoming one teammate.
  if (
    service.cat === 'other' &&
    !isGroupService(selection.gameId, selection.serviceId)
  )
    throw new Error('Teams services are not supported');
  checkSeats(selection.gameId, selection.serviceId, selection.seats ?? 1);
  if (selection.gameId === 'mc') {
    if (selection.server.trim().length < 2 || !selection.edition)
      throw new Error('Minecraft needs a server/world and edition');
  } else {
    if (!isServer(selection.gameId, selection.server))
      throw new Error('Invalid server');
    if (selection.edition !== undefined)
      throw new Error('Edition is only for Minecraft');
  }
  const ranks = ranksOf(selection.gameId, selection.serviceId);
  if (
    ranks.length
      ? !ranks.includes(selection.rank ?? '')
      : selection.rank !== undefined
  ) {
    throw new Error('Invalid service rank');
  }
  return Object.freeze(selection);
}

const contextSchema = z.strictObject({
  eurToUsd: z.number().positive(),
  customerCurrency: z.enum(['EUR', 'USD']).optional(),
  firstCoachingSessionEligible: z.boolean().optional(),
});

export function calculateQuote(
  input: unknown,
  trustedContext: QuoteContext,
): QuotePreview {
  const context = contextSchema.parse(trustedContext);
  const selection = parseQuoteInput(input);
  const service = servicesFor(selection.gameId).modes.find(
    (mode) => mode.id === selection.serviceId,
  )!;
  const hasFirstSessionOffer =
    service.cat === 'training' &&
    service.id === 'learn' &&
    service.was !== undefined;
  const baseEur = hasFirstSessionOffer
    ? (service.was ?? service.price)
    : service.price;
  const seats = selection.seats ?? 1;
  // Per-seat price × seats, or the whole group's price (src/contracts/seats.ts).
  const unitPriceEurMinor = bookingUnitCents(
    Math.round(
      rankPrice(
        selection.gameId,
        selection.serviceId,
        baseEur,
        selection.rank,
      ) * 100,
    ),
    selection.gameId,
    selection.serviceId,
    seats,
  );
  const subtotalEurMinor = unitPriceEurMinor * selection.units;
  // The catalog's floor-to-cents half-price applies to ONE session, not the
  // whole basket. Missing eligibility always means full price.
  const firstSessionDiscountEurMinor =
    hasFirstSessionOffer && context.firstCoachingSessionEligible === true
      ? unitPriceEurMinor - Math.round(service.price * 100)
      : 0;
  const quantityDiscountPercent =
    service.cat === 'training'
      ? 0
      : (({ 3: 10, 5: 15, 10: 25 } as Record<number, number>)[
          selection.units
        ] ?? 0);
  // Round the final EUR amount once, half-up to cents; discount is the residual.
  const afterQuantityEurMinor = Math.round(
    (subtotalEurMinor * (100 - quantityDiscountPercent)) / 100,
  );
  const discountEurMinor = subtotalEurMinor - afterQuantityEurMinor;
  const amountEurMinor = afterQuantityEurMinor - firstSessionDiscountEurMinor;
  // Match source FX: customer mid + 1%, rate rounded to four decimals;
  // payout is 60% at the unmarked mid-rate, rounded to cents then minus 1 cent.
  const customerUsdRate = Math.round(context.eurToUsd * 1.01 * 10000) / 10000;
  const currency = context.customerCurrency ?? 'EUR';
  const customerAmountMinor =
    currency === 'USD'
      ? Math.round(amountEurMinor * customerUsdRate)
      : amountEurMinor;
  // Each teammate earns from one seat's share; the database gives the lead seat the rounding
  // cents of the customer price, never of the payout.
  const seatShareEurMinor = Math.floor(amountEurMinor / seats);
  const teammateAmountMinor = Math.max(
    99,
    Math.round(seatShareEurMinor * 0.6 * context.eurToUsd) - 1,
  );
  if (
    !Number.isFinite(customerUsdRate) ||
    customerUsdRate <= 0 ||
    ![
      unitPriceEurMinor,
      subtotalEurMinor,
      amountEurMinor,
      customerAmountMinor,
      teammateAmountMinor,
    ].every((amount) => Number.isSafeInteger(amount) && amount > 0) ||
    seatShareEurMinor < 99
  ) {
    throw new Error('Quote money is outside supported precision');
  }
  return Object.freeze({
    kind: 'preview',
    selection: Object.freeze({ ...selection }),
    unit: service.unit as 'game' | 'hour',
    seats,
    unitPriceEurMinor,
    subtotalEurMinor,
    amountEurMinor,
    quantityDiscountPercent,
    discountEurMinor,
    firstSessionDiscountEurMinor,
    customer: Object.freeze({ currency, amountMinor: customerAmountMinor }),
    teammate: Object.freeze({
      currency: 'USD',
      amountMinor: teammateAmountMinor,
    }),
    fx: Object.freeze({ eurToUsd: context.eurToUsd, customerUsdRate }),
  });
}
