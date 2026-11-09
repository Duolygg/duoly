import type { APIRoute } from 'astro';
import { renderPricingMarkdown } from '../server/seo/pricing-md';

/**
 * Rendered per request rather than prerendered, which is the one place this
 * route differs from /llms.txt.
 *
 * A prerendered endpoint becomes a static file, and a static file's
 * Content-Type comes from the host's extension table: `.md` is served as
 * text/markdown, which a browser downloads instead of showing. The body is the
 * same either way, so the choice is only about what a human sees after
 * clicking the link on /fees-and-refunds, and a download is the wrong answer
 * there. Serving it from the function lets the header below decide.
 *
 * The content is still build-time data: `renderPricingMarkdown` reads the
 * catalog and the pricing engine that are bundled with this function, so no
 * number is fetched or cached anywhere, and the hour of caching below keeps the
 * cost of generating it per request at nothing.
 */
export const prerender = false;

export const GET: APIRoute = () =>
  new Response(renderPricingMarkdown(), {
    headers: {
      // text/plain, not text/markdown: browsers render the first and download
      // the second, and this page is meant to be read.
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
