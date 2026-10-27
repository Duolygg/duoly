import { defineMiddleware } from 'astro:middleware';
import { captureReferral } from './server/referrals';

// Baseline protections, not a complete script-source CSP.
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
};

export const onRequest = defineMiddleware(async (context, next) => {
  // Creator links (?ref=CODE): remember the code in an httpOnly cookie for checkout.
  captureReferral(context.url, context.request?.method, context.cookies);
  const response = await next();
  // Private API and auth endpoints may choose the stricter no-referrer policy. Pages never do:
  // a page served with no-referrer makes browsers send `Origin: null` on its form posts
  // (sign-in, sign-out, Connect Discord), which the CSRF origin check rightly rejects.
  const path = context.url?.pathname ?? '';
  const endpoint = path.startsWith('/api/') || path.startsWith('/auth/');
  for (const [name, value] of Object.entries(securityHeaders)) {
    if (
      endpoint &&
      name === 'Referrer-Policy' &&
      response.headers.get(name) === 'no-referrer'
    )
      continue;
    response.headers.set(name, value);
  }
  return response;
});
