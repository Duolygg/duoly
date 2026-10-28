import type { APIRoute } from 'astro';
import { fxInfo } from '../../server/fx';

export const prerender = false;

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await fxInfo()), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
