import { describe, expect, it } from 'vitest';
import { lessons } from '../../src/content/coaching';
import { coachRank, LINKABLE_SOURCES } from '../../src/content/coaching-rank';
import {
  FORBIDDEN_CLAIMS,
  RANK_RULES,
  UNKNOWN_RULE,
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

/** Everything a coaching page actually renders as sentences, in one string. */
function pageText(slug: string, customerCurrency: (typeof currencies)[number]) {
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
  ]
    .map((text) => withPrices(text, offers))
    .join(' ');
}

describe('every coaching page has a rank rule', () => {
  it('covers each indexed coaching slug with copy and a published rule', () => {
    expect(Object.keys(coachRank).sort()).toEqual([...COACHING_SLUGS].sort());
    for (const slug of COACHING_SLUGS) {
      expect(lessons[slug], `${slug} lesson copy`).toBeTruthy();
      expect(rankRuleFor(slug), `${slug} rank rule`).toBeTruthy();
    }
  });

  it('only links a source page an automated check actually reached', () => {
    const slugs = RANK_RULES.map((rule) => rule.gameSlug);
    for (const slug of LINKABLE_SOURCES) expect(slugs).toContain(slug);
    // The three Cloudflare-protected publishers stay unlinked on purpose.
    for (const slug of ['counter-strike-2', 'fortnite', 'rocket-league'])
      expect(LINKABLE_SOURCES).not.toContain(slug);
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
        for (const banned of rule.mustNotSay)
          expect(text, `${slug} must not say "${banned}"`).not.toContain(
            banned,
          );
        for (const claim of FORBIDDEN_CLAIMS)
          expect(text, `${slug} vs ${claim}`).not.toMatch(claim);
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
