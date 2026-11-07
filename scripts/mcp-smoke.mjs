#!/usr/bin/env node
/* global URL, fetch, AbortSignal, console */
import assert from 'node:assert/strict';
const base = new URL(process.argv[2] ?? 'http://localhost:4321');
const endpoint = new URL('/mcp?client=claude', base);
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
const calls = [
  ['list_games', {}],
  ['list_services', { game: 'lol' }],
  [
    'find_session',
    {
      game: 'lol',
      goal: 'ranked',
      rank: 'Gold',
      server: 'EUW',
      quantity: 3,
      currency: 'EUR',
    },
  ],
  [
    'get_quote',
    {
      game: 'lol',
      service: 'duo2',
      rank: 'Gold',
      quantity: 3,
      currency: 'EUR',
      server: 'EUW',
    },
  ],
  ['list_services', { game: 'val' }],
  [
    'find_session',
    {
      game: 'val',
      goal: 'coaching',
      budget: 15,
      currency: 'EUR',
      quantity: 1,
      server: 'EU',
    },
  ],
  [
    'get_quote',
    { game: 'val', service: 'vod', quantity: 1, currency: 'EUR', server: 'EU' },
  ],
  ['get_availability', { game: 'lol' }],
  ['create_booking_link', { game: 'val', service: 'vod' }],
];
for (const version of ['2025-06-18', '2025-11-25', '2026-07-28']) {
  if (version === '2026-07-28') await rpc('server/discover');
  else {
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
  }
  assert.equal((await rpc('tools/list', {}, version)).tools.length, 6);
  for (const [name, args] of calls) {
    const result = await rpc('tools/call', { name, arguments: args }, version);
    if (version === '2026-07-28') assert.equal(result.resultType, 'complete');
    assert.equal(result.content.length, 1);
    assert.ok(
      !result.content[0].text.includes(
        JSON.stringify(result.structuredContent),
      ),
    );
    assert.ok(Object.keys(result.structuredContent).length > 0);
    assert.ok(result.content[0].text.includes('agent=claude'));
    console.log(
      `${version} ${name} ${JSON.stringify(args)}\n${result.content[0].text}\n`,
    );
  }
  console.log(`${version}: discovery and all six tools OK`);
}
assert.equal((await fetch(endpoint)).status, 405);
console.log('GET 405 OK');
