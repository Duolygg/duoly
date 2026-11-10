import type { APIRoute } from 'astro';
import { renderReportCsv } from '../../server/seo/price-report';

/**
 * The price survey as a CSV download, generated from the same rows the report
 * page renders.
 *
 * Rendered per request for the reason /pricing.md is: a prerendered `.csv`
 * becomes a static file whose Content-Type the host's extension table decides,
 * and this route wants to send `text/csv` with a filename of its own so a
 * click saves "duoly-gaming-prices-2026.csv" rather than a URL slug. The body
 * is still build-time data, because `renderReportCsv` reads the survey data
 * file and the pricing engine bundled with this function. Nothing is fetched.
 */
export const prerender = false;

export const GET: APIRoute = () =>
  new Response(renderReportCsv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="duoly-gaming-prices-2026.csv"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
