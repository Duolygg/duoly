import { sessionExamples } from '../../content/coaching-examples';
import type { seoOffers } from './offers';
import { prosePrice } from './citable-answers';

type Offers = ReturnType<typeof seoOffers>;

export function exampleOffers(gameId: string, offers: Offers) {
  return offers.flatMap((offer) => {
    const example = sessionExamples[gameId]?.[offer.id];
    return example ? [{ offer, example }] : [];
  });
}

const priceOf = (offers: Offers, id: string) => {
  const offer = offers.find((item) => item.id === id);
  if (!offer) throw new Error(`No coaching price for ${id}`);
  return prosePrice(offer);
};

const amountOf = (offers: Offers, id: string) => {
  const offer = offers.find((item) => item.id === id);
  if (!offer) throw new Error(`No coaching price for ${id}`);
  return `${offer.currency === 'EUR' ? 'EUR' : 'USD'} ${Number(offer.price)}`;
};

// Copy writes {price:vod} for "EUR 12.99 per hour" and {amount:vod} for "EUR 12.99";
// the page fills in the checkout price and unit for the visitor's currency.
export const withPrices = (text: string, offers: Offers) =>
  text
    .replace(/\{price:([a-z0-9]+)\}/g, (_, id: string) => priceOf(offers, id))
    .replace(/\{amount:([a-z0-9]+)\}/g, (_, id: string) =>
      amountOf(offers, id),
    );

const article = (word: string) => (/^[AEIOU]/i.test(word) ? 'an' : 'a');

// First sentence of an example session: what the service is, who coaches it and what it costs.
export function sessionLead(
  gameName: string,
  offer: Offers[number],
  goal: string,
) {
  const coach = `${article(offer.provider)} ${offer.provider} coach`;
  const what =
    offer.id === 'learn'
      ? offer.unit === 'game'
        ? `one live ${gameName} game with ${coach}`
        : `a live 1-hour ${gameName} session with ${coach}`
      : `a 1-hour ${gameName} lesson with ${coach}`;
  return `${offer.title} is ${what}, at ${prosePrice(offer)} from Duoly, using Discord voice and screen share. For example, the goal can be to ${goal.charAt(0).toLowerCase()}${goal.slice(1)}.`;
}

// Point to alternatives without repeating the price cards.
export function compareOthers(offers: Offers, id: string) {
  const others = [
    ...new Map(
      offers
        .filter((offer) => offer.id !== id)
        .map((offer) => [offer.id, offer.title]),
    ).values(),
  ];
  return others.length
    ? `Want a different focus? Compare ${new Intl.ListFormat('en', { type: 'conjunction' }).format(others)} above, then name the goal in the order chat before the session starts.`
    : 'Bring the recording that best shows the decision you want to unpack, and name the goal in the order chat before the session starts.';
}
