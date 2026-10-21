import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import Profile from '../../src/design-reference/components/Profile.jsx';
import { SAMPLE_USER } from '../../src/design-preview/sample-data';

it('renders unlinked teammate Discord actions without navigable API destinations', () => {
  const html = renderToStaticMarkup(
    createElement(Profile, {
      user: { ...SAMPLE_USER, role: 'teammate' },
      profile: { country: 'at', bio: '', languages: [] },
      home: '/teammate',
      languages: ['English'],
      discord: null,
      discordResult: '',
    }),
  );
  expect(html).toContain('Connect Discord');
  expect(html).not.toMatch(/href=["']\/api\//);
  expect(html).toMatch(/<a[^>]*aria-disabled="true"[^>]*>Connect Discord<\/a>/);
});
