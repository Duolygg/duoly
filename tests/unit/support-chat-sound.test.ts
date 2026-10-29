import { expect, it, vi } from 'vitest';
import SupportChat from '../../src/components/support/SupportChat.jsx';

function chat() {
  // The widget is intentionally JavaScript. The harness drives take() with server snapshots.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = new SupportChat({ csrf: 'token' });
  c.setState = (patch: object | ((s: object) => object), done?: () => void) => {
    c.state = {
      ...c.state,
      ...(typeof patch === 'function' ? patch(c.state) : patch),
    };
    done?.();
  };
  c.toBottom = () => {};
  c.ping = { currentTime: 0, play: vi.fn(() => Promise.resolve()) };
  return c;
}
const snapshot = (...from: string[]) => ({
  conversation: {
    status: 'bot',
    messages: from.map((f, i) => ({ id: 'm' + i, from: f, text: f, at: i })),
  },
});

it('plays the chat sound for new Sparky and team replies, not on first load or own messages', () => {
  const c = chat();
  c.take(snapshot('bot'));
  expect(c.ping.play).not.toHaveBeenCalled();
  c.take(snapshot('bot', 'user'));
  expect(c.ping.play).not.toHaveBeenCalled();
  c.take(snapshot('bot', 'user', 'bot'));
  expect(c.ping.play).toHaveBeenCalledTimes(1);
  c.take(snapshot('bot', 'user', 'bot', 'user', 'admin'));
  expect(c.ping.play).toHaveBeenCalledTimes(2);
  c.take(snapshot('bot', 'user', 'bot', 'user', 'admin', 'system'));
  expect(c.ping.play).toHaveBeenCalledTimes(2);
});
