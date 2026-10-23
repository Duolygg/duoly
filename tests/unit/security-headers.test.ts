import { expect, it, vi } from 'vitest';
vi.mock('astro:middleware', () => ({
  defineMiddleware: (handler: unknown) => handler,
}));
import { onRequest } from '../../src/middleware';
it('preserves no-referrer on private authentication and chat responses', async () => {
  const response = new Response('{}', {
    headers: { 'Referrer-Policy': 'no-referrer' },
  });
  const result = await onRequest(
    { url: new URL('https://duoly.gg/api/orders/x/chat') } as Parameters<
      typeof onRequest
    >[0],
    async () => response,
  );
  if (!result) throw new Error('Missing response');
  expect(result.headers.get('referrer-policy')).toBe('no-referrer');
  if (!result) throw new Error('Missing response');
  expect(result.headers.get('x-content-type-options')).toBe('nosniff');
});
it('still applies the default referrer policy to public responses', async () => {
  const result = await onRequest(
    {} as Parameters<typeof onRequest>[0],
    async () => new Response('public'),
  );
  if (!result) throw new Error('Missing response');
  expect(result.headers.get('referrer-policy')).toBe(
    'strict-origin-when-cross-origin',
  );
});

it('never serves pages with no-referrer, so their form posts keep a real Origin', async () => {
  for (const path of ['/login', '/admin', '/dashboard', '/teammate']) {
    const result = await onRequest(
      { url: new URL('https://duoly.gg' + path) } as Parameters<
        typeof onRequest
      >[0],
      async () =>
        new Response('<html></html>', {
          headers: {
            'Referrer-Policy': 'no-referrer',
            'Content-Type': 'text/html',
          },
        }),
    );
    if (!result) throw new Error('Missing response');
    expect(result.headers.get('referrer-policy')).toBe(
      'strict-origin-when-cross-origin',
    );
  }
});
