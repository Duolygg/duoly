import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { intentPages } from '../../src/content/intent-pages';
import { guideFaq, guideForGame } from '../../src/content/guide-pages';
import { guideExamples } from '../../src/server/seo/guide';

it('probe', () => {
  const prices = guideExamples({ eurToUsd: 1 });
  const out = intentPages.map((p) => ({
    path: `/games/${p.gameSlug}/${p.slug}`,
    hasGuide: Boolean(guideForGame(p.gameSlug)),
    faq: guideFaq(p, prices).map(([q]) => q),
  }));
  writeFileSync('/tmp/duolyprobe/faqs.json', JSON.stringify(out, null, 1));
});
