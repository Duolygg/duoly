import { intentPages, intentPath } from '../content/intent-pages';
import { FINISHED_HUB_SLUGS } from '../content/hub-pages';
import { gameBySlug } from './games';
import { aiLaunchState } from './ai';
import { DISCORD_INVITE, SUPPORT_EMAIL } from './nav';

export const COACHING_SLUGS = [
  'valorant',
  'league-of-legends',
  'rocket-league',
  'fortnite',
  'teamfight-tactics',
  'apex-legends',
  'marvel-rivals',
] as const;
export const GUIDE_PATH = '/blog/what-is-an-egirl';
/** A game hub is indexable once its copy exists (src/content/hub-pages.ts). */
export const HUB_PATHS = FINISHED_HUB_SLUGS.map((slug) => `/games/${slug}`);
/**
 * Hub chips for the related-link blocks of pages that are not about one game,
 * so every hub keeps contextual inbound links from more than its own siblings.
 */
export const hubChips = (slugs: string[]) =>
  slugs.flatMap((slug) => {
    const game = gameBySlug(slug);
    return game && FINISHED_HUB_SLUGS.includes(slug)
      ? [{ name: game.name, path: `/games/${slug}` }]
      : [];
  });
export const INDEXABLE_PATHS = [
  '/',
  '/games',
  ...aiLaunchState().indexablePaths,
  '/developers/mcp',
  '/blog',
  '/contact',
  '/terms',
  '/privacy',
  ...HUB_PATHS,
  '/get-paid-to-play-games',
  GUIDE_PATH,
  '/compare/e-pal',
  ...intentPages.map(intentPath),
  ...COACHING_SLUGS.map((slug) => `/games/${slug}/coaching`),
];
// Content revision dates, shared by sitemap and editorial metadata. Never request time.
export const CONTENT_DATES: Record<string, string> = Object.fromEntries(
  [...INDEXABLE_PATHS, '/ai'].map((path) => [
    path,
    ['/ai', '/developers/mcp'].includes(path) ? '2026-11-06' : '2026-11-05',
  ]),
);
Object.assign(CONTENT_DATES, {
  '/games/league-of-legends/play-with-someone': '2026-11-06',
  '/games/marvel-rivals/duo-partner': '2026-11-06',
  '/games/pokemon-unite/teammate': '2026-11-06',
  '/compare/e-pal': '2026-11-07',
  '/games/valorant/lfg': '2026-11-08',
  '/games/fortnite/duos': '2026-11-08',
  '/games/overwatch-2/lfg': '2026-11-08',
  '/games/apex-legends/lfg': '2026-11-08',
  '/games/call-of-duty/lfg': '2026-11-08',
  '/games/rainbow-six-siege/lfg': '2026-11-08',
});
// The data-driven game hubs were written together; Valorant and Social keep their own date.
Object.assign(
  CONTENT_DATES,
  Object.fromEntries(
    HUB_PATHS.filter(
      (path) => !['/games/valorant', '/games/social'].includes(path),
    ).map((path) => [path, '2026-11-08']),
  ),
);
/** "Book a Valorant teammate" but "Book an Apex Legends teammate". */
export const bookTeammateLabel = (gameName: string) =>
  `Book ${/^[aeiou]/i.test(gameName) ? 'an' : 'a'} ${gameName} teammate`;
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
export function breadcrumbs(
  items: { name: string; path: string }[],
  site: URL,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: new URL(item.path, site).href,
    })),
  };
}
/**
 * ADD OUR SOCIAL PROFILES HERE. One entry per account Duoly really owns; the URL
 * flows into schema.org `sameAs` on every page that renders the Organization, with
 * no other edit anywhere. Empty strings are dropped, so an account that does not
 * exist yet stays listed as a reminder without ever reaching the markup.
 *
 * Rules: only profiles Duoly controls, pasted from the live profile (never a guessed
 * handle). Never a Wikipedia or Wikidata URL: those are third-party pages about us,
 * and claiming one we do not have is a false signal.
 */
export const OFFICIAL_PROFILES: Record<string, string> = {
  discord: DISCORD_INVITE,
  // Not created yet (owner, 2026-11-08). Paste the profile URL when the account is live.
  x: '',
  linkedin: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  twitch: '',
};
/** The `sameAs` array: every profile from OFFICIAL_PROFILES that has a URL. */
export const SAME_AS: string[] = Object.values(OFFICIAL_PROFILES).filter(
  (url) => url.length > 0,
);
/** One sentence about the company, for the Organization `description`. */
export const ORGANIZATION_DESCRIPTION =
  'Duoly books rank-verified gaming teammates and coaches by the hour for Valorant, League of Legends, Marvel Rivals and more.';
/**
 * The one Organization node. Every page that names Duoly as an author, a publisher or
 * a provider should use this so the logo, description and sameAs never drift apart.
 */
export function organizationSchema(site: URL) {
  return {
    '@type': 'Organization',
    '@id': new URL('/#organization', site).href,
    name: 'Duoly',
    url: site.href,
    logo: new URL('/icon-512.png', site).href,
    email: SUPPORT_EMAIL,
    description: ORGANIZATION_DESCRIPTION,
    sameAs: SAME_AS,
  };
}
export function homeSchema(site: URL) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationSchema(site),
      {
        '@type': 'WebSite',
        '@id': new URL('/#website', site).href,
        name: 'Duoly',
        url: site.href,
        publisher: { '@id': new URL('/#organization', site).href },
      },
    ],
  };
}
// Homepage booking deep link: the game preselected, plus a tab or one service, scrolled to the service picker.
export const bookingHref = (
  gameId: string,
  pick: { tab?: string; service?: string } = {},
) => {
  const query = new URLSearchParams({ game: gameId });
  if (pick.service) query.set('service', pick.service);
  else if (pick.tab) query.set('tab', pick.tab);
  return `/?${query}#modes-h`;
};
