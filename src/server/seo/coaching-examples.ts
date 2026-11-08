import { sessionExamples } from '../../content/coaching-examples';
import type { seoOffers } from './offers';
import { prosePrice, quantityAnswer, offerList } from './citable-answers';

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

// Copy writes {price:vod}; the page fills in the checkout price and unit for the visitor's currency.
export const withPrices = (text: string, offers: Offers) =>
  text.replace(/\{price:([a-z0-9]+)\}/g, (_, id: string) =>
    priceOf(offers, id),
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

// One sentence comparing the other services for the same game, with their real prices.
export function compareOthers(offers: Offers, id: string) {
  const others = [
    ...new Map(
      offers
        .filter((offer) => offer.id !== id)
        .map((offer) => [offer.id, offer]),
    ).values(),
  ].map((offer) => `${offer.title} at ${prosePrice(offer)}`);
  if (!others.length)
    return `Finally, check your practice goal before starting. Quantity discount: 0%. Checked 8 November 2026.`;
  const list = new Intl.ListFormat('en', { type: 'conjunction' }).format(
    others,
  );
  return `Finally, compare ${list}. Quantity discount: 0%. Checked 8 November 2026.`;
}

// The booking answer on every coaching page, built from the real services and prices.
export function bookingAnswer(gameName: string, offers: Offers) {
  return `A ${gameName} coaching booking is a prepaid lesson from Duoly: ${offerList(offers)}. First, choose one goal, for example a difficult matchup. ${quantityAnswer(offers)} Step 1 is to check your billing unit and quantity. Second, share your region, platform and experience in the order chat. Every coach is reviewed by Duoly before taking orders. Your lesson runs on your own account, using Discord for voice and screen share. Finally, check the agreed focus before starting, so the coach can connect feedback to the next game. Keep login details private. Repeat the agreed exercise 3 times.`;
}
