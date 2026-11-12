import { describe, expect, it } from 'vitest';
import { profileMetadata, profilePresentation, profileSchemas, profileRoute } from '../../src/server/teammates/profile-page';
import { fixtureLookup } from '../../src/server/teammates/profile-fixtures';
import { seoOffers } from '../../src/server/seo/offers';

const lookup = fixtureLookup('nyx');
if (lookup.status !== 'ok') throw new Error('Nyx fixture missing');
const nyx = lookup.profile;
describe('public profile page', () => {
  it('builds factual verified titles, metadata and the live cheapest teammate price', () => {
    const meta = profileMetadata(nyx);
    expect(meta.title).toBe('Nyx, Valorant Immortal 3 teammate | Duoly');
    expect(meta.description).toContain('German');
    const view = profilePresentation(nyx);
    const cheapest = seoOffers('val', 'teammate', { customerCurrency: 'EUR', eurToUsd:1 }).sort((a,b) => a.amountMinor-b.amountMinor)[0]!;
    expect(view.offer).toEqual(cheapest);
    expect(view.book).toContain('teammate=nyx');
    expect(profileMetadata({...nyx, games: nyx.games.map(g => ({...g, verified:false}))}).title).toBe('Nyx, Valorant teammate | Duoly');
  });
});
