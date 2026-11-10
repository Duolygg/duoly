import type { APIRoute } from 'astro';
import { renderLlmsFull } from '../server/seo/llms-full';

/**
 * Prerendered, like /llms.txt: a `.txt` file is served as text/plain by every
 * host's extension table, so the static version needs no header of its own and
 * costs nothing to serve.
 */
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(renderLlmsFull(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
