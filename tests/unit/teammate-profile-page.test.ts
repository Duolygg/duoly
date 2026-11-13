import { describe, expect, it } from 'vitest';
import {
  accentStyle,
  bookingLine,
  profileAnswers,
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
  type PublicTeammateProfile,
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
    /* The plain booking link the site already has. Naming the teammate is the favorite the
       page saves, never a query parameter the booking page does not read. */
    expect(view.book).toBe('/?game=val#modes-h');
    expect(view.booking('val', true)).toBe('/?game=val&tab=training#modes-h');
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
      /* A bio too long to fit the search result contributes its first sentence,
         so the description ends on a full stop instead of trailing off. */
      expect(profileMetadata(rhea).description).toBe(
        'Meet Rhea, a League of Legends teammate on Duoly. Speaks German and English. Jungle and support main.',
      );
      /* No languages and no bio, so neither sentence is there at all, and the
         page ends on what it still answers rather than stopping at 48. */
      expect(profileMetadata(pip).description).toBe(
        'Meet Pip, a Teamfight Tactics teammate on Duoly. See the games Pip plays and what a session costs before you book.',
      );
      expect(profileMetadata(pip).description).not.toContain('Speaks');
      expect(profileMetadata(pip).title).toBe(
        'Pip, Teamfight Tactics teammate | Duoly',
      );
      for (const p of [rhea, pip, crafty])
        expect(JSON.stringify(profileMetadata(p))).not.toMatch(/[–—&]/);
    });
    it('keeps every profile description inside what a search result prints', () => {
      /* 214 to 253 characters on five profiles and 48 on another is what the
         page quality audit found; both ends lose the reader. */
      for (const slug of [
        'nyx',
        'rhea',
        'pip',
        'crafty',
        'sola',
        'kairo',
        'lumi',
        'echo',
      ]) {
        const found = fixtureLookup(slug);
        expect(found.status).toBe('ok');
        if (found.status !== 'ok') continue;
        const { description } = profileMetadata(found.profile);
        expect(
          description.length,
          `${slug}: ${description.length} characters`,
        ).toBeGreaterThanOrEqual(70);
        expect(
          description.length,
          `${slug}: ${description.length} characters`,
        ).toBeLessThanOrEqual(160);
      }
    });
    it('writes "an" before a rank that starts with a vowel', () => {
      const found = fixtureLookup('nyx');
      expect(found.status).toBe('ok');
      if (found.status !== 'ok') return;
      /* "Meet Nyx, a Immortal 3 ..." is what the fixed article template used to
         produce on every Immortal, Ascendant and Emerald profile. */
      expect(profileMetadata(found.profile).description).toContain(
        'an Immortal 3',
      );
      expect(profileMetadata(found.profile).description).not.toContain(
        'a Immortal',
      );
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
    /* Online or not, the booking link is the same one the rest of the site uses. */
    expect(view.book).toBe(profilePresentation(nyx).book);
  });
  it('closes the booking block with one line, in readable secondary ink', () => {
    expect(bookingLine(nyx)).toBe(
      'Nyx sees your order with no queue delay. Busy? Another verified teammate takes it.',
    );
    /* An offline teammate can promise neither half of that, so the line sends them on. */
    expect(bookingLine({ ...nyx, online: false })).toBe(
      'Nyx is offline right now. A verified Valorant teammate can take your order today.',
    );
    for (const line of [
      bookingLine(nyx),
      bookingLine({ ...nyx, online: false }),
    ]) {
      /* One line: a sentence pair, no dashes and no ampersand. */
      expect(line.length).toBeLessThanOrEqual(90);
      expect(line).not.toMatch(/[–—]| & /);
    }
    /* The same secondary ink as the rest of the body copy, on the page background: this is
       the colour .tp-note prints in (--tp-muted on #090414), and it clears AA at 4.5:1. */
    expect(contrast('#c9bcdf', '#090414')).toBeGreaterThanOrEqual(4.5);
  });
  /*
   * The answers under the profile. The audit scored every profile 2 or 3 because the page was a
   * name, a plate and about forty words of prose; these three questions are the copy that fixes
   * that, and all of it has to stay facts this profile actually holds.
   */
  describe('the booking answers', () => {
    const load = (slug: string) => {
      const found = fixtureLookup(slug);
      if (found.status !== 'ok') throw new Error(`${slug} fixture missing`);
      return found.profile;
    };
    const text = (p: PublicTeammateProfile) =>
      profileAnswers(p)
        .flatMap((answer) => [answer.heading, ...answer.paragraphs])
        .join(' ');
    it('asks three questions and answers each one in the first sentence', () => {
      const answers = profileAnswers(nyx);
      expect(answers).toHaveLength(3);
      for (const answer of answers) {
        expect(answer.heading.endsWith('?')).toBe(true);
        expect(answer.paragraphs.length).toBeGreaterThan(0);
        for (const paragraph of answer.paragraphs)
          expect(paragraph.split(/\s+/).length).toBeGreaterThan(20);
      }
      expect(answers[0]!.heading).toBe(
        'What is a Valorant session with Nyx like?',
      );
      expect(answers[2]!.heading).toBe(
        'What happens if Nyx is already in a game?',
      );
    });
    it('gives a search visitor enough to read on the thinnest profile there is', () => {
      /* Pip has no bio, no languages, no verified rank and no sessions: the page the audit
         scored 2. The answers are shorter for it and still answer all three questions. */
      const words = text(load('pip')).split(/\s+/).length;
      expect(words).toBeGreaterThan(150);
      expect(text(nyx).split(/\s+/).length).toBeGreaterThan(220);
    });
    it('prints no second price and describes the one the page shows', () => {
      /* A profile states each price once, beside the button it belongs to
         (tests/profiles/public-profiles.spec.ts). So the answers point at that figure and
         say what moves it, and carry no amount of their own. */
      for (const slug of ['nyx', 'crafty', 'kairo', 'pip']) {
        const p = load(slug);
        const answers = text(p);
        expect(answers, slug).not.toMatch(/[€$£]\s?\d|EUR \d|USD \d/);
        const view = profilePresentation(p);
        const cheapest = seoOffers(p.featuredGame, 'teammate', {
          customerCurrency: 'EUR',
          eurToUsd: 1,
        }).sort((a, b) => a.amountMinor - b.amountMinor)[0]!;
        expect(view.offer).toEqual(cheapest);
        expect(answers, slug).toContain(
          `The figure beside the booking button is where a ${view.game.name} session with ${p.name} starts`,
        );
        /* The unit the price is quoted in comes from the same offer, so an hourly game
           never says "games" and a per-game one never says "hours". */
        expect(answers, slug).toContain(
          `the number of ${cheapest.unit === 'hour' ? 'hours' : `${cheapest.unit}s`}`,
        );
      }
      /* Coaching is named only where the catalog sells it and the teammate takes it. */
      expect(text(nyx)).toContain('at the price beside the coaching button');
      expect(text(load('lumi'))).not.toContain('coaching');
    });
    it('states only what the profile holds, and says so when it holds nothing', () => {
      const pip = text(load('pip'));
      expect(pip).toContain('verified no rank for Pip yet');
      expect(pip).toContain('no finished sessions here yet');
      expect(pip).toContain('lists no language');
      expect(pip).not.toMatch(/\bundefined\b|\bnull\b/);
      const kairo = text(load('kairo'));
      expect(kairo).toContain(
        '2 verified ranks: Challenger in League of Legends and Immortal 2 in Valorant',
      );
      expect(kairo).toContain('1,240 sessions');
      /* Sola has two finished sessions, which is under the sample the page shows a stat for.
         The answer says the number and why no rating sits above it, because "no sessions yet"
         would be false for a profile that has played twice. */
      expect(text(load('sola'))).toContain(
        'has 2 finished sessions here, which is too few for a rating',
      );
    });
    it('never puts the same sentence on three profiles', () => {
      /* The audit counts a sentence that appears on three or more pages as boilerplate, and
         eight profiles sharing one answer template is exactly that. Every sentence carries
         the name or the game it belongs to, which is what keeps the count under three. */
      const carriers = new Map<string, string[]>();
      for (const slug of [
        'nyx',
        'rhea',
        'pip',
        'crafty',
        'sola',
        'kairo',
        'lumi',
        'echo',
      ]) {
        const p = load(slug);
        for (const sentence of profileAnswers(p)
          .flatMap((answer) => answer.paragraphs)
          .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/)))
          carriers.set(sentence, [...(carriers.get(sentence) ?? []), slug]);
      }
      const shared = [...carriers.entries()].filter(
        ([, slugs]) => slugs.length >= 3,
      );
      expect(
        shared.map(([sentence, slugs]) => `${slugs.join(',')}: ${sentence}`),
      ).toEqual([]);
    });
    it('obeys the copy rules and never repeats a paragraph across two profiles', () => {
      const seen = new Map<string, string>();
      for (const slug of [
        'nyx',
        'rhea',
        'pip',
        'crafty',
        'sola',
        'kairo',
        'lumi',
        'echo',
      ]) {
        const p = load(slug);
        expect(text(p), slug).not.toMatch(/[–—]| & |\bnot .*, but /);
        /* Eight profiles printing the same paragraph is the boilerplate the audit counted
           across pages, so every answer carries the name and the game it belongs to. */
        for (const paragraph of profileAnswers(p).flatMap(
          (a) => a.paragraphs,
        )) {
          expect(
            seen.get(paragraph) ?? slug,
            `${slug} repeats ${seen.get(paragraph)}`,
          ).toBe(slug);
          seen.set(paragraph, slug);
        }
      }
    });
  });
});
