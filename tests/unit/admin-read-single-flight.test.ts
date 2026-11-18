import { afterEach, expect, it, vi } from 'vitest';
import { adminApi } from '../../src/components/admin/api';

afterEach(() => vi.unstubAllGlobals());

it('does not join distinct URLs or different API instances', async () => {
  const fetcher = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetcher);
  const one = adminApi('a');
  const two = adminApi('b');
  await Promise.all([one.get('/x'), one.get('/x?id=1'), two.get('/x')]);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('releases failed reads so the next normal tick retries', async () => {
  const fetcher = vi.fn(async () => {
    throw new Error('offline');
  });
  vi.stubGlobal('fetch', fetcher);
  const api = adminApi('a');
  expect((await api.get('/x')).ok).toBe(false);
  expect((await api.get('/x')).ok).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('never joins a pre-mutation read, even after that old read resolves', async () => {
  const pending: Array<(response: Response) => void> = [];
  const fetcher = vi.fn(
    () => new Promise<Response>((done) => pending.push(done)),
  );
  vi.stubGlobal('fetch', fetcher);
  const api = adminApi('csrf');
  const before = api.get('/api/admin/orders');
  const mutation = api.post('/api/admin/orders', { action: 'cancel' });
  pending[1]!(Response.json({ done: true }));
  await mutation;
  const after = api.get('/api/admin/orders');
  expect(fetcher).toHaveBeenCalledTimes(3);
  pending[0]!(Response.json({ old: true }));
  await before;
  const concurrent = api.get('/api/admin/orders');
  expect(fetcher).toHaveBeenCalledTimes(3);
  pending[2]!(Response.json({ fresh: true }));
  expect(await after).toEqual(await concurrent);
});

it('shares simultaneous identical GETs but never caches a completed response', async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const api = adminApi('csrf');
  const first = api.get('/api/admin/support');
  const second = api.get('/api/admin/support');
  expect(fetcher).toHaveBeenCalledTimes(1);
  resolve(Response.json({ conversations: [] }));
  expect(await first).toEqual(await second);
  const third = api.get('/api/admin/support');
  expect(fetcher).toHaveBeenCalledTimes(2);
  resolve(Response.json({ conversations: [] }));
  await third;
});
