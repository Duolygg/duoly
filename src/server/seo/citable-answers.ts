import { BUNDLE_UNITS, quantityDiscountPercent } from '../../contracts/pricing';
import { servicesFor } from '../../design-reference/lib/catalog.js';
import { SITE_GAMES } from '../../site/games';
import { cleanCopy, type seoOffers } from './offers';

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
 * The game's main service by name: the one its Bundles tab is built from.
 *
 * Copy used to say "the main service", which is the catalog's word for it and
 * not a thing a reader can point at. The name comes from the catalog, so the
 * sentence and the Bundles tab always agree.
 */
export function mainServiceTitle(gameId: string) {
  const { main, modes } = servicesFor(gameId) as {
    main: string;
    modes: { id: string; title: string }[];
  };
  const mode = modes.find((item) => item.id === main);
  return mode ? cleanCopy(mode.title) : '';
}

/**
 * The discount ladder, in full, from the engine that charges it.
 *
 * The bundle row used to name only what it changed against the quantity row (3
 * units and 10), because a bundle of 5 carries the same percentage as an
 * ordinary order of 5 (src/contracts/pricing.ts). Leaving 5 out of the bundle
 * ladder read as an omission beside the price cards, which show all three
 * bundle chips, so the row states its whole ladder and repeats the 20%.
 *
 * The quantity sentence names who it is about. "Book 1 to 5 games, and 5 take
 * 20% off" sat directly beside a bundle ladder of 3, 5 and 10 on the same
 * grid, so a reader had two ranges for one picker. Only the main service sells
 * bundles, so the picker sentence covers everything else and the bundle
 * sentence names the service it belongs to.
 */
export function quantityAnswer(offers: Offers) {
  const offer = offers[0]!;
  const unit = offer.unit === 'hour' ? 'hours' : 'games';
  const bundle = BUNDLE_UNITS.map(
    (units, index) =>
      `${quantityDiscountPercent(units, { bundle: true })}% off ${units}${index === 0 ? ` ${unit}` : ''}`,
  );
  const main = mainServiceTitle(offer.selection.gameId);
  const ladder = `${bundle.slice(0, -1).join(', ')} and ${bundle.at(-1)}`;
  if (offer.cat === 'training')
    return 'Quantity discounts and bundles do not apply to coaching.';
  return main
    ? `Teammate services without bundles book 1 to 5 ${unit}, and 5 ${unit} take ${quantityDiscountPercent(5)}% off. ${main} offers bundles: ${ladder}.`
    : `Book 1 to 5 ${unit}, where 5 ${unit} take ${quantityDiscountPercent(5)}% off. Bundles take ${ladder}.`;
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
  return `A ${gameName} lesson from Duoly is one booked session on a problem you pick. Bring ${goals[gameName] ?? 'one situation from your games'}. Then 1) share the goal in the order chat, 2) meet your coach using Discord and 3) stay on your own account.`;
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
  return `Booking takes three steps: choose the ${coach ? 'lesson' : 'session'}, pay on duoly.gg, then agree a start time in the order room. Step 2 always happens on Duoly, never in a private message. ${bundles} A Duoly ${coach ? 'coach' : 'teammate'} accepts the order from the queue rather than receiving an assignment, and the Duoly terms carry the cancellation and refund rules. Expect a question about rank, role and region before the first match loads.`;
}

/**
 * The sentence every price grid owes a reader: what the listed figure includes,
 * what moves it, and where it becomes final. Shared by the hub, intent and
 * coaching price sections so the rules are stated once and stay true per
 * category: bundles come from calculateQuote, and coaching has none.
 *
 * It used to be four clauses wired together with "First, ... Second, ... For
 * example, ...", and the example was not one: "a longer booking reaches the
 * largest discount shown" named no booking and no discount, and it was wrong
 * beside a grid where 25% off 10 belongs to the main service alone. The note
 * now states the rank rule, the discount rule and where the order finishes, as
 * three plain sentences. The last one was a single clause that mixed two
 * different facts, payment and play, so it is two sentences now.
 *
 * On a coaching grid the discount rule names the discounts it is excluding.
 * "Quantity discounts and bundles do not apply to coaching" is true and leaves
 * a reader who has just read a teammate page wondering which discounts those
 * were, so the note states the ladder it rules out, from the same engine that
 * applies it to teammate orders.
 */
export function priceNote(offers: Offers, coach = false) {
  const ranked = offers.some((offer) => offer.rank);
  const unit = offers[0]!.unit === 'hour' ? 'hour' : 'game';
  const rule = ranked
    ? 'Your own rank moves a ranked price.'
    : 'These services are flat priced, so every rank pays the same.';
  if (!coach)
    return `Every figure above is the base price from Duoly for one ${unit}, before account perks. ${rule} ${quantityAnswer(offers)} Payment finishes on duoly.gg. You play on your own account, with voice on Discord.`;
  return `Every figure above is the base price from Duoly for one ${unit}, before account perks. ${rule} Coaching has no quantity or bundle discount: five lessons cost five times the single lesson price. Choose a live session to discuss decisions as you play, or a review to pause and revisit them with your coach. Payment finishes on duoly.gg. You play on your own account, with voice and screen share on Discord.`;
}
