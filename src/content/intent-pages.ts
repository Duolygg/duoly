export interface IntentPage {
  slug: string;
  gameSlug: string;
  title: string;
  h1: string;
  lead: string;
  description: (price: string) => string;
  service: string;
  services: Record<string, string>;
  facts: string[];
  format: string;
  sections: { heading: string; paragraphs: string[] }[];
  steps: string[];
  prepare: string[];
  faq: [string, string][];
}

export const intentPages: IntentPage[] = [
  {
    slug: 'play-with-someone',
    gameSlug: 'league-of-legends',
    title: 'Play League of Legends With Someone: Duo Partner | Duoly',
    h1: 'Play League of Legends with someone on your team',
    lead: 'Book a League of Legends duo partner for ARAM, normals or ranked duo. Choose your mode, name your role and play together on your own account.',
    description: (price) =>
      `Play League of Legends with someone ${price}. Book a duo partner for ARAM, normals or ranked. Choose your role and keep playing on your own account.`,
    service: 'norm',
    services: {
      duo1: 'Ranked Solo/Duo with a Diamond 4+ teammate. Choose a complementary role and coordinate lane pressure, recalls and objectives.',
      duo2: 'Ranked Solo/Duo with a Master+ teammate. Talk through the next objective and agree when to engage or reset.',
      aram: 'Play Howling Abyss together with random champions, shared engages and voice chat.',
      norm: 'Play Normal Draft with a Master+ teammate while trying a champion, a role or a different lane pairing.',
      swift:
        'Choose Swiftplay for a shorter Summoner’s Rift session with a teammate on voice.',
    },
    facts: [
      'ARAM, normals and ranked duo',
      'Top, jungle, mid, bot or support',
      'One teammate, your own account',
    ],
    format:
      'A teammate booking gives you someone to queue and communicate with for the games you select. Normal Draft suits champion practice, ARAM puts both players into one lane, and ranked duo adds shared calls in Solo/Duo. Each listed service is priced per game. For a structured lesson, replay analysis or a champion practice plan, choose the separate League coaching page.',
    sections: [
      {
        heading: 'Find a duo whose role fits yours',
        paragraphs: [
          'Bot and support make a natural pair because you share a lane. Tell your partner whether you prefer early trades, a steady farming lane or room to test a new champion. Name a small champion pool and agree when the support can roam.',
          'Jungle and mid can coordinate river movement and objective setups. Top players can ask for clear communication about pressure and recalls rather than constant visits. Whatever your role, useful calls are short: the enemy used a summoner spell, the wave is pushing, or you need time to reset. Your duo fills one seat. The rest of the team still queues normally.',
        ],
      },
      {
        heading: 'Choose ARAM, normals or ranked for the evening',
        paragraphs: [
          'ARAM is a good fit when you want company and team fights without selecting the same champion every game. Discuss rerolls and who can start a fight once the team is assembled. Normal Draft gives you more control over your role and champion, making it useful when trying a matchup without ranked pressure. Swiftplay offers another Summoner’s Rift option when you prefer a shorter format.',
          'Ranked duo needs compatible accounts on the same server. Share your current rank and preferred role before starting, then check the current client restrictions together. A provider’s listed rank describes the teammate tier; it does not override queue eligibility. You control your champion, decisions and account throughout the match. The booking pays for playing together, with no promised match result.',
        ],
      },
      {
        heading: 'Free teammates or a paid session?',
        paragraphs: [
          'Use Discord LFG communities, in-game friends and player clubs or community groups when you want free LoL teammates. Community clubs can organize outside the client. Write a specific post with your server, role, mode, language and usual playing time. After a good match, ask whether the other player wants to queue again. Free communities are the sensible starting point for building a regular group.',
          'A paid teammate suits a defined session with a chosen service and an order chat to arrange games. Pick coaching instead for detailed feedback on waves, jungle routes or a recording.',
        ],
      },
    ],
    steps: [
      'Choose ARAM, Normal Draft, Swiftplay or a ranked duo service and the number of games.',
      'Add your server, rank, roles and language so the session request describes the duo you want.',
      'Meet your teammate in the order chat, agree voice and champion choices, then invite each other in League.',
    ],
    prepare: [
      'Have your summoner name and server ready, including whether you play EUW or EUNE.',
      'Check your microphone and Discord, and mention whether you prefer relaxed chat or concise game calls.',
      'Keep your login private. Use the game client to invite your teammate and stay on your own account.',
    ],
    faq: [
      [
        'Can I book someone just for ARAM?',
        'Yes. ARAM Night is a per-game teammate service for Howling Abyss. Select ARAM rather than a ranked duo service.',
      ],
      [
        'Can I play Normal Draft with a partner?',
        'Yes. Normal Draft pairs you with a teammate for a full normal game, including trying a new role or champion.',
      ],
      [
        'Does ranked duo work across servers?',
        'Both accounts need to queue on the same server and meet the current ranked restrictions. Share your server and rank before starting.',
      ],
      [
        'Is this a League coaching session?',
        'This page is for playing together. Book League coaching for live learning, a VOD review or Champion Mastery.',
      ],
      [
        'How do I find free LoL teammates?',
        'Start with Discord LFG, community clubs or players you enjoyed meeting in-game. Include server, role and mode in your message.',
      ],
    ],
  },
  {
    slug: 'duo-partner',
    gameSlug: 'marvel-rivals',
    title: 'Marvel Rivals Duo Partner and Team-Up Sessions | Duoly',
    h1: 'Find a Marvel Rivals duo partner for your next match',
    lead: 'Book a Marvel Rivals duo partner for Quick Match or Competitive. Coordinate roles, practice a Team-Up and go into the next fight with someone on voice.',
    description: (price) =>
      `Book a Marvel Rivals duo partner ${price}. Play Quick Match or ranked, coordinate Team-Up abilities and choose a teammate who complements your role.`,
    service: 'quick',
    services: {
      duo1: 'Competitive with a Diamond+ teammate who fills a complementary role and coordinates the next fight.',
      duo2: 'Competitive with a Grandmaster+ teammate for clear engage, ultimate and reset calls.',
      teamup:
        'Play a compatible hero pair with a Team-Up ability in Quick Match or Competitive.',
      quick:
        'Quick Match or Arcade with a teammate to try heroes and enjoy relaxed games together.',
    },
    facts: [
      'Quick Match or Competitive',
      'Vanguard, Duelist or Strategist',
      'Team-Up Duo available',
    ],
    format:
      'Book one partner who joins your team for each selected match. Quick Match is the casual quick play option, while Competitive is the ranked option. Team-Up Duo focuses the booking on a compatible hero pair. Your partner fills one seat in the team; a duo booking does not supply an entire roster. Choose the mode and number of games before checkout.',
    sections: [
      {
        heading: 'Build a pairing around your role',
        paragraphs: [
          'A Vanguard and Strategist pairing starts with a simple agreement: when the front line moves, where will healing come from? Call the route into the objective and keep sightlines open. A Duelist and Strategist pairing needs the same clarity about distance. Chasing a target around a corner can separate the attacker from the teammate keeping them alive. Say when you are leaving support range.',
          'Two aggressive heroes need a shared entry and an exit. Decide who starts, who follows and which cooldown tells you to disengage. Backline players can ask their partner to watch flank routes. Share your main role and a comfortable alternative when booking.',
        ],
      },
      {
        heading: 'Make Team-Up synergies usable in a real fight',
        paragraphs: [
          'Choose Team-Up Duo when you want to play around a hero interaction together. Check the current in-game Team-Up panel before selecting the pair, because hero combinations and abilities change with updates. Agree which player supplies the enabling hero, who uses the shared ability and what call starts the sequence. Keep an alternative pair ready if your first choices are unavailable in the lobby.',
          'Example fight: your partner is ready to engage while you are returning from spawn. Calling the Team-Up immediately leaves only one of you in position. Instead, regroup, locate the objective and choose the angle where both players can act. Use one short countdown, then keep the next call about survival or follow-up. A coordinated reset gives the next fight a clearer starting point.',
        ],
      },
      {
        heading: 'Quick play practice or a ranked duo?',
        paragraphs: [
          'Quick Match gives the duo room to try a different role, learn a map route or settle into voice chat. Tell your partner if you are learning a hero so expectations match from the start. Arcade is another casual option under the Quick Match service. For Competitive, bring your current rank and platform and check the game’s party eligibility before entering the ranked queue together.',
          'A paid partner suits a planned block of games with a chosen service and clear communication. For free Marvel Rivals teammates, try Discord LFG communities or invite players you enjoyed meeting in Quick Match. Include platform, region, language and your preferred role. If you want a lesson on positioning or hero mechanics instead of a shared queue, the Marvel Rivals coaching page covers live learning and hourly Hero Coaching.',
        ],
      },
    ],
    steps: [
      'Pick Quick Match, Competitive duo or Team-Up Duo and choose your match count.',
      'Share your platform, region, language, rank and hero pool, including the role you want your partner to cover.',
      'Use the order chat to meet, check lobby compatibility and agree the first hero pairing before queueing.',
    ],
    prepare: [
      'Update the game and check the active Team-Up combinations in the hero selection screen.',
      'Bring two heroes you enjoy and name the role you prefer to play.',
      'Test voice and use your own account. Never send a password to arrange a game invite.',
    ],
    faq: [
      [
        'Can I book a duo for quick play?',
        'Yes. Choose Quick Match for casual games or Team-Up Duo when the hero interaction is the focus.',
      ],
      [
        'Can we play ranked together?',
        'Yes, through a Competitive duo service when your platform, accounts and ranks meet the current party rules.',
      ],
      [
        'Do you choose the Team-Up heroes for me?',
        'Agree the pair with your partner using the current in-game Team-Up panel. Share your hero pool so the choice suits both players.',
      ],
      [
        'Does a duo booking fill all six seats?',
        'No. A duo booking adds one teammate to your party. The remaining places are filled through your usual lobby and queue.',
      ],
      [
        'Is a duo the same as Hero Coaching?',
        'No. A duo is shared playing time. Hero Coaching is a focused hourly lesson on abilities, positioning and matchups.',
      ],
    ],
  },
  {
    slug: 'teammate',
    gameSlug: 'pokemon-unite',
    title: 'Pokemon Unite Teammate: Ranked and Casual Duo | Duoly',
    h1: 'Book a Pokemon Unite teammate for ranked or casual games',
    lead: 'Find a Pokemon Unite teammate for Ranked, Standard or Quick Battle. Plan lanes, pick complementary roles and coordinate the next objective together.',
    description: (price) =>
      `Book a Pokemon Unite teammate ${price}. Play ranked, Standard or Quick Battle with a duo partner. Plan lanes, roles and team compositions together.`,
    service: 'quick',
    services: {
      duo1: 'Ranked games with an Ultra+ teammate. Agree lanes, share objective calls and coordinate with the rest of the team.',
      duo2: 'Ranked games with a Master teammate. Plan lane pressure, rotations and team fights around the active map.',
      quick:
        'Standard or Quick Battle with a teammate while trying Pokemon, moves and different roles.',
    },
    facts: [
      'Pokemon Unite only',
      'Ranked, Standard or Quick Battle',
      'Ultra+ or Master ranked partners',
    ],
    format:
      'These bookings are for Pokemon Unite, the team battle game, with one partner joining your lobby. Ranked duo services and Standard or Quick Battle are priced per game. Other Pokemon games are not offered here: this is not a service for trading, mainline co-op adventures, Pokemon Go raids or card battles. Choose the specific Unite mode you want to play before setting your game count.',
    sections: [
      {
        heading: 'Choose roles that make a workable lane',
        paragraphs: [
          'A Defender and Attacker can share a clear division of jobs: one creates room and interrupts opponents while the other deals damage from a safer position. A Supporter and All-Rounder pairing can plan longer trades and agree when to commit. Speedsters often want central-area resources and room to reach a useful level before joining a lane. State your preferred path before anyone locks a pick.',
          'Your duo still plays inside a five-player team. Check what the other players have selected before adding another fragile damage dealer or a second central-area pick. A balanced composition needs ways to start fights, protect vulnerable teammates and deal damage. Comfort matters too: tell your partner which Pokemon and move sets you actually know, then choose a pairing that leaves both players with a useful job.',
        ],
      },
      {
        heading: 'Coordinate resources and objectives together',
        paragraphs: [
          'Lane partners need an agreement about experience. Decide who needs the next level breakpoint and avoid competing for every last hit without a plan. Call when you are returning to a goal zone or rotating away, because a teammate left alone needs to adjust. A useful duo call names the next action and location instead of explaining the last fight while the next one begins.',
          'Objective names and map details depend on the active arena. Check the current map, timers and match rules together rather than carrying a route from an older season into every game. Before a major contest, look at teammate positions, available Unite Moves and who can approach safely. Scoring on the far side of the map can leave the rest of the team short at the objective.',
        ],
      },
      {
        heading: 'Example duo plan for a ranked match',
        paragraphs: [
          'Start by naming a lane pairing and a backup pick for each player. During the opening, call your level progress and the opposing lane’s pressure. Before rotating, tell the other player whether you are moving together or leaving someone to defend. At the next objective, choose whether the pair is protecting the approach, pressuring an opponent or helping secure the objective. Keep the same plan visible to the rest of the team.',
          'After the match, agree one adjustment for the next queue, such as grouping earlier or sharing lane resources differently. Standard and Quick Battle suit testing a new Pokemon or a more relaxed session. Ranked needs accounts that meet the current party restrictions. Share your rank and region before starting. Booking a partner gives you someone to coordinate with; the match result still comes from the whole team’s play.',
        ],
      },
    ],
    steps: [
      'Select Ranked duo or Standard and Quick Battle, then choose how many games you want.',
      'Add your region, rank, preferred path, Pokemon pool and language to describe the session.',
      'Meet in the order chat, exchange game invites and settle the lane pairing before entering the lobby.',
    ],
    prepare: [
      'Have Pokemon Unite updated and your Trainer details ready for the invite.',
      'Choose a familiar Pokemon plus a backup, and check their held items and move choices.',
      'Use Discord LFG or in-game friend invites for free teammates. Book a paid session when you want defined playing time with a chosen service.',
    ],
    faq: [
      [
        'Is this for Pokemon Unite or another Pokemon game?',
        'Pokemon Unite only. Duoly does not offer other Pokemon games through these services.',
      ],
      [
        'Can I book a ranked teammate?',
        'Yes. Duo Plus and Duo Pro are ranked services with Ultra+ and Master teammates respectively, subject to current party eligibility.',
      ],
      [
        'Can we play Standard or Quick Battle?',
        'Yes. Choose Standard and Quick Battle for casual games, including trying a different Pokemon or role.',
      ],
      [
        'Does a teammate booking fill my whole squad?',
        'No. The services on this page add one partner. Your other teammates come from your party or the normal queue.',
      ],
      [
        'Do I give the teammate my account?',
        'No. You play on your own account and exchange game invites. Keep your password and account access private.',
      ],
    ],
  },
];

export const intentForGame = (slug: string) =>
  intentPages.find((page) => page.gameSlug === slug);
export const intentPath = (page: IntentPage) =>
  `/games/${page.gameSlug}/${page.slug}`;
