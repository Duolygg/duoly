/**
 * The published creator terms, version 2026-11-17.
 *
 * A creator accepts this exact version when they apply, and the version plus the time is stored
 * with the application (`creator_applications.terms_version`), so a later version never changes
 * what somebody agreed to. The numbers come from one place, `src/contracts/creators.ts`, which
 * reads Fabian's original `lib/creators.js`; `CREATOR_RULE_LINES` is the same thing in one line
 * each for the dashboard rules box.
 *
 * This is the program's own rulebook, not legal advice, and it does not replace /terms.
 * 24b-creator-payouts-legal.md lists the open questions for the tax advisor (self billing
 * wording, reverse charge, DAC7), which is why payout details ask for business status, a VAT ID
 * and the self billing agreement rather than assuming any of them.
 */
import { CREATOR_RULES } from '../contracts/creators';

export const CREATOR_TERMS_VERSION = '2026-11-17';

const [rising, partner, elite] = CREATOR_RULES.tiers;
const commissions = `${rising!.commission}%, ${partner!.commission}% from ${partner!.from} completed orders in a calendar month and ${elite!.commission}% from ${elite!.from}`;

export interface CreatorTermsSection {
  title: string;
  text: string;
}

export const CREATOR_TERMS: CreatorTermsSection[] = [
  {
    title: 'Who can join',
    text: 'You need to be 18 or older, own the channel you tell us about and apply with a Duoly account that uses your own email. We review every application by hand and can say no without giving a reason. Being a creator does not change your customer account.',
  },
  {
    title: 'Your code and your links',
    text: `You get one code, a short link (duoly.gg/yourcode) and a query link (duoly.gg/?ref=YOURCODE). The code stays ours: we can change or retire it if it clashes with a brand, a trademark or another creator, and we tell you when we do.`,
  },
  {
    title: 'What your viewers get',
    text: `${CREATOR_RULES.viewerDiscountPercent}% off their first Duoly order. It works once per customer, it does not stack with Duoly PRO, and it does not apply to Twitch streamer bookings or the free monthly coaching order.`,
  },
  {
    title: 'What you earn',
    text: `Commission is ${commissions} of what the customer actually paid for the service, without VAT, discounts, refunds and chargebacks. The tier follows the completed orders your code brings in that calendar month, and the month's tier applies to every counted order of that month.`,
  },
  {
    title: 'How long an order counts',
    text: `A customer belongs to the first code they book with, for ${CREATOR_RULES.attributionMonths} months from that first paid order. A later code never takes a customer over, and a customer who already ordered on Duoly is never attributed afterwards.`,
  },
  {
    title: 'Hold, threshold and payout date',
    text: `Commission becomes available 30 days after the order is completed. We pay in the first week of each month, once your available commission reaches €${CREATOR_RULES.payoutMinEur}. Anything below that stays yours and waits for the next month.`,
  },
  {
    title: 'Refunds and reversals',
    text: 'A refunded, voided or charged back order earns nothing, also after a payout. An order with an open report or payment dispute stays on hold until that is closed. We can take a reversal off your next payout.',
  },
  {
    title: 'Invoices and taxes',
    text: 'Send us an invoice, or agree to our monthly self billing document (Gutschrift) in your payout details. You are responsible for your own taxes. Tell us whether you act as a business and give us your VAT ID when you have one.',
  },
  {
    title: 'What is not allowed',
    text: 'No self-referral with your own or a second account, no coupon sites or browser extensions, no cookie stuffing, no spam, and no paid search on the Duoly brand without our written permission. Say clearly that your code is advertising, in the language you post in.',
  },
  {
    title: 'Suspension and changes',
    text: 'We can pause a code or hold a payout while we look into something, and we tell you why. Commission you earned honestly stays yours. We can change these terms for the future, and you will see the new version on your dashboard before it applies.',
  },
];

/** The same rules in one line each, for the dashboard rules box. */
export const CREATOR_RULE_LINES: string[] = [
  `Your viewers get ${CREATOR_RULES.viewerDiscountPercent}% off their first order, once per customer.`,
  `You earn ${commissions}.`,
  `A referred customer keeps counting for ${CREATOR_RULES.attributionMonths} months.`,
  'Commission becomes available 30 days after an order is completed.',
  `Payouts go out in the first week of each month, from €${CREATOR_RULES.payoutMinEur}.`,
  'Refunded, voided or charged back orders earn nothing.',
  'Not allowed: self-referral, coupon sites, paid search on the Duoly brand, spam.',
];
