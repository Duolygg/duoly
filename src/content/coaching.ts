// Coaching page copy. **Bold** marks service names (rendered by src/components/seo/rich.ts).
export interface Lesson {
  title: string;
  h1: string;
  lead: string;
  format: string;
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
      'Valorant coaching on Duoly is a paid lesson with an Immortal+ coach, held using Discord with voice and screen share. Three services are available. First, **Play and Learn** is one live Competitive game together, at {price:learn}. Second, **VOD Review** is a 1-hour lesson on a recent match, going round by round through positioning, utility and decisions, at {price:vod}. Third, **Aim and Crosshair** is a 1-hour lesson on crosshair placement, peeking and counter-strafing, at {price:aim}. Each Aim and Crosshair lesson ends with a training routine made for you. For example, a player who loses most first duels can book Aim and Crosshair for the mechanics, then VOD Review to see where each duel starts. Pick VOD Review to pause rounds and ask questions. Pick Play and Learn to hear feedback while decisions happen. Prices checked on 8 November 2026. Finally, every lesson runs on your own Riot account. Coaching from Duoly has a 0% quantity discount.',
    sections: [
      {
        heading: 'Why does a missed shot often start before the peek?',
        paragraphs: [
          'A missed shot is often the last step of a bad route into a fight. First, on attack, a duelist needs a teammate close enough to trade. An initiator needs utility timed to the entry, and a controller needs smokes on the right sightlines. For step 1 of a Valorant review, check the route into the fight before discussing sensitivity. Sentinels can focus on flank information and the timing of a late rotation instead.',
          'For a single-agent lesson, bring an agent you actually play. For example, a Sova player can check whether a drone cleared the angle the entry player needed. An Omen player can compare a smoke placed too early with a smoke landing as teammates take space. Your coach from Duoly ties every point to your own recording or live game. Bring the recording to VOD Review at {price:vod}, or play live in Play and Learn at {price:learn}. Repeat the review 3 times before changing the practice goal.',
        ],
      },
      {
        heading: 'Example round: what makes an entry untradeable?',
        paragraphs: [
          'An untradeable entry is a peek with no teammate ready to answer the kill. For example, your entry player turns a corner while the second player is still behind a smoke. Pause the VOD right before the peek. What information is available? Which angle can the second player see? Is utility about to expire? Moving together or waiting for a flash may help more than a harder shot. Step 1 is to pause before the decision.',
          'For practice, mark five first contacts in your next recording. First, note whether a teammate could trade. Second, check whether your crosshair sat at head height before the opponent appeared. Finally, compare each moment with the round result instead of the scoreboard. Your Immortal+ coach from Duoly adapts the exercise to your role, agent and comfort level, reviewing clips with Discord screen share. For the mechanics side, Aim and Crosshair costs {price:aim}. Repeat the review 3 times before changing the practice goal.',
        ],
      },
    ],
    prepare:
      'Preparation for Valorant coaching is a short checklist before the lesson starts. Step 1: for VOD Review, bring a recent full match recording with your HUD and audio. Add two timestamps where you felt unsure, for example a peek and a rotation. A close game is often more useful than a highlight reel. For Aim and Crosshair, keep your usual sensitivity and settings, so the coach sees your real habits. For Play and Learn, confirm your ranks can queue together in Competitive. Test voice and screen share using Discord before the session. Hide private notifications and tell the coach your region and platform. Never send login details to anyone, including your coach. Finally, every Valorant lesson runs on your own Riot account, and your coach joins with Discord. Play and Learn from Duoly costs {price:learn} and covers one Competitive game. VOD Review and Aim and Crosshair each cost {price:vod}. Review the chosen cue 3 times before adding another goal.',
    faq: [
      [
        'Which Valorant lesson should I choose?',
        'VOD Review is a paused analysis of your recent Valorant match. Aim and Crosshair builds a mechanics routine. Play and Learn gives feedback during one Competitive game. Choose the service around one repeatable problem before adding more goals.',
      ],
      [
        'What are the standard Valorant coaching prices?',
        'Play and Learn costs {price:learn}; VOD Review and Aim and Crosshair each cost {price:vod}. Coaching from Duoly has a 0% quantity discount. Prices checked on 8 November 2026.',
      ],
      [
        'What should I share before the lesson?',
        'Step 1 is to share your platform, region and one goal, for example a confusing decision. Then, test voice and screen share using Discord. Finally, keep account access private and hide personal notifications before showing a recording.',
      ],
      [
        'Will a lesson guarantee better results?',
        'Coaching provides a practice plan, and match results remain uncertain. For practice, repeat the agreed exercise 3 times before changing the goal. Beginners can choose a familiar setup or a basic decision to keep the lesson focused.',
      ],
    ],
  },
  'league-of-legends': {
    title: 'League of Legends Coaching and VOD Review | Duoly',
    h1: 'League of Legends coaching for your next practice goal',
    lead: 'Choose LoL coaching for lane decisions, champion mastery or a review of your own match. Build a practice goal you can recognize in your next game.',
    format:
      'League of Legends coaching on Duoly is a paid lesson using Discord, with voice and screen share. Three services are available. First, **Play and Learn** is one live ranked game with a Master+ coach, at {price:learn}. Second, **VOD Review** is a 1-hour lesson with a Grandmaster+ coach on a recent game, covering laning, waves and map moves, at {price:vod}. VOD Review ends with three things to fix. Third, **Champion Mastery** is a 1-hour lesson with a Grandmaster+ coach on one champion, at {price:champ}. Champion Mastery covers matchups, combos, builds and power spikes, practiced in a live game. Coaching can focus on top, jungle, mid, bot or support. For example, a jungler can bring a game with a late objective setup, while a mid laner can bring a costly recall. Prices checked on 8 November 2026. Finally, tell the coach your role and champion pool when you book. Coaching from Duoly has a 0% quantity discount.',
    sections: [
      {
        heading: 'Why does wave state decide a lane trade?',
        paragraphs: [
          'Wave state is the position and size of the minion waves in a lane, and wave state sets the price of a trade. First, with a large enemy wave approaching, a long trade can cost health, experience and a safe recall. With your own wave about to crash, staying for another plate can cost a clean reset. A League of Legends coach compares what you knew about the enemy jungler with the risk you took. Step 1 is to pause before the decision.',
          'Jungle and support lessons need different evidence. A jungler can track camp sequencing and lane priority. A support can examine waves and vision routes using Discord screen share. For example, a bot lane review can focus on spacing with your support and the timing of a shared recall. Bring the replay to VOD Review from Duoly at {price:vod}, or ask about one champion in Champion Mastery at {price:champ}. Repeat the review 3 times before changing the practice goal.',
        ],
      },
      {
        heading: 'Example lane review: what makes a recall expensive?',
        paragraphs: [
          'An expensive recall is a reset that gives away minions, experience or tower plates. For example, a mid laner recalls while the wave stops just outside the opposing tower. The opponent can hold the wave, and the returning player walks forward for experience. First, ask whether the wave could have been fully crashed. Second, ask whether the enemy jungler was visible. Finally, compare the item purchase with the minions likely to be lost. Step 1 is to pause before the decision.',
          'A practical take-home exercise is to label your first three recalls in your next game. Use three labels: wave crashed, wave moving toward you, or wave held away from you. Add the information you had before recalling. Your Grandmaster+ coach from Duoly adjusts the task for your matchup during VOD Review with Discord screen share, priced at {price:vod}. To practice the cue live, Play and Learn costs {price:learn}. Repeat the review 3 times before changing the practice goal.',
        ],
      },
    ],
    prepare:
      'Preparation for League of Legends coaching is a replay, a role and a question. Step 1: for VOD Review, bring a recent full match replay or recording, the patch and your role. Include a loss where you still had decisions to make. Add two questions, for example one about laning and one about map movement. For Champion Mastery, pick one champion and list the matchups you find confusing. For Play and Learn, check your server and confirm your ranks can queue together. Test voice and screen share using Discord before the session starts. Keep private chat and notifications out of shared recordings. Use your own Riot account, and never share login details. Finally, tell the coach your champion pool, so the lesson starts in the right place. Play and Learn from Duoly costs {price:learn} and covers one ranked game. VOD Review and Champion Mastery each cost {price:vod}. Review the chosen cue 3 times before adding another goal.',
    faq: [
      [
        'Which League of Legends lesson should I choose?',
        'Champion Mastery is a focused League of Legends lesson on one champion and matchups. VOD Review follows decisions in a recent game. Play and Learn gives live feedback during one ranked game. Choose the service around your next practice goal.',
      ],
      [
        'What are the standard League of Legends coaching prices?',
        'Play and Learn costs {price:learn}; VOD Review and Champion Mastery each cost {price:vod}. Coaching from Duoly has a 0% quantity discount. Prices checked on 8 November 2026.',
      ],
      [
        'What should I share before the lesson?',
        'Step 1 is to share your platform, region and one goal, for example a confusing decision. Then, test voice and screen share using Discord. Finally, keep account access private and hide personal notifications before showing a recording.',
      ],
      [
        'Will a lesson guarantee better results?',
        'Coaching provides a practice plan, and match results remain uncertain. For practice, repeat the agreed exercise 3 times before changing the goal. Beginners can choose a familiar setup or a basic decision to keep the lesson focused.',
      ],
    ],
  },
  'rocket-league': {
    title: 'Rocket League Coaching and Mechanics Training | Duoly',
    h1: 'Rocket League coaching for decisions and mechanics',
    lead: 'Book Rocket League coaching for live Doubles or a mechanics lesson. Turn a replay problem into a drill you can repeat in free play.',
    format:
      'Rocket League coaching is a paid lesson with Discord voice and screen share, using your own account. Play and Learn costs {price:learn} for live Doubles. Mechanics Training costs {price:mech} for aerials, flicks and recoveries, with training packs to repeat afterward. First, choose the format around the problem you actually see in matches. For example, missed recoveries fit a mechanics lesson, while repeated double commits fit live Doubles. Step 1 is to tell the coach your platform, input, region and usual playlist before starting. Both services are hourly, so the number of matches depends on match length and discussion time. Coaching from Duoly has a 0% quantity discount; extra hours keep the same standard rate. Prices checked on 8 November 2026. Finally, agree on one practice cue and a controlled drill before adding harder variations.',
    sections: [
      {
        heading: 'How should the second player read a Doubles attack?',
        paragraphs: [
          'A useful second-player position is a place where you can pressure the next touch and still cover a dangerous clear. First, watch whether your partner can recover after the challenge. For example, a rebound above the opposing net can look inviting while both defenders are already moving toward the ball. Step 1 is to pause before committing and name the worst likely clear. Repeat the review 3 times with different replays, using Discord screen share to explain each choice. A coach from Duoly can check the spacing in Play and Learn at {price:learn}. Mechanics Training costs {price:mech} for aerials and recoveries when execution is the problem. Second, keep enough boost for the route back toward your own net. Finally, compare the decision with the information available before the touch, rather than judging only whether the shot scored.',
        ],
      },
      {
        heading: 'How can you practice recovering after a tempting rebound?',
        paragraphs: [
          'A controlled recovery is a landing and route back into the play after an aerial or challenge. First, choose a replay where a missed rebound left the net open. For example, pause as your partner shoots and compare your boost with the distance to the next safe position. Step 1 is to name where a losing challenge would send the ball. Practice a simple aerial 3 times, landing on your wheels and steering toward a useful route. Mechanics Training from Duoly costs {price:mech} and includes training packs for focused practice with Discord. Play and Learn costs {price:learn} for live Doubles decisions. Second, ask the coach to connect the drill to the replay instead of adding an unrelated trick. Finally, keep the first version slow enough to control the landing before adding height, speed or a harder angle.',
        ],
      },
    ],
    prepare:
      'Preparation for Rocket League coaching is a replay, two timestamps and one practice question. First, save a close Doubles match showing the approach to a conceded goal. For example, include the touch before a double commit so the coach can compare positioning with execution. Step 1 is to share your platform, input, region and usual playlist. Test voice and screen share using Discord before the lesson. Warm up with familiar camera and sensitivity settings rather than changing everything just before practice. Mechanics Training from Duoly costs {price:mech} and includes training packs. Play and Learn costs {price:learn} for live Doubles. Second, agree on the goal before loading into a drill or queue. Finally, keep account access private and hide personal notifications. Repeat the chosen exercise 3 times at a controlled pace, so the coach can see a habit rather than one lucky attempt.',
    faq: [
      [
        'Which Rocket League lesson should I choose?',
        'Mechanics Training is a Rocket League lesson on aerials, flicks and recoveries, with training packs for practice. Play and Learn is live Doubles learning. Both services are hourly, so match count depends on game length and time spent reviewing decisions.',
      ],
      [
        'What are the standard Rocket League coaching prices?',
        'Play and Learn costs {price:learn}, and Mechanics Training costs {price:mech}. Coaching from Duoly has a 0% quantity discount. Prices checked on 8 November 2026.',
      ],
      [
        'What should I share before the lesson?',
        'Step 1 is to share your platform, region and one goal, for example a confusing decision. Then, test voice and screen share using Discord. Finally, keep account access private and hide personal notifications before showing a recording.',
      ],
      [
        'Will a lesson guarantee better results?',
        'Coaching provides a practice plan, and match results remain uncertain. For practice, repeat the agreed exercise 3 times before changing the goal. Beginners can choose a familiar setup or a basic decision to keep the lesson focused.',
      ],
    ],
  },
  fortnite: {
    title: 'Fortnite Coaching for Builds, Edits and Decisions | Duoly',
    h1: 'Fortnite coaching for your next practice goal',
    lead: 'Choose a Fortnite coach for live learning or Creative build and edit practice. Set the mode and input first so the lesson fits the fights you play.',
    format:
      'Fortnite coaching is a paid hourly lesson with Discord voice and screen share on your own account. Play and Learn costs {price:learn} for live Ranked learning. Build and Edit Course costs {price:build} for piece control, edits and box fights in Creative. First, name your mode and input before choosing the lesson. For example, a Zero Build player can book Play and Learn to review cover, rotations and fight selection. A build player can use Creative to slow down an unsafe edit and practice the reset. Step 1 is to share one clip or describe one repeatable problem. Coaching from Duoly has a 0% quantity discount; extra hours keep the same standard rate. Prices checked on 8 November 2026. Finally, agree on a narrow focus with the coach, so feedback fits your controller or keyboard and your current experience.',
    sections: [
      {
        heading: 'How do you make an edit safer before adding speed?',
        paragraphs: [
          'A safer edit is an opening which gives a shot while limiting the angle available to the opponent. First, check piece ownership and your position before opening the wall. For example, standing too close to the middle can expose your character even when the edit is fast. Step 1 is to choose one protected peek and explain the escape route. Repeat the setup 3 times using Discord screen share, keeping the same input and sensitivity. Build and Edit Course from Duoly costs {price:build} for Creative practice. Play and Learn costs {price:learn} for applying decisions in live Ranked games. Second, reset after the shot and return to cover before starting another attempt. Finally, ask the coach to judge the setup and recovery alongside the edit. For Zero Build, choose the live service and focus on cover, rotations and fight selection instead.',
        ],
      },
      {
        heading: 'How can you practice an edit, shot and reset together?',
        paragraphs: [
          'An edit and reset drill is a controlled sequence of opening a shot, firing and returning behind cover. First, start inside a box with a wall you own. For example, choose an opening which keeps most of your character protected from a target directly ahead. Step 1 is to check your position before touching the edit. Repeat the sequence 3 times, then change the target angle and decide whether the opening still works. Build and Edit Course from Duoly costs {price:build} for the hourly Creative lesson with Discord screen share. Play and Learn costs {price:learn} for live Ranked learning. Second, ask the coach to match the drill to your controller or keyboard. Finally, count controlled returns to cover before trying to go faster. A short clip of an actual lost fight helps connect the practice to a decision you recognize.',
        ],
      },
    ],
    prepare:
      'Preparation for Fortnite coaching is a clear mode, your input and one clip showing a repeatable problem. First, share your region, platform and experience before the lesson. For example, bring the seconds before a lost box fight, including the setup and the recovery. Step 1 is to name whether the goal belongs in Creative or live Ranked. Build and Edit Course from Duoly costs {price:build} for edits, piece control and box fights. Play and Learn costs {price:learn} for live learning, including Zero Build goals. Test voice and screen share using Discord and hide private notifications. Second, keep familiar settings so the coach sees your usual execution. Finally, load the relevant mode and keep your account under your control. Practice a simple edit and reset 3 times before increasing speed, or describe the cover decision you want to test in live play.',
    faq: [
      [
        'Which Fortnite lesson should I choose?',
        'Build and Edit Course is a Fortnite lesson on edits, piece control and box fights in Creative. Play and Learn is live Ranked learning. For Zero Build, choose the live service and name cover, rotations or fight selection as the goal.',
      ],
      [
        'What are the standard Fortnite coaching prices?',
        'Play and Learn costs {price:learn}, and Build and Edit Course costs {price:build}. Coaching from Duoly has a 0% quantity discount. Prices checked on 8 November 2026.',
      ],
      [
        'What should I share before the lesson?',
        'Step 1 is to share your platform, region and one goal, for example a confusing decision. Then, test voice and screen share using Discord. Finally, keep account access private and hide personal notifications before showing a recording.',
      ],
      [
        'Will a lesson guarantee better results?',
        'Coaching provides a practice plan, and match results remain uncertain. For practice, repeat the agreed exercise 3 times before changing the goal. Beginners can choose a familiar setup or a basic decision to keep the lesson focused.',
      ],
    ],
  },
  'teamfight-tactics': {
    title: 'TFT Coaching and Teamfight Tactics Econ Review | Duoly',
    h1: 'TFT coaching for economy and decisions',
    lead: 'Book TFT coaching to review when you level, roll and commit to a board. Build a decision process that adapts when the shop does not cooperate.',
    format:
      'Teamfight Tactics coaching is a paid hourly lesson on composition, economy and spending decisions with Discord voice and screen share. Comp and Econ Review costs {price:econ} from Duoly. First, bring a full recording showing the shop, bench, items and augment choices. For example, a final board can show missing upgrades without showing why gold was spent earlier. Step 1 is to pick two moments when rolling or leveling felt unclear. The coach can compare board strength, health and available upgrades before discussing the outcome. Coaching has a 0% quantity discount; extra hours keep the same standard rate. Price checked on 8 November 2026. Finally, choose a practice question for the next game and note the current set and patch. The separate Board Coach service on the game hub is live help priced per game, with its own checkout total.',
    sections: [
      {
        heading: 'How should you connect gold to board strength?',
        paragraphs: [
          'Economy management is a choice between future buying power and the health cost of keeping a weak board. First, check health, pairs, item holders and the strength of upcoming opponents. For example, saving for interest can be expensive when a small upgrade would avoid repeated heavy losses. Step 1 is to pause before spending and name the upgrades available at the current level. Compare the choice 3 times across a full recording using Discord screen share. Comp and Econ Review from Duoly costs {price:econ} for one hour. The coaching quantity discount is 0%, so buying more hours keeps the standard rate. Second, note a possible temporary board when items and shops disagree with your opening plan. Finally, bring the set and patch with the recording, since unit names and viable transitions change. A final placement alone cannot explain whether the earlier risk was reasonable.',
        ],
      },
      {
        heading: 'How do you review a decision to roll or level?',
        paragraphs: [
          'A roll or level review is a comparison of immediate upgrades, available gold and the health risk of waiting. First, pause at a stage transition before spending. For example, a weak front line with several pairs may offer a different choice from a stable board needing one extra unit. Step 1 is to write gold, health, level and the reason for the choice. Repeat the review 3 times in a full match recording using Discord screen share. Comp and Econ Review from Duoly costs {price:econ} for an hourly lesson. Coaching has a 0% quantity discount, so additional hours keep the same rate. Second, compare likely upgrades with the next opponents and unassigned items. Finally, judge the plan using information available before the shop refreshed. Include good and bad outcomes, so a lucky shop does not become the entire explanation for a spending habit.',
        ],
      },
    ],
    prepare:
      'Preparation for Teamfight Tactics coaching is a full recording with the shop, bench, items and augment choices visible. First, note the current set and patch before sending a replay. For example, a final-board screenshot cannot show whether a roll decision made sense before the upgrades appeared. Step 1 is to choose two spending moments and write the reason for each choice. Comp and Econ Review from Duoly costs {price:econ} for an hourly lesson using Discord voice and screen share. Coaching has a 0% quantity discount; additional hours keep the standard rate. Second, hide private notifications and keep your account under your own control. Finally, make a short review sheet for gold, health and level. Use the sheet 3 times across the recording, so the lesson can compare a repeatable decision process with the actual shops and outcomes rather than relying on the final placement.',
    faq: [
      [
        'Which Teamfight Tactics lesson should I choose?',
        'Comp and Econ Review is a Teamfight Tactics lesson on compositions, gold and spending decisions. The hourly format follows key choices from a full game. Board Coach on the game hub is separate live help, sold per game rather than per hour.',
      ],
      [
        'What are the standard Teamfight Tactics coaching prices?',
        'Comp and Econ Review costs {price:econ}. The listed rate covers one hour of focused review. Coaching from Duoly has a 0% quantity discount. Prices checked on 8 November 2026.',
      ],
      [
        'What should I share before the lesson?',
        'Step 1 is to share your platform, region and one goal, for example a confusing decision. Then, test voice and screen share using Discord. Finally, keep account access private and hide personal notifications before showing a recording.',
      ],
      [
        'Will a lesson guarantee better results?',
        'Coaching provides a practice plan, and match results remain uncertain. For practice, repeat the agreed exercise 3 times before changing the goal. Beginners can choose a familiar setup or a basic decision to keep the lesson focused.',
      ],
    ],
  },
  'apex-legends': {
    title: 'Apex Legends Coaching and Movement Practice | Duoly',
    h1: 'Apex Legends coaching for movement and rotations',
    lead: 'Choose Apex coaching for live Ranked learning or focused movement practice. Work on reaching the next position with enough options to take the fight.',
    format:
      'Apex Legends coaching is a paid hourly lesson with Discord voice and screen share on your own account. Play and Learn costs {price:learn} for live Ranked learning. Movement Course costs {price:move} for practice in the Firing Range. First, tell the coach your input, platform and preferred legends. For example, a controller player should agree on movement drills suited to the actual setup before practicing a technique from a keyboard clip. Step 1 is to name one problem, such as reaching cover after a challenge or choosing an earlier rotation. Coaching from Duoly has a 0% quantity discount; extra hours keep the same standard rate. Prices checked on 8 November 2026. Finally, confirm your region and queue eligibility for live Ranked. The hour includes the booked lesson time, and match count depends on game length and discussion.',
    sections: [
      {
        heading: 'How should movement connect to cover in Apex Legends?',
        paragraphs: [
          'Useful movement is a route toward cover or a fighting angle with options for the next action. First, ask where a technique leaves your character after landing. For example, a quick slide into an exposed lane may create a harder fight than a slower protected route. Step 1 is to name the next cover and one fallback before leaving safety. Rehearse the route 3 times using Discord screen share to review aim and control. Movement Course from Duoly costs {price:move} for Firing Range practice. Play and Learn costs {price:learn} for live Ranked decisions. Second, match the technique to your input, platform and legend rather than copying an unrelated clip. Finally, consider whether teammates can follow the route and whether another squad already holds the angle. A useful lesson connects execution to ring information, spacing and the choice to take or leave a fight.',
        ],
      },
      {
        heading: 'How do you review a rotation after losing the angle?',
        paragraphs: [
          'A late rotation is a move begun after another squad has gained control of the intended route or position. First, pause before your squad leaves cover. For example, a direct path into the safe area can be risky when opponents already watch the only crossing. Step 1 is to compare cover, alternate routes and information from legend abilities. Review the approach 3 times using Discord screen share and name an earlier signal to move. Play and Learn from Duoly costs {price:learn} for an hourly Ranked lesson. Movement Course costs {price:move} for practicing the execution in the Firing Range. Second, choose the next protected position and a fallback if the position is occupied. Finally, test a simple movement toward cover while keeping aim controlled. Your coach can adapt the drill to your input and platform before adding speed or a more demanding technique.',
        ],
      },
    ],
    prepare:
      'Preparation for Apex Legends coaching is your region, platform, input and one clear lesson goal. First, name your preferred legends and explain a fight or rotation you want to understand. For example, a clip showing the approach to a crossing gives more context than the final elimination. Step 1 is to choose live Ranked learning or focused Firing Range practice. Play and Learn from Duoly costs {price:learn}. Movement Course costs {price:move} for an hourly lesson on techniques suited to your setup. Test voice and screen share using Discord, hide private notifications and keep login details private. Second, confirm queue eligibility for live Ranked or have the Firing Range ready. Finally, rehearse a simple move toward cover 3 times before adding harder variations. Ask the coach to compare control, aim and the landing position, so practice connects to a situation you recognize in matches.',
    faq: [
      [
        'Which Apex Legends lesson should I choose?',
        'Movement Course is an Apex Legends lesson in the Firing Range. Play and Learn is live Ranked learning. Share your input and platform so practice uses suitable techniques. Your coach joins you; booking does not fill every seat in a trio.',
      ],
      [
        'What are the standard Apex Legends coaching prices?',
        'Play and Learn costs {price:learn}, and Movement Course costs {price:move}. Coaching from Duoly has a 0% quantity discount. Prices checked on 8 November 2026.',
      ],
      [
        'What should I share before the lesson?',
        'Step 1 is to share your platform, region and one goal, for example a confusing decision. Then, test voice and screen share using Discord. Finally, keep account access private and hide personal notifications before showing a recording.',
      ],
      [
        'Will a lesson guarantee better results?',
        'Coaching provides a practice plan, and match results remain uncertain. For practice, repeat the agreed exercise 3 times before changing the goal. Beginners can choose a familiar setup or a basic decision to keep the lesson focused.',
      ],
    ],
  },
  'marvel-rivals': {
    title: 'Marvel Rivals Coaching and Hero Practice | Duoly',
    h1: 'Marvel Rivals coaching for your hero and role',
    lead: 'Book Marvel Rivals coaching for live learning or a focused hero lesson. Learn when to use your abilities and when your team is ready to follow.',
    format:
      'Marvel Rivals coaching on Duoly is a paid lesson with a Grandmaster+ coach using Discord, with voice and screen share. Two services are available. First, **Play and Learn** is one live Competitive match together, at {price:learn}. Your coach explains every decision out loud, with a quick review after. Second, **Hero Coaching** is a 1-hour lesson on one hero, at {price:hero}. Hero Coaching covers abilities, ultimate timing, positioning and matchups. For example, a Strategist player can work on saving a key ability for the moment an opponent dives. Pick the hourly lesson for hero-specific questions. Pick Play and Learn to see how decisions change as a match unfolds. Prices checked on 8 November 2026. Finally, every lesson runs on your own account, for Vanguard, Duelist and Strategist players alike. Coaching from Duoly has a 0% quantity discount.',
    sections: [
      {
        heading: 'How does your role change a Marvel Rivals team fight?',
        paragraphs: [
          'A team fight in Marvel Rivals is a chain of role decisions, and each role carries a different risk. First, a Vanguard can create space the rest of the team cannot use yet. A Duelist may take an angle without an escape route. A Strategist may spend key resources just before an opponent commits. For step 1 of a review, check who could see the target and which cooldowns were ready before the engage.',
          'Hero Coaching stays grounded in the hero you play. A dive hero needs a plan for entering and leaving. A backline hero needs safe sightlines and awareness of flanks. For example, bring the current patch, so the lesson uses combinations available now. Hero Coaching from Duoly costs {price:hero}, and Play and Learn costs {price:learn}. Repeat the review 3 times before changing the practice goal.',
        ],
      },
      {
        heading:
          'Example team fight: why can an ultimate fail without follow-up?',
        paragraphs: [
          'An ultimate without follow-up is an ultimate used before teammates can act on the opening. For example, you use an ultimate to open a fight while two teammates are still returning from spawn. The animation looks strong and still leaves the team unable to take space. Pause before the activation. Count who can act, which enemy defensive abilities are known and whether the objective demands an immediate contest. Step 1 is to pause before the decision.',
          'A small practice task is to review five ultimate uses from your next matches. First, write the intended purpose before judging the outcome: engage, response, survival or objective contest. Second, check whether the teammates needed for the plan were present. Finally, ask your Grandmaster+ coach for a hero-specific cue to spot the same situation sooner, reviewing clips with Discord screen share. Hero Coaching from Duoly costs {price:hero} for a full hour. Repeat the review 3 times before changing the practice goal.',
        ],
      },
    ],
    prepare:
      'Preparation for Marvel Rivals coaching is about context: hero, role, patch and one problem. Bring your platform, region, hero pool and the current patch. A recording should include the lead-up to fights, teammate positions and the objective. Pick two timestamps where you did not know whether to engage or reset. Step 1: for Hero Coaching, choose one hero and one matchup you struggle with. For Play and Learn, confirm your ranks can queue together in Competitive. Test voice using Discord before the session starts. Hide personal notifications during screen sharing. Keep your own account under your control, and never share login details. Finally, tell the coach your main role, so the lesson starts with the right hero questions. Play and Learn from Duoly costs {price:learn} and covers one Competitive match. Hero Coaching costs {price:hero} for a full hour. A short written goal, for example one hero matchup, saves time at the start. Review the chosen cue 3 times before adding another goal.',
    faq: [
      [
        'Which Marvel Rivals lesson should I choose?',
        'Hero Coaching is a Marvel Rivals lesson on abilities, ultimate timing, positioning and matchups for one hero. Play and Learn gives feedback during one Competitive match. Strategist, Vanguard and Duelist players can each choose a narrow goal for the lesson.',
      ],
      [
        'What are the standard Marvel Rivals coaching prices?',
        'Play and Learn costs {price:learn}, and Hero Coaching costs {price:hero}. Coaching from Duoly has a 0% quantity discount. Prices checked on 8 November 2026.',
      ],
      [
        'What should I share before the lesson?',
        'Step 1 is to share your platform, region and one goal, for example a confusing decision. Then, test voice and screen share using Discord. Finally, keep account access private and hide personal notifications before showing a recording.',
      ],
      [
        'Will a lesson guarantee better results?',
        'Coaching provides a practice plan, and match results remain uncertain. For practice, repeat the agreed exercise 3 times before changing the goal. Beginners can choose a familiar setup or a basic decision to keep the lesson focused.',
      ],
    ],
  },
};
