import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import ChatModeration, {
  ModerationPanel,
  readFlags,
  createModeration,
} from '../../src/components/admin/ChatModeration';
import type { ChatFlag } from '../../src/contracts/chat';

const flag: ChatFlag = {
  id: '00000000-0000-4000-8000-000000000001',
  order_id: '00000000-0000-4000-8000-000000000002',
  assignment_id: '00000000-0000-4000-8000-000000000003',
  sender_name: 'Player',
  body: '<script>private</script>',
  rule: 'Account access',
  status: 'open',
  warning_count: 2,
  created_at: '2026-10-23T10:00:00Z',
};
const json = (data: unknown) => new Response(JSON.stringify(data));

it('does not resolve optimistically; commits only a fresh list bound to flag identity and requested status', async () => {
  let finish!: (response: Response) => void;
  const warned = { ...flag, status: 'warned' as const, warning_count: 3 };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ flags: [flag] }))
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(json({ flags: [warned] }));
  const model = createModeration(fetcher, 'same-csrf', () => {});
  await model.refresh();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const pending = model.resolve(flag.id, 'warned');
  expect(model.snapshot().flags?.[0]?.status).toBe('open');
  expect(model.snapshot().busy).toBe(true);
  await model.resolve(flag.id, 'dismissed');
  expect(fetcher).toHaveBeenCalledTimes(2);
  finish(json({ flag: warned }));
  await pending;
  expect(model.snapshot().flags).toEqual([warned]);
  expect(fetcher.mock.calls[1]).toEqual([
    '/api/admin/chat-flags/' + flag.id,
    expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'same-csrf',
      },
      body: JSON.stringify({ status: 'warned' }),
    }),
  ]);
  expect(fetcher.mock.calls[2]?.[1]?.method).toBe('GET');
});

it.each([
  'wrong-id',
  'wrong-status',
  'wrong-order',
  'stale-list',
  'missing-list',
])('preserves confirmed flags when resolution returns %s', async (failure) => {
  const warned = { ...flag, status: 'warned' as const };
  const result =
    failure === 'wrong-id'
      ? { ...warned, id: flag.assignment_id }
      : failure === 'wrong-status'
        ? { ...warned, status: 'dismissed' }
        : failure === 'wrong-order'
          ? { ...warned, order_id: flag.assignment_id }
          : warned;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ flags: [flag] }))
    .mockResolvedValueOnce(json({ flag: result }))
    .mockResolvedValueOnce(
      json({ flags: failure === 'missing-list' ? [] : [flag] }),
    );
  const model = createModeration(fetcher, 'csrf', () => {});
  await model.refresh();
  await model.resolve(flag.id, 'warned');
  expect(model.snapshot().flags).toEqual([flag]);
  expect(model.snapshot().notice).toContain('not confirmed');
  expect(model.snapshot().busy).toBe(false);
});

it.each([401, 403, 404])(
  'clears private flags and investigation on %s and prevents further actions',
  async (status) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ flags: [flag] }))
      .mockResolvedValueOnce(new Response('', { status }));
    const model = createModeration(fetcher, 'csrf', () => {});
    await model.refresh();
    model.select(flag.id);
    expect(model.snapshot().selected).toEqual(flag);
    await model.resolve(flag.id, 'warned');
    expect(model.snapshot()).toMatchObject({
      flags: null,
      selected: null,
      denied: true,
      busy: false,
    });
    await model.refresh();
    await model.resolve(flag.id, 'dismissed');
    model.select(flag.id);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(model.snapshot().selected).toBeNull();
  },
);

it('denial from a conversation invalidates an in-flight successful list response', async () => {
  let finish!: (response: Response) => void;
  const model = createModeration(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    'csrf',
    () => {},
  );
  const pending = model.refresh();
  model.deny();
  finish(json({ flags: [flag] }));
  await pending;
  expect(model.snapshot()).toMatchObject({
    flags: null,
    selected: null,
    denied: true,
  });
});

it('does not issue a follow-up private read when denied during an in-flight POST', async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ flags: [flag] }))
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(json({ flags: [{ ...flag, status: 'warned' }] }));
  const model = createModeration(fetcher, 'csrf', () => {});
  await model.refresh();
  const pending = model.resolve(flag.id, 'warned');
  model.deny();
  finish(json({ flag: { ...flag, status: 'warned' } }));
  await pending;
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(model.snapshot().flags).toBeNull();
});

it('preserves selected investigation and confirmed flags on transient errors; disposed work cannot publish', async () => {
  const changed = vi.fn();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ flags: [flag] }))
    .mockRejectedValueOnce(new Error('offline'));
  const model = createModeration(fetcher, 'csrf', changed);
  await model.refresh();
  model.select(flag.id);
  await model.refresh();
  expect(model.snapshot()).toMatchObject({
    flags: [flag],
    selected: flag,
    denied: false,
  });
  model.dispose();
  changed.mockClear();
  await model.refresh();
  expect(changed).not.toHaveBeenCalled();
});

it('never posts for missing CSRF, unknown flags or previously resolved flags', async () => {
  for (const [csrf, source] of [
    ['', flag],
    ['csrf', { ...flag, status: 'warned' }],
  ] as const) {
    const fetcher = vi.fn(async () => json({ flags: [source] }));
    const model = createModeration(fetcher, csrf, () => {});
    await model.refresh();
    await model.resolve(flag.id, 'warned');
    await model.resolve(flag.assignment_id, 'dismissed');
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});

it('loads only validated bounded private flags using same-origin no-store GET', async () => {
  const fetcher = vi.fn(async () => json({ flags: [flag] }));
  expect(await readFlags(fetcher)).toEqual([flag]);
  expect(fetcher).toHaveBeenCalledWith(
    '/api/admin/chat-flags',
    expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    }),
  );
  await expect(
    readFlags(async () => json({ flags: Array(51).fill(flag) })),
  ).rejects.toThrow();
  await expect(
    readFlags(async () => json({ flags: [{ ...flag, email: 'secret' }] })),
  ).rejects.toThrow();
});

it('renders escaped real flags, source/status/warnings and disabled pending actions without a composer', () => {
  const model = createModeration(
    async () => json({ flags: [] }),
    'csrf',
    () => {},
  );
  const html = renderToStaticMarkup(
    createElement(ModerationPanel, {
      state: { ...model.snapshot(), flags: [flag], busy: true },
      canResolve: true,
    }),
  );
  expect(html).toContain('&lt;script&gt;private&lt;/script&gt;');
  expect(html).toContain('Account access');
  expect(html).toContain('open');
  expect(html).toContain('Warnings: 2');
  expect(html).toContain(flag.order_id);
  expect(html).toContain(flag.assignment_id);
  expect(html).toContain('Up to 50');
  expect(html).toContain('Warned');
  expect(html).toContain('Dismissed');
  expect(html).toContain('disabled');
  expect(html).not.toMatch(/<script>|<textarea|<form|Send message/);
});

it('never renders stale private state after denial, and distinguishes a real empty list from load failure', () => {
  const model = createModeration(
    async () => json({ flags: [] }),
    'csrf',
    () => {},
  );
  const render = (patch: object) =>
    renderToStaticMarkup(
      createElement(ModerationPanel, {
        state: { ...model.snapshot(), ...patch },
        canResolve: true,
      }),
    );
  const denied = render({
    flags: [flag],
    selected: flag,
    denied: true,
    notice: 'Access denied',
  });
  expect(denied).not.toMatch(/Player|private&lt;|Warnings:|Warned|Dismissed/);
  expect(denied).toContain('disabled');
  expect(render({ flags: null, notice: 'Unavailable' })).not.toContain(
    'No flagged messages',
  );
  expect(render({ flags: [] })).toContain('No flagged messages');
});

it('wires chat safety into the current admin shell behind SSR role denial and the false-default flag', () => {
  const route = readFileSync(
    new URL('../../src/pages/admin/[...section].astro', import.meta.url),
    'utf8',
  );
  const shell = readFileSync(
    new URL('../../src/components/admin/AdminApp.jsx', import.meta.url),
    'utf8',
  );
  expect(route).toContain("from '../../server/chat/config'");
  expect(route).toContain('chatEnabled={orderChatEnabled()}');
  expect(route).toContain('csrf={csrf}');
  expect(route.indexOf("identity?.viewer.role !== 'admin'")).toBeLessThan(
    route.indexOf('<AdminApp'),
  );
  expect(shell).toContain("s.section === 'safety' && this.props.chatEnabled");
  expect(shell).toContain('<ChatModeration csrf={this.props.csrf}');
});

it('SSR exposes only a loading shell without flags, credentials or fabricated counts', () => {
  const html = renderToStaticMarkup(
    createElement(ChatModeration, { csrf: 'secret-csrf' }),
  );
  expect(html).toContain('Loading flagged messages');
  expect(html).not.toMatch(/secret-csrf|Player|No flagged messages|0 flags/);
});
