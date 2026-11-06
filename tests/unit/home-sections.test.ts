import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '../../src/components/home/Home.jsx';
import { SAMPLE_TESTIMONIALS } from '../../src/components/home/sampleTestimonials';
import { maskName } from '../../src/components/home/Testimonials.jsx';
import SoloVsDuoly, {
  OPPONENTS,
} from '../../src/components/home/SoloVsDuoly.jsx';

const render = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    React.createElement(Home, { recentMatches: [], ...props }),
  );

afterEach(() => vi.unstubAllEnvs());

describe('testimonial carousel', () => {
  it('shows the reviews to every visitor on the live site, like any other section', () => {
    vi.stubEnv('DEV', false);
    for (const session of [
      undefined,
      { user: { id: 'u1', name: 'A', role: 'customer' } },
      { user: { id: 'u2', name: 'B', role: 'admin' } },
    ]) {
      const html = render({ session });
      expect(html).toContain('What players say after the match');
      expect(html).toContain(SAMPLE_TESTIMONIALS[0]!.quote);
      expect(html).not.toContain('Sample reviews');
    }
  });

  it('runs two rows in opposite directions, each review once for screen readers', () => {
    const html = render();
    expect(html.match(/class="rv-track[^"]*"/g)).toEqual([
      'class="rv-track"',
      'class="rv-track rv-rev"',
    ]);
    const lists = html.match(
      /role="list"[\s\S]*?(?=<div class="rv-set" aria-hidden)/g,
    )!;
    expect(lists).toHaveLength(2);
    const shown = lists.join('').match(/class="rv-card"/g)!.length;
    expect(shown).toBe(SAMPLE_TESTIMONIALS.length);
  });

  it('shows who wrote it and where from; real reviews replace the placeholders', () => {
    const html = render({
      testimonials: [
        {
          game: 'val',
          stars: 5,
          quote: 'A real review.',
          name: 'Lukas',
          avatar: '/assets/avatars/avatar-1.png',
          country: 'de',
          teammate: 'Mia',
          tags: ['Great comms', 'Patient'],
        },
        {
          game: 'lol',
          stars: 4,
          quote: 'Another real one.',
          name: 'Yuki',
          avatar: '/assets/avatars/avatar-8.png',
          country: 'jp',
          teammate: 'Kai',
          tags: ['Great comms'],
        },
      ],
    });
    expect(html).toContain('A real review.');
    // reviewers stay anonymous
    expect(html).toContain('<strong>L***s</strong>');
    expect(html).not.toContain('Lukas');
    expect(html).toMatch(
      /<img src="\/assets\/flags\/svg\/de\.svg"[^>]*>Germany/,
    );
    expect(html).toMatch(/<img src="\/assets\/flags\/svg\/jp\.svg"[^>]*>Japan/);
    expect(html).toContain('4.5');
    expect(html).toContain('from 2 reviews');
    // no tag row above the carousel
    expect(html).not.toContain('rv-tag');
    expect(html).not.toContain(SAMPLE_TESTIMONIALS[0]!.quote);
  });

  it('are at least 40 five-star reviews with valid games, countries and tags', async () => {
    const { GAME } = await import('../../src/design-reference/lib/games');
    const { COUNTRY_NAME } =
      await import('../../src/design-reference/lib/countries');
    const { REVIEW_TAGS } = await import('../../src/contracts/reviews');
    expect(SAMPLE_TESTIMONIALS.length).toBeGreaterThanOrEqual(40);
    for (const t of SAMPLE_TESTIMONIALS) {
      expect(t.stars).toBe(5);
      expect(GAME[t.game as keyof typeof GAME]).toBeTruthy();
      expect(COUNTRY_NAME[t.country as keyof typeof COUNTRY_NAME]).toBeTruthy();
      for (const tag of t.tags as string[])
        expect(REVIEW_TAGS as readonly string[]).toContain(tag);
    }
  });
});

describe('solo queue vs. Duoly', () => {
  it('sits after "How it works" and before the reviews and FAQ', () => {
    const html = render();
    const at = (s: string) => html.indexOf(s);
    expect(at('id="how"')).toBeLessThan(at('Solo queue'));
    expect(at('Solo queue')).toBeLessThan(at('id="faq"'));
  });

  it('opens on solo queue with a switch to boosting', () => {
    const html = render();
    expect(html).toContain('Solo queue <span class="sv-vs-word">vs.</span>');
    expect(html).toMatch(/aria-pressed="true"[^>]*>vs. Solo queue/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>vs. Boosting/);
    for (const [what, , us] of OPPONENTS[0]!.rows) {
      expect(html).toContain('<span class="sv-chip">' + what + '</span>');
      expect(html).toContain(us);
    }
    expect(html).toMatch(/<a href="#games" class="sv-cta">Find my duo/);
  });

  it('only promises what the site already promises, against either side', () => {
    // each line restates the hero, the FAQ ("How fast…", "Can I get banned…", "What if my
    // teammate is toxic…"), the terms (no result is promised), the trust points in lib/legal.js
    // ("Your account stays yours"), the catalog (per-game prices, casual modes, coaching, Social)
    // or the checkout moods
    const promised = new Set([
      'A rank-verified teammate, reviewed after every session',
      'Voice on Discord if you want it',
      'Re-roll your teammate, up to twice',
      'Usually matched in under 2 minutes',
      'Not matched in 5 minutes? You pay nothing',
      'The games themselves, with a teammate',
      'Pay per game, from {from}',
      'Nobody ever asks for your password',
      'Playing with you, not for you',
      'Pick “Teach me” and learn as you play',
      'Casual modes, coaching, or just hanging out',
    ]);
    expect(OPPONENTS.map((o) => o.id)).toEqual(['solo', 'boost']);
    for (const o of OPPONENTS)
      for (const [what, them, us] of o.rows) {
        expect(what).toBeTruthy();
        expect(them).toBeTruthy();
        expect(promised).toContain(us);
      }
  });

  it('compares boosting as a model, duo boosts included, at the real lowest price', () => {
    const boost = OPPONENTS[1]!;
    const them = boost.rows.map(([, t]) => t).join(' ');
    // a boost sells a result; only classic boosts log into the account
    expect(them).toContain('A rank, delivered');
    expect(them).toContain('Classic boosts log into it');
    // the price line shows the price it is given (Home passes the cheapest per-game service)
    const html = renderToStaticMarkup(
      React.createElement(SoloVsDuoly, { fromPrice: '$3.49', initial: 1 }),
    );
    expect(html).toContain('Boosting <span class="sv-vs-word">vs.</span>');
    expect(html).toContain('Pay per game, from $3.49');
    expect(html).not.toContain('{from}');
    // and the homepage computes it from the catalog: the €1.99 minimum (e.g. Deathmatch, Skirmish) today
    const home = new (
      Home as unknown as new (p: object) => {
        renderVals(): { fromPrice: string };
      }
    )({ recentMatches: [] });
    expect(home.renderVals().fromPrice).toBe('€1.99');
  });
});

describe('checkout button', () => {
  it('names no payment method when the method is picked on the next step', () => {
    const html = render({ onCheckout: async () => ({}) });
    expect(html).toContain('You choose on the next step');
    expect(html).toMatch(/Continue to payment · €\d+\.\d\d/);
    expect(html).not.toMatch(/Pay €[\d.]+ with Apple Pay/);
  });

  it('still names the picked method where the page has a method picker', () => {
    const html = render();
    expect(html).toContain('role="radiogroup" aria-label="Payment method"');
    expect(html).toMatch(/Pay €[\d.]+ with Apple Pay/);
  });

  it('keeps the bullet icons from shrinking when a line wraps', () => {
    const html = render();
    const list =
      /<ul[^>]*>(?:(?!<\/ul>)[\s\S])*Not matched in 5 min(?:(?!<\/ul>)[\s\S])*<\/ul>/.exec(
        html,
      )![0];
    expect(
      list.match(/<svg[^>]*style="flex:0 0 auto;margin-top:4px"/g),
    ).toHaveLength(3);
  });
});

describe('reviewer names', () => {
  it('masks every letter but the first and last', () => {
    expect(maskName('Lukas')).toBe('L***s');
    expect(maskName('Rafaels')).toBe('R*****s');
    expect(maskName('Seo-yeon')).toBe('S******n');
    expect(maskName('Lucía')).toBe('L***a');
    expect(maskName('Al')).toBe('A*');
    expect(maskName('J')).toBe('J*');
    expect(maskName('')).toBe('*');
  });

  it('never shows a full sample name on the page', () => {
    const html = render();
    for (const t of SAMPLE_TESTIMONIALS) {
      expect(html).toContain('<strong>' + maskName(t.name) + '</strong>');
      expect(html).not.toContain('<strong>' + t.name + '</strong>');
    }
  });
});
