import {
  MIN_GAMES_FOR_WINRATE,
  MIN_REVIEWS_FOR_RATING,
  PROFILE_REVIEWS_MAX,
  profileIndexable,
  type PublicProfileReview,
  type PublicTeammateProfile,
} from '../../contracts/teammate-profile';
import { SITE_GAMES } from '../../site/games';
import { bookingHref, organizationSchema } from '../../site/seo';
import { seoOffers } from '../seo/offers';
import type { ProfileLookup } from './public-profiles';
export const profileGame = (id: string) => SITE_GAMES.find((g) => g.id === id)!;
export const profileMonth = (month: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
export function profilePresentation(p: PublicTeammateProfile) {
  const game = profileGame(p.featuredGame);
  const offer = seoOffers(game.id, 'teammate', {
    customerCurrency: 'EUR',
    eurToUsd: 1,
  }).sort((a, b) => a.amountMinor - b.amountMinor)[0]!;
  const booking = (id: string, coaching = false) => {
    const base = bookingHref(id, coaching ? { tab: 'training' } : {});
    const url = new URL(base, 'https://duoly.gg');
    if (p.online) url.searchParams.set('teammate', p.slug);
    return `${url.pathname}${url.search}${url.hash}`;
  };
  return {
    game,
    offer,
    booking,
    book: booking(game.id),
    primary: p.online ? `Book with ${p.name}` : `Book a ${game.name} teammate`,
    rating:
      p.rating && p.rating.count >= MIN_REVIEWS_FOR_RATING ? p.rating : null,
    winRate:
      p.winRate && p.winRate.games >= MIN_GAMES_FOR_WINRATE ? p.winRate : null,
    showSessions: p.tier !== 'rookie' && p.sessions >= 5,
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
export function profileMetadata(p: PublicTeammateProfile) {
  const game = profileGame(p.featuredGame);
  const rank = p.games.find((g) => g.game === game.id && g.verified)?.rank;
  const { showSessions } = profilePresentation(p);
  return {
    title: `${p.name}, ${game.name}${rank ? ` ${rank}` : ''} teammate | Duoly`,
    description: `Meet ${p.name}, ${rank ? `${rank} in ` : ''}${game.name} teammate. Speaks ${p.languages.join(' and ')}.${showSessions ? ` ${p.sessions} sessions completed on Duoly.` : ''} ${p.bio}`,
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
        description: p.bio,
        knowsLanguage: p.languages,
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
  ];
}
