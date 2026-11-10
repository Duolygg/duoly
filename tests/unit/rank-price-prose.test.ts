import { expect, it } from 'vitest';

import { HUB_PAGES } from '../../src/content/hub-pages';
import { intentPages } from '../../src/content/intent-pages';
import { GUIDE_PRICE_SPECS } from '../../src/server/seo/guide';
import { ranksOf } from '../../src/design-reference/lib/ranks.js';
import { cleanCopy } from '../../src/server/seo/offers';
import { gameBySlug } from '../../src/site/games';

/**
 * A rank-priced service never has one price, so prose may not quote it as if it
 * did.
 *
 * /games/valorant used to read "Duo Apex a Radiant player at €8.49 per game".
 * Duo Apex is priced by the customer's own rank (€6.99 at Iron up to €13.49 at
 * Radiant), so €8.49 was only the example rank's price, and "a Radiant player"
 * names the teammate's rank rather than the reader's. A reader, and an
 * assistant quoting the page, both came away with a number that is wrong for
 * every rank except one.
 *
 * The rule a sentence has to satisfy, for each rank-priced service whose price
 * it quotes:
 *
 *  - say "from" or "starts at" with the cheapest rank's price (`{{p_x_low}}`),
 *  - or name the rank the number belongs to, and
 *  - a paragraph that already binds the service to a rank (`{{rank_x}}`, or a
 *    `{{p_x_low}}` to `{{p_x_high}}` range) carries that over its sentences.
 *
 * A literal rank word is not enough on its own in hub copy, because teammate
 * tiers are written with the same words ("an Immortal+ player") and that is
 * exactly the confusion the Valorant sentence caused. Hub copy therefore has to
 * use the engine-filled `{{rank_x}}` token, which is always the customer's rank.
 */
const RANK_AWARE =
  /\b(your own|your|the same|every|any|each) (rank|rating|medal|tier|division|score|ladder)\b|\brank (list|decides|sets)\b|\brises with\b|\bper rank\b|\bpriced by\b|\bstarts? at\b|\bfrom\b/i;

const strings = (value: unknown, path: string, out: [string, string][]) => {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value))
    value.forEach((item, index) => strings(item, `${path}[${index}]`, out));
  else if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value))
      strings(item, `${path}.${key}`, out);
};
const sentences = (text: string) =>
  text.split(/(?<=[.!?:])\s+/).filter(Boolean);

/** Every way a game's rank list can appear in copy, including "0 to 4,999". */
const rankWords = (ranks: string[]) => {
  const words = new Set<string>();
  for (const rank of ranks)
    for (const form of [rank, cleanCopy(rank)]) {
      words.add(form);
      for (const number of form.match(/[\d,]{3,}/g) ?? []) words.add(number);
    }
  return [...words];
};

it('never quotes a rank-priced service as one price in hub copy', () => {
  const problems: string[] = [];
  for (const hub of HUB_PAGES) {
    const gameId = gameBySlug(hub.gameSlug)!.id;
    const copy: [string, string][] = [];
    strings(hub, hub.gameSlug, copy);
    for (const [path, text] of copy) {
      const ids = new Set(
        [...text.matchAll(/\{\{p_([a-z0-9]+)(?:_x\d+|_low|_high)?\}\}/g)].map(
          (match) => match[1]!,
        ),
      );
      for (const id of ids) {
        if (!(ranksOf(gameId, id) as string[]).length) continue;
        // The paragraph already ties this service to a rank.
        if (text.includes(`{{rank_${id}`)) continue;
        if (
          text.includes(`{{p_${id}_low}}`) &&
          text.includes(`{{p_${id}_high}}`)
        )
          continue;
        const token = new RegExp(`\\{\\{p_${id}(_x\\d+|_low|_high)?\\}\\}`);
        for (const sentence of sentences(text)) {
          if (!token.test(sentence)) continue;
          if (RANK_AWARE.test(sentence)) continue;
          problems.push(`${path} (${id}): ${sentence}`);
        }
      }
    }
  }
  expect(problems).toEqual([]);
});

it('never quotes a rank-priced service as one price in teammate page copy', () => {
  const problems: string[] = [];
  for (const page of intentPages) {
    const copy: [string, string][] = [];
    strings(page, `${page.gameSlug}/${page.slug}`, copy);
    for (const [path, text] of copy) {
      const specs = new Map<string, { gameId: string; serviceId: string }>();
      for (const match of text.matchAll(/\{\{([a-zA-Z0-9]+)\}\}/g)) {
        const spec = GUIDE_PRICE_SPECS[match[1]!];
        if (spec?.rank) specs.set(`${spec.gameId}/${spec.serviceId}`, spec);
      }
      for (const [key, spec] of specs) {
        // Teammate page tokens name one concrete rank each (`valPro` is Gold),
        // so a rank word anywhere in the paragraph is the honest disclosure.
        const words = rankWords(
          ranksOf(spec.gameId, spec.serviceId) as string[],
        );
        if (words.some((word) => text.includes(word))) continue;
        for (const sentence of sentences(text)) {
          const quotes = [...sentence.matchAll(/\{\{([a-zA-Z0-9]+)\}\}/g)].some(
            (match) => {
              const found = GUIDE_PRICE_SPECS[match[1]!];
              return (
                found?.rank && `${found.gameId}/${found.serviceId}` === key
              );
            },
          );
          if (!quotes) continue;
          if (RANK_AWARE.test(sentence)) continue;
          problems.push(`${path} (${key}): ${sentence}`);
        }
      }
    }
  }
  expect(problems).toEqual([]);
});

it('fails on the phrasing that shipped on /games/valorant', () => {
  // The exact sentence the live page carried, as a guard on the guard: if this
  // ever stops being caught, the test above has stopped testing anything.
  const bug =
    'Second, read the teammate tier beside the price: Duo Plus names an Ascendant+ player, Duo Pro an Immortal+ player and Duo Apex a Radiant player at {{p_duo3}} per game.';
  const flagged = sentences(bug).filter(
    (sentence) => /\{\{p_duo3\}\}/.test(sentence) && !RANK_AWARE.test(sentence),
  );
  expect(flagged).toHaveLength(1);
  // And the shipped fix passes.
  const fixed = bug.replace('at {{p_duo3}}', 'from {{p_duo3_low}}');
  expect(
    sentences(fixed).filter(
      (sentence) =>
        /\{\{p_duo3(_low)?\}\}/.test(sentence) && !RANK_AWARE.test(sentence),
    ),
  ).toHaveLength(0);
});
