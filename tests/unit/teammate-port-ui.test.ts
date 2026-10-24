import { it, expect, vi, afterEach } from 'vitest';
import { readChat, sendChat, setTyping } from '../../src/client/order-chat';
vi.mock('../../src/client/order-chat', () => ({
  readChat: vi.fn(),
  sendChat: vi.fn(),
  setTyping: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Teammate, { FEATURES } from '../../src/components/teammate/Teammate.jsx';
import Leaderboard from '../../src/components/teammate/Leaderboard.jsx';
const id = '11111111-1111-4111-8111-111111111111',
  assignmentId = '22222222-2222-4222-8222-222222222222';
function desk() {
  const c = new Teammate({
    csrf: 'token',
    discordLinked: true,
    user: { name: 'Fabian' },
    chatEnabled: true,
  });
  // The port is intentionally JavaScript. The harness permits authoritative state fixtures.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance: any = c;
  instance.setState = (
    patch: object | ((state: object) => object),
    done?: () => void,
  ) => {
    instance.state = {
      ...instance.state,
      ...(typeof patch === 'function' ? patch(instance.state) : patch),
    };
    done?.();
  };
  return instance;
}
it('uses neutral customer avatars when the privacy-safe DTO has no image or preview avatar index', () => {
  const c = desk();
  c.state.queue = [
    {
      id,
      game: 'lol',
      payout: 12.34,
      games: 2,
      unit: 'hour',
      customerImage: '',
    },
  ];
  const v = c.renderVals();
  expect(v.available[0].avatar).toBe('/assets/avatars/avatar-1.png');
  expect(v.available[0].gamesLabel).toBe('2 hours');
});
it('does not claim that the customer is online when only assignment data exists', () => {
  const c = desk();
  c.state.active = {
    id,
    assignmentId,
    game: 'lol',
    payout: 12.34,
    games: 2,
    unit: 'game',
    customer: 'Customer',
    customerImage: '',
    realCustomer: true,
  };
  const html = renderToStaticMarkup(c.render());
  expect(html).not.toContain('box-shadow:0 0 0 2.5px');
});
it('retains the original layout with live presence and unsupported controls still gated', () => {
  const html = renderToStaticMarkup(
    React.createElement(Teammate, {
      user: { name: 'Fabian' },
      csrf: 'token',
      discordLinked: true,
    }),
  );
  expect(html).toContain('tm-status');
  expect(html).toContain('Available orders');
  expect(html).toContain('Loading your desk');
  expect(html).toContain('You’re offline');
  for (const text of [
    'Online ·',
    'Earned today',
    'Queue settings',
    'Leaderboard',
    'No games are unlocked',
    'Waiting for orders!',
  ])
    expect(html).not.toContain(text);
  const { support, presence, notifications, reviews, leaderboard, ...gated } =
    FEATURES;
  expect(leaderboard).toBe(true);
  expect(support).toBe(true);
  expect(presence).toBe(true);
  expect(notifications).toBe(true);
  expect(reviews).toBe(true);
  expect(FEATURES.tips).toBe(false);
  expect(html).not.toContain('Tips received');
  expect(html).not.toContain('Rating');
  expect(Object.values(gated).every((v) => v === false)).toBe(true);
});
it('acceptance re-reads authoritative assignment and never trusts an uncertain response', async () => {
  const c = desk();
  c.pollChat = vi.fn();
  const active = { id, assignmentId, realCustomer: true };
  c._fetch = vi.fn(async (path) =>
    Response.json(
      path === '/api/desk' ? { queue: [], mine: active } : { order: active },
    ),
  );
  await c.accept({ id });
  expect(c.state.active).toEqual(active);
  expect(c._fetch.mock.calls.map((x: [string]) => x[0])).toEqual([
    '/api/orders/' + id,
    '/api/desk',
  ]);
  const uncertain = desk();
  uncertain._fetch = vi.fn(async () =>
    Response.json({ error: 'unconfirmed' }, { status: 503 }),
  );
  await uncertain.accept({ id });
  expect(uncertain.state.active).toBe(null);
  expect(uncertain.state.notice).toContain('unconfirmed');
});
it.each(['503', 'network', 'malformed', 'readback failure'])(
  'blocks a second acceptance after %s until a fresh authoritative desk read',
  async (failure) => {
    const c = desk();
    const second = { id: '33333333-3333-4333-8333-333333333333' };
    c.state.loaded = true;
    c.state.queue = [{ id }, second];
    c._fetch = vi.fn(async (path: string) => {
      if (failure === 'network') throw new Error('Connection lost');
      if (failure === 'malformed') return new Response('{');
      if (failure === 'readback failure' && path !== '/api/desk')
        return Response.json({ order: { id, assignmentId } });
      return Response.json({ error: 'unconfirmed' }, { status: 503 });
    });
    await c.accept({ id });
    await c.accept(second);
    expect(
      c._fetch.mock.calls.filter(([path]: [string]) => path !== '/api/desk'),
    ).toHaveLength(1);
    expect(c.state.loaded).toBe(false);
    expect(c.state.queue).toEqual([]);
    expect(c.renderVals().showFeed).toBe(false);
    // Failed/denied reads do not release the mutation lock.
    c.state.online = true;
    for (const status of [503, 403]) {
      c._fetch = vi.fn(async () =>
        Response.json({ error: 'unavailable' }, { status }),
      );
      await c.poll();
      await c.accept(second);
      expect(c._fetch.mock.calls.map(([path]: [string]) => path)).toEqual([
        '/api/desk',
      ]);
    }
    let resolve!: (response: Response) => void;
    c._fetch = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    const reading = c.poll();
    await c.accept(second);
    expect(c._fetch.mock.calls.map(([path]: [string]) => path)).toEqual([
      '/api/desk',
    ]);
    resolve(Response.json({ queue: [second], mine: null }));
    await reading;
    expect(c.state.loaded).toBe(true);
    c._fetch = vi.fn(async (path: string) =>
      Response.json(
        path === '/api/desk'
          ? { queue: [], mine: { ...second, assignmentId } }
          : { order: second },
      ),
    );
    c.pollChat = vi.fn();
    await c.accept(second);
    expect(c._fetch.mock.calls.map(([path]: [string]) => path)).toEqual([
      '/api/orders/' + second.id,
      '/api/desk',
    ]);
    expect(c.state.active).toEqual({ ...second, assignmentId });
  },
);
it('revokes private context on signed-out completion readback without releasing financial safeguards', async () => {
  const c = desk();
  c.state.active = { id, assignmentId, realCustomer: true };
  c.state.chat = [{ id: 'private', text: 'Private chat' }];
  c._fetch = vi.fn(async () =>
    Response.json({ error: 'signed out' }, { status: 401 }),
  );
  await c.completed();
  expect(c.state.active).toBe(null);
  expect(c.state.chat).toEqual([]);
  expect(c._completionReadback).toBe(true);
  expect(c._completionBusy).toBe(true);
  expect(c.state.notice).not.toContain('Completion recorded');
  await c.accept({ id });
  expect(c._fetch).toHaveBeenCalledTimes(1);
  expect(renderToStaticMarkup(c.render())).toContain('Refresh desk');
});
it('offers a manual read-only desk refresh while acceptance is unresolved', async () => {
  const c = desk();
  c.state.loaded = true;
  c._fetch = vi.fn(async () =>
    Response.json({ error: 'uncertain' }, { status: 503 }),
  );
  await c.accept({ id });
  expect(renderToStaticMarkup(c.render())).toContain('Refresh desk');
});
it('freezes assignment during completion and clears only after authoritative null readback', async () => {
  const c = desk();
  c.state.active = { id, assignmentId };
  c._completionBusy = true;
  c._fetch = vi.fn(async () => Response.json({ queue: [], mine: null }));
  await c.poll();
  await c.accept({ id });
  expect(c._fetch).not.toHaveBeenCalled();
  c._fetch = vi.fn(async () =>
    Response.json({ error: 'unavailable' }, { status: 503 }),
  );
  await c.completed();
  expect(c._completionReadback).toBe(true);
  expect(c.state.active.assignmentId).toBe(assignmentId);
  c._fetch = vi.fn(async () => Response.json({ queue: [], mine: null }));
  await c.completed();
  expect(c.state.active).toBe(null);
});
it('uses assignment-bound real chat and clears revoked messages, ignoring stale assignment reads', async () => {
  const c = desk();
  c.state.active = { id, assignmentId, realCustomer: true };
  c.state.chat = [{ id: 'old', text: 'private' }];
  vi.mocked(readChat).mockRejectedValueOnce({
    status: 403,
    message: 'Access revoked',
  });
  await c.pollChat();
  expect(c.state.chat).toEqual([]);
  let resolve!: (value: Awaited<ReturnType<typeof readChat>>) => void;
  vi.mocked(readChat).mockImplementationOnce(
    () => new Promise((r) => (resolve = r)),
  );
  const pending = c.pollChat();
  c.state.active = {
    id,
    assignmentId: '33333333-3333-4333-8333-333333333333',
    realCustomer: true,
  };
  resolve({
    order_id: id,
    assignment_id: assignmentId,
    viewer: 'teammate',
    participant: null,
    archives: [],
    messages: [
      {
        id: 'leak',
        body: 'old assignment',
        sender: 'customer',
        sequence: 1,
        kind: 'user',
        name: 'Customer',
        image: '',
        created_at: '2026-10-23T10:00:00Z',
        request_id: id,
      },
    ],
    typing: [],
    writable: true,
  });
  await pending;
  expect(c.state.chat).toEqual([]);
});
it('does not invent delivered messages and keeps the request UUID on uncertain manual retry', async () => {
  const c = desk();
  c.state.active = { id, assignmentId, realCustomer: true };
  vi.mocked(sendChat)
    .mockRejectedValueOnce({ status: 503, message: 'Not confirmed' })
    .mockResolvedValueOnce({
      order_id: id,
      assignment_id: assignmentId,
      request_id: id,
      outcome: 'blocked',
      note: 'Blocked',
      message: null,
    });
  await c.sendChat('Hello');
  expect(c.state.chat).toEqual([]);
  expect(c.state.chatDraft).toBe('Hello');
  await c.sendChat('Hello');
  const calls = vi.mocked(sendChat).mock.calls;
  expect(calls[0]![3]).toEqual(calls[1]![3]);
  expect(calls[0]![2]).toBe('token');
  expect(calls[0]![3].assignment_id).toBe(assignmentId);
  expect(c.state.chat).toEqual([]);
  expect(c.state.chatWarn).toBe('Blocked');
  vi.mocked(setTyping).mockResolvedValueOnce(undefined);
  c.typingPing();
  expect(setTyping).toHaveBeenCalledWith(
    expect.any(Function),
    id,
    'token',
    assignmentId,
  );
});
it.each([401, 403, 404])(
  'revokes private assignment context on desk read %s',
  async (status) => {
    const c = desk();
    c.state.loaded = true;
    c.state.active = {
      id,
      assignmentId,
      game: 'lol',
      payout: 12.34,
      games: 2,
      customer: 'Private customer',
      ign: 'Private#IGN',
      realCustomer: true,
    };
    c.state.chat = [{ id: 'private', text: 'Private chat' }];
    c.state.chatDraft = 'Private draft';
    c.state.chatTyping = true;
    c.state.proof = [{ id: 'proof', data: 'private image' }];
    c.state.proofErr = 'Private proof error';
    c.state.proofDrag = true;
    c._pendingChat = { assignment_id: assignmentId, body: 'Private draft' };
    c._typedAt = Date.now();
    let resolve!: (value: Awaited<ReturnType<typeof readChat>>) => void;
    vi.mocked(readChat).mockImplementationOnce(
      () => new Promise((r) => (resolve = r)),
    );
    const staleChat = c.pollChat();
    c._fetch = vi.fn(async () =>
      Response.json({ error: 'denied' }, { status }),
    );
    await c.poll();
    expect(c.state.active).toBe(null);
    expect(c.state).toMatchObject({
      loaded: false,
      readError: true,
      queue: [],
      chat: [],
      chatDraft: '',
      chatTyping: false,
      proof: [],
      proofErr: '',
      proofDrag: false,
    });
    expect(c._pendingChat).toBe(null);
    expect(c._typedAt).toBe(0);
    resolve({ messages: [], typing: [], writable: true } as unknown as Awaited<
      ReturnType<typeof readChat>
    >);
    await staleChat;
    expect(c.state.chat).toEqual([]);
    const html = renderToStaticMarkup(c.render());
    for (const secret of [
      'Private customer',
      'Private#IGN',
      'Private chat',
      'Private draft',
      'Finish with proof',
    ])
      expect(html).not.toContain(secret);
    expect(c.state.notice).not.toContain('Completion recorded');
  },
);
it('loads the eligible server queue only while online without client game preferences', async () => {
  const c = desk();
  c.state.online = true;
  c._fetch = vi.fn(async () =>
    Response.json({ queue: [{ id, game: 'lol' }], mine: null }),
  );
  await c.poll();
  expect(c.state.queue).toHaveLength(1);
  expect(c.fits({ game: 'lol' })).toBe(true);
  expect(c.state.loaded).toBe(true);
  c._fetch = vi.fn(async () =>
    Response.json({ error: 'denied' }, { status: 403 }),
  );
  await c.poll();
  expect(c.state.queue).toEqual([]);
  expect(c.state.notice).toContain('access');
  expect(c.renderVals().waiting).toBe(false);
});

const tm = (n: number) => `7b000000-0000-4000-8000-00000000000${n}`;
const row = (n: number, points: number, extra = {}) => ({
  id: tm(n),
  name: 'Player ' + n,
  image: '',
  orders: points / 10,
  main: 'val',
  rating: null,
  fives: 0,
  points,
  ...extra,
});
it('shows the original leaderboard only after the server sends real periods, with the viewer row and points gap', () => {
  const c = desk();
  c.state.meId = tm(3);
  c.state.board = {};
  expect(c.renderVals().boardReady).toBe(false);
  const board = {
    week: {
      global: [
        row(1, 40, { rating: 4.67, fives: 2, orders: 3, main: 'lol' }),
        row(2, 20, { rating: 3 }),
        row(3, 10),
      ],
      val: [row(2, 20, { rating: 3 }), row(3, 10)],
    },
    month: { global: [] },
    all: { global: [] },
  };
  c.state.board = board;
  const v = c.renderVals();
  expect(v.boardReady).toBe(true);
  const html = renderToStaticMarkup(
    React.createElement(Leaderboard, {
      board: v.board,
      meId: v.meId,
      me: { name: 'Fabian', avatar: '/assets/avatars/avatar-4.png' },
    }),
  );
  expect(html).toContain('Duoly Leaderboard');
  expect(html).toContain(
    'Points: +10 per completed order, +5 for every five-star review.',
  );
  expect(html).toContain('Player 1');
  expect(html).toContain('★ 4.67');
  expect(html).toContain('★ New');
  // the viewer row uses the viewer's own name and picture
  expect(html).toContain('Fabian');
  expect(html).not.toContain('Player 3');
  expect(html).toContain('/assets/avatars/avatar-4.png');
  expect(html).toContain('pts</b> to pass');
  expect(html).not.toMatch(/[\u2013\u2014]/);
  const empty = renderToStaticMarkup(
    React.createElement(Leaderboard, {
      board: { ...board, week: { global: [] } },
      meId: tm(3),
      me: null,
    }),
  );
  expect(empty).toContain(
    'No completed orders this week yet. Complete one to take the top spot.',
  );
});
