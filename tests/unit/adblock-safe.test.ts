import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// Ad blockers (EasyList: ##.ad-main, ##.ad-side, ##.ad-table …) hide elements whose class or id
// looks like an ad slot. The admin used `ad-*` classes and rendered black under uBlock Origin.
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(dir, e.name))
      : /\.(jsx|tsx|astro|css)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );

it('uses no ad-like class or id names that ad blockers hide', () => {
  const bad: string[] = [];
  const pattern =
    /(?<![A-Za-z0-9_-])(?:ad|ads|advert|advertisement|sponsor|banner-ad)[-_](?=[a-z0-9])/;
  for (const file of files('src')) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (
          /class(Name)?=|\bid=|^\s*[.#@]|[{,]\s*[.#]/.test(line) &&
          pattern.test(line)
        )
          bad.push(`${file}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
  }
  expect(bad).toEqual([]);
});
