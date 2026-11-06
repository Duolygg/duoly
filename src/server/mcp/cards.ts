import {
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/server';
import { calculateQuote } from '../pricing';
import { servicesFor } from '../../design-reference/lib/catalog.js';
import { resolveGame, services } from './catalog';
import template from './card.html?raw';
import script from './card-view.js?raw';

export const CARD_URIS: Record<string, string> = {
  find_session: 'ui://duoly/session-v1.html',
  create_booking_link: 'ui://duoly/ticket-v1.html',
  list_games: 'ui://duoly/games-v1.html',
};
const CARD_META = {
  ui: {
    prefersBorder: false,
    csp: { resourceDomains: ['https://duoly.gg'], connectDomains: [] },
    permissions: { clipboardWrite: {} },
  },
};
export function registerCards(server: McpServer) {
  for (const [name, uri] of Object.entries(CARD_URIS))
    registerAppResource(
      server,
      name,
      uri,
      { mimeType: RESOURCE_MIME_TYPE, _meta: CARD_META },
      async () => ({
        contents: [
          {
            uri,
            mimeType: RESOURCE_MIME_TYPE,
            text: template.replace('__SCRIPT__', () =>
              script.replace('__TOOL__', name),
            ),
            _meta: CARD_META,
          },
        ],
      }),
    );
}

export type CardSelection = {
  game?: string;
  service?: string;
  rank?: string;
  region?: string;
  server?: string;
  quantity?: number;
  currency?: 'EUR' | 'USD';
  budget?: number;
  edition?: 'Java' | 'Bedrock';
};
// Every quantity is priced on the server: no copied bundle schedule or FX rounding in the view.
export function cardData(
  name: string,
  input: CardSelection,
  data: Record<string, unknown>,
  rate = 1,
) {
  if (!CARD_URIS[name]) return undefined;
  const game = input.game ? resolveGame(input.game) : undefined;
  const matches = data.matches as Array<{ id: string }> | undefined;
  const options = game
    ? services(game.id)
        .filter((s) =>
          name === 'create_booking_link'
            ? s.id === input.service
            : matches?.some((m) => m.id === s.id),
        )
        .map((s) => {
          const prices = Object.fromEntries(
            (s.ranks.length ? s.ranks : ['']).map((rank) => {
              const totals = Array.from({ length: 10 }, (_, i) =>
                calculateQuote(
                  {
                    gameId: game.id,
                    serviceId: s.id,
                    units: i + 1,
                    server:
                      input.server ??
                      input.region ??
                      s.regions[0] ??
                      'my world',
                    ...(rank ? { rank } : {}),
                    ...(game.id === 'mc'
                      ? { edition: input.edition ?? 'Java' }
                      : {}),
                  },
                  { eurToUsd: rate, customerCurrency: input.currency ?? 'EUR' },
                ),
              );
              return [
                rank,
                totals.map((q) => [
                  q.customer.amountMinor,
                  input.currency === 'USD'
                    ? Math.round(q.subtotalEurMinor * q.fx.customerUsdRate)
                    : q.subtotalEurMinor,
                  q.quantityDiscountPercent,
                ]),
              ];
            }),
          );
          const source = servicesFor(game.id).modes.find(
            (m: { id: string }) => m.id === s.id,
          );
          return { ...s, prices, tier: source?.tier, badge: source?.badge };
        })
    : [];
  return {
    tool: name,
    input,
    data,
    game,
    options,
    currency: input.currency ?? 'EUR',
  };
}
