import { calculateQuote } from '../pricing';
import { SITE_GAMES } from '../../site/games';
import type { seoOffers } from './offers';

type Offers = ReturnType<typeof seoOffers>;

export function prosePrice(offer: Offers[number]) {
  return `${offer.currency === 'EUR' ? 'EUR' : 'USD'} ${Number(offer.price)} per ${offer.unit}`;
}

export function offerList(offers: Offers) {
  return new Intl.ListFormat('en', { type: 'conjunction' }).format(
    [...new Set(offers.map((offer) => offer.id))].map((id) => {
      const offer = offers
        .filter((item) => item.id === id)
        .sort((a, b) => a.amountMinor - b.amountMinor)[0]!;
      return `${offer.title} ${offer.rank ? 'starting at' : 'at'} ${prosePrice(offer)}${offer.rank ? ` for ${offer.rank} customers` : ''}`;
    }),
  );
}

export function quantityAnswer(offers: Offers) {
  const offer = offers[0]!;
  const discounts = [3, 5, 10].map(
    (units) =>
      calculateQuote(
        { ...offer.selection, units },
        {
          customerCurrency: offer.currency,
          eurToUsd: 1,
          firstCoachingSessionEligible: false,
        },
      ).quantityDiscountPercent,
  );
  return offer.cat === 'training'
    ? `Coaching has a ${discounts[0]}% quantity discount, so extra ${[...new Set(offers.map((item) => `${item.unit}s`))].join(' or ')} keep the same standard unit price.`
    : `Bundles of 3, 5 and 10 units receive ${discounts[0]}%, ${discounts[1]}% and ${discounts[2]}% off respectively.`;
}

function offerUnitExample(unit: string) {
  return unit === 'hour'
    ? 'For example, one booking unit covers one hour of the selected session, including any agreed discussion.'
    : 'For example, one booking unit covers one full game with your chosen teammate, regardless of match length.';
}

export function pricesAnswer(gameId: string, offers: Offers, coach: boolean) {
  const name = SITE_GAMES.find((game) => game.id === gameId)?.name ?? gameId;
  return `${name} ${coach ? 'coaching is a paid lesson' : 'teammate booking is a paid session'} with prices from Duoly: ${offerList(offers)}. We found these prices by checking the checkout calculator on 8 November 2026. ${quantityAnswer(offers)} ${offers.length === 1 ? 'An hour covers the booked time for review and questions. Extra games are outside the hourly lesson unless the selected service includes live play. ' : ''}${new Set(offers.map((item) => item.unit)).size > 1 ? 'For example, a single-game booking covers one match, while an hourly booking covers the selected time.' : offerUnitExample(offers[0]!.unit)} Check each description for the activity and provider tier. Meet your ${coach ? 'coach' : 'teammate'} in the order chat, agree on voice using Discord and keep control of your own account. Finally, review the checkout total before paying; any eligible personal offer appears there.`;
}

export function closingAnswer(gameName: string, offers: Offers) {
  return `${gameName} coaching is a paid session from Duoly, available as ${offerList(offers)}. First, choose one goal, for example a difficult matchup. ${quantityAnswer(offers)} Step 2 is to select your service and agree on Discord voice in the order chat.`;
}
