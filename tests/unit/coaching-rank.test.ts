import { describe, expect, it } from 'vitest';
import { lessons } from '../../src/content/coaching';
import {
  coachRank,
  BOT_PROTECTED_SOURCES,
} from '../../src/content/coaching-rank';
import {
  FORBIDDEN_CLAIMS,
  RANK_RULES,
  UNKNOWN_RULE,
  rankPairingFaults,
  rankRuleFor,
} from '../../src/content/rank-rules';
import { withPrices } from '../../src/server/seo/coaching-examples';
import { seoOffers } from '../../src/server/seo/offers';
import { COACHING_SLUGS } from '../../src/site/seo';
import { gameBySlug } from '../../src/site/games';

const currencies = ['EUR', 'USD'] as const;
const context = (customerCurrency: (typeof currencies)[number]) => ({
  customerCurrency,
  eurToUsd: 1.17,
});

/**
 * Everything a coaching page renders, as the labelled blocks the rank-pairing
 * scanner reads. Prices are filled in first, because a filled price can change
 * where a sentence ends.
 */
function pageBlocks(
  slug: string,
  customerCurrency: (typeof currencies)[number],
) {
  const lesson = lessons[slug]!;
  const rank = coachRank[slug]!;
  const offers = seoOffers(
    gameBySlug(slug)!.id,
    'training',
    context(customerCurrency),
  );
  return [
    lesson.h1,
    lesson.lead,
    lesson.format,
    lesson.prices,
    lesson.booking,
    lesson.prepare,
    ...lesson.steps,
    ...lesson.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
    ]),
    ...lesson.faq.flat(),
    rank.heading,
    rank.answer,
    rank.rule,
    rank.choice,
    ...rank.rungs.flatMap((rung) => [rung.label, rung.value, rung.note]),
  ].map((text) => ({
    where: `coaching /games/${slug}/coaching (${customerCurrency})`,
    text: withPrices(text, offers),
  }));
}

/** The same copy as one string, for the must-say and banned-claim checks. */
const pageText = (
  slug: string,
  customerCurrency: (typeof currencies)[number],
) =>
  pageBlocks(slug, customerCurrency)
    .map((block) => block.text)
    .join(' ');

describe('every coaching page has a rank rule', () => {
  it('covers each indexed coaching slug with copy and a published rule', () => {
    expect(Object.keys(coachRank).sort()).toEqual([...COACHING_SLUGS].sort());
    for (const slug of COACHING_SLUGS) {
      expect(lessons[slug], `${slug} lesson copy`).toBeTruthy();
      expect(rankRuleFor(slug), `${slug} rank rule`).toBeTruthy();
    }
  });

  it('links every source and flags only the three that answer 403', () => {
    const slugs = RANK_RULES.map((rule) => rule.gameSlug);
    for (const slug of BOT_PROTECTED_SOURCES) {
      expect(slugs, `${slug} needs a rule to cite`).toContain(slug);
      expect(COACHING_SLUGS, `${slug} needs a coaching page`).toContain(slug);
    }
    // FACEIT, fortnite.com and the Epic help centre sit behind bot protection.
    // Every other publisher answered 200, so its link carries no caveat.
    expect([...BOT_PROTECTED_SOURCES].sort()).toEqual([
      'counter-strike-2',
      'fortnite',
      'rocket-league',
    ]);
    for (const slug of COACHING_SLUGS) {
      const url = rankRuleFor(slug)!.source.url;
      // Every citation is an absolute https URL with a path, and at the host
      // the publisher actually serves: epicgames.com without the www
      // redirects, which is how the Rocket League link was cited before.
      expect(url, `${slug} source`).toMatch(/^https:\/\/[\w.-]+\.\w+\/\S/);
      expect(url, `${slug} source host`).not.toMatch(
        /^https:\/\/epicgames\.com/,
      );
    }
  });

  it('shows three rungs per game, widening left to right', () => {
    for (const [slug, copy] of Object.entries(coachRank)) {
      expect(copy.rungs, `${slug} rungs`).toHaveLength(3);
      expect(
        copy.heading.endsWith('?'),
        `${slug} heading asks a question`,
      ).toBe(true);
      for (const rung of copy.rungs)
        expect([0, 1, 2, 3], `${slug} ${rung.label} gap`).toContain(rung.gap);
      expect(
        copy.rungs.some((rung) => rung.wide),
        `${slug} names at least one widest route`,
      ).toBe(true);
    }
  });
});

describe('coaching copy obeys the publisher queue rules', () => {
  for (const slug of COACHING_SLUGS)
    for (const customerCurrency of currencies)
      it(`${slug} ${customerCurrency}: says the published rule and none of the banned claims`, () => {
        const text = pageText(slug, customerCurrency);
        const rule = rankRuleFor(slug)!;
        expect(text, `${slug} must say "${rule.mustSay}"`).toContain(
          rule.mustSay,
        );
        for (const claim of FORBIDDEN_CLAIMS)
          expect(text, `${slug} vs ${claim}`).not.toMatch(claim);
      });

  // The shared scanner from #189, pointed at coaching copy. rank-rules.test.ts
  // runs it over hub, intent and guide pages; coaching copy is scanned here
  // because this is the file that owns it.
  it('never pairs a customer rank with a coach rank the queue refuses', () => {
    const faults = COACHING_SLUGS.flatMap((slug) =>
      currencies.flatMap((customerCurrency) =>
        rankPairingFaults(
          pageBlocks(slug, customerCurrency),
          rankRuleFor(slug),
        ),
      ),
    );
    expect(
      faults.map(
        (fault) =>
          `${fault.where}: "${fault.sentence}" (${fault.allowed}; name an open mode or the game's own wider route)`,
      ),
    ).toEqual([]);
  });

  it('still catches the claim the rank block was written to remove', () => {
    // Without this the scan above would pass just as happily on no input.
    const caught = rankPairingFaults(
      [
        {
          where: 'coaching fixture',
          text: 'A Gold player books one Competitive match beside an Immortal coach.',
        },
      ],
      rankRuleFor('valorant'),
    );
    expect(caught.map((fault) => [fault.lower, fault.higher])).toEqual([
      ['Gold', 'Immortal'],
    ]);
  });

  it('never promises a top-tier coach inside a gap-limited ranked queue', () => {
    // The exact claims this change removed, one per game the queue restricts.
    const removed = [
      'one Competitive match beside an Immortal+ coach',
      'one ranked game beside a Master+ coach',
      'one Competitive game beside a Grandmaster+ coach',
      'puts a Master+ coach in your ranked game',
      'Meet your Immortal+ coach',
      'Meet your Master coach',
      'Meet your Grandmaster+ coach in the order chat and start on Discord.',
    ];
    const all = COACHING_SLUGS.map((slug) => pageText(slug, 'EUR')).join(' ');
    for (const phrase of removed)
      // Overwatch 2 keeps its Grandmaster+ step: a wide group may cross the
      // whole ladder, so that one claim is true and is asserted below.
      if (!phrase.startsWith('Meet your Grandmaster+'))
        expect(all, phrase).not.toContain(phrase);
    expect(pageText('overwatch-2', 'EUR')).toContain(
      'Meet your Grandmaster+ coach in the order chat',
    );
    expect(pageText('valorant', 'EUR')).not.toContain('Meet your Immortal+');
  });

  it('words an unpublished rule the same way everywhere', () => {
    for (const slug of ['fortnite', 'marvel-rivals', 'counter-strike-2'])
      expect(coachRank[slug]!.answer, slug).toContain(UNKNOWN_RULE);
  });

  it('keeps rank copy free of long dashes and ampersands', () => {
    const text = JSON.stringify(coachRank);
    expect(text).not.toMatch(/[–—]| & /);
  });
});

describe('rank copy prices come from the pricing helpers', () => {
  for (const slug of COACHING_SLUGS)
    for (const customerCurrency of currencies)
      it(`${slug} ${customerCurrency}: every placeholder resolves and no price is hand-typed`, () => {
        const offers = seoOffers(
          gameBySlug(slug)!.id,
          'training',
          context(customerCurrency),
        );
        const copy = coachRank[slug]!;
        const filled = [copy.answer, copy.rule, copy.choice]
          .map((text) => withPrices(text, offers))
          .join(' ');
        expect(filled).not.toMatch(/\{price:|\{amount:/);
        const allowed = new Set(
          offers.map((offer) => `${offer.amountMinor / 100}`),
        );
        for (const [, amount] of filled.matchAll(
          /(?:EUR|USD|[€$])\s?(\d+(?:\.\d+)?)/g,
        ))
          expect(allowed, `${slug} ${amount}`).toContain(amount);
        // The rank block always names the live-lesson price at least once.
        expect(copy.choice).toMatch(/\{price:(learn|econ)\}/);
      });
});
