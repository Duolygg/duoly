import { intentPages, intentPath } from '../content/intent-pages';

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
export const INDEXABLE_PATHS = [
  '/',
  '/games',
  '/blog',
  '/contact',
  '/terms',
  '/privacy',
  '/games/valorant',
  '/games/social',
  '/get-paid-to-play-games',
  GUIDE_PATH,
  ...intentPages.map(intentPath),
  ...COACHING_SLUGS.map((slug) => `/games/${slug}/coaching`),
];
// Content revision dates, shared by sitemap and editorial metadata. Never request time.
export const CONTENT_DATES: Record<string, string> = Object.fromEntries(
  INDEXABLE_PATHS.map((path) => [path, '2026-11-05']),
);
Object.assign(CONTENT_DATES, {
  '/games/league-of-legends/play-with-someone': '2026-11-06',
  '/games/marvel-rivals/duo-partner': '2026-11-06',
  '/games/pokemon-unite/teammate': '2026-11-06',
});
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
export function homeSchema(site: URL) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': new URL('/#organization', site).href,
        name: 'Duoly',
        url: site.href,
        logo: new URL('/icon-512.png', site).href,
        email: 'hello@duoly.gg',
      },
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
