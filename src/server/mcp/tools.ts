import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { games, resolveGame, resolveService, services } from './catalog';
import { calculateQuote } from '../pricing';
import { eurToUsd } from '../fx';
import { homeLive } from '../home/live';
import { serverTrack, flushAnalytics } from '../analytics/client';

export const TOOL_NAMES = [
  'list_games',
  'list_services',
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
  name: z.string(),
  url: link,
});
const serviceOutput = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  unit: z.enum(['game', 'hour']),
  ranks: z.array(z.string()),
  regions: z.array(z.string()),
  editions: z.array(z.string()),
  requiredInputs: z.array(z.string()),
  url: link,
});
const inputs = {
  list_games: z.strictObject({}),
  list_services: z.strictObject({ game }),
  get_quote: z.strictObject({
    game,
    service,
    rank: z.string().max(40).optional(),
    quantity: z.number().int().min(1).max(10),
    currency: z.enum(['EUR', 'USD']),
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
  create_booking_link: z.strictObject({ game, service: service.optional() }),
};
const outputs = {
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
    online: z.number().int().nullable(),
    onlineByGame: z.record(z.string(), z.number().int()),
    label: z.string(),
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
  list_games: [
    'List games',
    'List Duoly games with canonical page links. Social sessions are excluded.',
  ],
  list_services: [
    'List bookable services',
    'List static bookable services, exact rank and region tokens and quote requirements for one game.',
  ],
  get_quote: [
    'Calculate base quote',
    'Calculate a base price preview before account perks. Does not reserve a teammate or start payment.',
  ],
  get_availability: [
    'Read online counts',
    'Read cached public online counts and an available sitewide historical median. Counts do not guarantee a match.',
  ],
  create_booking_link: [
    'Create website link',
    'Build a website selection link. Does not create an order, reserve capacity or charge money.',
  ],
};
export const INSTRUCTIONS =
  'Duoly connects customers with gaming teammates and coaches. Customers play on their own accounts and teammates play on their own separate accounts. Payment happens on duoly.gg. Never request game passwords or account sharing. No rank gains or instant matching are guaranteed. Orders enter a queue and a teammate must accept. Public quotes are base price previews before account perks and reserve nothing. Cite the canonical Duoly page links in results.';
type Dependencies = {
  fx?: typeof eurToUsd;
  live?: typeof homeLive;
  platform?: Platform;
};
export function bookingLink(
  gameId: string,
  serviceId: string | undefined,
  platform: Platform,
) {
  const url = new URL('https://duoly.gg/');
  url.searchParams.set('game', gameId);
  if (serviceId) url.searchParams.set('service', serviceId);
  url.searchParams.set('agent', platform);
  url.hash = 'modes-h';
  return url.href;
}
export async function callTool(
  name: ToolName,
  args: unknown,
  deps: Dependencies = {},
) {
  const parsed = inputs[name].safeParse(args);
  if (!parsed.success)
    throw new Error(
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
  };
  const g = a.game ? resolveGame(a.game) : undefined;
  const selected = a.service ? resolveService(g!.id, a.service) : undefined;
  const url = selected?.url ?? g?.url ?? 'https://duoly.gg/games';
  let data: Record<string, unknown>;
  let summary: string;
  switch (name) {
    case 'list_games':
      data = { games: games(), url };
      summary = 'Browse 15 Duoly games. Social sessions are excluded.';
      break;
    case 'list_services':
      data = { game: g!.id, services: services(g!.id), url };
      summary =
        'Bookable static services with quote requirements. Dynamic streamer bookings are not exposed in v1.';
      break;
    case 'create_booking_link':
      data = {
        bookUrl: bookingLink(g!.id, selected?.id, deps.platform ?? 'other'),
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
            server: a.server!,
            ...(a.rank !== undefined ? { rank: a.rank } : {}),
            ...(a.edition ? { edition: a.edition } : {}),
          },
          { eurToUsd: fx.rate, customerCurrency: a.currency! },
        );
      } catch {
        throw new Error(
          'Invalid quote selection. Call list_services for exact rank, server and edition requirements. Omit rank for services with no ranks.',
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
        formattedPrice,
        unit: quote.unit,
        quantity: a.quantity,
        quotedAt: new Date().toISOString(),
        fx,
        notice:
          'Base price before account perks. USD is an estimate. Final payment and any account perks are reviewed on duoly.gg. No teammate is reserved.',
        bookUrl: bookingLink(g!.id, selected!.id, deps.platform ?? 'other'),
        url,
      };
      summary = `${formattedPrice} base price before account perks. No reservation.`;
      break;
    }
    case 'get_availability': {
      const live = await (deps.live ?? homeLive)();
      const onlineByGame = Object.fromEntries(
        Object.entries(live.stats?.onlineByGame ?? {}).filter(([id]) =>
          games().some((g) => g.id === id),
        ),
      );
      data = {
        ...(g ? { game: g.id } : {}),
        online: g ? (onlineByGame[g.id] ?? null) : null,
        onlineByGame,
        label: 'online now (may include teammates in a session)',
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
          'Cached aggregate counts, not reservable capacity. A teammate accepts the order from a queue. Instant matching and future wait times are not guaranteed. The historical median is sitewide, not game specific. Overall online totals are omitted because they can include excluded sessions.',
        url,
      };
      summary =
        'Reported online counts may include teammates in a session. A teammate must accept from the queue.';
      break;
    }
  }
  const structuredContent = outputs[name].parse(data) as Record<
    string,
    unknown
  >;
  return {
    structuredContent,
    content: [{ type: 'text' as const, text: `${summary} ${url}` }],
  };
}
export function createServer(userAgent = '') {
  const server = new McpServer(
    { name: 'duoly', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  );
  for (const name of TOOL_NAMES) {
    server.registerTool(
      name,
      {
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
        const platform = platformOf(
          server.server.getClientVersion()?.name || userAgent,
        );
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
                  error instanceof Error
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
