import type { APIRoute } from 'astro';
import { HOME_LIVE_CACHE_CONTROL, homeLive } from '../../../server/home/live';

export const prerender = false;

/** Public, identical for everyone: CDN-cached so polling homepages cost almost no database reads. */
export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await homeLive()), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': HOME_LIVE_CACHE_CONTROL,
    },
  });
