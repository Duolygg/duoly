import { servicesFor } from '../../design-reference/lib/catalog.js';
import { ranksOf } from '../../design-reference/lib/ranks.js';
import { serversFor } from '../../design-reference/lib/servers.js';
import { calculateQuote } from '../pricing';
import type { QuoteContext } from '../../contracts/pricing';

export const cleanCopy = (text: string) =>
  text
    .replaceAll('&', 'and')
    .replace(/[–—]/g, ' to ')
    .replace(/practis/g, 'practic');
// Same money format as the homepage and checkout: €10.99 or $10.99.
export const formatPrice = (amountMinor: number, currency: string) =>
  (currency === 'USD' ? '$' : '€') + (amountMinor / 100).toFixed(2);
// The hero price line: a plain price when every service costs the same per unit, otherwise the lowest one.
export function priceSummary(offers: ReturnType<typeof seoOffers>) {
  const first = [...offers].sort((a, b) => a.amountMinor - b.amountMinor)[0]!;
  const same = offers.every(
    (offer) =>
      offer.amountMinor === first.amountMinor && offer.unit === first.unit,
  );
  return `${same ? '' : 'From '}${first.display} per ${first.unit}`;
}
// Short coaching hero facts: coach ranks and how lessons are sold.
export function coachingFacts(offers: ReturnType<typeof seoOffers>) {
  const ranks = [...new Set(offers.map((offer) => offer.provider))];
  const units = new Set(offers.map((offer) => offer.unit));
  return [
    `${ranks.join(' and ')} coaches`,
    units.size > 1
      ? 'Per game or by the hour'
      : units.has('hour')
        ? '1 hour lessons'
        : 'Priced per game',
    'Voice and screen share on Discord',
  ];
}
export function seoOffers(
  gameId: string,
  category: 'training' | 'gg' | 'teammate',
  context: QuoteContext,
) {
  const modes = servicesFor(gameId).modes as {
    id: string;
    cat: string;
    title: string;
    tier: string;
    desc: string;
  }[];
  return modes
    .filter((mode) =>
      category === 'teammate'
        ? ['duo', 'social'].includes(mode.cat) && mode.id !== 'skirm'
        : mode.cat === category,
    )
    .flatMap((mode) => {
      const ranks = ranksOf(gameId, mode.id) as string[];
      return (ranks.length ? ranks : [undefined]).map((rank) => {
        const selection = {
          gameId,
          serviceId: mode.id,
          units: 1,
          server: serversFor(gameId)[0][0],
          ...(rank ? { rank } : {}),
        };
        const quote = calculateQuote(selection, {
          ...context,
          firstCoachingSessionEligible: false,
        });
        return {
          id: mode.id,
          title: cleanCopy(mode.title),
          tier: cleanCopy(mode.tier),
          desc: cleanCopy(mode.desc),
          cat: mode.cat,
          rank: rank ? cleanCopy(rank) : '',
          provider: cleanCopy(mode.tier.split(' · ')[0]!).replace(
            / coach$/,
            '',
          ),
          unit: quote.unit,
          currency: quote.customer.currency,
          amountMinor: quote.customer.amountMinor,
          price: (quote.customer.amountMinor / 100).toFixed(2),
          display: formatPrice(
            quote.customer.amountMinor,
            quote.customer.currency,
          ),
          selection,
        };
      });
    });
}
export function serviceSchema(
  name: string,
  path: string,
  offers: ReturnType<typeof seoOffers>,
  site: URL,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    url: new URL(path, site).href,
    provider: { '@type': 'Organization', name: 'Duoly', url: site.href },
    offers: offers.map((offer) => ({
      '@type': 'Offer',
      name: `${offer.title}${offer.rank ? `, ${offer.rank}` : ''}, per ${offer.unit}`,
      price: offer.price,
      priceCurrency: offer.currency,
      url: new URL('/#games', site).href,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: offer.price,
        priceCurrency: offer.currency,
        unitText: offer.unit,
      },
    })),
  };
}
