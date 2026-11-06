import type { APIRoute } from 'astro';
import { handleMcp } from '../server/mcp/http';
export const prerender = false;
export const ALL: APIRoute = (context) => {
  // Astro's adapter supplies the source address. Do not accept caller supplied forwarded IPs.
  let ip = '';
  try {
    ip = context.clientAddress;
  } catch {
    /* Fail closed if the adapter cannot identify the source. */
  }
  return handleMcp(context.request, { ip });
};
