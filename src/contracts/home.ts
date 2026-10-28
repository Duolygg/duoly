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

export interface HomeLive {
  onlineNow: number;
  recentMatches: RecentMatch[];
  /** Null until the figures could be read once; the page then shows no figures at all. */
  stats: HomeStats | null;
}
