import { describe, expect, it, vi } from 'vitest';
import {
  AI_ASSISTANTS,
  AI_CONNECTOR_LIVE,
  aiLaunchState,
  MCP,
} from '../../src/site/ai';
import { CONTENT_DATES, INDEXABLE_PATHS } from '../../src/site/seo';
import example from '../../src/content/mcp-quote-example.json';
import { calculateQuote } from '../../src/server/pricing';

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
  it('keeps the exercised quote example aligned with authoritative pricing', () => {
    const quote = calculateQuote(
      {
        gameId: 'val',
        serviceId: 'duo2',
        rank: 'Platinum',
        server: 'EU',
        units: 1,
      },
      { customerCurrency: 'EUR', eurToUsd: 1.08 },
    );
    expect(example.result.structuredContent.amountMinor).toBe(
      quote.customer.amountMinor,
    );
    expect(example.result.structuredContent.amountEurMinor).toBe(
      quote.amountEurMinor,
    );
    expect(example.result.structuredContent.notReserved).toBe(true);
    expect(example.result.structuredContent.bookUrl).toBe(
      'https://duoly.gg/?game=val&service=duo2&agent=other#modes-h',
    );
    expect(
      MCP.tools.find((tool) => tool.name === 'get_quote')?.inputs,
    ).toContain('server (required)');
  });
  it.each([false, true])('aligns launch visibility when live is %s', (live) => {
    const state = aiLaunchState(live);
    expect(state.indexing).toBe(live ? 'index, follow' : 'noindex, follow');
    expect(state.indexablePaths).toEqual(live ? ['/ai'] : []);
    expect(state.showSetup).toBe(live);
    expect(state.label).toBe(
      live ? 'Available in Claude' : 'Launching soon in Claude',
    );
  });
  it.each([false, true])(
    'renders sitemap visibility when live is %s',
    async (live) => {
      vi.resetModules();
      vi.doMock('../../src/site/ai', () => ({
        aiLaunchState: () => aiLaunchState(live),
      }));
      try {
        const { GET } = await import('../../src/pages/sitemap.xml');
        const response = await GET({
          site: new URL('https://duoly.gg'),
        } as Parameters<typeof GET>[0]);
        expect(
          (await response.text()).includes('https://duoly.gg/ai</loc>'),
        ).toBe(live);
      } finally {
        vi.doUnmock('../../src/site/ai');
        vi.resetModules();
      }
    },
  );
  it('keeps the pending consumer page out of the sitemap contract', () => {
    expect(AI_CONNECTOR_LIVE).toBe(false);
    expect(INDEXABLE_PATHS).not.toContain('/ai');
    expect(INDEXABLE_PATHS).toContain('/developers/mcp');
    for (const path of ['/ai', '/developers/mcp']) {
      expect(CONTENT_DATES[path]).toBe('2026-11-06');
    }
  });
});
