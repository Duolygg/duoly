import { intentPages, intentPath } from '../content/intent-pages';
import { FINISHED_HUB_SLUGS } from '../content/hub-pages';
import { CONTENT_UPDATED } from './content-dates';
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
  'counter-strike-2',
  'overwatch-2',
  'rainbow-six-siege',
  // Added 2026-11-09 from the keyword gap analysis. Every slug here needs its
  // own entry in src/content/coaching.ts and src/content/coaching-formats.ts,
  // which tests/unit/coaching-formats.test.ts checks.
  'call-of-duty',
  'dota-2',
  'minecraft',
  'world-of-warcraft',
  'deadlock',
] as const;
export const GUIDE_PATH = '/blog/what-is-an-egirl';
export const LFG_GUIDE_PATH = '/blog/what-does-lfg-mean';
/** The two all-games directories: coaching and teammates, across every game. */
export const COACHING_INDEX_PATH = '/coaching';
export const BUDDIES_PATH = '/find-gaming-buddies';
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
  LFG_GUIDE_PATH,
  '/compare/e-pal',
  COACHING_INDEX_PATH,
  BUDDIES_PATH,
  ...intentPages.map(intentPath),
  ...COACHING_SLUGS.map((slug) => `/games/${slug}/coaching`),
];
/**
 * Content revision dates, shared by sitemap.xml and editorial metadata.
 *
 * Every value is the day that page's own copy last changed, declared in
 * src/site/content-dates.ts and checked against git by tests/unit/seo.test.ts.
 * Never the build time: a build timestamp would re-announce every unchanged
 * page on every deploy, which is the fastest way to make Google ignore
 * `lastmod` altogether.
 */
export const CONTENT_DATES: Record<string, string> = CONTENT_UPDATED;
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
