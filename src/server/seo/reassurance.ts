import { AUTO_CANCEL_MINUTES } from './fees';

/**
 * The one line under a booking button, built only from rules the site already
 * states in full elsewhere.
 *
 * Every clause is checkable on a page a reader can open:
 *
 *  - "One payment, no subscription": /how-it-works, "How often am I charged?",
 *    quoting the terms ("one upfront payment for every game or hour in the
 *    order, with no charge after each game and no subscription").
 *  - "Cancel free until a teammate accepts": /fees-and-refunds, "Can I
 *    cancel?", and the terms' cancellations and refunds section.
 *  - The self-refund window: AUTO_CANCEL_MINUTES in src/server/seo/fees.ts,
 *    the same number /fees-and-refunds and the homepage FAQ state.
 *
 * Nothing here is a promise the product does not already make. There is no
 * rating, no wait time, no customer count and no guarantee, because Duoly
 * publishes none of those (tests/unit/reassurance.test.ts holds that line).
 *
 * The refund clause is written at a player, not at the order system. "An order
 * nobody accepts refunds itself" made the order the actor and left the reader
 * to work out whose money came back; the line now says who gets what.
 */
export const BOOKING_REASSURANCE = `One payment, no subscription. Cancel free until a teammate accepts, and if no teammate accepts within ${AUTO_CANCEL_MINUTES} minutes you get your money back automatically.`;

/** Where a reader checks the line above, in the order the clauses appear. */
export const REASSURANCE_SOURCES = ['/how-it-works', '/fees-and-refunds'];
