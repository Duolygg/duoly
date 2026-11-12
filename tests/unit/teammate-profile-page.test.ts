import { describe, expect, it } from 'vitest';
import {
  accentStyle,
  profileMetadata,
  rankEmblem,
  profilePresentation,
  profileSchemas,
  profileRoute,
  profileReviewLayout,
  profileGame,
  profileList,
  pickLabel,
} from '../../src/server/teammates/profile-page';
import { fixtureLookup } from '../../src/server/teammates/profile-fixtures';
import { seoOffers } from '../../src/server/seo/offers';
import {
  PROFILE_ACCENTS,
  PROFILE_ACCENT_GLOW,
  PROFILE_ACCENT_KEYS,
} from '../../src/contracts/teammate-profile';

/** WCAG relative luminance, used for the ink the pages print on an accent. */
const luminance = (hex: string) =>
  [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + [0.2126, 0.7152, 0.0722][i]! * v, 0);
const contrast = (a: string, b: string) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);
const distance = (a: string, b: string) =>
  Math.hypot(
    ...[1, 3, 5].map(
      (i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16),
    ),
  );

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
  it('offers the coaching entry price from the helper, and only when coaching is on', () => {
    const view = profilePresentation(nyx);
    const coaching = seoOffers('val', 'training', {
      customerCurrency: 'EUR',
      eurToUsd: 1,
    }).sort((a, b) => a.amountMinor - b.amountMinor)[0]!;
    expect(view.coachOffer).toEqual(coaching);
    expect(view.coachOffer!.display).not.toBe(view.offer!.display);
    expect(profilePresentation({ ...nyx, coaching: false }).coachOffer).toBe(
      null,
    );
  });
  it('ships every accent with its own light and dark enough ink on top', () => {
    expect(Object.keys(PROFILE_ACCENT_GLOW).sort()).toEqual(
      [...PROFILE_ACCENT_KEYS].sort(),
    );
    for (const key of PROFILE_ACCENT_KEYS) {
      const hex = PROFILE_ACCENTS[key];
      /* #10071D is the button label, #130922 the verified tick. */
      expect(contrast(hex, '#10071D')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex, '#130922')).toBeGreaterThanOrEqual(4.5);
      expect(accentStyle(key)).toBe(
        `--accent:${hex};--glow:${PROFILE_ACCENT_GLOW[key]}`,
      );
    }
    /* Neighbouring choices have to be tellable apart in the picker. */
    expect(
      distance(PROFILE_ACCENTS.violet, PROFILE_ACCENTS.lavender),
    ).toBeGreaterThan(60);
    expect(distance(PROFILE_ACCENTS.ice, PROFILE_ACCENTS.cyan)).toBeGreaterThan(
      40,
    );
    expect(
      distance(PROFILE_ACCENTS.coral, PROFILE_ACCENTS.pink),
    ).toBeGreaterThan(60);
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
  it('gives every game the same rank mark, so no crest repeats a game logo', () => {
    const val = rankEmblem('val');
    const lol = rankEmblem('lol');
    /* The crest silhouette is per game, the mark inside it is not: a Valorant specific
       mark was a second copy of the V in the header icon. */
    expect(val.shape).not.toBe(lol.shape);
    expect(val.mark).toBe(lol.mark);
    expect(rankEmblem('unknown').shape).toBe(val.shape);
  });
  /*
   * Production today: ten teammates, no reviews, no completed sessions, no verified ranks. These
   * three fixtures are that state, so the page is tested in the shape every real profile has
   * rather than only in the shape the design was drawn in.
   */
  describe('a teammate with no track record yet', () => {
    const load = (slug: string) => {
      const found = fixtureLookup(slug);
      if (found.status !== 'ok') throw new Error(`${slug} fixture missing`);
      return found.profile;
    };
    const rhea = load('rhea');
    const pip = load('pip');
    const crafty = load('crafty');
    it('hides every stat and the trust plaque instead of printing zeroes', () => {
      for (const p of [rhea, pip, crafty]) {
        expect(profilePresentation(p)).toMatchObject({
          rating: null,
          winRate: null,
          showSessions: false,
          showStats: false,
          showTier: false,
        });
        expect(
          profileSchemas(p, new URL('https://duoly.gg'))[0]!.mainEntity,
        ).not.toHaveProperty('interactionStatistic');
      }
      /* A track record puts both back. */
      expect(profilePresentation(nyx)).toMatchObject({
        showStats: true,
        showTier: true,
      });
    });
    it('indexes a written bio and keeps a page with nothing on it out', () => {
      expect(profileMetadata(rhea).indexing).toBe('index, follow');
      expect(profileMetadata(crafty).indexing).toBe('index, follow');
      /* No bio, no rank, no sessions: nothing to index. */
      expect(profileMetadata(pip).indexing).toBe('noindex, follow');
    });
    it('writes a description out of the facts that exist and nothing else', () => {
      expect(profileMetadata(rhea).description).toBe(
        'Meet Rhea, a League of Legends teammate on Duoly. Speaks German and English. ' +
          rhea.bio,
      );
      /* No languages and no bio, so neither sentence is there at all. */
      expect(profileMetadata(pip).description).toBe(
        'Meet Pip, a Teamfight Tactics teammate on Duoly.',
      );
      expect(profileMetadata(pip).description).not.toContain('Speaks');
      expect(profileMetadata(pip).title).toBe(
        'Pip, Teamfight Tactics teammate | Duoly',
      );
      for (const p of [rhea, pip, crafty])
        expect(JSON.stringify(profileMetadata(p))).not.toMatch(/[–—&]/);
    });
    it('keeps the empty Person fields out of the structured data', () => {
      const person = profileSchemas(pip, new URL('https://duoly.gg'))[0]!
        .mainEntity as Record<string, unknown>;
      expect(person).not.toHaveProperty('description');
      expect(person).not.toHaveProperty('knowsLanguage');
      expect(person.knowsAbout).toEqual(['Teamfight Tactics']);
    });
    it('prices Minecraft and Teamfight Tactics from the same helper as Valorant', () => {
      for (const p of [pip, crafty]) {
        const view = profilePresentation(p);
        const cheapest = seoOffers(p.featuredGame, 'teammate', {
          customerCurrency: 'EUR',
          eurToUsd: 1,
        }).sort((a, b) => a.amountMinor - b.amountMinor)[0]!;
        expect(view.offer).toEqual(cheapest);
        expect(profileSchemas(p, new URL('https://duoly.gg'))).toHaveLength(3);
      }
    });
    it('drops the Service schema when the catalog sells nothing for the game', () => {
      /* Social is the one catalog entry with no teammate sessions, and a profile can never
         feature it, but the page still has to answer rather than throw. */
      const schemas = profileSchemas(
        { ...pip, featuredGame: 'social', games: [] },
        new URL('https://duoly.gg'),
      );
      expect(schemas).toHaveLength(2);
      expect(JSON.stringify(schemas)).not.toContain('"Service"');
    });
    it('names picks the way players name them in each game', () => {
      expect(pickLabel('lol')).toBe('Champions');
      expect(pickLabel('val')).toBe('Agents');
      expect(pickLabel('apex')).toBe('Legends');
      expect(pickLabel('r6')).toBe('Operators');
      /* Games without an established word get the one a player would use anyway. */
      expect(pickLabel('mc')).toBe('Mains');
      expect(pickLabel('cs2')).toBe('Mains');
    });
    it('falls back to the raw id when the catalog does not know a game', () => {
      expect(profileGame('lol').name).toBe('League of Legends');
      expect(profileGame('not-a-game')).toMatchObject({
        id: 'not-a-game',
        name: 'not-a-game',
      });
    });
    it('joins lists with and, never with an ampersand', () => {
      expect(profileList([])).toBe('');
      expect(profileList(['German'])).toBe('German');
      expect(profileList(['German', 'English'])).toBe('German and English');
      expect(profileList(['German', 'English', 'Dutch'])).toBe(
        'German, English and Dutch',
      );
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
