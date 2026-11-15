import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import PublicProfileSettings, {
  headerFromData,
  settingsFingerprint,
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
    'Your games',
    'featured game',
    'Accent',
    'Banner',
    'Vibe',
    'Show my country',
    'Offer coaching',
    'Roles',
    'Agents',
    'Immortal',
    'Ranks are checked by the team',
    'Email, Discord',
    'switched off any time',
  ])
    expect(html).toContain(text);
  expect(html).not.toContain('name="rank"');
  expect(html).not.toContain('<textarea');
});

/*
 * The games section. One approved game opens its own card, because that card is the whole reason
 * the teammate came to this block; the roles are the game's own list and the picks are the
 * characters, read from the shipped catalog rather than typed into a comma separated field.
 */
it('opens the only game and offers its roles and its characters by name', () => {
  const html = render(data);
  expect(html).toContain('aria-expanded="true"');
  for (const role of ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Fill'])
    expect(html).toContain('>' + role + '<');
  /* The one already saved is on, and the counts say where the caps are. */
  expect(html).toMatch(
    /aria-pressed="true"[^>]*>(<svg[\s\S]*?<\/svg>)?Controller/,
  );
  expect(html).toContain('1 / 3');
  expect(html).toContain('1 / 5');
  expect(html).toContain('Omen');
  expect(html).toContain('Edit Agents');
  expect(html).not.toContain('comma separated');
});
it('replaces the featured select with a star on the card it describes', () => {
  const html = render(data);
  expect(html).not.toContain('id="pp-featured"');
  expect(html).toContain('data-pk-feature="val"');
  expect(html).toContain('Valorant is featured');
});
it('offers Add a game without pretending the teammate can grant one', () => {
  const html = render(data);
  expect(html).toContain('Add a game');
  expect(html).toContain('The team approves the games on your profile');
  expect(html).toContain('data-pk-ask-game');
  /* Social comes with Gamer Girl access, so it is never something to ask for here. */
  expect(html).not.toContain('value="social"');
});
it('says what is saved and what is not, in one bar', () => {
  /* The form opens on what the read handed back, so there is nothing to save until something
     changes; the fingerprint is what the bar asks. */
  expect(render(data)).toContain('Everything here is saved.');
  expect(settingsFingerprint(data.settings)).toBe(
    settingsFingerprint({ ...data.settings }),
  );
  for (const change of [
    { published: true },
    { slug: 'other' },
    { accent: 'cyan' },
    { banner: 'grid' },
    { featuredGame: 'lol' },
    { vibeTags: ['Chill'] },
    { showCountry: true },
    { coaching: true },
    {
      games: [{ game: 'val', roles: ['Controller'], picks: ['Omen', 'Sova'] }],
    },
    {
      games: [{ game: 'val', roles: ['Controller'], picks: ['Sova', 'Omen'] }],
    },
  ])
    expect(
      settingsFingerprint({ ...data.settings, ...change }),
      JSON.stringify(change),
    ).not.toBe(settingsFingerprint(data.settings));
  expect(settingsFingerprint(null)).toBe('');
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
  /* The game cards carry game art, so this asks about the header's own picture. */
  expect(html).not.toContain('pp-header-art');
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
it('keeps the whole block free of em dashes, en dashes and ampersands', () => {
  for (const html of [
    render(data),
    render(published),
    render({ ...data, header: headerUrl }),
    render({ ...data, header: null }),
  ])
    expect(html.replace(/&#x27;|&quot;|&amp;|&#x2F;/g, '')).not.toMatch(
      /[–—&]/,
    );
});
