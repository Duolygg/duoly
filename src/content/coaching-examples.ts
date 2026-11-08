export interface SessionExample {
  goal: string;
  bring: string;
  steps: { at: string; title: string; text: string }[];
  takeaways: string[];
}

// Suggested lesson plans, never customer stories or a promised match length.
export const sessionExamples: Record<string, Record<string, SessionExample>> = {
  lol: {
    learn: {
      goal: 'Stop giving away the lane on a bad recall',
      bring: 'Your usual champion, role and one recall question.',
      steps: [
        {
          at: 'Before',
          title: 'Pick the focus',
          text: 'Tell your coach you want to recognize a safe reset before buying your first item.',
        },
        {
          at: 'Laning',
          title: 'Hear the decision',
          text: 'Play a ranked game together. Your coach explains the wave state and the enemy jungle information behind a recall call.',
        },
        {
          at: 'Reset',
          title: 'Make your read',
          text: 'Call whether the wave will crash or come back toward you, then compare your read with the coach’s.',
        },
        {
          at: 'After',
          title: 'Quick review',
          text: 'Revisit one recall and name the signal you will look for next game.',
        },
      ],
      takeaways: [
        'A wave-state cue for your next recall',
        'A jungle-information check before pushing',
        'One decision to repeat in your next game',
      ],
    },
    vod: {
      goal: 'Find out why a close lane turned into a lost map',
      bring: 'A recent full game and your role, champion and patch.',
      steps: [
        {
          at: '0 min',
          title: 'Set the question',
          text: 'Share a recent loss on Discord and point out a recall or roam you were unsure about.',
        },
        {
          at: '10 min',
          title: 'Pause the lane',
          text: 'Review trading, wave management and jungle tracking before the first important recall.',
        },
        {
          at: '30 min',
          title: 'Follow the map move',
          text: 'Compare a roam or objective rotation with the wave and vision information you had at the time.',
        },
        {
          at: '50 min',
          title: 'Choose three fixes',
          text: 'Finish the hour by turning the review into three priorities for your next games.',
        },
      ],
      takeaways: [
        'One laning habit to change',
        'One wave or recall correction',
        'One map-movement priority',
      ],
    },
    champ: {
      goal: 'Play one champion around its power spikes',
      bring: 'One champion and a matchup you struggle with.',
      steps: [
        {
          at: '0 min',
          title: 'Name the matchup',
          text: 'Agree which enemy ability changes when your champion can trade.',
        },
        {
          at: '10 min',
          title: 'Connect the tools',
          text: 'Walk through a combo, a build choice and the level or item spike that makes the trade stronger.',
        },
        {
          at: '30 min',
          title: 'Practice live',
          text: 'Apply the matchup plan in a live game, explaining your next trade before committing.',
        },
        {
          at: '50 min',
          title: 'Review the pattern',
          text: 'Use the end of the hour to revisit the combo and matchup cues as the game allows.',
        },
      ],
      takeaways: [
        'A matchup cue for when to trade',
        'A combo to practice on your champion',
        'A level or item spike to play around',
      ],
    },
  },
  val: {
    learn: {
      goal: 'Enter a site with someone ready to trade',
      bring: 'Your agent, region and one round-planning question.',
      steps: [
        {
          at: 'Before',
          title: 'Pick your role',
          text: 'Agree whether you will take entry, support with utility or cover the next angle.',
        },
        {
          at: 'Opening',
          title: 'Hear the plan',
          text: 'Play a Competitive game together while your coach explains routes, utility timing and trade spacing.',
        },
        {
          at: 'Later',
          title: 'Apply one cue',
          text: 'Name the teammate who can trade your peek before taking first contact.',
        },
        {
          at: 'After',
          title: 'Quick review',
          text: 'Compare one coordinated entry with one isolated peek and choose a cue for next game.',
        },
      ],
      takeaways: [
        'A cue for tradeable spacing',
        'A utility timing to communicate',
        'One round decision to practice next',
      ],
    },
    vod: {
      goal: 'Understand the decision before the missed shot',
      bring: 'A recent match recording with HUD and audio.',
      steps: [
        {
          at: '0 min',
          title: 'Choose the rounds',
          text: 'Share your match on Discord and name an attack or defense problem.',
        },
        {
          at: '10 min',
          title: 'Pause before contact',
          text: 'Review positioning and the information you had before a peek. Check who could trade.',
        },
        {
          at: '30 min',
          title: 'Trace the utility',
          text: 'Compare the timing of a smoke, flash or recon tool with the moment your team took space.',
        },
        {
          at: '50 min',
          title: 'Build the next-game cue',
          text: 'Summarize the positioning and utility decisions you want to check in your next recording.',
        },
      ],
      takeaways: [
        'A positioning adjustment for first contact',
        'A utility timing to test',
        'A question to check in your next VOD',
      ],
    },
    aim: {
      goal: 'Keep your crosshair ready before you peek',
      bring: 'Your usual sensitivity and an example of a difficult angle.',
      steps: [
        {
          at: '0 min',
          title: 'Check the habit',
          text: 'Show how you clear an angle so the coach can assess crosshair height and movement.',
        },
        {
          at: '10 min',
          title: 'Place, then peek',
          text: 'Practice keeping the crosshair at head height and clearing one angle at a time.',
        },
        {
          at: '30 min',
          title: 'Control the stop',
          text: 'Work on peeking and counter-strafing, checking that movement has stopped before the shot.',
        },
        {
          at: '50 min',
          title: 'Set your routine',
          text: 'Combine the exercises into a training routine that fits your current mechanics.',
        },
      ],
      takeaways: [
        'A crosshair-placement exercise',
        'A movement-stop check for your peeks',
        'A personalized warm-up routine',
      ],
    },
  },
  rl: {
    learn: {
      goal: 'Stay useful as the second player in Doubles',
      bring: 'Your region, usual rank and one positioning question.',
      steps: [
        {
          at: '0 min',
          title: 'Set the focus',
          text: 'Agree to watch your distance behind the first player.',
        },
        {
          at: '10 min',
          title: 'Hear the read',
          text: 'Play Doubles while your coach explains challenges, cover and boost routes.',
        },
        {
          at: '30 min',
          title: 'Make your call',
          text: 'Say whether you can challenge or need to cover a clear before committing.',
        },
        {
          at: '50 min',
          title: 'Quick review',
          text: 'Between games, compare a recoverable position with a double commit.',
        },
      ],
      takeaways: [
        'A second-player positioning cue',
        'A boost route to keep you in play',
        'One challenge decision to repeat',
      ],
    },
    mech: {
      goal: 'Recover after an aerial without leaving the play',
      bring: 'Your input and an aerial or recovery you struggle with.',
      steps: [
        {
          at: '0 min',
          title: 'Show the touch',
          text: 'Demonstrate a simple aerial and how you land afterward.',
        },
        {
          at: '10 min',
          title: 'Control the approach',
          text: 'Work on the aerial setup and contact before adding speed.',
        },
        {
          at: '30 min',
          title: 'Link the recovery',
          text: 'Practice landing on your wheels and driving toward a useful position.',
        },
        {
          at: '50 min',
          title: 'Keep the pack',
          text: 'Choose a training pack and a controlled repetition to use in solo practice.',
        },
      ],
      takeaways: [
        'An aerial setup to repeat',
        'A landing and recovery cue',
        'A training pack for practice',
      ],
    },
  },
  fn: {
    learn: {
      goal: 'Reach the next zone with a route back to cover',
      bring: 'Your input, region and Builds or Zero Build preference.',
      steps: [
        {
          at: '0 min',
          title: 'Pick the focus',
          text: 'Agree to work on rotations during live Ranked play.',
        },
        {
          at: '10 min',
          title: 'Hear the route',
          text: 'Your coach explains the next protected position and when to move.',
        },
        {
          at: '30 min',
          title: 'Call the next cover',
          text: 'Name a route and a fallback before leaving your current position.',
        },
        {
          at: '50 min',
          title: 'Quick review',
          text: 'Between matches, revisit a fight that helped or delayed the rotation.',
        },
      ],
      takeaways: [
        'A cover-first rotation cue',
        'A fallback to check before moving',
        'One fight-selection question',
      ],
    },
    build: {
      goal: 'Edit, take a shot and return to cover',
      bring: 'Your input and a box-fight situation to practice.',
      steps: [
        {
          at: '0 min',
          title: 'Show your edit',
          text: 'Load Creative and demonstrate an edit you use in box fights.',
        },
        {
          at: '10 min',
          title: 'Own the setup',
          text: 'Work on piece control and a protected opening before taking the shot.',
        },
        {
          at: '30 min',
          title: 'Repeat the sequence',
          text: 'Edit, shoot and reset slowly enough to check your exposure.',
        },
        {
          at: '50 min',
          title: 'Set the exercise',
          text: 'Choose a Creative exercise and focus on controlled repetitions before speed.',
        },
      ],
      takeaways: [
        'A piece-control setup',
        'An edit and reset sequence',
        'A Creative exercise to repeat',
      ],
    },
  },
  apex: {
    learn: {
      goal: 'Rotate before another squad owns the route',
      bring:
        'Your legend, input, platform and region, plus one recent rotation question.',
      steps: [
        {
          at: '0 min',
          title: 'Set the question',
          text: 'Agree to focus on the timing of your next rotation.',
        },
        {
          at: '10 min',
          title: 'Hear the decision',
          text: 'Play Ranked while your coach explains ring information, cover and fight selection.',
        },
        {
          at: '30 min',
          title: 'Name the fallback',
          text: 'Call the next protected position and an alternative if it is occupied.',
        },
        {
          at: '50 min',
          title: 'Quick review',
          text: 'Between games, identify the signal that made one route safer than another.',
        },
      ],
      takeaways: [
        'A rotation-timing cue',
        'A next-cover check',
        'One fallback decision to practice',
      ],
    },
    move: {
      goal: 'Use movement to reach cover with control',
      bring: 'Your input and platform, with the Firing Range ready.',
      steps: [
        {
          at: '0 min',
          title: 'Check your setup',
          text: 'Show your movement so the coach can choose techniques supported by your input.',
        },
        {
          at: '10 min',
          title: 'Build the route',
          text: 'Practice a slide jump toward cover while controlling your aim.',
        },
        {
          at: '30 min',
          title: 'Add a variation',
          text: 'Work on wall bounces or a supported tap-strafe variation in the Firing Range.',
        },
        {
          at: '50 min',
          title: 'Keep the drill',
          text: 'Link movement and positioning into a short route you can repeat.',
        },
      ],
      takeaways: [
        'A slide-jump route',
        'An input-appropriate movement cue',
        'A Firing Range practice drill',
      ],
    },
  },
  tft: {
    econ: {
      goal: 'Choose when your board needs gold now',
      bring:
        'A full recording with shop, bench and items, plus the set and patch.',
      steps: [
        {
          at: '0 min',
          title: 'Set the question',
          text: 'Find a roll or level decision you want to understand.',
        },
        {
          at: '10 min',
          title: 'Read stage two',
          text: 'Compare your board, items, health and economy before committing to a composition.',
        },
        {
          at: '30 min',
          title: 'Compare the spend',
          text: 'Review rolling versus leveling and how a different shop could change the plan.',
        },
        {
          at: '50 min',
          title: 'Build a checklist',
          text: 'Summarize what to check before saving, rolling or leveling in your next game.',
        },
      ],
      takeaways: [
        'A composition-pivot cue',
        'A board-strength check before spending',
        'An economy decision checklist',
      ],
    },
  },
  mr: {
    learn: {
      goal: 'Start the fight when your team can follow',
      bring: 'Your main hero and a fight you want to understand.',
      steps: [
        {
          at: 'Before',
          title: 'Set the role',
          text: 'Agree whether your hero creates space, follows an engage or supports from the back line.',
        },
        {
          at: 'Opening',
          title: 'Hear the calls',
          text: 'Play a Competitive match together while your coach explains engages, resets and positioning.',
        },
        {
          at: 'Regroup',
          title: 'Check the follow-up',
          text: 'Count who can join before committing an ultimate, and call your plan on voice.',
        },
        {
          at: 'After',
          title: 'Quick review',
          text: 'Revisit one fight and identify the teammate position that changed the decision.',
        },
      ],
      takeaways: [
        'A teammate-readiness check',
        'An ultimate call to communicate',
        'One engage or reset cue',
      ],
    },
    hero: {
      goal: 'Get more from one hero’s abilities and ultimate',
      bring: 'One hero, your platform and a difficult matchup.',
      steps: [
        {
          at: '0 min',
          title: 'Choose the matchup',
          text: 'Name the opponent and the situation that makes your hero uncomfortable.',
        },
        {
          at: '10 min',
          title: 'Map your options',
          text: 'Work through ability use and positioning, including an escape route when an engage fails.',
        },
        {
          at: '30 min',
          title: 'Plan the ultimate',
          text: 'Compare using your ultimate to engage, survive or contest, with teammate positions and enemy resources in view.',
        },
        {
          at: '50 min',
          title: 'Keep a hero checklist',
          text: 'Summarize the matchup cue, ability sequence and ultimate timing to practice next.',
        },
      ],
      takeaways: [
        'A positioning cue for your matchup',
        'An ability sequence to rehearse',
        'An ultimate-readiness checklist',
      ],
    },
  },
};
