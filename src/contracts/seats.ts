/**
 * Team orders: how many teammates a customer can book on one order (docs/product/team-orders.md).
 *
 * Seats are teammates, not players: "fill my five" in League is 4 seats, because the customer
 * plays the fifth. Every service not listed here is one teammate.
 *
 * - Teams tab services are built for groups and open at the most seats ("fill my five" in one
 *   click).
 * - Party modes elsewhere in the catalog can bring friends along: they open at one seat, and the
 *   customer adds more if they want (owner decision 2026-11-06).
 * - `groupPrice`: the catalog price already covers the whole group (Apex Full Trio, ARC Raiders
 *   Full Squad and Escort Run read as "two players join you"), so the listed price is the total and
 *   each seat gets its share (owner decision 2026-11-06). Every other service is priced per seat.
 */
export interface SeatRule {
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly groupPrice?: true;
}

/** The highest seat count anywhere, matching order_teams.seats in the database. */
export const MAX_SEATS = 5;

const teams = (max: number): SeatRule => ({ min: 1, max, default: max });
const party = (max: number): SeatRule => ({ min: 1, max, default: 1 });
const fixedGroup = (seats: number): SeatRule => ({
  min: seats,
  max: seats,
  default: seats,
  groupPrice: true,
});

const RULES: Readonly<Record<string, Readonly<Record<string, SeatRule>>>> = {
  lol: {
    ranked5: teams(4),
    flex: teams(4),
    clash: teams(4),
    swift: party(4),
    aram: party(4),
    norm: party(4),
  },
  val: { stack: teams(4), premier: teams(4) },
  cs2: { five: teams(4), faceit5: teams(4) },
  fn: { squad: teams(3), cup: teams(2) },
  cod: { quads: teams(3), mp4: teams(3), zombies: party(3) },
  apex: { trio: fixedGroup(2) },
  r6: { stack: teams(4) },
  mr: { six: teams(5) },
  ow: { five: teams(4) },
  rl: { three: teams(2) },
  fc: { clubs: teams(5) },
  arc: { squad: fixedGroup(2), escort: fixedGroup(2) },
  mc: { squad: teams(3), manhunt: party(3), mini: party(3) },
  pu: { squad: teams(4) },
  dota: { party5: teams(4), turbo: party(4), unranked: party(4) },
  // Mythic+ is five players and rated 3v3 is three: the customer is one of them
  wow: { keys: teams(4), arena3: teams(2), delves: party(4) },
  pubg: { squad: teams(3), arcade: party(3) },
  wr: { five: teams(4), aram: party(4), norm: party(4) },
  // Deadlock is 6v6
  dl: { six: teams(5), unranked: party(5) },
  // Social calls with more than one Gamer Girl (owner request 2026-11-06). Sleep Call stays one.
  social: { chat: party(3), watch: party(3), karaoke: party(3) },
};

const SINGLE: SeatRule = Object.freeze({ min: 1, max: 1, default: 1 });

/** The seat rule of a service; one teammate when the service isn't a group service. */
export function seatRule(gameId: string, serviceId: string): SeatRule {
  return RULES[gameId]?.[serviceId] ?? SINGLE;
}

/** True when the service can take more than one teammate. */
export function isGroupService(gameId: string, serviceId: string): boolean {
  return seatRule(gameId, serviceId).max > 1;
}

/** Throws unless `seats` is allowed for the service. */
export function checkSeats(gameId: string, serviceId: string, seats: number) {
  const rule = seatRule(gameId, serviceId);
  if (!Number.isInteger(seats) || seats < rule.min || seats > rule.max)
    throw new Error('Invalid seat count');
}

/**
 * The price of one unit (game or hour) for the whole booking, in cents. Per-seat services multiply
 * by the seats; group-priced services already are the whole group.
 */
export function bookingUnitCents(
  unitCents: number,
  gameId: string,
  serviceId: string,
  seats: number,
): number {
  return seatRule(gameId, serviceId).groupPrice ? unitCents : unitCents * seats;
}
