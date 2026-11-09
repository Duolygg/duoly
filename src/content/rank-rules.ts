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
  /**
   * The game's own ranked tier names, lowest first, exactly as the rank picker
   * at checkout spells them (src/design-reference/lib/ranks.js). Empty for a
   * game with no tier ladder to pair at all, such as Counter-Strike ratings.
   */
  ladder: string[];
  /**
   * Highest teammate tier the game's ordinary ranked party admits, per customer
   * tier, derived from the publisher's own table in `source`. This is the narrow
   * window: a pairing beyond it is honest only through `widerRoutes`.
   *
   * Left out where the publisher documents no gap table at all. Copy for those
   * games may not name a cap and has to use `UNKNOWN_RULE` instead.
   */
  duoCaps?: Record<string, string>;
  /**
   * Phrases naming the game's own documented route to a wider gap, so a page
   * may pair ranks beyond `duoCaps` when it names one of them in the same
   * breath. Empty unless `fullLobby` is `wider`: a five is not a loophole in a
   * game whose publisher applies the same limits to a full team.
   */
  widerRoutes: string[];
  /** Modes this game runs with no rank gate, where any pairing is honest. */
  openModes: string[];
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
    ladder: [
      'Iron',
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Ascendant',
      'Immortal',
      'Radiant',
    ],
    // The FAQ table: Iron and Bronze reach Silver, Silver reaches Gold, Gold
    // reaches Platinum, and from Platinum up the window is one full tier with
    // the division kept (the official example pairs Platinum 2 with Diamond 2).
    duoCaps: {
      Iron: 'Silver',
      Bronze: 'Silver',
      Silver: 'Gold',
      Gold: 'Platinum',
      Platinum: 'Diamond',
      Diamond: 'Ascendant',
      Ascendant: 'Immortal',
      Immortal: 'Radiant',
      Radiant: 'Radiant',
    },
    widerRoutes: ['five-stack', 'five stack', 'full five', 'Stack Fill'],
    openModes: ['Swiftplay', 'Unrated', 'Deathmatch', 'Spike Rush'],
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
    ladder: [
      'Iron',
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Emerald',
      'Diamond',
      'Master',
      'Grandmaster',
      'Challenger',
    ],
    // The published Solo/Duo table. Diamond stops at Diamond here on purpose:
    // the only Diamond-with-Master row is Diamond I against a Master under
    // 200 LP, which is too narrow to state as a tier rule. Ranked Flex is
    // looser below Diamond, so a Flex pairing is worded by the mode rather
    // than by a second tier name, and Master and up still need Emerald.
    duoCaps: {
      Iron: 'Silver',
      Bronze: 'Silver',
      Silver: 'Gold',
      Gold: 'Platinum',
      Platinum: 'Emerald',
      Emerald: 'Diamond',
      Diamond: 'Diamond',
      Master: 'Master',
      Grandmaster: 'Grandmaster',
      Challenger: 'Challenger',
    },
    widerRoutes: [],
    openModes: ['ARAM', 'Normal Draft', 'normals', 'Swiftplay', 'Arena'],
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
    ladder: [
      'Iron',
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Emerald',
      'Diamond',
      'Master',
      'Grandmaster',
      'Challenger',
    ],
    // Standard Ranked: Iron, Bronze and Silver invite up to Gold, Gold invites
    // up to Platinum, and Platinum through Diamond stay inside one full rank.
    // The FAQ contradicts itself on Master and above, so those rows stay flat.
    duoCaps: {
      Iron: 'Gold',
      Bronze: 'Gold',
      Silver: 'Gold',
      Gold: 'Platinum',
      Platinum: 'Emerald',
      Emerald: 'Diamond',
      Diamond: 'Master',
      Master: 'Master',
      Grandmaster: 'Grandmaster',
      Challenger: 'Challenger',
    },
    widerRoutes: ['Double Up'],
    openModes: ['Normal', 'Hyper Roll'],
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
    // CS2 pairs a numeric Premier rating or a FACEIT level rather than named
    // tiers, so there is no tier pair for copy to get wrong here.
    ladder: [],
    widerRoutes: ['FACEIT Standard', 'full five', 'five-stack'],
    openModes: ['Casual', 'Deathmatch'],
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
    ladder: [
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Elite',
      'Champion',
      'Unreal',
    ],
    // No duoCaps: Epic documents highest-rank matchmaking and no admission
    // threshold, so naming a cap would be an invention either way.
    widerRoutes: [],
    openModes: ['Creative', 'box fights'],
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
    ladder: [
      'Rookie',
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Master',
      'Apex Predator',
    ],
    // Two rank tiers in either direction, duos and trios alike.
    duoCaps: {
      Rookie: 'Silver',
      Bronze: 'Gold',
      Silver: 'Platinum',
      Gold: 'Diamond',
      Platinum: 'Master',
      Diamond: 'Apex Predator',
      Master: 'Apex Predator',
      'Apex Predator': 'Apex Predator',
    },
    widerRoutes: [],
    openModes: ['Mixtape', 'pubs', 'Team Deathmatch', 'Control', 'Gun Run'],
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
    ladder: [
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Master',
      'Grandmaster',
      'Champion',
      'Top 500',
    ],
    // These are the narrow-group thresholds, not a hard limit: Bronze through
    // Diamond stay inside five skill divisions and Master inside three. A
    // pairing past them is still allowed, as a wide group with smaller rank
    // changes, which is why every wider pairing has to say "wide".
    duoCaps: {
      Bronze: 'Silver',
      Silver: 'Gold',
      Gold: 'Platinum',
      Platinum: 'Diamond',
      Diamond: 'Master',
      Master: 'Grandmaster',
      Grandmaster: 'Top 500',
      Champion: 'Top 500',
      'Top 500': 'Top 500',
    },
    widerRoutes: ['wide'],
    openModes: ['Quick Play', 'Arcade'],
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
    ladder: [
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Grandmaster',
      'Celestial',
      'Eternity',
      'One Above All',
    ],
    // No duoCaps: NetEase publishes party sizes and a placement-only division
    // limit, and no general rank-gap table, so pages use UNKNOWN_RULE.
    widerRoutes: [],
    openModes: ['Quick Match', 'Arcade', 'Conquest', 'Doom Match'],
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
    ladder: [
      'Copper',
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Emerald',
      'Diamond',
      'Champion',
    ],
    // Both players' windows apply at once: Copper to Emerald reach three full
    // ranks, Diamond and Champion only two. Gold to Diamond therefore fails on
    // Diamond's own window even though Gold's would allow it.
    duoCaps: {
      Copper: 'Gold',
      Bronze: 'Platinum',
      Silver: 'Emerald',
      Gold: 'Emerald',
      Platinum: 'Diamond',
      Emerald: 'Champion',
      Diamond: 'Champion',
      Champion: 'Champion',
    },
    widerRoutes: [],
    openModes: ['Quick Match', 'Arcade', 'placement matches'],
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
    ladder: [
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Crimson',
      'Iridescent',
      'Top 250',
    ],
    // Black Ops 7: Bronze to Platinum mix freely, Diamond reaches two ranks and
    // Crimson and above only one, with the stricter of the two windows winning.
    // Warzone Ranked publishes no party table, so its copy uses UNKNOWN_RULE.
    duoCaps: {
      Bronze: 'Platinum',
      Silver: 'Diamond',
      Gold: 'Diamond',
      Platinum: 'Diamond',
      Diamond: 'Crimson',
      Crimson: 'Iridescent',
      Iridescent: 'Top 250',
      'Top 250': 'Top 250',
    },
    widerRoutes: [],
    openModes: ['Zombies', 'party playlists', 'party playlist', 'Resurgence'],
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
    ladder: [
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Champion',
      'Grand Champion',
      'Supersonic Legend',
    ],
    // The Standard rule counts sub-ranks, not whole tiers: the official example
    // allows Platinum 3 with Diamond 3 and refuses Platinum 2 with Diamond 3,
    // so one tier up is the honest tier-level reading.
    duoCaps: {
      Bronze: 'Silver',
      Silver: 'Gold',
      Gold: 'Platinum',
      Platinum: 'Diamond',
      Diamond: 'Champion',
      Champion: 'Grand Champion',
      'Grand Champion': 'Supersonic Legend',
      'Supersonic Legend': 'Supersonic Legend',
    },
    widerRoutes: ['Doubles', 'full team', 'full three', '2v2'],
    openModes: ['Casual', 'Extra Modes', 'Rumble', 'Dropshot', 'Hoops'],
    source: {
      label: 'How does the matchmaking and rank system work in Rocket League?',
      url: 'https://www.epicgames.com/help/en-US/c-Category_RocketLeague/c-RocketLeague_Gameplay/rocket-league-matchmaking-and-ranked-system-faq-a000084518',
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
    ladder: [
      'Beginner',
      'Great',
      'Expert',
      'Veteran',
      'Ultra',
      'Master',
      'Legend',
    ],
    // Pokemon support: ranks have to be the same or within two levels to invite
    // a friend to a Ranked match, with no full-team exemption published.
    duoCaps: {
      Beginner: 'Expert',
      Great: 'Veteran',
      Expert: 'Ultra',
      Veteran: 'Master',
      Ultra: 'Legend',
      Master: 'Legend',
      Legend: 'Legend',
    },
    widerRoutes: [],
    openModes: ['Standard', 'Quick Battle'],
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
    // Rivals runs on Divisions 10 to 1 and Elite, so there is no shared tier
    // name for a pair, and EA publishes no division-gap cap either way.
    ladder: [],
    widerRoutes: [],
    openModes: ['Squad Battles', 'Friendlies'],
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
    ladder: [],
    widerRoutes: [],
    openModes: ['Raids', 'Expeditions'],
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
    ladder: [],
    widerRoutes: [],
    openModes: ['Survival', 'Creative', 'minigames'],
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

/*
 * The rank-pairing scanner.
 *
 * `rankPairingFaults` reads a page's own copy and reports every sentence that
 * puts a customer's rank and a teammate's rank on the two ends of a booking
 * when the game's ranked queue would refuse that pair. It replaced a list of
 * exact banned phrases, which only ever caught the one sentence somebody had
 * already thought of.
 */

/**
 * Words that mark a rank as belonging to a person, so a tier list such as
 * "Diamond+ to Challenger teammates" is not read as a pairing: only the tier
 * standing next to one of these counts.
 */
const PERSON_NOUNS = [
  'player',
  'players',
  'account',
  'teammate',
  'teammates',
  'partner',
  'partners',
  'main',
  'climber',
  'coach',
  'caller',
  'shotcaller',
  'duo',
  'Duelist',
  'Controller',
  'Initiator',
  'Sentinel',
  'Vanguard',
  'Strategist',
  'ADC',
  'support',
  'Support',
  'Tank',
  'Damage',
  'entry',
  'Assault',
  'raider',
];

/**
 * Catalog tier names. A rank standing right behind one of these is the tier's
 * own description rather than the reader, so "Duo Plus with a Diamond+ player,
 * Duo Pro with a Master+ player" is a price list and not a pairing. The tier
 * may still be the teammate in a pairing; it just cannot be the customer.
 */
const PRODUCT_TIERS = [
  'Duo Plus',
  'Duo Pro',
  'Duo Apex',
  'Team-Up Duo',
  'Stadium Duo',
  'Normal Duos',
  'Warzone Ranked',
  'FACEIT Duo',
  'Stack Fill',
  'Squad Fill',
  'Flex Squad',
  'Premier Roster',
  'Clash Roster',
  '4-Stack',
  '5-Stack',
  '6-Stack',
  'Play and Learn',
  'VOD Review',
];
/** How far behind a rank a tier name still counts as introducing it. */
const PRODUCT_REACH = 20;

/** The verbs and prepositions that join two people into one booked party. */
const PAIRING_JOINS =
  /\b(?:with|alongside|beside|books?|booked|booking|queues?|queued|groups?|grouped|part(?:y|ies)|squads?|pairs?|paired|joins?|joined|stack)\b/i;

/**
 * A sentence asserts nothing when it ends in a question mark, and asserts the
 * opposite when it is negated, so neither is a false promise. The FAQ question
 * "Can a Gold player duo with a Challenger teammate?" is the shape this allows;
 * its answer is scanned on its own.
 */
const NOT_A_PROMISE = [
  /\?\s*$/,
  /\b(?:cannot|can['’]t|may not|must not|never|refuses?|forbids?|fails?|blocked|stops there)\b/i,
  /\b(?:rather than|instead of)\b/i,
  /^\s*No[:,]/,
];

/** The honest wording for a game whose publisher documents no gap at all. */
const ELIGIBILITY_WORDING =
  /eligible to queue with you|publishes no (?:general )?rank-gap|no rank-gap (?:cap|table)|party eligibility|rules of the game/i;

/** Ranks and tops used for a page whose game has no researched rule yet. */
const GENERIC_LADDER = [
  'Iron',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Emerald',
  'Diamond',
  'Master',
  'Grandmaster',
  'Immortal',
  'Radiant',
  'Celestial',
  'Eternity',
  'Champion',
  'Predator',
  'Challenger',
];
/** The highest tier a generic mid-ladder rank may be paired with: its own. */
const GENERIC_CAP_INDEX = GENERIC_LADDER.indexOf('Diamond');

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Split a block of copy into sentences, keeping the terminator. */
export const sentencesOf = (text: string): string[] =>
  text.split(/(?<=[.?!])\s+/).filter((part) => part.trim().length > 0);

/**
 * Every tier in `ladder` the sentence attaches to a person, with the position
 * it was found at. Longer names win, so "Apex Predator" never reads as
 * "Predator" and "Grand Champion" never reads as "Champion".
 */
function personRanks(sentence: string, ladder: string[]) {
  const nouns = PERSON_NOUNS.map(escape).join('|');
  const found: { tier: string; at: number; ofTier: boolean }[] = [];
  for (const tier of [...ladder].sort((a, b) => b.length - a.length)) {
    const name = escape(tier);
    // The tier immediately in front of the noun ("a Gold player", "an
    // Immortal+ partner"), or right behind it ("a player ranked Expert").
    const pattern = new RegExp(
      `\\b${name}\\b\\+?\\s*\\d?\\+?\\s*(?:${nouns})\\b|\\b(?:${nouns})\\s+(?:ranked|rated|at|in)\\s+${name}\\b`,
      'g',
    );
    for (const match of sentence.matchAll(pattern)) {
      // A longer tier already claimed this text, so skip the shorter reading.
      if (found.some((hit) => Math.abs(hit.at - match.index) < tier.length))
        continue;
      const before = sentence.slice(
        Math.max(0, match.index - PRODUCT_REACH),
        match.index,
      );
      found.push({
        tier,
        at: match.index,
        ofTier: PRODUCT_TIERS.some((name) => before.includes(name)),
      });
    }
  }
  return found.sort((a, b) => a.at - b.at);
}

export interface RankPairingFault {
  /** The page and field the sentence came from, for the failure message. */
  where: string;
  sentence: string;
  lower: string;
  higher: string;
  /** What the queue actually allows, or the reason no cap may be named. */
  allowed: string;
}

/**
 * Report every sentence in `blocks` that pairs two ranks the game's ranked
 * queue keeps apart. `rule` is the game's entry in RANK_RULES, or `undefined`
 * for a game still awaiting research, which falls back to the generic ladder.
 *
 * A flagged sentence is cleared when it, or the sentence straight after it in
 * the same block, names an open mode, the game's own wider route or the
 * eligibility wording. "In the same breath" is the point: a qualifier five
 * sentences down the paragraph does not reach the reader of the claim.
 */
export function rankPairingFaults(
  blocks: { where: string; text: string }[],
  rule: RankRule | undefined,
): RankPairingFault[] {
  const ladder = rule ? rule.ladder : GENERIC_LADDER;
  if (ladder.length === 0) return [];
  const caps = rule?.duoCaps;
  const openModes = rule?.openModes ?? [];
  const widerRoutes = rule?.widerRoutes ?? [];
  const faults: RankPairingFault[] = [];
  for (const block of blocks) {
    const sentences = sentencesOf(block.text);
    sentences.forEach((sentence, index) => {
      const ranks = personRanks(sentence, ladder);
      if (ranks.length < 2) return;
      const byTier = [...ranks].sort(
        (a, b) => ladder.indexOf(a.tier) - ladder.indexOf(b.tier),
      );
      // The customer is the lowest rank the sentence hands to a person without
      // a catalog tier in front of it; the teammate is the highest rank named.
      const lower = byTier.find((rank) => !rank.ofTier);
      const higher = byTier[byTier.length - 1]!;
      if (!lower || lower.tier === higher.tier) return;
      const span = sentence.slice(
        Math.min(lower.at, higher.at),
        Math.max(lower.at, higher.at),
      );
      if (!PAIRING_JOINS.test(span)) return; // A price list, not a party.
      const capTier = caps
        ? caps[lower.tier]
        : ladder[Math.min(GENERIC_CAP_INDEX, ladder.indexOf(lower.tier))];
      const capIndex = capTier ? ladder.indexOf(capTier) : -1;
      if (capIndex >= 0 && ladder.indexOf(higher.tier) <= capIndex) return;
      if (NOT_A_PROMISE.some((pattern) => pattern.test(sentence))) return;
      // The qualifier may land in the next sentence of the same block.
      const breath = [sentence, sentences[index + 1] ?? ''].join(' ');
      const named = (phrases: string[]) =>
        phrases.some((phrase) =>
          breath.toLowerCase().includes(phrase.toLowerCase()),
        );
      if (named(openModes)) return;
      if (named(widerRoutes)) return;
      if (ELIGIBILITY_WORDING.test(breath)) return;
      faults.push({
        where: block.where,
        sentence,
        lower: lower.tier,
        higher: higher.tier,
        allowed: caps
          ? `${lower.tier} queues with ${capTier ?? 'its own tier'} at most`
          : `${rule?.publisher ?? 'the publisher'} documents no rank gap, so say "${UNKNOWN_RULE}"`,
      });
    });
  }
  return faults;
}
