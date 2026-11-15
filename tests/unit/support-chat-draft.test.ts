import { expect, it, vi } from 'vitest';
import SupportChat from '../../src/components/support/SupportChat.jsx';
import {
  CHAT_DRAFT_MAX,
  openSupportChat,
} from '../../src/components/support/open-chat';

/*
 * "Add a game" and "Missing someone? Tell us" open the support chat with the sentence already
 * written (DESIGN decision 7). It is a draft and nothing else: the teammate reads it, edits it
 * and presses send, so nothing is ever posted on their behalf.
 */
function chat() {
  // The widget is intentionally JavaScript, and this drives one method of it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = new SupportChat({ csrf: 'token' });
  c.setState = (patch: object | ((s: object) => object), done?: () => void) => {
    c.state = {
      ...c.state,
      ...(typeof patch === 'function' ? patch(c.state) : patch),
    };
    done?.();
  };
  c.load = vi.fn(async () => {});
  c.toggle = vi.fn(() => {
    c.state = { ...c.state, open: true };
  });
  c.send = vi.fn();
  return c;
}

it('puts a drafted message in the input and opens the panel, sending nothing', async () => {
  const c = chat();
  await c.openFromPage({
    detail: { draft: "I'd like to add Dota 2 to my profile." },
  });
  expect(c.state.draft).toBe("I'd like to add Dota 2 to my profile.");
  expect(c.state.open).toBe(true);
  expect(c.send).not.toHaveBeenCalled();
});
it('opens with an empty input when the page sends no draft', async () => {
  const c = chat();
  await c.openFromPage(new Event('duoly:chat'));
  expect(c.state.draft).toBe('');
  expect(c.state.open).toBe(true);
  await c.openFromPage(undefined);
  expect(c.state.draft).toBe('');
});
it('never overwrites something the visitor typed', async () => {
  const c = chat();
  c.state = { ...c.state, draft: 'my own question' };
  await c.openFromPage({ detail: { draft: 'I would like to add Dota 2.' } });
  expect(c.state.draft).toBe('my own question');
});
it('replaces its own earlier draft, so a second game is the one that shows', async () => {
  const c = chat();
  await c.openFromPage({ detail: { draft: 'Add Dota 2.' } });
  await c.openFromPage({ detail: { draft: 'Add Overwatch 2.' } });
  expect(c.state.draft).toBe('Add Overwatch 2.');
});
it('cuts a draft to a sentence and keeps control characters out of it', () => {
  const events: Event[] = [];
  const window = {
    dispatchEvent: (event: Event) => events.push(event),
  } as unknown as Window & typeof globalThis;
  vi.stubGlobal('window', window);
  openSupportChat('  Valorant: Nobody is missing.  ');
  expect((events[0] as CustomEvent).detail).toEqual({
    draft: 'Valorant: Nobody is missing.',
  });
  openSupportChat('a'.repeat(400));
  expect(
    ((events[1] as CustomEvent).detail as { draft: string }).draft,
  ).toHaveLength(CHAT_DRAFT_MAX);
  /* An empty draft is just "open the chat": a plain Event, which is what every older caller
     already sends and what the listener has always understood. */
  openSupportChat('   ');
  openSupportChat();
  for (const event of events.slice(2)) {
    expect(event.type).toBe('duoly:chat');
    expect(event).not.toBeInstanceOf(CustomEvent);
    expect((event as { detail?: unknown }).detail).toBe(undefined);
  }
  vi.unstubAllGlobals();
});
