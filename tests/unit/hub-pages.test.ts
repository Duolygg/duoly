import { describe, expect, it } from 'vitest';
import {
  FINISHED_HUB_SLUGS,
  HUB_PAGES,
  hubPageFor,
} from '../../src/content/hub-pages';
import { renderTokens } from '../../src/content/guide-pages';
import { socialContent, valorantContent } from '../../src/content/hubs';
import { lessons } from '../../src/content/coaching';
import {
  hubModes,
  hubOffers,
  hubPriceHeadings,
  hubPrices,
  hubServiceIds,
} from '../../src/server/seo/hub';
import {
  faqSchema,
  formatPrice,
  offerSelection,
  priceSummary,
} from '../../src/server/seo/offers';
import { calculateQuote } from '../../src/server/pricing';
import type { QuoteContext } from '../../src/contracts/pricing';
import { ranksOf } from '../../src/design-reference/lib/ranks.js';
import { servicesFor } from '../../src/design-reference/lib/catalog.js';
import { BUNDLE_UNITS, QUANTITIES } from '../../src/contracts/pricing';
import { SITE_GAMES, gameBySlug } from '../../src/site/games';
import { HUB_PATHS, INDEXABLE_PATHS, hubChips } from '../../src/site/seo';
import { renderLlms } from '../../src/server/seo/llms';

const EUR: QuoteContext = { customerCurrency: 'EUR', eurToUsd: 1 };
const USD: QuoteContext = { customerCurrency: 'USD', eurToUsd: 1.12 };
const words = (text: string) => text.trim().split(/\s+/).length;

/** Every string in a hub entry, with price tokens already filled. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === 'object')
    Object.values(value).forEach((item) => strings(item, out));
  return out;
}

const rendered = (slug: string, context: QuoteContext = EUR) => {
  const game = gameBySlug(slug)!;
  const offers = hubOffers(game.id, context);
  const summary = priceSummary(offers.all);
  return {
    game,
    offers,
    summary,
    copy: renderTokens(hubPageFor(slug)!, {
      ...hubPrices(game.id, { eurToUsd: 1 }),
      from: summary,
      from_lower: summary.toLowerCase(),
    }),
  };
};

/** Every price the checkout engine can quote for a game, as displayed strings. */
function quotableEur(gameId: string) {
  const prices = new Set<string>();
  for (const serviceId of hubServiceIds(gameId)) {
    const ranks = ranksOf(gameId, serviceId) as string[];
    for (const rank of ranks.length ? ranks : [undefined]) {
      // 1 to 5 units for every service, plus the Bundles tab packs on the main service
      const main = (servicesFor(gameId) as { main: string }).main;
      const picks = [
        ...QUANTITIES.map((units) => ({ units })),
        ...(serviceId === main
          ? BUNDLE_UNITS.map((units) => ({ units, bundle: true, seats: 1 }))
          : []),
      ];
      for (const pick of picks) {
        const quote = calculateQuote(
          {
            gameId,
            serviceId,
            ...offerSelection(gameId, serviceId),
            ...pick,
            ...(rank ? { rank } : {}),
          },
          { customerCurrency: 'EUR', eurToUsd: 1 },
        );
        prices.add(formatPrice(quote.customer.amountMinor, 'EUR'));
      }
    }
  }
  return prices;
}

it('covers every game Duoly sells with finished, indexable hub copy', () => {
  const sellable = SITE_GAMES.filter((game) => game.id !== 'social');
  expect([...FINISHED_HUB_SLUGS].sort()).toEqual(
    ['social', ...sellable.map((game) => game.slug)].sort(),
  );
  // Valorant and Social keep their own copy, so they must stay off the registry.
  expect(hubPageFor('valorant')).toBeUndefined();
  expect(hubPageFor('social')).toBeUndefined();
  for (const path of HUB_PATHS) expect(INDEXABLE_PATHS).toContain(path);
  // Social is not a game, so the public catalog and llms.txt leave it out.
  const llms = renderLlms();
  for (const path of HUB_PATHS.filter((path) => path !== '/games/social'))
    expect(llms, path).toContain(`(https://duoly.gg${path})`);
});

it('keeps an unwritten hub out of the sitemap', () => {
  // A game only becomes indexable through its entry, so the registry is the gate.
  const withoutCopy = HUB_PAGES.filter(
    (page) => page.gameSlug !== 'minecraft',
  ).map((page) => `/games/${page.gameSlug}`);
  expect(withoutCopy).not.toContain('/games/minecraft');
  expect(hubPageFor('not-a-game')).toBeUndefined();
});

describe.each(HUB_PAGES.map((page) => page.gameSlug))('%s hub', (slug) => {
  it('prices every service the catalog actually sells for the game', () => {
    const { game, offers, copy } = rendered(slug);
    const groups = hubModes(game.id);
    expect(offers.teammate.length).toBeGreaterThan(0);
    expect(new Set(offers.teammate.map((offer) => offer.id))).toEqual(
      new Set(groups.teammate.map((mode) => mode.id)),
    );
    expect(new Set(offers.team.map((offer) => offer.id))).toEqual(
      new Set(groups.team.map((mode) => mode.id)),
    );
    expect(new Set(offers.coaching.map((offer) => offer.id))).toEqual(
      new Set(groups.coaching.map((mode) => mode.id)),
    );
    // One short card line per service, so no card is left with catalog copy.
    expect(Object.keys(copy.services).sort()).toEqual(
      hubServiceIds(game.id).sort(),
    );
    for (const [id, line] of Object.entries(copy.services)) {
      expect(words(line), `${id}: ${line}`).toBeGreaterThan(5);
      expect(words(line), `${id}: ${line}`).toBeLessThan(20);
    }
  });

  it.each([EUR, USD])('shows only checkout prices (%o)', (context) => {
    const { offers } = rendered(slug, context);
    for (const offer of offers.all) {
      const quote = calculateQuote(offer.selection, context);
      expect(offer.amountMinor).toBe(quote.customer.amountMinor);
      expect(offer.display).toBe(
        formatPrice(quote.customer.amountMinor, quote.customer.currency),
      );
      expect(offer.seats).toBe(quote.seats);
    }
  });

  it('quotes prices in copy only from the pricing engine', () => {
    const { game, copy } = rendered(slug);
    const quotable = quotableEur(game.id);
    const text = strings(copy).join(' ');
    expect(text).not.toMatch(/\{\{\w+\}\}/);
    const quoted = text.match(/€\d+\.\d\d/g) ?? [];
    expect(quoted.length).toBeGreaterThan(10);
    for (const price of new Set(quoted))
      expect([...quotable], `${slug}: ${price}`).toContain(price);
  });

  it('follows the customer copy rules', () => {
    const { copy } = rendered(slug);
    for (const text of strings(copy)) {
      expect(text, text).not.toMatch(/[–—]/);
      expect(text, text).not.toMatch(/ & /);
      // Rank names are filled in from the catalog, so "a Iron player" is a real
      // risk whenever a rank or service name starts with a vowel. Copy avoids
      // "a" before any vowel rather than guessing which ones sound like "you".
      expect(text, text).not.toMatch(/\b[Aa] [AEIOUaeiou]/);
    }
  });

  it('asks a grammatical question above every price grid', () => {
    const { game } = rendered(slug);
    for (const heading of Object.values(hubPriceHeadings(game.name))) {
      expect(heading, heading).toMatch(/\?$/);
      expect(heading).toContain(game.name);
      // The game name comes from the catalog, so an article in front of it is
      // one rename away from "a Apex Legends teammate".
      expect(heading, heading).not.toMatch(/\b[Aa] [AEIOUaeiou]/);
    }
  });

  it('keeps the title and meta description inside the search limits', () => {
    const page = hubPageFor(slug)!;
    expect(page.title.length, page.title).toBeLessThanOrEqual(60);
    expect(page.title).toMatch(/ \| Duoly$/);
    for (const context of [EUR, USD]) {
      const { copy, summary } = rendered(slug, context);
      expect(
        copy.description.length,
        `${slug} ${context.customerCurrency}: ${copy.description}`,
      ).toBeGreaterThanOrEqual(140);
      expect(copy.description.length).toBeLessThanOrEqual(160);
      // Every billing unit on the page has to appear in the description.
      for (const unit of new Set(
        rendered(slug, context).offers.all.map((offer) => offer.unit),
      ))
        expect(copy.description).toContain(`per ${unit}`);
      expect(copy.description).toContain(summary.toLowerCase());
    }
  });

  it('points every decision card at a service the game sells', () => {
    const { game, copy, offers } = rendered(slug);
    expect(copy.decide.picks.length).toBeGreaterThanOrEqual(4);
    for (const pick of copy.decide.picks) {
      expect(hubServiceIds(game.id), pick.service).toContain(pick.service);
      expect(offers.all.some((offer) => offer.id === pick.service)).toBe(true);
      expect(pick.goal).toMatch(/\?$/);
    }
  });

  it('publishes FAQ JSON-LD equal to the visible questions', () => {
    const { copy } = rendered(slug);
    expect(copy.faq.items.length).toBeGreaterThanOrEqual(5);
    const schema = faqSchema(
      copy.faq.items,
      `/games/${slug}`,
      new URL('https://duoly.gg'),
    );
    expect(schema.mainEntity.map((entry) => entry.name)).toEqual(
      copy.faq.items.map(([question]) => question),
    );
    expect(schema.mainEntity.map((entry) => entry.acceptedAnswer.text)).toEqual(
      copy.faq.items.map(([, answer]) => answer),
    );
  });

  it('links related hubs and the pages that exist for the game', () => {
    const page = hubPageFor(slug)!;
    expect(page.related.length).toBeGreaterThanOrEqual(3);
    expect(page.related).not.toContain(slug);
    for (const related of page.related) {
      expect(FINISHED_HUB_SLUGS, related).toContain(related);
      expect(hubChips([related])).toHaveLength(1);
    }
    if (lessons[slug])
      expect(INDEXABLE_PATHS).toContain(`/games/${slug}/coaching`);
  });
});

it('gives every hub at least three inbound links from sibling hubs', () => {
  const inbound = new Map<string, string[]>();
  for (const page of HUB_PAGES)
    for (const related of page.related)
      inbound.set(related, [...(inbound.get(related) ?? []), page.gameSlug]);
  for (const page of HUB_PAGES)
    expect(
      (inbound.get(page.gameSlug) ?? []).length,
      `${page.gameSlug} inbound hub links`,
    ).toBeGreaterThanOrEqual(3);
});

// The Valorant and Social hubs are already indexed, so this change only adds
// pages. Any edit to their copy has to be a deliberate, reviewed one.
it('leaves the Valorant and Social hub copy untouched', () => {
  expect(valorantContent.title).toBe(
    'Valorant LFG: Find Teammates or Book a Duo | Duoly',
  );
  expect(valorantContent.h1).toBe(
    'Valorant LFG: find teammates for your next session',
  );
  expect(valorantContent.lead).toBe(
    'Looking for Valorant teammates? Free LFG communities are great for an ongoing group. Duoly gets you a strong teammate for the next game, with coaching when you want to learn.',
  );
  expect(valorantContent.sections.map((section) => section.heading)).toEqual([
    'Free Valorant LFG options come first',
    'Write a post that someone can answer',
    'When a paid Duoly session makes sense',
    'Check compatibility before opening the lobby',
  ]);
  expect(valorantContent.faq.map(([question]) => question)).toEqual([
    'Is Duoly a free Valorant teammate finder?',
    'Can I choose an agent role?',
    'Can every rank queue together?',
    'Can I book several games?',
    'What does a per-game price mean?',
    'Where do I book a Valorant coach?',
  ]);
  expect(valorantContent.closing).toEqual({
    heading: 'Ready to queue?',
    text: 'Pick a service and your rank, then meet your teammate in the order chat.',
  });
  expect(socialContent.title).toBe(
    'Play With an E-Girl: Social Sessions and Prices | Duoly',
  );
  expect(socialContent.h1).toBe(
    'Play with an e-girl or book friendly Social time',
  );
});
