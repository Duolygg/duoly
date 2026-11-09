import type { APIRoute } from 'astro';
import { INDEXABLE_PATHS, CONTENT_DATES } from '../site/seo';
export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('Astro.site is required');
  // lastmod is the day the page's copy changed, never the day of this request
  // or of the build. A path with no declared date is a bug rather than a reason
  // to invent "today", so the URL ships without lastmod instead.
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${INDEXABLE_PATHS.map((path) => {
  const updated = CONTENT_DATES[path];
  return `  <url><loc>${new URL(path, site).href}</loc>${updated ? `<lastmod>${updated}</lastmod>` : ''}</url>`;
}).join('\n')}
</urlset>
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
