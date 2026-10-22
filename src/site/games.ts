import { GAMES } from '../design-reference/lib/games.js';

export interface SiteGame {
  id: string;
  name: string;
  img: string;
  slug: string;
}

/** Public game pages use the image file name as a readable slug. */
export const SITE_GAMES: SiteGame[] = (
  GAMES as { id: string; name: string; img: string }[]
).map((game) => ({
  id: game.id,
  name: game.name,
  img: game.img,
  slug: game.img.replace(/^.*\//, '').replace(/\.png$/, ''),
}));

export const gameBySlug = (slug: string | undefined) =>
  SITE_GAMES.find((game) => game.slug === slug);
