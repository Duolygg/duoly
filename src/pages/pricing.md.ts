import type { APIRoute } from 'astro';
import { renderPricingMarkdown } from '../server/seo/pricing-md';

export const prerender = true;

/**
 * Served as text/plain rather than text/markdown so a browser shows it instead
 * of downloading it, which is also what /llms.txt does. The .md in the URL is
 * the signal to a reader and to an assistant that the body is markdown.
 */
export const GET: APIRoute = () =>
  new Response(renderPricingMarkdown(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
