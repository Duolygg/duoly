import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('posthog-js', () => ({ default: {} }));
vi.mock('../../src/client/analytics/controller', () => ({
  createController: () => ({ sync: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
async function load(
  options: {
    uid?: string | null;
    cookie?: string;
    csrf?: string;
    island?: boolean;
  } = {},
) {
  const listeners = new Map<string, (event: { persisted?: boolean }) => void>();
  const fetch = vi.fn().mockRejectedValue(new Error('offline'));
  const document = {
    cookie: options.cookie ?? 'duoly-consent=v2.a1.m0.r0',
    getElementById: () =>
      options.island === false
        ? null
        : {
            textContent: JSON.stringify({
              v: 1,
              key: 'phc_abcdefghijklm',
              host: 'https://eu.i.posthog.com',
              hosts: ['duoly.gg'],
              route: '/',
              policy: 'full',
              uid:
                options.uid === undefined
                  ? '11111111-1111-4111-8111-111111111111'
                  : options.uid,
              role: 'customer',
              internal: false,
              release: null,
            }),
            dataset: { csrf: options.csrf ?? 'a'.repeat(64) },
          },
  };
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', {});
  vi.stubGlobal('location', { hostname: 'duoly.gg', pathname: '/' });
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal(
    'addEventListener',
    (name: string, handler: (event: { persisted?: boolean }) => void) =>
      listeners.set(name, handler),
  );
  await import('../../src/client/analytics/boot');
  return {
    fetch,
    document,
    fire: (name: string, event = {}) => listeners.get(name)?.(event),
  };
}
describe('browser analytics consent sync', () => {
  it('posts once on load with the existing CSRF header and again on consent changes, ignoring failures', async () => {
    const page = await load();
    expect(page.fetch).toHaveBeenCalledExactlyOnceWith(
      '/api/analytics/consent',
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Token': 'a'.repeat(64) },
      },
    );
    page.fire('pageshow', { persisted: true });
    expect(page.fetch).toHaveBeenCalledTimes(1);
    page.document.cookie = 'duoly-consent=v2.a0.m0.r0';
    page.fire('duoly:consent');
    await Promise.resolve();
    expect(page.fetch).toHaveBeenCalledTimes(2);
  });
  it.each([
    { uid: null },
    { cookie: '' },
    { cookie: 'duoly-consent=invalid' },
    { csrf: '' },
    { island: false },
  ])(
    'does not post without identity, choice, token or island: %j',
    async (options) => {
      const page = await load(options);
      expect(page.fetch).not.toHaveBeenCalled();
    },
  );
  it('posts a first choice after initial load without a cookie', async () => {
    const page = await load({ cookie: '' });
    page.document.cookie = 'duoly-consent=v2.a0.m1.r0';
    page.fire('duoly:consent');
    expect(page.fetch).toHaveBeenCalledTimes(1);
  });
});
