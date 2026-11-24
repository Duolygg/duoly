import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('links the optional PRO membership from the booking explainer when enabled', () => {
  const source = readFileSync('src/pages/how-it-works.astro', 'utf8');
  expect(source).toContain('proEnabled()');
  expect(source).toContain('<a href="/pro">Duoly PRO membership</a>');
});

it('gives the icon-only save link crawlable text as well as an accessible name', () => {
  const source = readFileSync(
    'src/components/teammates/DirectoryCard.astro',
    'utf8',
  );
  const link = source.match(/<a\s[\s\S]*?data-dc-signin[\s\S]*?<\/a>/)?.[0];
  expect(link).toContain('aria-label={`Save ${card.name}`}');
  expect(link).toContain(
    '<span class="md-visually-hidden">Save {card.name}</span>',
  );
});

it.each([
  'src/components/seo/GameHub.astro',
  'src/components/seo/Hub.astro',
  'src/pages/games/[game].astro',
])('links the game hub to its named teammate directory in %s', (path) => {
  const source = readFileSync(path, 'utf8');
  expect(source).toContain('publicProfilesEnabled()');
  expect(source).toMatch(
    /<a[^>]+href=\{`\/games\/\$\{game.slug\}\/teammates`\}[^>]*>\s*\{game.name\} teammates\s*<\/a>/,
  );
});
