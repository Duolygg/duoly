import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readChat,
  sendChat,
  setTyping,
  subscribeChat,
} from '../../src/client/order-chat';
const order = '11111111-1111-4111-8111-111111111111',
  assignment = '22222222-2222-4222-8222-222222222222',
  request = '33333333-3333-4333-8333-333333333333';
const room = {
  order_id: order,
  assignment_id: assignment,
  viewer: 'customer',
  writable: true,
  participant: { role: 'teammate', name: 'Kairo', image: '' },
  messages: [],
  typing: [],
  archives: [],
};
const input = {
  assignment_id: assignment,
  request_id: request,
  body: 'Ready 🎮',
};
const message = {
  id: '44444444-4444-4444-8444-444444444444',
  sequence: 1,
  kind: 'user',
  sender: 'customer',
  name: 'Sam',
  image: '',
  body: input.body,
  created_at: '2026-10-23T08:00:00Z',
  request_id: request,
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
afterEach(() => vi.unstubAllGlobals());
describe('private chat HTTP client', () => {
  it('performs fresh credentialed reads and rejects a mismatched order or assignment', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(room))
      .mockResolvedValueOnce(response({ ...room, order_id: assignment }))
      .mockResolvedValueOnce(response({ ...room, assignment_id: order }));
    expect(await readChat(fetcher, order, assignment)).toEqual(room);
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      credentials: 'same-origin',
      cache: 'no-store',
    });
    await expect(readChat(fetcher, order, assignment)).rejects.toThrow();
    await expect(readChat(fetcher, order, assignment)).rejects.toThrow();
  });
  it('preserves denial/rate statuses and never displays provider diagnostics', async () => {
    for (const status of [401, 404, 429, 503]) {
      await expect(
        readChat(
          async () => response({ error: 'secret diagnostic' }, status),
          order,
        ),
      ).rejects.toMatchObject({ status });
    }
  });
  it('uses a bound same-request acknowledgement and refuses cross-request or changed-body success', async () => {
    const result = {
      order_id: order,
      assignment_id: assignment,
      request_id: request,
      outcome: 'sent',
      message,
      note: null,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(result))
      .mockResolvedValueOnce(response({ ...result, assignment_id: order }))
      .mockResolvedValueOnce(
        response({ ...result, message: { ...message, body: 'different' } }),
      );
    expect((await sendChat(fetcher, order, 'csrf', input)).outcome).toBe(
      'sent',
    );
    expect(
      new Headers(fetcher.mock.calls[0]![1]?.headers).get('X-CSRF-Token'),
    ).toBe('csrf');
    await expect(sendChat(fetcher, order, 'csrf', input)).rejects.toThrow();
    await expect(sendChat(fetcher, order, 'csrf', input)).rejects.toThrow();
  });
  it('never retries an uncertain write automatically', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('private response'));
    await expect(sendChat(fetcher, order, 'csrf', input)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('checks typing acknowledgements and refuses invalid ids before network access', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ order_id: order, assignment_id: order, ok: true }),
      );
    await expect(
      setTyping(fetcher, order, 'csrf', assignment),
    ).rejects.toThrow();
    const denied = vi.fn<typeof fetch>();
    await expect(readChat(denied, order + 'bad')).rejects.toThrow();
    expect(denied).not.toHaveBeenCalled();
  });
  it('does not subscribe or expose a privileged fallback when the realtime bridge is denied', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(response({}, 401)),
    );
    const changed = vi.fn(),
      state = vi.fn();
    const dispose = await subscribeChat(order, assignment, changed, state);
    expect(state).toHaveBeenLastCalledWith('unavailable');
    expect(changed).toHaveBeenCalledExactlyOnceWith(); // Fresh HTTP read clears any revoked UI state.
    dispose();
  });
});
