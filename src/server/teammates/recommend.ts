/*
 * "Our pick": which of Duoly's own products fits a session with this teammate best, and why.
 *
 * Every step is a rule over data the profile already shows: the verified rank decides which duo
 * tiers this teammate can play at all, and the review tags, vibe tags and win rate each add
 * weight to the product they speak for. Nothing is guessed and nothing is generated: the reasons
 * returned are the exact facts that moved the score, so the page can show its working.
 */
import type { PublicTeammateProfile } from '../../contracts/teammate-profile';
import { bookingHref } from '../../site/seo';
import { seoOffers } from '../seo/offers';
import { profileGame } from './profile-page';

type Offer = ReturnType<typeof seoOffers>[number];
export type PickKind = 'duo' | 'coach' | 'casual' | 'gg';

export interface PickReason {
  /** The fact, short enough for a chip: "Verified Immortal 3", "Taught me a lot × 40". */
  fact: string;
  /** What that fact means for the pick, one clause. */
  because: string;
}

export interface Pick {
  kind: PickKind;
  id: string;
  title: string;
  tier: string;
  desc: string;
  /** Entry price for this product, as the catalog quotes it. */
  price: string;
  unit: string;
  href: string;
  score: number;
  reasons: PickReason[];
}

export interface Recommendation {
  pick: Pick;
  alternatives: Pick[];
  /** Facts that were read, matched or not: shown as "Weighed n signals". */
  signals: number;
}

const context = { customerCurrency: 'EUR' as const, eurToUsd: 1 };

/** The rank a tier asks for, from its label: "Immortal+ teammate" -> "Immortal". */
const requirement = (offer: Offer) =>
  offer.tier.match(/^([A-Za-z][A-Za-z ]*?)\+?\s+(?:teammate|coach)\b/)?.[1] ??
  null;

/** Index of a rank on the game's ladder ("Immortal 3" sits at "Immortal"), or -1. */
const ladderIndex = (ladder: string[], rank: string | null) => {
  if (!rank) return -1;
  let best = -1;
  ladder.forEach((step, i) => {
    if (rank.toLowerCase().startsWith(step.toLowerCase())) best = i;
  });
  return best;
};

/** One entry per product id, priced at its cheapest rank. */
const byProduct = (offers: Offer[]) => {
  const products = new Map<string, Offer>();
  for (const offer of offers) {
    const seen = products.get(offer.id);
    if (!seen || offer.amountMinor < seen.amountMinor)
      products.set(offer.id, offer);
  }
  return [...products.values()];
};

export function recommendFor(p: PublicTeammateProfile): Recommendation | null {
  const gameId = profileGame(p.featuredGame).id;
  const featured = p.games.find((g) => g.game === p.featuredGame);
  const verifiedRank = featured?.verified ? featured.rank : null;
  const duoOffers = seoOffers(gameId, 'teammate', context);
  /* Gamer Girl services are a separate line with their own providers. */
  const own = duoOffers.filter((o) => !/gamer girl/i.test(o.tier));
  const ladder = [...new Set(own.map((o) => o.rank).filter(Boolean))];
  const teammateAt = ladderIndex(ladder, verifiedRank);

  /* Ranked duo tiers this teammate qualifies for, highest requirement first. */
  const duoTiers = byProduct(own.filter((o) => o.cat === 'duo' && o.rank))
    .map((o) => ({ offer: o, needs: ladderIndex(ladder, requirement(o)) }))
    .filter((t) => t.needs >= 0 && teammateAt >= t.needs)
    .sort((a, b) => b.needs - a.needs);
  const duo = duoTiers[0]?.offer ?? null;
  const casual =
    byProduct(own.filter((o) => !o.rank)).find((o) =>
      /unrated/i.test(o.title),
    ) ??
    byProduct(own.filter((o) => !o.rank && !/warm/i.test(o.title)))[0] ??
    null;
  const coach = p.coaching
    ? (byProduct(seoOffers(gameId, 'training', context)).find((o) =>
        /play and learn/i.test(o.title),
      ) ??
      byProduct(seoOffers(gameId, 'training', context))[0] ??
      null)
    : null;

  /* A verified Gamer Girl also sells the Gamer Girl services of her featured game (for Social,
     the only thing it sells): the one that fits her play style best, else the cheapest. */
  const ggProducts = p.gamerGirl
    ? byProduct(seoOffers(gameId, 'gg', context)).sort(
        (a, b) => a.amountMinor - b.amountMinor,
      )
    : [];
  const ggByVibe: [string, RegExp][] = [
    ['Night owl', /sleep call/i],
    ['Funny', /karaoke/i],
    ['Chill', /just chat|watch together/i],
    ['Tryhard', /ranked/i],
    ['Mechanics first', /ranked/i],
  ];
  const ggPreferred = ggByVibe
    .filter(([vibe]) => (p.vibeTags as string[]).includes(vibe))
    .map(([, title]) => ggProducts.find((o) => title.test(o.title)))
    .find(Boolean);
  const gg = ggPreferred ?? ggProducts[0] ?? null;

  const tags = new Map(p.reviewTags.map((t) => [t.tag, t.count]));
  const top = Math.max(1, ...p.reviewTags.map((t) => t.count));
  const vibes = new Set<string>(p.vibeTags);
  const scored = new Map<PickKind, { score: number; reasons: PickReason[] }>();
  const add = (kind: PickKind, score: number, reason: PickReason) => {
    const entry = scored.get(kind) ?? { score: 0, reasons: [] };
    entry.score += score;
    entry.reasons.push(reason);
    scored.set(kind, entry);
  };
  let signals = 0;
  /** A review tag counts in full when it is at least half as common as the top one. */
  const tag = (
    name: string,
    kind: PickKind,
    weight: number,
    because: string,
  ) => {
    const count = tags.get(name);
    signals += 1;
    if (!count) return;
    add(kind, count / top >= 0.5 ? weight : weight / 2, {
      fact: `"${name}" × ${count}`,
      because,
    });
  };
  const vibe = (
    name: string,
    kind: PickKind,
    weight: number,
    because: string,
  ) => {
    signals += 1;
    if (vibes.has(name)) add(kind, weight, { fact: name, because });
  };

  if (duo) {
    signals += 1;
    add('duo', 3, {
      fact: `Verified ${verifiedRank}`,
      because: `qualifies ${p.name} for ${duo.title}, the ${duo.tier} tier`,
    });
    tag('Carried hard', 'duo', 2, 'customers win games with them');
    tag(
      'Shotcaller',
      'duo',
      1.5,
      `${duo.title} is built around calling the round`,
    );
    tag('Great comms', 'duo', 1, 'clear comms is what a ranked duo runs on');
    vibe('Shotcaller', 'duo', 1.5, 'they call the plays, you execute');
    vibe('Tryhard', 'duo', 1, 'they play every round to win');
    vibe(
      'Mechanics first',
      'duo',
      1,
      'aim that holds up at the top of the ladder',
    );
    signals += 1;
    if (p.winRate && p.winRate.games >= 20 && p.winRate.percent >= 55)
      add('duo', 1, {
        fact: `${p.winRate.percent}% win rate`,
        because: `over ${p.winRate.games} reported matches`,
      });
  }
  if (coach) {
    signals += 1;
    add('coach', 1, {
      fact: 'Coaches on Duoly',
      because: `${coach.title} is open with ${p.name}`,
    });
    tag('Taught me a lot', 'coach', 2.5, 'customers come away playing better');
    tag('Patient', 'coach', 1, 'room to ask anything mid-game');
    vibe(
      'Teaches as we play',
      'coach',
      2,
      'explaining while playing is their style',
    );
    vibe('Strategy nerd', 'coach', 1, 'they love breaking down decisions');
    vibe('Patient', 'coach', 1, 'no pressure while you learn');
  }
  if (casual) {
    tag('Chill vibes', 'casual', 1, 'customers keep it relaxed with them');
    tag('Super friendly', 'casual', 1, 'easy company for a relaxed session');
    tag('Fun to play with', 'casual', 1, 'the session is the fun part');
    vibe('Chill', 'casual', 1.5, 'no rank pressure, just good games');
    vibe('Funny', 'casual', 1, 'laughs between rounds');
  }

  if (gg) {
    signals += 1;
    add('gg', 2, {
      fact: 'Verified Gamer Girl',
      because: `${gg.title} is open with ${p.name}`,
    });
    vibe('Chill', 'gg', 1, 'easy, relaxed company');
    vibe('Funny', 'gg', 1, 'the session is the fun part');
    vibe('Night owl', 'gg', 1, 'around for late sessions');
    tag('Fun to play with', 'gg', 1, 'customers enjoy the time together');
    tag('Super friendly', 'gg', 1, 'friendly from the first minute');
  }

  const build = (kind: PickKind, offer: Offer | null): Pick | null => {
    if (!offer) return null;
    const entry = scored.get(kind) ?? { score: 0, reasons: [] };
    return {
      kind,
      id: offer.id,
      title: offer.title,
      tier: offer.tier,
      desc: offer.desc,
      price: offer.display,
      unit: offer.unit,
      href: bookingHref(gameId, { service: offer.id }),
      score: entry.score,
      reasons: entry.reasons,
    };
  };
  const ranked = [
    build('duo', duo),
    build('coach', coach),
    build('casual', casual),
    build('gg', gg),
  ]
    .filter((x): x is Pick => Boolean(x))
    .sort((a, b) => b.score - a.score);
  const pick = ranked[0];
  if (!pick || pick.score === 0) return null;
  if (p.online)
    pick.reasons.push({
      fact: 'Online now',
      because: 'your session can start in minutes',
    });
  return { pick, alternatives: ranked.slice(1, 3), signals };
}
