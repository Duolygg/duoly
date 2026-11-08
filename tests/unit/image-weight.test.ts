import { readdirSync, statSync } from 'node:fs';
import { expect, it } from 'vitest';

/**
 * Every PNG the browser downloads was re-encoded losslessly (same pixels, same mode,
 * same size) in November 2026: the exports carried roughly twice the bytes they needed,
 * which cost about 70 KB on each page showing game art. These budgets are headroom
 * over the current files, so a careless re-export that doubles a file again fails here
 * instead of on a visitor's phone. Re-encode with maximum PNG compression rather than
 * raising a number.
 */
const BUDGETS: Record<string, number> = {
  'public/assets/games': 26_000,
  'public/assets/flags': 6_000,
  'public/assets/payments': 28_000,
  'public/assets/social': 10_000,
  'public/assets/avatars': 40_000,
};

it.each(Object.entries(BUDGETS))(
  'keeps every PNG in %s under its byte budget',
  (dir, budget) => {
    const files = readdirSync(dir).filter((name) => name.endsWith('.png'));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files)
      expect(statSync(`${dir}/${name}`).size, `${dir}/${name}`).toBeLessThan(
        budget,
      );
  },
);
