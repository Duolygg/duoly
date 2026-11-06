import { SITE_GAMES } from '../../site/games';
import { parseQuoteInput } from '../pricing';
import { servicesFor } from '../../design-reference/lib/catalog.js';
import { ranksOf } from '../../design-reference/lib/ranks.js';
import { serversFor } from '../../design-reference/lib/servers.js';

export class ToolInputError extends Error {}

export const games = () =>
  SITE_GAMES.filter((g) => g.id !== 'social').map(({ id, slug, name }) => ({
    id,
    slug,
    name,
    url: `https://duoly.gg/games/${slug}`,
  }));
export function resolveGame(value: string) {
  const game = games().find((g) => g.id === value || g.slug === value);
  if (!game)
    throw new ToolInputError(
      'Unsupported game. Call list_games and use a returned id or slug.',
    );
  return game;
}
export function services(value: string) {
  const game = resolveGame(value);
  const modes = servicesFor(game.id).modes as {
    id: string;
    title: string;
    cat: string;
    unit: 'game' | 'hour';
  }[];
  return modes
    .filter((m) => {
      // Bookability follows the checkout parser, including future Teams support.
      const rank = (ranksOf(game.id, m.id) as string[])[0];
      try {
        parseQuoteInput({
          gameId: game.id,
          serviceId: m.id,
          units: 1,
          server: game.id === 'mc' ? 'my world' : serversFor(game.id)[0]![0],
          ...(rank ? { rank } : {}),
          ...(game.id === 'mc' ? { edition: 'Java' } : {}),
        });
        return true;
      } catch {
        return false;
      }
    })
    .map((m) => {
      const ranks = ranksOf(game.id, m.id) as string[];
      return {
        id: m.id,
        name: m.title.replaceAll('&', 'and').replace(/[\u2013\u2014]/g, '-'),
        category: m.cat,
        unit: m.unit,
        ranks,
        regions:
          game.id === 'mc'
            ? []
            : (serversFor(game.id) as string[][]).map((r) => r[0]!),
        editions: game.id === 'mc' ? ['Java', 'Bedrock'] : [],
        requiredInputs: [
          'game',
          'service',
          'quantity',
          'currency',
          'server',
          ...(ranks.length ? ['rank'] : []),
          ...(game.id === 'mc' ? ['edition'] : []),
        ],
        url: game.url + (m.cat === 'training' ? '/coaching' : ''),
      };
    });
}
export function resolveService(game: string, service: string) {
  const selected = services(game).find((s) => s.id === service);
  if (!selected)
    throw new ToolInputError(
      'Unsupported service. Call list_services for this game and use a returned id.',
    );
  return selected;
}
