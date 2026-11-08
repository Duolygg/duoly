/**
 * Ranked queue rank-gap rules, one entry per game Duoly sells.
 *
 * Every ranked queue limits how far apart two party members may sit, so the
 * honest promise is "the highest-ranked teammate the game's ranked queue allows
 * for your rank", and a wider gap only where the game itself opens one for a
 * full lobby. A catalog tier name such as "Duo Pro: Immortal+ teammate"
 * describes who Duoly hires; it never overrides the publisher's queue rule.
 *
 * Three rules this registry exists to keep:
 * 1. No page may claim a mid-ladder customer duos a ranked queue with a
 *    top-tier teammate where the publisher forbids it.
 * 2. A full lobby widens the gap only where `fullLobby` says `wider`. It does
 *    not in League Flex, Apex, Rainbow Six Siege, Black Ops 7 above Diamond,
 *    Marvel Rivals above Grandmaster or Pokemon UNITE.
 * 3. Where the publisher does not publish a rule, copy says only that the
 *    teammate has to be eligible to queue with you under the rules of the game.
 *    `UNKNOWN_RULE` is that sentence, so every page words it the same way.
 *
 * Nothing here describes a session as raising a customer's rank. Ubisoft's
 * Player Protection Core Rules prohibit paying for rank inflation outright, and
 * Duoly sells shared playing time rather than a result.
 *
 * Sources are the publisher's own page, fetched and read on `RANK_RULES_CHECKED`.
 * Research notes live in ai-agents-research/12-ranked-queue-rules.md.
 */

/** The day every source URL below was fetched and read. */
export const RANK_RULES_CHECKED = '2026-11-08';
export const RANK_RULES_CHECKED_LABEL = '8 November 2026';

/**
 * The honest wording wherever a publisher documents no rank-gap rule.
 *
 * The leading noun is left out on purpose: a page says "teammate", "partner"
 * or "raider" depending on what the game calls the person, and the promise is
 * the same sentence either way.
 */
export const UNKNOWN_RULE =
  'has to be eligible to queue with you under the rules of the game';

export interface RankRule {
  gameSlug: string;
  /** The company whose published rule the copy cites. */
  publisher: string;
  /** Does the game's own full lobby open a wider gap than a duo? */
  fullLobby: 'wider' | 'same' | 'unknown' | 'none';
  /**
   * Highest teammate a mid-ladder customer may queue the ranked mode with, in
   * the game's own tier names. `undefined` where no official cap is published.
   */
  duoCap?: string;
  /** The customer rank `duoCap` is measured from. */
  duoFrom?: string;
  /** One line summarising the rule, for the PR table and the tests below. */
  summary: string;
  /** A phrase every page about this game's ranked sessions has to contain. */
  mustSay: string;
  /** Phrases no page about this game may contain. */
  mustNotSay: string[];
  source: { label: string; url: string };
}

export const RANK_RULES: RankRule[] = [
  {
    gameSlug: 'valorant',
    publisher: 'Riot Games',
    fullLobby: 'wider',
    duoFrom: 'Gold',
    duoCap: 'Platinum',
    summary:
      'Competitive duos move one tier, so Gold queues with Platinum. A five-stack carries any ranks, with RR cut 25% to 90%.',
    mustSay: 'one tier',
    mustNotSay: [
      'Gold player queues Competitive with an Immortal',
      'any rank can queue Competitive',
    ],
    source: {
      label: 'VALORANT Competitive Mode FAQ',
      url: 'https://support.riotgames.com/en-us/valorant/gameplay/valorant-competitive-mode-faq',
    },
  },
  {
    gameSlug: 'league-of-legends',
    publisher: 'Riot Games',
    fullLobby: 'same',
    duoFrom: 'Gold',
    duoCap: 'Platinum I',
    summary:
      'Solo/Duo caps Gold at Platinum I. Ranked Flex is looser below Diamond, but Master and above may only queue with Emerald and up, in a five as well.',
    mustSay: 'Emerald',
    mustNotSay: ['Challenger five', 'Gold and Challenger can duo'],
    source: {
      label: 'Ranked Tiers, Divisions, and Queues',
      url: 'https://support.riotgames.com/en-us/league-of-legends/gameplay/ranked-tiers-divisions-and-queues',
    },
  },
  {
    gameSlug: 'teamfight-tactics',
    publisher: 'Riot Games',
    fullLobby: 'wider',
    duoFrom: 'Gold',
    duoCap: 'Challenger in Double Up',
    summary:
      'Double Up pairs carry any rank combination and are matched on the higher rank. Standard Ranked caps Gold at Platinum I and parties at 3.',
    mustSay: 'Double Up',
    mustNotSay: ['eight-player ranked party'],
    source: {
      label: 'TFT Double Up',
      url: 'https://support.riotgames.com/en-us/tft/account/tft-double-up',
    },
  },
  {
    gameSlug: 'counter-strike-2',
    publisher: 'FACEIT',
    fullLobby: 'wider',
    summary:
      'Valve publishes no Premier party rating gap. A FACEIT Standard five has no party Elo restriction, so a full stack is the documented wide-gap route.',
    mustSay: 'FACEIT',
    mustNotSay: ['Premier allows any rating gap'],
    source: {
      label: 'CS2 Match Types FAQ (Super Match and Premium Match)',
      url: 'https://support.faceit.com/hc/en-us/articles/16873836685340-CS2-Match-Types-FAQ-Super-Match-and-Premium-Match',
    },
  },
  {
    gameSlug: 'fortnite',
    publisher: 'Epic Games',
    fullLobby: 'unknown',
    summary:
      'Epic Games documents that Ranked matchmaking uses the highest rank in the party and publishes no rank-gap cap.',
    mustSay: 'highest rank',
    mustNotSay: ['no rank restrictions at all'],
    source: {
      label: 'Fortnite Ranked Play explained',
      url: 'https://www.fortnite.com/competitive/discover-competitive/fortnite-ranked-play-explained',
    },
  },
  {
    gameSlug: 'apex-legends',
    publisher: 'EA',
    fullLobby: 'same',
    duoFrom: 'Gold',
    duoCap: 'Diamond',
    summary:
      'Every premade Ranked squad stays within two rank tiers, duos and trios alike, so Gold queues with Diamond at most. A full trio does not widen it.',
    mustSay: 'two rank tiers',
    mustNotSay: ['Apex Predator teammate for a Gold', 'full trio lifts'],
    source: {
      label: 'How Apex Legends Ranked works',
      url: 'https://help.ea.com/en/articles/apex-legends/ranked/',
    },
  },
  {
    gameSlug: 'overwatch-2',
    publisher: 'Blizzard',
    fullLobby: 'wider',
    duoFrom: 'Gold',
    duoCap: 'Champion',
    summary:
      'Wide groups removed the rank-gap limit in April 2024, so even a duo may cross the ladder. A wide group reduces rank change, and a wide four cannot queue.',
    mustSay: 'wide group',
    mustNotSay: ['wide group of four can queue', 'wide four may queue'],
    source: {
      label: 'Defense Matrix Update: Season 10 and Beyond',
      url: 'https://overwatch.blizzard.com/en-us/news/24061006/defense-matrix-update-season-10-and-beyond/',
    },
  },
  {
    gameSlug: 'marvel-rivals',
    publisher: 'NetEase Games',
    fullLobby: 'same',
    summary:
      'Bronze through Grandmaster may use any party size except five. Celestial, Eternity and One Above All queue solo or as a duo, so a six caps at Grandmaster.',
    mustSay: 'Grandmaster',
    mustNotSay: ['Celestial six', 'One Above All teammate for a Gold'],
    source: {
      label: 'Marvel Rivals Version 20251114 Patch Notes',
      url: 'https://www.marvelrivals.com/20251114/41525_1270590.html',
    },
  },
  {
    gameSlug: 'rainbow-six-siege',
    publisher: 'Ubisoft',
    fullLobby: 'same',
    duoFrom: 'Gold',
    duoCap: 'Emerald',
    summary:
      'Ranked 3.0 lets Copper to Emerald queue within three full ranks and limits Diamond and Champion to two, so Gold queues with Emerald. A five follows the same limits.',
    mustSay: 'three full ranks',
    mustNotSay: ['no squad restrictions', 'Champion teammate for a Gold'],
    source: {
      label: 'Ranked 3.0 Update',
      url: 'https://www.ubisoft.com/en-au/game/rainbow-six/siege/news-updates/5fzYRZKVVHqqRkkv3m4MyF/ranked-30-update',
    },
  },
  {
    gameSlug: 'call-of-duty',
    publisher: 'Activision',
    fullLobby: 'same',
    duoFrom: 'Gold',
    duoCap: 'Diamond',
    summary:
      'Black Ops 7 keeps Crimson and above in parties of one or two within one rank, so Gold queues with Diamond. A four may mix ranks only at Diamond and below.',
    mustSay: 'Diamond or below',
    mustNotSay: ['Iridescent teammate for a Gold', 'any rank in a four'],
    source: {
      label: 'Call of Duty: Black Ops 7 Ranked Play',
      url: 'https://support.activision.com/black-ops-7/articles/black-ops-7-ranked-play',
    },
  },
  {
    gameSlug: 'rocket-league',
    publisher: 'Psyonix',
    fullLobby: 'wider',
    duoFrom: 'Gold',
    duoCap: 'Supersonic Legend in Doubles',
    summary:
      'The rank disparity restriction only applies to undersized parties, so a Doubles pair is already a full team and any gap works. A 3v3 pair stays within three ranks.',
    mustSay: 'undersized',
    mustNotSay: ['Standard pair at any rank'],
    source: {
      label: 'How does the matchmaking and rank system work in Rocket League?',
      url: 'https://epicgames.com/help/c-37599050/c-32343914/how-does-the-matchmaking-and-rank-system-work-in-rocket-league-a12805879',
    },
  },
  {
    gameSlug: 'pokemon-unite',
    publisher: 'The Pokemon Company',
    fullLobby: 'same',
    duoCap: 'two ranks up',
    summary:
      'Ranks have to be the same or within two levels to invite a friend to a Ranked match, and no full-team exemption is published.',
    mustSay: 'two levels',
    mustNotSay: ['any rank in a five'],
    source: {
      label: 'Why can’t I join my friend in a ranked match in Pokemon UNITE?',
      url: 'https://support.pokemon.com/hc/en-us/articles/4403513527188-Why-can-t-I-join-my-friend-in-a-ranked-match-in-Pok%C3%A9mon-UNITE',
    },
  },
  {
    gameSlug: 'ea-sports-fc-27',
    publisher: 'EA',
    fullLobby: 'unknown',
    summary:
      'Co-op Rivals matches on the higher-ranked player of the pair. EA publishes no division-gap cap for Co-op or Clubs.',
    mustSay: 'higher-ranked',
    mustNotSay: ['no division limit exists'],
    source: {
      label: 'How EA SPORTS FC Ultimate Team Rivals work',
      url: 'https://help.ea.com/en/articles/ea-sports-fc/ultimate-team-rivals',
    },
  },
  {
    gameSlug: 'arc-raiders',
    publisher: 'Embark Studios',
    fullLobby: 'none',
    summary:
      'ARC Raiders has no ranked tier queue, so no rank gap applies. Matchmaking reads playstyle history, squad size and latency.',
    mustSay: 'no ranked tier',
    mustNotSay: ['ranked rank gap'],
    source: {
      label: 'Notes on The Matchmaking System',
      url: 'https://arcraiders.com/news/notes-on-the-matchmaking-system',
    },
  },
  {
    gameSlug: 'minecraft',
    publisher: 'Mojang',
    fullLobby: 'none',
    summary:
      'Minecraft has no universal ranked queue, so no rank gap applies. Each community server sets its own ranks and rules.',
    mustSay: 'no universal ranked queue',
    mustNotSay: ['ranked rank gap'],
    source: {
      label: 'Minecraft Servers',
      url: 'https://www.minecraft.net/en-us/servers',
    },
  },
];

/**
 * Games with a hub but no verified queue rule yet.
 *
 * Every entry is a game added to the catalog after the November 2026 research
 * pass, so nobody has read its publisher's queue rules yet. The rank-rules test
 * asserts this list equals exactly the set of hubs with no RANK_RULES entry, so
 * a new game cannot quietly ship without the rule and this list cannot quietly
 * go stale: adding the rule here and removing the slug is one change.
 *
 * Until a game leaves this list, its hub must not promise any particular rank
 * gap. Research each publisher's own page, then add a RANK_RULES entry.
 */
export const AWAITING_RANK_RESEARCH = [
  'dota-2',
  'world-of-warcraft',
  'pubg',
  'wild-rift',
  'deadlock',
] as const;

export const rankRuleFor = (slug: string) =>
  RANK_RULES.find((rule) => rule.gameSlug === slug);

/**
 * Claims no customer-facing page may make, whatever the game. Paid rank
 * inflation is banned outright by Ubisoft and promised by nobody else here, so
 * the wording a seller reaches for first is the wording to keep out.
 */
export const FORBIDDEN_CLAIMS: RegExp[] = [
  /\b(?:raise|raises|raising|boost|boosts|boosting|inflate|inflates|increase|increases|increasing)\s+(?:your|their|the customer['’]s)\s+rank\b/i,
  /\brank\s+(?:boost|boosting|inflation)\b/i,
  /\bguaranteed\s+(?:rank|promotion|win|climb)\b/i,
  /\bwe\s+(?:will\s+)?(?:get|take)\s+you\s+to\s+[A-Z]/,
];
