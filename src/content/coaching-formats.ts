/**
 * What each game's coaching catalog actually sells, one entry per coaching page.
 *
 * Owner decision (2026-11-08): the catalog and the services are the co-founder's
 * domain, so a page describes what is on offer rather than policing who may book
 * it. Every format, coach tier and unit below comes from the catalog
 * (src/design-reference/lib/catalog.js), and the prices are tokens the page
 * fills from the checkout pricing engine, so copy and checkout cannot drift.
 *
 * The meter is the three formats side by side with the unit each is sold in:
 * `game` for a live match, `hour` for a clock hour. `weight` only sets how full
 * the bar reads, from the lightest drill to the deepest session, and `lead`
 * marks the format a page should read first.
 *
 * Nothing here says a lesson raises a rank. Ubisoft's Player Protection Core
 * Rules prohibit paying for rank inflation outright, and Duoly sells coaching
 * time rather than a result, so no page promises one either.
 */

/** One format on the meter. Chips, so the prose never depends on reading them. */
export interface FormatRow {
  /** The catalog service title, in the game's own words. */
  label: string;
  /** What the booking buys, short enough to read as a chip. */
  value: string;
  /** The practical difference a player actually feels. */
  note: string;
  /**
   * How full the bar reads, relative to the other rows of the same game: 1 a
   * single drill, 3 the deepest session, 0 a format with no fixed length
   * (drawn hatched, because a live game can end early or run long).
   */
  weight: 0 | 1 | 2 | 3;
  /** Marks the format a reader should look at first, so the card reads first. */
  lead?: boolean;
}

export interface CoachFormatsCopy {
  /** Heading question, so each page asks the format question in its own terms. */
  heading: string;
  /** First sentence names the formats and the coach tier the catalog sells. */
  answer: string;
  /** What the unit means in practice, with a worked example. */
  detail: string;
  /** How to choose, and the price that does not change between formats. */
  choice: string;
  rows: FormatRow[];
}

export const coachFormats: Record<string, CoachFormatsCopy> = {
  valorant: {
    heading: 'Which Valorant coaching format should you book?',
    answer:
      'Three Valorant formats are open from Duoly in 2026, and all three come with an Immortal+ coach. Play and Learn is one live Competitive game, VOD Review is an hour on a match you already played, and Aim and Crosshair is an hour on crosshair placement, peeking and counter-strafing.',
    detail:
      'The unit is the real difference. Play and Learn is sold per game at {price:learn}, so a fast 13-4 and a 16-14 overtime cost the same. VOD Review and Aim and Crosshair are clock hours, which buys the pauses and rewinds a live round cannot. For example, a player who already knows which rounds go wrong gets more from an hour of VOD Review.',
    choice:
      'So pick by the problem rather than the format: 1) live decisions go to Play and Learn, 2) a pattern across rounds goes to VOD Review, and 3) a lost first duel goes to Aim and Crosshair. Every format costs {amount:vod}, and bundles never apply to coaching. Finally, screen share runs using Discord.',
    rows: [
      {
        label: 'Play and Learn',
        value: 'Per game',
        note: 'One live Competitive game',
        weight: 0,
        lead: true,
      },
      {
        label: 'VOD Review',
        value: 'Per hour',
        note: 'Pause and rebuild the rounds',
        weight: 3,
      },
      {
        label: 'Aim and Crosshair',
        value: 'Per hour',
        note: 'Ends with a routine you keep',
        weight: 2,
      },
    ],
  },
  'league-of-legends': {
    heading: 'Which League of Legends coaching format should you book?',
    answer:
      'Three League formats are open from Duoly in 2026. Play and Learn is one live ranked game with a Master+ coach, VOD Review is an hour with a Grandmaster+ coach on a game you already played, and Champion Mastery is an hour on a single champion with the same tier.',
    detail:
      'The unit is the real difference. Play and Learn is sold per game at {price:learn}, so a 20-minute surrender and a 45-minute slog cost the same. The two hourly lessons buy the pauses and rewinds a live game cannot. For example, a player who already knows the losing matchup gets more from an hour of Champion Mastery than from another ranked queue.',
    choice:
      'So pick by the problem rather than the format: 1) live decisions go to Play and Learn, 2) a pattern across games goes to VOD Review, and 3) one champion goes to Champion Mastery. Every format costs {amount:vod}, and bundles never apply to coaching. Finally, screen share runs using Discord.',
    rows: [
      {
        label: 'Play and Learn',
        value: 'Per game',
        note: 'One live ranked game',
        weight: 0,
        lead: true,
      },
      {
        label: 'VOD Review',
        value: 'Per hour',
        note: 'Ends with three fixes',
        weight: 3,
      },
      {
        label: 'Champion Mastery',
        value: 'Per hour',
        note: 'Matchups, combos and spikes',
        weight: 2,
      },
    ],
  },
  'rocket-league': {
    heading: 'Which Rocket League coaching format should you book?',
    answer:
      'Two Rocket League formats are open from Duoly in 2026, and both come with a Grand Champion coach. Play and Learn is a live hour of Doubles with the coach talking through kickoffs, rotation, boost and challenges. Mechanics Training is an hour on aerials, flicks and recoveries.',
    detail:
      'Both are hours rather than matches, because one Rocket League game runs about seven minutes. A booked hour therefore covers 6 or 7 Doubles matches at {price:learn}, or a full hour of repeated attempts in free play. For example, missing an aerial after a clean approach is a mechanics question, while jumping for a ball your partner already covered is a rotation question.',
    choice:
      'So pick by the cause rather than the format: 1) a decision before the touch goes to Play and Learn, and 2) the touch itself goes to Mechanics Training. Both cost {amount:mech}, and bundles never apply to coaching. Finally, Mechanics Training ends with training packs you keep, and screen share runs using Discord.',
    rows: [
      {
        label: 'Play and Learn',
        value: 'Per hour',
        note: 'Live Doubles, about 6 matches',
        weight: 3,
        lead: true,
      },
      {
        label: 'Mechanics Training',
        value: 'Per hour',
        note: 'Ends with training packs',
        weight: 2,
      },
      {
        label: 'Casual 3v3',
        value: 'Per hour',
        note: 'A teammate rather than a coach',
        weight: 1,
      },
    ],
  },
  fortnite: {
    heading: 'Which Fortnite coaching format should you book?',
    answer:
      'Two Fortnite formats are open from Duoly in 2026, and both come with an Unreal coach. Play and Learn is a live hour of Ranked with the coach talking through cover, zone rotations and which fights are worth taking. Build and Edit Course is an hour in Creative on piece control, edits and box fights.',
    detail:
      'Both are hours rather than matches, because a battle royale game has no fixed length. A booked hour of Play and Learn at {price:learn} usually covers 3 or 4 games, while the Creative hour runs as many repetitions as you want. For example, a fast edit still exposes your whole character when the wall opens from the wrong position.',
    choice:
      'So pick by the cause rather than the format: 1) fight selection and rotations go to Play and Learn, and 2) mechanics go to the Build and Edit Course. Both cost {amount:build}, and bundles never apply to coaching. Finally, say whether you play Builds or Zero Build and whether you use controller or keyboard, using Discord.',
    rows: [
      {
        label: 'Play and Learn',
        value: 'Per hour',
        note: 'Live Ranked, 3 or 4 games',
        weight: 0,
        lead: true,
      },
      {
        label: 'Build and Edit Course',
        value: 'Per hour',
        note: 'Creative repetitions',
        weight: 3,
      },
      {
        label: 'Creative Box Fights',
        value: 'Per hour',
        note: 'A teammate rather than a coach',
        weight: 1,
      },
    ],
  },
  'teamfight-tactics': {
    heading: 'Which TFT session should you book for learning?',
    answer:
      'Comp and Econ Review is the TFT coaching hour, with a Master+ coach, your own recording and a call using Discord. Nobody joins your lobby: you send a full game and the hour goes on comps, roll timing, levelling and gold from stage two onward.',
    detail:
      'The other two live options sit in the teammate catalog rather than the coaching one. Board Coach puts a Master+ player on your own board as a live caller, and Double Up puts a Master+ partner on the second board of your team of two. For example, one roll-down at stage 3 can fill most of a review hour at {price:econ}.',
    choice:
      'So pick by the moment you want back: 1) a decision you already made goes to Comp and Econ Review, 2) a decision you are about to make goes to Board Coach, and 3) a shared placement goes to Double Up. The review hour costs {amount:econ}, and bundles never apply to coaching. Finally, record the shop, bench, items and augments.',
    rows: [
      {
        label: 'Comp and Econ Review',
        value: 'Per hour',
        note: 'Your recording and a call',
        weight: 3,
        lead: true,
      },
      {
        label: 'Board Coach',
        value: 'Per game',
        note: 'A live caller on your board',
        weight: 2,
      },
      {
        label: 'Double Up',
        value: 'Per game',
        note: 'A partner on the second board',
        weight: 1,
      },
    ],
  },
  'apex-legends': {
    heading: 'Which Apex Legends coaching format should you book?',
    answer:
      'Two Apex formats are open from Duoly in 2026, and both come with a Master coach. Play and Learn is a live hour with the coach reading rotations, legend roles and third-party risk. The Movement Course is an hour in the Firing Range on tap-strafes, slide jumps, wall bounces and positioning.',
    detail:
      'Both are hours rather than matches, because a Ranked game can end in 4 minutes or run to the last ring. A booked hour of Play and Learn at {price:learn} therefore has no fixed game count, while the Firing Range hour runs as many repetitions as you want. For example, a clean slide into an open crossing still leaves the squad exposed.',
    choice:
      'So pick by the cause rather than the format: 1) rotations and fight selection go to Play and Learn, and 2) control and movement go to the Movement Course. Both cost {amount:move}, and bundles never apply to coaching. Finally, share your input, platform and preferred legends using Discord, because a keyboard clip rarely transfers to a controller.',
    rows: [
      {
        label: 'Play and Learn',
        value: 'Per hour',
        note: 'Live Ranked, no fixed count',
        weight: 0,
        lead: true,
      },
      {
        label: 'Movement Course',
        value: 'Per hour',
        note: 'Firing Range repetitions',
        weight: 3,
      },
      {
        label: 'Mixtape',
        value: 'Per hour',
        note: 'A teammate rather than a coach',
        weight: 1,
      },
    ],
  },
  'marvel-rivals': {
    heading: 'Which Marvel Rivals coaching format should you book?',
    answer:
      'Two Marvel Rivals formats are open from Duoly in 2026, and both come with a Grandmaster+ coach. Play and Learn is one live match with the coach talking through engages, cooldowns and resets, plus a quick review afterwards. Hero Coaching is an hour on one hero: abilities, ultimate timing, positioning and matchups.',
    detail:
      'The unit is the real difference. Play and Learn is sold per match at {price:learn}, so a 3-0 sweep and a seven-round decider cost the same. Hero Coaching is a clock hour, which buys the pauses a live match cannot. For example, a Strategist who spends a cooldown just before a dive and a Vanguard who engages too early have very different problems.',
    choice:
      'So pick by the problem rather than the format: 1) team-fight decisions go to Play and Learn, and 2) one hero goes to Hero Coaching. Both cost {amount:hero}, and bundles never apply to coaching. Finally, bring the current patch and your hero pool using Discord, so Team-Ups stay relevant to the lesson.',
    rows: [
      {
        label: 'Play and Learn',
        value: 'Per match',
        note: 'One live Competitive match',
        weight: 0,
        lead: true,
      },
      {
        label: 'Hero Coaching',
        value: 'Per hour',
        note: 'One hero, start to finish',
        weight: 3,
      },
      {
        label: 'Quick Match and Arcade',
        value: 'Per match',
        note: 'A teammate rather than a coach',
        weight: 1,
      },
    ],
  },
  'counter-strike-2': {
    heading: 'Which CS2 coaching format should you book?',
    answer:
      'Three CS2 formats are open from Duoly in 2026, and all three come with a FACEIT Level 10 coach. Play and Learn is one live match, Demo Review is an hour on a demo you already played, and Utility and Lineups is an hour of smokes, flashes and molotovs on the maps you queue.',
    detail:
      'The unit is the real difference. Play and Learn is sold per match at {price:learn}, so a 13-3 and a double-overtime cost the same. The two hourly lessons buy the rewinds and the practice server a live round cannot. For example, a player who keeps losing the same retake gets more from an hour of lineups than from another Premier queue.',
    choice:
      'So pick by the problem rather than the format: 1) live reads go to Play and Learn, 2) a pattern across rounds goes to Demo Review, and 3) a missing smoke goes to Utility and Lineups. Every format costs {amount:demo}, and bundles never apply to coaching. Finally, send your map pool and the demo you want opened using Discord.',
    rows: [
      {
        label: 'Play and Learn',
        value: 'Per match',
        note: 'One live match, start to finish',
        weight: 0,
        lead: true,
      },
      {
        label: 'Demo Review',
        value: 'Per hour',
        note: 'Rewind the rounds together',
        weight: 3,
      },
      {
        label: 'Utility and Lineups',
        value: 'Per hour',
        note: 'Practice server repetitions',
        weight: 2,
      },
    ],
  },
  'overwatch-2': {
    heading: 'Which Overwatch 2 coaching format should you book?',
    answer:
      'Two Overwatch 2 formats are open from Duoly in 2026, and both come with a Grandmaster+ coach. Play and Learn is one live Competitive match with the coach talking through engages, cooldowns and resets. Role Coaching is an hour on tank, damage or support: positioning, cooldown use and when to take space.',
    detail:
      'The unit is the real difference. Play and Learn is sold per match at {price:learn}, so a fast two-round push and a full five-round grind cost the same. Role Coaching is a clock hour, which buys the pauses a live match cannot. For example, a support who dies first in every fight and a tank who engages too early have very different problems.',
    choice:
      'So pick by the problem rather than the format: 1) team-fight decisions go to Play and Learn, and 2) one role goes to Role Coaching. Both cost {amount:role}, and bundles never apply to coaching. Finally, send your platform, region, role and BattleTag using Discord, so the hour starts on the right questions.',
    rows: [
      {
        label: 'Play and Learn',
        value: 'Per match',
        note: 'One live Competitive match',
        weight: 0,
        lead: true,
      },
      {
        label: 'Role Coaching',
        value: 'Per hour',
        note: 'One role, in depth',
        weight: 3,
      },
      {
        label: 'Quick Play and Arcade',
        value: 'Per game',
        note: 'A teammate rather than a coach',
        weight: 1,
      },
    ],
  },
  'rainbow-six-siege': {
    heading: 'Which Siege coaching format should you book?',
    answer:
      'Three Siege formats are open from Duoly in 2026, and all three come with a Champion coach. Play and Learn is one live Ranked match, the Operator Lab is an hour on one attacker and one defender, and Map and Callouts is an hour on your weakest map, room by room.',
    detail:
      'The unit is the real difference. Play and Learn is sold per match at {price:learn}, so a 4-0 and a 7-6 overtime cost the same. The two hourly lessons buy the custom game and the repeats a live round cannot. For example, a player who keeps losing the same site gets more from an hour on that map than from another Ranked queue.',
    choice:
      'So pick by the problem rather than the format: 1) live round reads go to Play and Learn, 2) gadgets and timings go to the Operator Lab, and 3) one map goes to Map and Callouts. Every format costs {amount:ops}, and bundles never apply to coaching. Finally, send your platform, your operator pool and the map you keep losing using Discord.',
    rows: [
      {
        label: 'Play and Learn',
        value: 'Per match',
        note: 'One live Ranked match',
        weight: 0,
        lead: true,
      },
      {
        label: 'Operator Lab',
        value: 'Per hour',
        note: 'One attacker, one defender',
        weight: 2,
      },
      {
        label: 'Map and Callouts',
        value: 'Per hour',
        note: 'Room by room, every site',
        weight: 3,
      },
    ],
  },
};
