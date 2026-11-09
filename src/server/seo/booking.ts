import { ORDER_MOODS } from '../../contracts/orders';
import { MAX_SEATS } from '../../contracts/seats';
import { QUANTITIES } from '../../contracts/pricing';
import { servicesFor } from '../../design-reference/lib/catalog.js';
import { SITE_GAMES } from '../../site/games';

/**
 * How a Duoly booking really runs, as facts read out of the code that runs it.
 *
 * /how-it-works and /trust-and-safety describe the booking flow, and the one
 * thing that makes such a page worth citing is that it matches the product. So
 * nothing here is a description of how booking ought to work: every value comes
 * from the contract, the catalog or the component that implements the step, and
 * tests/unit/booking-facts.test.ts re-derives each one. A flow change fails the
 * build rather than leaving a page describing last month's product.
 */

/** The quantity picker's steps, 1 to 5 games or hours (src/contracts/pricing.ts). */
export const QUANTITY_STEPS = [...QUANTITIES];
/** The most teammates one order can hire (src/contracts/seats.ts). */
export const MAX_TEAMMATES = MAX_SEATS;
/** How a customer can ask the session to feel (20261101120000_order_moods). */
export const MOODS = [...ORDER_MOODS];

/**
 * Free re-rolls and the window they live in.
 *
 * Declared here rather than imported because the constants are module-private
 * in src/components/account/queue-room-data.js (MAX_REROLLS, REROLL_WINDOW_MS),
 * which is a browser bundle rather than a contract. tests/unit/booking-facts
 * reads that file and fails when either number moves, the same way
 * tests/unit/entity.test.ts holds src/site/entity.ts to /imprint.
 */
export const FREE_REROLLS = 2;
export const REROLL_MINUTES = 5;

/**
 * Screenshots a teammate attaches to finish an order, from the completion
 * contract (src/contracts/completion.ts, `proof_ids`). The test feeds 0 and 6
 * through the schema, so these two numbers are the contract's own limits.
 */
export const PROOF_MIN = 1;
export const PROOF_MAX = 5;

/**
 * The payment methods a customer can actually pick, in the order the homepage
 * strip shows them.
 *
 * Two files have to agree for a method to be real: it is switched on in Stripe
 * and rendered by src/components/home/PaymentMethods.jsx, and the order
 * confirmation can label it (METHOD_LABELS in
 * src/server/payments/confirm-email.ts). The test checks a listed name against
 * both, so a method that is only half wired up never reaches a public page.
 */
export const CARD_BRANDS = ['Visa', 'Mastercard', 'American Express'] as const;
/**
 * Apple Pay and Google Pay are card wallets: Stripe reports both as the `card`
 * method, so the order confirmation labels them "Card" rather than by name.
 * They belong with the cards here for exactly that reason.
 */
export const CARD_WALLETS = ['Apple Pay', 'Google Pay'] as const;
/** Methods of their own, each with its own label on the confirmation. */
export const ALT_METHODS = ['PayPal', 'Klarna'] as const;
export const LOCAL_METHODS = ['iDEAL', 'Bancontact', 'EPS'] as const;
/** The payment provider named in the privacy policy and the terms. */
export const PAYMENT_PROVIDER = 'Stripe';

/**
 * The minimum rank the teammate application accepts, for the three games the
 * trust page names as examples.
 *
 * The rank picker in src/design-reference/components/Apply.jsx offers the
 * minimum and everything above it, and its `NEEDS` table is private to that
 * component's render. So the labels are declared here and
 * tests/unit/booking-facts.test.ts reads Apply.jsx to prove each one is still
 * the minimum that form offers. A page may not invite applicants at a rank the
 * form would reject.
 */
export const TEAMMATE_MIN_RANKS: readonly [string, string][] = [
  ['League of Legends', 'Diamond 4 or higher'],
  ['Valorant', 'Ascendant 1 or higher'],
  ['Counter-Strike 2', 'Premier 15,000+ or FACEIT Level 8+'],
];

/**
 * The four review stages between an application and a first order, from the
 * timeline on /apply ("From application to first payout").
 */
export const REVIEW_STAGES: readonly [string, string][] = [
  ['Apply', 'The form: identity, age, game, rank, region and an intro video.'],
  ['Rank check', 'Duoly verifies the account and its rank history.'],
  ['Tryout game', 'One game with the Duoly team using Discord.'],
  ['Go online', 'The account is switched on and can accept orders.'],
];

/** Every bookable service in the catalog, counted rather than claimed. */
export const SERVICE_COUNT = SITE_GAMES.reduce(
  (total, game) =>
    total +
    (((servicesFor(game.id) as { modes?: unknown[] }).modes ?? []).length ?? 0),
  0,
);

/** Games with a page of their own plus the voice-only Social category. */
export const CATALOG_GAMES = SITE_GAMES.length;
