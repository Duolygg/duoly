import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import SiteFooter, {
  viennaClock,
} from '../../src/components/site/SiteFooter.jsx';

it('tells Vienna time and whether the team is awake, without dashes', () => {
  // 10:00 and 03:00 in Vienna (UTC+1 in winter)
  const day = viennaClock(Date.parse('2026-11-10T09:00:00Z'));
  const night = viennaClock(Date.parse('2026-11-10T02:00:00Z'));
  expect(day).toMatchObject({ hm: '10:00', status: 'Local time in Austria' });
  expect(night).toMatchObject({
    hm: '03:00',
    status: 'Local time in Austria',
  });
  expect(viennaClock(null).hm).toBe('--:--');
});

it('is the one footer with the shared links on every page', () => {
  const html = renderToStaticMarkup(React.createElement(SiteFooter));
  expect(html).toContain('class="site-footer"');
  expect(html).toContain('Made in Vienna, Austria');
  expect(html).not.toMatch(/2 minutes|team is online|24\/7/);
  for (const href of ['/imprint', '/terms', '/privacy'])
    expect(html).toContain(`href="${href}"`);
  // the teammate rules are for teammates: never linked for visitors
  expect(html).not.toContain('href="/rules"');
  expect(html).not.toMatch(/[–—]/);
});
