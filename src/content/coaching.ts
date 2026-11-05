// Coaching page copy. **Bold** marks service names (rendered by src/components/seo/rich.ts).
export interface Lesson {
  title: string;
  h1: string;
  lead: string;
  format: string;
  sections: { heading: string; paragraphs: string[] }[];
  agenda: string[];
  prepare: string;
  faq: [string, string][];
}
export const lessons: Record<string, Lesson> = {
  valorant: {
    title: 'Valorant Coaching, VOD Review and Aim Training | Duoly',
    h1: 'Valorant coaching with a focused practice plan',
    lead: 'Book a Valorant coach for live Play and Learn, a round-by-round VOD review or an aim lesson. Work on one repeatable decision before adding more drills.',
    format:
      '**Play and Learn** is priced per game. **VOD Review** and **Aim and Crosshair** are hourly lessons. All three are taught by Immortal+ coaches. Pick review to pause rounds, or live play for feedback as decisions happen.',
    sections: [
      {
        heading: 'Trade the space, then review the shot',
        paragraphs: [
          'A missed shot can begin with the route into a fight. On attack, a duelist needs a teammate close enough to trade, an initiator needs utility timed to that entry, and a controller needs smokes that isolate the right sightlines. A useful review follows that sequence before discussing sensitivity. Sentinels can instead focus on flank information and the timing of a late rotation.',
          'For a single-agent lesson, bring an agent you actually play. A Sova player might examine whether a drone cleared the angle the entry player needed. An Omen player might compare a smoke placed too early with one that lands as teammates take space. Agent choice sets the questions; the current map and team composition set the answers.',
        ],
      },
      {
        heading: 'Example round: the untradeable entry',
        paragraphs: [
          'Your entry player turns a corner while the second player is still behind a smoke. Pause right before the peek. What information is available? Which angle can the second player see? Is utility about to expire? Moving together or waiting for a flash may be more useful than asking the entry player to hit a harder shot.',
          'For practice, mark five first contacts in your next recording. Note whether a teammate could trade and whether your crosshair was ready at head height before the opponent appeared. Review those moments instead of the scoreboard. Your coach can adapt the exercise to your role and comfort level.',
        ],
      },
    ],
    agenda: [
      'Set one goal and name your agent, map and usual role.',
      'Review two contrasting rounds, including one that went well. Pause before the decision so you can explain your read.',
      'Practice one adjustment to peeking, crosshair placement or utility timing. In live play, use the next suitable round.',
      'Finish by setting a warm-up routine for your next session and one question to check in your next recording. An hourly review can split these steps into 5, 30, 15 and 10 minutes.',
    ],
    prepare:
      'Bring a recent full match recording with your HUD and audio, plus two timestamps where you were unsure. A close game is often more useful than a highlight reel. Check that Discord screen sharing works, hide private notifications and tell the coach your region and platform. Never send login details. For live play, check that your ranks can queue together.',
    faq: [
      [
        'Which Valorant coaching format should I book?',
        'Choose VOD Review for paused analysis, Aim and Crosshair for a mechanics routine, or Play and Learn for feedback during one game.',
      ],
      [
        'Can we focus on one agent?',
        'Yes. Make that your goal when you book. A single-agent focus keeps utility and positioning advice specific.',
      ],
      [
        'Do I need a recording?',
        'A recording is needed for VOD Review. Live practice uses the current game, with screen sharing agreed before the session.',
      ],
      [
        'Is this suitable for beginners?',
        'Yes. A beginner can work on movement, crosshair height and basic round planning. Tell the coach how much you already know.',
      ],
      [
        'Will coaching guarantee a new rank?',
        'Coaching gives you a clear plan to practice; your rank follows from the games you play.',
      ],
      [
        'Is there a first-session offer?',
        'Yes. Your first Play and Learn session can be half price.',
      ],
    ],
  },
  'league-of-legends': {
    title: 'League of Legends Coaching and VOD Review | Duoly',
    h1: 'League of Legends coaching for your next practice goal',
    lead: 'Choose LoL coaching for lane decisions, champion mastery or a review of your own match. Build a practice goal you can recognize in your next game.',
    format:
      '**Play and Learn** is a live game with a Master+ coach, priced per game. **VOD Review** and **Champion Mastery** are hourly lessons with Grandmaster+ coaches. Coaching can focus on top, jungle, mid, bot or support. Tell us your role and champion when you book so the lesson starts in the right place.',
    sections: [
      {
        heading: 'Make wave state part of the decision',
        paragraphs: [
          'A lane review should connect trading to the wave. With a large enemy wave approaching, a long trade can cost health, experience and a safe recall. With your own wave about to crash, staying for another plate can cost a clean reset. The coach compares what you knew about the enemy jungler with the risk you took, instead of judging the play only by its result.',
          'Jungle and support lessons need different evidence. A jungler can track camp sequencing, lane priority and whether an objective setup began early enough. A support can examine the wave before roaming, vision routes and the moment an engage became possible. For bot lane, spacing with your support and the timing of a shared recall can matter more than another damage combo.',
        ],
      },
      {
        heading: 'Example lane review: the expensive recall',
        paragraphs: [
          'A mid laner recalls while their wave stops just outside the opposing tower. The opponent can hold it, leaving the returning player to walk forward for experience. First ask whether the wave could have been fully crashed. Then ask whether the enemy jungler was visible. Finally compare the item purchase with the minions likely to be lost.',
          'A practical take-home exercise is to label your first three recalls: wave crashed, wave moving toward you, or wave held away from you. Add the information you had before recalling. The goal is to notice the pattern before your next reset, with the coach adjusting the task for your matchup.',
        ],
      },
    ],
    agenda: [
      'Name your role, champion pool and one recurring problem.',
      'For an hourly review, spend about 10 minutes on context and 25 minutes on laning or the early jungle route.',
      'Use about 15 minutes for a second example or a champion-specific practice task. Compare the choices available before the outcome.',
      'Use the last 10 minutes for questions and three priorities for your next games. Live Play and Learn follows the match length instead of this hourly split.',
    ],
    prepare:
      'Bring a recent replay or recording, the patch, your role and two questions. Include a loss where you still had decisions to make. For Champion Mastery, pick one champion and list the matchups that confuse you. For live play, check your server and that your ranks can queue together. Use your own account and keep private chat out of shared recordings.',
    faq: [
      [
        'Can I book jungle or support coaching?',
        'Yes. Add the role when you book. The review can focus on pathing, roaming or vision decisions.',
      ],
      [
        'What is the difference between Champion Mastery and VOD Review?',
        'Champion Mastery centers on one champion and its matchups. VOD Review follows your decisions in a recent game.',
      ],
      [
        'Does Play and Learn include a full hour?',
        'Play and Learn is priced per game for League of Legends, so its length follows the match. VOD Review and Champion Mastery are a full hour.',
      ],
      [
        'What should I take away?',
        'A short list of priorities and a way to check them in later games. VOD Review ends with three things to fix.',
      ],
      [
        'Do I need to be highly ranked?',
        'No. Coaching prices are the same for every rank. Pick a realistic goal for your current experience.',
      ],
      [
        'Can I get a first-session price?',
        'Yes. Your first Play and Learn session can be half price.',
      ],
    ],
  },
  'rocket-league': {
    title: 'Rocket League Coaching and Mechanics Training | Duoly',
    h1: 'Rocket League coaching for decisions and mechanics',
    lead: 'Book Rocket League coaching for live Doubles or a mechanics lesson. Turn a replay problem into a drill you can repeat in free play.',
    format:
      '**Play and Learn** is an hour of live Doubles with a Grand Champion coach. **Mechanics Training** is an hourly lesson with a Grand Champion coach and practice packs. Both are booked by the hour, however many matches you fit in. Tell the coach whether your priority is a reliable touch, a recovery or your role as second player.',
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
    agenda: [
      'Use the first 10 minutes to check camera settings, input and one replay moment or recurring match problem.',
      'Spend 20 minutes on live Doubles decisions or the first drill, pausing between attempts to explain what you noticed.',
      'Use 20 minutes to apply the same skill to a different ball path or in another match.',
      'Use the last 10 minutes to pick a practice pack, a recovery cue and a way to judge improvement. Your coach adjusts the split to your goal.',
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
      [
        'Is there a first-session offer?',
        'Yes. Your first Play and Learn session can be half price.',
      ],
    ],
  },
  fortnite: {
    title: 'Fortnite Coaching for Builds, Edits and Decisions | Duoly',
    h1: 'Fortnite coaching for your next practice goal',
    lead: 'Choose a Fortnite coach for live learning or Creative build and edit practice. Set the mode and input first so the lesson fits the fights you play.',
    format:
      'Both Fortnite lessons are hourly with an Unreal coach. **Play and Learn** is live Ranked learning. **Build and Edit Course** covers piece control, edits and box fights in Creative. For Zero Build, book Play and Learn and name the mode as your goal.',
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
    agenda: [
      'Spend 10 minutes naming the mode, input and one fight you keep losing.',
      'Use 20 minutes for a Creative assessment or a live game, with one focus such as peek safety or movement to cover.',
      'Spend 20 minutes repeating the drill or applying the decision in another match.',
      'Use the last 10 minutes to write a short warm-up plan and one replay question. Your coach adjusts the split to your goal.',
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
        'One hour with your coach on voice and screen share. Your first Play and Learn session can be half price.',
      ],
    ],
  },
  'teamfight-tactics': {
    title: 'TFT Coaching and Teamfight Tactics Econ Review | Duoly',
    h1: 'Teamfight Tactics coaching for economy and decisions',
    lead: 'Book TFT coaching to review when you level, roll and commit to a board. Build a decision process that adapts when the shop does not cooperate.',
    format:
      '**Comp and Econ Review** is an hourly session with a Master+ coach. It covers composition choices, gold management and when to roll or level from stage two. For live help during a game, the Teamfight Tactics hub also offers **Board Coach**, priced per game.',
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
    agenda: [
      'Use 10 minutes to name your set, patch, usual compositions and one economy question.',
      'Review stage two and the first major spending decision for about 20 minutes.',
      'Spend 20 minutes comparing an alternative board or later transition, including items and positioning.',
      'Finish with 10 minutes on a decision checklist and a practice goal for your next games.',
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
      'Both Apex lessons are hourly with a Master coach. **Play and Learn** is a live Ranked session. **Movement Course** is a Firing Range lesson on slide jumps, wall bounces and tap-strafes. Share your input and platform when you book so every drill fits your setup.',
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
    agenda: [
      'Spend 10 minutes checking input, platform, legend and the goal for the hour.',
      'Use 20 minutes to assess movement in the Firing Range or review decisions during live play.',
      'Spend 20 minutes applying one cue, such as choosing the next cover position before moving.',
      'Use the last 10 minutes to set a repeatable drill for your next solo practice and answer your questions. In live play, match length can shift this split.',
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
      'Both lessons are with a Grandmaster+ coach. **Play and Learn** is priced per Competitive match. **Hero Coaching** is an hour on one hero’s abilities, ultimate timing, positioning and matchups. Pick the hourly lesson for hero-specific questions, and live play to see how those decisions change as a match unfolds.',
    sections: [
      {
        heading: 'Read the fight from your role',
        paragraphs: [
          'A Vanguard can create space that the rest of the team cannot use yet. A Duelist may take an angle without an escape route. A Strategist may spend key resources just before an opponent commits. A useful review connects those choices, asking who could see the target and which cooldowns were available before the engage began.',
          'Hero Coaching stays grounded in the hero you play. A dive hero needs a plan for entering and leaving, while a backline hero needs safe sightlines and awareness of flanks. Team-Up abilities add another coordination question, and their details change with patches. Bring the current patch so the lesson uses the combinations that work now.',
        ],
      },
      {
        heading: 'Example team fight: an ultimate without follow-up',
        paragraphs: [
          'You use an ultimate to open a fight while two teammates are still returning from spawn. The animation looks strong and still leaves the team unable to take the space. Pause before the activation and count who can act, which enemy defensive abilities are known and whether the objective demands an immediate contest.',
          'A small practice task is to review five ultimate uses and write the intended purpose before judging the outcome. Was it an engage, a response, a survival tool or an objective contest? Then check whether the teammates that plan needed were present. Ask your coach for a hero-specific cue that helps you spot the same situation sooner.',
        ],
      },
    ],
    agenda: [
      'Name your hero, role and one matchup or team-fight problem.',
      'For the hourly lesson, use 10 minutes for context and 20 minutes on positioning and ability use.',
      'Spend 20 minutes practicing a hero sequence or applying the cue in a game.',
      'Use the final 10 minutes for an ultimate checklist and one follow-up task. Live Play and Learn follows the match instead of this hourly split.',
    ],
    prepare:
      'Bring your platform, region, hero pool and current patch. A recording should include the lead-up to fights, teammate positions and the objective. Pick two timestamps where you did not know whether to engage or reset. For live play, check that your ranks can queue together, test voice and hide personal notifications during screen sharing.',
    faq: [
      [
        'Can I focus on Strategist or Vanguard?',
        'Yes. Add your role and hero when you book.',
      ],
      [
        'What does Hero Coaching cover?',
        'Abilities, ultimate timing, positioning and matchups for one hero. Agree a narrow goal for the hour.',
      ],
      [
        'Is Play and Learn hourly?',
        'No. Marvel Rivals Play and Learn is per match. Hero Coaching is the hourly lesson.',
      ],
      [
        'Can we review Team-Up decisions?',
        'Yes. Bring the current patch, since Team-Up details change.',
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
