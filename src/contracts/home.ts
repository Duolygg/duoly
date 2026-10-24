/** Homepage live elements (ledger #36), shared by the server cache and the LiveHome island. */

/** One ticker entry in the shape of Home.jsx's sample rows: [game, who, what, time]. */
export interface RecentMatch {
  game: string;
  who: string;
  what: string;
  time: string;
  rating: number | null;
}

export interface HomeLive {
  onlineNow: number;
  recentMatches: RecentMatch[];
}
