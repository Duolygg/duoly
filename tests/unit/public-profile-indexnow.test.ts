import { beforeEach, expect, it, vi } from 'vitest';
import { waitUntil } from '@vercel/functions';
import { pingProfileChanges } from '../../src/server/teammates/indexnow';
import { submissionPayload } from '../../scripts/indexnow.mjs';
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));
const request = vi.fn();
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubGlobal('fetch', request);
  request.mockReset();
  request.mockResolvedValue(new Response(null, { status: 200 }));
  vi.mocked(waitUntil).mockReset();
});
it('never pings in local development or while the launch flag is off', () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
  pingProfileChanges(null, { slug: 'nyx', published: true });
  expect(request).not.toHaveBeenCalled();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'false');
  pingProfileChanges(null, { slug: 'nyx', published: true });
  expect(request).not.toHaveBeenCalled();
});
it('pings both valid old and new profile URLs after a rename without awaiting the network', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
  pingProfileChanges(
    { slug: 'nyx', published: true },
    { slug: 'nyx-new', published: true },
  );
  expect(request).toHaveBeenCalledWith(
    'https://api.indexnow.org/indexnow',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(
        submissionPayload([
          'https://duoly.gg/teammates/nyx',
          'https://duoly.gg/teammates/nyx-new',
        ]),
      ),
    }),
  );
  expect(waitUntil).toHaveBeenCalledTimes(1);
  await vi.mocked(waitUntil).mock.calls[0]?.[0];
});
it('does not ping ordinary saves or fixture sessions', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
  pingProfileChanges(
    { slug: 'nyx', published: true },
    { slug: 'nyx', published: true },
  );
  expect(request).not.toHaveBeenCalled();
  vi.stubEnv('PUBLIC_PROFILE_FIXTURES', 'true');
  pingProfileChanges(null, { slug: 'nyx', published: true });
  expect(request).not.toHaveBeenCalled();
});
it('swallows rejected submissions', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
  request.mockRejectedValue(new Error('offline'));
  pingProfileChanges(
    { slug: 'nyx', published: true },
    { slug: 'nyx', published: false },
  );
  await expect(
    vi.mocked(waitUntil).mock.calls[0]?.[0],
  ).resolves.toBeUndefined();
});
