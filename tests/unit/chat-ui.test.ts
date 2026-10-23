import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OrderChat, {
  ChatConversation,
  type ChatRoom,
} from '../../src/components/chat/OrderChat';

const room: ChatRoom = {
  order_id: '00000000-0000-4000-8000-000000000001',
  assignment_id: '00000000-0000-4000-8000-000000000002',
  viewer: 'customer',
  writable: true,
  participant: {
    role: 'teammate',
    name: 'Luna',
    image: '/assets/avatars/avatar-3.png',
  },
  messages: [
    {
      id: 'm1',
      sequence: 1,
      kind: 'system',
      sender: 'system',
      name: '',
      image: '',
      body: 'Your teammate accepted the session.',
      created_at: '2026-10-23T10:00:00Z',
      request_id: null,
    },
    {
      id: 'm2',
      sequence: 2,
      kind: 'user',
      sender: 'teammate',
      name: 'Luna',
      image: '/assets/avatars/avatar-3.png',
      body: '<script>not executable</script> 🎮',
      created_at: '2026-10-23T10:01:00Z',
      request_id: null,
    },
    {
      id: 'm3',
      sequence: 3,
      kind: 'user',
      sender: 'teammate',
      name: 'Luna',
      image: '/assets/avatars/avatar-3.png',
      body: 'Ready when you are!',
      created_at: '2026-10-23T10:02:00Z',
      request_id: null,
    },
  ],
  typing: [],
  archives: [],
};

it('renders a private-data-free loading shell with no fabricated presence or CSRF in DOM', () => {
  const html = renderToStaticMarkup(
    createElement(OrderChat, {
      orderId: room.order_id,
      csrf: 'do-not-render',
      view: 'customer',
    }),
  );
  expect(html).toContain('Loading conversation');
  expect(html).not.toMatch(/do-not-render|Online|Luna|<textarea/);
});

it('renders authentic counterpart, grouped safe text, server timestamps and an accessible composer', () => {
  const html = renderToStaticMarkup(
    createElement(ChatConversation, { room, view: 'customer' }),
  );
  expect(html).toContain('Luna');
  expect(html).toContain('/assets/avatars/avatar-3.png');
  expect(html).toContain('&lt;script&gt;not executable&lt;/script&gt; 🎮');
  expect(html).not.toContain('<script>');
  expect(html).toContain('dateTime="2026-10-23T10:01:00Z"');
  expect(html).toContain('data-grouped="true"');
  expect(html).toContain('aria-label="Message your teammate"');
  expect(html).toContain('Choose emoji');
  expect(html).toContain('0 / 500');
  expect(html).toContain('Your teammate accepted the session.');
});
import {
  codePointLength,
  canSendDraft,
  shouldSendOnEnter,
  EMOJI,
  createRequestGuard,
  makeChatAttempt,
  typingDeadline,
  isNearBottom,
  chatFailure,
} from '../../src/components/chat/emoji';

it('shows denial without retaining a composer, identity or an endless loading label', () => {
  const html = renderToStaticMarkup(
    createElement(ChatConversation, {
      room: null,
      view: 'customer',
      notice: 'This conversation is no longer available.',
    }),
  );
  expect(html).toContain('Conversation unavailable');
  expect(html).not.toMatch(/Loading conversation|Luna|<textarea/);
});

it('keeps closed and admin conversations read-only and queued conversations explicit', () => {
  for (const view of ['customer', 'admin'] as const) {
    const html = renderToStaticMarkup(
      createElement(ChatConversation, {
        room: { ...room, writable: false },
        view,
      }),
    );
    expect(html).toContain('Read-only');
    expect(html).not.toContain('<textarea');
  }
  const queued = renderToStaticMarkup(
    createElement(ChatConversation, {
      room: {
        ...room,
        assignment_id: null,
        participant: null,
        messages: [],
        writable: false,
      },
      view: 'customer',
    }),
  );
  expect(queued).toContain('Waiting for a teammate');
  expect(queued).not.toContain('<textarea');
});

it('retains rejected drafts as text, never delivered bubbles, and exposes explicit uncertain retries', () => {
  const html = renderToStaticMarkup(
    createElement(ChatConversation, {
      room: { ...room, messages: [] },
      view: 'customer',
      draft: '<private rejected draft>',
      notice: 'Not sent: keep payments on Duoly.',
      pending: 'uncertain',
    }),
  );
  expect(html).toContain('Retry same message');
  expect(html).toContain('&lt;private rejected draft&gt;</textarea>');
  expect(html).not.toContain('class="oc-bubble"');
  expect(html).toContain('Delivery not confirmed');
  expect(html).toMatch(/<textarea[^>]*readOnly=""/i);
  expect(html).not.toMatch(/<textarea[^>]*\sdisabled=/);
});

it('classifies denial, stale assignment, throttling and uncertain failures without exposing diagnostics', () => {
  for (const status of [401, 403, 404])
    expect(chatFailure(status)).toBe('denied');
  expect(chatFailure(409)).toBe('stale');
  expect(chatFailure(429)).toBe('rate-limited');
  expect(chatFailure(503)).toBe('uncertain');
  expect(chatFailure(0)).toBe('uncertain');
});

it('does not invite sending in an empty read-only transcript', () => {
  const html = renderToStaticMarkup(
    createElement(ChatConversation, {
      room: { ...room, messages: [], writable: false },
      view: 'customer',
    }),
  );
  expect(html).not.toContain('Say hello');
  expect(html).toContain('No messages in this conversation');
});

it('removes retry actions when an in-flight conversation becomes read-only', () => {
  const html = renderToStaticMarkup(
    createElement(ChatConversation, {
      room: { ...room, writable: false },
      view: 'customer',
      pending: 'uncertain',
      draft: 'Keep this draft',
    }),
  );
  expect(html).not.toContain('Retry same message');
  expect(html).toContain('Read-only');
});

it('marks archives explicitly read-only even when fixture writable is incorrectly true', () => {
  const archived = {
    ...room,
    archives: [
      { assignment_id: room.assignment_id!, label: 'Previous teammate' },
    ],
  };
  const html = renderToStaticMarkup(
    createElement(ChatConversation, { room: archived, view: 'customer' }),
  );
  expect(html).toContain('read-only archive');
  expect(html).not.toContain('<textarea');
});

it('never loads unapproved avatar URLs and keeps long multiline drafts intact', () => {
  const html = renderToStaticMarkup(
    createElement(ChatConversation, {
      room: {
        ...room,
        participant: {
          role: 'teammate',
          name: 'Luna',
          image: 'https://tracker.invalid/secret',
        },
        messages: [],
      },
      view: 'customer',
      draft: '🎮'.repeat(501) + '\nhello',
    }),
  );
  expect(html).not.toContain('tracker.invalid');
  expect(html).toContain('aria-invalid="true"');
  expect(html).toContain('507 / 500');
});

it('invalidates stale reads and every in-flight callback after disposal or denial', () => {
  const guard = createRequestGuard();
  const old = guard.next();
  const current = guard.next();
  expect(guard.isCurrent(old)).toBe(false);
  expect(guard.isCurrent(current)).toBe(true);
  guard.dispose();
  expect(guard.isCurrent(current)).toBe(false);
  expect(guard.isCurrent(guard.next())).toBe(false);
});

it('preserves an immutable request UUID and exact normalized body for explicit retries', () => {
  const attempt = makeChatAttempt(
    ' Hello 🎮\n ',
    room.assignment_id!,
    'request-uuid',
  );
  expect(attempt).toEqual({
    assignment_id: room.assignment_id,
    request_id: 'request-uuid',
    body: 'Hello 🎮',
  });
  expect(Object.isFrozen(attempt)).toBe(true);
  expect(makeChatAttempt(' ', room.assignment_id!, 'request-uuid')).toBeNull();
  expect(
    makeChatAttempt('🎮'.repeat(501), room.assignment_id!, 'request-uuid'),
  ).toBeNull();
});

it('expires typing no later than four seconds and preserves the reader scroll position', () => {
  expect(
    typingDeadline('2026-10-23T10:00:09Z', Date.parse('2026-10-23T10:00:00Z')),
  ).toBe(Date.parse('2026-10-23T10:00:04Z'));
  expect(
    typingDeadline('2026-10-23T10:00:02Z', Date.parse('2026-10-23T10:00:00Z')),
  ).toBe(Date.parse('2026-10-23T10:00:02Z'));
  expect(
    isNearBottom({ scrollHeight: 1000, scrollTop: 500, clientHeight: 480 }),
  ).toBe(true);
  expect(
    isNearBottom({ scrollHeight: 1000, scrollTop: 100, clientHeight: 480 }),
  ).toBe(false);
});

it('counts Unicode code points and rejects blank or oversized drafts without truncating them', () => {
  expect(codePointLength('🎮👍🏽')).toBe(3);
  expect(canSendDraft('🎮'.repeat(500))).toBe(true);
  expect(canSendDraft('🎮'.repeat(501))).toBe(false);
  expect(canSendDraft(' \n ')).toBe(false);
  expect(EMOJI.every(({ label, value }) => label && value)).toBe(true);
});

it('sends only a plain Enter, never Shift+Enter or an IME confirmation', () => {
  const enter = {
    key: 'Enter',
    shiftKey: false,
    isComposing: false,
    keyCode: 13,
  };
  expect(shouldSendOnEnter(enter)).toBe(true);
  expect(shouldSendOnEnter({ ...enter, shiftKey: true })).toBe(false);
  expect(shouldSendOnEnter({ ...enter, isComposing: true })).toBe(false);
  expect(shouldSendOnEnter({ ...enter, keyCode: 229 })).toBe(false);
  expect(shouldSendOnEnter({ ...enter, key: 'a' })).toBe(false);
});
