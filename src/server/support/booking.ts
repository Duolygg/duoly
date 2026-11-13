// Sparky's booking ticket. When a visitor wants to buy, Sparky calls offer_booking and the chat
// shows a ticket with real prices and one button into the prefilled booking. The service choice
// and every price come from the same code the MCP server and checkout use (find_session,
// calculateQuote, bookingLink), so the ticket never quotes something checkout would not charge.
// Nothing here creates an order or a payment: the customer confirms and pays on duoly.gg.
import { GAMES } from '../../design-reference/lib/games.js';
import { seatRule } from '../../contracts/seats';
import { calculateQuote } from '../pricing';
import { homeLive } from '../home/live';
import {
  resolveGame,
  resolveService,
  services,
  ToolInputError,
} from '../mcp/catalog';
import { bookingLink, callTool } from '../mcp/tools';
import { ticketSchema, type BookingTicket } from './booking-ticket';

export type { BookingTicket } from './booking-ticket';

/** Quantity tiles on the ticket. Checkout allows 1 to 5; 5 carries the quantity discount. */
const TILES = [1, 3, 5] as const;

export const BOOKING_GOALS = [
  'duo',
  'ranked',
  'casual',
  'coaching',
  'teams',
] as const;

export type BookingArgs = {
  game: string;
  goal: (typeof BOOKING_GOALS)[number] | null;
  service: string | null;
  rank: string | null;
  region: string | null;
  quantity: number | null;
  voice: boolean | null;
};

// Tickets are in EUR, so find_session never needs the live EUR to USD rate.
const EUR_ONLY = async () => ({
  rate: 1,
  source: 'fallback' as const,
  date: '',
  fetchedAt: 0,
});

type Deps = {
  fx?: typeof EUR_ONLY;
  live?: typeof homeLive;
};

export type BookingResult =
  | { kind: 'ticket'; ticket: BookingTicket; forModel: Record<string, unknown> }
  | { kind: 'needs'; forModel: Record<string, unknown> }
  | { kind: 'invalid'; forModel: Record<string, unknown> };

const eur = (minor: number) => `€${(minor / 100).toFixed(2)}`;
const pathOf = (href: string) => {
  const url = new URL(href);
  return url.pathname + url.search + url.hash;
};

const squash = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '');

/** Game id from an id, slug, name or common short name ("Valorant", "League", "CS2"). */
export function gameToken(value: string): string {
  const want = squash(value);
  const hit = (
    GAMES as { id: string; name: string; alias?: string; img: string }[]
  ).find((g) =>
    [
      g.id,
      g.name,
      g.alias ?? '',
      g.img.replace(/^.*\//, '').replace(/\.png$/, ''),
    ]
      .map(squash)
      .includes(want),
  );
  return hit?.id ?? value.trim().toLowerCase();
}

/**
 * Whether the person named this game themselves, by name, short name or id
 * ("valorant", "league", "lol", "cs2"). The model must not pick a game for them.
 */
export function gameNamed(gameId: string, texts: string[]): boolean {
  const game = (GAMES as { id: string; name: string; alias?: string }[]).find(
    (g) => g.id === gameId,
  );
  if (!game) return false;
  const text = texts.join(' ').toLowerCase();
  const squashed = squash(text);
  const words = new Set(text.normalize('NFD').split(/[^a-z0-9]+/));
  const long = [game.name, game.alias ?? '']
    .map(squash)
    .filter((n) => n.length >= 4);
  const short = [game.id, game.alias ?? ''].map(squash).filter(Boolean);
  return (
    long.some((n) => squashed.includes(n)) || short.some((n) => words.has(n))
  );
}

/** Tiles: 1, 3 and 5, with an asked-for 2 or 4 taking the middle place. */
export function tilesFor(quantity: number | null): number[] {
  if (quantity === 2 || quantity === 4) return [1, quantity, 5];
  return [...TILES];
}

export async function offerBooking(
  args: BookingArgs,
  deps: Deps = {},
): Promise<BookingResult> {
  try {
    const game = resolveGame(gameToken(args.game));
    // Region tokens too ("eu", "euw"); one the game does not have is left for checkout to ask.
    if (args.region) {
      const regions = [...new Set(services(game.id).flatMap((s) => s.regions))];
      args = {
        ...args,
        region: regions.find((r) => squash(r) === squash(args.region!)) ?? null,
      };
    }
    // Rank tokens are case sensitive in the catalog; people type "plat" or "PLATINUM".
    if (args.rank) {
      const all = [...new Set(services(game.id).flatMap((s) => s.ranks))];
      const want = squash(args.rank).replace(/(?:[0-9]+|i{1,3}|iv)$/, '');
      args = {
        ...args,
        rank:
          all.find((r) => squash(r) === want) ??
          all.find((r) => want.length >= 3 && squash(r).startsWith(want)) ??
          args.rank,
      };
    }
    let service;
    if (args.service) {
      service = resolveService(game.id, args.service);
    } else {
      const found = await callTool(
        'find_session',
        {
          game: game.id,
          ...(args.goal ? { goal: args.goal } : {}),
          ...(args.rank ? { rank: args.rank } : {}),
          ...(args.region && game.id !== 'mc' ? { region: args.region } : {}),
        },
        { fx: deps.fx ?? EUR_ONLY, platform: 'sparky' },
      );
      const data = found.structuredContent as {
        matches: { id: string }[];
        recommendation?: { serviceId: string };
      };
      const id = data.recommendation?.serviceId ?? data.matches[0]?.id;
      if (!id)
        return {
          kind: 'invalid',
          forModel: { error: 'No session fits. Offer catalog_prices.' },
        };
      service = resolveService(game.id, id);
    }

    if (service.ranks.length && !args.rank)
      return {
        kind: 'needs',
        forModel: {
          needs: ['rank'],
          service: service.name,
          ranks: service.ranks,
          note: 'Price depends on rank. Ask for their current rank in one short question, then call offer_booking again with it.',
        },
      };
    if (args.rank && service.ranks.length && !service.ranks.includes(args.rank))
      return {
        kind: 'invalid',
        forModel: {
          error: `Unknown rank. Valid ranks: ${service.ranks.join(', ')}.`,
        },
      };
    const region =
      args.region && service.regions.includes(args.region) ? args.region : null;
    const rank = service.ranks.length ? args.rank : null;
    const voice = args.voice ?? null;
    const seats = seatRule(game.id, service.id).default;

    const options = tilesFor(args.quantity).map((quantity) => {
      const quote = calculateQuote(
        {
          gameId: game.id,
          serviceId: service.id,
          units: quantity,
          seats,
          server: region ?? service.regions[0] ?? 'my world',
          ...(rank ? { rank } : {}),
          ...(game.id === 'mc' ? { edition: 'Java' } : {}),
        },
        { eurToUsd: 1, customerCurrency: 'EUR' },
      );
      return {
        quantity,
        amountMinor: quote.customer.amountMinor,
        fullMinor: quote.subtotalEurMinor,
        discountPercent: quote.quantityDiscountPercent,
        href: pathOf(
          bookingLink(game.id, service.id, 'sparky', {
            ...(rank ? { rank } : {}),
            ...(region ? { region } : {}),
            ...(voice !== null ? { voice } : {}),
            quantity,
          }),
        ),
      };
    });
    // What they asked for, else one: the 5 tile shows its discount without being pushed.
    const selected =
      args.quantity && options.some((o) => o.quantity === args.quantity)
        ? args.quantity
        : 1;

    let online: number | null = null;
    try {
      const live = await callTool(
        'get_availability',
        { game: game.id },
        { live: deps.live, platform: 'sparky' },
      );
      online = (live.structuredContent as { online?: number }).online ?? null;
    } catch {
      online = null;
    }

    const ticket = ticketSchema.parse({
      v: 1,
      game: {
        id: game.id,
        name: game.name,
        img:
          (GAMES as { id: string; img?: string }[]).find(
            (g) => g.id === game.id,
          )?.img ?? null,
      },
      service: {
        id: service.id,
        name: service.name,
        category: service.category,
        unit: service.unit,
      },
      rank,
      region,
      voice,
      currency: 'EUR',
      selected,
      options,
      online,
    });
    return {
      kind: 'ticket',
      ticket,
      forModel: {
        shown: true,
        service: service.name,
        rank,
        region,
        prices: options.map(
          (o) =>
            `${o.quantity} ${service.unit}${o.quantity > 1 ? 's' : ''}: ${eur(o.amountMinor)}${o.discountPercent ? ` (${o.discountPercent}% off)` : ''}`,
        ),
        onlineNow: online,
        note: 'The chat shows a booking ticket with these prices and a Book button right under your reply. Write one or two short sentences that introduce it; do not paste links or list every price. Payment happens at checkout and is only charged when a teammate accepts.',
      },
    };
  } catch (error) {
    if (error instanceof ToolInputError)
      return { kind: 'invalid', forModel: { error: error.message } };
    throw error;
  }
}
