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
const render = (initialData: typeof data) =>
  renderToStaticMarkup(
    createElement(PublicProfileSettings, {
      csrf: 'test',
      name: 'Nyx',
      initialData,
    }),
  );
const published = {
  ...data,
  settings: { ...data.settings, published: true },
};
it('shows the controls, the public data explanation, and read-only verified ranks', () => {
  const html = render(data);
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
  expect(render(data)).not.toContain('href="/teammates/nyx"');
});

/* Profiles are on by default now (owner decision 2026-11-12), so the block opens by saying
   the page is live and where, with the switch that takes it down right under it. */
it('tells a published teammate the page is live, and where', () => {
  const html = render(published);
  expect(html).toContain('Your profile is on');
  expect(html).toContain('Your page is live at');
  expect(html).toContain('href="/teammates/nyx"');
  expect(html).toContain('duoly.gg/teammates/nyx');
  expect(html).toContain('Switch it off above and save to take it down');
  expect(html).toContain('>On<');
  expect(html).not.toContain('Off by default');
});
it('says the page is down when the teammate switched it off, or support hid it', () => {
  expect(render(data)).toContain('Your profile is off');
  expect(render(data)).not.toContain('Your page is live at');
  const hidden = render({ ...published, hidden: true });
  expect(hidden).not.toContain('Your page is live at');
  expect(hidden).toContain('Support has hidden this profile');
});
