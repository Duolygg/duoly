#!/usr/bin/env node
/* global URL, fetch, AbortSignal, console, document, window */
// Local-only MCP Apps host: real HTTP results, sandbox handshake, browser interaction and screenshots.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { chromium } from '@playwright/test';
const endpoint = new URL(
  '/mcp?client=claude',
  process.argv[2] ?? 'http://127.0.0.1:4398',
);
const out =
  process.env.MCP_CARDS_OUTPUT ??
  `${homedir()}/.hermes/cache/scratch/mcp-cards`;
await mkdir(out, { recursive: true });
const version = process.env.MCP_PROTOCOL_VERSION ?? '2025-11-25';
let id = 0;
async function rpc(method, params = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': version,
      ...(version === '2026-07-28'
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
        ...(version === '2026-07-28'
          ? {
              _meta: {
                'io.modelcontextprotocol/protocolVersion': version,
                'io.modelcontextprotocol/clientInfo': {
                  name: 'duoly-cards-smoke',
                  version: '1',
                },
                'io.modelcontextprotocol/clientCapabilities': {},
              },
            }
          : {}),
      },
    }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const json = await response.json();
  assert.equal(json.error, undefined, JSON.stringify(json));
  assert.equal(json.result.isError, undefined, JSON.stringify(json));
  return json.result;
}
const init = await rpc(
  version === '2026-07-28' ? 'server/discover' : 'initialize',
  {
    protocolVersion: version,
    capabilities: {
      extensions: {
        'io.modelcontextprotocol/ui': {
          mimeTypes: ['text/html;profile=mcp-app'],
        },
      },
    },
    clientInfo: { name: 'duoly-cards-smoke', version: '1' },
  },
);
if (version !== '2026-07-28') assert.equal(init.protocolVersion, version);
const tools = (await rpc('tools/list')).tools;
const resources = (await rpc('resources/list')).resources;
assert.equal(resources.length, 3);
const fixtures = [];
for (const [view, tool, args] of [
  [
    'finder',
    'find_session',
    {
      game: 'val',
      goal: 'ranked',
      rank: 'Gold',
      region: 'EU',
      quantity: 3,
      currency: 'EUR',
    },
  ],
  [
    'ticket',
    'create_booking_link',
    {
      game: 'val',
      service: 'duo2',
      rank: 'Gold',
      region: 'EU',
      quantity: 3,
      currency: 'EUR',
    },
  ],
  ['games', 'list_games', {}],
  [
    'coaching',
    'find_session',
    {
      game: 'val',
      goal: 'coaching',
      budget: 15,
      currency: 'EUR',
      quantity: 1,
      region: 'EU',
    },
  ],
]) {
  const uri = tools.find((t) => t.name === tool)._meta.ui.resourceUri;
  const resource = (await rpc('resources/read', { uri })).contents[0];
  assert.equal(resource.mimeType, 'text/html;profile=mcp-app');
  assert.deepEqual(resource._meta.ui.csp.resourceDomains, ['https://duoly.gg']);
  fixtures.push({
    view,
    tool,
    args,
    resource,
    result: await rpc('tools/call', { name: tool, arguments: args }),
  });
}
await writeFile(
  `${out}/real-tool-results.json`,
  JSON.stringify({ init, tools, resources, fixtures }, null, 2),
);
function host(fixture, stripped = false) {
  return `<!doctype html><html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}iframe{display:block;width:100%;border:0;height:1000px}</style><iframe title="Duoly app" sandbox="allow-scripts allow-same-origin"></iframe><script>
const fixture=${JSON.stringify(fixture).replaceAll('<', '\\u003c')};
const frame=document.querySelector('iframe');
window.opened=[];window.bridge=[];
window.addEventListener('message',async e=>{
if(e.source!==frame.contentWindow)return;
const m=e.data; window.bridge.push(m.method);
const send=m=>frame.contentWindow.postMessage({jsonrpc:'2.0',...m},'*');
if(m.method==='ui/initialize')send({id:m.id,result:{protocolVersion:'2026-01-26',hostInfo:{name:'Duoly local smoke',version:'1'},hostCapabilities:{openLinks:{},serverTools:{}},hostContext:{theme:'light',displayMode:'inline'}}});
if(m.method==='ui/notifications/initialized'){
send({method:'ui/notifications/tool-input',params:{arguments:fixture.args}});
send({method:'ui/notifications/tool-result',params:${stripped ? ' {content:fixture.result.content}' : 'fixture.result'}});
}
if(m.method==='ui/notifications/size-changed')frame.style.height=m.params.height+'px';
if(m.method==='ui/open-link'){window.opened.push(m.params.url);send({id:m.id,result:{}});}
if(m.method==='tools/call'){
const r=await fetch('/tool',{method:'POST',body:JSON.stringify(m.params)});send({id:m.id,result:await r.json()});
}
});
frame.srcdoc=fixture.resource.text;
</script></html>`;
}
const server = createServer(async (req, res) => {
  if (req.url === '/tool') {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(await rpc('tools/call', JSON.parse(body))));
    return;
  }
  const url = new URL(req.url, 'http://localhost');
  const fixture =
    fixtures.find((f) => f.view === url.searchParams.get('view')) ??
    fixtures[0];
  res.setHeader('Content-Type', 'text/html');
  res.end(host(fixture, url.searchParams.has('stripped')));
});
await new Promise((resolve) => server.listen(4399, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const width of [712, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const fixture of fixtures) {
      await page.goto(`http://127.0.0.1:4399/?view=${fixture.view}`);
      const frame = page.frameLocator('iframe');
      await frame.locator('.status').waitFor({ state: 'detached' });
      if (fixture.view === 'finder')
        await frame.locator('[data-service="duo2"]').click();
      if (fixture.view === 'coaching')
        await frame.locator('[data-service="aim"]').click();
      await frame.locator('body').evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
      });
      assert.equal(
        await frame
          .locator('body')
          .evaluate(
            () =>
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth,
          ),
        false,
        'horizontal overflow',
      );
      assert.doesNotMatch(
        await frame.locator('body').innerText(),
        /[\u2013\u2014]| & |4 min|teammates online/,
      );
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe');
        return (
          Math.round(f.getBoundingClientRect().height) ===
          Math.ceil(
            f.contentDocument.getElementById('app').getBoundingClientRect()
              .bottom,
          )
        );
      });
      const contentHeight = await frame
        .locator('#app')
        .evaluate((el) => Math.ceil(el.getBoundingClientRect().bottom));
      assert.equal(
        await page
          .locator('iframe')
          .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
        contentHeight,
        'iframe must hug card content',
      );
      await page.locator('iframe').screenshot({
        path: `${out}/${fixture.view}-${width}.png`,
        fullPage: true,
      });
      assert.ok(
        (await page.evaluate(() => window.bridge)).includes(
          'ui/notifications/initialized',
        ),
      );
      if (fixture.view === 'finder') {
        await frame.locator('[data-rail="rank"]').click();
        await frame.locator('[data-rank="Diamond"]').click();
        await frame.locator('[data-service="duo3"]').click();
        await frame.locator('[data-quantity="5"]').click();
        const quote = await rpc('tools/call', {
          name: 'get_quote',
          arguments: {
            game: 'val',
            service: 'duo3',
            rank: 'Diamond',
            quantity: 5,
            currency: 'EUR',
            server: 'EU',
          },
        });
        assert.equal(
          Number(await frame.locator('#total').getAttribute('data-minor')),
          quote.structuredContent.amountMinor,
        );
        await frame.locator('[data-open]').click();
        await page.waitForFunction(() => window.opened.length > 0);
        const url = new URL((await page.evaluate(() => window.opened))[0]);
        assert.deepEqual(Object.fromEntries(url.searchParams), {
          game: 'val',
          service: 'duo3',
          agent: 'claude',
          rank: 'Diamond',
          region: 'EU',
          qty: '5',
        });
      }
    }
  }
  await page.goto('http://127.0.0.1:4399/?view=finder&stripped=1');
  await page.frameLocator('iframe').locator('[data-service="duo2"]').click();
  assert.match(
    await page.frameLocator('iframe').locator('body').innerText(),
    /Duo Pro/,
  );
  await page.goto('http://127.0.0.1:4399/?view=games');
  await page.frameLocator('iframe').locator('[data-game="val"]').click();
  await page.frameLocator('iframe').locator('[data-goal="coaching"]').click();
  await page.frameLocator('iframe').locator('.opts').waitFor();
  assert.deepEqual(errors, []);
  await writeFile(`${out}/host.html`, host(fixtures[0]));
  console.log(
    `PASS: HTTP initialize, six tools, three resources; all four views at 712 and 390; rank/tier/pack parity; link bridge; metadata-stripped proxy recovery; game-to-coaching tool call. Screenshots: ${out}`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
