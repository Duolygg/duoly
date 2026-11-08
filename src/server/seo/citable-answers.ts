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
    ? 'Bundles do not apply to coaching.'
    : `Bundles of 3, 5 and 10 ${offer.unit === 'hour' ? 'hours' : 'games'} receive ${discounts[0]}%, ${discounts[1]}% and ${discounts[2]}% off respectively.`;
}

export function pricesAnswer(gameId: string, offers: Offers, coach: boolean) {
  const name = SITE_GAMES.find((game) => game.id === gameId)?.name ?? gameId;
  if (coach && !offers.some((offer) => offer.id === 'learn'))
    return `${offers[0]!.title} gives you an hour to work through your recording and compare the decisions before you spent your gold. Bring the full game so the review can follow your econ, rolling and comp pivots.`;
  if (coach)
    return offers.every((offer) => offer.unit === 'hour')
      ? `Your ${name} lesson is booked by the hour, including time spent reviewing decisions and answering questions. For live play, the number of matches depends on game length and how much you stop to discuss.`
      : `Choose the ${name} lesson for the problem you want to work on. Play and Learn is priced per game; the focused lessons are hourly, with time to pause, ask questions and practice.`;
  return offers.some((offer) => offer.rank)
    ? `Choose your mode, then check the ranked price for your rank. ${quantityAnswer(offers)} The bundle discounts apply to casual games too.`
    : `Choose the session and how much time you want to book. ${quantityAnswer(offers)} Agree on voice and a start time in the order chat.`;
}

export function closingAnswer(gameName: string) {
  const goals: Record<string, string> = {
    Valorant: 'an agent, a round or a duel you want to understand',
    'League of Legends': 'a lane matchup, a wave decision or a jungle route',
    'Rocket League': 'a Doubles rotation or a recovery you want to get right',
    Fortnite: 'a box fight, an edit or a zone rotation',
    'Teamfight Tactics': 'a roll-down, an econ decision or a comp pivot',
    'Apex Legends':
      'a rotation, a movement problem or a fight that drew a third party',
    'Marvel Rivals':
      'a hero matchup, a Team-Up or an ultimate you want to time better',
  };
  return `Bring ${goals[gameName] ?? 'one situation from your recent games'}. Pick your lesson, share the goal in the order chat and meet your coach on Discord. You stay on your own account throughout.`;
}
