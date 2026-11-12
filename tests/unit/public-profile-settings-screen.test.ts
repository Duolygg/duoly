import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import PublicProfileSettings, {
  splitProfileLabels,
} from '../../src/components/account/PublicProfileSettings';
const data = {
  settings: {
    published: false,
    slug: 'nyx',
    accent: 'mint',
    banner: 'slash',
    featuredGame: 'val',
    vibeTags: [],
    showCountry: false,
    coaching: false,
    games: [{ game: 'val', roles: ['Controller'], picks: ['Omen'] }],
  },
  approvedGames: ['val'],
  ranks: [
    { game: 'val', rank: 'Immortal', peakRank: 'Radiant', verified: true },
  ],
  hidden: false,
};
it('shows opt-in controls, public data explanation, and read-only verified ranks', () => {
  const html = renderToStaticMarkup(
    createElement(PublicProfileSettings, {
      csrf: 'test',
      name: 'Nyx',
      initialData: data,
    }),
  );
  for (const text of [
    'Show my public profile',
    'Profile link',
    'Featured game',
    'Accent',
    'Banner',
    'Vibe',
    'Show my country',
    'Offer coaching',
    'Roles',
    'Agents, champions or heroes',
    'Immortal',
    'Ask support to update',
    'Email, Discord',
    'switched off any time',
  ])
    expect(html).toContain(text);
  expect(html).not.toContain('name="rank"');
  expect(html).not.toContain('<textarea');
});
it('parses comma separated labels without inventing picks', () => {
  expect(splitProfileLabels(' Omen, Sova, ')).toEqual(['Omen', 'Sova']);
  expect(splitProfileLabels('')).toEqual([]);
});
it('does not render a public preview link for an unpublished draft', () => {
  const html = renderToStaticMarkup(
    createElement(PublicProfileSettings, {
      csrf: 'test',
      name: 'Nyx',
      initialData: data,
    }),
  );
  expect(html).not.toContain('href="/teammates/nyx"');
});
