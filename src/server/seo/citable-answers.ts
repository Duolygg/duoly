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

/**
 * The discount ladder, in full, from the engine that charges it.
 *
 * The bundle row used to name only what it changed against the quantity row (3
 * units and 10), because a bundle of 5 carries the same percentage as an
 * ordinary order of 5 (src/contracts/pricing.ts). Leaving 5 out of the bundle
 * ladder read as an omission beside the price cards, which show all three
 * bundle chips, so the row states its whole ladder and repeats the 20%.
 */
export function quantityAnswer(offers: Offers) {
  const offer = offers[0]!;
  const unit = offer.unit === 'hour' ? 'hours' : 'games';
  const bundle = BUNDLE_UNITS.map(
    (units, index) =>
      `${quantityDiscountPercent(units, { bundle: true })}% off ${units}${index === 0 ? ` ${unit}` : ''}`,
  );
  return offer.cat === 'training'
    ? 'Quantity discounts and bundles do not apply to coaching.'
    : `Book 1 to 5 ${unit}, and 5 ${unit} take ${quantityDiscountPercent(5)}% off. Bundles of the main service take ${bundle.slice(0, -1).join(', ')} and ${bundle.at(-1)}.`;
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
    'Call of Duty':
      'one mode and one rotation, for example a move that started after the circle closed',
    'Dota 2':
      'one position and one item, for example a Black King Bar bought after the fight',
    Minecraft:
      'one mode and one lost round, for example a rush that left your own bed open',
    'World of Warcraft':
      'one spec and one pull, for example a cast nobody had a kick left for',
    Deadlock:
      'one hero and one mid game moment, for example a Mid Boss attempt with no vision',
  };
  return `A ${gameName} lesson from Duoly is one booked session on a problem you pick. First, bring ${goals[gameName] ?? 'one situation from your games'}. Then, 1) share the goal in the order chat, 2) meet your coach using Discord and 3) stay on your own account.`;
}

/**
 * Second closing paragraph: the facts a reader still needs after deciding to book.
 * Written as a self-contained answer so an assistant quoting only the closing
 * section still states where payment happens, that bundles exclude coaching and
 * where the refund rules live. The price line is appended by ClosingCta.
 */
export function closingDetail(offers: Offers) {
  const coach = offers[0]!.cat === 'training';
  const bundles = coach
    ? 'Bundles do not apply to coaching, so five lessons cost five times the single price.'
    : `${quantityAnswer(offers)} Bundle pricing is applied in the checkout, not on request.`;
  return `Booking takes three steps: choose the ${coach ? 'lesson' : 'session'}, pay on duoly.gg, then agree a start time in the order room. Step 2 always happens on Duoly, never in a private message. ${bundles} A Duoly ${coach ? 'coach' : 'teammate'} accepts the order from the queue rather than receiving an assignment, and the Duoly terms carry the cancellation and refund rules. Finally, expect a question about rank, role and region before the first match loads.`;
}

/**
 * The sentence every price grid owes a reader: what the listed figure includes,
 * what moves it, and where it becomes final. Shared by the hub, intent and
 * coaching price sections so the rules are stated once and stay true per
 * category: bundles come from calculateQuote, and coaching has none.
 */
const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);

export function priceNote(offers: Offers, coach = false) {
  const ranked = offers.some((offer) => offer.rank);
  const unit = offers[0]!.unit === 'hour' ? 'hour' : 'game';
  return `Every figure above is the base price from Duoly for one ${unit}, before account perks. First, ${
    ranked
      ? 'your own rank moves a ranked price'
      : 'these services are flat priced'
  }. Second, ${lowerFirst(quantityAnswer(offers))} For example, ${
    coach
      ? 'a first lesson and a fifth cost the same'
      : 'a longer booking reaches the largest discount shown'
  }. Payment finishes on duoly.gg, using Discord voice on your own account.`;
}
