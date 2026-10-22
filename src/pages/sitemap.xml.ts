import type { APIRoute } from 'astro';
import { PUBLIC_ROUTES } from '../site/nav';
import { SITE_GAMES } from '../site/games';

/** Ready for launch; robots.txt still disallows crawling until then. */
export const GET: APIRoute = ({ url }) => {
  const origin = url.origin;
  const paths = [
    ...PUBLIC_ROUTES,
    ...SITE_GAMES.map((game) => `/games/${game.slug}`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
