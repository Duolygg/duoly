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
          'A take-home exercise is to label your first 3 recalls in the next game. Use three labels: wave crashed, wave rolling toward you, or wave held away from you. Add the information available before pressing B. A recall at 13:30 is a different decision from a recall at 15:00. Plates make the early reset more expensive, and a Grandmaster+ coach from Duoly adapts the task to your matchup, watching the replay using Discord screen share.',
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
      'Choose **Play and Learn** for live Doubles feedback, or **Mechanics Training** for aerials, flicks and recoveries with training packs to use afterward. Both lessons are hourly and use Discord voice and screen share on your own account. Match count in a live session depends on game length and time spent talking through plays. The right lesson depends on where the play breaks down. For example, missing an aerial despite a clear approach is a mechanics question. Jumping for a ball your teammate already has covered is a rotation question, even if you hit the shot. Bring a close Doubles replay so the coach can see boost management, second-player spacing and the route back to net. Your platform, controller or keyboard setup and usual playlist help the coach choose drills you can actually repeat. Start with a recoverable touch before chasing a harder highlight.',
    sections: [
      {
        heading: 'How should the second player read a Doubles attack?',
        paragraphs: [
          'A useful second-player position is a place where you can pressure the next touch and still cover a dangerous clear. First, watch whether your partner can recover after the challenge. For example, a rebound above the opposing net can look inviting while both defenders are already moving toward the ball. Pause before committing and name the worst likely clear. Compare a few replays with Discord screen share to see whether the same commitment keeps leaving you stranded. Second, keep enough boost for the route back toward your own net. Finally, compare the decision with the information available before the touch, rather than judging only whether the shot scored.',
        ],
      },
      {
        heading: 'How can you practice recovering after a tempting rebound?',
        paragraphs: [
          'A controlled recovery is a landing and route back into the play after an aerial or challenge. First, choose a replay where a missed rebound left the net open. For example, pause as your partner shoots and compare your boost with the distance to the next safe position. Name where a losing challenge would send the ball. Practice a simple aerial, landing on your wheels and steering toward a useful route. Second, ask the coach to connect the drill to the replay instead of adding an unrelated trick. Finally, keep the first version slow enough to control the landing before adding height, speed or a harder angle.',
        ],
      },
    ],
    prepare:
      'Preparation for Rocket League coaching is a replay, two timestamps and one practice question. First, save a close Doubles match showing the approach to a conceded goal. For example, include the touch before a double commit so the coach can compare positioning with execution. Share your platform, input, region and usual playlist. Test voice and screen share using Discord before the lesson. Warm up with familiar camera and sensitivity settings rather than changing everything just before practice. Second, agree on the goal before loading into a drill or queue. Finally, keep account access private and hide personal notifications. Repeat the chosen exercise at a controlled pace, so the coach can see a habit rather than one lucky attempt.',
    faq: [
      [
        'Which lesson should I pick?',
        'Pick Mechanics Training for aerials, flicks and recoveries. Pick Play and Learn for Doubles rotations, boost management and knowing when to challenge. If you are unsure, bring a replay showing how a conceded goal started.',
      ],
      [
        'How much does it cost?',
        'Play and Learn costs {price:learn}, and Mechanics Training costs {price:mech}. Both are hourly. Time spent discussing a play is part of the lesson, so a live session has no fixed match count.',
      ],
      [
        'Should I change my settings first?',
        'Keep your usual camera and sensitivity settings so the coach can see your habits. Share your platform, input and usual playlist. Bring a close Doubles replay with the touches before a double commit or missed recovery.',
      ],
      [
        'Will I have something to practice afterward?',
        'Mechanics Training includes training packs for aerials, flicks and recoveries. Ask the coach to connect a drill to your replay, such as landing ready to rotate after a missed aerial.',
      ],
    ],
  },
  fortnite: {
    title: 'Fortnite Coaching for Builds, Edits and Decisions | Duoly',
    h1: 'Fortnite coaching for your next practice goal',
    lead: 'Choose a Fortnite coach for live learning or Creative build and edit practice. Set the mode and input first so the lesson fits the fights you play.',
    format:
      'Choose **Play and Learn** for live Ranked learning, or **Build and Edit Course** for Creative practice on piece control, edits and box fights. Both services are hourly, with Discord voice and screen share while you play on your own account. Tell the coach whether you play Builds or Zero Build and whether you use controller or keyboard. A useful lesson starts with a fight you recognize. For example, a fast edit can still expose your whole character if you open the wall from the wrong position. Creative gives you room to slow the peek down and practice the shot and reset together. In Zero Build, the live lesson can focus on cover, zone rotations and deciding which fights are worth taking. Keep your usual sensitivity and binds for the session so the coach sees your real habits, including what happens when a fight gets messy.',
    sections: [
      {
        heading: 'How do you make an edit safer before adding speed?',
        paragraphs: [
          'A safer edit is an opening which gives a shot while limiting the angle available to the opponent. First, check piece ownership and your position before opening the wall. For example, standing too close to the middle can expose your character even when the edit is fast. Choose one protected peek and explain the escape route. Keep the same input and sensitivity while the coach watches your setup with Discord screen share. Second, reset after the shot and return to cover before starting another attempt. Finally, ask the coach to judge the setup and recovery alongside the edit. For Zero Build, choose the live service and focus on cover, rotations and fight selection instead.',
        ],
      },
      {
        heading: 'How can you practice an edit, shot and reset together?',
        paragraphs: [
          'An edit and reset drill is a controlled sequence of opening a shot, firing and returning behind cover. First, start inside a box with a wall you own. For example, choose an opening which keeps most of your character protected from a target directly ahead. Check your position before touching the edit. Repeat the sequence until the reset feels controlled, then change the target angle and decide whether the opening still works. Second, ask the coach to match the drill to your controller or keyboard. Finally, count controlled returns to cover before trying to go faster. A short clip of an actual lost fight helps connect the practice to a decision you recognize.',
        ],
      },
    ],
    prepare:
      'Preparation for Fortnite coaching is a clear mode, your input and one clip showing a repeatable problem. First, share your region, platform and experience before the lesson. For example, bring the seconds before a lost box fight, including the setup and the recovery. Name whether the goal belongs in Creative or live Ranked. Test voice and screen share using Discord and hide private notifications. Second, keep familiar settings so the coach sees your usual execution. Finally, load the relevant mode and keep your account under your control. Practice a simple edit and reset before increasing speed, or describe the cover decision you want to test in live play.',
    faq: [
      [
        'Which lesson should I pick?',
        'Choose Build and Edit Course for box fights, piece control and edits in Creative. Choose Play and Learn for Ranked decisions, including zone rotations and fight selection. Zero Build players should choose the live service.',
      ],
      [
        'How much does it cost?',
        'Play and Learn costs {price:learn}, and Build and Edit Course costs {price:build}. Both services are hourly. Choose the mode and input you actually play before booking.',
      ],
      [
        'Can I take a lesson on controller?',
        'Share your controller or keyboard setup before the session so the coach can match the drills to your input. Keep your usual binds and sensitivity. A clip of a lost box fight helps show whether the problem starts with positioning or the edit.',
      ],
      [
        'What if I only play Zero Build?',
        'Choose Play and Learn and say you play Zero Build. Bring a question about cover, zone rotations or when to leave a fight. The Creative build and edit lesson is aimed at Builds mechanics.',
      ],
    ],
  },
  'teamfight-tactics': {
    title: 'TFT Coaching and Teamfight Tactics Econ Review | Duoly',
    h1: 'TFT coaching for economy and decisions',
    lead: 'Book TFT coaching to review when you level, roll and commit to a board. Build a decision process that adapts when the shop does not cooperate.',
    format:
      '**Comp and Econ Review** is an hourly Teamfight Tactics lesson on compositions, economy and spending decisions, using Discord voice and screen share. Bring a full recording with the shop, bench, items and augment choices visible. A final-board screenshot misses the decisions that used up your gold or health. For example, a reroll comp can look unfinished because you rolled too early, held the wrong pairs or stayed committed after the lobby contested your units. The coach can follow those choices and discuss when a comp pivot was still affordable. Note the set and patch, since unit costs, traits and viable boards change. The separate Board Coach service on the game hub provides live help per game. Choose the review when you want time to pause, compare lines and understand why your econ plan stopped matching the strength of your board.',
    sections: [
      {
        heading: 'How should you connect gold to board strength?',
        paragraphs: [
          'Economy management is a choice between future buying power and the health cost of keeping a weak board. First, check health, pairs, item holders and the strength of upcoming opponents. For example, saving for interest can be expensive when a small upgrade would avoid repeated heavy losses. Pause before spending and name the upgrades available at the current level. Compare spending decisions across a full recording with Discord screen share. Second, note a possible temporary board when items and shops disagree with your opening plan. Finally, bring the set and patch with the recording, since unit names and viable transitions change. A final placement alone cannot explain whether the earlier risk was reasonable.',
        ],
      },
      {
        heading: 'How do you review a decision to roll or level?',
        paragraphs: [
          'A roll or level review is a comparison of immediate upgrades, available gold and the health risk of waiting. First, pause at a stage transition before spending. For example, a weak front line with several pairs may offer a different choice from a stable board needing one extra unit. Write gold, health, level and the reason for the choice. Use a full match recording with Discord screen share so the coach can follow the board between shops. Second, compare likely upgrades with the next opponents and unassigned items. Finally, judge the plan using information available before the shop refreshed. Include good and bad outcomes, so a lucky shop does not become the entire explanation for a spending habit.',
        ],
      },
    ],
    prepare:
      'Preparation for Teamfight Tactics coaching is a full recording with the shop, bench, items and augment choices visible. First, note the current set and patch before sending a replay. For example, a final-board screenshot cannot show whether a roll decision made sense before the upgrades appeared. Choose two spending moments and write the reason for each choice. Second, hide private notifications and keep your account under your own control. Finally, make a short review sheet for gold, health and level. Use the sheet at each major spending decision, so the lesson can compare a repeatable decision process with the actual shops and outcomes rather than relying on the final placement.',
    faq: [
      [
        'Which lesson should I pick?',
        'Comp and Econ Review follows your composition, gold and spending choices in a full game. Choose it for time to pause and compare lines. Board Coach on the game hub is separate live help sold per game.',
      ],
      [
        'How much does it cost?',
        'Comp and Econ Review costs {price:econ}. You are booking an hour of review. Board Coach has a separate per-game price on the game hub.',
      ],
      [
        'Is a screenshot of my final board enough?',
        'A full recording is much more useful. Show the shop, bench, items and augment choices, and note the set and patch. Mark a roll-down or comp pivot that felt unclear so the coach can see the options before you spent your gold.',
      ],
      [
        'Can I review a game where I got unlucky?',
        'Yes. Include the shops before and after the decision. The review can compare econ, health and available upgrades without treating the final placement as proof that every earlier choice was wrong.',
      ],
    ],
  },
  'apex-legends': {
    title: 'Apex Legends Coaching and Movement Practice | Duoly',
    h1: 'Apex Legends coaching for movement and rotations',
    lead: 'Choose Apex coaching for live Ranked learning or focused movement practice. Work on reaching the next position with enough options to take the fight.',
    format:
      'Choose **Play and Learn** for live Ranked learning, or **Movement Course** for focused practice in the Firing Range. Both services are hourly and use Discord voice and screen share on your own account. For live play, match count depends on game length and discussion time. Tell the coach your input, platform and preferred legends before choosing movement drills. A technique from a keyboard clip may not suit your controller setup. The bigger question is where the movement takes you. For example, a clean slide into an open crossing still leaves your squad exposed if another team holds the angle. Live coaching can connect rotations, legend roles and the risk of third parties to the fights you take. Firing Range practice gives you space to work on reaching cover with your aim under control. Bring a clip with the approach to a fight, including the route your squad took.',
    sections: [
      {
        heading: 'How should movement connect to cover in Apex Legends?',
        paragraphs: [
          'Useful movement is a route toward cover or a fighting angle with options for the next action. First, ask where a technique leaves your character after landing. For example, a quick slide into an exposed lane may create a harder fight than a slower protected route. Name the next cover and one fallback before leaving safety. Rehearse the route using Discord screen share to review aim and control. Second, match the technique to your input, platform and legend rather than copying an unrelated clip. Finally, consider whether teammates can follow the route and whether another squad already holds the angle. A useful lesson connects execution to ring information, spacing and the choice to take or leave a fight.',
        ],
      },
      {
        heading: 'How do you review a rotation after losing the angle?',
        paragraphs: [
          'A late rotation is a move begun after another squad has gained control of the intended route or position. First, pause before your squad leaves cover. For example, a direct path into the safe area can be risky when opponents already watch the only crossing. Compare cover, alternate routes and information from legend abilities. Review the approach using Discord screen share and name an earlier signal to move. Second, choose the next protected position and a fallback if the position is occupied. Finally, test a simple movement toward cover while keeping aim controlled. Your coach can adapt the drill to your input and platform before adding speed or a more demanding technique.',
        ],
      },
    ],
    prepare:
      'Preparation for Apex Legends coaching is your region, platform, input and one clear lesson goal. First, name your preferred legends and explain a fight or rotation you want to understand. For example, a clip showing the approach to a crossing gives more context than the final elimination. Choose live Ranked learning or focused Firing Range practice. Play and Learn from Duoly costs {price:learn}. Test voice and screen share using Discord, hide private notifications and keep login details private. Second, confirm queue eligibility for live Ranked or have the Firing Range ready. Finally, rehearse a simple move toward cover before adding harder variations. Ask the coach to compare control, aim and the landing position, so practice connects to a situation you recognize in matches.',
    faq: [
      [
        'Which lesson should I pick?',
        'Choose Movement Course to practice control and movement in the Firing Range. Choose Play and Learn for Ranked rotations, legend roles and recognizing third-party risk. Share your input and platform before agreeing on techniques.',
      ],
      [
        'How much does it cost?',
        'Play and Learn costs {price:learn}, and Movement Course costs {price:move}. Both are hourly. A live lesson has no fixed match count because match length and review time vary.',
      ],
      [
        'What kind of clip should I bring?',
        'Include the route into the fight, ring information and your squad positions. A clip starting at the knock misses the rotation or overextension that invited a third party. Name your legend and explain the call you were trying to make.',
      ],
      [
        'Does the coach fill our whole trio?',
        'No. Your coach joins you; the booking does not fill every seat. Confirm Ranked queue eligibility and agree who covers which legend role before starting.',
      ],
    ],
  },
  'marvel-rivals': {
    title: 'Marvel Rivals Coaching and Hero Practice | Duoly',
    h1: 'Marvel Rivals coaching for your hero and role',
    lead: 'Book Marvel Rivals coaching for live learning or a focused hero lesson. Learn when to use your abilities and when your team is ready to follow.',
    format:
      'Choose **Play and Learn** for a Competitive match with a Grandmaster+ coach who talks through decisions and gives a quick review afterward. **Hero Coaching** is an hour with a Grandmaster+ coach on one hero, covering abilities, ultimate timing, positioning and matchups. Lessons use Discord voice and screen share while you stay on your own account. Vanguard, Duelist and Strategist players can all bring a specific fight to work through. For example, a Strategist might spend a defensive cooldown just before a dive, while a Vanguard might engage before the team can follow. Hero Coaching gives you room to ask why the fight broke down and practice a better response. Bring the current patch and your hero pool so Team-Ups and ult economy stay relevant to the lineup you actually play. A powerful combo still needs teammates in position to use the opening.',
    sections: [
      {
        heading: 'How does your role change a Marvel Rivals team fight?',
        paragraphs: [
          'A team fight in Marvel Rivals is a chain of role decisions, and each role carries a different risk. First, a Vanguard can create space the rest of the team cannot use yet. A Duelist may take an angle without an escape route. A Strategist may spend key resources just before an opponent commits. In a review, check who could see the target and which cooldowns were ready before the engage.',
          'Hero Coaching stays grounded in the hero you play. A dive hero needs a plan for entering and leaving. A backline hero needs safe sightlines and awareness of flanks. For example, bring the current patch, so the lesson uses combinations available now.',
        ],
      },
      {
        heading:
          'Example team fight: why can an ultimate fail without follow-up?',
        paragraphs: [
          'An ultimate without follow-up is an ultimate used before teammates can act on the opening. For example, you use an ultimate to open a fight while two teammates are still returning from spawn. The animation looks strong and still leaves the team unable to take space. Pause before the activation. Count who can act, which enemy defensive abilities are known and whether the objective demands an immediate contest.',
          'A small practice task is to review five ultimate uses from your next matches. First, write the intended purpose before judging the outcome: engage, response, survival or objective contest. Second, check whether the teammates needed for the plan were present. Finally, ask your Grandmaster+ coach for a hero-specific cue to spot the same situation sooner, reviewing clips with Discord screen share.',
        ],
      },
    ],
    prepare:
      'Preparation for Marvel Rivals coaching is about context: hero, role, patch and one problem. Bring your platform, region, hero pool and the current patch. A recording should include the lead-up to fights, teammate positions and the objective. Pick two timestamps where you did not know whether to engage or reset. For Hero Coaching, choose one hero and one matchup you struggle with. For Play and Learn, confirm your ranks can queue together in Competitive. Test voice using Discord before the session starts. Hide personal notifications during screen sharing. Keep your own account under your control, and never share login details. Finally, tell the coach your main role, so the lesson starts with the right hero questions. A short written goal, for example one hero matchup, saves time at the start.',
    faq: [
      [
        'Which lesson should I pick?',
        'Choose Hero Coaching to focus on one hero, including matchups, Team-Ups and ultimate timing. Choose Play and Learn for feedback during a Competitive match. Bring the role you actually play: Vanguard, Duelist or Strategist.',
      ],
      [
        'How much does it cost?',
        'Play and Learn costs {price:learn}, and Hero Coaching costs {price:hero}. Play and Learn covers a Competitive match; Hero Coaching gives you an hour on one hero.',
      ],
      [
        'What should I bring to Hero Coaching?',
        'Name your hero, role and current patch. Bring a recording with the lead-up to a fight, including teammate positions. Mark an ultimate you were unsure about or a Team-Up that never found an opening.',
      ],
      [
        'Can I work on team fights as a Strategist?',
        'Yes. A useful focus is when to hold a defensive ability, move your healing sightline or save an ultimate for the next engage. Include the whole fight so the coach can see what your Vanguard and Duelists could follow.',
      ],
    ],
  },
};
