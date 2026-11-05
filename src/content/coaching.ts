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
      'Play and Learn is priced per game. VOD Review and Aim and Crosshair are hourly lessons. All three specify Immortal+ coaches in the catalog. That is the service requirement, rather than a claim about who is online. Choose review when you want to pause rounds; choose live play when you want feedback on decisions as they happen.',
    sections: [
      {
        heading: 'Trade the space, then review the shot',
        paragraphs: [
          'A missed shot can begin with the route into a fight. On attack, a duelist needs a teammate close enough to trade, an initiator needs utility timed to that entry, and a controller needs smokes that isolate the right sightlines. A useful review follows that sequence before discussing sensitivity. Sentinels can instead focus on flank information and the timing of a late rotation.',
          'For a single-agent lesson, bring an agent you actually play. A Sova player might examine whether a drone cleared the angle the entry player needed. An Omen player might compare a smoke placed too early with one that lands as teammates take space. Agent choice sets the questions; the current map and team composition set the answers.',
        ],
      },
      {
        heading: 'Illustrative round: the untradeable entry',
        paragraphs: [
          'Imagine your entry player turns a corner while the second player is still behind a smoke. Pause immediately before the peek. What information is available? Which angle can the second player see? Is utility about to expire? Moving together or waiting for a flash may be more useful than asking the entry player to hit a harder shot. This is an original teaching scenario, not a customer match or a coach-reviewed case study.',
          'For practice, mark five first contacts in your next recording. Note whether a teammate could trade and whether your crosshair was ready at head height before the opponent appeared. Review those observations rather than using the scoreboard alone. Ask your coach to adapt the exercise to your role and comfort level.',
        ],
      },
    ],
    agenda: [
      'Set one goal and identify your agent, map and usual role.',
      'Review two contrasting rounds, including one that went well. Pause before the decision so you can explain your read.',
      'Practise one adjustment to peeking, crosshair placement or utility timing. In live play, use the next suitable round.',
      'Finish with a short warm-up routine and a question to check in your next recording. An hourly review can split these steps into 5, 30, 15 and 10 minutes.',
    ],
    prepare:
      'Bring a recent full match recording with your HUD and audio, plus two timestamps where you were unsure. A close game is often more useful than a highlight reel. Check that Discord screen sharing works, hide private notifications and tell the coach your region and platform. Never send login details. Confirm queue compatibility before choosing live play.',
    faq: [
      [
        'Which Valorant coaching format should I book?',
        'Choose VOD Review for paused analysis, Aim and Crosshair for a mechanics routine, or Play and Learn for feedback during one game.',
      ],
      [
        'Can we focus on one agent?',
        'Yes, make that your requested goal and confirm the coach can cover it. A single-agent focus keeps utility and positioning advice specific.',
      ],
      [
        'Do I need a recording?',
        'A recording is needed for VOD Review. Live practice can use the current game, with screen sharing agreed before the session.',
      ],
      [
        'Is this suitable for beginners?',
        'Yes, a beginner can work on movement, crosshair height and basic round planning. Tell the coach how much you already know.',
      ],
      [
        'Will coaching guarantee a new rank?',
        'No. Practice and match results vary, and a lesson does not promise a rank outcome.',
      ],
      [
        'Are several training sessions cheaper per unit?',
        'Training has no automatic quantity discount. Any first-session Play and Learn offer depends on account eligibility and is confirmed at checkout.',
      ],
    ],
  },
  'league-of-legends': {
    title: 'League of Legends Coaching and VOD Review | Duoly',
    h1: 'League of Legends coaching for your next practice goal',
    lead: 'Choose LoL coaching for lane decisions, champion mastery or a review of your own match. Build a practice goal you can recognise in your next game.',
    format:
      'The catalog offers Play and Learn with a Master+ coach per game, plus hourly VOD Review and Champion Mastery with Grandmaster+ coaches. League coaching can focus on top, jungle, mid, bot or support. Confirm the role and champion specialism you need before the session; a rank label alone does not establish expertise on every champion.',
    sections: [
      {
        heading: 'Make wave state part of the decision',
        paragraphs: [
          'A lane review should connect trading to the wave. With a large enemy wave approaching, a long trade can cost health, experience and a safe recall. With your own wave about to crash, staying for another plate can cost a clean reset. The coach can compare what you knew about the enemy jungler with the risk you took, rather than judging the play only after seeing the result.',
          'Jungle and support lessons need different evidence. A jungler can track camp sequencing, lane priority and whether an objective setup began early enough. A support can examine the wave before roaming, vision routes and the moment an engage became possible. For bot lane, spacing with your support and the timing of a shared recall can be more useful than another damage combo.',
        ],
      },
      {
        heading: 'Illustrative lane review: the expensive recall',
        paragraphs: [
          'Picture a mid laner recalling while their wave stops just outside the opposing tower. The opponent can hold it, leaving the returning player to walk forward for experience. First ask whether the wave could have been fully crashed. Then ask whether the enemy jungler was visible. Finally compare the item purchase with the minions likely to be lost. This is an invented teaching position, clearly separate from a real customer VOD.',
          'A practical take-home exercise is to label your first three recalls: wave crashed, wave moving toward you, or wave held away from you. Add the information you had before recalling. The goal is to notice the pattern before your next reset, with the coach adjusting the task for your matchup.',
        ],
      },
    ],
    agenda: [
      'Name your role, champion pool and one recurring problem.',
      'For an hourly review, spend about 10 minutes setting context and 25 minutes reviewing laning or the early jungle route.',
      'Use about 15 minutes for a second example or a champion-specific practice task. Compare the choices available before the outcome.',
      'Keep the last 10 minutes for questions and three priorities. Per-game live coaching follows the match length instead of a fixed hourly agenda.',
    ],
    prepare:
      'Bring a recent replay or recording, the patch context, your role and two questions. Include a loss where you still had decisions to make. For Champion Mastery, pick one champion and list the matchups that confuse you. Check server and legitimate queue eligibility for live play. Use your own account and keep private chat or personal information out of shared recordings.',
    faq: [
      [
        'Can I book jungle or support coaching?',
        'Yes, request the relevant role and confirm the coach can cover it before starting. The review can focus on pathing, roaming or vision decisions.',
      ],
      [
        'What is the difference between Champion Mastery and VOD Review?',
        'Champion Mastery centres on one champion and practical matchups. VOD Review follows decisions in a recent game.',
      ],
      [
        'Does Play and Learn include a full hour?',
        'It is priced per game for League of Legends. Match length varies, so compare the unit with the hourly review services.',
      ],
      [
        'What should I take away?',
        'Use the session to agree a small set of priorities and a way to check them in later games. The VOD Review catalog specifies three things to fix.',
      ],
      [
        'Do I need to be highly ranked?',
        'No rank-priced ladder applies to these training services. Choose a realistic goal for your current experience.',
      ],
      [
        'Can I get a first-session price?',
        'An eligible first Play and Learn session can receive the checkout offer. The table shows normal pricing without assuming your eligibility.',
      ],
    ],
  },
  'rocket-league': {
    title: 'Rocket League Coaching and Mechanics Training | Duoly',
    h1: 'Rocket League coaching for decisions and mechanics',
    lead: 'Book Rocket League coaching for live Doubles or a mechanics lesson. Turn a replay problem into a drill you can repeat in free play.',
    format:
      'Play and Learn specifies a Grand Champion coach for an hour of Doubles. Mechanics Training is also hourly, with a Grand Champion coach and practice packs. Rocket League lessons here are sold by time, rather than by the number of short matches. Tell the coach whether your priority is a reliable touch, a recovery or your role as second player.',
    sections: [
      {
        heading: 'Read the next touch before committing',
        paragraphs: [
          'In Doubles, a difficult aerial is only part of the picture. The second player has to decide whether the first player can keep possession, whether the opponent has a clear touch and whether there is enough time to retreat. Reviewing the moment before a double commit often reveals a positioning problem long before the goal goes in.',
          'Mechanics training should support those situations. Aerial control helps you meet a ball earlier; recoveries help you return to the play after a challenge; a controlled first touch can keep possession instead of gifting a clear. Ask for a drill that matches the failure you actually see. Learning a flashy flick has less value if every attempt begins with the ball too far from your car.',
        ],
      },
      {
        heading: 'Illustrative Doubles scenario: the tempting rebound',
        paragraphs: [
          'Your partner shoots, the ball rebounds high, and both opponents are moving toward it. You are second player at midfield with limited resource. Pause before jumping. If your partner cannot recover behind you and the opponent can reach the ball first, a deep commitment can expose the entire net. Consider holding a recoverable position and reading the clear. This is a teaching scenario, not claimed footage from a fulfilled session.',
          'One follow-up task is to review five goals conceded and mark your position when your partner made the preceding touch. Were you able to cover the worst likely clear? Then practise landing on your wheels after a simple aerial and driving into a useful route. Keep the drill manageable enough to repeat with control.',
        ],
      },
    ],
    agenda: [
      'Use the first 10 minutes to check camera comfort, input and one replay moment or recurring match problem.',
      'Spend 20 minutes on live Doubles decisions or the first drill, pausing between attempts to explain what you noticed.',
      'Use 20 minutes to apply the same skill under a different ball trajectory or in another match.',
      'Reserve 10 minutes for a practice pack, recovery cue and a way to judge improvement. This is a sample hour, adjustable with the coach.',
    ],
    prepare:
      'Save a replay from a close Doubles match and identify two timestamps. Share your platform, input, region and usual playlist. For mechanics work, warm up in free play without changing every camera or sensitivity setting immediately before the lesson. Check Discord audio and agree how replay files or screen sharing will work. Keep your login private.',
    faq: [
      [
        'Is Rocket League coaching per match?',
        'These training services are hourly. The number of games or drill attempts depends on how you use the session.',
      ],
      [
        'Can I focus on aerials?',
        'Yes, Mechanics Training lists aerials, flicks and recoveries. Explain the specific touch you struggle with so the drill fits.',
      ],
      [
        'Does the coach play Doubles with me?',
        'Play and Learn is the live Doubles format. Confirm region, platform and legitimate queue compatibility before starting.',
      ],
      [
        'Do I need advanced mechanics?',
        'No. Reliable contact, landing and positioning are valid lesson goals before advanced moves.',
      ],
      [
        'Will I get practice material?',
        'Mechanics Training includes training packs in its catalog scope. Agree which exercise to repeat and what a controlled attempt looks like.',
      ],
      [
        'Are hourly training bundles discounted?',
        'Training does not receive the automatic quantity discount. The first Play and Learn offer is conditional on account eligibility.',
      ],
    ],
  },
  fortnite: {
    title: 'Fortnite Coaching for Builds, Edits and Decisions | Duoly',
    h1: 'Fortnite coaching for your next practice goal',
    lead: 'Choose a Fortnite coach for live learning or Creative build and edit practice. Set the mode and input first so the lesson fits the fights you play.',
    format:
      'Both Fortnite training services are hourly. Play and Learn specifies an Unreal coach for live Ranked learning. Build and Edit Course specifies an Unreal coach for piece control, edits and box fights in Creative. There is no separate Zero Build training product in this catalog; confirm suitable live-session scope before booking for that mode.',
    sections: [
      {
        heading: 'Build a safer edit before adding speed',
        paragraphs: [
          'A build lesson can begin with how you protect yourself during an edit. Owning nearby pieces, choosing a right-hand peek and resetting after the shot all affect whether the opponent gets an easy reply. A fast edit that exposes your whole character can reinforce the wrong habit. Ask the coach to watch the setup and recovery as closely as the edit itself.',
          'For live play, the teaching problem may be a rotation rather than a box fight. Review the route toward the next safe area, available cover and whether starting a fight leaves time to move. A controller player and a keyboard player may need different execution drills, even when the decision is similar. Tell the coach which input you use instead of copying someone else’s routine unchanged.',
        ],
      },
      {
        heading: 'Illustrative Creative exercise: edit, shoot, reset',
        paragraphs: [
          'Start inside a box with a wall you own. Choose an opening that lets you see a target while keeping as much of your character protected as possible. Edit, take one controlled shot, reset the wall and return to cover. Begin slowly enough to notice where you stand. This is an original practice suggestion, not a permissioned customer clip or a reviewed coach demonstration.',
          'For the next variation, change the target angle and decide whether the same opening is still useful. Count controlled repetitions where you return to cover. Avoid judging the exercise only by raw edit speed. Ask your coach to adapt the setup to your skill, input and the current Creative tools, then test one cue in a real fight.',
        ],
      },
    ],
    agenda: [
      'Spend 10 minutes naming the mode, input and one failed fight pattern.',
      'Use 20 minutes for Creative assessment or a live game, with a clear focus such as peek safety or movement to cover.',
      'Spend 20 minutes repeating the relevant drill or applying the decision in another match.',
      'Use 10 minutes to write a short warm-up plan and a replay question. The hourly session is flexible, and this agenda is an example.',
    ],
    prepare:
      'Bring your region, platform, input and a short clip showing what happens before the fight. Have Discord ready and check that your microphone works. For Build and Edit Course, be ready to enter Creative. For Play and Learn, confirm that the mode and queue are appropriate. Tournament entry and a tournament teammate are outside these training offers.',
    faq: [
      [
        'Can beginners book a Fortnite coach?',
        'Yes, basic building, cover use and controlled edits are valid starting points. Tell the coach your experience before choosing a drill.',
      ],
      [
        'Is there controller coaching?',
        'Share your input and confirm the coach can teach it. The catalog does not list separate controller and keyboard products.',
      ],
      [
        'Can I practise only edits?',
        'Build and Edit Course includes edits and piece control. Agree a narrow focus so the hour stays useful.',
      ],
      [
        'Does this include Zero Build?',
        'There is no standalone Zero Build training SKU. Confirm appropriate scope for a live lesson before booking it.',
      ],
      [
        'Is a tournament included?',
        'No tournament service is offered on this coaching page. The training session is for practice and learning.',
      ],
      [
        'What does the displayed price include?',
        'The table shows one normal hourly training unit. Any eligible first Play and Learn discount is separately confirmed at checkout.',
      ],
    ],
  },
  'teamfight-tactics': {
    title: 'TFT Coaching and Teamfight Tactics Econ Review | Duoly',
    h1: 'Teamfight Tactics coaching for economy and decisions',
    lead: 'Book TFT coaching to review when you level, roll and commit to a board. Build a decision process that can adapt when the shop does not cooperate.',
    format:
      'Comp and Econ Review is the training service for Teamfight Tactics: an hourly session with a Master+ coach. It covers composition choices, gold management and rolling or levelling from stage two. The game hub also contains Board Coach in the duo category, which is a different live per-game service. This page owns the structured hourly training intent.',
    sections: [
      {
        heading: 'Connect economy to board strength',
        paragraphs: [
          'Saving gold makes sense only in the context of your health, board and lobby. A review can compare the cost of spending now with the risk of losing several rounds while waiting. Ask what upgrades were realistically available at each decision and whether your item holders kept the board functional. A final placement alone cannot tell you if the earlier choice was sensible.',
          'Composition work should include a way out of the initial plan. Your items, augments and natural units may point in different directions. A coach can help you identify a temporary board, the units worth holding and the point at which a transition becomes too expensive. Set-specific unit names change, so a good preparation note records the set and patch of the game being reviewed.',
        ],
      },
      {
        heading: 'Illustrative economy decision: roll or level?',
        paragraphs: [
          'Imagine reaching a stage transition with a weak front line, several pairs and enough gold for a meaningful decision. First assess the next opponents and the likely health cost of waiting. Then compare whether levelling adds a useful unit with whether rolling can complete upgrades. Finally consider which items are still unassigned. This is a teaching scenario rather than a real match result or a universal instruction to spend.',
          'A practical review sheet can record gold, health, level and your reason at three decision points. After the game, compare the plan with what happened without pretending you could predict every shop. Bring the sheet to the lesson so the coach can distinguish a reasonable risk from an automatic habit. The exercise works best when you include both good and bad outcomes.',
        ],
      },
    ],
    agenda: [
      'Use 10 minutes to identify your set, patch, typical compositions and one economy question.',
      'Review stage two and the first major spending decision for about 20 minutes.',
      'Spend 20 minutes comparing an alternative board or later transition, with attention to items and positioning.',
      'Finish with 10 minutes for a decision checklist and a practice goal. This is a sample hourly review, adjusted to the recording.',
    ],
    prepare:
      'Bring a full recording with the shop, bench, items and augment choices visible. A final-board screenshot hides most economy decisions. Note the patch and timestamps of two rolls or level-ups you questioned. Keep personal messages outside the screen share. You control your own account throughout; the review is about explaining choices you can make yourself.',
    faq: [
      [
        'What TFT coaching can I book?',
        'Comp and Econ Review is the hourly training offer, covering compositions, economy and spending decisions.',
      ],
      [
        'Is this the same as Board Coach?',
        'No. Board Coach is a live per-game service in the hub catalog. This page explains the separate hourly training review.',
      ],
      [
        'Should I record the entire match?',
        'Yes, a complete recording preserves shop choices and economy context that a final-board image cannot show.',
      ],
      [
        'Can we cover positioning?',
        'Include positioning as part of your review goal and confirm it with the coach. The advertised core scope is composition and economy.',
      ],
      [
        'Will you give me a guaranteed composition?',
        'No composition can guarantee placement. The useful goal is learning how to react to items, shops and opponents.',
      ],
      [
        'Does the first Play and Learn offer apply?',
        'TFT has no Play and Learn training entry in the catalog. This hourly review uses its normal price without that introductory offer.',
      ],
    ],
  },
  'apex-legends': {
    title: 'Apex Legends Coaching and Movement Practice | Duoly',
    h1: 'Apex Legends coaching for movement and rotations',
    lead: 'Choose Apex coaching for live Ranked learning or focused movement practice. Work on reaching the next position with enough options to take the fight.',
    format:
      'Play and Learn is an hourly live Ranked session with a Master coach. Movement Course is an hourly Firing Range lesson with a Master coach. The movement catalog mentions slide jumps, wall bounces and tap-strafes; technique suitability depends on input and platform. Confirm those details before selecting an exercise rather than expecting every listed movement to work on every setup.',
    sections: [
      {
        heading: 'Use movement to reach a useful position',
        paragraphs: [
          'A movement lesson should explain where the movement takes you. Sliding quickly into an exposed lane can still leave you without cover. A wall bounce that breaks line of sight may be useful when it gives time to reset, while a simpler route may be better when teammates need a predictable position. Ask the coach to connect each technique to a fight situation.',
          'Live coaching can focus on a different layer: choosing a drop, reading the ring, deciding when to rotate and recognising a fight that attracts another squad. Legend selection matters too. A mobility legend may create an exit, a controller may help hold a position, and support decisions can change how the squad resets. Set one focus before the hour so the lesson does not turn into a list of unrelated callouts.',
        ],
      },
      {
        heading: 'Illustrative rotation: arriving after the angle is lost',
        paragraphs: [
          'Picture your squad leaving a loot area late while another team already holds the route into the safe area. Before committing, compare available cover, alternate routes and the information your legend abilities can provide. A fast move straight through the open may give the holding team a clean shot. The review question is when the route became risky and what signal you missed earlier. This example is hypothetical, with no customer outcome implied.',
          'For practice, review three rotations and pause before leaving cover. Identify the next protected position and one fallback if it is occupied. In the Firing Range, rehearse a simple movement toward cover while keeping aim controlled. The coach can change the drill to suit your input and the technique’s current support.',
        ],
      },
    ],
    agenda: [
      'Spend 10 minutes checking input, platform, legend and the goal for the hour.',
      'Use 20 minutes to assess movement in the Firing Range or review decisions during live play.',
      'Spend 20 minutes applying one cue, such as choosing the next cover position before moving.',
      'Reserve 10 minutes for a repeatable drill and questions about the next solo practice session. Live match length may change this sample split.',
    ],
    prepare:
      'Share region, input, platform and preferred legends. For movement, have the Firing Range ready. For live Ranked, confirm legitimate party eligibility and keep your own account under your control. A short clip that includes the approach to a fight is more useful than the final elimination alone. Test Discord voice and explain any accessibility or input constraints.',
    faq: [
      [
        'Which Apex lesson is live?',
        'Play and Learn is the live Ranked format. Movement Course focuses on practice in the Firing Range.',
      ],
      [
        'Does every movement work on controller?',
        'No universal input compatibility is promised. Confirm your platform and input before agreeing the techniques to practise.',
      ],
      [
        'Can we focus on rotations?',
        'Yes, request rotations as the live lesson goal. Ring information, cover and fight selection are useful review topics.',
      ],
      [
        'Does booking fill my whole trio?',
        'No. These are coaching sessions with one coach. This page does not sell a full-trio service.',
      ],
      [
        'How many games are included?',
        'Apex training is hourly. The number of games depends on match length and the time spent explaining decisions.',
      ],
      [
        'Do you promise a specific result?',
        'No. The lesson supports learning and practice, with no guaranteed wins, placement or rank.',
      ],
    ],
  },
  'marvel-rivals': {
    title: 'Marvel Rivals Coaching and Hero Practice | Duoly',
    h1: 'Marvel Rivals coaching for your hero and role',
    lead: 'Book Marvel Rivals coaching for live learning or a focused hero lesson. Understand when to use your abilities and when your team is ready to follow.',
    format:
      'Play and Learn specifies a Grandmaster+ coach and is priced per Competitive match. Hero Coaching specifies a Grandmaster+ coach for an hour covering abilities, ultimate timing, positioning and matchups. Pick the hourly format for repeated hero-specific questions. Choose live learning when your main question is how those decisions change as a match unfolds.',
    sections: [
      {
        heading: 'Read the fight from your role',
        paragraphs: [
          'A Vanguard can create space that the rest of the team cannot yet use. A Duelist may take an angle without an escape route. A Strategist may spend key resources just before an opponent commits. A useful review connects those choices, asking who could see the target and which cooldowns were available before the engage began.',
          'Hero Coaching should stay grounded in the hero you play. A dive-oriented hero needs a plan for entering and leaving, while a backline hero needs safe sightlines and awareness of flanks. Team-Up abilities add another coordination question, but their current details can change. Confirm the patch and hero interaction rather than building a lesson around an outdated combination.',
        ],
      },
      {
        heading: 'Illustrative team fight: an ultimate without follow-up',
        paragraphs: [
          'Imagine using an ultimate to begin a fight while two teammates are returning from spawn. The animation may look strong and still leave the team unable to secure the space. Pause before the activation and count who can act, which enemy defensive resources are known and whether the objective demands an immediate contest. This is an original example, not a claimed customer replay or a verified coaching success.',
          'A small practice task is to review five ultimate uses and write the intended purpose before judging the outcome. Was it an engage, a response, a survival tool or an objective contest? Then check whether the teammates needed for that plan were present. Ask your coach for a hero-specific cue that helps you recognise the same situation sooner.',
        ],
      },
    ],
    agenda: [
      'Name your hero, role and one matchup or team-fight problem.',
      'For the hourly lesson, use 10 minutes to set context and 20 minutes to examine positioning and ability use.',
      'Spend 20 minutes practising a hero sequence or applying the cue in an appropriate game situation.',
      'Use the final 10 minutes for an ultimate checklist and a focused follow-up task. Per-match live coaching follows the game instead of this hourly split.',
    ],
    prepare:
      'Bring your platform, region, hero pool and current patch context. A recording should include the lead-up to fights, teammate positions and the objective. Pick two timestamps where you did not know whether to engage or reset. Confirm party and input compatibility for live play, check voice and keep personal notifications hidden during screen sharing.',
    faq: [
      [
        'Can I focus on Strategist or Vanguard?',
        'Yes, request your role and hero before the session and confirm the coach can cover them.',
      ],
      [
        'What does Hero Coaching cover?',
        'The catalog lists abilities, ultimate timing, positioning and matchups for one hero. Agree a narrow goal for the hour.',
      ],
      [
        'Is Play and Learn hourly?',
        'Marvel Rivals Play and Learn is per game. Hero Coaching is the separate hourly service.',
      ],
      [
        'Can we review Team-Up decisions?',
        'Ask the coach to include the current hero interaction. Team-Up details can change, so supply the patch context.',
      ],
      [
        'Do I need an advanced hero pool?',
        'No. One familiar hero gives the coach enough context to work on useful fundamentals.',
      ],
      [
        'Are prices tied to my rank?',
        'These training services are flat-priced. Legitimate queue compatibility still matters for a live match.',
      ],
    ],
  },
};
