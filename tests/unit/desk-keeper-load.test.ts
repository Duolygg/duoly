import { afterEach, expect, it, vi } from 'vitest';
import { startDeskKeeper } from '../../src/components/teammate/desk-keeper';
const api = vi.hoisted(() => vi.fn());
vi.mock('../../src/components/teammate/teammate-data', () => ({
  createTeammateFetch: () => api,
  newEligibleOrders: () => [],
}));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it.each(['response', 'network'])(
  'throttles failed %s settings reads without slowing presence',
  async (kind) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T00:00:00Z'));
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('Worker', undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    api.mockImplementation(async (path: string) => {
      if (path === '/api/queue-settings') {
        if (kind === 'network') throw new Error('network');
        return new Response('{}', { status: 503 });
      }
      return Response.json({ online: true, afkIn: 14400 });
    });
    const stop = startDeskKeeper({
      csrf: 'test',
      fetcher: api,
      location: new URL('https://example.com/games') as unknown as Location,
    });
    await vi.advanceTimersByTimeAsync(59999);
    expect(
      api.mock.calls.filter(([path]) => path === '/api/queue-settings'),
    ).toHaveLength(1);
    expect(
      api.mock.calls.filter(([path]) => path === '/api/presence'),
    ).toHaveLength(6);
    await vi.advanceTimersByTimeAsync(1);
    expect(
      api.mock.calls.filter(([path]) => path === '/api/queue-settings'),
    ).toHaveLength(2);
    stop();
  },
);
