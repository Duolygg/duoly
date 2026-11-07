import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { parseBookingPreferences } from '../../contracts/booking-link';
import { seatRule } from '../../contracts/seats';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import {
  CARD_URIS,
  cardData,
  registerCards,
  type CardSelection,
} from './cards';
import {
  games,
  resolveGame,
  resolveService,
  services,
  ToolInputError,
} from './catalog';
import { calculateQuote } from '../pricing';
import { eurToUsd } from '../fx';
import { GOALS, goalOf, goalServices, type Goal } from './goals';
import { homeLive } from '../home/live';
import { serverTrack, flushAnalytics } from '../analytics/client';

export const TOOL_NAMES = [
  'list_games',
  'list_services',
  'find_session',
  'get_quote',
  'get_availability',
  'create_booking_link',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export type Platform =
  'claude' | 'chatgpt' | 'gemini' | 'perplexity' | 'mistral' | 'other';
export function platformOf(value: string): Platform {
  const name = value.toLowerCase().slice(0, 256);
  if (/claude|anthropic/.test(name)) return 'claude';
  if (/chatgpt|openai/.test(name)) return 'chatgpt';
  if (/gemini/.test(name)) return 'gemini';
  if (/perplexity/.test(name)) return 'perplexity';
  if (/mistral/.test(name)) return 'mistral';
  return 'other';
}
const game = z
  .string()
  .min(1)
  .max(64)
  .describe('Game id or slug from list_games.');
const service = z
  .string()
  .min(1)
  .max(64)
  .describe('Bookable service id from list_services.');
const link = z.url();
const gameOutput = z.object({
  id: z.string(),
  slug: z.string(),
  bookUrl: link,
  name: z.string(),
  url: link,
});
const fromPriceOutput = z.object({
  amountMinor: z.number().int(),
  currency: z.literal('EUR'),
  unit: z.enum(['game', 'hour']),
  quantity: z.literal(1),
  basis: z.literal('base price before account perks'),
});
const serviceOutput = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  fromPrice: fromPriceOutput,
  priceNote: z.string(),
  typicalPrice: z
    .object({
      rank: z.string(),
      quantity: z.literal(1),
      amountMinor: z.number().int(),
      currency: z.literal('EUR'),
    })
    .optional(),
  unit: z.enum(['game', 'hour']),
  ranks: z.array(z.string()),
  regions: z.array(z.string()),
  editions: z.array(z.string()),
  roles: z.array(z.string()),
  characterLabel: z.string(),
  seats: z.object({
    min: z.number(),
    max: z.number(),
    default: z.number(),
    groupPrice: z.literal(true).optional(),
  }),
  voice: z.array(z.boolean()),
  moods: z.array(z.string()),
  requiredInputs: z.array(z.string()),
  bookUrl: link,
  url: link,
});
const preferences = {
  role: z
    .string()
    .min(1)
    .max(24)
    .optional()
    .describe(
      'Exact role token from list_services, including Fill/Flex/Any for no preference.',
    ),
  character: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .optional()
    .describe(
      'One free-text character, only for character-bearing coaching services. Never use agent for this.',
    ),
  voice: z.boolean().optional(),
  mood: z.enum(['chill', 'tryhard', 'teach', 'fun']).optional(),
  seats: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .describe(
      'Hired teammates, excluding the customer and friends. Must match the service seat rule.',
    ),
};
const inputs = {
  find_session: z.strictObject({
    ...preferences,
    game,
    goal: z
      .string()
      .min(1)
      .max(64)
      .optional()
      .describe(
        'Goal text matched by explicit keyword rules; use goalType to resolve ambiguity.',
      ),
    goalType: z.enum(GOALS).optional(),
    category: z
      .string()
      .min(1)
      .max(64)
      .optional()
      .describe(
        'Category token: duo, training, other; coaching and teams are aliases.',
      ),
    rank: z.string().min(1).max(40).optional(),
    region: z
      .string()
      .min(2)
      .max(60)
      .optional()
      .describe('Exact server token, alias for server.'),
    server: z.string().min(2).max(60).optional(),
    quantity: z.number().int().min(1).max(10).optional(),
    budget: z
      .number()
      .positive()
      .max(100000)
      .optional()
      .describe('Maximum total price in the specified currency.'),
    currency: z.enum(['EUR', 'USD']).optional(),
    edition: z.enum(['Java', 'Bedrock']).optional(),
  }),
  list_games: z.strictObject({}),
  list_services: z.strictObject({ game }),
  get_quote: z.strictObject({
    seats: preferences.seats,
    game,
    service,
    rank: z.string().max(40).optional(),
    quantity: z.number().int().min(1).max(10),
    currency: z.enum(['EUR', 'USD'], {
      error:
        'currency is required. Valid inputs: game, service, rank when rank-priced, server, quantity (1..10), currency (EUR or USD); Minecraft also requires edition (Java or Bedrock). Use list_services for valid service, rank and server tokens.',
    }),
    server: z
      .string()
      .min(2)
      .max(60)
      .describe(
        'Region token from list_services or Minecraft server/world. Never include credentials.',
      ),
    edition: z.enum(['Java', 'Bedrock']).optional(),
  }),
  get_availability: z.strictObject({ game: game.optional() }),
  create_booking_link: z.strictObject({
    ...preferences,
    edition: z.enum(['Java', 'Bedrock']).optional(),
    server: z.string().trim().min(2).max(60).optional(),
    game,
    service: service.optional(),
    rank: z.string().min(1).max(40).optional(),
    region: z.string().min(2).max(60).optional(),
    quantity: z.number().int().min(1).max(10).optional(),
    currency: z.enum(['EUR', 'USD']).optional(),
  }),
};
const outputs = {
  find_session: z.object({
    game: z.string(),
    matches: z
      .array(
        serviceOutput
          .pick({
            id: true,
            name: true,
            category: true,
            description: true,
            unit: true,
            bookUrl: true,
            priceNote: true,
          })
          .extend({
            fromPrice: fromPriceOutput.optional(),
            representativePrice: z
              .object({
                rank: z.string().optional(),
                perUnitMinor: z.number().int(),
                savingMinor: z.number().int(),
                bundleDiscountPercent: z.number(),
                quantity: z.number().int(),
                amountMinor: z.number().int(),
                currency: z.enum(['EUR', 'USD']),
              })
              .optional(),
            perUnitMinor: z.number().int(),
            savingMinor: z.number().int(),
            bundleDiscountPercent: z.number(),
            priceKind: z.enum(['exact', 'from']),
            amountMinor: z.number().int(),
            currency: z.enum(['EUR', 'USD']),
            formattedPrice: z.string(),
            quantity: z.number().int(),
            missingInputs: z.array(z.string()),
          }),
      )
      .max(3),
    missingInputs: z.array(z.string()),
    recommendation: z
      .object({ serviceId: z.string(), goal: z.string(), reason: z.string() })
      .optional(),
    budgetApplied: z.boolean(),
    notice: z.string(),
  }),
  list_games: z.object({ games: z.array(gameOutput), url: link }),
  list_services: z.object({
    game: z.string(),
    services: z.array(serviceOutput),
    url: link,
  }),
  get_quote: z.object({
    kind: z.literal('preview'),
    basis: z.literal('base price before account perks'),
    notReserved: z.literal(true),
    currency: z.enum(['EUR', 'USD']),
    amountMinor: z.number().int(),
    amountEurMinor: z.number().int(),
    perUnitMinor: z.number().int(),
    savingMinor: z.number().int(),
    bundleDiscountPercent: z.number(),
    formattedPrice: z.string(),
    unit: z.enum(['game', 'hour']),
    quantity: z.number().int(),
    quotedAt: z.string(),
    fx: z.object({
      rate: z.number(),
      source: z.enum(['ecb', 'fallback']),
      date: z.string(),
      fetchedAt: z.number(),
    }),
    notice: z.string(),
    bookUrl: link,
    url: link,
  }),
  get_availability: z.object({
    game: z.string().optional(),
    bookUrl: link,
    online: z.number().int().positive().optional(),
    onlineByGame: z.record(z.string(), z.number().int().positive()).optional(),
    label: z.string().optional(),
    medianMatchSeconds: z.number().int().optional(),
    medianWindowDays: z.literal(30).optional(),
    medianScope: z.string().optional(),
    readAt: z.string(),
    cacheSeconds: z.number(),
    notice: z.string(),
    url: link,
  }),
  create_booking_link: z.object({
    bookUrl: link,
    url: link,
    notice: z.string(),
  }),
};
const descriptions = {
  find_session: [
    'Find a teammate or coach',
    'Start here to find a player or coach. Returns up to three matching sessions with real calculated prices, descriptions, missing inputs and bookUrls to open Duoly. Use exact game, goal, rank and region tokens; errors list valid choices.',
  ],
  list_games: [
    'List games',
    'Discover Duoly games for teammates and coaching. Use a returned id or slug in find_session.',
  ],
  list_services: [
    'List bookable services',
    'Compare services with plain-language descriptions, from prices in EUR per unit, exact rank and region tokens and bookUrls. Share bookUrl so the user can book on Duoly.',
  ],
  get_quote: [
    'Calculate base quote',
    'Use find_session for discovery and pricing. Compatibility tool for a selected service: calculate its base price before account perks. Required inputs: game, service, quantity (1..10), currency (EUR or USD), server, and rank for rank-priced services; Minecraft also needs edition.',
  ],
  get_availability: [
    'Check session availability',
    'Check public availability context and positive online counts when available. A teammate accepts from the queue; counts do not guarantee a match.',
  ],
  create_booking_link: [
    'Get a booking link',
    'Use find_session for discovery and pricing. Call create_booking_link only to produce a final booking link after the user selects a session. No order or payment is created.',
  ],
};
export const INSTRUCTIONS =
  'Find a gaming teammate or coach on Duoly, compare real prices and share a booking link that opens Duoly. Call find_session first when a user wants a player or coach. Share bookUrl as the primary booking link, rather than the game information URL. Ask only for missing selections. Quotes are base price before account perks. Payment happens on duoly.gg, where users confirm remaining options. A teammate accepts from the queue; no instant matching or rank guarantees. Players use their own separate accounts. Never ask for game passwords.';
type Dependencies = {
  fx?: typeof eurToUsd;
  live?: typeof homeLive;
  platform?: Platform;
};
export function bookingLink(
  gameId: string,
  serviceId: string | undefined,
  platform: Platform,
  selection: CardSelection = {},
) {
  const url = new URL('https://duoly.gg/');
  url.searchParams.set('game', gameId);
  if (serviceId) url.searchParams.set('service', serviceId);
  url.searchParams.set('agent', platform);
  if (selection.rank) url.searchParams.set('rank', selection.rank);
  if (selection.region ?? selection.server)
    url.searchParams.set(
      gameId === 'mc' ? 'server' : 'region',
      (selection.region ?? selection.server)!,
    );
  for (const key of [
    'edition',
    'role',
    'character',
    'voice',
    'mood',
    'seats',
  ] as const)
    if (selection[key] !== undefined)
      url.searchParams.set(key, String(selection[key]));
  if (selection.quantity !== undefined)
    url.searchParams.set('qty', String(selection.quantity));
  url.hash = 'modes-h';
  return url.href;
}
function invalidPreferences(
  gameId: string,
  serviceId: string,
  selection: CardSelection,
) {
  return parseBookingPreferences(
    new URL(bookingLink(gameId, serviceId, 'other', selection)).searchParams,
    gameId,
    serviceId,
  ).invalid;
}
function priceDetails(quote: ReturnType<typeof calculateQuote>) {
  const subtotal =
    quote.customer.currency === 'USD'
      ? Math.round(quote.subtotalEurMinor * quote.fx.customerUsdRate)
      : quote.subtotalEurMinor;
  return {
    perUnitMinor: Math.round(
      quote.customer.amountMinor / quote.selection.units,
    ),
    savingMinor: subtotal - quote.customer.amountMinor,
    bundleDiscountPercent: quote.quantityDiscountPercent,
  };
}
const money = (minor: number, currency = 'EUR') =>
  `${currency} ${(minor / 100).toFixed(2)}`;
function priceText(s: Record<string, unknown>) {
  return `${s.priceKind === 'from' ? 'from ' : ''}${money(Number(s.amountMinor), String(s.currency))} total for ${s.quantity} ${s.unit ?? 'unit'}${Number(s.quantity) === 1 ? '' : 's'}; ${money(Number(s.perUnitMinor), String(s.currency))} per ${s.unit ?? 'unit'}${Number(s.savingMinor) > 0 ? `; saves ${money(Number(s.savingMinor), String(s.currency))}, ${s.bundleDiscountPercent}% bundle discount` : ''}`;
}
export async function callTool(
  name: ToolName,
  args: unknown,
  deps: Dependencies = {},
) {
  const parsed = inputs[name].safeParse(args);
  if (!parsed.success)
    throw new ToolInputError(
      parsed.error.issues
        .map((i) => `${i.path.join('.') || 'arguments'}: ${i.message}`)
        .join('; ') + '. Call list_services for supported quote inputs.',
    );
  const a = parsed.data as {
    game?: string;
    service?: string;
    rank?: string;
    quantity?: number;
    currency?: 'EUR' | 'USD';
    server?: string;
    edition?: 'Java' | 'Bedrock';
    goal?: string;
    goalType?: Goal;
    category?: string;
    region?: string;
    budget?: number;
    role?: string;
    character?: string;
    voice?: boolean;
    mood?: string;
    seats?: number;
  };
  const g = a.game ? resolveGame(a.game) : undefined;
  const selected = a.service ? resolveService(g!.id, a.service) : undefined;
  const url = selected?.url ?? g?.url ?? 'https://duoly.gg/games';
  let data: Record<string, unknown>;
  let summary: string;
  let cardRate = 1;
  switch (name) {
    case 'find_session': {
      const all = services(g!.id);
      const aliases: Record<string, string> = {
        coaching: 'training',
        teams: 'other',
        training: 'training',
        other: 'other',
        duo: 'duo',
        ranked: 'ranked',
        casual: 'casual',
      };
      const intent = goalOf(a.goal, a.goalType);
      for (const value of [intent ? undefined : a.goal, a.category])
        if (value && !Object.hasOwn(aliases, value))
          throw new ToolInputError(
            'Invalid goal/category. Valid tokens: duo, coaching, training, ranked, casual, teams, other.',
          );
      const goals = [intent ? undefined : a.goal, a.category]
        .filter((v): v is string => v !== undefined)
        .map((v) => aliases[v]!);
      let candidates = all.filter((s) =>
        goals.every((goal) =>
          goal === 'ranked'
            ? s.category === 'duo' && s.ranks.length > 0
            : goal === 'casual'
              ? s.category === 'duo' && s.ranks.length === 0
              : s.category === goal,
        ),
      );
      if (intent) {
        const ids = goalServices(g!.id, intent);
        candidates = ids
          ? ids.flatMap((id) => candidates.filter((s) => s.id === id))
          : candidates.filter((s) => s.casual);
      }
      if (!candidates.length)
        throw new ToolInputError(
          `No services for this goal/category combination. Valid categories for ${g!.id}: ${[...new Set(all.map((s) => s.category))].join(', ')}. Call list_services for details.`,
        );
      if (a.region && a.server && a.region !== a.server)
        throw new ToolInputError(
          'region and server must use the same token. Supply only one.',
        );
      const server = a.server ?? a.region;
      const regions = [...new Set(all.flatMap((s) => s.regions))];
      if (server && g!.id !== 'mc' && !regions.includes(server))
        throw new ToolInputError(
          `Invalid server/region. Valid tokens: ${regions.join(', ')}.`,
        );
      if (a.edition && g!.id !== 'mc')
        throw new ToolInputError(
          'Edition is only for Minecraft. Omit edition for this game.',
        );
      const ranks = [...new Set(candidates.flatMap((s) => s.ranks))];
      // Flat-priced coaching accepts the player's rank as context, without forwarding it to pricing.
      const gameRanks = [...new Set(all.flatMap((s) => s.ranks))];
      if (a.rank && !gameRanks.includes(a.rank))
        throw new ToolInputError(
          `Invalid rank. Valid tokens: ${gameRanks.join(', ') || 'none; omit rank'}.`,
        );
      if (a.rank)
        candidates = candidates.filter(
          (s) => !s.ranks.length || s.ranks.includes(a.rank!),
        );
      if (!candidates.length)
        throw new ToolInputError(
          `No matching services for this rank. Valid tokens for this goal: ${ranks.join(', ')}.`,
        );
      const matches = [];
      const fx = await (deps.fx ?? eurToUsd)();
      cardRate = fx.rate;
      const missing = new Set<string>();
      candidates = candidates.filter((s) => {
        return (
          invalidPreferences(g!.id, s.id, { ...a, rank: undefined }).length ===
          0
        );
      });
      if (!candidates.length)
        throw new ToolInputError(
          'No service supports these booking preferences. Call list_services for exact role, character and seat options.',
        );
      for (const s of candidates) {
        const missingInputs = [
          ...(a.quantity === undefined ? ['quantity'] : []),
          ...(!server ? ['server'] : []),
          ...(s.ranks.length && !a.rank ? ['rank'] : []),
          ...(g!.id === 'mc' && !a.edition ? ['edition'] : []),
        ];
        missingInputs.forEach((input) => missing.add(input));
        // Missing selections yield an explicitly labelled minimum, never an inferred user choice.
        const quoteRanks = s.ranks.length
          ? a.rank
            ? [a.rank]
            : s.ranks
          : [undefined];
        const quotes = quoteRanks.map((rank) =>
          calculateQuote(
            {
              gameId: g!.id,
              serviceId: s.id,
              units: a.quantity ?? 1,
              seats: a.seats ?? seatRule(g!.id, s.id).default,
              server: server ?? s.regions[0] ?? 'my world',
              ...(rank ? { rank } : {}),
              ...(g!.id === 'mc' ? { edition: a.edition ?? 'Java' } : {}),
            },
            { eurToUsd: fx.rate, customerCurrency: a.currency ?? 'EUR' },
          ),
        );
        const quote = quotes.sort(
          (x, y) => x.customer.amountMinor - y.customer.amountMinor,
        )[0]!;
        if (
          a.budget !== undefined &&
          quote.customer.amountMinor > Math.floor(a.budget * 100)
        )
          continue;
        matches.push({
          id: s.id,
          name: s.name,
          category: s.category,
          description: s.description,
          unit: s.unit,
          priceNote: s.priceNote,
          ...((!s.ranks.length || a.rank) && a.quantity !== undefined
            ? {}
            : {
                fromPrice: s.fromPrice,
                representativePrice: (() => {
                  const rank = s.ranks.length
                    ? (a.rank ??
                      (s.ranks.includes('Gold') ? 'Gold' : s.ranks[0]))
                    : undefined;
                  const q = calculateQuote(
                    {
                      gameId: g!.id,
                      serviceId: s.id,
                      units: a.quantity ?? 1,
                      seats: a.seats ?? seatRule(g!.id, s.id).default,
                      server: server ?? s.regions[0] ?? 'my world',
                      ...(rank ? { rank } : {}),
                      ...(g!.id === 'mc'
                        ? { edition: a.edition ?? 'Java' }
                        : {}),
                    },
                    {
                      eurToUsd: fx.rate,
                      customerCurrency: a.currency ?? 'EUR',
                    },
                  );
                  return {
                    ...(rank ? { rank } : {}),
                    ...priceDetails(q),
                    quantity: a.quantity ?? 1,
                    amountMinor: q.customer.amountMinor,
                    currency: q.customer.currency,
                  };
                })(),
              }),
          ...priceDetails(quote),
          bookUrl: bookingLink(g!.id, s.id, deps.platform ?? 'other', {
            ...a,
            rank: s.ranks.length ? a.rank : undefined,
          }),
          priceKind:
            (!s.ranks.length || a.rank) && a.quantity !== undefined
              ? 'exact'
              : 'from',
          amountMinor: quote.customer.amountMinor,
          currency: quote.customer.currency,
          formattedPrice: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: quote.customer.currency,
          }).format(quote.customer.amountMinor / 100),
          quantity: a.quantity ?? 1,
          missingInputs,
        });
      }
      // Prefer directly relevant ranked tiers in catalog order; show budget-qualified coaching in the same order.
      const best = matches.slice(0, 3);
      data = {
        game: g!.id,
        matches: best,
        missingInputs: [
          ...new Set(
            best.length ? best.flatMap((s) => s.missingInputs) : [...missing],
          ),
        ],
        ...(intent && best[0]
          ? {
              recommendation: {
                serviceId: best[0].id,
                goal: intent,
                reason: `${best[0].description}${best.length > 1 && best.every((m) => m.amountMinor >= best[0]!.amountMinor) ? ' Lowest total of the options that fit this goal.' : ''}${best[0].savingMinor > 0 ? ` Saves ${money(best[0].savingMinor, best[0].currency)} (${best[0].bundleDiscountPercent}% bundle discount).` : ' No bundle savings for this selection.'}${intent === 'play_tonight' ? ' No availability or start time is guaranteed.' : ''}${intent === 'climb' && g!.id === 'cs2' ? ' Confirm Premier or FACEIT before booking.' : ''}${intent === 'climb' && g!.id === 'cod' ? ' Confirm Multiplayer or Warzone before booking.' : ''}`,
              },
            }
          : {}),
        budgetApplied: a.budget !== undefined,
        notice:
          'Base price before account perks; EUR unless specified. Representative prices are examples, not inferred selections. Review remaining inputs on Duoly. A teammate accepts from the queue.',
      };
      summary = best.length
        ? 'Matching Duoly sessions with calculated prices.'
        : 'No sessions fit this budget. Increase the budget or change the goal.';
      break;
    }
    case 'list_games':
      data = {
        games: games().map((g) => ({
          ...g,
          bookUrl: bookingLink(g.id, undefined, deps.platform ?? 'other'),
        })),
        url,
      };
      summary = 'Browse 15 Duoly games. Social sessions are excluded.';
      break;
    case 'list_services':
      data = {
        game: g!.id,
        services: services(g!.id).map((s) => ({
          ...s,
          bookUrl: bookingLink(g!.id, s.id, deps.platform ?? 'other'),
        })),
        url,
      };
      summary =
        'Compare Duoly services, from prices in EUR per unit and exact quote inputs.';
      break;
    case 'create_booking_link':
      if (a.region && a.server)
        throw new ToolInputError('Supply only one of region or server.');
      if (
        !selected &&
        [...Object.keys(preferences), 'server', 'edition'].some(
          (key) => a[key as keyof typeof a] !== undefined,
        )
      )
        throw new ToolInputError(
          'Select a service before supplying booking preferences. Call list_services.',
        );
      if (selected) {
        const invalid = invalidPreferences(g!.id, selected.id, a);
        if (invalid.length)
          throw new ToolInputError(
            `Invalid booking preferences: ${invalid.join(', ')}. Call list_services for exact tokens and seat bounds.`,
          );
      }
      if (
        a.rank &&
        !(
          selected?.ranks.length
            ? selected.ranks
            : services(g!.id).flatMap((s) => s.ranks)
        ).includes(a.rank)
      )
        throw new ToolInputError(
          'Invalid rank. Call list_services for valid tokens.',
        );
      if (
        a.region &&
        g!.id !== 'mc' &&
        !services(g!.id).some((s) => s.regions.includes(a.region!))
      )
        throw new ToolInputError(
          'Invalid region. Call list_services for valid tokens.',
        );
      if (a.currency === 'USD') cardRate = (await (deps.fx ?? eurToUsd)()).rate;
      data = {
        bookUrl: bookingLink(g!.id, selected?.id, deps.platform ?? 'other', a),
        url,
        notice:
          'Select remaining options and complete payment on duoly.gg. This link creates no order.',
      };
      summary = 'Continue on Duoly to review your selection.';
      break;
    case 'get_quote': {
      const fx = await (deps.fx ?? eurToUsd)();
      let quote;
      try {
        quote = calculateQuote(
          {
            gameId: g!.id,
            serviceId: selected!.id,
            units: a.quantity!,
            seats: a.seats ?? seatRule(g!.id, selected!.id).default,
            server: a.server!,
            ...(a.rank !== undefined ? { rank: a.rank } : {}),
            ...(a.edition ? { edition: a.edition } : {}),
          },
          { eurToUsd: fx.rate, customerCurrency: a.currency! },
        );
      } catch {
        throw new ToolInputError(
          `Invalid quote selection. Valid inputs: game=${g!.id}; service=${selected!.id}; quantity=1..10; currency=EUR or USD; server=${selected!.regions.join(', ') || 'your Minecraft world/server'}; rank=${selected!.ranks.join(', ') || 'none (omit rank)'}${g!.id === 'mc' ? '; edition=Java or Bedrock' : ''}.`,
        );
      }
      const formattedPrice = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: quote.customer.currency,
      }).format(quote.customer.amountMinor / 100);
      data = {
        kind: 'preview',
        basis: 'base price before account perks',
        notReserved: true,
        currency: quote.customer.currency,
        amountMinor: quote.customer.amountMinor,
        amountEurMinor: quote.amountEurMinor,
        ...priceDetails(quote),
        formattedPrice,
        unit: quote.unit,
        quantity: a.quantity,
        quotedAt: new Date().toISOString(),
        fx,
        notice:
          'Base price before account perks. USD is an estimate. Final payment and any account perks are reviewed on duoly.gg. No teammate is reserved.',
        bookUrl: bookingLink(g!.id, selected!.id, deps.platform ?? 'other', a),
        url,
      };
      summary = `${formattedPrice} base price before account perks. No reservation.`;
      break;
    }
    case 'get_availability': {
      const live = await (deps.live ?? homeLive)();
      const onlineByGame = Object.fromEntries(
        Object.entries(live.stats?.onlineByGame ?? {}).filter(
          ([id, count]) =>
            count > 0 &&
            (!g || g.id === id) &&
            games().some((g) => g.id === id),
        ),
      );
      data = {
        ...(g ? { game: g.id } : {}),
        bookUrl: g
          ? bookingLink(g.id, undefined, deps.platform ?? 'other')
          : 'https://duoly.gg/#modes-h',
        ...(g && onlineByGame[g.id] ? { online: onlineByGame[g.id] } : {}),
        ...(Object.keys(onlineByGame).length
          ? {
              onlineByGame,
              label: 'online now (may include teammates in a session)',
            }
          : {}),
        ...(live.stats?.matchSeconds != null
          ? {
              medianMatchSeconds: live.stats.matchSeconds,
              medianWindowDays: 30,
              medianScope:
                'sitewide accepted orders, including services outside this tool catalog',
            }
          : {}),
        readAt: new Date().toISOString(),
        cacheSeconds: 30,
        notice:
          'A teammate accepts the order from a queue. Instant matching and future wait times are not guaranteed. Any historical median is sitewide, not game specific.',
        url,
      };
      summary = 'Book a session on Duoly. A teammate accepts from the queue.';
      break;
    }
  }
  const structuredContent = outputs[name].parse(data) as Record<
    string,
    unknown
  >;
  const card = cardData(name, a, structuredContent, cardRate);
  const result = {
    ...(card ? { _meta: { 'gg.duoly/card': card } } : {}),
    structuredContent,
    content: [
      {
        type: 'text' as const,
        text: (() => {
          if (name === 'list_games')
            return (structuredContent.games as Array<Record<string, unknown>>)
              .map((g) => `${g.name} (${g.id}): ${g.bookUrl}`)
              .join('\n');
          if (name === 'list_services')
            return (
              structuredContent.services as Array<Record<string, unknown>>
            )
              .map((s) => {
                const from = s.fromPrice as { amountMinor: number };
                const typical = s.typicalPrice as
                  { rank: string; amountMinor: number } | undefined;
                return `${s.name} (${s.id}): ${s.description} From ${money(from.amountMinor)} per ${s.unit}.${typical ? ` ${s.priceNote} Typical ${typical.rank}, 1 ${s.unit}: ${money(typical.amountMinor)}.` : ''} ${s.bookUrl}`;
              })
              .join('\n');
          if (name === 'find_session')
            return `${
              (structuredContent.matches as Array<Record<string, unknown>>)
                .map((s) => {
                  const example = s.representativePrice as
                    | {
                        rank?: string;
                        quantity: number;
                        amountMinor: number;
                        currency: string;
                      }
                    | undefined;
                  return `${s.name} (${s.id}): ${s.description} ${priceText(s)}.${example ? ` ${s.priceNote} Example ${example.rank ?? 'flat price'}, ${example.quantity} ${s.unit}${example.quantity === 1 ? '' : 's'}: ${priceText({ ...example, unit: s.unit })}.` : ''} ${s.bookUrl}`;
                })
                .join('\n') || summary
            }${structuredContent.recommendation ? `\nRecommended: ${(structuredContent.matches as { id: string; name: string }[]).find((m) => m.id === (structuredContent.recommendation as { serviceId: string }).serviceId)?.name ?? (structuredContent.recommendation as { serviceId: string }).serviceId}. ${(structuredContent.recommendation as { reason: string }).reason}` : ''}\n${(structuredContent.missingInputs as string[]).length ? `Remaining inputs: ${(structuredContent.missingInputs as string[]).join(', ')}. ` : ''}Base price before account perks. Pay on Duoly.`;
          if (name === 'get_quote')
            return `${priceText(structuredContent)}. Base price before account perks. No reservation. ${structuredContent.bookUrl}`;
          if (name === 'get_availability')
            return `${summary}${
              structuredContent.onlineByGame
                ? ` Online now: ${Object.entries(structuredContent.onlineByGame)
                    .map(([id, count]) => `${id}: ${count}`)
                    .join(', ')} (may include teammates in a session).`
                : ''
            }${structuredContent.medianMatchSeconds !== undefined ? ` Historical sitewide median: ${structuredContent.medianMatchSeconds}s over 30 days; no future wait guarantee.` : ''} ${structuredContent.bookUrl}`;
          return `${summary} ${structuredContent.notice} ${structuredContent.bookUrl}`;
        })(),
      },
    ],
  };
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 65536)
    throw new Error('Tool response exceeds the size limit.');
  return result;
}
export function createServer(userAgent = '', client: string | null = null) {
  const server = new McpServer(
    { name: 'duoly', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  );
  registerCards(server);
  for (const name of TOOL_NAMES) {
    registerAppTool(
      server,
      name,
      {
        _meta: {
          ui: {
            ...(CARD_URIS[name] ? { resourceUri: CARD_URIS[name] } : {}),
            visibility: ['model', 'app'],
          },
        },
        title: descriptions[name][0]!,
        description: descriptions[name][1]!,
        inputSchema: inputs[name],
        outputSchema: outputs[name],
        annotations: {
          readOnlyHint: true,
          openWorldHint: false,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      async (args: unknown) => {
        // Untrusted attribution only. No identity, permissions or pricing depend on this hint.
        const explicit =
          client && ['claude', 'chatgpt', 'gemini'].includes(client)
            ? platformOf(client)
            : 'other';
        const reported = platformOf(
          server.server.getClientVersion()?.name ?? '',
        );
        const platform =
          explicit !== 'other'
            ? explicit
            : reported !== 'other'
              ? reported
              : platformOf(userAgent);
        serverTrack({
          event: 'agent_tool_called',
          userId: null,
          consent: null,
          properties: { tool: name, platform },
        });
        flushAnalytics();
        try {
          return await callTool(name, args, { platform });
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text:
                  error instanceof ToolInputError
                    ? error.message
                    : 'Tool unavailable. Try again later.',
              },
            ],
          };
        }
      },
    );
  }
  return server;
}
