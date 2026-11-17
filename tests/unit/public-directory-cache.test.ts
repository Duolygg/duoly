import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }));
vi.mock('../../src/server/auth/config', () => ({
  authConfig: () => ({
    url: 'https://example.supabase.co',
    publishableKey: 'test',
  }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-18T00:00:00Z'));
  vi.stubEnv('PUBLIC_PROFILE_FIXTURES', 'false');
  rpc.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it.each(['cards', 'indexable'])(
  'coalesces concurrent %s reads and expires after 30 seconds',
  async (kind) => {
    const { loadTeammateCards, loadIndexableProfiles } =
      await import('../../src/server/teammates/public-profiles');
    const load =
      kind === 'cards'
        ? () => loadTeammateCards({ limit: 100 })
        : loadIndexableProfiles;
    rpc.mockResolvedValue({ data: [], error: null });
    await Promise.all([load(), load(), load()]);
    expect(rpc).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29999);
    await load();
    expect(rpc).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await load();
    expect(rpc).toHaveBeenCalledTimes(2);
  },
);
it('keeps card arguments separate and does not cache individual profiles', async () => {
  const { loadTeammateCards, loadPublicProfile } =
    await import('../../src/server/teammates/public-profiles');
  rpc.mockResolvedValue({ data: [], error: null });
  await loadTeammateCards({ game: 'val', limit: 6 });
  await loadTeammateCards({ game: 'lol', limit: 6 });
  await loadPublicProfile('nyx');
  await loadPublicProfile('nyx');
  expect(rpc).toHaveBeenCalledTimes(4);
});
it('throttles failed reads without extending stale public profile visibility', async () => {
  const { loadIndexableProfiles } =
    await import('../../src/server/teammates/public-profiles');
  const rows = [{ slug: 'nyx', updatedAt: '2026-11-12T12:00:00Z' }];
  rpc.mockResolvedValueOnce({ data: rows, error: null });
  expect(await loadIndexableProfiles()).toEqual(rows);
  await vi.advanceTimersByTimeAsync(30000);
  rpc.mockRejectedValue(new Error('unavailable'));
  expect(await loadIndexableProfiles()).toEqual([]);
  expect(await loadIndexableProfiles()).toEqual([]);
  expect(rpc).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(5000);
  rpc.mockResolvedValue({ data: [], error: null });
  expect(await loadIndexableProfiles()).toEqual([]);
  expect(rpc).toHaveBeenCalledTimes(3);
});
