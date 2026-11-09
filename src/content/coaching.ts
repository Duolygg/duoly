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
      'Valorant coaching from Duoly is a booked lesson at {amount:learn}, and three formats are open in 2026. **Play and Learn** puts an Immortal+ coach in one live Competitive game beside you, talking through routes, utility and trades while the round happens. **VOD Review** is an hour to pause a recent match and rebuild the rounds together. **Aim and Crosshair** spends the hour on crosshair placement, peeking and counter-strafing, ending with a routine you keep. First, decide where your rounds fall apart. For example, a lost opening duel can mean a crosshair trailing the angle, a flash landing late or nobody close enough to trade. Second, bring the agent you actually queue, and include eco rounds as well as full buys. A Sheriff with light shields costs 1200, so the plan for an eco differs from a rifle round with full utility. Finally, every lesson runs on your own Riot account using Discord voice and screen share.',
    prices:
      'Every Valorant lesson from Duoly costs {amount:learn}. The real choice is the unit you book. Play and Learn is sold per game: one live Competitive match beside an Immortal+ coach, however long the match runs. VOD Review and Aim and Crosshair are sold by the hour, which buys the pauses and rewinds a live game cannot. First, pick the unit that matches the problem. For example, a player who already knows which rounds go wrong learns more from an hour of VOD Review than from another live match. Bundles do not apply to coaching, so a second hour costs {amount:vod} like the first, and both hourly lessons run using Discord screen share.',
    steps: [
      'Pick the format for the problem: a live game, an hour of VOD Review or an hour on aim.',
      'Check out once, upfront: every format costs {amount:learn}. The unit is what differs.',
      'Meet your coach in the order chat and start on Discord.',
    ],
    booking:
      'A Valorant booking is a single checkout for one lesson, so check whether the format is sold per game or by the hour before paying. The order chat is where a lesson gets set up properly: send your region, your agent pool and the round you want to open with. For example, a line saying you lose B site retakes on Ascent saves ten minutes of guessing. Send your Riot ID and your current rank too, so the coach arrives knowing which lobbies you actually queue into. Finally, keep your login private and a coach from Duoly never needs a password, only a call using Discord.',
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
          'For practice, mark the first contact of 5 rounds in your next recording. First, note whether a teammate could trade. Second, check whether the crosshair sat at head height before the opponent appeared. Finally, compare each moment with the round result rather than the scoreboard. A Competitive match is a race to 13. Replaying one peek 3 times usually settles whether the route or the shot was the problem, and an Immortal+ coach from Duoly adapts the exercise to your role and agent, reviewing clips using Discord screen share. Want the playing side instead? [Valorant teammates](/games/valorant) lists every service, and the [Valorant LFG page](/games/valorant/lfg) compares the free Discords with a paid duo.',
        ],
      },
    ],
    prepare:
      'Preparation for Valorant coaching is a short checklist, and ten minutes before the call is enough. For VOD Review, bring a full match recording with the HUD and audio intact. Add two timestamps where the round felt unclear, for example 1) a peek you could not explain and 2) a rotation that arrived late. A close game teaches more than a highlight reel, so pick the match that ended 13-11 rather than 13-3. Note the patch as well, because Riot Games keeps adjusting agent utility through the 2026 season. For Aim and Crosshair, keep your usual sensitivity and crosshair so the coach sees real habits. For Play and Learn, send your current rank and the mode you want, because an Immortal+ coach plays the game beside you and explains every decision out loud. Test voice and screen share using Discord, then hide private notifications. Never send login details to anyone, including a coach from Duoly. Finally, write one line naming the habit you want changed by the end of the hour.',
    faq: [
      [
        'Which lesson should I pick?',
        'Three Valorant lessons are open in 2026, and the problem picks the lesson. VOD Review is the choice for players who already know which rounds go wrong, because an hour of pausing beats another live match. Aim and Crosshair suits a crosshair or peeking problem. Play and Learn is for applying a plan during a Competitive game.',
      ],
      [
        'How much does it cost?',
        'Every Valorant lesson from Duoly costs {amount:learn}. Play and Learn is billed per game, while VOD Review and Aim and Crosshair are billed per hour, so a second hour of review costs {amount:vod} like the first.',
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
      'League of Legends coaching from Duoly is a booked lesson at {amount:learn}, and three formats are open in 2026. **Play and Learn** puts a Master+ coach in one live ranked game beside you, talking through trades, recalls and objectives while the game happens. **VOD Review** is an hour with a Grandmaster+ coach who follows your laning, wave management and map moves, then narrows the game down to three things to fix. **Champion Mastery** is an hour on one champion: matchups, combos, builds and power spikes, practiced in a live game. First, bring the role and champion pool you actually queue. For example, a mid laner who keeps dying after the first recall usually needs wave control and jungle tracking rather than another combo. Each outer turret carries 5 plates. Fixing the first ten minutes therefore changes the rest of the game. Finally, every lesson runs on your own Riot account using Discord voice and screen share.',
    prices:
      'Every League of Legends lesson from Duoly costs {amount:learn}. The unit is the real difference. Play and Learn is sold per game: one live ranked game beside a Master+ coach, however long the game runs. VOD Review and Champion Mastery are sold by the hour, which buys pauses and rewinds. First, pick the unit that matches the problem. For example, a player who already knows the losing matchup learns more from an hour of Champion Mastery than from another ranked queue. Bundles do not apply to coaching, and both hourly lessons run using Discord screen share.',
    steps: [
      'Pick the format for the problem: a live ranked game, an hour of VOD Review or an hour on one champion.',
      'Check out once, upfront: every format costs {amount:learn}. The unit is what differs.',
      'Meet your coach in the order chat and start on Discord.',
    ],
    booking:
      'A League of Legends booking is a single checkout for one lesson, so check whether the format is sold per game or by the hour before paying. The order chat is where a lesson gets set up properly: send your server, your role and the replay you want opened. For example, a line saying the Renekton matchup keeps going wrong as Camille saves ten minutes of guessing. Send your Riot ID and your division too, so a Master+ coach knows which lobbies to expect and a Grandmaster+ coach can open the right replay. Finally, keep your login private and a coach from Duoly never needs a password, only a call using Discord.',
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
          'A take-home exercise is to label your first 3 recalls in the next game. Use three labels: wave crashed, wave rolling toward you, or wave held away from you. Add the information available before pressing B. Replaying the same recall 3 times usually ends the argument. A recall at 13:30 is a different decision from a recall at 15:00. Plates make the early reset more expensive, and a Grandmaster+ coach from Duoly adapts the task to your matchup, watching the replay using Discord screen share. Want the playing side instead? [League of Legends teammates](/games/league-of-legends) lists every service, and [Play League of Legends with someone](/games/league-of-legends/play-with-someone) covers ARAM, normals and ranked duo.',
        ],
      },
    ],
    prepare:
      'Preparation for League of Legends coaching is one replay and one honest question about your role. For VOD Review, bring a recent full replay with the patch and the role you played. Pick a loss where decisions were still open, for example 1) a recall you regret and 2) a fight you joined late. A game lost by a small margin teaches more than a 15-minute surrender. Riot Games ships a new patch every two weeks, so name the patch you played in the 2026 season. For Champion Mastery, name one champion and the matchups that keep going wrong. For Play and Learn, send your server and your division, so the coach assigned is one ranked lets you queue with. Test voice and screen share using Discord, then hide private chat and notifications. Stay on your own Riot account and never send login details, including to a coach from Duoly. Finally, write the one decision you want to make differently in your next ranked game.',
    faq: [
      [
        'Which lesson should I pick?',
        'Three League of Legends lessons are open in 2026, and the problem picks the lesson. VOD Review is the choice for wave management, jungle tracking and map decisions. Champion Mastery is an hour on one champion and the matchups around the champion. Play and Learn is for making the calls during a live ranked game.',
      ],
      [
        'How much does it cost?',
        'Every League of Legends lesson from Duoly costs {amount:learn}. Play and Learn is billed per game, while VOD Review and Champion Mastery are billed per hour with a Grandmaster+ coach, so a second hour costs {amount:vod} like the first.',
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
      'Rocket League coaching from Duoly is a booked hour at {amount:learn} with a Grand Champion coach, and two formats are open in 2026. **Play and Learn** is a live hour of Doubles, with the coach talking through kickoffs, rotation, boost and challenges. One Rocket League match runs about seven minutes, so a booked hour usually covers 6 or 7 Doubles matches. **Mechanics Training** is an hour on aerials, flicks and recoveries, ending with training packs you keep. First, decide whether the problem is the execution or the decision before the touch. For example, missing an aerial after a clean approach is a mechanics question, while jumping for a ball your partner already covered is a rotation question. Boost settles a lot of the argument: a big pad refills the tank to 100, and small pads give 12. Finally, both formats run on your own account using Discord voice and screen share.',
    prices:
      'Both Rocket League lessons from Duoly cost {amount:learn}. Both are sold by the hour, and an hour of Play and Learn happens inside live Doubles, so the coach reacts to real kickoffs, challenges and recoveries. An hour of Mechanics Training happens in free play and training packs, where one touch can be repeated 20 times with no match on the line. First, pick the hour that matches the problem. For example, a player who keeps ball-chasing learns more from live Doubles than from another aerial drill. Bundles do not apply to coaching, so a second hour costs {amount:mech} like the first, and both formats run using Discord screen share.',
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
          'A good second-player position is a place to pressure the next touch while still covering a dangerous clear. First, watch whether your partner can recover after the challenge. For example, a rebound above the opposing net looks inviting while both defenders are already moving toward the ball. Pause the replay before the commit and name the worst likely clear. Five small pads add up to 60. Driving the pad line often beats crossing the field for a big pad.',
          'Second, keep enough boost for the drive back toward your own net. Comparing a few replays using Discord screen share shows whether the same commitment keeps leaving you stranded. Finally, judge the decision on the information available before the touch rather than on whether the shot went in. A Grand Champion coach from Duoly can replay the same ten seconds 3 times until the read becomes obvious.',
        ],
      },
      {
        heading: 'How can you practice recovering after a tempting rebound?',
        paragraphs: [
          'A controlled recovery is a landing and a route back into the play after an aerial or a challenge. First, choose a replay where a missed rebound left the net open. For example, pause as your partner shoots and compare your boost with the distance to the next safe position. Name where a losing challenge would send the ball. A standard Doubles clock runs 5:00. Overtime removes the clock, so a bad landing can decide the whole match.',
          'Second, practice a simple aerial, land on the wheels and steer toward a useful route. Ask the coach to tie the drill to the replay rather than adding an unrelated trick, since a pack repeated 10 times at a controlled speed beats five attempts at full speed. Finally, keep the first version slow enough to control the landing before adding height, speed or a harder angle. A Grand Champion coach from Duoly watches the attempts using Discord screen share. Want the playing side instead? [Rocket League teammates](/games/rocket-league) lists every service, from a Doubles hour to the 3v3 Standard fill.',
        ],
      },
    ],
    prepare:
      'Preparation for Rocket League coaching is one replay, two timestamps and one practice question. Save a close Doubles match showing the approach to a conceded goal. Mark the two moments that matter, for example 1) the touch before a double commit and 2) the recovery that never happened. Share your platform, input, region and usual playlist before the hour starts. Keep familiar camera and sensitivity settings rather than changing everything an hour before practice. Test voice and screen share using Discord, then hide private notifications. Name your rank and the playlist you queue, so a Grand Champion coach from Duoly can pitch the drills at the right level for the 2026 season. Agree on the goal before loading into a drill or a queue. Keep account access private and send the invite from your own account. Finally, repeat the chosen exercise at a controlled pace so the coach sees a habit rather than one lucky attempt.',
    faq: [
      [
        'Which lesson should I pick?',
        'Two Rocket League lessons are open in 2026, and the replay usually decides. Mechanics Training is the hour for aerials, flicks and recoveries. Play and Learn is the hour for Doubles rotation, boost management and knowing when to challenge. If the answer is unclear, bring the replay of a conceded goal.',
      ],
      [
        'How much does it cost?',
        'Both Rocket League lessons from Duoly cost {amount:learn}. Both are hourly, and talking a play through is part of the hour, so a live session has no fixed match count. For example, a second hour costs {amount:mech} like the first.',
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
      'Fortnite coaching from Duoly is a booked hour at {amount:learn}, and two formats are open in 2026. **Play and Learn** is a live hour of Ranked, with the coach talking through cover, zone rotations and which fights are worth taking. A battle royale game has no fixed length, so a booked hour usually covers 3 or 4 Ranked games rather than a set number. **Build and Edit Course** is an hour in Creative on piece control, edits and box fights. First, say whether you play Builds or Zero Build, and whether you use controller or keyboard. For example, a fast edit still exposes your whole character when the wall opens from the wrong position. A finished wood wall holds 150, and brick and metal take longer to reach full strength, so the material decides how much time an edit costs. Finally, both formats run on your own account using Discord voice and screen share.',
    prices:
      'Both Fortnite lessons from Duoly cost {amount:learn}. Both are sold by the hour, and an hour of Play and Learn happens inside live Ranked, so the coach reads the storm, the rotation and the fight you are about to take. An hour of Build and Edit Course happens in Creative, where one box fight can be rerun 20 times without a Victory Royale at stake. First, pick the hour that matches the problem. For example, a Zero Build player gets nothing from edit drills and everything from a live rotation lesson. Bundles do not apply to coaching, so a second hour costs {amount:build} like the first, and both formats run using Discord screen share.',
    steps: [
      'Pick the hour that matches the mode: live Ranked or Creative build and edit practice.',
      'Check out once, upfront: both formats cost {amount:learn}. The hour is yours either way.',
      'Meet your coach in the order chat and start on Discord.',
    ],
    booking:
      'A Fortnite booking is a single checkout for one hour, so name the mode and the input before paying. The order chat is where an hour gets set up properly: send your region, your platform, your binds and a clip of a fight you lost. For example, the seconds before a lost box fight show the setup and the recovery, which a kill cam never does. A Battle Royale lobby holds 100, so most of a match is rotation rather than fighting. Send your rank as well, because the lobby follows the highest rank in the party. Finally, keep your login private and a coach from Duoly never needs a password, only a call using Discord.',
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
          'Second, ask the coach to match the drill to your controller or keyboard, because a keyboard setup can hide a bind problem a controller player never has. Finally, count controlled returns to cover before trying to go faster. A short clip of a lost fight ties the Creative drill to a decision you recognize, and an Unreal coach from Duoly can compare the clip with the drill using Discord screen share. Want the playing side instead? [Fortnite teammates](/games/fortnite) lists every service, and the [Fortnite duos page](/games/fortnite/duos) compares the free Fill button with a booked hour.',
        ],
      },
    ],
    prepare:
      'Preparation for Fortnite coaching is a clear mode, your input and one clip of a repeatable problem. Share your region, platform and experience before the hour starts. Bring the seconds before a lost box fight, for example 1) the setup you built and 2) the recovery that never came. Name whether the goal belongs in Creative or in live Ranked. Keep familiar settings and binds so the coach sees your usual execution rather than a fresh setup. Epic Games changes the loot pool and the map every season, so name the 2026 season you are playing. Test voice and screen share using Discord, then hide private notifications. Load the right mode before the call and keep your account under your own control. Never send login details to anyone, including a coach from Duoly. Finally, practice a simple edit and reset at a controlled speed before trying to go faster.',
    faq: [
      [
        'Which lesson should I pick?',
        'Two Fortnite lessons are open in 2026, and the mode usually decides. Build and Edit Course is the hour for box fights, piece control and edits in Creative. Play and Learn is the hour for Ranked decisions, including zone rotations and fight selection. Zero Build players should take the live hour.',
      ],
      [
        'How much does it cost?',
        'Both Fortnite lessons from Duoly cost {amount:learn}. Both are hourly, so pick the mode and the input you actually play before booking. A second hour costs {amount:build} like the first.',
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
      'Teamfight Tactics coaching from Duoly is **Comp and Econ Review**, a booked hour at {amount:econ} with a Master+ coach on compositions, economy and spending, open in 2026. First, bring a full recording with the shop, bench, items and augment choices visible, because a final-board screenshot hides every decision that spent your gold or health. For example, a reroll comp looks unfinished when the roll came too early, the wrong pairs were held, or the lobby contested the same units. Interest pays 1 gold for every 10 you hold, capped at 5. A greedy save and a weak board therefore rarely survive together. Second, note the set and patch, since unit costs, traits and viable boards change. Finally, the hour runs using Discord voice and screen share, with time to pause, compare lines and rebuild the spending plan.',
    prices:
      'Comp and Econ Review from Duoly costs {amount:econ}. The lesson is sold by the hour, and the hour is the point: a full Teamfight Tactics game takes over half an hour to play and far longer to understand. An hour with a Master+ coach buys the pauses at stage transitions, where gold, health and level actually get decided. First, pick the game you want opened rather than the game you placed best in. For example, a fourth place with a clean econ plan teaches more than a first place handed over by a lucky augment. Bundles do not apply to coaching, so a second hour costs {amount:econ} like the first, and the review runs using Discord screen share.',
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
          'Economy management is a trade between future buying power and the health a weak board gives away now. First, check health, pairs, item holders and the strength of the next few opponents. For example, saving for interest gets expensive when a cheap upgrade would have stopped two heavy losses. Interest caps at 5. Holding 90 gold therefore earns no more than holding 50, so the extra 40 belongs on the board.',
          'Second, accept a temporary board when the items and the shop disagree with your opening plan. Pause before spending and name the upgrades available at the current level, then compare the same moment across the whole recording using Discord screen share. Finally, bring the set and patch with the game, because Riot Games rebalances carries constantly and the 2026 set decides which boards stay affordable. A Master+ coach from Duoly judges the plan on the information available before the shop refreshed, not on the final placement.',
        ],
      },
      {
        heading: 'How do you review a decision to roll or level?',
        paragraphs: [
          'A roll or level review is a comparison of the upgrades on offer, the gold in hand and the health cost of waiting. First, pause at a stage transition before any gold is spent. For example, a weak front line holding several pairs calls for a different answer from a stable board needing one more unit. Rolling at level 8 is a different bet from rolling at 7. Write down gold, health, level and the reason for the choice.',
          'Second, compare the likely upgrades with the next opponents and the items sitting unassigned on your bench. A Master+ coach from Duoly will often watch the same fight 3 times before answering. Finally, include the games that went well and the games that fell apart, so a lucky shop does not become the whole explanation for a spending habit, and keep the recording open using Discord screen share. Want the playing side instead? [Teamfight Tactics partners](/games/teamfight-tactics) lists every service, from a Double Up partner to a live Board Coach.',
        ],
      },
    ],
    prepare:
      'Preparation for Teamfight Tactics coaching is one full recording with the shop, bench, items and augment choices visible. Note the current set and patch before sending the link. A final-board screenshot cannot show whether a roll made sense before the upgrades appeared. Choose two spending moments and write the reason for each, for example 1) a roll-down at stage 3 and 2) a level decision at stage 4. Riot Games reshuffles units, traits and augments with every set, so name the 2026 set you played. Keep the game audio and the shop visible in the recording rather than cropping to the board. Test voice and screen share using Discord, then hide private notifications. Keep your account under your own control and never send login details, including to a Master+ coach from Duoly. Make a short sheet for gold, health and level, and fill in one line at every stage transition. Finally, bring the game you want to understand, even when the placement was poor.',
    faq: [
      [
        'Which lesson should I pick?',
        'Comp and Econ Review is the one Teamfight Tactics lesson from Duoly, and the hour follows your composition, gold and spending choices through a full game. Board Coach on the game hub is separate live help sold per game. For example, pick the review when you want time to pause and compare lines.',
      ],
      [
        'How much does it cost?',
        'Comp and Econ Review from Duoly costs {amount:econ}. The booking is one hour of review, and a second hour costs {amount:econ} like the first. Board Coach has its own per-game price on the game hub.',
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
      'Apex Legends coaching from Duoly is a booked hour at {amount:learn}, and two formats are open in 2026. **Play and Learn** is a live hour with the coach reading rotations, legend roles and third-party risk. A Ranked game can end in 4 minutes or run to the last ring, so the hour has no fixed game count. **Movement Course** is an hour in the Firing Range on tap-strafes, slide jumps, wall bounces and positioning. First, share your input, platform and preferred legends, because a technique from a keyboard clip rarely transfers to a controller. For example, a clean slide into an open crossing still leaves the squad exposed when another team holds the angle. Apex Ranked plays in squads of 3, so movement only one player can run is movement the squad cannot follow. Finally, both formats run on your own account using Discord voice and screen share.',
    prices:
      'Both Apex Legends lessons from Duoly cost {amount:learn}. Both are sold by the hour, and an hour of Play and Learn happens inside live Ranked or Mixtape, so the coach talks through the ring, the rotation and the fight before the fight starts. An hour of Movement Course happens in the Firing Range, where the same route can be run 20 times with nothing at stake. First, pick the hour that matches the problem. For example, a player who dies to third parties needs rotation reads rather than another wall bounce. Bundles do not apply to coaching, so a second hour costs {amount:move} like the first, and both formats run using Discord screen share.',
    steps: [
      'Pick the hour that matches the problem: live Ranked or Firing Range movement.',
      'Check out once, upfront: both formats cost {amount:learn}. The hour is yours either way.',
      'Meet your coach in the order chat and start on Discord.',
    ],
    booking:
      'An Apex Legends booking is a single checkout for one hour, so decide first whether the hour belongs in Ranked or in the Firing Range. The order chat is where an hour gets set up properly: send your region, your platform, your input and the legends you queue. For example, a clip showing the approach to a crossing explains more than the final knock. A live hour has no fixed match count, since a Ranked game can end in 4 minutes or run to the last ring. Send your rank as well, so the coach arrives knowing which lobbies you actually drop into. Finally, keep your login private and a coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'How should movement connect to cover in Apex Legends?',
        paragraphs: [
          'Useful movement is a route toward cover or a fighting angle that leaves you options for the next action. First, ask where a technique puts your character after the landing. For example, a quick slide into an exposed lane can create a harder fight than a slower protected route. Name two things before leaving safety: 1) the next piece of cover and 2) the fallback if the cover is taken. Every route has to work for two teammates as well as for you.',
          'Second, match the technique to your input, platform and legend rather than copying an unrelated clip. Rehearse the route in the Firing Range using Discord screen share, and run the same approach 10 times so the coach can watch aim and control settle. Finally, ask whether another squad already holds the angle. A Master coach from Duoly ties the execution back to ring information, spacing and the choice to take or leave a fight.',
        ],
      },
      {
        heading: 'How do you review a rotation after losing the angle?',
        paragraphs: [
          'A late rotation is a move started after another squad already controls the route or the position you wanted. First, pause the clip before your squad leaves cover. For example, the direct path into the next ring gets dangerous when opponents already watch the only crossing. Compare cover, alternate routes and the information your legend abilities gave you, then name an earlier signal to move. A Ranked lobby starts with 20 squads and ends with 1.',
          'Second, choose the next protected position and a fallback in case the position is occupied. Watching the same rotation 3 times usually reveals the signal the whole squad missed. Finally, test a simple move toward cover while keeping aim under control, and a Master coach from Duoly adapts the drill to your input and platform before adding speed, using Discord screen share. Want the playing side instead? [Apex Legends teammates](/games/apex-legends) lists every service, and the [Apex Legends LFG page](/games/apex-legends/lfg) compares auto fill with a booked hour.',
        ],
      },
    ],
    prepare:
      'Preparation for Apex Legends coaching is your region, platform, input and one clear goal for the hour. Name your preferred legends and the fight or rotation you want to understand. Bring a clip showing the approach, for example 1) the route your squad took and 2) the moment the third party arrived. A clip starting at the knock hides the decision that caused the knock. Respawn Entertainment reworks legends and the map rotation every season, so name the 2026 split you are playing. Choose live Ranked or Firing Range practice before the call starts, because the two hours use completely different drills. Test voice and screen share using Discord, then hide private notifications. Send your rank and the mode you want, because a Master coach plays the hour beside you and explains every decision out loud. Never send login details to anyone, including a coach from Duoly. Finally, rehearse one simple move toward cover before asking for a harder variation.',
    faq: [
      [
        'Which lesson should I pick?',
        'Two Apex Legends lessons are open in 2026, and the cause of death usually decides. Movement Course is the hour for control and movement in the Firing Range. Play and Learn is the hour for rotations, legend roles and third-party risk, beside a Master coach in live Ranked.',
      ],
      [
        'How much does it cost?',
        'Both Apex Legends lessons from Duoly cost {amount:learn}. Both are hourly, and a live hour has no fixed match count because game length and review time vary. For example, a second hour costs {amount:move} like the first.',
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
      'Marvel Rivals coaching from Duoly is a booked lesson at {amount:learn}, and two formats are open in 2026. **Play and Learn** is one live match with the coach talking through engages, cooldowns and resets, plus a quick review afterwards. Play and Learn is sold per match, so a 3-0 sweep and a seven-round decider cost the same. **Hero Coaching** is an hour on one hero: abilities, ultimate timing, positioning and matchups. First, bring the role you actually queue, whether Vanguard, Duelist or Strategist. For example, a Strategist who spends a defensive cooldown just before a dive and a Vanguard who engages before the team can follow have very different problems. Marvel Rivals Competitive is 6 versus 6. A strong combo still needs five other players in position to use the opening. Second, bring the current patch and your hero pool so Team-Ups stay relevant. Finally, both formats run on your own account using Discord voice and screen share.',
    prices:
      'Every Marvel Rivals lesson from Duoly costs {amount:learn}. The unit is the real difference. Play and Learn is sold per match: one live Competitive game beside a Grandmaster+ coach, however long the series runs. Hero Coaching is sold by the hour, which buys the pauses, the matchup talk and the ability sequences a live match never waits for. First, pick the unit that matches the problem. For example, a player who keeps losing the same hero matchup learns more from an hour than from another Competitive queue. Bundles do not apply to coaching, so a second hour costs {amount:hero} like the first, and both formats run using Discord screen share.',
    steps: [
      'Pick the format for the problem: one live Competitive match or an hour on one hero.',
      'Check out once, upfront: every format costs {amount:learn}. The unit is what differs.',
      'Meet your coach in the order chat and start on Discord.',
    ],
    booking:
      'A Marvel Rivals booking is a single checkout for one lesson, so check whether the format is sold per match or by the hour before paying. The order chat is where a lesson gets set up properly: send your platform, your region, your hero pool and the patch you are playing. For example, a line naming one hero and one lost team fight is enough to start. NetEase Games has shipped new heroes and Team-Ups every season since the launch in 2024. Send your rank as well, so a Grandmaster+ coach knows which lobbies to expect and the hero pool stays realistic. Finally, keep your login private and a coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'How does your role change a Marvel Rivals team fight?',
        paragraphs: [
          'A team fight in Marvel Rivals is a chain of role decisions, and every role carries a different risk. First, look at the Vanguard: space the team cannot use yet is space wasted. A Duelist takes an angle and needs an escape route off the same angle. A Strategist spends cooldowns and has to keep one back for the moment an opponent commits.',
          'Second, check who could see the target and which cooldowns were ready before the engage. Hero Coaching stays with the hero you play: a dive hero needs a plan for getting out, while a backline hero needs safe sightlines and flank awareness. For example, bring the current patch, because the roster has grown every season since 2024. Finally, a Grandmaster+ coach from Duoly works from your own recording using Discord screen share.',
        ],
      },
      {
        heading:
          'Example team fight: why can an ultimate fail without follow-up?',
        paragraphs: [
          'An ultimate without follow-up is an ultimate used before teammates can act on the opening. For example, the ultimate opens a fight while two teammates are still walking back from spawn. The animation looks strong and the team still cannot take the point. Pause before the activation and count who can act, which enemy defensive abilities are known, and whether the objective needs an immediate contest.',
          'A small practice task is to review 5 ultimate uses from your next matches. First, write the intended purpose before judging the outcome: 1) engage, 2) response, 3) survival or 4) objective contest. Second, check whether the teammates needed for the plan were alive and close. Watching one ultimate 3 times shows whether the whole team could have followed. Finally, ask a Grandmaster+ coach from Duoly for a hero-specific cue that spots the same moment sooner, reviewing clips using Discord screen share. Want the playing side instead? [Marvel Rivals teammates](/games/marvel-rivals) lists every service, and the [Marvel Rivals duo partner](/games/marvel-rivals/duo-partner) page covers hero pairings.',
        ],
      },
    ],
    prepare:
      'Preparation for Marvel Rivals coaching is context: hero, role, patch and one problem. Bring your platform, region, hero pool and the current patch before the call. A recording should include the lead-up to the fight, teammate positions and the objective. Pick two timestamps where the call was unclear, for example 1) an engage you regret and 2) an ultimate nobody followed. NetEase Games adds heroes and Team-Ups every season, so name the 2026 season you are playing. For Hero Coaching, choose one hero and the matchup that keeps going wrong. For Play and Learn, send your rank and the mode you want, because a Grandmaster+ coach plays the match beside you and explains every decision out loud. Test voice and screen share using Discord, then hide private notifications. Stay on your own account and never send login details, including to a coach from Duoly. Finally, write your main role in one line so the hour starts with the right questions.',
    faq: [
      [
        'Which lesson should I pick?',
        'Two Marvel Rivals lessons are open in 2026, and the problem picks the lesson. Hero Coaching is the hour for one hero, including matchups, Team-Ups and ultimate timing. Play and Learn is one live Competitive match with feedback as it happens, beside a Grandmaster+ coach. Bring the role you actually queue: Vanguard, Duelist or Strategist.',
      ],
      [
        'How much does it cost?',
        'Every Marvel Rivals lesson from Duoly costs {amount:learn}. Play and Learn is billed per match, while Hero Coaching is billed per hour with a Grandmaster+ coach, so a second hour costs {amount:hero} like the first.',
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
  'counter-strike-2': {
    title: 'CS2 Coaching, Demo Review and Lineups | Duoly',
    h1: 'CS2 coaching for your demos and your map pool',
    lead: 'Book a CS2 coach for a live Premier match, an hour of demo review or a lineup session for your map pool. Fix one mid-round habit before adding more utility.',
    format:
      'Counter-Strike 2 coaching from Duoly is a booked lesson at {amount:learn}, and three formats are open in 2026. **Play and Learn** puts a coach in a live Premier match, calling buys, rotations and mid-round reads. **Demo Review** is an hour with a FACEIT 10 coach who opens your own demo and follows positioning, crosshair placement and utility. **Utility and Lineups** spends the hour on smokes, flashes and molotovs for the maps you queue. First, decide whether the round died on the buy, the execute or the retake. For example, a lost 5v4 often starts with a flash thrown before anyone could use the opening. Valve prices an AK-47 at 2700 and an AWP at 4750, so a force buy and a full buy are different plans. Premier is first to 13, with half-time after 12 rounds. Finally, every lesson runs on your own Steam account using Discord voice and screen share.',
    prices:
      'Every Counter-Strike 2 lesson from Duoly costs {amount:learn}. The unit is the real difference. Play and Learn is sold per game: one live match beside a coach the queue accepts, with the calls happening live. Demo Review and Utility and Lineups are sold by the hour with a FACEIT 10 coach, which buys the pauses, rewinds and X-ray a live server cannot. First, pick the unit that matches the problem. For example, a player who already knows which rounds go wrong learns more from an hour of demo review than from another Premier queue. Bundles do not apply to coaching, so a second hour costs {amount:demo} like the first, and both hourly lessons run using Discord screen share.',
    steps: [
      'Pick the format for the problem: a live match, an hour of demo review or an hour on utility.',
      'Check out once, upfront: every format costs {amount:learn}. The unit is what differs.',
      'Meet your coach in the order chat and start on Discord.',
    ],
    booking:
      'A Counter-Strike 2 booking is a single checkout for one lesson, so check whether the format is sold per game or by the hour before paying. The order chat is where a lesson gets set up properly: send your region, your map pool and the demo you want opened. For example, a line saying you keep losing Mirage A retakes saves ten minutes of guessing. Send your Steam profile link and your CS Rating too, so the coach arrives knowing which lobbies you actually queue into. Finally, keep your login private and a coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'Why does a lost round usually start on the buy screen?',
        paragraphs: [
          'A buy is a plan for the whole round, and the plan decides the fight. First, count the money on both teams before choosing a weapon. Valve prices an AK-47 at 2700 and an AWP at 4750, so a rifle with no utility is often a worse buy than a cheaper gun plus a smoke and two flashes. Valve prices a flashbang at 200 and a smoke at 300.',
          'Second, agree the round type out loud: full buy, force or save. For example, a team that saves two rifles starts the next round with real utility instead of pistols. Premier is first to 13, so half-time arrives after 12 rounds and the side you struggle on gets a second chance. Finally, a FACEIT 10 coach from Duoly ties every buy to your own demo using Discord screen share, and the same hour can compare 3 buys from the same half.',
        ],
      },
      {
        heading: 'Example round: what makes a site execute fall apart?',
        paragraphs: [
          'A failed execute is utility spent before anyone can use the space it opened. For example, the smoke lands, the flash goes over the wall and the entry player is still three seconds behind. Pause the demo before the first smoke and ask 1) who was ready to enter, 2) which angle the flash actually covered and 3) whether a defender had already rotated. Moving on the utility usually beats a better spray.',
          'For practice, mark the first utility of 5 rounds in your next demo. First, note whether a teammate moved on the flash. Second, check whether the smoke sat on the angle the entry had to cross. Finally, compare each moment with the round result rather than the scoreboard. Replaying one execute 3 times usually settles whether the utility or the timing was the problem, and a FACEIT 10 coach from Duoly adapts the exercise to your role and your map pool, reviewing the demo using Discord screen share. Want the playing side instead? [Counter-Strike 2 teammates](/games/counter-strike-2) lists every service, from a Premier duo to a FACEIT stack.',
        ],
      },
    ],
    prepare:
      'Preparation for Counter-Strike 2 coaching is a short checklist, and ten minutes before the call is enough. For Demo Review, download the demo of a recent Premier or FACEIT match and have it ready to load. Add two timestamps where the round felt unclear, for example 1) an execute nobody followed and 2) a rotation that arrived late. A close match teaches more than a stomp, so pick the game that ended 13-11 rather than 13-3. Note your map pool as well, since a lineup only helps on a map you actually queue. For Utility and Lineups, say whether you play Premier, FACEIT or both. For Play and Learn, send your CS Rating, because a FACEIT Level 10 coach plays the match beside you and explains every call out loud. Test voice and screen share using Discord, then hide private notifications. Never send login details to anyone, including a coach from Duoly. Finally, write one line naming the habit you want changed by the end of the hour.',
    faq: [
      [
        'Which lesson should I pick?',
        'Three Counter-Strike 2 lessons are open in 2026, and the problem picks the lesson. Demo Review is the choice for players who already know which rounds go wrong, because an hour of pausing beats another Premier queue. Utility and Lineups suits a map pool with holes in it.',
      ],
      [
        'How much does it cost?',
        'Every Counter-Strike 2 lesson from Duoly costs {amount:learn}. Play and Learn is billed per game, while Demo Review and Utility and Lineups are billed per hour with a FACEIT 10 coach, so a second hour of review costs {amount:demo} like the first.',
      ],
      [
        'Do I need a demo?',
        'First, download a recent Premier or FACEIT demo for Demo Review and have it ready to load. Mark a round where utility felt wasted and a duel you cannot explain. Utility and Lineups and live Play and Learn need no demo at all.',
      ],
      [
        'Can I work on just one map?',
        'Yes, and a narrow goal works better. For example, name Mirage A site executes or Inferno banana control, then share the demo using Discord screen share.',
      ],
    ],
  },
  'overwatch-2': {
    title: 'Overwatch 2 Coaching and Role Coaching | Duoly',
    h1: 'Overwatch 2 coaching for your role and your rank',
    lead: 'Book an Overwatch 2 coach for a live Competitive match or an hour on your role. Learn when to take space and when your team is ready to follow.',
    format:
      'Overwatch 2 coaching from Duoly is a booked lesson at {amount:learn}, and two formats are open in 2026. **Play and Learn** is one live Competitive match with the coach talking through engages, cooldowns and resets, plus a quick review afterwards. **Role Coaching** is an hour on tank, damage or support: positioning, cooldown use and when to take space. Play and Learn is sold per match, so a fast two-round push and a full five-round grind cost the same. First, bring the role you actually queue. For example, a support who spends a defensive cooldown just before a dive and a tank who engages before the team can follow have very different problems. Role Queue fills one tank, two damage and two support, so Overwatch 2 is 5 versus 5 and a strong engage still needs four teammates in position. Finally, both formats run on your own account using Discord voice and screen share.',
    prices:
      'Every Overwatch 2 lesson from Duoly costs {amount:learn}. The unit is the real difference. Play and Learn is sold per match: one live Competitive game beside a Grandmaster+ coach, with the calls happening live. Role Coaching is sold by the hour, which buys the pauses, the matchup talk and the cooldown sequences a live match never waits for. First, pick the unit that matches the problem. For example, a player who keeps losing the same role matchup learns more from an hour than from another Competitive queue. Bundles do not apply to coaching, so a second hour costs {amount:role} like the first, and the hourly lesson runs using Discord screen share.',
    steps: [
      'Pick the format for the problem: one live Competitive match or an hour on your role.',
      'Check out once, upfront: every format costs {amount:learn}. The unit is what differs.',
      'Meet your Grandmaster+ coach in the order chat and start on Discord.',
    ],
    booking:
      'An Overwatch 2 booking is a single checkout for one lesson, so check whether the format is sold per match or by the hour before paying. The order chat is where a lesson gets set up properly: send your platform, your region, your role and the hero pool you queue. For example, a line naming one hero and one lost team fight is enough to start. Send your BattleTag too, so the invite does not become a search. Say whether you want the live match in Competitive or in Quick Play before the coach queues, because the two read very differently. Finally, keep your login private and a coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'How does your role change an Overwatch 2 team fight?',
        paragraphs: [
          'A team fight in Overwatch 2 is a chain of role decisions, and every role carries a different risk. First, check 1) the tank, where space the team cannot use yet is space wasted, 2) the damage hero, who takes an angle and needs an escape route off the same angle, and 3) the support, who has to keep one cooldown back for the moment an opponent commits. Role Queue fills one tank, two damage and two support.',
          'Second, check who could see the target and which cooldowns were ready before the engage. Role Coaching stays with the role you play: a dive tank needs a plan for getting out, while a backline support needs safe sightlines and flank awareness. For example, Control is a best of three, so a lost first round is information rather than a loss. Finally, a Grandmaster+ coach from Duoly works from your own recording using Discord screen share.',
        ],
      },
      {
        heading: 'Example fight: how do you track the ultimate economy?',
        paragraphs: [
          'Ultimate economy is the difference between the ultimates your team holds and the ones the other team holds. First, count out loud before a fight: 1) two ultimates against none is a fight to take, and 2) none against two is a fight to delay. For example, a team that contests a point with no cooldowns ready usually hands over the ultimate charge that wins the next fight.',
          'A small practice task is to name the enemy ultimate you fear most, once per fight, across 5 fights in your next matches. First, say the hero and the counter your team holds. Second, check whether a defensive ultimate was saved for it. Finally, compare the call with what actually happened rather than with the scoreboard. Overwatch 2 is 5 versus 5, so one missing teammate changes the maths, and a Grandmaster+ coach from Duoly adapts the exercise to your role using Discord screen share. Want the playing side instead? [Overwatch 2 teammates](/games/overwatch-2) lists every service, and the [Overwatch 2 LFG page](/games/overwatch-2/lfg) compares the free servers with a booked role.',
        ],
      },
    ],
    prepare:
      'Preparation for Overwatch 2 coaching is context: role, hero pool, rank and one problem. Bring your platform, region and BattleTag before the call. A recording should include the lead-up to the fight, teammate positions and the objective. Pick two timestamps where the call was unclear, for example 1) an engage you regret and 2) an ultimate nobody followed. Blizzard ships new heroes and balance changes every season, so name the 2026 season you are playing. For Role Coaching, choose one role and the matchup that keeps going wrong. For Play and Learn, say whether you want the live match in Competitive or in Quick Play, where no rank is on the line. Test voice and screen share using Discord, then hide private notifications. Stay on your own account and never send login details, including to a coach from Duoly. Finally, write your main role in one line so the hour starts with the right questions.',
    faq: [
      [
        'Which lesson should I pick?',
        'Two Overwatch 2 lessons are open in 2026, and the problem picks the lesson. Role Coaching is the hour for one role: positioning, cooldown use and the matchups around your hero pool. Play and Learn is one live Competitive match with feedback as it happens.',
      ],
      [
        'How much does it cost?',
        'Every Overwatch 2 lesson from Duoly costs {amount:learn}. Play and Learn is billed per match, while Role Coaching is billed per hour with a Grandmaster+ coach, so a second hour costs {amount:role} like the first.',
      ],
      [
        'Which coach tier comes with an Overwatch 2 lesson?',
        'Yes: Play and Learn is one live Competitive match with a Grandmaster+ coach, and Role Coaching is an hour on tank, damage or support. Both cost the same, because coaching is one flat price.',
      ],
      [
        'Can I work on support?',
        'Yes. For example, work on when to hold a defensive cooldown, where to stand for a safe healing sightline or whether to save an ultimate, then share the full fight using Discord screen share.',
      ],
    ],
  },
  'rainbow-six-siege': {
    title: 'Rainbow Six Siege Coaching and Operator Lab | Duoly',
    h1: 'Rainbow Six Siege coaching for your maps and operators',
    lead: 'Book an R6 coach for a live Ranked match, an hour on two operators or a room-by-room pass on your weakest map. Turn one lost site into a setup you can repeat.',
    format:
      'Rainbow Six Siege coaching from Duoly is a booked lesson at {amount:learn}, and three formats are open in 2026. **Play and Learn** puts a coach in a live Ranked match, calling drones, rotations and where the defenders are while the round happens. **Operator Lab** is an hour on one attacker and one defender: gadgets, setups and timings. **Map and Callouts** is an hour on your weakest map, room by room, with callouts, rotations and a setup for every site. Play and Learn is sold per match, so a 4-0 and a 7-6 overtime cost the same. First, decide whether the round died in the prep phase or in the fight. For example, a lost site often starts with a reinforcement spent on a wall nobody was going to attack. Each defender carries 2 reinforcements, so a team has 10 walls to spend. Finally, every lesson runs on your own account using Discord voice and screen share.',
    prices:
      'Every Rainbow Six Siege lesson from Duoly costs {amount:learn}. The unit is the real difference. Play and Learn is sold per game: one live Ranked match beside a Champion coach, however long it runs. Operator Lab and Map and Callouts are sold by the hour with a Champion coach, which buys the pauses, the custom game and the repeats a live round cannot. First, pick the unit that matches the problem. For example, a player who keeps losing the same site learns more from an hour on the map than from another Ranked queue. Bundles do not apply to coaching, so a second hour costs {amount:ops} like the first, and both hourly lessons run using Discord screen share.',
    steps: [
      'Pick the format for the problem: a live match, an hour on two operators or an hour on one map.',
      'Check out once, upfront: every format costs {amount:learn}. The unit is what differs.',
      'Meet your coach in the order chat and start on Discord.',
    ],
    booking:
      'A Rainbow Six Siege booking is a single checkout for one lesson, so check whether the format is sold per game or by the hour before paying. The order chat is where a lesson gets set up properly: send your platform, your operator pool and the map you keep losing. For example, a line saying you cannot hold Clubhouse basement saves ten minutes of guessing. Send your Ubisoft name and your rank too, so the coach arrives knowing which lobbies you actually queue into. Finally, keep your login private and a coach from Duoly never needs a password, only a call using Discord.',
    sections: [
      {
        heading: 'Why does a defence usually break during the prep phase?',
        paragraphs: [
          'A prep phase is a budget, and spending the budget badly loses the round before anyone shoots. First, count the walls. Each defender carries 2 reinforcements, so a team has 10 to spend, and a wall placed where no attacker was coming is a wall the site never gets.',
          'Second, agree who anchors and who roams before the drones land. For example, two roamers on the same side of the map leave the site with one defender and no rotation. Finally, keep 1) one rotation hole open so a defender can reach the second site and 2) one anchor who never leaves, and a Champion coach from Duoly ties every reinforcement to your own recording using Discord screen share, often watching the same prep phase 3 times.',
        ],
      },
      {
        heading: 'Example round: what makes a site retake fail?',
        paragraphs: [
          'A failed retake is a push onto a planted defuser without the information the push needed. For example, two defenders enter from the same door while the third is still rotating. A defuser runs for 45 seconds once planted, so the clock is the real opponent. Pause the recording as the plant lands and ask 1) who had a line on the defuser, 2) which gadget could have delayed the plant and 3) whether the two pushes could have arrived together.',
          'For practice, mark the plant in 5 rounds from your next recordings. First, note how many seconds were left when the first defender arrived. Second, check whether a second angle was covered. Finally, compare each retake with the round result rather than the scoreboard. Replaying one retake 3 times usually settles whether the timing or the entry was the problem, and a Champion coach from Duoly adapts the exercise to your operator pool using Discord screen share. Want the playing side instead? [Rainbow Six Siege teammates](/games/rainbow-six-siege) lists every service, and the [Siege LFG page](/games/rainbow-six-siege/lfg) compares the free servers with a booked duo.',
        ],
      },
    ],
    prepare:
      'Preparation for Rainbow Six Siege coaching is your platform, your rank and one map you keep losing. For Map and Callouts, name the map and the site that goes wrong most often. Bring a recording with the prep phase included, for example 1) the reinforcements you placed and 2) the rotation that never happened. A clip starting at the plant hides the setup that caused the plant. Ubisoft reworks operators and the map rotation every season, so name the 2026 season you are playing. For Operator Lab, pick one attacker and one defender rather than a whole pool. For Play and Learn, send your rank and the mode you want, because a Champion coach plays the match beside you and explains every call out loud. Test voice and screen share using Discord, then hide private notifications. Never send login details to anyone, including a coach from Duoly. Finally, write one line naming the habit you want changed by the end of the hour.',
    faq: [
      [
        'Which lesson should I pick?',
        'Three Rainbow Six Siege lessons are open in 2026, and the problem picks the lesson. Map and Callouts is the hour for a map you keep losing, room by room. Operator Lab suits one attacker and one defender you want to use properly. Play and Learn is for calling drones and rotations during a live match.',
      ],
      [
        'How much does it cost?',
        'Every Rainbow Six Siege lesson from Duoly costs {amount:learn}. Play and Learn is billed per game, while Operator Lab and Map and Callouts are billed per hour with a Champion coach, so a second hour costs {amount:ops} like the first.',
      ],
      [
        'Which coach tier comes with a Siege lesson?',
        'Play and Learn is one live Ranked match with a Champion coach, and the Operator Lab and Map and Callouts are hours with the same tier. Send your rank in the order chat so the lesson starts on the right map.',
      ],
      [
        'Can I work on just one site?',
        'Yes, and a narrow goal works better. For example, name Clubhouse basement or Oregon basement, then share the recording using Discord screen share.',
      ],
    ],
  },
  'call-of-duty': {
    title: 'Call of Duty Coaching: Warzone and Loadouts | Duoly',
    h1: 'Call of Duty coaching for Warzone and your loadouts',
    lead: 'Book a Call of Duty coach for a live Warzone hour or an hour on loadouts and movement. Fix one habit at a time, from the drop to the final circle.',
    format:
      'Call of Duty coaching from Duoly is a booked hour at {amount:learn}, and 2 formats are open in 2026. **Play and Learn** is a live hour where your coach drops with you and talks through rotations, plates, buy station timing and which fights are worth taking. **Loadouts and Movement** is an hour on builds, slide cancels, mantles and positioning, drilled in private matches at {amount:loadout}. First, decide which half of Call of Duty the hour belongs to: 1) Warzone, where rotations and the circle decide games, or 2) multiplayer Ranked Play, where spawns and an objective do. For example, a player who wins most gunfights and still finishes 20th has a rotation problem rather than an aim problem. Finally, every lesson runs on your own Activision account using Discord voice and screen share.',
    prices:
      'Every Call of Duty lesson from Duoly costs {amount:learn}, and both formats are sold by the hour, because a Warzone match has no fixed length. First, an hour of Play and Learn usually covers about 2 full battle royale games including queue time, so one lesson is a session rather than a single match. Second, Loadouts and Movement spends the hour in private matches and the firing range, where a build can be changed and tested in a minute instead of over a whole game. Bundles and quantity discounts do not apply to coaching, so a second hour costs {amount:loadout} like the first, read from Duoly checkout in November 2026. For example, book the loadout hour first when your weapon list has not changed in 3 seasons, agreed using Discord.',
    steps: [
      'First, pick the format for the problem: 1) a live hour in Warzone or Ranked Play, or 2) an hour on loadouts and movement.',
      'Second, check out once, upfront: both formats cost {amount:learn}, sold by the hour, read from Duoly checkout in November 2026.',
      'Finally, meet your coach in the order chat and start the hour using Discord.',
    ],
    booking:
      'A Call of Duty booking from Duoly is a single checkout for one hourly lesson at {amount:learn}, so pick the format before paying. The order chat is where a lesson gets set up properly: send your platform, your input, your region and the mode the hour should cover. For example, a line saying you keep dying on the rotation into the second circle on Resurgence saves ten minutes of guessing. Send your Activision ID as well, because a live hour is a real party invite. Finally, keep your login private, since a coach from Duoly never needs a password and only needs a call using Discord.',
    sections: [
      {
        heading: 'Why does a lost Warzone game usually start before the fight?',
        paragraphs: [
          'A lost Warzone game is usually a rotation decision made 2 minutes earlier. First, check the route rather than the gunfight. A squad crossing open ground while the circle closes arrives with no plates, no high ground and a third party already watching. Second, check the money, because a loadout bought late means the first real fight happens with a floor weapon. Buy stations, contracts and the circle are the 3 things a plan has to account for before anyone pushes.',
          'For example, your coach can pause after a wipe and ask 3 questions: 1) where the circle was, 2) what the squad had to spend and 3) which building the plan was aiming at. An Iridescent coach from Duoly ties every answer to what was on your screen at the time, using Discord screen share. Multiplayer Ranked Play gets the same treatment on different terms: spawns, lanes and the objective clock. A live hour costs {amount:learn} in 2026, and one habit per hour is the honest target.',
        ],
      },
      {
        heading: 'Example hour: what makes a rotation late?',
        paragraphs: [
          'A late rotation is a move starting after the circle has already decided who holds the ground. For example, a squad finishes a contract, loots 3 bodies, then leaves with 20 seconds left. First, mark the moment your coach says to go and compare with the moment the squad actually left. Second, note what happened in between, because looting one more crate is the usual answer.',
          'A take-home exercise is to call the next rotation out loud 3 times in the hour, before your coach does. Compare each call with the circle timer and with where the squad ended up. An hour of Play and Learn from Duoly costs {amount:learn} and usually covers about 2 full games in 2026, so the same decision comes up more than once. Finally, pick one building or one ridge per game, commit early, then review whether the plan survived contact, reviewed using Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for Call of Duty coaching is a short checklist, and ten minutes before the call is enough. Name your platform and your input first, because a controller player and a keyboard player move differently. Send your region too, since ping decides how a peek feels. Decide the mode before the hour starts, for example 1) Warzone battle royale, 2) Resurgence or 3) multiplayer Ranked Play. Bring the weapon list you actually use, attachments included, so the loadout hour starts from a real build rather than a video. Have your Activision ID ready, because a live hour is a real party invite. Test voice and screen share using Discord, then hide private notifications. Never send login details to anyone, including a coach from Duoly. Finally, write one line naming the habit you want changed by the end of the hour, at {amount:learn} for the live format and {amount:loadout} for the loadout hour.',
    faq: [
      [
        'Which Call of Duty lesson should I pick?',
        'Two lessons are open in 2026. Play and Learn is the live hour for rotations, plates and fight selection. Loadouts and Movement is the hour for builds, slide cancels and positioning.',
      ],
      [
        'How much does Call of Duty coaching cost?',
        'Every Call of Duty lesson from Duoly costs {amount:learn}, sold by the hour. Bundles and quantity discounts do not apply, so a second hour costs {amount:loadout} like the first.',
      ],
      [
        'Can we work on Warzone and multiplayer in one hour?',
        'You can, and a narrow goal works better. For example, name 1) Resurgence rotations for the first hour and 2) Ranked Play spawns for a second one.',
      ],
      [
        'Do I need a recording?',
        'No recording is needed, because both formats are live. Bring your current loadouts instead, plus a note of the minute your games usually fall apart.',
      ],
      [
        'Is coaching the same as booking a Warzone duo?',
        'No. A duo is shared playing time by the hour. Coaching is an hour with a stated learning goal and a review, agreed using Discord.',
      ],
    ],
  },
  'dota-2': {
    title: 'Dota 2 Coaching: Replay Review and Hero Lessons | Duoly',
    h1: 'Dota 2 coaching for your position and hero pool',
    lead: 'Book a Dota 2 coach for a live ranked game, an hour of replay review or an hour on one hero. Work on laning, farming patterns and item timings.',
    format:
      'Dota 2 coaching from Duoly is a booked lesson at {amount:learn}, and 3 formats are open in 2026. **Play and Learn** is a live ranked game where your coach explains laning, smoke timings and when to group, as the game happens. **Replay Review** is an hour on a recent match: laning, farm, map moves and item timings, narrowed to three things to fix at {amount:replay}. **Hero and Position Coaching** is an hour on one hero or one position, practised live. First, bring the position you actually queue, because position 1 and position 5 fail for different reasons. For example, a mid player dying after the first rune usually needs lane equilibrium rather than another combo. Finally, every lesson runs on your own Steam account using Discord voice and screen share.',
    prices:
      'Every Dota 2 lesson from Duoly costs {amount:learn}, and the unit is the real difference. Play and Learn is sold per game, which buys one full ranked match beside your coach. Replay Review and Hero and Position Coaching are sold by the hour, which buys the pauses and rewinds a live game cannot. First, pick the unit matching the problem. For example, a player who already knows which lane goes wrong learns more from an hour of Replay Review than from another ranked queue. Second, a Dota 2 match runs about 40 minutes, so one live game is already a long lesson. Bundles and quantity discounts do not apply to coaching, so a second hour costs {amount:replay} like the first, read from Duoly checkout in November 2026.',
    steps: [
      'First, pick the format for the problem: 1) a live ranked game, 2) an hour of replay review or 3) an hour on one hero.',
      'Second, check out once, upfront: every format costs {amount:learn}, read from Duoly checkout in November 2026. The unit is what differs.',
      'Finally, meet your coach in the order chat and start the lesson using Discord.',
    ],
    booking:
      'A Dota 2 booking from Duoly is a single checkout for one lesson at {amount:learn}, so check whether the format is sold per game or by the hour before paying. The order chat is where a lesson gets set up properly: send your region, your position and the match ID you want opened. For example, a line saying the offlane keeps losing the first 10 minutes against a dual lane saves ten minutes of guessing. Send your Steam name as well, since a live game needs a party invite. Finally, keep your login private, because a coach from Duoly never needs a password and only needs a call using Discord.',
    sections: [
      {
        heading: 'Why does lane equilibrium decide your first 10 minutes?',
        paragraphs: [
          'Lane equilibrium is where the creep waves meet, and equilibrium sets the price of every trade. First, read the wave before pressing an ability. With the wave pushing toward the enemy tower, one trade costs vision, safety and the next few last hits. With the wave held near your own tower, the same trade is almost free. Pulling the small camp on time moves equilibrium back without touching the enemy laner at all.',
          'Second, each position brings different evidence: 1) a carry brings last hit counts at 10 minutes, 2) a mid player brings rune timings and 3) an offlaner brings the moment a dual lane committed. For example, a support review often turns into a ward map and a stack schedule rather than a fight. An Immortal coach from Duoly ties every point to your own replay at {amount:replay}, watched using Discord screen share. Finally, name the patch, because Valve keeps moving gold and item costs through the 2026 season.',
        ],
      },
      {
        heading: 'Example review: what makes an item timing late?',
        paragraphs: [
          'A late item timing is a purchase arriving after the window the item was meant to win. For example, a Black King Bar bought at 25 minutes misses the fight starting at 22. First, find the fight the item was for, then walk the replay backwards to the last minute the gold was reachable. Second, ask what the farm pattern was doing in the same window: a stacked camp cleared on time, or three minutes spent walking.',
          'A take-home exercise is to label your next 3 purchases: 1) on time, 2) early or 3) late. Add the fight each one was meant for. Roshan respawns 8 to 11 minutes after dying, so the Aegis window is the clearest place to check whether a timing was real. An hour of Replay Review from Duoly costs {amount:replay} in 2026, which leaves room to replay the same 2 minutes twice, reviewed using Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for Dota 2 coaching is one replay and one honest question about your position. For Replay Review, bring a recent match ID with the patch and the position you played. Pick a close game rather than a stomp, for example 1) a loss still even at 25 minutes or 2) a win which felt lucky. Valve keeps patching gold, experience and items through the 2026 season, so name the patch you played. For Hero and Position Coaching, name one hero and the matchups going wrong, at {amount:hero} per hour. For Play and Learn, send your region and position so the live game starts on the right lane. Test voice and screen share using Discord, then hide private chat and notifications. Stay on your own Steam account and never send login details, including to a coach from Duoly. Finally, write the one decision you want to make differently.',
    faq: [
      [
        'Which Dota 2 lesson should I pick?',
        'Three lessons are open in 2026. Replay Review suits laning, farm and map decisions. Hero and Position Coaching is an hour on one hero. Play and Learn is the live ranked game.',
      ],
      [
        'How much does Dota 2 coaching cost?',
        'Every Dota 2 lesson from Duoly costs {amount:learn}. Play and Learn is billed per game, while the 2 hourly lessons are billed by the hour, so a second hour costs {amount:hero}.',
      ],
      [
        'What replay should I bring?',
        'First, bring a close game with the match ID, the patch and the position noted. For example, mark 1) a death on a rotation and 2) an item you regret.',
      ],
      [
        'Can I focus on one position?',
        'Yes. Book Hero and Position Coaching, name the position and the matchups going wrong, then share the replay using Discord screen share.',
      ],
      [
        'Is coaching the same as booking a Dota 2 duo?',
        'No. A duo is shared playing time priced per match. Coaching is one lesson with a stated goal and three things to fix afterwards.',
      ],
    ],
  },
  minecraft: {
    title: 'Minecraft Coaching: PvP and Bedwars Lessons | Duoly',
    h1: 'Minecraft coaching for PvP and Bedwars',
    lead: 'Book a Minecraft coach for an hour of PvP drills or an hour on Bedwars. Work on aim, combos, bridging, bed defence and the clutches that end games.',
    format:
      'Minecraft coaching from Duoly is a booked hour at {amount:pvp}, and 2 formats are open in 2026. **PvP Coaching** is an hour on aim, combos, strafing, rod and bow play, drilled in duels on practice servers until the habit sticks. **Bedwars Coaching** is an hour on rush timing, bridging, bed defence and endgame clutches, practised in real games at {amount:bw}. First, pick the format by the moment your games end: 1) losing the opening duel is an aim and combo problem, while 2) losing the bed after winning fights is a defence problem. Second, name the edition, because Java and Bedrock are separate clients with different combat feel. For example, a Hypixel player names the server first. Finally, every lesson runs on your own account using Discord voice and screen share.',
    prices:
      'Every Minecraft lesson from Duoly costs {amount:pvp}, and both formats are sold by the hour, because a duel lasts a minute while a Bedwars game lasts far longer. First, an hour of PvP Coaching is mostly repetitions: the same duel, replayed with one change each round. Second, an hour of Bedwars Coaching usually covers 3 or 4 real games, so a rush can be tried, reviewed and tried again. Bundles and quantity discounts do not apply to coaching, so a second hour costs {amount:bw} like the first, read from Duoly checkout in November 2026. For example, book PvP Coaching when you lose the opening fight, and Bedwars Coaching when the bed falls while you are away, agreed using Discord.',
    steps: [
      'First, pick the format for the problem: 1) an hour of PvP drills, or 2) an hour on Bedwars.',
      'Second, check out once, upfront: both lessons cost {amount:pvp}, sold by the hour, read from Duoly checkout in November 2026.',
      'Finally, meet your coach in the order chat and start the hour using Discord.',
    ],
    booking:
      'A Minecraft booking from Duoly is a single checkout for one hourly lesson at {amount:pvp}, so pick the format before paying. The order chat is where a lesson gets set up properly: send the edition, the server and your Minecraft name. For example, a line saying you play Java on Hypixel and keep losing rod fights saves ten minutes of guessing. Say which combat habits you already have, since a player coming from Bedrock and a player coming from Java start in different places. Finally, keep your login private, because a coach from Duoly never needs a password and only needs a call using Discord.',
    sections: [
      {
        heading: 'Why does a lost duel usually start before the first hit?',
        paragraphs: [
          'A lost duel is usually a positioning problem wearing an aim problem as a disguise. First, check where you were standing. A player backing up in a straight line gives away a free line of hits, while a player strafing and keeping the block edge behind them forces a miss. Second, check the rod and the bow, because knockback landing at the right moment resets a fight aim alone was losing.',
          'For example, your coach can run the same duel 10 times in an hour and change one thing each round: 1) the strafe direction, 2) the moment the rod comes out and 3) where the retreat block goes. A top PvPer coach from Duoly explains the change before each round and checks the result after, using Discord screen share. An hour costs {amount:pvp} in 2026. Finally, keep your own sensitivity and keybinds, so the habits built in the hour are the ones you will actually use.',
        ],
      },
      {
        heading: 'Example hour: what makes a Bedwars rush fail?',
        paragraphs: [
          'A failed Bedwars rush is usually a timing problem rather than a fight problem. For example, a player bridges to the nearest team with 8 wool and arrives alone while the defender already has blocks over the bed. First, count what went with you: wool, blocks, a pick and whether the sword upgrade was worth the delay. Second, check whether your own bed was covered before you left.',
          'A take-home exercise is to run 3 rushes in the hour and change one thing each time: 1) the departure moment, 2) the bridge angle or 3) the block you defend with. Compare each run with what happened to your own bed. An hour of Bedwars Coaching from Duoly costs {amount:bw} in 2026 and usually covers 3 or 4 games. Finally, a Bedwars 1000 star coach adapts the drill to your server and mode, reviewed using Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for Minecraft coaching is a short checklist, and ten minutes before the call is enough. Name the edition first, because Java and Bedrock are separate clients and combat feels different in each. Say which server the hour runs on, for example 1) Hypixel, 2) a practice server or 3) your own world. Have your Minecraft name ready, since a lesson is a real party or a whitelist entry. Keep your usual sensitivity, keybinds and resource pack, so your coach sees real habits. Bring one sentence about where your games end, for example losing the opening duel at {amount:pvp} an hour or losing the bed at {amount:bw}. Test voice and screen share using Discord, then hide private notifications. Never send login details to anyone, including a coach from Duoly. Finally, write one line naming the habit you want changed by the end of the hour.',
    faq: [
      [
        'Which Minecraft lesson should I pick?',
        'Two lessons are open in 2026. PvP Coaching is the hour for aim, combos, strafing and rod play. Bedwars Coaching is the hour for rush timing, bridging and bed defence.',
      ],
      [
        'How much does Minecraft coaching cost?',
        'Every Minecraft lesson from Duoly costs {amount:pvp}, sold by the hour. Bundles and quantity discounts do not apply, so a second hour costs {amount:bw} like the first.',
      ],
      [
        'Does coaching work on Bedrock?',
        'Yes. Name Java or Bedrock when you book, because the 2 editions are separate clients and the combat timing has to match the one you play.',
      ],
      [
        'Which server does the lesson run on?',
        'The one you name in the order chat. For example, 1) a public network such as Hypixel, 2) a practice server or 3) your own world with the coach whitelisted.',
      ],
      [
        'Is coaching the same as booking a PvP duo?',
        'No. A PvP duo is shared playing time by the hour. Coaching is an hour of drills with a stated goal, agreed using Discord.',
      ],
    ],
  },
  'world-of-warcraft': {
    title: 'WoW Coaching: Class, Rotation and Mythic+ | Duoly',
    h1: 'World of Warcraft coaching for your class and keys',
    lead: 'Book a WoW coach for a live Mythic+ hour or an hour on your class and rotation. Work on talents, cooldowns, interrupts and the route that times a key.',
    format:
      'World of Warcraft coaching from Duoly is a booked hour at {amount:learn}, and 2 formats are open in 2026. **Play and Learn** is a live hour of Mythic+ where your coach runs keys with you and explains every pull, kick and defensive as the key happens. **Class and Rotation Coaching** is an hour on your own class and spec: talents, rotation, cooldowns and positioning, checked on a target dummy and then in a real key at {amount:class}. First, decide where the problem sits: 1) a key dying to one pull is a route and defensive problem, while 2) a key timed with low damage is a rotation problem. For example, a Restoration Druid names the spec first. Finally, every lesson runs on your own Battle.net account using Discord voice and screen share.',
    prices:
      'Every World of Warcraft lesson from Duoly costs {amount:learn}, and both formats are sold by the hour, because a key or an arena session has no fixed length. First, an hour of Play and Learn usually covers more than one key, depending on the key level and the route. Second, Class and Rotation Coaching spends part of the hour on a target dummy, where a rotation can be fixed and measured without a timer running. Bundles and quantity discounts do not apply to coaching, so a second hour costs {amount:class} like the first, read from Duoly checkout in November 2026. For example, book the class hour first when your damage is the weak link, agreed using Discord.',
    steps: [
      'First, pick the format for the problem: 1) a live hour of keys, or 2) an hour on your class and rotation.',
      'Second, check out once, upfront: both lessons cost {amount:learn}, sold by the hour, read from Duoly checkout in November 2026.',
      'Finally, meet your coach in the order chat and start the hour using Discord.',
    ],
    booking:
      'A World of Warcraft booking from Duoly is a single checkout for one hourly lesson at {amount:learn}, so pick the format before paying. The order chat is where a lesson gets set up properly: send your region, your realm, your class and spec, and the dungeon going wrong. For example, a line saying the key dies on the second pull of one dungeon saves ten minutes of guessing. Send your BattleTag as well, because a live hour needs a real group invite. Finally, keep your login private, since a coach from Duoly never needs a password and only needs a call using Discord.',
    sections: [
      {
        heading: 'Why does a key die to one pull rather than to damage?',
        paragraphs: [
          'A key usually dies because one pull was taken without the tools to survive the pull. First, count the stops. A pack with 3 casters needs 3 interrupts or a stun, and a group holding only 2 loses a third of the health bar to the third cast. Second, count the defensives, because a personal cooldown spent on a safe pull leaves nothing for the dangerous one. Route knowledge is the cheapest fix, since skipping an unstoppable pack costs nothing at all.',
          'For example, your coach can pause after a wipe and ask 3 questions: 1) which cast landed, 2) whose kick was available and 3) whether anyone had a defensive left. A 3,000 rated coach from Duoly ties every answer to what was on your bars at the time, using Discord screen share. Rated arena gets the same treatment on different terms: swaps, crowd control chains and cooldowns. An hour costs {amount:learn} in 2026, and one habit per hour is the honest target.',
        ],
      },
      {
        heading: 'Example hour: what makes a rotation lose damage?',
        paragraphs: [
          'A rotation loses damage in 3 places: 1) a cooldown held too long, 2) a filler pressed during a proc window and 3) movement spent where standing still was safe. For example, a cooldown saved for a boss dying before the cast is damage nobody ever had. First, measure the opener on a target dummy, where nothing interrupts the sequence. Second, repeat the same opener in a real pull, where the sequence meets movement and interrupts.',
          'A take-home exercise is to run the opener 3 times and write down what changed between the dummy and the pull. Add the moment movement became unavoidable. A Gladiator or 3,000 rated coach from Duoly adapts the exercise to your spec and talent build at {amount:class} per hour in 2026, reviewed using Discord screen share. Finally, keep your own keybinds and addons, so the hour practises what you will press in your next key.',
        ],
      },
    ],
    prepare:
      'Preparation for World of Warcraft coaching is one spec and one honest question about your keys. Name your region and realm first, because EU, US, KR and TW keep separate realms and separate ladders. Send your class, spec and the talent build you actually play, so the hour starts from real bars rather than a guide. Have your BattleTag ready, since a live hour is a real group invite. Bring a keystone and a note of the dungeon going wrong, for example 1) the pull where the key dies and 2) the pull you always skip. The live hour is {amount:learn}, and for the class hour at {amount:class} be ready to stand on a target dummy first. Test voice and screen share using Discord, then hide private chat and notifications. Never send login details to anyone, including a coach from Duoly. Finally, write one line naming the habit you want changed.',
    faq: [
      [
        'Which WoW lesson should I pick?',
        'Two lessons are open in 2026. Play and Learn is the live hour for routes, pulls, interrupts and defensives. Class and Rotation Coaching is the hour for talents and cooldowns.',
      ],
      [
        'How much does WoW coaching cost?',
        'Every World of Warcraft lesson from Duoly costs {amount:learn}, sold by the hour. Bundles and quantity discounts do not apply, so a second hour costs {amount:class} like the first.',
      ],
      [
        'Can we work on rated arena instead of keys?',
        'Yes. Name arena in the order chat, and the hour covers swaps, crowd control chains and cooldown use rather than a dungeon route, agreed using Discord.',
      ],
      [
        'Do I need a keystone for the live hour?',
        'Bring one if you want your own key timed. Otherwise the hour runs on the coach keystone, and the lesson stays the same.',
      ],
      [
        'Is coaching the same as booking a Mythic+ teammate?',
        'No. A teammate hour is shared playing time. Coaching is an hour with a stated learning goal and a review, for example on interrupt order.',
      ],
    ],
  },
  deadlock: {
    title: 'Deadlock Coaching: Macro, Souls and Items | Duoly',
    h1: 'Deadlock coaching for macro, souls and item timings',
    lead: 'Book a Deadlock coach for a live ranked match or an hour on macro and souls. Work on farming patterns, soul economy, item timings and rotations.',
    format:
      'Deadlock coaching from Duoly is a booked lesson at {amount:learn}, and 2 formats are open in 2026. **Play and Learn** is a live ranked match where your coach plays beside you and explains lane decisions, Urn runs and Mid Boss timings as the match happens. **Macro and Souls** is an hour on farming patterns, soul economy, item timings and rotations at {amount:macro}, so every minute of a match counts. First, decide where the problem sits: 1) a player losing lane needs the live match, while 2) a player winning lane and losing at 30 minutes needs the macro hour. For example, a Phantom player farming well and never joining the Urn run books the macro hour. Second, a Deadlock match runs about 35 minutes, so one live match is already a long lesson. Finally, every lesson runs on your own Steam account using Discord voice and screen share.',
    prices:
      'Every Deadlock lesson from Duoly costs {amount:learn}, and the unit is the real difference. Play and Learn is sold per match, which buys one full ranked game beside your coach. Macro and Souls is sold by the hour, which buys the pauses and rewinds a live match cannot. First, pick the unit matching the problem. For example, a player who already knows which 10 minutes go wrong learns more from an hour of Macro and Souls than from another ranked queue. Second, bundles and quantity discounts do not apply to coaching, so a second hour costs {amount:macro} like the first, read from Duoly checkout in November 2026. Finally, the hourly lesson runs using Discord screen share.',
    steps: [
      'First, pick the format for the problem: 1) a live ranked match, or 2) an hour on macro and souls.',
      'Second, check out once, upfront: both lessons cost {amount:learn}, read from Duoly checkout in November 2026. The unit is what differs.',
      'Finally, meet your coach in the order chat and start the lesson using Discord.',
    ],
    booking:
      'A Deadlock booking from Duoly is a single checkout for one lesson at {amount:learn}, so check whether the format is sold per match or by the hour before paying. The order chat is where a lesson gets set up properly: send the broad area you play in, your hero pool and the part of a match going wrong. For example, a line saying you farm well and never join the Urn run saves ten minutes of guessing. Send your Steam name as well, since a live match needs a party invite. Finally, keep your login private, because a coach from Duoly never needs a password and only needs a call using Discord.',
    sections: [
      {
        heading: 'Why do souls decide more matches than fights do?',
        paragraphs: [
          'Souls are the Deadlock currency, won in small amounts all match rather than in one fight. First, understand the orb: shooting a soul orb confirms the souls for your team, and an enemy shooting the same orb denies them. A lane losing half the orbs is a losing lane even while the kill score looks even. Second, items come in 3 categories, Weapon, Vitality and Spirit, so the souls you keep decide which column a build can fill.',
          'For example, your coach can pause the match and ask 3 questions: 1) how many orbs were secured in the last wave, 2) what the enemy build threatens and 3) which column your next item belongs in. An Ascendant coach from Duoly ties every answer to your own screen at {amount:macro} per hour, using Discord screen share. Finally, name one habit you want changed by the end of the lesson, for example checking the shop before walking back to lane in 2026.',
        ],
      },
      {
        heading: 'Example lesson: what makes a Mid Boss attempt bad?',
        paragraphs: [
          'A bad Mid Boss attempt is one started without knowing where the enemy team is. For example, a team walks into the pit with 2 members pushing a far lane and no vision of the approach. First, find the moment the attempt started and walk backwards to the last information anyone had. Second, ask what the team gave up: a wave, a Walker, or farm about to come off a camp.',
          'A take-home exercise is to call 3 Mid Boss attempts in your next matches before the team commits, writing down what was known each time: 1) enemy positions, 2) the Urn state and 3) your own cooldowns. An hour of Macro and Souls from Duoly costs {amount:macro} in 2026, which leaves room to replay the same 2 minutes twice. Finally, an Ascendant coach adapts the exercise to your hero and lane, reviewed using Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for Deadlock coaching is one hero pool and one honest question about the mid game. Name the broad area you play in first, because Deadlock matches on ping across Europe, North America, South America, Asia, Oceania and the Middle East. Send 2 heroes you play and 1 you want to learn, so the lesson covers builds you will actually use. Have your Steam name ready, since a live match needs a party invite. Plan for the length, because a match runs about 35 minutes, a live lesson at {amount:learn} is one full game and the macro hour at {amount:macro} is sold separately. Bring one sentence about where matches turn, for example 1) the first Urn or 2) the first Mid Boss attempt. Test voice and screen share using Discord, then hide private chat and notifications. Never send login details to anyone, including a coach from Duoly. Finally, name the habit you want changed.',
    faq: [
      [
        'Which Deadlock lesson should I pick?',
        'Two lessons are open in 2026. Play and Learn is the live match for lane decisions, Urn runs and Mid Boss calls. Macro and Souls is the hour for farming and item timings.',
      ],
      [
        'How much does Deadlock coaching cost?',
        'Every Deadlock lesson from Duoly costs {amount:learn}. Play and Learn is billed per match, while Macro and Souls is billed by the hour, so a second hour costs {amount:macro}.',
      ],
      [
        'How long is a live Deadlock lesson?',
        'One full ranked match, running about 35 minutes, plus the short review your coach gives afterwards in the order chat.',
      ],
      [
        'Can I focus on one hero?',
        'Yes, and a narrow goal works better. For example, name the hero and the lane matchup going wrong, then share the match using Discord screen share.',
      ],
      [
        'Is coaching the same as booking a Deadlock duo?',
        'No. A duo is shared playing time priced per match. Coaching is one lesson with a stated goal and a habit to take into your next match.',
      ],
    ],
  },
};
