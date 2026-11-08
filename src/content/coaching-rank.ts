/**
 * The rank rule every live coaching lesson has to obey, one entry per coaching
 * page.
 *
 * Play and Learn puts the coach in the customer's own match, so the coach's
 * rank is not a marketing choice: the game's ranked queue decides who may sit
 * beside you. The owner rule is "either we give the highest rank we could or we
 * get a whole lobby", and these entries are that rule written out per game.
 *
 * Two honest shapes, and never a third:
 * 1. Keep the ranked queue and take the highest-ranked coach the queue allows
 *    for your rank.
 * 2. Move the lesson to a mode the game leaves open, or to the full lobby the
 *    game itself widens, where a top-tier coach may queue with any rank.
 *
 * Where a publisher documents no rule, copy says only that the coach has to be
 * eligible to queue with you (UNKNOWN_RULE in src/content/rank-rules.ts).
 *
 * Hourly lessons are different. VOD Review, Demo Review, Operator Lab and the
 * rest are a recording and a call rather than a shared queue, so their coach
 * rank claims (Immortal+, Grandmaster+, FACEIT 10) stand unchanged.
 *
 * A catalog tier such as "Play and Learn: Immortal+ coach" says who Duoly
 * hires. It never overrides a publisher's queue rule, and every entry below
 * says so on the page rather than leaving a reader to work it out.
 *
 * The rule itself comes from src/content/rank-rules.ts, which cites the
 * publisher's own page and the day it was read. Mode names come from the
 * catalog (src/design-reference/lib/catalog.js), so every named fallback mode
 * is one Duoly actually sells. Nothing here says a session raises a rank:
 * Ubisoft's Player Protection Core Rules prohibit paid rank inflation outright
 * and Duoly sells shared playing time rather than a result.
 */
import { rankRuleFor } from './rank-rules';

/** One rung of the queue visual. Chips, so the prose never depends on reading them. */
export interface RankRung {
  /** The queue or mode the rung describes, in the game's own words. */
  label: string;
  /** The gap the rung allows, short enough to read as a chip. */
  value: string;
  /** The consequence a player actually feels. */
  note: string;
  /**
   * How wide the gap is on the meter, relative to the other rungs of the same
   * game: 1 narrow, 3 the widest the game allows, 0 where the publisher
   * documents no limit at all (drawn hatched, never as a promise).
   */
  gap: 0 | 1 | 2 | 3;
  /** Marks a rung as the widest honest route, so the card reads first. */
  wide?: boolean;
}

export interface CoachRankCopy {
  /** Heading question, so each page asks the rank question in its own terms. */
  heading: string;
  /** First sentence answers who may coach you inside the ranked queue. */
  answer: string;
  /** What the rule costs in practice, with a worked example. */
  rule: string;
  /** The honest shapes of the booking, and the price that does not change. */
  choice: string;
  rungs: RankRung[];
}

/**
 * Source pages that answered an automated HTTP check with 200 on 8 November
 * 2026, so a coaching page may link them.
 *
 * Three publishers sit behind bot protection and answer an automated request
 * with 403: FACEIT, Epic Games (fortnite.com) and Epic Games (Rocket League
 * help). Those pages are named in prose and the page's check date, with no
 * hyperlink, rather than shipping a link nobody here could confirm resolves.
 */
export const LINKABLE_SOURCES = [
  'valorant',
  'league-of-legends',
  'teamfight-tactics',
  'apex-legends',
  'overwatch-2',
  'marvel-rivals',
  'rainbow-six-siege',
];

export const coachRank: Record<string, CoachRankCopy> = {
  valorant: {
    heading: 'Which coach rank can queue with you in Competitive?',
    answer:
      'The highest-ranked coach Competitive allows is one tier above your own, because Riot Games moves a Competitive party one tier at most. A Gold player queues with Platinum, so the Immortal+ price card says who Duoly hires rather than who can join.',
    rule: 'Only a five-stack carries any rank combination, and Riot Games cuts the RR a five-stack earns by 25% to 90% as the gap widens. For example, a Silver player and a Radiant coach share a five-stack and almost no RR.',
    choice:
      'The booking therefore has two honest shapes: 1) stay in Competitive with the highest-ranked coach your tier allows, or 2) move the lesson to Unrated or Swiftplay, where an Immortal coach plays beside any rank. Play and Learn costs {price:learn} and VOD Review costs {amount:vod}, so the rule changes the mode rather than the money. Finally, name your rank in the order chat.',
    rungs: [
      {
        label: 'Competitive duo',
        value: 'One tier up',
        note: 'Gold queues with Platinum',
        gap: 1,
      },
      {
        label: 'Competitive five-stack',
        value: 'Any rank',
        note: 'RR cut 25% to 90%',
        gap: 3,
        wide: true,
      },
      {
        label: 'Unrated or Swiftplay',
        value: 'No rank gate',
        note: 'Any coach rank can queue',
        gap: 0,
        wide: true,
      },
    ],
  },
  'league-of-legends': {
    heading: 'Which coach rank can queue with you in ranked?',
    answer:
      'Ranked Solo/Duo is capped by division, so a Gold player queues with Platinum I and no higher. A Master coach may only queue with Emerald and above, which means your own division decides which coach can sit in your game.',
    rule: 'Ranked Flex is looser below Diamond, and the Emerald floor for Master and above holds in a Flex five as well. For example, a Silver player cannot reach a Grandmaster coach through any Flex party.',
    choice:
      'The booking therefore has two honest shapes: 1) keep ranked with the highest-ranked coach your division allows, or 2) move the live game to Normal Draft, Swiftplay or ARAM, where a Grandmaster coach plays beside any rank. Play and Learn costs {price:learn} and VOD Review costs {amount:vod}, so the rule changes the mode rather than the money. Finally, send your server and role in the order chat.',
    rungs: [
      {
        label: 'Solo/Duo',
        value: 'Gold to Platinum I',
        note: 'Both players stay inside it',
        gap: 1,
      },
      {
        label: 'Master and above',
        value: 'Emerald floor',
        note: 'In a Flex five as well',
        gap: 2,
      },
      {
        label: 'Normal Draft or ARAM',
        value: 'No rank gate',
        note: 'Any coach rank can queue',
        gap: 0,
        wide: true,
      },
    ],
  },
  'rocket-league': {
    heading: 'Which coach rank can queue Doubles with you?',
    answer:
      'Any coach rank is allowed in Doubles with you, including Grand Champion, because Psyonix applies the rank disparity restriction only to an undersized party. A Doubles pair is already a full team, so the restriction never triggers.',
    rule: 'Standard works differently. Two players in a 3v3 queue are an undersized party, so the gap narrows to three ranks. For example, a Gold player can queue Doubles with Grand Champion and not Standard.',
    choice:
      'The live hour needs no fallback mode, and the booking still has two shapes: 1) live Doubles for the widest coach gap the game allows, or 2) Casual 3v3 or Extra Modes with nothing on the line. Play and Learn costs {price:learn} and Mechanics Training costs {amount:mech}. Finally, send your platform and input in the order chat.',
    rungs: [
      {
        label: 'Doubles pair',
        value: 'Any rank',
        note: 'A pair is a full team',
        gap: 3,
        wide: true,
      },
      {
        label: 'Standard pair',
        value: 'Three ranks',
        note: 'An undersized party',
        gap: 2,
      },
      {
        label: 'Casual or Extra Modes',
        value: 'No rank gate',
        note: 'Nothing on the line',
        gap: 0,
        wide: true,
      },
    ],
  },
  fortnite: {
    heading: 'Which coach rank can queue Ranked with you?',
    answer:
      'Your coach has to be eligible to queue with you under the rules of the game, because Epic Games publishes no rank-gap cap for Ranked. What Epic Games does publish is that matchmaking reads the highest rank in the party.',
    rule: 'An Unreal coach beside you means Unreal-level opponents all hour. For example, a Gold player working on rotations learns from Unreal lobbies, and a placement chase wants the opposite.',
    choice:
      'The booking therefore has two honest shapes: 1) keep Ranked and accept a lobby that follows the coach, or 2) move the hour to Zero Build, Reload or Creative, where no rank gate applies. Play and Learn costs {price:learn} and Build and Edit Course costs {amount:build}, so the rule changes the mode rather than the money. Finally, meet the coach using Discord and check the queue in the client.',
    rungs: [
      {
        label: 'Ranked party',
        value: 'No published cap',
        note: 'Matched on the highest rank',
        gap: 0,
        wide: true,
      },
      {
        label: 'With an Unreal coach',
        value: 'Unreal lobbies',
        note: 'Harder opponents all hour',
        gap: 3,
      },
      {
        label: 'Zero Build or Creative',
        value: 'No rank gate',
        note: 'Any coach rank can play',
        gap: 0,
        wide: true,
      },
    ],
  },
  'teamfight-tactics': {
    heading: 'Does a coach rank rule apply to a TFT review?',
    answer:
      'No coach rank rule applies to Comp and Econ Review, because the hour is your recording, a Master+ coach and a call using Discord. The queue rules that limit a shared ranked game have nothing to restrict here.',
    rule: 'Board Coach is live help where the coach watches your screen while you play your own ranked game, so again nobody joins your lobby. Double Up is the one shared queue, and Riot Games matches a Double Up pair on the higher rank with any rank combination.',
    choice:
      'Preparing the hour therefore has two steps: 1) record a full game with the shop, bench, items and augments visible, and 2) send the set and the patch with the link. Comp and Econ Review costs {price:econ}, and a second hour costs {amount:econ} like the first. Finally, for example, one roll-down at stage 3 can fill most of the hour.',
    rungs: [
      {
        label: 'Comp and Econ Review',
        value: 'No queue',
        note: 'Your recording and a call',
        gap: 0,
        wide: true,
      },
      {
        label: 'Board Coach',
        value: 'No queue',
        note: 'Coach watches your screen',
        gap: 0,
        wide: true,
      },
      {
        label: 'Double Up pair',
        value: 'Any rank',
        note: 'Matched on the higher rank',
        gap: 3,
        wide: true,
      },
    ],
  },
  'apex-legends': {
    heading: 'Which coach rank can queue Ranked with you?',
    answer:
      'The highest-ranked coach Ranked allows is two rank tiers above your own, so a Gold player queues with Diamond at most. EA applies the same two tiers to a duo and to a full trio, which means the Master price card says who Duoly hires.',
    rule: 'Filling the third seat widens nothing, which is the opposite of how a few other shooters work. For example, a Silver player cannot reach a Master coach in Ranked through any squad size.',
    choice:
      'The booking therefore has two honest shapes: 1) keep Ranked with the highest-ranked coach your tier allows, or 2) move the hour to Mixtape or unranked Pubs, where a Master coach plays beside any rank. Play and Learn costs {price:learn} and the Movement Course costs {amount:move}, so the rule changes the mode rather than the money. Finally, send your legend and input in the order chat.',
    rungs: [
      {
        label: 'Ranked duo or trio',
        value: 'Two rank tiers',
        note: 'Gold queues with Diamond',
        gap: 2,
      },
      {
        label: 'Full trio',
        value: 'Still two tiers',
        note: 'A third seat changes nothing',
        gap: 2,
      },
      {
        label: 'Mixtape or Pubs',
        value: 'No rank gate',
        note: 'Any coach rank can play',
        gap: 0,
        wide: true,
      },
    ],
  },
  'marvel-rivals': {
    heading: 'Which coach rank can queue Competitive with you?',
    answer:
      'Your coach has to be eligible to queue with you under the rules of the game, because NetEase Games publishes party sizes rather than a rank-gap table. The published rule is a size rule: Bronze through Grandmaster may use any party size except five, and Celestial and above queue solo or duo.',
    rule: 'A six caps at Grandmaster, and a squad holding anyone in placements caps at three. For example, a Diamond player with Grandmaster coaching can bring four friends, and a Celestial player cannot.',
    choice:
      'The booking has two honest shapes: 1) keep Competitive and send your rank so the assigned coach is one your party size allows, or 2) move the match to Quick Match or Arcade, where no rank gate applies. Play and Learn costs {price:learn} and Hero Coaching costs {amount:hero}, so the mode changes rather than the price. Finally, name your hero pool in the order chat.',
    rungs: [
      {
        label: 'Bronze to Grandmaster',
        value: 'Any size except five',
        note: 'A six caps at Grandmaster',
        gap: 3,
        wide: true,
      },
      {
        label: 'Celestial and above',
        value: 'Solo or duo',
        note: 'No full party at the top',
        gap: 1,
      },
      {
        label: 'Quick Match or Arcade',
        value: 'No rank gate',
        note: 'Any coach rank can queue',
        gap: 0,
        wide: true,
      },
    ],
  },
  'counter-strike-2': {
    heading: 'Which coach rank can queue Premier with you?',
    answer:
      'Your coach has to be eligible to queue with you under the rules of the game, because Valve publishes no party CS Rating gap for Premier. The documented wide-gap route is FACEIT, where a Standard five carries no party Elo restriction.',
    rule: 'A FACEIT Super party caps at 3 players within 400 Elo, and a Premium party at 2 within 400 Elo with 20% more Elo on the line. For example, the Valve skill group FAQ names no admission threshold.',
    choice:
      'The booking therefore has two honest shapes: 1) queue Premier and send your CS Rating so the assigned coach is one the queue accepts, or 2) play FACEIT Standard, where a five has no Elo restriction. Play and Learn costs {price:learn} and Demo Review costs {amount:demo}. Finally, meet your coach using Discord and name your map pool.',
    rungs: [
      {
        label: 'Premier party',
        value: 'No published gap',
        note: 'Send your CS Rating first',
        gap: 0,
        wide: true,
      },
      {
        label: 'FACEIT Standard five',
        value: 'Any level',
        note: 'No party Elo restriction',
        gap: 3,
        wide: true,
      },
      {
        label: 'Casual or retakes',
        value: 'No rating gate',
        note: 'Any coach level can play',
        gap: 0,
        wide: true,
      },
    ],
  },
  'overwatch-2': {
    heading: 'Which coach rank can queue Competitive with you?',
    answer:
      'A Grandmaster coach is allowed to queue Competitive with any rank, because Blizzard removed the rank-gap limit for a wide group in April 2024. A duo crossing the ladder is simply a wide group, so a Gold player can learn beside the top coach tier.',
    rule: 'Two costs come with a wide group. Rank change is reduced in both directions, and a wide group of four cannot queue at all, so a five is the only wide full lobby. For example, Role Queue reads the ranks of the roles you pick rather than your best rank.',
    choice:
      'The booking stays in Competitive, and the choice is a mode: 1) Competitive with Grandmaster coaching and reduced rank change, or 2) Quick Play or Arcade with no rank change at all. Play and Learn costs {price:learn} and Role Coaching costs {amount:role}. Finally, send your rank, role and region in the order chat.',
    rungs: [
      {
        label: 'Wide group',
        value: 'Any rank',
        note: 'Rank change is reduced',
        gap: 3,
        wide: true,
      },
      {
        label: 'Wide group of four',
        value: 'Cannot queue',
        note: 'A five is the only wide lobby',
        gap: 1,
      },
      {
        label: 'Quick Play or Arcade',
        value: 'No rank gate',
        note: 'Role Queue reads your roles',
        gap: 0,
        wide: true,
      },
    ],
  },
  'rainbow-six-siege': {
    heading: 'Which coach rank can queue Ranked with you?',
    answer:
      'Ranked 3.0 keeps Copper through Emerald inside three full ranks and holds Diamond and Champion to two, and both players satisfy their own limit. A Gold player therefore queues with Emerald, so the Champion price card says who Duoly hires rather than who can join.',
    rule: 'A full five follows the same limits, so filling the squad widens nothing. For example, a Gold player cannot reach a Diamond coach, because the two-rank window of Diamond closes first.',
    choice:
      'The booking therefore has two honest shapes: 1) keep Ranked and send your rank so the assigned coach is the highest one the queue allows, or 2) move the match to Quick Match or Arcade, where a Champion coach plays beside any rank. Play and Learn costs {price:learn} and the Operator Lab costs {amount:ops}, so the rule changes the mode rather than the money. Finally, name your weakest map in the order chat.',
    rungs: [
      {
        label: 'Copper to Emerald',
        value: 'Three full ranks',
        note: 'Gold queues with Emerald',
        gap: 3,
      },
      {
        label: 'Diamond and Champion',
        value: 'Two full ranks',
        note: 'The tighter limit wins',
        gap: 2,
      },
      {
        label: 'Quick Match or Arcade',
        value: 'No rank gate',
        note: 'Any coach rank can play',
        gap: 0,
        wide: true,
      },
    ],
  },
};

/** The publisher page a coaching page cites for its rank rule. */
export const rankSourceFor = (slug: string) => rankRuleFor(slug);
