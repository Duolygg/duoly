import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import PublicProfileSettings, {
  headerFromData,
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
const render = (initialData: typeof data & { header?: string | null }) =>
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

/*
 * Header image. teammate_public_profile_get() does not return the header yet, so the block has
 * three states to get right: the URL when the settings read carries one, "none" when it says
 * null, and neither claim when the field is missing altogether.
 */
const headerUrl =
  'https://duolyfixture.supabase.co/storage/v1/object/public/profile-headers/3f9b7c21-5d64-4ab8-9f0e-2c7d81a4e6b5/91d4c7f0ab2e5368.webp';
it('offers the header block with one line about where the header shows', () => {
  const html = render(data);
  expect(html).toContain('Header image');
  expect(html).toContain('Your header is shown on your public profile.');
  expect(html).toContain('type="file"');
  expect(html).toContain('Choose a picture');
});
it('shows the saved header, with replace and remove next to it', () => {
  const html = render({ ...data, header: headerUrl });
  expect(html).toContain(`src="${headerUrl}"`);
  expect(html).toContain('width="1500"');
  expect(html).toContain('height="500"');
  expect(html).toContain('Replace header');
  expect(html).toContain('Remove header');
});
it('says there is no header when the read says so, and offers nothing to remove', () => {
  const html = render({ ...data, header: null });
  expect(html).toContain('You have no header yet');
  expect(html).not.toContain('Remove header');
  expect(html).not.toContain('<img');
});
it('claims nothing about the current header while the read cannot say, and still removes', () => {
  const html = render(data);
  expect(html).toContain('Your public profile shows the header you have now');
  expect(html).not.toContain('You have no header yet');
  expect(html).toContain('Remove header');
});
it('reads the header from either place the settings payload could carry it', () => {
  expect(headerFromData({ ...data, header: headerUrl })).toBe(headerUrl);
  expect(
    headerFromData({ ...data, settings: { ...data.settings, header: null } }),
  ).toBe(null);
  expect(headerFromData(data)).toBe(undefined);
  expect(headerFromData(null)).toBe(undefined);
});
it('keeps the header copy free of em dashes, en dashes and ampersands', () => {
  for (const html of [render(data), render({ ...data, header: headerUrl })])
    expect(html.replace(/&#x27;|&quot;|&amp;/g, '')).not.toMatch(/[–—&]/);
});
