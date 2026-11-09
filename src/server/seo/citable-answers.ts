import { BUNDLE_UNITS, quantityDiscountPercent } from '../../contracts/pricing';
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
  const unit = offer.unit === 'hour' ? 'hours' : 'games';
  const bundle = BUNDLE_UNITS.map((units) =>
    quantityDiscountPercent(units, { bundle: true }),
  );
  return offer.cat === 'training'
    ? 'Quantity discounts and bundles do not apply to coaching.'
    : `Book 1 to 5 ${unit}, and 5 ${unit} take ${quantityDiscountPercent(5)}% off. Bundles of the main service, 3, 5 and 10 ${unit}, receive ${bundle[0]}%, ${bundle[1]}% and ${bundle[2]}% off respectively.`;
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
    ? `Choose your mode, then check the ranked price for your rank. ${quantityAnswer(offers)} The quantity discount applies to casual games too.`
    : `Choose the session and how much time you want to book. ${quantityAnswer(offers)} Agree on voice and a start time in the order chat.`;
}

export function closingAnswer(gameName: string) {
  const goals: Record<string, string> = {
    Valorant:
      'one agent and one round you keep losing, for example a B site retake',
    'League of Legends':
      'one matchup and one wave decision, for example a recall that gave up plates',
    'Rocket League':
      'one Doubles clip and one recovery, for example a rebound you keep chasing',
    Fortnite:
      'one mode and one lost fight, for example a box fight ended by a fast edit',
    'Teamfight Tactics':
      'one full game and two spending moments, for example a roll-down at stage 3',
    'Apex Legends':
      'one rotation and one fight, for example a crossing that drew a third party',
    'Marvel Rivals':
      'one hero and one team fight, for example an ultimate nobody followed',
    'Counter-Strike 2':
      'one demo and two timestamps, for example an execute nobody followed',
    'Overwatch 2':
      'one role and one team fight, for example an engage your team could not follow',
    'Rainbow Six Siege':
      'one map and one site, for example a retake that arrived a few seconds late',
  };
  return `A ${gameName} lesson from Duoly is one booked session on a problem you pick. First, bring ${goals[gameName] ?? 'one situation from your games'}. Then, 1) share the goal in the order chat, 2) meet your coach using Discord and 3) stay on your own account.`;
}
