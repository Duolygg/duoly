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
      'Valorant coaching on Duoly is a paid lesson with an Immortal+ coach, held on Discord with voice and screen share. Three services are available. First, **Play and Learn** is one live Competitive game together, at {price:learn}. Second, **VOD Review** is a 1-hour lesson on a recent match, going round by round through positioning, utility and decisions, at {price:vod}. Third, **Aim and Crosshair** is a 1-hour lesson on crosshair placement, peeking and counter-strafing, at {price:aim}. Each Aim and Crosshair lesson ends with a training routine made for you. For example, a player who loses most first duels can book Aim and Crosshair for the mechanics, then VOD Review to see where each duel starts. Pick VOD Review to pause rounds and ask questions. Pick Play and Learn to hear feedback while decisions happen. Finally, every lesson runs on your own Riot account.',
    sections: [
      {
        heading: 'Why does a missed shot often start before the peek?',
        paragraphs: [
          'A missed shot is often the last step of a bad route into a fight. On attack, a duelist needs a teammate close enough to trade. An initiator needs utility timed to the entry, and a controller needs smokes on the right sightlines. A useful Valorant review follows the same order before anyone discusses sensitivity. Sentinels can focus on flank information and the timing of a late rotation instead.',
          'For a single-agent lesson, bring an agent you actually play. For example, a Sova player can check whether a drone cleared the angle the entry player needed. An Omen player can compare a smoke placed too early with a smoke landing as teammates take space. Agent choice sets the questions. The map, the economy and the team composition set the answers. Your coach ties every point to your own recording or live game. Bring the recording to VOD Review at {price:vod}, or play live in Play and Learn at {price:learn}.',
        ],
      },
      {
        heading: 'Example round: what makes an entry untradeable?',
        paragraphs: [
          'An untradeable entry is a peek with no teammate ready to answer the kill. For example, your entry player turns a corner while the second player is still behind a smoke. Pause the VOD right before the peek. What information is available? Which angle can the second player see? Is utility about to expire? Moving together or waiting for a flash may help more than a harder shot.',
          'For practice, mark five first contacts in your next recording. First, note whether a teammate could trade. Second, check whether your crosshair sat at head height before the opponent appeared. Finally, compare each moment with the round result instead of the scoreboard. Your Immortal+ coach adapts the exercise to your role, agent and comfort level, reviewing clips with Discord screen share. For the mechanics side, Aim and Crosshair costs {price:aim}.',
        ],
      },
    ],
    prepare:
      'Preparation for Valorant coaching is a short checklist before the lesson starts. For VOD Review, bring a recent full match recording with your HUD and audio. Add two timestamps where you were unsure about a peek or a rotation. A close game is often more useful than a highlight reel. For Aim and Crosshair, keep your usual sensitivity and settings, so the coach sees your real habits. For Play and Learn, confirm your ranks can queue together in Competitive. Test Discord voice and screen share before the session. Hide private notifications and tell the coach your region and platform. Never send login details to anyone, including your coach. Finally, every Valorant lesson runs on your own Riot account, and your coach joins with Discord. Play and Learn costs {price:learn} and covers one Competitive game. VOD Review and Aim and Crosshair each cost {price:vod}.',
    faq: [
      [
        'Which Valorant coaching format should I book?',
        'VOD Review is the pick for paused analysis of a recent match. Aim and Crosshair is the pick for a mechanics routine. Play and Learn gives feedback during one live Competitive game.',
      ],
      [
        'How much does Valorant coaching cost?',
        'Play and Learn is {price:learn}. VOD Review and Aim and Crosshair are {price:vod} each, with an Immortal+ coach.',
      ],
      [
        'Can we focus on one agent?',
        'Yes. Add the agent as your goal when you book. A single-agent focus keeps utility and positioning advice specific to your role.',
      ],
      [
        'Do I need a recording?',
        'A recording is needed for VOD Review only. Play and Learn uses the current game, and Aim and Crosshair uses live practice with Discord screen share.',
      ],
      [
        'Is Valorant coaching suitable for beginners?',
        'Yes. A beginner can work on movement, crosshair height and basic round planning. Tell the coach how much of Valorant you already know.',
      ],
      [
        'Will coaching guarantee a new rank?',
        'No. Coaching gives you a clear plan to practice. Your rank follows from the games you play after the lesson.',
      ],
    ],
  },
  'league-of-legends': {
    title: 'League of Legends Coaching and VOD Review | Duoly',
    h1: 'League of Legends coaching for your next practice goal',
    lead: 'Choose LoL coaching for lane decisions, champion mastery or a review of your own match. Build a practice goal you can recognize in your next game.',
    format:
      'League of Legends coaching on Duoly is a paid lesson on Discord, with voice and screen share. Three services are available. First, **Play and Learn** is one live ranked game with a Master+ coach, at {price:learn}. Second, **VOD Review** is a 1-hour lesson with a Grandmaster+ coach on a recent game, covering laning, waves and map moves, at {price:vod}. VOD Review ends with three things to fix. Third, **Champion Mastery** is a 1-hour lesson with a Grandmaster+ coach on one champion, at {price:champ}. Champion Mastery covers matchups, combos, builds and power spikes, practiced in a live game. Coaching can focus on top, jungle, mid, bot or support. For example, a jungler can bring a game with a late objective setup, while a mid laner can bring a costly recall. Finally, tell the coach your role and champion pool when you book.',
    sections: [
      {
        heading: 'Why does wave state decide a lane trade?',
        paragraphs: [
          'Wave state is the position and size of the minion waves in a lane, and wave state sets the price of a trade. With a large enemy wave approaching, a long trade can cost health, experience and a safe recall. With your own wave about to crash, staying for another plate can cost a clean reset. A League of Legends coach compares what you knew about the enemy jungler with the risk you took.',
          'Jungle and support lessons need different evidence. A jungler can track camp sequencing, lane priority and whether an objective setup began early enough. A support can examine the wave before roaming, vision routes and the moment an engage became possible. For example, a bot lane review can focus on spacing with your support and the timing of a shared recall. Bring the replay to VOD Review at {price:vod}, or ask about one champion in Champion Mastery at {price:champ}.',
        ],
      },
      {
        heading: 'Example lane review: what makes a recall expensive?',
        paragraphs: [
          'An expensive recall is a reset that gives away minions, experience or tower plates. For example, a mid laner recalls while the wave stops just outside the opposing tower. The opponent can hold the wave, and the returning player walks forward for experience. First, ask whether the wave could have been fully crashed. Second, ask whether the enemy jungler was visible. Finally, compare the item purchase with the minions likely to be lost.',
          'A practical take-home exercise is to label your first three recalls in your next game. Use three labels: wave crashed, wave moving toward you, or wave held away from you. Add the information you had before recalling. Your Grandmaster+ coach adjusts the task for your matchup during VOD Review with Discord screen share, priced at {price:vod}. To practice the cue live, Play and Learn costs {price:learn}.',
        ],
      },
    ],
    prepare:
      'Preparation for League of Legends coaching is a replay, a role and a question. For VOD Review, bring a recent full match replay or recording, the patch and your role. Include a loss where you still had decisions to make. Add two questions, for example one about laning and one about map movement. For Champion Mastery, pick one champion and list the matchups you find confusing. For Play and Learn, check your server and confirm your ranks can queue together. Test Discord voice and screen share before the session starts. Keep private chat and notifications out of shared recordings. Use your own Riot account, and never share login details. Finally, tell the coach your champion pool, so the lesson starts in the right place. Play and Learn costs {price:learn} and covers one ranked game. VOD Review and Champion Mastery each cost {price:vod}.',
    faq: [
      [
        'Can I book jungle or support coaching?',
        'Yes. Add the role when you book. A jungle or support review can focus on pathing, roaming or vision decisions.',
      ],
      [
        'What is the difference between Champion Mastery and VOD Review?',
        'Champion Mastery centers on one champion and its matchups. VOD Review follows your decisions in a recent game, from laning to map moves.',
      ],
      [
        'How much does League of Legends coaching cost?',
        'Play and Learn is {price:learn}. VOD Review and Champion Mastery are {price:vod} each. Coaching prices are the same for every rank.',
      ],
      [
        'Does Play and Learn include a full hour?',
        'Play and Learn is priced per game, so the length follows the match. VOD Review and Champion Mastery are a full hour each.',
      ],
      [
        'What should I take away?',
        'A short list of priorities and a way to check each priority in later games. VOD Review ends with three things to fix.',
      ],
      [
        'Do I need to be highly ranked?',
        'No. Pick a realistic goal for your current rank and experience.',
      ],
    ],
  },
  'rocket-league': {
    title: 'Rocket League Coaching and Mechanics Training | Duoly',
    h1: 'Rocket League coaching for decisions and mechanics',
    lead: 'Book Rocket League coaching for live Doubles or a mechanics lesson. Turn a replay problem into a drill you can repeat in free play.',
    format:
      '**Play and Learn** is an hour of live Doubles. **Mechanics Training** is an hourly lesson with practice packs. Both are booked by the hour, however many matches you fit in. Tell the coach whether your priority is a reliable touch, a recovery or your role as second player.',
    sections: [
      {
        heading: 'Read the next touch before committing',
        paragraphs: [
          'In Doubles, a difficult aerial is only part of the picture. The second player has to decide whether the first player can keep possession, whether the opponent has a clear touch and whether there is enough time to retreat. Reviewing the moment before a double commit often reveals a positioning problem long before the goal goes in.',
          'Mechanics training should support those situations. Aerial control helps you meet a ball earlier; recoveries return you to the play after a challenge; a controlled first touch keeps possession instead of gifting a clear. Ask for a drill that matches the failure you actually see. A flashy flick helps little if every attempt begins with the ball too far from your car.',
        ],
      },
      {
        heading: 'Example Doubles play: the tempting rebound',
        paragraphs: [
          'Your partner shoots, the ball rebounds high, and both opponents are moving toward it. You are second player at midfield with little boost. Pause before jumping. If your partner cannot recover behind you and the opponent can reach the ball first, a deep commitment can expose the entire net. Consider holding a recoverable position and reading the clear.',
          'One follow-up task is to review five goals conceded and mark your position when your partner made the touch before them. Could you cover the worst likely clear? Then practice landing on your wheels after a simple aerial and driving into a useful route. Keep the drill simple enough to repeat with control.',
        ],
      },
    ],
    prepare:
      'Save a replay from a close Doubles match and pick two timestamps. Share your platform, input, region and usual playlist. For mechanics work, warm up in free play without changing every camera or sensitivity setting right before the lesson. Check Discord audio and agree how you will share replays or your screen. Keep your login private.',
    faq: [
      [
        'Is Rocket League coaching per match?',
        'No. Both coaching services are hourly. The number of games or drill attempts depends on how you use the hour.',
      ],
      [
        'Can I focus on aerials?',
        'Yes. Mechanics Training covers aerials, flicks and recoveries. Describe the touch you struggle with so the drill fits.',
      ],
      [
        'Does the coach play Doubles with me?',
        'Yes, in Play and Learn. Check region, platform and that your ranks can queue together before you start.',
      ],
      [
        'Do I need advanced mechanics?',
        'No. Reliable contact, landing and positioning are good lesson goals before advanced moves.',
      ],
      [
        'Will I get practice material?',
        'Yes. Mechanics Training includes training packs. Agree which exercise to repeat and what a controlled attempt looks like.',
      ],
    ],
  },
  fortnite: {
    title: 'Fortnite Coaching for Builds, Edits and Decisions | Duoly',
    h1: 'Fortnite coaching for your next practice goal',
    lead: 'Choose a Fortnite coach for live learning or Creative build and edit practice. Set the mode and input first so the lesson fits the fights you play.',
    format:
      'Both Fortnite lessons are hourly. **Play and Learn** is live Ranked learning. **Build and Edit Course** covers piece control, edits and box fights in Creative. For Zero Build, book Play and Learn and name the mode as your goal.',
    sections: [
      {
        heading: 'Build a safer edit before adding speed',
        paragraphs: [
          'A build lesson can begin with how you protect yourself during an edit. Owning nearby pieces, choosing a right-hand peek and resetting after the shot all affect whether the opponent gets an easy reply. A fast edit that exposes your whole character can reinforce the wrong habit. Ask the coach to watch the setup and recovery as closely as the edit itself.',
          'For live play, the problem may be a rotation instead of a box fight. Review the route toward the next safe area, available cover and whether starting a fight leaves time to move. A controller player and a keyboard player may need different execution drills, even when the decision is similar. Tell the coach which input you use instead of copying someone else’s routine unchanged.',
        ],
      },
      {
        heading: 'Example Creative drill: edit, shoot, reset',
        paragraphs: [
          'Start inside a box with a wall you own. Choose an opening that lets you see a target while keeping as much of your character protected as possible. Edit, take one controlled shot, reset the wall and return to cover. Begin slowly enough to notice where you stand.',
          'For the next variation, change the target angle and decide whether the same opening is still useful. Count controlled repetitions where you return to cover, and judge the drill by control before speed. Your coach adapts the setup to your skill and input, then you test one cue in a real fight.',
        ],
      },
    ],
    prepare:
      'Bring your region, platform, input and a short clip showing what happens before the fight. Have Discord ready and check that your microphone works. For Build and Edit Course, be ready to load into Creative. For Play and Learn, pick the mode you want to play.',
    faq: [
      [
        'Can beginners book a Fortnite coach?',
        'Yes. Basic building, cover use and controlled edits are good starting points. Tell the coach your experience before choosing a drill.',
      ],
      [
        'Is there controller coaching?',
        'Yes. Share your input when you book so the drills fit your controller or keyboard.',
      ],
      [
        'Can I practice only edits?',
        'Yes. Build and Edit Course includes edits and piece control. Agree a narrow focus so the hour stays useful.',
      ],
      [
        'Does this include Zero Build?',
        'Book Play and Learn and name Zero Build as your goal. Build and Edit Course is for building.',
      ],
      [
        'Can we work on Ranked rotations?',
        'Yes. Play and Learn covers live Ranked decisions such as rotations and fight selection.',
      ],
      [
        'What does the price include?',
        'One hour with your coach on voice and screen share.',
      ],
    ],
  },
  'teamfight-tactics': {
    title: 'TFT Coaching and Teamfight Tactics Econ Review | Duoly',
    h1: 'TFT coaching for economy and decisions',
    lead: 'Book TFT coaching to review when you level, roll and commit to a board. Build a decision process that adapts when the shop does not cooperate.',
    format:
      '**Comp and Econ Review** is an hourly session. It covers composition choices, gold management and when to roll or level from stage two. For live help during a game, the Teamfight Tactics hub also offers **Board Coach**, priced per game.',
    sections: [
      {
        heading: 'Connect economy to board strength',
        paragraphs: [
          'Saving gold makes sense only in the context of your health, board and lobby. A review compares the cost of spending now with the risk of losing several rounds while waiting. Ask what upgrades were realistically available at each decision and whether your item holders kept the board working. A final placement alone cannot tell you whether an earlier choice was sensible.',
          'Composition work should include a way out of the first plan. Your items, augments and natural units may point in different directions. A coach can help you find a temporary board, the units worth holding and the point at which a transition becomes too expensive. Unit names change each set, so note the set and patch of the game you bring.',
        ],
      },
      {
        heading: 'Example economy decision: roll or level?',
        paragraphs: [
          'You reach a stage transition with a weak front line, several pairs and enough gold for a real decision. First assess the next opponents and the likely health cost of waiting. Then compare whether leveling adds a useful unit with whether rolling can complete upgrades. Finally consider which items are still unassigned.',
          'A simple review sheet records gold, health, level and your reason at three decision points. After the game, compare the plan with what happened, knowing no one predicts every shop. Bring the sheet to the lesson so the coach can tell a reasonable risk from an automatic habit. Include both good and bad outcomes.',
        ],
      },
    ],
    prepare:
      'Bring a full recording with the shop, bench, items and augment choices visible. A final-board screenshot hides most economy decisions. Note the patch and the timestamps of two rolls or level-ups you questioned. Keep personal messages off the screen share. You play on your own account, and the review is about choices you make yourself.',
    faq: [
      [
        'What TFT coaching can I book?',
        'Comp and Econ Review, an hourly lesson on compositions, economy and spending decisions.',
      ],
      [
        'Is this the same as Board Coach?',
        'No. Board Coach is live help during one game. Comp and Econ Review is a structured hourly lesson.',
      ],
      [
        'Should I record the entire match?',
        'Yes. A full recording keeps the shop choices and economy context that a final-board image cannot show.',
      ],
      [
        'Can we cover positioning?',
        'Yes. Add positioning to your goal when you book. The core of the lesson is composition and economy.',
      ],
      [
        'Will I learn meta compositions?',
        'Yes, plus how to pivot when your items and shops point somewhere else.',
      ],
      [
        'How long is the review?',
        'One hour, focused on the key decisions from one full game.',
      ],
    ],
  },
  'apex-legends': {
    title: 'Apex Legends Coaching and Movement Practice | Duoly',
    h1: 'Apex Legends coaching for movement and rotations',
    lead: 'Choose Apex coaching for live Ranked learning or focused movement practice. Work on reaching the next position with enough options to take the fight.',
    format:
      'Both Apex lessons are hourly. **Play and Learn** is a live Ranked session. **Movement Course** is a Firing Range lesson on slide jumps, wall bounces and tap-strafes. Share your input and platform when you book so every drill fits your setup.',
    sections: [
      {
        heading: 'Use movement to reach a useful position',
        paragraphs: [
          'A movement lesson should explain where the movement takes you. Sliding quickly into an exposed lane can still leave you without cover. A wall bounce that breaks line of sight may be useful when it gives time to reset, while a simpler route may be better when teammates need a predictable position. Ask the coach to connect each technique to a fight.',
          'Live coaching can focus on a different layer: choosing a drop, reading the ring, deciding when to rotate and recognizing a fight that will draw in another squad. Legend selection matters too. A mobility legend may create an exit, a controller may help hold a position, and support decisions can change how the squad resets. Set one focus before the hour so the lesson stays on track.',
        ],
      },
      {
        heading: 'Example rotation: arriving after the angle is lost',
        paragraphs: [
          'Your squad leaves a loot area late while another team already holds the route into the safe area. Before committing, compare available cover, alternate routes and the information your legend abilities can provide. A fast move straight through the open may give the holding team a clean shot. The review question is when the route became risky and what signal you missed earlier.',
          'For practice, review three rotations and pause before leaving cover. Name the next protected position and one fallback if it is taken. In the Firing Range, rehearse a simple movement toward cover while keeping your aim controlled. The coach adapts the drill to your input.',
        ],
      },
    ],
    prepare:
      'Share your region, input, platform and preferred legends. For movement, have the Firing Range ready. For live Ranked, check that your ranks can queue together, and keep your own account under your control. A short clip that shows the approach to a fight is more useful than the final elimination. Test Discord voice and mention any accessibility or input needs.',
    faq: [
      [
        'Which Apex lesson is live?',
        'Play and Learn is the live Ranked lesson. Movement Course is practice in the Firing Range.',
      ],
      [
        'Does every movement work on controller?',
        'Share your input and platform, and your coach picks the techniques that work on your setup.',
      ],
      [
        'Can we focus on rotations?',
        'Yes. Make rotations your goal for live play. Ring information, cover and fight selection are good review topics.',
      ],
      [
        'Does booking fill my whole trio?',
        'No. Your coach joins you, and you bring the rest of your squad or queue as usual.',
      ],
      [
        'How many games are included?',
        'Apex coaching is hourly. The number of games depends on match length and how much time you spend on review.',
      ],
      [
        'Which legend should I bring?',
        'The legend you play most. Your coach builds the lesson around its abilities.',
      ],
    ],
  },
  'marvel-rivals': {
    title: 'Marvel Rivals Coaching and Hero Practice | Duoly',
    h1: 'Marvel Rivals coaching for your hero and role',
    lead: 'Book Marvel Rivals coaching for live learning or a focused hero lesson. Learn when to use your abilities and when your team is ready to follow.',
    format:
      'Marvel Rivals coaching on Duoly is a paid lesson with a Grandmaster+ coach on Discord, with voice and screen share. Two services are available. First, **Play and Learn** is one live Competitive match together, at {price:learn}. Your coach explains every decision out loud, with a quick review after. Second, **Hero Coaching** is a 1-hour lesson on one hero, at {price:hero}. Hero Coaching covers abilities, ultimate timing, positioning and matchups. For example, a Strategist player can work on saving a key ability for the moment an opponent dives. Pick the hourly lesson for hero-specific questions. Pick Play and Learn to see how decisions change as a match unfolds. Finally, every lesson runs on your own account, for Vanguard, Duelist and Strategist players alike.',
    sections: [
      {
        heading: 'How does your role change a Marvel Rivals team fight?',
        paragraphs: [
          'A team fight in Marvel Rivals is a chain of role decisions, and each role carries a different risk. A Vanguard can create space the rest of the team cannot use yet. A Duelist may take an angle without an escape route. A Strategist may spend key resources just before an opponent commits. A useful review connects all three roles, asking who could see the target and which cooldowns were ready before the engage began.',
          'Hero Coaching stays grounded in the hero you play. A dive hero needs a plan for entering and leaving. A backline hero needs safe sightlines and awareness of flanks. Team-Up abilities add another coordination question, and Team-Up details change with patches. For example, bring the current patch, so the lesson uses combinations available now. Hero Coaching costs {price:hero}, and Play and Learn costs {price:learn}.',
        ],
      },
      {
        heading:
          'Example team fight: why can an ultimate fail without follow-up?',
        paragraphs: [
          'An ultimate without follow-up is an ultimate used before teammates can act on the opening. For example, you use an ultimate to open a fight while two teammates are still returning from spawn. The animation looks strong and still leaves the team unable to take space. Pause before the activation. Count who can act, which enemy defensive abilities are known and whether the objective demands an immediate contest.',
          'A small practice task is to review five ultimate uses from your next matches. First, write the intended purpose before judging the outcome: engage, response, survival or objective contest. Second, check whether the teammates needed for the plan were present. Finally, ask your Grandmaster+ coach for a hero-specific cue to spot the same situation sooner, reviewing clips with Discord screen share. Hero Coaching costs {price:hero} for a full hour.',
        ],
      },
    ],
    prepare:
      'Preparation for Marvel Rivals coaching is about context: hero, role, patch and one problem. Bring your platform, region, hero pool and the current patch. A recording should include the lead-up to fights, teammate positions and the objective. Pick two timestamps where you did not know whether to engage or reset. For Hero Coaching, choose one hero and one matchup you struggle with. For Play and Learn, confirm your ranks can queue together in Competitive. Test Discord voice before the session starts. Hide personal notifications during screen sharing. Keep your own account under your control, and never share login details. Finally, tell the coach your main role, so the lesson starts with the right hero questions. Play and Learn costs {price:learn} and covers one Competitive match. Hero Coaching costs {price:hero} for a full hour. A short written goal, for example one hero matchup, saves time at the start.',
    faq: [
      [
        'Can I focus on Strategist or Vanguard?',
        'Yes. Add your role and hero when you book, and the Grandmaster+ coach plans the lesson around both.',
      ],
      [
        'What does Hero Coaching cover?',
        'Abilities, ultimate timing, positioning and matchups for one hero. Agree a narrow goal for the hour.',
      ],
      [
        'How much does Marvel Rivals coaching cost?',
        'Play and Learn is {price:learn} and covers one Competitive match. Hero Coaching is {price:hero}.',
      ],
      [
        'Can we review Team-Up decisions?',
        'Yes. Bring the current patch, since Team-Up details change between seasons.',
      ],
      [
        'Do I need a large hero pool?',
        'No. One familiar hero gives the coach enough context to work on fundamentals.',
      ],
      [
        'Are prices tied to my rank?',
        'No. Coaching costs the same at every rank.',
      ],
    ],
  },
};
