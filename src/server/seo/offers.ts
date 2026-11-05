import { servicesFor } from '../../design-reference/lib/catalog.js';
import { ranksOf } from '../../design-reference/lib/ranks.js';
import { serversFor } from '../../design-reference/lib/servers.js';
import { calculateQuote } from '../pricing';
import type { QuoteContext } from '../../contracts/pricing';

export const cleanCopy = (text: string) =>
  text.replaceAll('&', 'and').replace(/[–—]/g, ' to ');
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
          rank: rank ? cleanCopy(rank) : 'Flat price',
          unit: quote.unit,
          currency: quote.customer.currency,
          amountMinor: quote.customer.amountMinor,
          price: (quote.customer.amountMinor / 100).toFixed(2),
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
      name: `${offer.title}, ${offer.rank}, per ${offer.unit}`,
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
