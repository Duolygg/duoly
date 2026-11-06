import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rateLimit } from '../../src/server/mcp/limits';
import { handleMcp } from '../../src/server/mcp/http';
import * as live from '../../src/server/home/live';
import { ALL } from '../../src/pages/mcp';
const rpc = vi.fn();
const allow = async () => ({ allowed: true, retryAfter: 0 });
const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://duoly.gg/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(JSON.stringify(body).includes('2026-07-28')
        ? {
            'MCP-Protocol-Version': '2026-07-28',
            'Mcp-Method': (body as { method: string }).method,
            ...((body as { params?: { name?: string } }).params?.name
              ? {
                  'Mcp-Name': (body as { params: { name: string } }).params
                    .name,
                }
              : {}),
          }
        : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
const legacy = (method: string, params: unknown = {}) => ({
  jsonrpc: '2.0',
  id: 1,
  method,
  params,
});
const modern = (method: string, params: Record<string, unknown> = {}) =>
  legacy(method, {
    ...params,
    _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' },
      'io.modelcontextprotocol/clientCapabilities': {},
    },
  });
describe('MCP HTTP', () => {
  beforeEach(() => rpc.mockReset());
  it('does not expose unexpected dependency errors in tool responses', async () => {
    const mock = vi.spyOn(live, 'homeLive').mockImplementation(async () => {
      throw new Error('database password=secret 203.0.113.1');
    });
    try {
      const response = await handleMcp(
        request(
          legacy('tools/call', { name: 'get_availability', arguments: {} }),
        ),
        { ip: '127.0.0.1', limit: allow },
      );
      const json = await response.json();
      expect(json.result.isError).toBe(true);
      expect(JSON.stringify(json)).not.toMatch(/password|secret|203\.0\.113/);
    } finally {
      mock.mockRestore();
    }
  });
  it('exports a real Astro route', () => expect(ALL).toBeTypeOf('function'));
  it.each(['2025-11-25', '2025-06-18'])(
    'initializes legacy %s and lists tools as JSON',
    async (protocolVersion) => {
      const init = await handleMcp(
        request(
          legacy('initialize', {
            protocolVersion,
            capabilities: {},
            clientInfo: { name: 'claude', version: '1' },
          }),
        ),
        { ip: '127.0.0.1', limit: allow },
      );
      expect(init.headers.get('content-type')).toContain('application/json');
      expect((await init.json()).result.protocolVersion).toBe(protocolVersion);
      const list = await handleMcp(
        request(legacy('tools/list'), {
          'MCP-Protocol-Version': protocolVersion,
        }),
        { ip: '127.0.0.1', limit: allow },
      );
      const json = await list.json();
      expect(json.result.tools).toHaveLength(5);
      expect(
        json.result.tools.every(
          (t: {
            annotations: { readOnlyHint: boolean; openWorldHint: boolean };
            outputSchema: unknown;
          }) =>
            t.annotations.readOnlyHint &&
            !t.annotations.openWorldHint &&
            t.outputSchema,
        ),
      ).toBe(true);
    },
  );
  it('serves modern discover and tool calls without initialize', async () => {
    const discover = await handleMcp(request(modern('server/discover')), {
      ip: '127.0.0.1',
      limit: allow,
    });
    expect(discover.status, await discover.clone().text()).toBe(200);
    expect((await discover.json()).error).toBeUndefined();
    const response = await handleMcp(
      request(modern('tools/call', { name: 'list_games', arguments: {} })),
      { ip: '127.0.0.1', limit: allow },
    );
    const json = await response.json();
    expect(json.result.structuredContent.games).toHaveLength(15);
    expect(json.result.resultType).toBe('complete');
  });
  it('calls legacy tools without a session', async () => {
    const response = await handleMcp(
      request(
        legacy('tools/call', {
          name: 'create_booking_link',
          arguments: { game: 'val', service: 'vod' },
        }),
      ),
      { ip: '127.0.0.1', limit: allow },
    );
    expect((await response.json()).result.structuredContent.bookUrl).toContain(
      'game=val',
    );
  });
  it('rejects untrusted and null origins and allows absent Origin', async () => {
    for (const origin of [
      '',
      'https://evil.example',
      'null',
      'https://duoly.gg.evil.example',
    ]) {
      expect(
        (
          await handleMcp(request(legacy('tools/list'), { Origin: origin }), {
            ip: '127.0.0.1',
            limit: allow,
          })
        ).status,
      ).toBe(403);
    }
    const ok = await handleMcp(
      request(legacy('tools/list'), { Origin: 'https://duoly.gg' }),
      { ip: '127.0.0.1', limit: allow },
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get('access-control-allow-origin')).toBe(
      'https://duoly.gg',
    );
  });
  it('returns GET 405 and bounds input bytes', async () => {
    expect(
      (
        await handleMcp(new Request('https://duoly.gg/mcp'), {
          ip: '127.0.0.1',
          limit: allow,
        })
      ).status,
    ).toBe(405);
    expect(
      (
        await handleMcp(
          request(legacy('tools/call', { text: 'a'.repeat(17000) })),
          { ip: '127.0.0.1', limit: allow },
        )
      ).status,
    ).toBe(413);
  });
  it('returns retry guidance and original RPC id on quota rejection', async () => {
    const response = await handleMcp(request(legacy('tools/list')), {
      ip: '127.0.0.1',
      limit: async () => ({ allowed: false, retryAfter: 42 }),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    expect(await response.json()).toMatchObject({
      id: 1,
      error: { code: -32029, data: { retryAfterSeconds: 42 } },
    });
  });
  it('fails closed when durable storage is unavailable', async () => {
    const response = await handleMcp(request(legacy('tools/list')), {
      ip: '127.0.0.1',
      limit: async () => {
        throw Error('secret');
      },
    });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret');
  });
  it('keeps public tools available under a small process-wide cap on RPC outage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unavailable = async () => {
      throw new Error('secret database details');
    };
    try {
      for (let i = 0; i < 30; i++)
        expect(
          await rateLimit('203.0.113.8', unavailable, 'a'.repeat(32)),
        ).toEqual({ allowed: true, retryAfter: 0 });
      expect(
        await rateLimit('203.0.113.9', unavailable, 'a'.repeat(32)),
      ).toEqual({ allowed: false, retryAfter: 60 });
      expect(warning).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(warning.mock.calls)).not.toMatch(
        /secret|203\.0\.113/,
      );
      vi.advanceTimersByTime(60000);
      expect(
        (await rateLimit('203.0.113.8', unavailable, 'a'.repeat(32))).allowed,
      ).toBe(true);
    } finally {
      warning.mockRestore();
      vi.useRealTimers();
    }
  });
  it('uses one durable RPC with a secret hashed key and validates its response', async () => {
    rpc.mockResolvedValue({
      data: { allowed: false, retry_after: 60 },
      error: null,
    });
    expect(await rateLimit('203.0.113.7', rpc, 'a'.repeat(32))).toEqual({
      allowed: false,
      retryAfter: 60,
    });
    expect(rpc).toHaveBeenCalledWith('mcp_take_rate_limit', {
      p_key: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('203.0.113.7');
    rpc.mockResolvedValue({ data: null, error: { message: 'db' } });
    expect((await rateLimit('203.0.113.7', rpc, 'a'.repeat(32))).allowed).toBe(
      true,
    );
  });
});
