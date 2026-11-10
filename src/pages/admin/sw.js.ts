import type { APIRoute } from 'astro';
import { adminOnly, adminServiceWorker } from '../../server/support/admin-app';

export const prerender = false;

export const GET: APIRoute = (context) =>
  adminOnly(context, adminServiceWorker, 'text/javascript; charset=utf-8');
