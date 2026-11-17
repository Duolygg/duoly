import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('blocks only query variants of directories in every robots group', () => {
  const robots = readFileSync('public/robots.txt', 'utf8');
  const groups = robots.split(/^User-agent: /m).slice(1);
  expect(groups.length).toBeGreaterThan(1);
  for (const group of groups) {
    const rules = group.match(/^Disallow: .+$/gm) ?? [];
    expect(rules).toEqual([
      'Disallow: /teammates?',
      'Disallow: /games/*/teammates?',
    ]);
    expect(group).toContain('Allow: /');
  }
});
it('marks directory facet links and active chips nofollow without changing profile links', () => {
  const source = readFileSync(
    'src/components/teammates/Directory.astro',
    'utf8',
  );
  const links = source.match(/<a\s[\s\S]*?<\/a>/g) ?? [];
  const facets = links.filter((link) =>
    /href=\{(?:href\(|c\.href|`\$\{href\()/.test(link),
  );
  expect(facets.length).toBeGreaterThan(10);
  for (const link of facets) expect(link).toContain('rel="nofollow"');
});
