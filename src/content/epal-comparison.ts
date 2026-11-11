import { calculateQuote } from '../server/pricing';

/** Date every E-Pal fact on /compare/e-pal was read from E-Pal's own pages. */
export const CHECKED = '2026-11-08';

export const comparisonSelection = {
  gameId: 'lol',
  serviceId: 'duo2',
  rank: 'Gold',
  server: 'EUW',
  units: 3,
  // a Bundles tab pack: Duo Pro is League's main service (src/contracts/pricing.ts)
  bundle: true,
};
const quote = calculateQuote(comparisonSelection, {
  eurToUsd: 1,
  customerCurrency: 'EUR',
});
const eur = (minor: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
    minor / 100,
  );
export const comparisonExample = {
  amountMinor: quote.customer.amountMinor,
  price: eur(quote.customer.amountMinor),
  unitPrice: eur(quote.unitPriceEurMinor),
  discountPercent: quote.quantityDiscountPercent,
  href: '/?game=lol&service=duo2&rank=Gold&region=EUW&qty=3#modes-h',
};

const home = 'https://www.epal.gg/';
const profile = 'https://www.epal.gg/@Serolae';
const wallet = 'https://www.epal.gg/help/faq/21';
const disputes = 'https://www.epal.gg/help/faq/31';
const applications = 'https://www.epal.gg/help/faq/30';
const terms = 'https://policies.epal.gg/terms';
type Mark = 'yes' | 'no' | 'part' | 'neutral' | 'unknown';
export const comparisonRows: {
  label: string;
  duoly: Mark;
  epal: Mark;
  duolyNote: string;
  epalNote: string;
  epalSource: string;
}[] = [
  {
    label: 'Who sets the price',
    duoly: 'neutral',
    epal: 'neutral',
    duolyNote: 'Duoly sets fixed prices by game, service and rank.',
    epalNote: 'Each provider sets their own price.',
    epalSource: applications,
  },
  {
    label: 'Pay without a prepaid coin',
    duoly: 'yes',
    epal: 'no',
    duolyNote: 'Card payment through Stripe in EUR or USD.',
    epalNote: 'Buy Buff first, with a 10% service fee.',
    epalSource: wallet,
  },
  {
    label: 'Games and services',
    duoly: 'part',
    epal: 'yes',
    duolyNote: '20 games plus Social.',
    epalNote:
      '100+ games and lifestyle services combined, not a game-only count.',
    epalSource: home,
  },
  {
    label: 'Social companionship',
    duoly: 'part',
    epal: 'yes',
    duolyNote: 'Just Chat, Watch Together, Sleep Call and Karaoke.',
    epalNote: 'Chat, karaoke, movies, study sessions and language exchange.',
    epalSource: home,
  },
  {
    label: 'Choose a specific provider before booking',
    duoly: 'no',
    epal: 'yes',
    duolyNote: 'The first eligible teammate to accept takes the order.',
    epalNote:
      'Browse individual profiles and order from a chosen ePal, such as Serolae.',
    epalSource: profile,
  },
  {
    label: 'Public provider reviews before booking',
    duoly: 'no',
    epal: 'yes',
    duolyNote: 'No public provider review directory in the booking flow.',
    epalNote: 'Profiles show client reviews, as Serolae’s profile does.',
    epalSource: profile,
  },
  {
    label: 'Providers reviewed',
    duoly: 'yes',
    epal: 'yes',
    duolyNote: 'Reviewed before the first order.',
    epalNote:
      'Applications reviewed in 2 to 3 business days, longer at peak times.',
    epalSource: applications,
  },
  {
    label: 'Refund review for a failed session',
    duoly: 'yes',
    epal: 'yes',
    duolyNote: 'Reports reviewed by a real person; a refund may be granted.',
    epalNote:
      'Disputes within 72 hours of acceptance; refunds depend on review.',
    epalSource: disputes,
  },
  {
    label: 'Default refund destination',
    duoly: 'neutral',
    epal: 'neutral',
    duolyNote: 'Duoly balance.',
    epalNote: 'E-Pal account Buff balance for disputed orders.',
    epalSource: disputes,
  },
  {
    label: 'Refund to the original payment method',
    duoly: 'yes',
    epal: 'unknown',
    duolyNote:
      'Balance by default; refunded money can be paid back to the original method on request through support.',
    epalNote:
      'Not stated in the cited help pages. Account refunds are documented; this is not a No.',
    epalSource: disputes,
  },
  {
    label: 'Adults only',
    duoly: 'yes',
    epal: 'yes',
    duolyNote: 'Terms require age 18 or older.',
    epalNote: 'Terms require age 18 or older.',
    epalSource: terms,
  },
];

export const epalSources = [
  {
    title: 'E-Pal homepage: catalog and sample listings',
    url: home,
    accessed: CHECKED,
  },
  {
    title: 'E-Pal help: service application and review',
    url: applications,
    accessed: CHECKED,
  },
  {
    title: 'E-Pal help: Wallet, Buff and fees',
    url: wallet,
    accessed: CHECKED,
  },
  {
    title: 'E-Pal help: disputed orders and refunds',
    url: disputes,
    accessed: CHECKED,
  },
  {
    title: 'E-Pal Terms of Service: minimum age',
    url: terms,
    accessed: CHECKED,
  },
  {
    title:
      'E-Pal public provider profile: Serolae, services and client reviews',
    url: profile,
    accessed: CHECKED,
  },
] as const;
