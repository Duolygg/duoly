import { seatRule } from '../../contracts/seats';
import { rolesFor, characterLabel } from '../../contracts/roles';
import { SITE_GAMES } from '../../site/games';
import { calculateQuote, parseQuoteInput } from '../pricing';
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
      `Unsupported game. Call list_games. Valid id or slug tokens: ${games()
        .map((g) => `${g.id} (${g.slug})`)
        .join(', ')}.`,
    );
  return game;
}
export function services(value: string) {
  const game = resolveGame(value);
  const modes = servicesFor(game.id).modes as {
    id: string;
    title: string;
    desc: string;
    cat: string;
    unit: 'game' | 'hour';
    fun?: boolean;
  }[];
  return (
    modes
      // Gamer Girl services stay on duoly.gg until the first store approval,
      // like the Social game, to keep the assistant listing to coaching and teammates.
      .filter((m) => !['gg', 'social'].includes(m.cat))
      .filter((m) => {
        // Bookability follows the checkout parser, including future Teams support.
        const rank = (ranksOf(game.id, m.id) as string[])[0];
        try {
          parseQuoteInput({
            gameId: game.id,
            serviceId: m.id,
            seats: seatRule(game.id, m.id).default,
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
          description: m.desc
            .replace(/[.!?]\s+/g, '; ')
            .replaceAll('&', 'and')
            .replace(/[\u2013\u2014]/g, '-'),
          fromPrice: {
            amountMinor: Math.min(
              ...(ranks.length ? ranks : [undefined]).map(
                (rank) =>
                  calculateQuote(
                    {
                      gameId: game.id,
                      serviceId: m.id,
                      seats: seatRule(game.id, m.id).default,
                      units: 1,
                      server:
                        game.id === 'mc'
                          ? 'my world'
                          : serversFor(game.id)[0]![0],
                      ...(rank ? { rank } : {}),
                      ...(game.id === 'mc' ? { edition: 'Java' } : {}),
                    },
                    { eurToUsd: 1 },
                  ).amountEurMinor,
              ),
            ),
            currency: 'EUR' as const,
            unit: m.unit,
            quantity: 1 as const,
            basis: 'base price before account perks' as const,
          },
          priceNote: ranks.length
            ? "Price scales with the customer's rank."
            : 'Flat price per unit.',
          ...(ranks.length
            ? {
                typicalPrice: {
                  rank: ranks.includes('Gold') ? 'Gold' : ranks[0]!,
                  quantity: 1 as const,
                  amountMinor: calculateQuote(
                    {
                      gameId: game.id,
                      serviceId: m.id,
                      seats: seatRule(game.id, m.id).default,
                      units: 1,
                      server: serversFor(game.id)[0]![0],
                      rank: ranks.includes('Gold') ? 'Gold' : ranks[0]!,
                    },
                    { eurToUsd: 1 },
                  ).amountEurMinor,
                  currency: 'EUR' as const,
                },
              }
            : {}),
          roles: [...rolesFor(game.id, m.id)],
          characterLabel: characterLabel(game.id, m.cat),
          seats: seatRule(game.id, m.id),
          voice: [true, false],
          moods: ['chill', 'tryhard', 'teach', 'fun'],
          category: m.cat,
          casual: m.fun === true,
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
      })
  );
}
export function resolveService(game: string, service: string) {
  const selected = services(game).find((s) => s.id === service);
  if (!selected)
    throw new ToolInputError(
      `Unsupported service. Call list_services. Valid service tokens: ${services(
        game,
      )
        .map((s) => s.id)
        .join(', ')}.`,
    );
  return selected;
}
