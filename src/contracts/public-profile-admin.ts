import { RANKS, SERVICE_RANKS } from '../design-reference/lib/ranks';
/** Rank values are the exact union of the game's main and service ladders. */
export function ranksForGame(game: string): string[] {
  const base = (RANKS as Record<string, (string | number)[][]>)[game] ?? [];
  const modes =
    (SERVICE_RANKS as Record<string, Record<string, (string | number)[][]>>)[
      game
    ] ?? {};
  return [
    ...new Set(
      [...base, ...Object.values(modes).flat()]
        .map((r) => r[0])
        .filter((r): r is string => typeof r === 'string'),
    ),
  ];
}
