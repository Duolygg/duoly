import { it } from 'vitest';
import { seoOffers } from '../../src/server/seo/offers';
const ctx = { customerCurrency: 'EUR' as const, eurToUsd: 1 };
it('probe', () => {
  for (const [g,c] of [['val','teammate'],['val','training'],['ow','training'],['lol','training']] as const)
    console.log(g, c, JSON.stringify([...new Map(seoOffers(g,c,ctx).map(o=>[o.id,[o.id,o.title,o.tier,o.display,o.unit,o.who??null]])).values()]));
});
