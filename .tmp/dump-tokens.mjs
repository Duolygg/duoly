import { SITE_GAMES } from '/Users/sebastianschrottenbach/Desktop/Duoly/duoly-hubs/src/site/games.ts';
import { hubPrices, hubServiceIds } from '/Users/sebastianschrottenbach/Desktop/Duoly/duoly-hubs/src/server/seo/hub.ts';
import { HUB_PAGES } from '/Users/sebastianschrottenbach/Desktop/Duoly/duoly-hubs/src/content/hub-pages.ts';
import { priceSummary } from '/Users/sebastianschrottenbach/Desktop/Duoly/duoly-hubs/src/server/seo/offers.ts';
import { hubOffers } from '/Users/sebastianschrottenbach/Desktop/Duoly/duoly-hubs/src/server/seo/hub.ts';
for (const page of HUB_PAGES) {
  const game = SITE_GAMES.find((g) => g.slug === page.gameSlug);
  const t = hubPrices(game.id, { eurToUsd: 1 });
  const offers = hubOffers(game.id, { customerCurrency: 'EUR', eurToUsd: 1 });
  console.log('###', page.gameSlug, game.id, '| services:', hubServiceIds(game.id).join(','));
  console.log('   from:', priceSummary(offers.all));
  const keys = Object.keys(t).sort();
  console.log('   ' + keys.map((k) => `${k}=${t[k]}`).join('  '));
}
