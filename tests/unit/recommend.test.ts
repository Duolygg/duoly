import { describe, expect, it } from 'vitest';
import type { PublicTeammateProfile } from '../../src/contracts/teammate-profile';
import { recommendFor } from '../../src/server/teammates/recommend';

const profile = (
  over: Partial<PublicTeammateProfile> = {},
): PublicTeammateProfile => ({
  slug: 'nyx',
  name: 'Nyx',
  avatar: '/assets/avatars/avatar-3.png',
  country: null,
  languages: ['English'],
  bio: '',
  accent: 'lavender',
  banner: 'slash',
  vibeTags: [],
  featuredGame: 'val',
  coaching: false,
  online: false,
  memberSince: '2026-03',
  sessions: 0,
  tier: 'rookie',
  rating: null,
  reviewTags: [],
  winRate: null,
  games: [
    {
      game: 'val',
      rank: 'Immortal 3',
      peakRank: null,
      verified: true,
      roles: [],
      picks: [],
    },
  ],
  reviews: [],
  updatedAt: '2026-11-12T12:00:00.000Z',
  ...over,
});

describe('recommendFor', () => {
  it('does not recommend an unoffered or unknown selected game', () => {
    const p = profile({ vibeTags: ['Chill'] });
    expect(recommendFor(p, 'lol')).toBeNull();
    expect(recommendFor(p, 'unknown')).toBeNull();
  });
  it('uses the selected game rank and booking link instead of the lead game', () => {
    const p = profile({
      featuredGames: ['val', 'lol'],
      games: [
        ...profile().games,
        {
          game: 'lol',
          rank: 'Challenger',
          peakRank: null,
          verified: true,
          roles: [],
          picks: [],
        },
      ],
    });
    const r = recommendFor(p, 'lol')!;
    expect(r.pick.href).toContain('game=lol');
    expect(r.pick.reasons[0]?.fact).toBe('Verified Challenger');
    expect(recommendFor(p)).toEqual(recommendFor(p, 'val'));
  });
  it('picks the highest duo tier the verified rank qualifies for, never above it', () => {
    const r = recommendFor(
      profile({
        vibeTags: ['Shotcaller'],
        reviewTags: [{ tag: 'Carried hard', count: 30 }],
      }),
    )!;
    expect(r.pick.kind).toBe('duo');
    /* Immortal 3 reaches Duo Pro (Immortal+) but not Duo Apex (Radiant). */
    expect(r.pick.title).toBe('Duo Pro');
    expect(r.pick.reasons[0]).toEqual({
      fact: 'Verified Immortal 3',
      because: 'qualifies Nyx for Duo Pro, the Immortal+ teammate tier',
    });
    expect(r.pick.href).toContain('service=duo2');
  });

  it('only offers a duo tier for a verified rank', () => {
    const r = recommendFor(
      profile({
        games: [
          {
            game: 'val',
            rank: 'Immortal 3',
            peakRank: null,
            verified: false,
            roles: [],
            picks: [],
          },
        ],
        vibeTags: ['Chill'],
      }),
    )!;
    expect(r.pick.kind).toBe('casual');
    expect(r.alternatives.map((a) => a.kind)).not.toContain('duo');
  });

  it('turns to coaching when customers say they learned and the teammate coaches', () => {
    const r = recommendFor(
      profile({
        coaching: true,
        vibeTags: ['Teaches as we play', 'Patient'],
        reviewTags: [{ tag: 'Taught me a lot', count: 50 }],
      }),
    )!;
    expect(r.pick.kind).toBe('coach');
    expect(r.pick.title).toBe('Play and Learn');
    expect(r.pick.reasons.map((x) => x.fact)).toContain(
      '"Taught me a lot" × 50',
    );
  });

  it('never recommends coaching for a teammate who does not coach', () => {
    const r = recommendFor(
      profile({
        vibeTags: ['Teaches as we play'],
        reviewTags: [{ tag: 'Taught me a lot', count: 50 }],
      }),
    )!;
    expect([r.pick, ...r.alternatives].map((x) => x.kind)).not.toContain(
      'coach',
    );
  });

  it('counts a minor review tag at half weight and says online only when online', () => {
    const quiet = recommendFor(
      profile({
        reviewTags: [
          { tag: 'Great comms', count: 100 },
          { tag: 'Carried hard', count: 10 },
        ],
      }),
    )!;
    const live = recommendFor(profile({ online: true }))!;
    expect(quiet.pick.score).toBe(3 + 1 + 1);
    expect(quiet.pick.reasons.at(-1)?.fact).not.toBe('Online now');
    expect(live.pick.reasons.at(-1)?.fact).toBe('Online now');
  });

  it('has nothing to say without a single matching signal', () => {
    expect(
      recommendFor(
        profile({
          games: [
            {
              game: 'val',
              rank: null,
              peakRank: null,
              verified: false,
              roles: [],
              picks: [],
            },
          ],
        }),
      ),
    ).toBeNull();
  });
  it('gives a Gamer Girl featuring Social a Social session that fits her play style', () => {
    const r = recommendFor(
      profile({
        featuredGame: 'social',
        gamerGirl: true,
        vibeTags: ['Night owl', 'Chill'],
        games: [
          {
            game: 'social',
            rank: null,
            peakRank: null,
            verified: false,
            roles: [],
            picks: [],
          },
        ],
      }),
    )!;
    expect(r.pick.kind).toBe('gg');
    expect(r.pick.title).toBe('Sleep Call');
    expect(r.pick.reasons[0]?.fact).toBe('Verified Gamer Girl');
    expect(r.pick.href).toContain('game=social');
  });

  it('never offers a Gamer Girl service to a teammate without Gamer Girl access', () => {
    const r = recommendFor(profile({ vibeTags: ['Chill', 'Night owl'] }))!;
    expect([r.pick, ...r.alternatives].map((x) => x.kind)).not.toContain('gg');
  });
});
