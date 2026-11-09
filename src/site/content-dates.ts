import { intentPages, intentPath } from '../content/intent-pages';
import { FINISHED_HUB_SLUGS } from '../content/hub-pages';
import { coachRank } from '../content/coaching-rank';

/**
 * Where every indexable page's copy actually lives, and the day that copy last
 * changed.
 *
 * `<lastmod>` in sitemap.xml is read by Google, so it has to mean "the day this
 * page's content last changed" and never "the day the site was built". A build
 * timestamp would re-announce 40 unchanged pages on every deploy and teach
 * Search Console to ignore the signal.
 *
 * The runtime value is the declared date in `CONTENT_UPDATED` below, because
 * the sitemap renders on a serverless request where no git history exists.
 * `CONTENT_SOURCES` is what keeps that declaration honest: tests/unit/seo.test.ts
 * asks git for the last commit that touched each page's own copy files and
 * fails when a declared date has drifted from it. So the flow when you change
 * page copy is: edit the copy, set that page's date here to the day you commit.
 *
 * Sources are a page's own copy, not the shared layout or component it renders
 * through. A spacing fix in GameHub.astro is not a content change on 15 hubs,
 * and treating it as one would put the churn back that `lastmod` exists to
 * avoid.
 */
export const CONTENT_SOURCES: Record<string, string[]> = {
  '/': ['src/pages/index.astro'],
  '/games': ['src/pages/games/index.astro'],
  '/ai': ['src/pages/ai.astro', 'src/site/ai.ts'],
  '/developers/mcp': ['src/pages/developers/mcp.astro'],
  '/blog': ['src/pages/blog/index.astro'],
  '/contact': ['src/pages/contact.astro'],
  '/terms': ['src/pages/terms.astro'],
  '/privacy': ['src/pages/privacy.astro'],
  '/get-paid-to-play-games': ['src/pages/get-paid-to-play-games.astro'],
  '/blog/what-is-an-egirl': ['src/pages/blog/[slug].astro'],
  '/compare/e-pal': [
    'src/pages/compare/e-pal.astro',
    'src/content/epal-comparison.ts',
  ],
  '/games/social': ['src/content/hubs.ts'],
};
for (const slug of FINISHED_HUB_SLUGS)
  if (slug !== 'social')
    CONTENT_SOURCES[`/games/${slug}`] = [
      `src/content/game-hubs/${slug}.ts`,
      'src/content/hub-pages.ts',
    ];
for (const page of intentPages)
  CONTENT_SOURCES[intentPath(page)] = [
    'src/content/intent-pages.ts',
    'src/content/guide-pages.ts',
  ];
// Keyed off coachRank rather than a second hand-written slug list: that list
// drifted once already when a coaching page was added, and the sitemap then
// quietly stopped declaring sources for it.
for (const slug of Object.keys(coachRank))
  CONTENT_SOURCES[`/games/${slug}/coaching`] = [
    'src/content/coaching.ts',
    'src/content/coaching-examples.ts',
    'src/content/coaching-rank.ts',
  ];

/**
 * The day each page's copy last changed, as `YYYY-MM-DD`.
 *
 * Declared rather than computed, because sitemap.xml renders per request. Keep
 * it equal to the git date of the files in `CONTENT_SOURCES`: the seo unit test
 * compares the two and names the path and the date to write when they differ.
 *
 * A squash merge rewrites the committer date of every file in the pull request
 * to the day it lands on main, so a page's date here is the day its copy
 * reached main and not the day it was written. Changing page copy therefore
 * means setting its date to the day the change merges.
 */
export const CONTENT_UPDATED: Record<string, string> = {
  '/': '2026-11-05',
  '/blog': '2026-11-05',
  '/contact': '2026-11-05',
  '/terms': '2026-11-05',
  '/privacy': '2026-11-05',
  '/get-paid-to-play-games': '2026-11-06',
  '/games': '2026-11-08',
  '/blog/what-is-an-egirl': '2026-11-08',
  '/compare/e-pal': '2026-11-08',
};
// Everything else is copy the rank-rule work rewrote: every hub, every
// teammate page, the coaching pages, /ai, /developers/mcp and the social hub.
for (const path of Object.keys(CONTENT_SOURCES))
  CONTENT_UPDATED[path] ??= '2026-11-09';
