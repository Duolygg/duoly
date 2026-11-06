import { describe, expect, it, vi } from 'vitest';
import { serverCatalogueProps } from '../../src/contracts/analytics-events';
import { platformOf } from '../../src/server/mcp/tools';
import { rateLimit } from '../../src/server/mcp/limits';
describe('MCP privacy and limits', () => {
  it.each([
    ['Claude Desktop', 'claude'],
    ['ChatGPT', 'chatgpt'],
    ['Gemini', 'gemini'],
    ['Perplexity', 'perplexity'],
    ['Mistral', 'mistral'],
    ['untrusted-client', 'other'],
  ])('normalizes claimed platform %s', (name, platform) =>
    expect(platformOf(name!)).toBe(platform),
  );
  it('drops identities and arbitrary tool or platform properties', () => {
    expect(
      serverCatalogueProps('agent_tool_called', {
        tool: 'get_quote',
        platform: 'claude',
        ip: '1.2.3.4',
        email: 'user@example.com',
        arguments: { ign: 'private' },
      }),
    ).toEqual({ tool: 'get_quote', platform: 'claude' });
    expect(
      serverCatalogueProps('agent_tool_called', {
        tool: 'admin_delete',
        platform: 'injected',
      }),
    ).toEqual({});
  });
  it('shares minute and daily quota outcomes from durable storage', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: { allowed: true, retry_after: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { allowed: false, retry_after: 86400 },
        error: null,
      });
    expect(await rateLimit('203.0.113.1', rpc, 'x'.repeat(32))).toEqual({
      allowed: true,
      retryAfter: 0,
    });
    expect(await rateLimit('203.0.113.1', rpc, 'x'.repeat(32))).toEqual({
      allowed: false,
      retryAfter: 86400,
    });
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });
  it('requires a secret and valid adapter IP before calling storage', async () => {
    const rpc = vi.fn();
    await expect(rateLimit('203.0.113.1', rpc, '')).rejects.toThrow();
    await expect(rateLimit('spoofed', rpc, 'x'.repeat(32))).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
