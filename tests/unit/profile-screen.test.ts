import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import LiveProfile from '../../src/components/account/LiveProfile';
import { PROFILE_LANGUAGES } from '../../src/contracts/account';

const render = (role: 'customer' | 'teammate' | 'admin') =>
  renderToStaticMarkup(
    createElement(LiveProfile, {
      viewer: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Mika',
        email: 'mika@example.invalid',
        image: '/assets/avatars/avatar-2.png',
        provider: 'email',
        role,
      },
      profile: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Mika',
        country: 'de',
        image: '/assets/avatars/avatar-2.png',
        bio: 'Calm comms, I explain my calls.',
        languages: ['English', 'German'],
        currency: null,
      },
      csrf: 'a'.repeat(64),
      discord: null,
      discordResult: '',
      discordEnabled: false,
    }),
  );

it('lets teammates edit the bio and languages from the original profile', () => {
  const html = render('teammate');
  expect(html).toContain('id="pf-bio"');
  expect(html).toContain('Calm comms, I explain my calls.');
  expect(html).toContain('Languages you play in');
  for (const language of PROFILE_LANGUAGES) expect(html).toContain(language);
  expect(html).toMatch(/aria-pressed="true"[^>]*>German</);
  expect(html).toMatch(/aria-pressed="false"[^>]*>French</);
  expect(html).toContain('href="/teammate"');
});

it.each([
  ['customer', '/dashboard'],
  ['admin', '/admin'],
] as const)('keeps bio and languages off a %s profile', (role, home) => {
  const html = render(role);
  expect(html).not.toContain('id="pf-bio"');
  expect(html).not.toContain('Languages you play in');
  expect(html).toContain(`href="${home}"`);
});
