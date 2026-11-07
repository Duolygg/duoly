import { sessionExamples } from '../../content/coaching-examples';
import type { seoOffers } from './offers';

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
  return `${offer.display} per ${offer.unit}`;
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
  return `${offer.title} is ${what}, priced at ${offer.display} per ${offer.unit}, held with Discord voice and screen share. For example, the goal can be to ${goal.charAt(0).toLowerCase()}${goal.slice(1)}.`;
}

// One sentence comparing the other services for the same game, with their real prices.
export function compareOthers(offers: Offers, id: string) {
  const others = [
    ...new Map(
      offers
        .filter((offer) => offer.id !== id)
        .map((offer) => [offer.id, offer]),
    ).values(),
  ].map((offer) => `${offer.title} at ${offer.display} per ${offer.unit}`);
  if (!others.length) return '';
  const list = new Intl.ListFormat('en', { type: 'conjunction' }).format(
    others,
  );
  return `Compare with ${list}.`;
}

// The booking answer on every coaching page, built from the real services and prices.
export function bookingAnswer(gameName: string, offers: Offers) {
  const services = new Intl.ListFormat('en', {
    style: 'long',
    type: 'conjunction',
  }).format(
    [...new Map(offers.map((offer) => [offer.id, offer])).values()].map(
      (offer) => `${offer.title} at ${offer.display} per ${offer.unit}`,
    ),
  );
  return `Booking a ${gameName} coach on Duoly is a three-step checkout. The services are ${services}. Every coach is reviewed by Duoly before taking orders. Your lesson runs on your own ${gameName} account, with voice and screen share on Discord. Write your goal at checkout, for example one matchup, one habit or one recent loss. A clear goal keeps the lesson focused from the first minute. After payment, your coach meets you in the order chat, and the lesson starts with Discord voice.`;
}
