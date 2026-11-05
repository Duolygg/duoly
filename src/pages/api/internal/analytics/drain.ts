import type { APIRoute } from 'astro';
import {
  drainAuthorized,
  drainConfig,
  drainOnce,
} from '../../../../server/analytics/drain';
import { supportService } from '../../../../server/support/store';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });

/** pg_cron calls this every minute (Authorization: Bearer ANALYTICS_DRAIN_SECRET). */
export const POST: APIRoute = async ({ request }) => {
  if (!drainAuthorized(request.headers.get('authorization')))
    return json({ error: 'Unauthorized.' }, 401);
  const config = drainConfig();
  if (!config) return json({ skipped: 'analytics disabled' });
  const db = supportService();
  if (!db) return json({ error: 'Database unavailable.' }, 503);
  try {
    return json(await drainOnce(db, config));
  } catch {
    console.warn('Analytics drain failed.');
    return json({ error: 'Drain failed.' }, 503);
  }
};

export const ALL: APIRoute = () => json({ error: 'Method not allowed.' }, 405);
