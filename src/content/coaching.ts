// Coaching page copy. **Bold** marks service names (rendered by src/components/seo/rich.ts).
export interface Lesson {
  title: string;
  h1: string;
  lead: string;
  format: string;
  /** Intro above the price cards: what the unit buys, in this game's terms. */
  prices: string;
  /** The three booking steps shown above the booking answer. */
  steps: [string, string, string];
  /** The booking answer under the steps, written for this game. */
  booking: string;
  sections: { heading: string; paragraphs: string[] }[];
  prepare: string;
  faq: [string, string][];
}
export const lessons: Record<string, Lesson> = {
  valorant: {
    title: 'Valorant Coaching, VOD Review and Aim Training | Duoly',
    h1: 'Valorant coaching with a focused practice plan',
    lead: 'Book a Valorant coach for live Play and Learn, a round-by-round VOD review or an aim lesson. Work on one repeatable decision before adding more drills.',
    format:
      'Valorant coaching from Duoly is a booked lesson with an Immortal+ coach, and three formats are open in 2026. **Play and Learn** puts a coach in your Competitive game, talking through routes, utility and trades while the round happens (Unrated works too). **VOD Review** is an hour to pause a recent match and rebuild the rounds together. **Aim and Crosshair** spends the hour on crosshair placement, peeking and counter-strafing, ending with a routine you keep. First, decide where your rounds fall apart. For example, a lost opening duel can mean a crosshair trailing the angle, a flash landing late or nobody close enough to trade. Second, bring the agent you actually queue, and include eco rounds as well as full buys. A Sheriff with light shields costs 1200, so the plan for an eco differs from a rifle round with full utility. Finally, every lesson runs on your own Riot account using Discord voice and screen share.',
    prices:
      'Every Valorant lesson from Duoly costs {amount:learn}. The real choice is the unit you book. Play and Learn is sold per game: one Competitive match beside an Immortal+ coach, with the calls happening live. VOD Review and Aim and Crosshair are sold by the hour, which buys the pauses, rewinds and repeats a live game cannot give you. First, pick the unit that matches the problem. For example, a player who already knows which rounds go wrong learns more from an hour of VOD Review than from another live match. Bundles do not apply to coaching, so a second hour costs {price:vod} again, and both hourly lessons run using Discord screen share.',
    steps: [
      'Pick the format for the problem: a live game, an hour of VOD Review or an hour on aim.',
      'Check out once, upfront: every format costs {amount:learn}. The unit is what differs.',
      'Meet your Immortal+ coach in the order chat and start on Discord.',
    ],
    booking:
      'A Valorant booking is a single checkout for one lesson, so check whether the format is sold per game or by the hour before paying. The order chat is where a lesson gets set up properly: send your region, your agent pool and the timestamp of the round you want to open with. For example, a line saying you lose B site retakes on Ascent saves ten minutes of guessing. Send your Riot ID too, the in-game name plus the tagline, so the invite does not become a search. Finally, keep your login private and invite the coach from your own account. An Immortal+ coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'Why does a missed shot often start before the peek?',
        paragraphs: [
          'A missed shot is usually the last step of a bad route into a fight. First, check the route before touching the sensitivity. On attack, a duelist needs a teammate close enough to trade, an initiator needs utility timed to the entry, and a controller needs smokes on the sightlines the entry has to cross. Sentinels get a different question: flank information, and the cost of a rotation that starts late.',
          'Second, bring an agent you actually queue rather than a pro pick. For example, a Sova player can check whether the drone cleared the angle the entry player needed, and an Omen player can compare a smoke placed too early with a smoke landing as teammates take space. Half-time comes after round 12. A habit fixed on attack therefore pays again on defense, and Riot Games keeps rotating maps through the 2026 season. Finally, an Immortal+ coach from Duoly ties every point to your own recording, using Discord screen share.',
        ],
      },
      {
        heading: 'Example round: what makes an entry untradeable?',
        paragraphs: [
          'An untradeable entry is a peek with no teammate ready to answer the kill. For example, the entry player turns a corner while the second player is still behind a smoke. Pause the recording a second before the peek and ask three things: what information was available, which angle the second player could see, and whether utility was about to expire. Moving together or waiting for the flash usually beats a harder shot.',
          'For practice, mark the first contact of 5 rounds in your next recording. First, note whether a teammate could trade. Second, check whether the crosshair sat at head height before the opponent appeared. Finally, compare each moment with the round result rather than the scoreboard. A Competitive match is a race to 13. Replaying one peek 3 times usually settles whether the route or the shot was the problem, and an Immortal+ coach from Duoly adapts the exercise to your role and agent, reviewing clips using Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for Valorant coaching is a short checklist, and ten minutes before the call is enough. For VOD Review, bring a full match recording with the HUD and audio intact. Add two timestamps where the round felt unclear, for example 1) a peek you could not explain and 2) a rotation that arrived late. A close game teaches more than a highlight reel, so pick the match that ended 13-11 rather than 13-3. Note the patch as well, because Riot Games keeps adjusting agent utility through the 2026 season. For Aim and Crosshair, keep your usual sensitivity and crosshair so the coach sees real habits. For Play and Learn, confirm your ranks can queue together in Competitive. Test voice and screen share using Discord, then hide private notifications. Never send login details to anyone, including an Immortal+ coach from Duoly. Finally, write one line naming the habit you want changed by the end of the hour.',
    faq: [
      [
        'Which lesson should I pick?',
        'Three Valorant lessons are open in 2026, and the problem picks the lesson. VOD Review is the choice for players who already know which rounds go wrong, because an hour of pausing beats another live match. Aim and Crosshair suits a crosshair or peeking problem. Play and Learn is for applying a plan during a Competitive game.',
      ],
      [
        'How much does it cost?',
        'Every Valorant lesson from Duoly costs {amount:learn}. Play and Learn is billed per game, while VOD Review and Aim and Crosshair are billed per hour, so a second hour of review costs {price:vod} again.',
      ],
      [
        'Do I need a recording?',
        'First, bring a full recent match for VOD Review, with the HUD and audio intact. Mark a round where utility felt wasted and a duel you cannot explain. Aim and Crosshair and live Play and Learn need no recording at all.',
      ],
      [
        'Can I work on just one agent?',
        'Yes, and a narrow goal works better. For example, name Omen smoke timing or clearing space with Sova, then share the clip using Discord screen share.',
      ],
    ],
  },
  'league-of-legends': {
    title: 'League of Legends Coaching and VOD Review | Duoly',
    h1: 'League of Legends coaching for your next practice goal',
    lead: 'Choose LoL coaching for lane decisions, champion mastery or a review of your own match. Build a practice goal you can recognize in your next game.',
    format:
      'League of Legends coaching from Duoly is a booked lesson with a Master+ or Grandmaster+ coach, and three formats are open in 2026. **Play and Learn** puts a Master+ coach in your ranked game, talking through trades, recalls and objectives while the game happens. **VOD Review** is an hour with a Grandmaster+ coach who follows your laning, wave management and map moves, then narrows the game down to three things to fix. **Champion Mastery** is an hour on one champion: matchups, combos, builds and power spikes, practiced in a live game. First, bring the role and champion pool you actually queue. For example, a mid laner who keeps dying after the first recall usually needs wave control and jungle tracking rather than another combo. Each outer turret carries 5 plates. Fixing the first ten minutes therefore changes the rest of the game. Finally, every lesson runs on your own Riot account using Discord voice and screen share.',
    prices:
      'Every League of Legends lesson from Duoly costs {amount:learn}. The unit is the real difference. Play and Learn is sold per game: one ranked game beside a Master+ coach, with the calls happening live. VOD Review and Champion Mastery are sold by the hour with a Grandmaster+ coach, which buys pauses and rewinds. First, pick the unit that matches the problem. For example, a player who already knows the losing matchup learns more from an hour of Champion Mastery than from another ranked queue. Bundles do not apply to coaching, and both hourly lessons run using Discord screen share.',
    steps: [
      'Pick the format for the problem: a live ranked game, an hour of VOD Review or an hour on one champion.',
      'Check out once, upfront: every format costs {amount:learn}. The unit is what differs.',
      'Meet your coach in the order chat and start on Discord.',
    ],
    booking:
      'A League of Legends booking is a single checkout for one lesson, so check whether the format is sold per game or by the hour before paying. The order chat is where a lesson gets set up properly: send your server, your role, your champion pool and the replay you want opened. For example, a line saying the Renekton matchup keeps going wrong as Camille saves ten minutes of guessing. Send your Riot ID too, since Riot Games replaced summoner names with the name plus tagline in 2023. Finally, keep your login private and invite the coach from your own account. A Grandmaster+ coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'Why does wave state decide a lane trade?',
        paragraphs: [
          'Wave state is the position and size of the minion waves, and wave state sets the price of a trade. First, read the wave before pressing a button. With a large enemy wave arriving, a long trade costs health, experience and a safe recall. With your own wave about to crash, staying for one more plate costs a clean reset. Plates stop dropping at 14:00. Until then a Grandmaster+ coach from Duoly can price every trade in gold rather than in feeling.',
          'Second, jungle and support lessons need different evidence. A jungler can bring camp sequencing and lane priority, while a support can bring the vision route that went down before a fight. For example, a bot lane review often focuses on spacing with your support and the timing of a shared recall, watched using Discord screen share. Finally, name the patch, because Riot Games keeps moving gold and objective values through the 2026 season.',
        ],
      },
      {
        heading: 'Example lane review: what makes a recall expensive?',
        paragraphs: [
          'An expensive recall is a reset that gives away minions, experience or tower plates. For example, a mid laner recalls while the wave stops just outside the enemy tower. The opponent holds the wave, and the returning laner walks forward for experience. First, ask whether the wave could have been crashed fully. Second, ask whether the enemy jungler was visible on the map. Finally, compare the item bought with the minions and plates likely to be lost.',
          'A take-home exercise is to label your first 3 recalls in the next game. Use three labels: wave crashed, wave rolling toward you, or wave held away from you. Add the information available before pressing B. Replaying the same recall 2 times usually ends the argument. A recall at 13:30 is a different decision from a recall at 15:00. Plates make the early reset more expensive, and a Grandmaster+ coach from Duoly adapts the task to your matchup, watching the replay using Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for League of Legends coaching is one replay and one honest question about your role. For VOD Review, bring a recent full replay with the patch and the role you played. Pick a loss where decisions were still open, for example 1) a recall you regret and 2) a fight you joined late. A game lost by a small margin teaches more than a 15-minute surrender. Riot Games ships a new patch every two weeks, so name the patch you played in the 2026 season. For Champion Mastery, name one champion and the matchups that keep going wrong. For Play and Learn, check your server and confirm your ranks can queue together. Test voice and screen share using Discord, then hide private chat and notifications. Stay on your own Riot account and never send login details, including to a Grandmaster+ coach from Duoly. Finally, write the one decision you want to make differently in your next ranked game.',
    faq: [
      [
        'Which lesson should I pick?',
        'Three League of Legends lessons are open in 2026, and the problem picks the lesson. VOD Review is the choice for wave management, jungle tracking and map decisions. Champion Mastery is an hour on one champion and the matchups around the champion. Play and Learn is for making the calls during a live ranked game.',
      ],
      [
        'How much does it cost?',
        'Every League of Legends lesson from Duoly costs {amount:learn}. Play and Learn is billed per game with a Master+ coach, while VOD Review and Champion Mastery are billed per hour with a Grandmaster+ coach, so a second hour costs {price:vod} again.',
      ],
      [
        'What replay should I bring?',
        'First, bring a close game, win or loss, with the patch and the role noted. Mark two moments you cannot explain, for example a recall that cost plates or a jungle rotation that arrived late.',
      ],
      [
        'Can I focus on one matchup?',
        'Yes. Book Champion Mastery, name the lane opponent and explain where the wave gets away from you, then share the replay using Discord screen share.',
      ],
    ],
  },
  'rocket-league': {
    title: 'Rocket League Coaching and Mechanics Training | Duoly',
    h1: 'Rocket League coaching for decisions and mechanics',
    lead: 'Book Rocket League coaching for live Doubles or a mechanics lesson. Turn a replay problem into a drill you can repeat in free play.',
    format:
      'Rocket League coaching from Duoly is a booked hour with a Grand Champion coach, and two formats are open in 2026. **Play and Learn** is a live hour of Doubles, with the coach talking through kickoffs, rotation, boost and challenges while the match runs. **Mechanics Training** is an hour on aerials, flicks and recoveries, ending with training packs you keep. First, decide whether the problem is the execution or the decision before the touch. For example, missing an aerial after a clean approach is a mechanics question, while jumping for a ball your partner already covered is a rotation question even when the shot goes in. Boost settles a lot of the argument: a big pad refills the tank to 100, and small pads give 12. Second, bring a close Doubles replay plus your platform and input. Finally, both formats run on your own account using Discord voice and screen share.',
    prices:
      'Both Rocket League lessons from Duoly cost {amount:learn}. Both are sold by the hour, and an hour of Play and Learn happens inside live Doubles, so the coach reacts to real kickoffs, challenges and recoveries. An hour of Mechanics Training happens in free play and training packs, where one touch can be repeated 20 times with no match on the line. First, pick the hour that matches the problem. For example, a player who keeps ball-chasing learns more from live Doubles than from another aerial drill. Bundles do not apply to coaching, so a second hour costs {price:mech} again, and both formats run using Discord screen share.',
    steps: [
      'Pick the hour that matches the problem: live Doubles or mechanics in free play.',
      'Check out once, upfront: both formats cost {amount:learn}. The hour is yours either way.',
      'Meet your Grand Champion coach in the order chat and start on Discord.',
    ],
    booking:
      'A Rocket League booking is a single checkout for one hour, so decide first whether the hour belongs in a live queue or in training. The order chat is where an hour gets set up properly: send your platform, your input, your usual playlist and a replay showing how a goal was conceded. For example, the touch before a double commit explains more than the shot that beat the keeper. Keep your camera and sensitivity settings unchanged, because a coach has to see real habits. Finally, keep your login private and invite the coach from your own account. A Grand Champion coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'How should the second player read a Doubles attack?',
        paragraphs: [
          'A good second-player position is a place to pressure the next touch while still covering a dangerous clear. First, watch whether your partner can recover after the challenge. For example, a rebound above the opposing net looks inviting while both defenders are already moving toward the ball. Pause the replay before the commit and name the worst likely clear. Small pads give 12. A route across five small pads is therefore worth a short detour.',
          'Second, keep enough boost for the drive back toward your own net. Comparing a few replays using Discord screen share shows whether the same commitment keeps leaving you stranded. Finally, judge the decision on the information available before the touch rather than on whether the shot went in. A Grand Champion coach from Duoly can replay the same ten seconds 3 times until the read becomes obvious.',
        ],
      },
      {
        heading: 'How can you practice recovering after a tempting rebound?',
        paragraphs: [
          'A controlled recovery is a landing and a route back into the play after an aerial or a challenge. First, choose a replay where a missed rebound left the net open. For example, pause as your partner shoots and compare your boost with the distance to the next safe position. Name where a losing challenge would send the ball. A standard Doubles clock runs 5:00. Overtime removes the clock, so a bad landing can decide the whole match.',
          'Second, practice a simple aerial, land on the wheels and steer toward a useful route. Ask the coach to tie the drill to the replay rather than adding an unrelated trick, since a pack repeated 10 times at a controlled speed beats five attempts at full speed. Finally, keep the first version slow enough to control the landing before adding height, speed or a harder angle. A Grand Champion coach from Duoly watches the attempts using Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for Rocket League coaching is one replay, two timestamps and one practice question. Save a close Doubles match showing the approach to a conceded goal. Mark the two moments that matter, for example 1) the touch before a double commit and 2) the recovery that never happened. Share your platform, input, region and usual playlist before the hour starts. Keep familiar camera and sensitivity settings rather than changing everything an hour before practice. Test voice and screen share using Discord, then hide private notifications. Name your rank and the playlist you queue, so a Grand Champion coach from Duoly can pitch the 2026 drills at the right level. Agree on the goal before loading into a drill or a queue. Keep account access private and send the invite from your own account. Finally, repeat the chosen exercise at a controlled pace so the coach sees a habit rather than one lucky attempt.',
    faq: [
      [
        'Which lesson should I pick?',
        'Two Rocket League lessons are open in 2026, and the replay usually decides. Mechanics Training is the hour for aerials, flicks and recoveries. Play and Learn is the hour for Doubles rotation, boost management and knowing when to challenge. If the answer is unclear, bring the replay of a conceded goal.',
      ],
      [
        'How much does it cost?',
        'Both Rocket League lessons from Duoly cost {amount:learn}. Both are hourly, and talking a play through is part of the hour, so a live session has no fixed match count. For example, a second hour costs {price:mech} again.',
      ],
      [
        'Should I change my settings first?',
        'First, keep your usual camera and sensitivity so the coach sees real habits. Share your platform, input and playlist, then bring a close Doubles replay with the touches before a double commit.',
      ],
      [
        'Will I have something to practice afterward?',
        'Yes. Mechanics Training ends with training packs for aerials, flicks and recoveries, and the coach ties one drill to your replay using Discord screen share.',
      ],
    ],
  },
  fortnite: {
    title: 'Fortnite Coaching for Builds, Edits and Decisions | Duoly',
    h1: 'Fortnite coaching for your next practice goal',
    lead: 'Choose a Fortnite coach for live learning or Creative build and edit practice. Set the mode and input first so the lesson fits the fights you play.',
    format:
      'Fortnite coaching from Duoly is a booked hour with an Unreal coach, and two formats are open in 2026. **Play and Learn** is a live hour of Ranked, with the coach talking through cover, zone rotations and which fights are worth taking. **Build and Edit Course** is an hour in Creative on piece control, edits and box fights. First, say whether you play Builds or Zero Build, and whether you use controller or keyboard. For example, a fast edit still exposes your whole character when the wall opens from the wrong position, and Creative is the place to slow that peek down. A finished wood wall holds 150. Brick and metal take longer to reach full strength, so the material you place decides how much time an edit really costs. Second, keep your usual sensitivity and binds. Finally, both formats run on your own account using Discord voice and screen share.',
    prices:
      'Both Fortnite lessons from Duoly cost {amount:learn}. Both are sold by the hour, and an hour of Play and Learn happens inside live Ranked, so the coach reads the storm, the rotation and the fight you are about to take. An hour of Build and Edit Course happens in Creative, where one box fight can be rerun 20 times without a Victory Royale at stake. First, pick the hour that matches the problem. For example, a Zero Build player gets nothing from edit drills and everything from a live rotation lesson. Bundles do not apply to coaching, so a second hour costs {price:build} again, and both formats run using Discord screen share.',
    steps: [
      'Pick the hour that matches the mode: live Ranked or Creative build and edit practice.',
      'Check out once, upfront: both formats cost {amount:learn}. The hour is yours either way.',
      'Meet your Unreal coach in the order chat and start on Discord.',
    ],
    booking:
      'A Fortnite booking is a single checkout for one hour, so name the mode and the input before paying. The order chat is where an hour gets set up properly: send your region, your platform, your binds and a clip of a fight you lost. For example, the seconds before a lost box fight show the setup and the recovery, which a kill cam never does. A Battle Royale lobby holds 100. Most of a match is therefore rotation rather than fighting, and a live hour can cover both. Finally, keep your login private and invite the coach from your own account. An Unreal coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'How do you make an edit safer before adding speed?',
        paragraphs: [
          'A safer edit is an opening that gives you a shot while limiting the angle the opponent gets back. First, check piece ownership and your position before opening the wall. For example, standing too close to the middle exposes your whole character even when the edit is fast. Choose one protected peek and name two things out loud: 1) the angle you open and 2) the route back behind cover.',
          'Second, open the same wall 20 times from the same position before adding speed, then reset after the shot and get back behind cover. Keep the same input and sensitivity while the coach watches the setup using Discord screen share. Finally, ask an Unreal coach from Duoly to judge the setup and the recovery alongside the edit, since a clean edit into an open angle still loses the fight. Zero Build players should take the live hour and work on cover, rotations and fight selection instead.',
        ],
      },
      {
        heading: 'How can you practice an edit, shot and reset together?',
        paragraphs: [
          'An edit and reset drill is a controlled sequence of opening a shot, firing and returning behind cover. First, start inside a box with a wall you own. For example, choose an opening that keeps most of your character protected from a target directly ahead. Check your position before touching the edit. Repeat the sequence until the reset feels controlled, usually around 10. Then move the target angle and ask whether the same opening still works.',
          'Second, ask the coach to match the drill to your controller or keyboard, because a keyboard setup can hide a bind problem a controller player never has. Finally, count controlled returns to cover before trying to go faster. A short clip of a lost fight ties the Creative drill to a decision you recognize, and an Unreal coach from Duoly can compare the clip with the drill using Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for Fortnite coaching is a clear mode, your input and one clip of a repeatable problem. Share your region, platform and experience before the hour starts. Bring the seconds before a lost box fight, for example 1) the setup you built and 2) the recovery that never came. Name whether the goal belongs in Creative or in live Ranked. Keep familiar settings and binds so the coach sees your usual execution rather than a fresh setup. Epic Games changes the loot pool and the map every season, so name the 2026 season you are playing. Test voice and screen share using Discord, then hide private notifications. Load the right mode before the call and keep your account under your own control. Never send login details to anyone, including an Unreal coach from Duoly. Finally, practice a simple edit and reset at a controlled speed before trying to go faster.',
    faq: [
      [
        'Which lesson should I pick?',
        'Two Fortnite lessons are open in 2026, and the mode usually decides. Build and Edit Course is the hour for box fights, piece control and edits in Creative. Play and Learn is the hour for Ranked decisions, including zone rotations and fight selection. Zero Build players should take the live hour.',
      ],
      [
        'How much does it cost?',
        'Both Fortnite lessons from Duoly cost {amount:learn}. Both are hourly, so pick the mode and the input you actually play before booking. A second hour costs {price:build} again.',
      ],
      [
        'Can I take a lesson on controller?',
        'Yes. First, share your controller or keyboard setup so the coach can match the drills to your input. Keep your usual binds and sensitivity, then bring a clip of a lost box fight to show whether the problem starts with positioning or the edit.',
      ],
      [
        'What if I only play Zero Build?',
        'Take Play and Learn and say so at booking. For example, bring a question about cover, zone rotations or when to leave a fight, then share the clip using Discord screen share.',
      ],
    ],
  },
  'teamfight-tactics': {
    title: 'TFT Coaching and Teamfight Tactics Econ Review | Duoly',
    h1: 'TFT coaching for economy and decisions',
    lead: 'Book TFT coaching to review when you level, roll and commit to a board. Build a decision process that adapts when the shop does not cooperate.',
    format:
      'Teamfight Tactics coaching from Duoly is **Comp and Econ Review**, a booked hour with a Master+ coach on compositions, economy and spending, and the service is open in 2026. First, bring a full recording with the shop, bench, items and augment choices visible, because a final-board screenshot hides every decision that spent your gold or health. For example, a reroll comp looks unfinished when the roll came too early, the wrong pairs were held, or the lobby contested the same units. Interest pays 1 gold for every 10 you hold, capped at 5. A greedy save and a weak board therefore rarely survive together. Second, note the set and patch, since unit costs, traits and viable boards change. Finally, the hour runs using Discord voice and screen share, with time to pause, compare lines and rebuild the spending plan.',
    prices:
      'Comp and Econ Review from Duoly costs {amount:econ}. The lesson is sold by the hour, and the hour is the point: a full Teamfight Tactics game takes over half an hour to play and far longer to understand. An hour with a Master+ coach buys the pauses at stage transitions, where gold, health and level actually get decided. First, pick the game you want opened rather than the game you placed best in. For example, a fourth place with a clean econ plan teaches more than a first place handed over by a lucky augment. Bundles do not apply to coaching, so a second hour costs {price:econ} again, and the review runs using Discord screen share.',
    steps: [
      'Pick the game you want opened and record the full match, not the final board.',
      'Check out once, upfront: the review costs {amount:econ}. The hour is yours.',
      'Meet your Master+ coach in the order chat and start on Discord.',
    ],
    booking:
      'A Teamfight Tactics booking is a single checkout for one hour of review, so choose the recording before paying. The order chat is where the hour gets set up properly: send the set, the patch, the recording link and the two spending moments you want opened. For example, a roll-down at stage 3 and a level decision at stage 4 are enough for a full hour. Mark the timestamps rather than describing the game from memory, because the shop you saw matters more than the board you finished with. Finally, keep your login private and your account your own. A Master+ coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'How should you connect gold to board strength?',
        paragraphs: [
          'Economy management is a trade between future buying power and the health a weak board gives away now. First, check health, pairs, item holders and the strength of the next few opponents. For example, saving for interest gets expensive when a cheap upgrade would have stopped two heavy losses. Interest caps at 5. Holding 90 gold therefore earns no more than holding 50, which is the moment to spend.',
          'Second, accept a temporary board when the items and the shop disagree with your opening plan. Pause before spending and name the upgrades available at the current level, then compare the same moment across the whole recording using Discord screen share. Finally, bring the set and patch with the game, because Riot Games rebalances carries constantly and the 2026 set decides which boards stay affordable. A Master+ coach from Duoly judges the plan on the information available before the shop refreshed, not on the final placement.',
        ],
      },
      {
        heading: 'How do you review a decision to roll or level?',
        paragraphs: [
          'A roll or level review is a comparison of the upgrades on offer, the gold in hand and the health cost of waiting. First, pause at a stage transition before any gold is spent. For example, a weak front line holding several pairs calls for a different answer from a stable board needing one more unit. Rolling at level 8 is a different bet from rolling at 7. Write down gold, health, level and the reason for the choice.',
          'Second, compare the likely upgrades with the next opponents and the items sitting unassigned on your bench. A Master+ coach from Duoly will often watch the same stage 3 times before answering. Finally, include the games that went well and the games that fell apart, so a lucky shop does not become the whole explanation for a spending habit, and keep the recording open using Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for Teamfight Tactics coaching is one full recording with the shop, bench, items and augment choices visible. Note the current set and patch before sending the link. A final-board screenshot cannot show whether a roll made sense before the upgrades appeared. Choose two spending moments and write the reason for each, for example 1) a roll-down at stage 3 and 2) a level decision at stage 4. Riot Games reshuffles units, traits and augments with every set, so name the 2026 set you played. Keep the game audio and the shop visible in the recording rather than cropping to the board. Test voice and screen share using Discord, then hide private notifications. Make a short sheet for gold, health and level and fill the sheet in at each stage transition with a Master+ coach from Duoly watching. Finally, bring the game you want to understand, even when the placement was poor.',
    faq: [
      [
        'Which lesson should I pick?',
        'Comp and Econ Review is the one Teamfight Tactics lesson from Duoly, and the hour follows your composition, gold and spending choices through a full game. Board Coach on the game hub is separate live help sold per game. For example, pick the review when you want time to pause and compare lines.',
      ],
      [
        'How much does it cost?',
        'Comp and Econ Review from Duoly costs {amount:econ}. The booking is one hour of review, and a second hour costs {price:econ} again. Board Coach has its own per-game price on the game hub.',
      ],
      [
        'Is a screenshot of my final board enough?',
        'No. First, record the full game with the shop, bench, items and augment choices, then note the set and patch. Mark the roll-down or comp pivot that felt unclear so the coach sees the options you actually had.',
      ],
      [
        'Can I review a game where I got unlucky?',
        'Yes. Include the shops before and after the decision, then share the recording using Discord screen share. The review compares econ, health and available upgrades without treating the placement as proof.',
      ],
    ],
  },
  'apex-legends': {
    title: 'Apex Legends Coaching and Movement Practice | Duoly',
    h1: 'Apex Legends coaching for movement and rotations',
    lead: 'Choose Apex coaching for live Ranked learning or focused movement practice. Work on reaching the next position with enough options to take the fight.',
    format:
      'Apex Legends coaching from Duoly is a booked hour with a Master coach, and two formats are open in 2026. **Play and Learn** is a live hour of Ranked, with the coach reading rotations, legend roles and third-party risk as the game happens. **Movement Course** is an hour of focused practice in the Firing Range on tap-strafes, slide jumps, wall bounces and positioning. First, share your input, platform and preferred legends, because a technique from a keyboard clip rarely transfers to a controller. For example, a clean slide into an open crossing still leaves the squad exposed when another team holds the angle. Apex Ranked plays in squads of 3. Movement that only works for one player is therefore movement the squad cannot follow. Second, bring a clip with the approach to a fight. Finally, both formats run on your own account using Discord voice and screen share.',
    prices:
      'Both Apex Legends lessons from Duoly cost {amount:learn}. Both are sold by the hour, and an hour of Play and Learn happens inside live Ranked, so the coach talks through the ring, the rotation and the fight before the fight starts. An hour of Movement Course happens in the Firing Range, where the same route can be run 20 times with nothing at stake. First, pick the hour that matches the problem. For example, a player who dies to third parties needs rotation reads rather than another wall bounce. Bundles do not apply to coaching, so a second hour costs {price:move} again, and both formats run using Discord screen share.',
    steps: [
      'Pick the hour that matches the problem: live Ranked or Firing Range movement.',
      'Check out once, upfront: both formats cost {amount:learn}. The hour is yours either way.',
      'Meet your Master coach in the order chat and start on Discord.',
    ],
    booking:
      'An Apex Legends booking is a single checkout for one hour, so decide first whether the hour belongs in Ranked or in the Firing Range. The order chat is where an hour gets set up properly: send your region, your platform, your input and the legends you queue. For example, a clip showing the approach to a crossing explains more than the final knock. A live hour has no fixed match count, since a Ranked game can end in 4 minutes or run to the last ring. Finally, keep your login private and invite the coach from your own account. A Master coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'How should movement connect to cover in Apex Legends?',
        paragraphs: [
          'Useful movement is a route toward cover or a fighting angle that leaves you options for the next action. First, ask where a technique puts your character after the landing. For example, a quick slide into an exposed lane can create a harder fight than a slower protected route. Name the next piece of cover and one fallback before leaving safety. A squad holds 3. Every route therefore has to work for two teammates as well as for you.',
          'Second, match the technique to your input, platform and legend rather than copying an unrelated clip. Rehearse the route in the Firing Range using Discord screen share, and run the same approach 10 times so the coach can watch aim and control settle. Finally, ask whether another squad already holds the angle. A Master coach from Duoly ties the execution back to ring information, spacing and the choice to take or leave a fight.',
        ],
      },
      {
        heading: 'How do you review a rotation after losing the angle?',
        paragraphs: [
          'A late rotation is a move started after another squad already controls the route or the position you wanted. First, pause the clip before your squad leaves cover. For example, the direct path into the next ring gets dangerous when opponents already watch the only crossing. Compare cover, alternate routes and the information your legend abilities gave you, then name an earlier signal to move. A Ranked lobby starts with 20 squads and ends with 1.',
          'Second, choose the next protected position and a fallback in case the position is occupied. Watching the same rotation 2 times usually reveals the signal the whole squad missed. Finally, test a simple move toward cover while keeping aim under control, and a Master coach from Duoly adapts the drill to your input and platform before adding speed, using Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for Apex Legends coaching is your region, platform, input and one clear goal for the hour. Name your preferred legends and the fight or rotation you want to understand. Bring a clip showing the approach, for example 1) the route your squad took and 2) the moment the third party arrived. A clip starting at the knock hides the decision that caused the knock. Respawn Entertainment reworks legends and the map rotation every season, so name the 2026 split you are playing. Choose live Ranked or Firing Range practice before the call starts, because the two hours use completely different drills. Test voice and screen share using Discord, then hide private notifications. Confirm Ranked queue eligibility, or have the Firing Range loaded and ready. Never send login details to anyone, including a Master coach from Duoly. Finally, rehearse one simple move toward cover before asking for a harder variation.',
    faq: [
      [
        'Which lesson should I pick?',
        'Two Apex Legends lessons are open in 2026, and the cause of death usually decides. Movement Course is the hour for control and movement in the Firing Range. Play and Learn is the hour for Ranked rotations, legend roles and reading third-party risk. Share your input and platform before agreeing on techniques.',
      ],
      [
        'How much does it cost?',
        'Both Apex Legends lessons from Duoly cost {amount:learn}. Both are hourly, and a live hour has no fixed match count because game length and review time vary. For example, a second hour costs {price:move} again.',
      ],
      [
        'What kind of clip should I bring?',
        'First, include the route into the fight, the ring information and squad positions. Name your legend and the call you wanted, for example a push onto high ground. A clip starting at the knock hides the rotation that invited the third party.',
      ],
      [
        'Does the coach fill our whole trio?',
        'No. The booking adds one coach beside you, so the third seat still comes from your party or the queue. Agree who covers which legend role before queueing, using Discord voice.',
      ],
    ],
  },
  'marvel-rivals': {
    title: 'Marvel Rivals Coaching and Hero Practice | Duoly',
    h1: 'Marvel Rivals coaching for your hero and role',
    lead: 'Book Marvel Rivals coaching for live learning or a focused hero lesson. Learn when to use your abilities and when your team is ready to follow.',
    format:
      'Marvel Rivals coaching from Duoly is a booked lesson with a Grandmaster+ coach, and two formats are open in 2026. **Play and Learn** is one Competitive match with the coach talking through engages, cooldowns and resets, plus a quick review afterwards. **Hero Coaching** is an hour on one hero: abilities, ultimate timing, positioning and matchups. First, bring the role you actually queue, whether Vanguard, Duelist or Strategist. For example, a Strategist who spends a defensive cooldown just before a dive and a Vanguard who engages before the team can follow have very different problems. Marvel Rivals Competitive is 6 versus 6. A strong combo still needs five other players in position to use the opening. Second, bring the current patch and your hero pool so Team-Ups stay relevant. Finally, both formats run on your own account using Discord voice and screen share.',
    prices:
      'Every Marvel Rivals lesson from Duoly costs {amount:learn}. The unit is the real difference. Play and Learn is sold per match: one Competitive game beside a Grandmaster+ coach, with the calls happening live. Hero Coaching is sold by the hour, which buys the pauses, the matchup talk and the ability sequences a live match never waits for. First, pick the unit that matches the problem. For example, a player who keeps losing the same hero matchup learns more from an hour than from another Competitive queue. Bundles do not apply to coaching, so a second hour costs {price:hero} again, and both formats run using Discord screen share.',
    steps: [
      'Pick the format for the problem: one live Competitive match or an hour on one hero.',
      'Check out once, upfront: every format costs {amount:learn}. The unit is what differs.',
      'Meet your Grandmaster+ coach in the order chat and start on Discord.',
    ],
    booking:
      'A Marvel Rivals booking is a single checkout for one lesson, so check whether the format is sold per match or by the hour before paying. The order chat is where a lesson gets set up properly: send your platform, your region, your hero pool and the patch you are playing. For example, a line naming one hero and one lost team fight is enough to start. NetEase Games has shipped new heroes and Team-Ups every season since the launch in 2024. Finally, keep your login private and invite the coach from your own account. A Grandmaster+ coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'How does your role change a Marvel Rivals team fight?',
        paragraphs: [
          'A team fight in Marvel Rivals is a chain of role decisions, and every role carries a different risk. First, look at the Vanguard: space created before the team can use the space is space wasted. A Duelist takes an angle and needs an escape route for the same angle. A Strategist spends cooldowns and has to keep one back for the moment an opponent commits.',
          'Second, check who could see the target and which cooldowns were ready before the engage. Hero Coaching stays with the hero you play: a dive hero needs a plan for getting out, while a backline hero needs safe sightlines and flank awareness. For example, bring the current patch, because the roster has grown every season since 2024. Finally, a Grandmaster+ coach from Duoly works from your own recording using Discord screen share.',
        ],
      },
      {
        heading:
          'Example team fight: why can an ultimate fail without follow-up?',
        paragraphs: [
          'An ultimate without follow-up is an ultimate used before teammates can act on the opening. For example, the ultimate opens a fight while two teammates are still walking back from spawn. The animation looks strong and the team still cannot take the point. Pause before the activation and count who can act, which enemy defensive abilities are known, and whether the objective needs an immediate contest.',
          'A small practice task is to review 5 ultimate uses from your next matches. First, write the intended purpose before judging the outcome: engage, response, survival or objective contest. Second, check whether the teammates needed for the plan were alive and close. Watching one ultimate 2 times shows whether the team could have followed. A full team is 6. Finally, ask a Grandmaster+ coach from Duoly for a hero-specific cue that spots the same moment sooner, reviewing clips using Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for Marvel Rivals coaching is context: hero, role, patch and one problem. Bring your platform, region, hero pool and the current patch before the call. A recording should include the lead-up to the fight, teammate positions and the objective. Pick two timestamps where the call was unclear, for example 1) an engage you regret and 2) an ultimate nobody followed. NetEase Games adds heroes and Team-Ups every season, so name the 2026 season you are playing. For Hero Coaching, choose one hero and the matchup that keeps going wrong. For Play and Learn, confirm your ranks can queue together in Competitive. Test voice and screen share using Discord, then hide private notifications. Stay on your own account and never send login details, including to a Grandmaster+ coach from Duoly. Finally, write your main role in one line so the hour starts with the right questions.',
    faq: [
      [
        'Which lesson should I pick?',
        'Two Marvel Rivals lessons are open in 2026, and the problem picks the lesson. Hero Coaching is the hour for one hero, including matchups, Team-Ups and ultimate timing. Play and Learn is one Competitive match with live feedback. Bring the role you actually queue: Vanguard, Duelist or Strategist.',
      ],
      [
        'How much does it cost?',
        'Every Marvel Rivals lesson from Duoly costs {amount:learn}. Play and Learn is billed per Competitive match, while Hero Coaching is billed per hour, so a second hour costs {price:hero} again.',
      ],
      [
        'What should I bring to Hero Coaching?',
        'First, name your hero, role and current patch. Bring a recording with the lead-up to a fight, including teammate positions, then mark an ultimate you were unsure about or a Team-Up that never found an opening.',
      ],
      [
        'Can I work on team fights as a Strategist?',
        'Yes. For example, work on when to hold a defensive ability, where to move a healing sightline or whether to save an ultimate, then share the full fight using Discord screen share.',
      ],
    ],
  },
};
