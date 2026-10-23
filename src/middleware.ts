import { defineMiddleware } from 'astro:middleware';

// Baseline protections, not a complete script-source CSP.
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
};

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  for (const [name, value] of Object.entries(securityHeaders)) {
    // Private auth/chat handlers deliberately choose the stricter policy.
    if (
      name === 'Referrer-Policy' &&
      response.headers.get(name) === 'no-referrer'
    )
      continue;
    response.headers.set(name, value);
  }
  return response;
});
