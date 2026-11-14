import type { APIRoute } from 'astro';
import { INDEXABLE_PATHS, CONTENT_DATES } from '../site/seo';
import {
  loadIndexableProfiles,
  loadTeammateCards,
  publicProfilesEnabled,
} from '../server/teammates/public-profiles';
import { SITE_GAMES } from '../site/games';
export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('Astro.site is required');
  // lastmod is the day the page's copy changed, never the day of this request
  // or of the build. A path with no declared date is a bug rather than a reason
  // to invent "today", so the URL ships without lastmod instead.
  const profiles = publicProfilesEnabled() ? await loadIndexableProfiles() : [];
  const profileUrls = profiles.map(
    ({ slug, updatedAt }) =>
      `  <url><loc>${new URL(`/teammates/${encodeURIComponent(slug)}`, site).href}</loc><lastmod>${new Date(updatedAt).toISOString()}</lastmod></url>`,
  );
  if (profiles.length >= 3)
    profileUrls.unshift(
      `  <url><loc>${new URL('/teammates', site).href}</loc></url>`,
    );
  /* A game's directory (/games/<game>/teammates) is listed under the same rule the page uses
     for its own robots tag: at least three of its teammates have profiles that qualify. */
  if (profiles.length >= 3) {
    const updated = new Map(profiles.map((p) => [p.slug, p.updatedAt]));
    const cards = await loadTeammateCards({ limit: 100 });
    for (const game of SITE_GAMES) {
      const dates = cards
        .filter((c) => (c.games ?? [c.game]).includes(game.id))
        .map((c) => updated.get(c.slug))
        .filter((d): d is string => Boolean(d))
        .sort();
      if (dates.length >= 3)
        profileUrls.push(
          `  <url><loc>${new URL(`/games/${game.slug}/teammates`, site).href}</loc><lastmod>${new Date(dates.at(-1)!).toISOString()}</lastmod></url>`,
        );
    }
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${INDEXABLE_PATHS.map((path) => {
  const updated = CONTENT_DATES[path];
  return `  <url><loc>${new URL(path, site).href}</loc>${updated ? `<lastmod>${updated}</lastmod>` : ''}</url>`;
}).join('\n')}${profileUrls.length ? `\n${profileUrls.join('\n')}` : ''}
</urlset>
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
