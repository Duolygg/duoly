import { describe, expect, it } from 'vitest';
import { AI_ASSISTANTS, MCP } from '../../src/site/ai';
import { CONTENT_DATES, INDEXABLE_PATHS } from '../../src/site/seo';

describe('AI page public contract', () => {
  it('keeps the endpoint, tools and rollout states explicit', () => {
    expect(MCP.endpoint).toBe('https://duoly.gg/mcp');
    expect(MCP.tools.map((tool) => tool.name)).toEqual([
      'list_games',
      'list_services',
      'get_quote',
      'get_availability',
      'create_booking_link',
    ]);
    expect(MCP.rateLimits).toEqual({ minute: 60, day: 2000 });
    expect(AI_ASSISTANTS).toHaveLength(5);
    expect(
      AI_ASSISTANTS.find((assistant) => assistant.name === 'Claude')?.status,
    ).toBe('Coming soon');
    expect(
      AI_ASSISTANTS.every((assistant) => assistant.status === 'Coming soon'),
    ).toBe(true);
  });
  it('includes both pages with real editorial dates', () => {
    for (const path of ['/ai', '/developers/mcp']) {
      expect(INDEXABLE_PATHS).toContain(path);
      expect(CONTENT_DATES[path]).toBe('2026-11-06');
    }
  });
});
