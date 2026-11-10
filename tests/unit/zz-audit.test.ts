import { readFileSync, writeFileSync, globSync } from 'node:fs';
import { it } from 'vitest';
import { copyStrings, plainCopyProblems } from '../../src/content/plain-copy';
import { GAME_HUBS } from '../../src/content/game-hubs';
import { intentPages } from '../../src/content/intent-pages';
import { GUIDE_PAGES } from '../../src/content/guide-pages';
import { lessons } from '../../src/content/coaching';
import { coachFormats } from '../../src/content/coaching-formats';
import { sessionExamples } from '../../src/content/coaching-examples';
import { socialContent } from '../../src/content/hubs';
import { ABOUT_STORY } from '../../src/content/about-story';

const out: string[] = [];
const scan = (label: string, strings: string[]) => {
  for (const s of strings)
    for (const p of plainCopyProblems(s))
      out.push(`${label}\t${p.rule}\t${p.detail}\t>>> ${p.paragraph}`);
};

it('audit', () => {
  for (const hub of GAME_HUBS) scan(`hub:${hub.gameSlug}`, copyStrings(hub));
  for (const p of intentPages) scan(`intent:${p.gameSlug}`, copyStrings(p));
  for (const g of GUIDE_PAGES) scan(`guide:${g.gameSlug}`, copyStrings(g));
  for (const [k, v] of Object.entries(lessons))
    scan(`coaching:${k}`, copyStrings(v));
  for (const [k, v] of Object.entries(coachFormats))
    scan(`formats:${k}`, copyStrings(v));
  scan('examples', copyStrings(sessionExamples));
  scan('social', copyStrings(socialContent));
  scan('about', copyStrings(ABOUT_STORY));
  for (const file of [
    ...globSync('src/pages/**/*.astro'),
    ...globSync('src/components/seo/*.astro'),
  ]) {
    const source = readFileSync(file, 'utf8');
    const literals = [
      ...source.matchAll(/`((?:[^`\\]|\\.)*)`/g),
      ...source.matchAll(/'((?:[^'\\\n]|\\.)*)'/g),
      ...source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g),
    ].map((m) => m[1]!.replace(/\$\{[^}]*\}/g, '{value}'));
    scan(file, literals);
  }
  writeFileSync(
    '/Users/sebastianschrottenbach/.hermes/cache/scratch/task-u/audit.tsv',
    out.join('\n'),
  );
  console.log('problems:', out.length);
});
