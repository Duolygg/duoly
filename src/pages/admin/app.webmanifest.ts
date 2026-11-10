import type { APIRoute } from 'astro';
import { adminManifest, adminOnly } from '../../server/support/admin-app';

export const prerender = false;

export const GET: APIRoute = (context) =>
  adminOnly(context, adminManifest, 'application/manifest+json');
