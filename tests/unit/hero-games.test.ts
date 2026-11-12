import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    'League of Legends, Valorant, Counter-Strike 2 and 17 more',
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

/*
 * Owner approval 12 November 2026: the cards open the public profiles we built. The slug is the
 * only field a visitor can act on, so the mapping is tested the way the other slugs on the site
 * are, and the markup is tested for the three things a link in a drifting strip has to get right:
 * one tab stop per teammate, a name that says where it goes, and no link while the feature is off.
 */
describe('teammate carousel: profile links', () => {
  const mate = {
    name: 'Mira',
    image: '/assets/avatars/avatar-2.png',
    games: ['lol'],
    gg: false,
    online: true,
    rating: 4.9,
    reviews: 128,
    sessions: 412,
  };
  afterEach(() => vi.unstubAllEnvs());
  const render = (teammates: unknown[]) =>
    renderToStaticMarkup(
      React.createElement(Home, { teammates, recentMatches: [] }),
    );

  it('keeps a valid slug while public profiles are on', () => {
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
    expect(mapHeroTeammates([{ ...mate, slug: 'mira-7' }])[0]).toMatchObject({
      name: 'Mira',
      slug: 'mira-7',
    });
  });

  it('leaves the slug out when the database sends none or sends a bad one', () => {
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'true');
    for (const slug of [
      undefined,
      null,
      '',
      'no',
      'Mira',
      'mira--7',
      '-mira',
      'teammates',
      'a'.repeat(25),
      '../queue',
      42,
    ])
      expect(mapHeroTeammates([{ ...mate, slug }])[0]).not.toHaveProperty(
        'slug',
      );
  });

  it('drops the slug while public profiles are off', () => {
    vi.stubEnv('PUBLIC_PROFILES_ENABLED', 'false');
    expect(
      mapHeroTeammates([{ ...mate, slug: 'mira-7' }])[0],
    ).not.toHaveProperty('slug');
    expect(mapHeroTeammates([{ ...mate, slug: 'mira-7' }])[0]).toMatchObject({
      name: 'Mira',
    });
  });

  it('wraps a card with a slug in a link to its profile', () => {
    const html = render([{ ...mate, slug: 'mira-7' }]);
    const list = /role="list"[\s\S]*?(?=<div class="tc-set" aria-hidden)/.exec(
      html,
    )?.[0];
    expect(list).toContain(
      '<a class="tc-link" href="/teammates/mira-7" aria-label="Mira, view profile">',
    );
    // the one real card is the one tab stop: every copy below is taken out of the tab order
    expect(
      html.match(/class="tc-link" href="\/teammates\/mira-7"/g)!.length,
    ).toBeGreaterThan(1);
    expect(
      html.match(
        /<a class="tc-link" href="\/teammates\/mira-7"[^>]*tabindex="-1"/g,
      ),
    ).toHaveLength(html.match(/class="tc-link"/g)!.length - 1);
    // nothing about the card itself moved
    expect(list).toContain('class="tc-card');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('★ 4.9');
  });

  it('leaves a card without a slug exactly as it was', () => {
    const html = render([mate]);
    expect(html).not.toContain('tc-link');
    expect(html).not.toContain('/teammates');
    expect(html).toContain('class="tc-card');
  });

  it('links the heading to the directory only once a card has a profile', () => {
    expect(render([{ ...mate, slug: 'mira-7' }])).toContain(
      '<h2 id="tc-h" class="tc-title"><a href="/teammates">Meet your teammates</a></h2>',
    );
    const plain = render([mate]);
    expect(plain).toContain(
      '<h2 id="tc-h" class="tc-title">Meet your teammates</h2>',
    );
    expect(render([])).toContain(
      '<h2 id="tc-h" class="tc-title">Meet your teammates</h2>',
    );
  });
});
