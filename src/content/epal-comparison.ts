import { calculateQuote } from '../server/pricing';

/** Date every E-Pal fact on /compare/e-pal was read from E-Pal's own pages. */
export const CHECKED = '2026-11-07';

export const comparisonSelection = {
  gameId: 'lol',
  serviceId: 'duo2',
  rank: 'Gold',
  server: 'EUW',
  units: 3,
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
  /** ASCII form for prose, readable even when a crawler guesses the wrong charset. */
  priceCode: `EUR ${(quote.customer.amountMinor / 100).toFixed(2)}`,
  unitPriceCode: `EUR ${(quote.unitPriceEurMinor / 100).toFixed(2)}`,
  discountPercent: quote.quantityDiscountPercent,
  href: '/?game=lol&service=duo2&rank=Gold&region=EUW&qty=3#modes-h',
};

type Mark = 'yes' | 'no' | 'part';
export const comparisonRows: {
  label: string;
  duoly: Mark;
  epal: Mark;
  duolyNote: string;
  epalNote: string;
}[] = [
  {
    label: 'Price set by the platform',
    duoly: 'yes',
    epal: 'no',
    duolyNote: 'Fixed price by game, service and rank.',
    epalNote: 'Each provider sets a price.',
  },
  {
    label: 'Pay without a prepaid coin',
    duoly: 'yes',
    epal: 'no',
    duolyNote: 'Card payment through Stripe in EUR or USD.',
    epalNote: 'Buy Buff first, with a 10% service fee.',
  },
  {
    label: 'Number of games',
    duoly: 'part',
    epal: 'yes',
    duolyNote: '15 games plus Social.',
    epalNote: '100+ games and lifestyle services.',
  },
  {
    label: 'Social companionship',
    duoly: 'part',
    epal: 'yes',
    duolyNote: 'Friendly voice sessions only.',
    epalNote: 'Chat, karaoke, movies and more.',
  },
  {
    label: 'Providers reviewed',
    duoly: 'yes',
    epal: 'yes',
    duolyNote: 'Reviewed before the first order.',
    epalNote: 'Applications reviewed in 2 to 3 business days.',
  },
  {
    label: 'Refund for a failed session',
    duoly: 'yes',
    epal: 'yes',
    duolyNote: 'Reports reviewed by a real person.',
    epalNote: 'Disputes within 72 hours of acceptance.',
  },
  {
    label: 'Refund to the original payment method',
    duoly: 'part',
    epal: 'no',
    duolyNote: 'Balance by default, card on request.',
    epalNote: 'Not stated publicly. Disputed funds go to the E-Pal account.',
  },
  {
    label: 'Adults only',
    duoly: 'yes',
    epal: 'yes',
    duolyNote: 'Terms require age 18 or older.',
    epalNote: 'Terms require age 18 or older.',
  },
];

export const epalSources = [
  {
    title: 'E-Pal homepage: games, social services and sample listings',
    url: 'https://www.epal.gg/',
    accessed: CHECKED,
  },
  {
    title: 'E-Pal help: service application and review',
    url: 'https://www.epal.gg/help/faq/30',
    accessed: CHECKED,
  },
  {
    title: 'E-Pal help: Wallet, Buff and fees',
    url: 'https://www.epal.gg/help/faq/21',
    accessed: CHECKED,
  },
  {
    title: 'E-Pal help: disputed orders and refunds',
    url: 'https://www.epal.gg/help/faq/31',
    accessed: CHECKED,
  },
  {
    title: 'E-Pal Terms of Service: minimum age',
    url: 'https://policies.epal.gg/terms',
    accessed: CHECKED,
  },
] as const;
