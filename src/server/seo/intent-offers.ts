import type { QuoteContext } from '../../contracts/pricing';
import type { IntentPage } from '../../content/intent-pages';
import { seoOffers } from './offers';

// Reuse checkout-derived prices. Page-specific descriptions describe shared play
// without importing performance claims or older map references from catalog copy.
export function intentOffers(
  page: IntentPage,
  gameId: string,
  context: QuoteContext,
) {
  return seoOffers(gameId, 'teammate', context)
    .filter((offer) => Object.hasOwn(page.services, offer.id))
    .map((offer) => ({ ...offer, desc: page.services[offer.id]! }));
}
