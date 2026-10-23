import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({
  channel: { on: vi.fn(), subscribe: vi.fn() },
  factory: vi.fn(),
  setAuth: vi.fn(),
  removeChannel: vi.fn(),
  disconnect: vi.fn(),
  open: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: sdk.factory }));
import { subscribeChat } from '../../src/client/order-chat';
const order = '11111111-1111-4111-8111-111111111111',
  assignment = '22222222-2222-4222-8222-222222222222';
const bootstrap = {
  url: 'https://test.supabase.co',
  publishable_key: 'sb_publishable_test',
  access_token: 'user-only-short-lived-token',
  expires_at: Math.floor(Date.now() / 1000) + 60,
  topic: 'order-chat:' + assignment,
};
beforeEach(() => {
  vi.resetAllMocks();
  sdk.channel.on.mockReturnValue(sdk.channel);
  sdk.channel.subscribe.mockReturnValue(sdk.channel);
  sdk.open.mockReturnValue(sdk.channel);
  sdk.setAuth.mockResolvedValue(undefined);
  sdk.removeChannel.mockResolvedValue(undefined);
  sdk.factory.mockReturnValue({
    channel: sdk.open,
    realtime: { setAuth: sdk.setAuth, disconnect: sdk.disconnect },
    removeChannel: sdk.removeChannel,
  });
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify(bootstrap))),
  );
  vi.stubGlobal('window', {
    setTimeout: vi.fn().mockReturnValue(7),
    clearTimeout: vi.fn(),
  });
});
afterEach(() => vi.unstubAllGlobals());
it('uses an explicit private channel with memory-only callback and no Auth client', async () => {
  const changed = vi.fn(),
    state = vi.fn();
  const dispose = await subscribeChat(order, assignment, changed, state);
  expect(sdk.setAuth).toHaveBeenCalledExactlyOnceWith();
  expect(sdk.open).toHaveBeenCalledExactlyOnceWith(bootstrap.topic, {
    config: { private: true },
  });
  const options = sdk.factory.mock.calls[0]![2];
  expect(options).toMatchObject({
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  expect(await options.accessToken()).toBe(bootstrap.access_token);
  expect(options.cookies).toBeUndefined();
  expect(sdk.channel.on.mock.calls[0]![1]).toEqual({ event: 'chat_changed' });
  sdk.channel.on.mock.calls[0]![2]({
    payload: { body: 'untrusted attacker text' },
  });
  expect(changed).toHaveBeenCalledExactlyOnceWith();
  sdk.channel.subscribe.mock.calls[0]![0]('SUBSCRIBED');
  expect(state).toHaveBeenLastCalledWith('connected');
  dispose();
  expect(await options.accessToken()).toBeNull();
  expect(sdk.removeChannel).toHaveBeenCalledExactlyOnceWith(sdk.channel);
  expect(sdk.disconnect).toHaveBeenCalledOnce();
  sdk.channel.on.mock.calls[0]![2]({});
  expect(changed).toHaveBeenCalledTimes(2);
});
it('refuses another assignment and never creates a fallback client', async () => {
  vi.mocked(fetch).mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ ...bootstrap, topic: 'order-chat:' + order }),
      ),
  );
  const state = vi.fn();
  await subscribeChat(order, assignment, vi.fn(), state);
  expect(state).toHaveBeenLastCalledWith('unavailable');
  expect(sdk.factory).not.toHaveBeenCalled();
});
it('reboots authorization before reconnect instead of reusing the cached JWT', async () => {
  const changed = vi.fn(),
    state = vi.fn();
  const dispose = await subscribeChat(order, assignment, changed, state);
  const old = sdk.factory.mock.calls[0]![2].accessToken;
  sdk.channel.subscribe.mock.calls[0]![0]('CHANNEL_ERROR');
  expect(await old()).toBeNull();
  expect(state).toHaveBeenLastCalledWith('reconnecting');
  expect(sdk.disconnect).toHaveBeenCalledOnce();
  const reconnect = vi.mocked(window.setTimeout).mock.calls.at(-1)?.[0];
  if (typeof reconnect !== 'function') throw new Error('Missing reconnect');
  reconnect();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(sdk.factory).toHaveBeenCalledTimes(2));
  dispose();
});
it('drops credentials and closes before the access token expires', async () => {
  const state = vi.fn();
  await subscribeChat(order, assignment, vi.fn(), state);
  const expire = vi.mocked(window.setTimeout).mock.calls[0]?.[0];
  if (typeof expire !== 'function') throw new Error('Missing expiry');
  expire();
  expect(state).toHaveBeenLastCalledWith('reconnecting');
  expect(await sdk.factory.mock.calls[0]![2].accessToken()).toBeNull();
  expect(sdk.disconnect).toHaveBeenCalledOnce();
});
