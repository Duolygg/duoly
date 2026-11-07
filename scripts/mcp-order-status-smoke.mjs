#!/usr/bin/env node
/* global console, fetch, document, window */
// Local-only fictional status fixtures. Never point this runner at a remote database.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { chromium } from '@playwright/test';
const out = `${homedir()}/.hermes/cache/scratch/mcp-cards/order`;
const base = process.env.ORDER_MCP_BASE ?? 'http://127.0.0.1:4396';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
const fixture = {
  status: 'queued',
  game: 'val',
  service: 'duo2',
  title: 'Duo Pro',
  quantity: { value: 3, unit: 'game' },
  rank: 'Gold',
  region: 'EU',
  paidEurMinor: 1617,
  accepted: false,
  teammateDisplayName: null,
  bookedAt: '2026-11-07T20:11:00Z',
  searchingAt: '2026-11-07T20:11:00Z',
  acceptedAt: null,
  completedAt: null,
  team: null,
  roomUrl: 'https://duoly.gg/queue/00000000-0000-4000-8000-000000000001',
};
const cases = ['searching', 'found', 'done', 'team'];
const tokens = cases.map(
  (_, i) => 'dos_' + String.fromCharCode(65 + i).repeat(42) + 'A',
);
const hash = (t) => createHash('sha256').update(t).digest('hex');
function projection(i) {
  const stamp = (ago) => new Date(Date.now() - ago * 1000).toISOString();
  const d = { ...fixture, bookedAt: stamp(104), searchingAt: stamp(104) };
  if (i === 1 || i === 2) {
    d.status = i === 2 ? 'completed' : 'in_progress';
    d.accepted = true;
    d.teammateDisplayName = 'Kairo';
    d.acceptedAt = stamp(60);
    if (i === 2) d.completedAt = stamp(5);
  }
  if (i === 3) {
    d.game = 'lol';
    d.title = 'Ranked 5s';
    d.service = 'ranked5';
    d.region = 'EUW';
    d.team = {
      status: 'waiting',
      seats: 5,
      filled: 3,
      startedAt: null,
      endedAt: null,
      members: ['Mira', 'Jinro', 'Sora', null, null].map((name, n) => ({
        name,
        status: name ? 'in_progress' : 'queued',
        thisSeat: n === 0,
      })),
    };
    d.status = 'in_progress';
    d.accepted = true;
    d.teammateDisplayName = 'Mira';
    d.acceptedAt = stamp(60);
  }
  return d;
}
if (process.argv.includes('--serve-fixtures')) {
  createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    let data = null;
    if (req.url === '/rest/v1/rpc/mcp_take_rate_limit')
      data = { allowed: true, retry_after: 0 };
    else if (req.url === '/rest/v1/rpc/mcp_order_status') {
      const i = tokens.findIndex((t) => hash(t) === body.p_token_hash);
      if (i >= 0) data = projection(i);
    }
    res
      .writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      })
      .end(JSON.stringify(data));
  }).listen(4497, '127.0.0.1');
  createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res
        .writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        })
        .end();
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = { ...req.headers };
    delete headers.origin;
    delete headers.host;
    for (const k of Object.keys(headers))
      if (k.startsWith('sec-fetch-')) delete headers[k];
    try {
      const r = await fetch(base + req.url, {
        method: req.method,
        headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      const h = { 'Access-Control-Allow-Origin': '*' };
      r.headers.forEach((v, k) => {
        if (!['content-encoding', 'transfer-encoding'].includes(k)) h[k] = v;
      });
      res.writeHead(r.status, h).end(Buffer.from(await r.arrayBuffer()));
    } catch {
      res.writeHead(503).end();
    }
  }).listen(8597, '127.0.0.1');
  console.log(
    'Local fictional RPC fixture :4497 and Origin-stripping proxy :8597 ready.',
  );
} else {
  await mkdir(out, { recursive: true });
  let id = 0;
  async function rpc(method, params = {}, version = '2025-11-25') {
    const modern = version === '2026-07-28';
    const r = await fetch(base + '/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': version,
        ...(modern
          ? {
              'Mcp-Method': method,
              ...(params.name || params.uri
                ? { 'Mcp-Name': params.name ?? params.uri }
                : {}),
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
                    name: 'order-status-smoke',
                    version: '1',
                  },
                  'io.modelcontextprotocol/clientCapabilities': {},
                },
              }
            : {}),
        },
      }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const json = await r.json();
    assert.equal(json.error, undefined);
    return json.result;
  }
  const captures = [];
  for (const version of ['2025-06-18', '2025-11-25', '2026-07-28']) {
    const list = await rpc('tools/list', {}, version);
    assert(
      list.tools.find((t) => t.name === 'get_order_status').annotations
        .readOnlyHint,
    );
    for (const [i, name] of cases.entries()) {
      const result = await rpc(
        'tools/call',
        { name: 'get_order_status', arguments: { token: tokens[i] } },
        version,
      );
      assert.equal(result.isError, undefined);
      assert.equal(result.content.length, 1);
      assert(result.structuredContent);
      assert(!JSON.stringify(result).includes(tokens[i]));
      captures.push({ version, name, result });
    }
    for (const token of ['bad', 'dos_' + 'E'.repeat(42) + 'A']) {
      const result = await rpc(
        'tools/call',
        { name: 'get_order_status', arguments: { token } },
        version,
      );
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent, undefined);
    }
  }
  await writeFile(
    `${out}/tool-results.json`,
    JSON.stringify(captures, null, 2),
  );
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    for (const width of [712, 390])
      for (const [i, name] of cases.entries()) {
        await page.setViewportSize({ width: width + 64, height: 1200 });
        await page.goto('http://localhost:8080/');
        await page
          .getByLabel('Tool', { exact: true })
          .selectOption('get_order_status');
        const field = page.locator('textarea');
        await field.fill(JSON.stringify({ token: tokens[i] }));
        await page.getByRole('button', { name: /call tool/i }).click();
        let frame;
        for (let n = 0; n < 100; n++) {
          for (const candidate of page.frames())
            if (
              candidate !== page.mainFrame() &&
              (await candidate.locator('.dw').count())
            ) {
              frame = candidate;
              break;
            }
          if (frame) break;
          await page.waitForTimeout(100);
        }
        assert(
          frame,
          'Official host double-iframe did not render the order card',
        );
        await frame.locator('.dw').waitFor();
        await frame.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(600);
        await page
          .locator('iframe')
          .first()
          .evaluate((el, w) => {
            el.style.width = w + 'px';
            el.style.maxWidth = 'none';
            el.style.boxSizing = 'content-box';
          }, width);
        await page.waitForTimeout(400);
        const metrics = await frame.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
          height: document.querySelector('.dw').getBoundingClientRect().height,
          viewport: window.innerHeight,
        }));
        assert.equal(metrics.client, width, JSON.stringify(metrics));
        assert(metrics.width <= metrics.client + 1, JSON.stringify(metrics));
        assert(metrics.height <= metrics.viewport + 2, JSON.stringify(metrics));
        await frame
          .locator('.dw')
          .screenshot({ path: `${out}/${name}-${width}.png` });
      }
  } finally {
    await browser.close();
  }
  console.log(
    'Order status HTTP: 3 revisions, 12 successes and 6 uniform refusals; official basic-host: 8 screenshots. Fictional storage fixtures, not SQL verification.',
  );
}
