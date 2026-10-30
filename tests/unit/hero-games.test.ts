import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Home from '../../src/components/home/Home.jsx';
import { mapHeroTeammates } from '../../src/server/home/live';

it('shows the games we cover in the hero instead of live counters', () => {
  const html = renderToStaticMarkup(
    React.createElement(Home, { onlineNow: 4, recentMatches: [] }),
  );
  const stack = /<a href="#games" class="dl-games"[\s\S]*?<\/a>/.exec(
    html,
  )?.[0];
  expect(stack).toBeDefined();
  expect(stack).toContain('League, Valorant, CS2 and 12 more');
  expect(stack).toContain('plus Social');
  expect(stack?.match(/<img /g)).toHaveLength(8);
  // the heart closes the stack
  expect(stack).toMatch(/social\.png"[^>]*>\s*<\/span>/);
  expect(html).not.toContain('Online now');
  expect(html).not.toContain('Just played');
});

describe('hero teammate cards', () => {
  const mate = {
    name: 'Mira',
    image: '/assets/avatars/avatar-2.png',
    games: ['lol', 'val'],
    gg: false,
    online: true,
    rating: 4.9,
    reviews: 128,
    sessions: 412,
  };

  it('keeps the logo until there are real teammates', () => {
    const html = renderToStaticMarkup(
      React.createElement(Home, { teammates: [], recentMatches: [] }),
    );
    expect(html).toContain('logo-full.webp');
    expect(html).not.toContain('dl-tm-card');
  });

  it('glides one row of cards over the logo, which stays in the background', () => {
    const html = renderToStaticMarkup(
      React.createElement(Home, {
        teammates: [mate, { ...mate, name: 'Lena', gg: true, online: false }],
        recentMatches: [],
      }),
    );
    expect(html).toContain('logo-full.webp');
    expect(html.match(/class="dl-tm-track/g)).toHaveLength(1);
    // the floating sample cards make room for the real teammates
    expect(html).not.toContain('Rank Rush');
    expect(html).toContain('Mira');
    expect(html).toContain('Online now');
    expect(html).toContain('★ 4.9');
    expect(html).toContain('Gamer Girl');
    expect(html).toContain('412 sessions');
  });

  it('maps only safe, well-formed teammate data', () => {
    expect(mapHeroTeammates(null)).toEqual([]);
    const [ok, ...rest] = mapHeroTeammates([
      { ...mate, image: 'https://evil.example/x.png', games: ['lol', 'nope'] },
      { ...mate, name: 'X' },
      { ...mate, sessions: -1 },
      'junk',
    ]);
    expect(rest).toEqual([]);
    expect(ok).toMatchObject({
      name: 'Mira',
      image: '/assets/avatars/avatar-1.png',
      games: ['lol'],
      rating: 4.9,
    });
  });
});
