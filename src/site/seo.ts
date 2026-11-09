import { intentPages, intentPath } from '../content/intent-pages';
import { FINISHED_HUB_SLUGS } from '../content/hub-pages';
import { ABOUT_STORY } from '../content/about-story';
import { CONTENT_UPDATED } from './content-dates';
import { gameBySlug } from './games';
import { aiLaunchState } from './ai';
import { DISCORD_INVITE, SUPPORT_EMAIL } from './nav';
import { PRESS_EMAIL } from './press-contact';
import { BUSINESS, DISAMBIGUATION, KNOWS_ABOUT, SERVED_AREAS } from './entity';

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
/**
 * The answer-first guides added for the November 2026 GEO pass, in the order
 * /blog lists them. Each one has its own page file under src/pages/blog.
 */
export const GUIDE_PATHS = [
  '/blog/how-to-find-a-valorant-duo',
  '/blog/how-to-choose-a-gaming-coach',
  '/blog/free-lfg-or-paid-teammate',
] as const;
/** Platform comparisons, each sourced from the rival's own dated pages. */
export const COMPARE_PATHS = [
  '/compare/e-pal',
  '/compare/metafy',
  '/compare/queueup',
] as const;
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
  '/about',
  '/how-it-works',
  '/trust-and-safety',
  '/pricing',
  '/press',
  '/fees-and-refunds',
  '/contact',
  '/terms',
  '/privacy',
  ...HUB_PATHS,
  '/get-paid-to-play-games',
  GUIDE_PATH,
  LFG_GUIDE_PATH,
  ...GUIDE_PATHS,
  ...COMPARE_PATHS,
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
 * and claiming one we do not have is a false signal. When a real Wikidata item for
 * Duoly ever exists, add the key here and relax the assertion in
 * tests/unit/seo.test.ts in the same commit, so the policy change is explicit.
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
 *
 * The identity fields (legalName, address, contactPoint, foundingLocation,
 * identifier, disambiguatingDescription) answer the questions AI assistants were
 * getting wrong on 9 November 2026: who operates duoly.gg, where, how to reach
 * them, and which of the several products called Duoly this one is. Every value
 * comes from src/site/entity.ts, which copies the legal notice on /imprint.
 */
export function organizationSchema(site: URL) {
  return {
    '@type': 'Organization',
    '@id': new URL('/#organization', site).href,
    name: 'Duoly',
    legalName: BUSINESS.legalName,
    url: site.href,
    logo: new URL('/icon-512.png', site).href,
    email: SUPPORT_EMAIL,
    description: ORGANIZATION_DESCRIPTION,
    disambiguatingDescription: DISAMBIGUATION,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.street,
      postalCode: BUSINESS.postalCode,
      addressLocality: BUSINESS.city,
      addressCountry: BUSINESS.country,
    },
    // Two points rather than one, because an assistant asked "how do I reach
    // Duoly for a press question" should not be handed the support inbox and
    // left to guess. Both addresses land with the same team (every address at
    // duoly.gg forwards there), so the split is a label, not a promise of a
    // press office: /press says that in words.
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: SUPPORT_EMAIL,
        url: new URL('/contact', site).href,
        availableLanguage: ['en', 'de'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'press',
        email: PRESS_EMAIL,
        url: new URL('/press', site).href,
        availableLanguage: ['en', 'de'],
      },
    ],
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: BUSINESS.city,
        addressCountry: BUSINESS.country,
      },
    },
    // Only once the owner supplies the real date (src/content/about-story.ts).
    // A guessed foundingDate is the kind of wrong fact this entity work exists
    // to remove, so the property is absent rather than approximate.
    ...(ABOUT_STORY.foundedOn ? { foundingDate: ABOUT_STORY.foundedOn } : {}),
    /** The Austrian trade licence number, the one public registry entry Duoly has. */
    identifier: {
      '@type': 'PropertyValue',
      name: 'GISA',
      value: BUSINESS.gisa,
    },
    areaServed: SERVED_AREAS,
    knowsAbout: KNOWS_ABOUT,
    sameAs: SAME_AS,
  };
}
/**
 * The /about page node: an AboutPage whose `mainEntity` is the one Organization,
 * so an assistant reading the page lands on the same entity the homepage
 * publishes rather than inferring a second company of the same name.
 */
export function aboutPageSchema(
  path: string,
  name: string,
  description: string,
  dateModified: string,
  site: URL,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': new URL('/#about-page', site).href,
    url: new URL(path, site).href,
    name,
    description,
    dateModified,
    isPartOf: { '@id': new URL('/#website', site).href },
    mainEntity: organizationSchema(site),
    publisher: { '@id': new URL('/#organization', site).href },
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
