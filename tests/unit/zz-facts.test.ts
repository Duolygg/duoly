import { it } from 'vitest';
import { hubOffers } from '../../src/server/seo/hub';
import { hubHeroOffer, mainServiceId } from '../../src/server/seo/hero-offer';
import { HUB_PAGES } from '../../src/content/hub-pages';
import { SITE_GAMES } from '../../src/site/games';

it('facts', () => {
  for (const copy of HUB_PAGES) {
    const game = SITE_GAMES.find((g) => g.slug === copy.gameSlug)!;
    const offers = hubOffers(game.id, {
      customerCurrency: 'EUR',
      eurToUsd: 1,
    });
    const offer = hubHeroOffer(
      game.id,
      offers.all,
      copy.services[mainServiceId(game.id)],
    )!;
    const floor = [...offers.all].sort(
      (a, b) => a.amountMinor - b.amountMinor,
    )[0]!;
    const inTeammate = offers.teammate.some(
      (o) => o.id === floor.id && o.amountMinor === floor.amountMinor,
    );
    console.log(
      `${copy.gameSlug}\n  tier: ${offer.tier}\n  fact1: ${offer.facts[0]}\n  cheapest: ${offer.cheapest ? `${offer.cheapest.title} ${offer.cheapest.price}/${offer.cheapest.unit}` : 'none'} inTeammateGroup=${inTeammate}`,
    );
  }
});
