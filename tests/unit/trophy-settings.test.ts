import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TrophySettings, {
  emptyDraft,
  gameName,
  kindsFor,
  toSubmission,
} from '../../src/components/account/TrophySettings.jsx';
import TrophyQueue from '../../src/components/admin/TrophyQueue.jsx';
import {
  TrophySubmissionSchema,
  trophyGame,
} from '../../src/contracts/trophies';

const forbiddenCopy = ['\u2013', '\u2014', ' & '];

describe('trophy settings helpers', () => {
  it('offers all trophy kinds for League of Legends', () => {
    expect(kindsFor('lol').map(([id]) => id)).toEqual([
      'rank',
      'leaderboard',
      'tournament',
      'title',
    ]);
  });

  it('does not offer rank trophies for Minecraft', () => {
    expect(kindsFor('mc').map(([id]) => id)).not.toContain('rank');
  });

  it('offers no trophy kinds for an unknown game', () => {
    expect(kindsFor('unknown')).toEqual([]);
  });

  it('starts a Valorant draft at peak rank on its first ladder', () => {
    const game = trophyGame('val');
    expect(game?.ladders[0]).toBeDefined();
    expect(emptyDraft('val')).toMatchObject({
      kind: 'rank',
      ladder: game?.ladders[0]?.id,
      moment: 'peak',
    });
  });

  it('does not start a Minecraft draft with a rank', () => {
    expect(emptyDraft('mc').kind).not.toBe('rank');
  });

  it('converts a Valorant rank draft into a valid numeric submission', () => {
    const submission: Record<string, unknown> = toSubmission({
      ...emptyDraft('val'),
      tier: 'radiant',
      season: 'Episode 10 Act 3',
      value: '612',
      region: '',
    });
    expect(submission.value).toBe(612);
    expect(submission.region).toBeNull();
    expect(TrophySubmissionSchema.safeParse(submission).success).toBe(true);
  });

  it('converts a tournament draft without leaking rank fields', () => {
    const submission: Record<string, unknown> = toSubmission({
      ...emptyDraft('lol'),
      kind: 'tournament',
      tier: 'challenger',
      event: 'Prime League',
      position: '2',
      proofUrl: 'https://liquipedia.net/x',
    });
    expect(submission.position).toBe(2);
    expect(submission).not.toHaveProperty('ladder');
    expect(submission).not.toHaveProperty('tier');
    expect(TrophySubmissionSchema.safeParse(submission).success).toBe(true);
  });

  it('rejects an empty title with a validation message', () => {
    const parsed = TrophySubmissionSchema.safeParse(
      toSubmission({ ...emptyDraft('lol'), kind: 'title', title: '' }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('An empty title must be rejected.');
    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['title'], message: 'Add the title.' }),
      ]),
    );
  });

  it('names Valorant', () => {
    expect(gameName('val')).toBe('Valorant');
  });

  it('keeps an unknown game id as its name', () => {
    expect(gameName('unknown')).toBe('unknown');
  });
});

describe('trophy settings rendering', () => {
  it('renders the trophy case loading state with clean copy', () => {
    const html = renderToStaticMarkup(
      React.createElement(TrophySettings, { csrf: 'x' } as never),
    );
    expect(html).toContain('Trophy case');
    expect(html).toContain('Loading');
    for (const text of forbiddenCopy) expect(html).not.toContain(text);
  });
});

describe('admin trophy queue rendering', () => {
  it('renders all status buttons while trophies load', () => {
    const api = {
      get: async () => ({ ok: true, data: { trophies: [] } }),
      post: async () => ({ ok: true, data: {} }),
    };
    const html = renderToStaticMarkup(
      React.createElement(TrophyQueue, { api } as never),
    );
    for (const status of ['Waiting', 'Approved', 'Rejected']) {
      expect(html).toMatch(new RegExp(`<button\\b[^>]*>${status}</button>`));
    }
    expect(html).toContain('Loading trophies');
  });
});

describe('trophy component copy', () => {
  it.each([
    'src/components/account/TrophySettings.jsx',
    'src/components/admin/TrophyQueue.jsx',
  ])('keeps forbidden punctuation out of %s', (path) => {
    const source = readFileSync(path, 'utf8');
    for (const text of forbiddenCopy) expect(source).not.toContain(text);
  });
});
