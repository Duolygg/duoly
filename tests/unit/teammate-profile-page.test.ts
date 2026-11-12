import { describe, expect, it } from 'vitest';
import {
  profileMetadata,
  profilePresentation,
  profileSchemas,
  profileRoute,
  profileReviewLayout,
} from '../../src/server/teammates/profile-page';
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
    const cheapest = seoOffers('val', 'teammate', {
      customerCurrency: 'EUR',
      eurToUsd: 1,
    }).sort((a, b) => a.amountMinor - b.amountMinor)[0]!;
    expect(view.offer).toEqual(cheapest);
    expect(view.book).toContain('teammate=nyx');
    expect(
      profileMetadata({
        ...nyx,
        games: nyx.games.map((g) => ({ ...g, verified: false })),
      }).title,
    ).toBe('Nyx, Valorant teammate | Duoly');
  });
  it('keeps rating markup out of all schemas and hides Rookie counters', () => {
    const schema = profileSchemas(nyx, new URL('https://duoly.gg'));
    expect(JSON.stringify(schema)).not.toMatch(
      /AggregateRating|"Review"|ratingValue/,
    );
    expect(schema[0]!.mainEntity).toMatchObject({
      name: 'Nyx',
      image: 'https://duoly.gg/assets/avatars/avatar-3.png',
      interactionStatistic: { userInteractionCount: 312 },
    });
    const sola = fixtureLookup('sola');
    if (sola.status !== 'ok') throw new Error('Sola missing');
    expect(profileMetadata(sola.profile).indexing).toBe('noindex, follow');
    expect(profilePresentation(sola.profile)).toMatchObject({
      rating: null,
      winRate: null,
      showSessions: false,
    });
    expect(
      profileSchemas(sola.profile, new URL('https://duoly.gg'))[0]!.mainEntity,
    ).not.toHaveProperty('interactionStatistic');
  });
  it.each([
    [false, 'nyx', 404],
    [true, 'nyx', 200],
    [true, 'nyxie', 301],
    [true, 'ghost', 410],
    [true, 'missing', 404],
  ] as const)('routes flag %s and slug %s to %s', (enabled, slug, status) => {
    expect(profileRoute(enabled, fixtureLookup(slug)).status).toBe(status);
  });
  it('quotes only reviews with text and never leaves a hole in the grid', () => {
    const base = { rating: 5, game: 'val', month: '2026-10' } as const;
    const quiet = profileReviewLayout(nyx.reviews);
    expect(quiet.lead?.text).toBe(nyx.reviews[0]!.text);
    expect(quiet.rest).toHaveLength(2);
    expect([quiet.lead, ...quiet.rest].every((r) => r && r.text)).toBe(true);
    for (const count of [0, 1, 2, 3, 4, 5, 6, 9]) {
      const { lead, rest } = profileReviewLayout(
        Array.from({ length: count }, (_, i) => ({
          ...base,
          text: `Review ${i + 1}`,
        })),
      );
      expect(rest.length % 2).toBe(0);
      expect((lead ? 1 : 0) + rest.length).toBe(Math.min(count, 6));
    }
    expect(profileReviewLayout([{ ...base, text: '' }])).toEqual({
      lead: null,
      rest: [],
    });
  });
  it('builds anonymous, dash-free profile copy and offline booking without preference', () => {
    expect(
      JSON.stringify([
        nyx.bio,
        nyx.reviews.map((r) => r.text),
        profileMetadata(nyx),
      ]),
    ).not.toMatch(/[–—&]/);
    const view = profilePresentation({ ...nyx, online: false });
    expect(view.book).not.toContain('teammate=');
    expect(view.primary).toBe('Book a Valorant teammate');
  });
});
