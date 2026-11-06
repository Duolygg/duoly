#!/usr/bin/env node
/* global URL, fetch, AbortSignal, console */
import assert from 'node:assert/strict';
const base = new URL(process.argv[2] ?? 'http://localhost:4321');
const endpoint = new URL('/mcp', base);
let id = 0;
async function rpc(method, params = {}, version = '2026-07-28') {
  const modern = version === '2026-07-28';
  const response = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': version,
      ...(modern
        ? {
            'Mcp-Method': method,
            ...(params.name ? { 'Mcp-Name': params.name } : {}),
          }
        : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++id,
      method,
      params: {
        ...params,
        ...(modern
          ? {
              _meta: {
                'io.modelcontextprotocol/protocolVersion': version,
                'io.modelcontextprotocol/clientInfo': {
                  name: 'duoly-smoke',
                  version: '1.0.0',
                },
                'io.modelcontextprotocol/clientCapabilities': {},
              },
            }
          : {}),
      },
    }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(response.headers.get('Content-Type') ?? '', /application\/json/);
  const json = await response.json();
  assert.equal(json.error, undefined, JSON.stringify(json));
  assert.equal(json.result.isError, undefined, JSON.stringify(json));
  return json.result;
}
for (const version of ['2025-06-18', '2025-11-25']) {
  const init = await rpc(
    'initialize',
    {
      protocolVersion: version,
      capabilities: {},
      clientInfo: { name: 'duoly-smoke', version: '1.0.0' },
    },
    version,
  );
  assert.equal(init.protocolVersion, version);
  assert.equal((await rpc('tools/list', {}, version)).tools.length, 5);
  console.log(`${version}: initialize and tools/list OK`);
}
await rpc('server/discover');
assert.equal((await rpc('tools/list')).tools.length, 5);
for (const [name, args] of [
  ['list_games', {}],
  ['list_services', { game: 'val' }],
  [
    'get_quote',
    {
      game: 'val',
      service: 'duo2',
      rank: 'Platinum',
      quantity: 3,
      currency: 'EUR',
      server: 'EU',
    },
  ],
  ['get_availability', { game: 'val' }],
  ['create_booking_link', { game: 'val', service: 'vod' }],
]) {
  const result = await rpc('tools/call', { name, arguments: args });
  assert.equal(result.resultType, 'complete');
  assert.ok(result.structuredContent.url.startsWith('https://duoly.gg/'));
  console.log(`${name}: ${JSON.stringify(result.structuredContent)}`);
}
const get = await fetch(endpoint);
assert.equal(get.status, 405);
console.log('2026-07-28: discover, tools/list, all five tools and GET 405 OK');
