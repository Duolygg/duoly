import { expect, it } from 'vitest';
import { handleMcp } from '../../src/server/mcp/http';
it.each(['2025-06-18', '2025-11-25', '2026-07-28'])(
  'returns actionable errors without empty structuredContent on %s',
  async (version) => {
    const response = await handleMcp(
      new Request('https://duoly.gg/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': version,
          ...(version === '2026-07-28'
            ? { 'Mcp-Method': 'tools/call', 'Mcp-Name': 'get_quote' }
            : {}),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            ...(version === '2026-07-28'
              ? {
                  _meta: {
                    'io.modelcontextprotocol/protocolVersion': version,
                    'io.modelcontextprotocol/clientInfo': {
                      name: 'test',
                      version: '1',
                    },
                    'io.modelcontextprotocol/clientCapabilities': {},
                  },
                }
              : {}),
            name: 'get_quote',
            arguments: {
              game: 'lol',
              service: 'duo2',
              rank: 'Gold',
              server: 'EUW',
              quantity: 3,
            },
          },
        }),
      }),
      {
        ip: '127.0.0.1',
        limit: async () => ({ allowed: true, retryAfter: 0 }),
      },
    );
    const { result } = await response.json();
    expect(result.isError).toBe(true);
    expect(result).not.toHaveProperty('structuredContent');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toMatch(/currency.*EUR.*USD/);
    expect(result.content[0].text).toContain('Valid inputs:');
  },
);
