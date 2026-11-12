import {
  MIN_GAMES_FOR_WINRATE,
  MIN_REVIEWS_FOR_RATING,
  PROFILE_ACCENTS,
  PROFILE_ACCENT_GLOW,
  PROFILE_REVIEWS_MAX,
  profileIndexable,
  type ProfileAccent,
  type PublicProfileReview,
  type PublicTeammateProfile,
} from '../../contracts/teammate-profile';
import { SITE_GAMES, type SiteGame } from '../../site/games';
import { bookingHref, organizationSchema } from '../../site/seo';
import { seoOffers } from '../seo/offers';
import type { ProfileLookup } from './public-profiles';
/**
 * The catalog entry for a game id. A profile only ever features a game an admin approved, so a
 * miss means the catalog and the database disagree; the page then prints the raw id rather than
 * throwing a 500 at a visitor.
 */
export const profileGame = (id: string): SiteGame =>
  SITE_GAMES.find((g) => g.id === id) ?? {
    id,
    name: id,
    img: '/assets/games/social.png',
    slug: id,
  };
/**
 * What a teammate's picks are called in each game. Roles and picks are typed by the teammate, so
 * the label has to be right for twenty games, not just the two the design started with. Anything
 * without an established word for it gets "Mains", which is what a player would say.
 */
const PICK_LABELS: Record<string, string> = {
  lol: 'Champions',
  wr: 'Champions',
  dota: 'Heroes',
  val: 'Agents',
  mr: 'Heroes',
  ow: 'Heroes',
  apex: 'Legends',
  r6: 'Operators',
  dl: 'Heroes',
  pu: 'Pokémon',
  rl: 'Cars',
  fc: 'Clubs',
};
export const pickLabel = (id: string) => PICK_LABELS[id] ?? 'Mains';
/**
 * The rank emblem: one solid geometric crest per game, filled with the game colour, never
 * an official rank badge and never a second copy of the game logo. The hero lockup prints
 * the bare crest, the game card adds the chevron mark.
 */
export const rankEmblem = (id: string) => ({
  shape:
    id === 'lol'
      ? 'M32 2 59 14l-5 33L32 70 10 47 5 14Z'
      : 'M32 2 60 19v30L32 70 4 49V19Z',
  mark: 'm18 43 14-17 14 17',
});
/** Accent and the light strength that goes with it, as inline custom properties. */
export const accentStyle = (accent: ProfileAccent) =>
  `--accent:${PROFILE_ACCENTS[accent]};--glow:${PROFILE_ACCENT_GLOW[accent]}`;
export const profileMonth = (month: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
export function profilePresentation(p: PublicTeammateProfile) {
  const game = profileGame(p.featuredGame);
  const context = { customerCurrency: 'EUR' as const, eurToUsd: 1 };
  const cheapest = (category: 'teammate' | 'training') =>
    seoOffers(game.id, category, context).sort(
      (a, b) => a.amountMinor - b.amountMinor,
    )[0] ?? null;
  /** Null when the catalog sells nothing for this game: the page then shows no price at all. */
  const offer = cheapest('teammate');
  /** The coaching entry price, only when the catalog actually sells coaching here. */
  const coachOffer = p.coaching ? cheapest('training') : null;
  const booking = (id: string, coaching = false) => {
    const base = bookingHref(id, coaching ? { tab: 'training' } : {});
    const url = new URL(base, 'https://duoly.gg');
    if (p.online) url.searchParams.set('teammate', p.slug);
    return `${url.pathname}${url.search}${url.hash}`;
  };
  const rating =
    p.rating && p.rating.count >= MIN_REVIEWS_FOR_RATING ? p.rating : null;
  const winRate =
    p.winRate && p.winRate.games >= MIN_GAMES_FOR_WINRATE ? p.winRate : null;
  const showSessions = p.tier !== 'rookie' && p.sessions >= 5;
  return {
    game,
    offer,
    coachOffer,
    booking,
    book: booking(game.id),
    primary: p.online ? `Book with ${p.name}` : `Book a ${game.name} teammate`,
    rating,
    winRate,
    showSessions,
    /** No stat has reached its sample minimum, so the row would be empty: show the new state. */
    showStats: Boolean(rating || winRate || showSessions),
    /** The trust plaque is a track record. A teammate without one does not wear it. */
    showTier: p.tier !== 'rookie',
  };
}
/**
 * Only reviews with text become quote cards; the rest still count in the tag bars.
 * An odd number would leave a hole in the two column grid, so the first quote is
 * promoted to a full width lead and the grid always fills every cell.
 */
export function profileReviewLayout(reviews: PublicProfileReview[]) {
  const written = reviews
    .filter((r) => r.text.trim().length > 0)
    .slice(0, PROFILE_REVIEWS_MAX);
  const lead = written.length % 2 === 1 ? (written[0] ?? null) : null;
  return { lead, rest: lead ? written.slice(1) : written };
}
/** "German", "German and English", "German, English and Dutch". Never an ampersand. */
export function profileList(items: string[]) {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
/**
 * Title and description are built only from facts that are on the page. A teammate without a
 * verified rank, without languages or without a bio simply gets a shorter description instead of
 * an empty "Speaks ." or a sentence that trails off.
 */
export function profileMetadata(p: PublicTeammateProfile) {
  const game = profileGame(p.featuredGame);
  const rank = p.games.find((g) => g.game === game.id && g.verified)?.rank;
  const { showSessions } = profilePresentation(p);
  const sentences = [
    `Meet ${p.name}, a ${rank ? `${rank} ` : ''}${game.name} teammate on Duoly.`,
  ];
  if (p.languages.length) sentences.push(`Speaks ${profileList(p.languages)}.`);
  if (showSessions)
    sentences.push(`${p.sessions} sessions completed on Duoly.`);
  if (p.bio.trim()) sentences.push(p.bio.trim());
  return {
    title: `${p.name}, ${game.name}${rank ? ` ${rank}` : ''} teammate | Duoly`,
    description: sentences.join(' '),
    indexing: profileIndexable(p)
      ? ('index, follow' as const)
      : ('noindex, follow' as const),
  };
}
export function profileRoute(enabled: boolean, result: ProfileLookup) {
  if (!enabled || result.status === 'missing') return { status: 404 as const };
  if (result.status === 'moved')
    return {
      status: 301 as const,
      location: `/teammates/${encodeURIComponent(result.slug)}`,
    };
  return { status: result.status === 'gone' ? (410 as const) : (200 as const) };
}
export function profileSchemas(p: PublicTeammateProfile, site: URL) {
  const view = profilePresentation(p);
  const url = new URL(`/teammates/${p.slug}`, site).href;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url,
      dateModified: p.updatedAt,
      mainEntity: {
        '@type': 'Person',
        name: p.name,
        image: new URL(p.avatar, site).href,
        ...(p.bio.trim() ? { description: p.bio.trim() } : {}),
        ...(p.languages.length ? { knowsLanguage: p.languages } : {}),
        knowsAbout: p.games.map((g) => profileGame(g.game).name),
        ...(view.showSessions
          ? {
              interactionStatistic: {
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/InteractAction',
                userInteractionCount: p.sessions,
              },
            }
          : {}),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        ['Duoly', '/'],
        ['Teammates', '/teammates'],
        [p.name, `/teammates/${p.slug}`],
      ].map(([name, path], i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name,
        item: new URL(path!, site).href,
      })),
    },
    /* The offered service, only while the catalog actually sells it for this game. */
    ...(view.offer
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: `${view.game.name} teammate sessions`,
            provider: organizationSchema(site),
            url,
            offers: {
              '@type': 'Offer',
              price: view.offer.price,
              priceCurrency: view.offer.currency,
              url: new URL(view.book, site).href,
            },
          },
        ]
      : []),
  ];
}
