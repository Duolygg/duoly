import { describe, expect, it } from 'vitest';

import { lastmodProblem } from '../../src/site/content-dates';

/**
 * The sitemap's `lastmod` rule, tested against made-up git history rather than
 * the repository's own. tests/unit/seo.test.ts already applies this rule to the
 * real history, which can only ever exercise the one shape today happens to
 * have; the cases that matter, a pull request landing days after it was written
 * and a date nobody bumped, cannot be produced on demand there.
 */
describe('the lastmod window', () => {
  // Copy written on the 9th, merged on the 11th, last changed before that on
  // the 5th: the squash-merge case the window exists for.
  const squashed = { landed: '2026-11-11', previous: '2026-11-05' };

  it('accepts the day the copy last changed', () => {
    expect(lastmodProblem('2026-11-11', squashed)).toBeUndefined();
  });

  it('accepts a date written before the pull request landed', () => {
    expect(lastmodProblem('2026-11-09', squashed)).toBeUndefined();
    expect(lastmodProblem('2026-11-06', squashed)).toBeUndefined();
  });

  it('accepts the day of the previous change, which a revert leaves behind', () => {
    // A branch that edits a page and reverts it still has a commit touching
    // that copy, so `landed` moves while the merged page keeps the older date.
    expect(lastmodProblem('2026-11-05', squashed)).toBeUndefined();
  });

  it('fails a date older than the previous change to the same copy', () => {
    expect(lastmodProblem('2026-11-04', squashed)).toMatch(
      /older than the previous change to the same copy \(2026-11-05\)/,
    );
  });

  it('fails a date nobody bumped on the change after next', () => {
    // Copy changes twice without the date being touched: the second change's
    // floor is the first change's day, so the stale date cannot survive it.
    expect(
      lastmodProblem('2026-11-05', {
        landed: '2026-11-20',
        previous: '2026-11-11',
      }),
    ).toMatch(/was not updated when the copy changed on 2026-11-20/);
  });

  it('fails a date git has no commit for', () => {
    expect(lastmodProblem('2026-12-01', squashed)).toMatch(
      /newer than the commit that changed its copy \(2026-11-11\)/,
    );
  });

  // New copy has no earlier version to predate, so the window has no floor. A
  // date that under-claims a brand new page costs nothing; announcing a change
  // git has no commit for is the failure that still applies.
  it('takes any past date for copy with no earlier version', () => {
    const first = { landed: '2026-11-11' };
    expect(lastmodProblem('2026-11-02', first)).toBeUndefined();
    expect(lastmodProblem('2026-11-12', first)).toMatch(/newer than/);
  });

  it('fails a page that declares no date at all', () => {
    expect(lastmodProblem(undefined, squashed)).toMatch(/declares no lastmod/);
  });
});
