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
  expect(stack).toContain(
    'League of Legends, Valorant, Counter-Strike 2 and 12 more',
  );
  expect(stack).toContain('plus Social');
  expect(stack?.match(/<img /g)).toHaveLength(8);
  // the heart closes the stack
  expect(stack).toMatch(/social\.png"[^>]*>\s*<\/span>/);
  expect(html).not.toContain('Online now');
  expect(html).not.toContain('Just played');
});

describe('teammate carousel', () => {
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

  it('shows the live online line until there are real teammates', () => {
    const html = renderToStaticMarkup(
      React.createElement(Home, { teammates: [], recentMatches: [] }),
    );
    expect(html).toContain('Meet your teammates');
    expect(html).toContain('class="tc-empty"');
    expect(html).not.toContain('tc-card');
  });

  it('keeps the hero as the logo and glides the teammates in their own section', () => {
    const html = renderToStaticMarkup(
      React.createElement(Home, {
        teammates: [
          { ...mate, name: 'Lena', games: ['val'], gg: true, online: false },
          mate,
        ],
        recentMatches: [],
      }),
    );
    // the hero is just the logo: no floating sample cards, no teammate strip
    expect(html).toContain('logo-full.webp');
    expect(html).not.toContain('Rank Rush');
    expect(html).not.toContain('dlfloat');
    expect(html).not.toContain('dl-tm-');
    // the section sits between the modes and the checkout
    const at = (s: string) => html.indexOf(s);
    expect(at('Pick a mode')).toBeLessThan(at('Meet your teammates'));
    expect(at('Meet your teammates')).toBeLessThan(at('id="checkout"'));
    expect(html.match(/class="tc-track/g)).toHaveLength(1);
    // one list for screen readers; the loop copies are hidden
    const list = /role="list"[\s\S]*?(?=<div class="tc-set" aria-hidden)/.exec(
      html,
    )?.[0];
    expect(list?.match(/class="tc-card/g)).toHaveLength(2);
    // Mira plays the picked game (League), so she leads; each card shows only its own games, unhighlighted
    expect(list!.indexOf('Mira')).toBeLessThan(list!.indexOf('Lena'));
    const lena = list!.slice(list!.indexOf('Lena'));
    expect(lena).toContain('alt="Valorant"');
    expect(lena).not.toContain('alt="League of Legends"');
    expect(list).not.toContain('is-picked');
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
