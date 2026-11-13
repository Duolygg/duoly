/** Homepage live elements (ledger #36), shared by the server cache and the LiveHome island. */

/** One ticker entry in the shape of Home.jsx's sample rows: [game, who, what, time]. */
export interface RecentMatch {
  game: string;
  who: string;
  what: string;
  time: string;
  rating: number | null;
}

/** Ledger #43: real aggregate figures that replace Fabian's sample numbers. */
export interface HomeStats {
  /** Teammates online per game id (available and allowed to take it, or playing it). */
  onlineByGame: Record<string, number>;
  /** The same teammates by profile country: eu, na, ao (Asia and Oceania), sa. */
  onlineByRegion: { eu: number; na: number; ao: number; sa: number };
  /** Completed sessions, all time. */
  sessions: number;
  /** Number of reviews and their average star rating (null without reviews). */
  reviews: number;
  rating: number | null;
  /** Median seconds from queue to match over the last 30 days (null with too few orders). */
  matchSeconds: number | null;
}

/** One card in the homepage teammate carousel (public.home_teammates, migration 20261030100000). */
export interface HeroTeammate {
  /** First name only. */
  name: string;
  /** A built-in avatar or an uploaded one; anything else falls back to avatar-1. */
  image: string;
  /** Up to three game ids, demand order. */
  games: string[];
  gg: boolean;
  online: boolean;
  /** Average stars (one decimal) and review count; rating is null without reviews. */
  rating: number | null;
  reviews: number;
  sessions: number;
  /**
   * The teammate's public profile link, /teammates/<slug>, present only when that profile is one
   * a visitor could open: migration 20261112180000 applies the same four tests as
   * public_teammate_profile(), and src/server/home/live.ts drops it again while
   * PUBLIC_PROFILES_ENABLED is off. Absent rather than null, so the cards that have no profile
   * add nothing to the payload the homepage ships.
   */
  slug?: string;
}

export interface HomeLive {
  onlineNow: number;
  recentMatches: RecentMatch[];
  /** Empty until the migration is applied or while no teammate qualifies; the carousel then shows the live online line. */
  teammates: HeroTeammate[];
  /** Null until the figures could be read once; the page then shows no figures at all. */
  stats: HomeStats | null;
}
