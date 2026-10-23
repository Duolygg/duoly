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
    {} as Parameters<typeof onRequest>[0],
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
