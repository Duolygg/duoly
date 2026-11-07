import type { APIRoute } from 'astro';
import { renderLlms } from '../server/seo/llms';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(renderLlms(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
