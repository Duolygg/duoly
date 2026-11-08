import { describe, expect, it } from 'vitest';
import { renderLlms } from '../../src/server/seo/llms';
import { GET, prerender } from '../../src/pages/llms.txt';
import { INDEXABLE_PATHS } from '../../src/site/seo';
import { SITE_GAMES } from '../../src/site/games';
import { games, services } from '../../src/server/mcp/catalog';
import { handleMcp } from '../../src/server/mcp/http';
import { BOOKING_PARAMS } from '../../src/contracts/booking-link';
import { existsSync } from 'node:fs';

describe('llms.txt', () => {
  it('includes the indexable E-Pal comparison exactly once', () => {
    expect(
      renderLlms().match(/https:\/\/duoly\.gg\/compare\/e-pal/g),
    ).toHaveLength(1);
  });

  it('publishes the site name and booking summary in the proposal format', () => {
    const text = renderLlms();
    expect(text).toMatch(
      /^# Duoly\n\n> .*vetted higher-rank.*fixed published prices.*pay on duoly\.gg\./,
    );
    expect(text).toContain('For AI assistants');
    expect(text).toContain('https://duoly.gg/mcp');
    expect(text).not.toMatch(/[\u2013\u2014]| & |not .*, but /i);
  });

  it('links only to sitemap entries or implemented routes, with descriptions', () => {
    const text = renderLlms();
    const knownRoutes = new Set([
      ...INDEXABLE_PATHS,
      ...SITE_GAMES.map((game) => `/games/${game.slug}`),
      '/mcp',
    ]);
    expect(existsSync('src/pages/games/[game].astro')).toBe(true);
    expect(existsSync('src/pages/mcp.ts')).toBe(true);
    const urls = [...text.matchAll(/https:\/\/[^\s)]+/g)].map(
      (match) => new URL(match[0].replace(/\.$/, '')),
    );
    expect(urls.length).toBeGreaterThan(20);
    for (const url of urls) {
      expect(url.origin).toBe('https://duoly.gg');
      expect(knownRoutes.has(url.pathname), url.href).toBe(true);
    }
    for (const line of text
      .split('\n')
      .filter((line) => line.startsWith('- ['))) {
      expect(line).toMatch(/^- \[[^\]]+\]\(https:\/\/duoly\.gg[^)]*\): .+\.$/);
    }
    expect(INDEXABLE_PATHS).not.toContain('/llms.txt');
  });

  it('matches the actual MCP tools/list registry including the private status tool', async () => {
    const response = await handleMcp(
      new Request('https://duoly.gg/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2025-11-25',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      }),
      {
        ip: '127.0.0.1',
        limit: async () => ({ allowed: true, retryAfter: 0 }),
      },
    );
    expect(response.status).toBe(200);
    const registry = (await response.json()).result.tools as { name: string }[];
    const documented = [...renderLlms().matchAll(/^- `([^`]+)`: .+$/gm)].map(
      (match) => match[1],
    );
    expect(documented.sort()).toEqual(registry.map((tool) => tool.name).sort());
    expect(registry).toHaveLength(7);
  });

  it('derives the game and coaching listings from the public, filtered catalog', () => {
    const text = renderLlms();
    for (const game of games()) {
      expect(text).toContain(
        `[${game.name}](https://duoly.gg/games/${game.slug})`,
      );
      for (const service of services(game.id)) {
        expect(['gg', 'social']).not.toContain(service.category);
      }
    }
    expect(text).not.toMatch(/social|gamer girl|reviews|ratings|wait times/i);
    expect(new TextEncoder().encode(text).byteLength).toBeLessThan(60000);
  });

  it('documents supported preferences while keeping private data out of booking links', () => {
    const text = renderLlms();
    for (const key of [
      'game',
      'service',
      'rank',
      'region',
      'qty',
      'role',
      'character',
      'voice',
      'mood',
      'seats',
      'server',
      'edition',
    ] as const) {
      expect(BOOKING_PARAMS).toContain(key);
      expect(text).toContain(key);
    }
    expect(text).toContain('agent (assistant attribution only)');
    expect(text).toContain('never put that code in a URL');
  });

  it('prerenders a plain-text response with static endpoint cache headers', async () => {
    expect(prerender).toBe(true);
    const response = await GET({} as Parameters<typeof GET>[0]);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8',
    );
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(await response.text()).toBe(renderLlms());
  });
});
