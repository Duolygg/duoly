import { describe, expect, it, vi } from 'vitest';
const track = vi.hoisted(() => vi.fn());
vi.mock('../../src/server/analytics/client', () => ({
  serverTrack: track,
  flushAnalytics: vi.fn(),
}));
import { handleMcp } from '../../src/server/mcp/http';
describe('MCP server analytics', () => {
  it('derives modern client platform and emits only a personless tool fact', async () => {
    const request = new Request('https://duoly.gg/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': 'tools/call',
        'Mcp-Name': 'create_booking_link',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'create_booking_link',
          arguments: { game: 'val', service: 'vod' },
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientInfo': {
              name: 'Claude',
              version: '1',
            },
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        },
      }),
    });
    const response = await handleMcp(request, {
      ip: '127.0.0.1',
      limit: async () => ({ allowed: true, retryAfter: 0 }),
    });
    const json = await response.json();
    expect(json.result.structuredContent.bookUrl).toContain('agent=claude');
    expect(track).toHaveBeenCalledWith({
      event: 'agent_tool_called',
      userId: null,
      consent: null,
      properties: { tool: 'create_booking_link', platform: 'claude' },
    });
  });
});
