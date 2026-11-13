import type { PublicTrophy } from '../../contracts/trophies';
/** Fictional design/test data. Loaded only by the explicit fixture flag, never deploy fixtures. */
import {
  profileIndexable,
  type PublicTeammateProfile,
  type PublicTeammateCard,
} from '../../contracts/teammate-profile';
import type { ProfileLookup } from './public-profiles';
const nyx: PublicTeammateProfile = {
  slug: 'nyx',
  name: 'Nyx',
  avatar: '/assets/avatars/avatar-3.png',
  country: 'Austria',
  languages: ['German', 'English'],
  bio: "Calm comms, clean utility, zero tilt. I play Omen like it's chess and I'll explain every smoke if you want to learn.",
  accent: 'lavender',
  banner: 'slash',
  vibeTags: ['Chill', 'Shotcaller', 'Teaches as we play'],
  featuredGame: 'val',
  coaching: true,
  online: true,
  memberSince: '2026-03',
  sessions: 312,
  tier: 'veteran',
  rating: { average: 4.9, count: 128 },
  reviewTags: [
    { tag: 'Great comms', count: 74 },
    { tag: 'Chill vibes', count: 61 },
    { tag: 'Taught me a lot', count: 40 },
    { tag: 'Carried hard', count: 33 },
  ],
  winRate: { percent: 58, games: 214 },
  games: [
    {
      game: 'val',
      rank: 'Immortal 3',
      peakRank: 'Radiant',
      verified: true,
      roles: ['Controller', 'Initiator'],
      picks: ['Omen', 'Sova', 'Viper'],
    },
    {
      game: 'lol',
      rank: 'Master',
      peakRank: 'Grandmaster',
      verified: true,
      roles: ['Jungle', 'Support'],
      picks: ['Lee Sin', 'Vi', 'Thresh'],
    },
  ],
  reviews: [
    {
      rating: 5,
      text: 'We worked on two smoke lineups, then used them in the next game. Clear explanations between rounds.',
      game: 'val',
      month: '2026-10',
    },
    {
      rating: 5,
      text: 'Kept the calls simple when we were behind. Made it easier to reset and play the next round.',
      game: 'val',
      month: '2026-10',
    },
    {
      rating: 5,
      text: 'Played support while I learned jungle. Helpful objective pings and no backseat driving.',
      game: 'lol',
      month: '2026-09',
    },
    { rating: 5, text: '', game: 'val', month: '2026-09' },
  ],
  updatedAt: '2026-11-12T12:00:00.000Z',
};
/**
 * The state every real profile is in today: zero reviews, zero completed sessions, zero verified
 * ranks, and games beyond Valorant and League. These three exist so the "New on Duoly" layout, the
 * generic game accents and the missing-bio and missing-languages cases are all covered by tests
 * and screenshots instead of being discovered in production.
 */
const newcomers: PublicTeammateProfile[] = [
  {
    slug: 'rhea',
    name: 'Rhea',
    avatar: '/assets/avatars/avatar-6.png',
    country: null,
    languages: ['German', 'English'],
    bio: 'Jungle and support main. I like setting up vision before an objective instead of guessing, and I will say out loud what I am about to do.',
    accent: 'violet',
    banner: 'grid',
    vibeTags: ['Shotcaller', 'Teaches as we play'],
    featuredGame: 'lol',
    coaching: false,
    online: true,
    memberSince: '2026-11',
    sessions: 0,
    tier: 'rookie',
    rating: null,
    reviewTags: [],
    winRate: null,
    games: [
      {
        game: 'lol',
        rank: null,
        peakRank: null,
        verified: false,
        roles: ['Jungle', 'Support'],
        picks: ['Sejuani', 'Rell'],
      },
      {
        game: 'tft',
        rank: null,
        peakRank: null,
        verified: false,
        roles: [],
        picks: [],
      },
    ],
    reviews: [],
    updatedAt: '2026-11-12T12:00:00.000Z',
  },
  {
    slug: 'pip',
    name: 'Pip',
    avatar: '/assets/avatars/avatar-2.png',
    country: null,
    /* No bio and no languages: both fields are optional on an account. */
    languages: [],
    bio: '',
    accent: 'gold',
    banner: 'pulse',
    vibeTags: [],
    featuredGame: 'tft',
    coaching: false,
    online: false,
    memberSince: '2026-11',
    sessions: 0,
    tier: 'rookie',
    rating: null,
    reviewTags: [],
    winRate: null,
    games: [
      {
        game: 'tft',
        rank: null,
        peakRank: null,
        verified: false,
        roles: [],
        picks: [],
      },
    ],
    reviews: [],
    updatedAt: '2026-11-12T12:00:00.000Z',
  },
  {
    slug: 'crafty',
    name: 'Crafty',
    avatar: '/assets/avatars/avatar-9.png',
    country: 'Netherlands',
    languages: ['English', 'Dutch'],
    bio: 'Survival and redstone. I build the farm with you rather than handing over a finished world, and I keep the pace to whatever you feel like playing.',
    accent: 'mint',
    banner: 'orbit',
    vibeTags: ['Chill', 'Patient'],
    featuredGame: 'mc',
    coaching: false,
    online: false,
    memberSince: '2026-10',
    sessions: 0,
    tier: 'rookie',
    rating: null,
    reviewTags: [],
    winRate: null,
    games: [
      {
        game: 'mc',
        rank: null,
        peakRank: null,
        verified: false,
        roles: ['Builder'],
        picks: [],
      },
      {
        game: 'pu',
        rank: null,
        peakRank: null,
        verified: false,
        roles: ['Support'],
        picks: [],
      },
    ],
    reviews: [],
    updatedAt: '2026-11-12T12:00:00.000Z',
  },
];
const profiles: PublicTeammateProfile[] = [
  nyx,
  {
    ...nyx,
    // The one fixture teammate with an uploaded header (served from a local file in e2e).
    header:
      'https://duolyfixture.supabase.co/storage/v1/object/public/profile-headers/3f9b7c21-5d64-4ab8-9f0e-2c7d81a4e6b5/91d4c7f0ab2e5368.webp',
    slug: 'sola',
    name: 'Sola',
    avatar: '/assets/avatars/avatar-8.png',
    country: null,
    accent: 'mint',
    banner: 'orbit',
    bio: 'Quiet focus. Happy to queue together.',
    vibeTags: ['Quiet focus', 'Patient'],
    coaching: false,
    online: false,
    sessions: 2,
    tier: 'rookie',
    rating: null,
    winRate: null,
    reviewTags: [],
    reviews: [],
    /* No verified rank, a bio under 60 characters and two sessions: the thin page the
       quality rule has to keep out of the index. */
    games: [
      {
        game: 'val',
        rank: null,
        peakRank: null,
        verified: false,
        roles: ['Sentinel'],
        picks: ['Killjoy', 'Cypher'],
      },
    ],
    memberSince: '2026-11',
  },
  {
    ...nyx,
    slug: 'kairo',
    name: 'Kairo',
    avatar: '/assets/avatars/avatar-5.png',
    accent: 'gold',
    banner: 'pulse',
    bio: 'Patient jungle pathing, decisive calls around objectives. I like finding the small decisions that make your next game feel easier.',
    vibeTags: ['Patient', 'Strategy nerd'],
    featuredGame: 'lol',
    sessions: 1240,
    tier: 'legend',
    rating: { average: 4.9, count: 420 },
    winRate: { percent: 61, games: 680 },
    games: [
      {
        game: 'lol',
        rank: 'Challenger',
        peakRank: 'Challenger',
        verified: true,
        roles: ['Jungle', 'Mid'],
        picks: ['Lee Sin', 'Ahri', 'Viego'],
      },
      {
        game: 'val',
        rank: 'Immortal 2',
        peakRank: 'Immortal 3',
        verified: true,
        roles: ['Initiator', 'Duelist'],
        picks: ['Sova', 'Fade', 'Jett'],
      },
    ],
  },
  /* Spread from Nyx for the shape, then given their own words: three fixture profiles that
     published the same bio and the same reviews read as one teammate rendered three times. */
  {
    ...nyx,
    slug: 'lumi',
    name: 'Lumi',
    /*
     * The teammate who uploaded a photo. Shaped exactly like a real one: the public avatars
     * bucket, the folder named after the account, a 16 character content hash and a WebP
     * (20261023150000_avatar_uploads.sql). The e2e run answers this URL from a local fixture
     * file, so the photo path is covered without reaching the network.
     */
    avatar:
      'https://duolyfixture.supabase.co/storage/v1/object/public/avatars/3f9b7c21-5d64-4ab8-9f0e-2c7d81a4e6b5/7c1a4e9b20d53f68.webp',
    country: 'Sweden',
    languages: ['English', 'Swedish'],
    bio: 'Sentinel main. I hold a site, call what I hear and would rather win a slow round than a loud one.',
    accent: 'cyan',
    banner: 'grid',
    vibeTags: ['Quiet focus', 'Shotcaller'],
    coaching: false,
    tier: 'trusted',
    memberSince: '2026-05',
    sessions: 140,
    rating: { average: 4.8, count: 62 },
    winRate: { percent: 54, games: 118 },
    reviewTags: [
      { tag: 'Great comms', count: 38 },
      { tag: 'Clutch', count: 24 },
      { tag: 'Chill vibes', count: 19 },
    ],
    games: [
      {
        game: 'val',
        rank: 'Ascendant 3',
        peakRank: 'Immortal 1',
        verified: true,
        roles: ['Sentinel', 'Controller'],
        picks: ['Killjoy', 'Cypher', 'Astra'],
      },
    ],
    reviews: [
      {
        rating: 5,
        text: 'Held B alone for most of the match and told me exactly when to rotate.',
        game: 'val',
        month: '2026-10',
      },
      {
        rating: 5,
        text: 'Quiet between rounds, useful during them. Good calls on the retakes.',
        game: 'val',
        month: '2026-09',
      },
    ],
  },
  {
    ...nyx,
    slug: 'echo',
    name: 'Echo',
    avatar: '/assets/avatars/avatar-10.png',
    country: 'Spain',
    languages: ['Spanish', 'English'],
    bio: 'Duelist. I take the first fight so you do not have to, and I will tell you what I saw before the next round starts.',
    accent: 'pink',
    vibeTags: ['Tryhard', 'Mechanics first'],
    tier: 'elite',
    memberSince: '2026-01',
    sessions: 620,
    rating: { average: 4.9, count: 230 },
    winRate: { percent: 61, games: 430 },
    reviewTags: [
      { tag: 'Carried hard', count: 96 },
      { tag: 'Great comms', count: 71 },
      { tag: 'Taught me a lot', count: 29 },
    ],
    games: [
      {
        game: 'val',
        rank: 'Immortal 1',
        peakRank: 'Immortal 3',
        verified: true,
        roles: ['Duelist', 'Initiator'],
        picks: ['Jett', 'Raze', 'Fade'],
      },
    ],
    reviews: [
      {
        rating: 5,
        text: 'Opened nearly every round and still had the patience to explain the entry after it worked.',
        game: 'val',
        month: '2026-10',
      },
      {
        rating: 4,
        text: 'Very fast player. I had to ask for slower calls, and they adjusted straight away.',
        game: 'val',
        month: '2026-08',
      },
    ],
    online: false,
  },
  ...newcomers,
];
const fixtureSafe = () =>
  process.env.NODE_ENV !== 'production' &&
  process.env.VERCEL_ENV !== 'production';
export function fixtureLookup(slug: string): ProfileLookup {
  if (!fixtureSafe()) return { status: 'missing' };
  if (slug === 'nyxie') return { status: 'moved', slug: 'nyx' };
  if (slug === 'ghost') return { status: 'gone' };
  const profile = profiles.find((p) => p.slug === slug);
  return profile
    ? { status: 'ok', profile: structuredClone(profile) }
    : { status: 'missing' };
}
export function fixtureCards(options: {
  game?: string;
  limit: number;
  excludeSlug?: string;
}): PublicTeammateCard[] {
  if (!fixtureSafe()) return [];
  return profiles
    .filter(
      (p) =>
        p.slug !== options.excludeSlug &&
        (!options.game || p.games.some((g) => g.game === options.game)),
    )
    .sort((a, b) => Number(b.online) - Number(a.online))
    .slice(0, options.limit)
    .map((p) => {
      const game = p.games.find(
        (g) => g.game === (options.game ?? p.featuredGame),
      )!;
      return {
        slug: p.slug,
        name: p.name,
        avatar: p.avatar,
        accent: p.accent,
        tier: p.tier,
        online: p.online,
        game: game.game,
        rank: game.verified ? game.rank : null,
        rating: p.rating,
      };
    });
}
export const fixtureIndexable = () =>
  (fixtureSafe() ? profiles : [])
    .filter(profileIndexable)
    .map(({ slug, updatedAt }) => ({ slug, updatedAt }));

/**
 * Trophy case fixtures. Nyx has a full case across every rarity; Rhea has only mid-ladder
 * trophies, so the layout is checked where nothing is legendary.
 */
const trophy = (
  t: Partial<PublicTrophy> &
    Pick<PublicTrophy, 'id' | 'game' | 'kind' | 'rarity'>,
): PublicTrophy => ({
  ladder: null,
  tier: null,
  division: null,
  value: null,
  moment: null,
  season: null,
  region: null,
  position: null,
  event: null,
  title: null,
  achievedOn: null,
  proofUrl: null,
  verifiedAt: '2026-11-11T10:00:00.000Z',
  ...t,
});
const TROPHIES: Record<string, PublicTrophy[]> = {
  nyx: [
    trophy({
      id: 'f0000000-0000-4000-8000-000000000001',
      game: 'val',
      kind: 'rank',
      rarity: 'mythic',
      ladder: 'rank',
      tier: 'radiant',
      moment: 'peak',
      season: 'Episode 10 Act 3',
      region: 'EU',
      value: 612,
      proofUrl: 'https://tracker.gg/valorant/profile/riot/Nyx%23EUW/overview',
    }),
    trophy({
      id: 'f0000000-0000-4000-8000-000000000002',
      game: 'val',
      kind: 'leaderboard',
      rarity: 'legendary',
      position: 412,
      season: 'Episode 10 Act 2',
      region: 'EU',
    }),
    trophy({
      id: 'f0000000-0000-4000-8000-000000000003',
      game: 'lol',
      kind: 'rank',
      rarity: 'legendary',
      ladder: 'rank',
      tier: 'grandmaster',
      moment: 'season_end',
      season: '2025',
      region: 'EUW',
      value: 588,
    }),
    trophy({
      id: 'f0000000-0000-4000-8000-000000000004',
      game: 'val',
      kind: 'tournament',
      rarity: 'epic',
      position: 2,
      event: 'VCL Germany Open Qualifier',
      achievedOn: '2026-06-14',
      proofUrl: 'https://liquipedia.net/valorant/VCL/2026/DACH',
    }),
    trophy({
      id: 'f0000000-0000-4000-8000-000000000005',
      game: 'val',
      kind: 'rank',
      rarity: 'legendary',
      ladder: 'rank',
      tier: 'immortal',
      division: '3',
      moment: 'season_end',
      season: 'Episode 9 Act 3',
      region: 'EU',
    }),
    trophy({
      id: 'f0000000-0000-4000-8000-000000000006',
      game: 'lol',
      kind: 'rank',
      rarity: 'epic',
      ladder: 'rank',
      tier: 'diamond',
      division: 'I',
      moment: 'current',
      season: '2026 Split 3',
      region: 'EUW',
      value: 74,
    }),
    trophy({
      id: 'f0000000-0000-4000-8000-000000000007',
      game: 'lol',
      kind: 'rank',
      rarity: 'uncommon',
      ladder: 'rank',
      tier: 'platinum',
      division: 'II',
      moment: 'season_end',
      season: '2023',
      region: 'EUW',
    }),
    trophy({
      id: 'f0000000-0000-4000-8000-000000000008',
      game: 'val',
      kind: 'title',
      rarity: 'rare',
      title: 'Ace on Ascent, 5 for 5',
      achievedOn: '2026-03-02',
    }),
  ],
  rhea: [
    trophy({
      id: 'f0000000-0000-4000-8000-000000000011',
      game: 'lol',
      kind: 'rank',
      rarity: 'uncommon',
      ladder: 'rank',
      tier: 'platinum',
      division: 'I',
      moment: 'peak',
      season: '2026 Split 2',
      region: 'EUW',
      value: 41,
    }),
    trophy({
      id: 'f0000000-0000-4000-8000-000000000012',
      game: 'lol',
      kind: 'rank',
      rarity: 'uncommon',
      ladder: 'rank',
      tier: 'gold',
      division: 'II',
      moment: 'season_end',
      season: '2025',
      region: 'EUW',
    }),
    trophy({
      id: 'f0000000-0000-4000-8000-000000000013',
      game: 'lol',
      kind: 'tournament',
      rarity: 'uncommon',
      position: 9,
      event: 'Clash Weekend, Tier II',
    }),
  ],
};
export const fixtureTrophies = (slug: string): PublicTrophy[] =>
  fixtureSafe() ? structuredClone(TROPHIES[slug] ?? []) : [];
