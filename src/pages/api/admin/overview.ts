import type { APIRoute } from 'astro';
import { overview } from '../../../server/admin/handlers';

export const prerender = false;
export const GET: APIRoute = overview;
