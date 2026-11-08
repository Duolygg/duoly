import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { handleMcp } from '../../src/server/mcp/http';
import { callTool } from '../../src/server/mcp/tools';

async function rpc(method: string, params = {}) {
  const response = await handleMcp(
    new Request('https://duoly.gg/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2025-11-25',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
    { ip: '127.0.0.1', limit: async () => ({ allowed: true, retryAfter: 0 }) },
  );
  return (await response.json()).result;
}
it('advertises and serves card resources with restricted CSP', async () => {
  const { tools } = await rpc('tools/list');
  const { resources } = await rpc('resources/list');
  expect(resources).toHaveLength(4);
  for (const resource of resources) {
    expect(resource.mimeType).toBe('text/html;profile=mcp-app');
    expect(resource._meta.ui.csp.resourceDomains).toEqual(['https://duoly.gg']);
  }
  for (const name of ['find_session', 'list_games', 'create_booking_link']) {
    const tool = tools.find((t: { name: string }) => t.name === name);
    expect(tool._meta.ui.resourceUri).toMatch(/^ui:\/\/duoly\//);
    expect(tool.annotations.readOnlyHint).toBe(true);
    const { contents } = await rpc('resources/read', {
      uri: tool._meta.ui.resourceUri,
    });
    expect(contents[0].mimeType).toBe('text/html;profile=mcp-app');
    expect(contents[0]._meta.ui.csp.resourceDomains).toEqual([
      'https://duoly.gg',
    ]);
    expect(contents[0]._meta.ui).not.toHaveProperty('domain');
    expect(contents[0].text).toContain('ui/initialize');
    expect(contents[0].text).not.toMatch(/[\u2013\u2014]| & /);
  }
});
function view(payload: unknown) {
  const app = { innerHTML: '', addEventListener() {} };
  const context = createContext({
    payload,
    URL,
    Intl,
    window: { parent: { postMessage() {} }, addEventListener() {} },
    document: {
      getElementById: () => app,
      documentElement: { scrollHeight: 0 },
    },
    ResizeObserver: class {
      observe() {}
    },
    setTimeout: () => 0,
    clearTimeout() {},
  });
  runInContext(readFileSync('src/server/mcp/card-view.js', 'utf8'), context);
  runInContext('receive(payload)', context);
  return { app, context };
}
const fx = async () => ({
  rate: 1.08,
  source: 'fallback' as const,
  date: '2026-11-06',
  fetchedAt: 0,
});
it.each(['EUR', 'USD'] as const)(
  'uses server-exact %s totals in the actual view JS for every rank, tier and pack in two games',
  async (currency) => {
    let combinations = 0;
    for (const game of ['val', 'lol']) {
      const result = await callTool(
        'find_session',
        { game, goal: 'ranked', currency },
        { fx },
      );
      const { context } = view(result);
      for (const option of result._meta!['gg.duoly/card'].options) {
        for (const rank of option.ranks) {
          for (const quantity of [1, 2, 3, 4, 5]) {
            context.selection = { rank, quantity };
            context.option = option;
            const actual = runInContext(
              'state = selection; price(option)[0]',
              context,
            );
            const quote = await callTool(
              'get_quote',
              {
                game,
                service: option.id,
                rank,
                quantity,
                currency,
                server: option.regions[0],
              },
              { fx },
            );
            expect(actual).toBe(quote.structuredContent.amountMinor);
            combinations++;
          }
        }
      }
    }
    expect(combinations).toBe(285);
  },
);
it('renders from view-only metadata without a text payload', async () => {
  const result = await callTool(
    'find_session',
    { game: 'val', goal: 'ranked', rank: 'Gold', region: 'EU', quantity: 3 },
    { fx },
  );
  const { app } = view({ _meta: result._meta });
  expect(app.innerHTML).toContain('Duo Plus');
  expect(app.innerHTML).toContain('Book on Duoly');
  expect(app.innerHTML).not.toMatch(
    /online|4 min|rating|reviews|[\u2013\u2014]| & /,
  );
  expect(result.content).toHaveLength(1);
  expect(result.content[0]!.text).not.toContain(
    JSON.stringify(result.structuredContent),
  );
});
it('keeps missing setup explicit and handles empty budget results', async () => {
  const missing = await callTool(
    'find_session',
    { game: 'val', goal: 'ranked' },
    { fx },
  );
  const { app } = view(missing);
  expect(app.innerHTML).toContain('Choose rank');
  expect(app.innerHTML).toContain('Choose region');
  expect(app.innerHTML).toContain('From');
  const none = await callTool(
    'find_session',
    { game: 'val', goal: 'coaching', budget: 1, currency: 'EUR' },
    { fx },
  );
  expect(view(none).app.innerHTML).toContain('No sessions fit this budget');
});
it('hides zero online counts rather than inventing availability', async () => {
  const result = await callTool(
    'find_session',
    { game: 'val', goal: 'ranked' },
    { fx },
  );
  result._meta!['gg.duoly/card'].data.online = 0;
  expect(view(result).app.innerHTML).not.toMatch(/online|nobody|4 min/);
});
it.each([
  { game: 'val', service: 'duo2', rank: 'gold' },
  { game: 'val', service: 'duo2', region: 'Europe' },
  { game: 'val', service: 'duo2', quantity: 11 },
])('rejects unsupported booking selections %j', async (args) => {
  await expect(callTool('create_booking_link', args)).rejects.toThrow();
});
it('labels coaching totals and includes budget, descriptions and a checklist', async () => {
  const result = await callTool(
    'find_session',
    {
      game: 'val',
      goal: 'coaching',
      budget: 15,
      currency: 'EUR',
      quantity: 1,
      region: 'EU',
    },
    { fx },
  );
  const { app, context } = view(result);
  expect(app.innerHTML).toContain('Your budget');
  expect(app.innerHTML).toContain('What is included');
  expect(app.innerHTML).toContain('<ul');
  expect(app.innerHTML).toContain('class="radio"');
  expect(app.innerHTML).not.toContain('per hour');
  expect(app.innerHTML).not.toContain('Review remaining options');
  runInContext("state.service = 'aim'; render()", context);
  expect(app.innerHTML).toContain('Total · 1 hour');
});
it('reports document scroll height rather than only the app rectangle', () => {
  const { context } = view({ isError: true });
  context.document.documentElement = { scrollHeight: 987 };
  expect(runInContext('measureSize().height', context)).toBe(987);
});
it('preserves chosen selections in booking links', async () => {
  const result = await callTool(
    'create_booking_link',
    { game: 'val', service: 'duo2', rank: 'Gold', region: 'EU', quantity: 3 },
    { platform: 'claude' },
  );
  const url = new URL(String(result.structuredContent.bookUrl));
  expect(Object.fromEntries(url.searchParams)).toEqual({
    game: 'val',
    service: 'duo2',
    agent: 'claude',
    rank: 'Gold',
    region: 'EU',
    qty: '3',
  });
});
