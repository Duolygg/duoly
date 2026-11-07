import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
function view() {
  const sent: { id?: number; method: string; params: unknown }[] = [];
  const handlers: Record<string, (e: unknown) => void> = {};
  const app = {
    innerHTML: '',
    textContent: '',
    querySelector: () => null,
    getBoundingClientRect: () => ({ bottom: 500 }),
  };
  const parent = { postMessage: (m: (typeof sent)[number]) => sent.push(m) };
  const context = createContext({
    Intl,
    Date,
    window: {
      parent,
      addEventListener: (name: string, fn: (e: unknown) => void) => {
        handlers[name] = fn;
      },
    },
    document: { getElementById: () => app },
    ResizeObserver: class {
      observe() {}
    },
    setTimeout: () => 0,
    clearTimeout() {},
  });
  runInContext(
    readFileSync('src/server/mcp/order-card-view.js', 'utf8'),
    context,
  );
  return {
    app,
    sent,
    context,
    notify: (method: string, params: unknown) =>
      handlers.message?.({
        source: parent,
        data: { jsonrpc: '2.0', method, params },
      }),
  };
}
it('makes only one bounded read-only recovery call if the host strips metadata, never putting the code into DOM', async () => {
  const v = view();
  const token = 'dos_' + 'A'.repeat(43);
  v.notify('ui/notifications/tool-input', { arguments: { token } });
  v.notify('ui/notifications/tool-result', {
    content: [{ type: 'text', text: 'status' }],
  });
  await Promise.resolve();
  expect(v.sent.filter((m) => m.method === 'tools/call')).toEqual([
    expect.objectContaining({
      params: { name: 'get_order_status', arguments: { token } },
    }),
  ]);
  v.notify('ui/notifications/tool-result', { content: [] });
  await Promise.resolve();
  expect(v.sent.filter((m) => m.method === 'tools/call')).toHaveLength(1);
  expect(JSON.stringify(v.app)).not.toContain(token);
});
it('renders names as plain text, current tracker fill and honest snapshot time', () => {
  const v = view();
  v.context.payload = {
    _meta: {
      'gg.duoly/card': {
        status: 'in_progress',
        accepted: true,
        teammateDisplayName: '<img onerror="x">',
        gameName: 'Valorant',
        gameSlug: 'valorant',
        title: 'Duo Pro',
        quantity: { value: 3, unit: 'game' },
        rank: 'Gold',
        region: 'EU',
        paidEurMinor: 1617,
        team: null,
        bookedAt: '2026-11-07T10:00:00Z',
        searchingAt: '2026-11-07T10:00:00Z',
        acceptedAt: '2026-11-07T10:02:00Z',
        completedAt: null,
        updatedAt: '2026-11-07T10:03:00Z',
        nextStep: 'Open your Duoly order room to coordinate',
        roomUrl: 'https://duoly.gg/queue/00000000-0000-4000-8000-000000000001',
      },
    },
  };
  runInContext('render(payload)', v.context);
  expect(v.app.innerHTML).toContain('&lt;img onerror=&quot;x&quot;&gt;');
  expect(v.app.innerHTML).not.toContain('<img onerror');
  expect(v.app.innerHTML).toContain('Updated');
  expect(v.app.innerHTML).not.toContain('Live,');
  expect(v.app.innerHTML).toContain('66.66666666666666%');
  runInContext(
    "payload._meta['gg.duoly/card'].status='completed'; render(payload)",
    v.context,
  );
  expect(v.app.innerHTML.match(/class="st done"/g)).toHaveLength(4);
  expect(v.app.innerHTML).not.toContain('class="st now"');
});
