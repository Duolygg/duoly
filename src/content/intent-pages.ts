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
  formatHeading?: string;
  stepsHeading?: string;
  prepareHeading?: string;
  faqHeading?: string;
  format: string;
  /** Optional intro above the price cards; falls back to the shared answer. */
  pricesIntro?: string;
  /**
   * When the price cards were last read out of the checkout calculator. This is
   * the page's single dated price claim, so the prose never carries a second one.
   */
  pricesChecked?: string;
  sections: { heading: string; paragraphs: string[] }[];
  steps: string[];
  prepare: string[];
  faq: [string, string][];
  /** Closing call-to-action text; may use guide price tokens. */
  closing?: string;
  /**
   * Per-game accent for chips and rules on the teammate pages, as an `oklch`
   * or hex color inside the existing dark palette. Left out keeps the purple.
   */
  accent?: string;
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
      'A Duoly teammate booking is a paid session where one reviewed League of Legends player joins your games on your own account. The teammate queues with you for the number of games you select, from 1 game up to 10 games. Duo Pro is the ranked Solo/Duo service with a Master+ teammate. For example, a Gold player on EUW pays {{lolPro}} per game for Duo Pro in November 2026. Bundles lower the total: 3 games get {{pct3}} off, 5 games get {{pct5}} off and 10 games get {{pct10}} off. ARAM Night, Normal Draft and Swiftplay each cost {{lolAram}} per game. Every booking opens an order chat on Duoly, where you agree on roles, voice and a start time before the first game. You keep control of your champion, your decisions and your account. For a structured lesson or a replay review, choose League coaching from Duoly instead.',
    sections: [
      {
        heading: 'Which League roles make a good duo?',
        paragraphs: [
          'A good League duo is a pair of roles which share a lane or a side of the map. Bot lane and support are the classic pair, because both players fight in the same lane from the first minute. The support decides when to trade, and the ADC decides when to farm safely. Jungle and mid are the second strong pair, since both players control river vision and early objectives.',
          'Top lane gains the least from a duo, so a top laner should ask for calls about pressure. For example, a Gold support on EUW books Duo Pro for {{lolPro}} per game in 2026 and asks for an ADC who trades on the engage. Duo Plus costs {{lolPlus}} per game at the same rank, with a Diamond 4+ teammate instead of a Master+ one. Booking 3 games with the same partner gets {{pct3}} off. Useful duo calls stay short: a summoner spell is down or the wave is pushing. Your duo fills 1 seat, and the other 3 players still come from the normal queue.',
        ],
      },
      {
        heading: 'Which League mode should you book: ARAM, normals or ranked?',
        paragraphs: [
          'ARAM is the Howling Abyss mode with random champions, one lane and constant team fights. ARAM Night costs {{lolAram}} per game, and 3 games cost {{lolAram3}} with the {{pct3}} discount in November 2026. Normal Draft is the better pick for practicing a champion or a new role with no LP on the line. Swiftplay is the shorter Summoner’s Rift mode for a quick evening session with a teammate on voice.',
          'Ranked Solo/Duo is the mode where your LP is on the line, and Duo Pro is the service built for it at {{lolPro}} per game for Gold on EUW. Both accounts queue from the same server, so share your server and rank in the order chat before the first game. For example, a Gold player on EUW books 3 Duo Pro games for {{lolPro3}} with the {{pct3}} bundle discount and names the lane they want covered. Duo Plus is the cheaper ranked tier at {{lolPlus}} per game with a Diamond 4+ teammate. You control your champion, your decisions and your account in every match, and the booking pays for playing together.',
        ],
      },
      {
        heading: 'How much does a League duo cost in 2026?',
        paragraphs: [
          'Duo Pro is the ranked League service with a Master+ teammate, priced per game by your own rank. Every price here comes from the Duoly checkout calculator. We found these numbers by running the calculator on 7 November 2026. A Gold player on EUW pays {{lolPro}} per game for Duo Pro. An Iron player pays {{lolProIron}} per game, and a Diamond player pays {{lolProDiamond}} per game, so the Duo Pro price rises with your own rank.',
          'Bundles cut the total for every rank. For example, a Gold player pays {{lolPro3}} for 3 games with {{pct3}} off, {{lolPro5}} for 5 games with {{pct5}} off and {{lolPro10}} for 10 games with {{pct10}} off. Casual modes keep one flat price, so ARAM Night, Normal Draft and Swiftplay each cost {{lolAram}} per game for every rank. Prices in US dollars use the daily exchange rate from the European Central Bank plus 1%. Coaching has separate prices on the [League of Legends coaching page](/games/league-of-legends/coaching), and the [League of Legends hub](/games/league-of-legends) lists every service for the game.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total game count first, before checkout. Duo Pro is the ranked option with a Master+ teammate, and 3 games at Gold on EUW cost {{lolPro3}} with the {{pct3}} bundle discount in November 2026.',
      'Add your server, rank, main role and language. The written request is the first thing your new teammate reads. For example, name EUW or EUNE, your rank and the lane you want covered.',
      'Meet your teammate in the order chat. Agree on voice using Discord, settle champions, then invite each other from the League client. A single Duo Pro game costs {{lolPro}} at the same rank, and 5 games get {{pct5}} off with the same teammate tier.',
    ],
    prepare: [
      'A Riot ID is the in-game name plus a tagline, for example Name#EUW. Riot IDs from Riot Games replaced summoner names in 2023. Your teammate needs the full Riot ID to send an invite.',
      'Pick the right server before booking, because EUW, EUNE, NA and the other Riot servers keep separate ranked ladders.',
      'Test your microphone and your Discord audio before the first game, and tell your teammate whether you prefer relaxed chat or short game calls.',
      'Bring a small champion pool, for example 2 champions for your main role and 1 backup champion for a second role.',
      'Keep your login private. Invite your teammate from the League client, stay on your own account and never share a password with anyone.',
      'Agree on 1 call for a reset before the first queue, for example the retreat ping followed by a recall.',
    ],
    faq: [
      [
        'Can I book someone just for ARAM?',
        'Yes. ARAM Night is a per-game teammate service for Howling Abyss at {{lolAram}} per game in 2026.',
      ],
      [
        'Can I play Normal Draft with a partner?',
        'Yes. Normal Draft pairs you with a teammate for a full normal game, including a new role or champion.',
      ],
      [
        'Does ranked duo work across servers?',
        'No: both accounts queue from the same server, so pick EUW, EUNE, NA or your own at checkout and name it in the order chat before the first game.',
      ],
      [
        'Is this a League coaching session?',
        'No. Duo sessions are for playing together. Book League coaching for live learning, a VOD review or Champion Mastery.',
      ],
      [
        'How do I find free LoL teammates?',
        'For example, start with the League of Legends Discord, RiftQ or players you met in game. Include server, role and mode in your message.',
      ],
    ],
    closing:
      'Duo Pro is the ranked League session with a Master+ teammate from Duoly, at {{lolPro}} per game for Gold on EUW in 2026, and 3 games cost {{lolPro3}} as one bundle. ARAM Night, Normal Draft and Swiftplay each cost {{lolAram}} per game at every rank instead, so only the ranked services move with your own rank. For example, ask for a Master+ ADC when you main support, agreed using Discord.',
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
      'A Duoly duo booking is a paid session where one reviewed Marvel Rivals player joins your team for each match you select, from 1 match up to 10 matches. Duo Pro is the Competitive service with a Grandmaster+ teammate at {{mrPro}} per match, and Duo Plus is the Diamond+ tier at {{mrPlus}}. For example, a Platinum player in Europe pays {{mrPro}} per match for Duo Pro in November 2026. Bundles lower the total: 3 matches get {{pct3}} off, 5 matches get {{pct5}} off and 10 matches get {{pct10}} off. Quick Match and Arcade cost {{mrQuick}} per match, and Team-Up Duo costs {{mrTeamup}} per match. Your partner fills 1 of the 6 seats, so the other 4 players come from your party or the normal queue. Every booking opens an order chat on Duoly, where you agree on roles, voice and a start time before the first match. For a lesson on one hero, choose Hero Coaching from Duoly instead.',
    sections: [
      {
        heading: 'Which Marvel Rivals roles make a good duo?',
        paragraphs: [
          'A good Marvel Rivals duo is a pair of roles with one clear plan for each fight. Vanguard and Strategist is the steadiest pair: the Vanguard holds the front line, and the Strategist keeps the Vanguard alive from a safe angle. Agree on the route into the objective first, and call when the front line moves forward. Duelist and Strategist needs the same clarity about distance, because a Duelist chasing a target around a corner leaves healing range.',
          'Two Duelists need a shared entry and an exit. Decide who starts, who follows and which cooldown means a reset. For example, a Platinum Strategist in Europe books Duo Pro from Duoly for {{mrPro}} per match in 2026 and asks for a Vanguard who holds the front line. Duo Plus costs {{mrPlus}} per match at the same rank. Share your main role and one comfortable second role when booking.',
        ],
      },
      {
        heading: 'How do you use a Team-Up in a real fight?',
        paragraphs: [
          'A Team-Up is a Marvel Rivals hero pairing where one hero gives the partner hero an extra ability. Team-Up Duo is the Duoly service built around one pairing, with a Grandmaster+ teammate at {{mrTeamup}} per match in November 2026. Check the current Team-Up panel in hero selection first, because pairings change between seasons. Agree which player brings the anchor hero, who triggers the shared ability and which call starts the fight.',
          'For example, your partner is ready to engage while you walk back from spawn. Calling the Team-Up right away leaves only 1 of 2 players in position. Regroup instead, find the objective and choose an angle where both heroes can act. Use one short countdown, then keep the next call about survival. Three Team-Up Duo matches cost {{mrTeamup3}} with the {{pct3}} bundle discount from Duoly.',
        ],
      },
      {
        heading: 'Should you book Quick Match or a Competitive duo?',
        paragraphs: [
          'Quick Match is the casual Marvel Rivals mode for trying a new role, learning a map route or settling into voice chat with no rank on the line. Quick Match and Arcade cost {{mrQuick}} per match on Duoly, and 3 matches cost {{mrQuick3}} with {{pct3}} off in November 2026. Tell your partner first if you are learning a hero, so expectations match from the start.',
          'Competitive is the ranked Marvel Rivals mode, and Duo Pro is the service built for it with a Grandmaster+ teammate. First, bring your rank and your platform, because Competitive prices follow your own rank while Quick Match does not. For example, a Platinum player in Europe pays {{mrPro}} per match for Duo Pro, and 3 matches cost {{mrPro3}} with the {{pct3}} bundle discount. Duo Apex is the Celestial+ tier above it. You control your hero, your decisions and your account in every match, and the booking pays for playing together.',
        ],
      },
      {
        heading: 'How much does a Marvel Rivals duo cost in 2026?',
        paragraphs: [
          'Duo Pro is the Competitive Marvel Rivals service with a Grandmaster+ teammate, priced per match by your own rank. Every price here comes from the Duoly checkout calculator. We found these numbers by running the calculator on 7 November 2026. A Platinum player in Europe pays {{mrPro}} per match for Duo Pro, and a Gold player pays {{mrProGold}} per match, so the Duo Pro price rises with your own rank.',
          'Bundles cut the total for every rank. For example, a Platinum player pays {{mrPro3}} for 3 matches with {{pct3}} off, {{mrPro5}} for 5 matches with {{pct5}} off and {{mrPro10}} for 10 matches with {{pct10}} off. Quick Match and Arcade keep one flat price of {{mrQuick}} per match for every rank. Prices in US dollars use the daily exchange rate from the European Central Bank plus 1%. Hero Coaching has separate prices on the [Marvel Rivals coaching page](/games/marvel-rivals/coaching), and the [Marvel Rivals hub](/games/marvel-rivals) lists every service for the game.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total match count first, before checkout. Duo Pro is the Competitive option with a Grandmaster+ teammate, and 3 matches at Platinum in Europe cost {{mrPro3}} with the {{pct3}} bundle discount in November 2026.',
      'Add your platform, region, rank, language and hero pool. For example, ask your partner to cover Vanguard while you play Strategist. Name a voice language too, such as English or German, so calls work from the first fight.',
      'Meet your partner in the order chat. Check lobby compatibility, agree on voice using Discord or in-game chat, then pick the first hero pairing before queueing. A single Duo Pro match costs {{mrPro}}, and 5 matches get {{pct5}} off.',
    ],
    prepare: [
      'A hero pool is the short list of heroes you play well. First, name 2 heroes plus your preferred role, for example 2 Strategists and 1 Vanguard as a backup.',
      'Update the game client first and check the active Team-Up pairings in the hero selection screen, because Team-Up pairings from NetEase Games change between seasons.',
      'Share your platform. Marvel Rivals has run on PC, PlayStation 5 and Xbox Series X|S since the December 2024 launch, and cross-platform rules differ between Quick Match and Competitive. Your partner then checks the same lobby settings.',
      'Test your microphone using Discord or in-game voice before the first match. Tell your partner whether you prefer relaxed chat or short fight calls.',
      'Keep your login private, stay on your own account and never send a password.',
      'Agree on 1 call for a reset before the first queue, for example "back to spawn" after 2 teammates go down.',
    ],
    faq: [
      [
        'Can I book a duo for quick play?',
        'Yes. Choose Quick Match at {{mrQuick}} per match for casual games, or Team-Up Duo at {{mrTeamup}} when the hero pairing is the focus.',
      ],
      [
        'Can we play ranked together?',
        'Yes: Duo Pro is the Competitive service at {{mrPro}} per match for Platinum in Europe, with a Grandmaster+ teammate who calls the engage and the reset.',
      ],
      [
        'Do you choose the Team-Up heroes for me?',
        'No. Agree on the pair with your partner using the current in-game Team-Up panel, for example after sharing hero pools.',
      ],
      [
        'Does a duo booking fill all six seats?',
        'No. A duo booking adds 1 teammate to your party, and the other seats come from your lobby and queue.',
      ],
      [
        'Is a duo the same as Hero Coaching?',
        'No. A duo is shared playing time, and Hero Coaching is a focused hourly lesson on abilities and positioning.',
      ],
    ],
    closing:
      'Duo Pro is the Competitive Marvel Rivals session with a Grandmaster+ teammate from Duoly, at {{mrPro}} per match for Platinum in Europe in 2026, and 3 matches cost {{mrPro3}} as one bundle. Quick Match and Arcade stay {{mrQuick}} per match at every rank instead, and Team-Up Duo costs {{mrTeamup}}. For example, ask for a Vanguard who holds the front line while you play Strategist, agreed using Discord.',
  },
  {
    slug: 'teammate',
    gameSlug: 'pokemon-unite',
    formatHeading: 'What is a Pokemon Unite teammate booking?',
    stepsHeading: 'How do you book a Pokemon Unite teammate?',
    prepareHeading: 'How should you prepare for a Pokemon Unite session?',
    faqHeading: 'Questions before you queue?',
    closing:
      'A Pokemon Unite booking from Duoly is one partner for the games you choose. First, pick your mode, your lane and a Pokemon you enjoy. For example, ask for a Defender beside your Attacker. Then agree on voice using Discord and your first objective call in the order chat.',
    title: 'Pokemon Unite Teammate: Ranked and Casual Duo | Duoly',
    h1: 'Book a Pokemon Unite teammate for ranked or casual games',
    lead: 'Find a Pokemon Unite teammate for Ranked, Standard or Quick Battle. Plan lanes, pick complementary roles and coordinate the next objective together.',
    description: (price) =>
      `Book a Pokemon Unite teammate ${price}. Play ranked, Standard or Quick Battle with a duo partner. Plan lanes, roles and team compositions together.`,
    service: 'quick',
    services: {
      duo1: 'Ranked games with an Ultra+ teammate. Agree on lanes, share objective calls and coordinate with the rest of the team.',
      duo2: 'Ranked games with a Master teammate. Plan lane pressure, rotations and team fights around the map.',
      quick:
        'Standard or Quick Battle with a teammate while trying Pokemon, moves and different roles.',
    },
    facts: [
      'Pokemon Unite only',
      'Ranked, Standard or Quick Battle',
      'Ultra+ or Master ranked partners',
    ],
    format:
      'A Pokemon Unite teammate booking is one paid partner who joins your lobby for the games you choose, on a separate account. Duo Plus pairs you with an Ultra+ teammate, Duo Pro pairs you with a Master teammate from Duoly, and Standard and Quick Battle is the casual option for trying Pokemon, moves and roles without ranked pressure. First, pick the mode and the number of games. A Unite team holds 5. Your partner fills 1 seat, so three teammates still arrive from the normal queue. Second, use the order chat to agree on lanes, voice using Discord and a start time. For example, an Attacker can ask for a Defender who holds space while the lane farms toward the next move upgrade. Finally, check the other picks before locking in, so the duo leaves room for the central area and a workable front line. The booking covers Unite only, and prices start at {{puPlus}} per game in 2026.',
    pricesChecked: '2026-11-08',
    pricesIntro:
      'Pokemon Unite teammate prices from Duoly start at {{puPlus}} per game and rise with your own rank. For Duo Pro, a player ranked Expert in Europe pays {{puPro}}, and Duo Plus brings an Ultra+ teammate for less. Standard and Quick Battle keeps one flat price of {{puQuick}} for every rank. First, open the rank list on the card, because Beginner and Legend do not pay the same. Bundles then cut the total: 3 games get {{pct3}} off, 5 games get {{pct5}} off and 10 games get {{pct10}} off. For example, 3 Duo Pro games at Expert cost {{puPro3}}. Every booking adds one partner, and lanes, voice using Discord and a start time are agreed in the order chat.',
    sections: [
      {
        heading: 'Which roles work well together in lane?',
        paragraphs: [
          'A Defender and Attacker is the clearest Unite lane pairing: the Defender interrupts an engage while the Attacker deals damage from a safe position. Pokemon Unite groups every Pokemon into 5 roles in 2026: Attacker, Defender, Speedster, All-Rounder and Supporter. A Supporter can do a similar job to a Defender, depending on the moves you choose. First, start with picks you know well enough to use under pressure. For example, say early whether you need farm to reach an evolution before contesting an objective.',
          'Second, agree on top path, bottom path or central area before locking in, then look at the other three picks. A Unite team holds 5. Taking central-area resources from the player who needs the farm breaks the whole composition. Finally, call a retreat before leaving a lane partner alone at a goal zone, and keep calls short enough to act on using Discord. A teammate from Duoly can coordinate lanes; nobody can promise the result of a five-player match.',
        ],
      },
      {
        heading: 'How do we plan for Rayquaza and other objectives?',
        paragraphs: [
          'An objective call is a plan naming where the team meets and what has to happen before anyone commits. On the standard map, Rayquaza appears when the clock reaches 2:00. The last two minutes therefore decide a lot of games, since scoring counts double. First, check teammate positions, Unite Moves and enemy pressure before starting the objective or chasing a knockout.',
          'Check the active arena together, since the map and mode decide which objectives exist in 2026. For example, arriving early means little when your damage dealer is still walking back from spawn or the front line has spent every cooldown. Second, call the rotation while your partner still has time to finish farming and move safely. A Defender can watch the approach while an Attacker keeps a safe damage angle. Finally, agree one change between games using Discord, such as grouping earlier or holding a Unite Move, and a teammate from Duoly can carry the call for you.',
        ],
      },
      {
        heading: 'Should we play Ranked or a casual mode first?',
        paragraphs: [
          'Standard and Quick Battle is the better starting point when you want to try a role or get used to making calls with a new partner, at {{puQuick}} per game for every rank. Ranked makes more sense once you know your Pokemon and have held items ready. First, share your rank and region at checkout, because Ranked prices follow your own rank while the casual modes do not.',
          'For example, a player ranked Expert in Europe pays {{puPro}} per game for Duo Pro, and 3 games cost {{puPro3}} after the {{pct3}} bundle discount. Duo Plus brings an Ultra+ teammate for less, and Duo Apex brings a Legend player for more, so the tier is the choice rather than the mode. Second, choose the game count around the time you actually have, and leave room to talk between queues. A Ranked match runs 10:00. Finally, a teammate from Duoly coordinates lanes and objectives with you using Discord voice, and the [Pokemon Unite hub](/games/pokemon-unite) lists every service for the game.',
        ],
      },
    ],
    steps: [
      'A Pokemon Unite booking is one partner plus a game count, so start with the mode: Ranked, Standard or Quick Battle. Bookings run from 1 game up to 10. The price cards show every service, and ranked prices follow your own rank.',
      'Share your rank, region, language and preferred lane. Ask for a complementary role, such as a Defender alongside your Attacker, then pick the game count. For example, 3 games take {{pct3}} off the total.',
      'Finally, meet in the order chat, exchange Trainer details and agree on voice using Discord. A teammate from Duoly joins on a separate account, so keep passwords private and send the game invite yourself.',
    ],
    prepare: [
      'Preparation for a Pokemon Unite session is a short checklist: an updated client, Trainer details and one lane preference.',
      'Update Pokemon Unite and have your Trainer details ready, because a lobby invite needs the exact name.',
      'Bring a familiar Pokemon and a backup in case another player locks the same one, for example 1) an Attacker you trust and 2) a Defender for the lane.',
      'Check held items and battle items before the first lobby. Each Pokemon carries 3. Swapping items late in a series only wastes queue time.',
      'Tell your partner which lane you prefer and whether you want relaxed chat or short objective calls using Discord.',
      'Agree on a retreat call and an objective call, then check which arena the mode is using in 2026.',
      'A teammate from Duoly joins on a separate account, so nobody ever needs your login or your password.',
      'Finally, plan around a 10-minute Ranked match and leave room to talk between queues.',
    ],
    faq: [
      [
        'Is this only for Pokemon Unite?',
        'A booking from Duoly covers Pokemon Unite Ranked, Standard and Quick Battle only. Other Pokemon games, trading and card battles sit outside the service.',
      ],
      [
        'How much does it cost?',
        'Standard and Quick Battle costs {{puQuick}}. Ranked prices follow your rank: for example, Duo Pro costs {{puPro}} per game for players ranked Expert in Europe. Open the rank list above to check your own price, and bundles of 3, 5 and 10 games take {{pct3}}, {{pct5}} and {{pct10}} off.',
      ],
      [
        'Can I ask for a particular lane partner?',
        'First, share your preferred lane and Pokemon before queueing, then ask for a complementary role such as a Defender to make space for your Attacker. Agree on the lane plan using Discord before the first queue.',
      ],
      [
        'Where can I find free teammates?',
        'Try friends, in-game invites or a Pokemon Unite Discord LFG group. Include your rank, region and preferred lane so people can tell whether the lobby will work.',
      ],
      [
        'Does my partner need my login?',
        'Nobody needs your login, because Trainer details and game invites keep both players on separate accounts. A booking adds one teammate, and the remaining seats come from your party or the normal queue.',
      ],
    ],
  },
  {
    slug: 'lfg',
    gameSlug: 'valorant',
    title: 'Valorant LFG: Find Teammates for Competitive | Duoly',
    h1: 'Valorant LFG: find teammates for Competitive tonight',
    lead: 'Find Valorant teammates for Competitive, Swiftplay or Unrated. Start with the free LFG servers, or book a reviewed teammate who fills the role your agent pool is missing.',
    description: (price) =>
      `Find Valorant teammates free in LFG servers or book a reviewed duo ${price}. Compare Competitive, Swiftplay and Unrated, then queue on your account.`,
    service: 'duo2',
    accent: '#ff8d9b',
    services: {
      duo1: 'Competitive with an Ascendant+ teammate who plays around your agent and trades every duel.',
      duo2: 'Competitive with an Immortal+ teammate who calls the round, the rotate and the retake.',
      duo3: 'Competitive with a Radiant teammate for Immortal lobbies and rounds that need a 1v2 held.',
      swift:
        'Swiftplay with a strong teammate: about 15 minutes, full buy system, no rank on the line.',
      unrated:
        'Unrated with a strong teammate while you learn an agent or practice a second role.',
      dm: 'Deathmatch and Team Deathmatch together as an aim warm-up before you queue ranked.',
    },
    facts: [
      'Checked by Duoly before any order',
      'Ascendant+, Immortal+ or Radiant partners',
      'Duelist, Controller, Initiator or Sentinel',
      'Your own account, on EU, NA, AP, KR, BR or LATAM',
    ],
    formatHeading: 'What is a Valorant teammate booking?',
    stepsHeading: 'How do you book a Valorant teammate?',
    prepareHeading: 'How should you prepare for your first Valorant session?',
    faqHeading: 'Questions before you queue?',
    pricesChecked: '2026-11-08',
    pricesIntro:
      'A Valorant teammate booking is a per-game price set by the mode and, in Competitive, by your own rank. First, pick the mode, because Swiftplay, Unrated and a Deathmatch warm-up hold one price at every rank while Competitive does not. Second, open the rank list on a Competitive card: Duo Pro is {{valProIron}} per game at Iron and {{valProImmortal}} at Immortal. Bundles then cut the total: 3 games take {{pct3}} off, 5 games take {{pct5}} off and 10 games take {{pct10}} off. For example, a Gold player weighing one game against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here was read from Duoly checkout in November 2026. The line under the cards gives the exact date.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Valorant player queues with you on your own account, for the number of games you select, from 1 game up to 10 games. Duo Pro is the Competitive service with an Immortal+ teammate, and a Deathmatch warm-up is the cheapest casual booking of the three. First, pick the mode, because Swiftplay, Unrated and the warm-up hold one price while Competitive follows your own rank. Second, pick the tier: Duo Plus is Ascendant+, Duo Pro Immortal+ and Duo Apex a Radiant player. Your teammate fills 1 of the 5 seats, so the other 3 players come from the normal queue. Finally, every booking opens an order chat. For example, that is where you agree the agent pair and whether voice runs using Discord. Nobody can promise you a rank.',
    sections: [
      {
        heading: 'Which Valorant agents and roles make a good duo?',
        paragraphs: [
          'A good Valorant duo is a pair of agents whose utility lands on the same site inside the same 3 seconds. The 4 agent roles come from Riot Games: Duelist, Controller, Initiator and Sentinel. Controller and Duelist is the classic pair. The smoke goes down, and the Duelist enters through it on a count. Initiator and Duelist is the second strong pair, because a Breach stun or a Sova dart gives the entry a target instead of a guess. Sentinel and Controller is the third, holding the far site and rotating together.',
          'For example, a Sentinel player who books an Immortal+ Initiator gets a dart before every entry instead of a guess at first contact. Duo Plus pairs you with an Ascendant+ teammate at {{valPlus}} per game and Duo Apex with a Radiant one at {{valTop}}, both with {{pct3}} off 3 games and {{pct5}} off 5 in November 2026. Pick the tier by the lobbies you queue into now rather than the ones you want to reach. Finally, name your agent pool in the order chat using Discord, so neither player instant-locks the same role.',
        ],
      },
      {
        heading: 'Should you book Competitive, Swiftplay or Unrated?',
        paragraphs: [
          'Swiftplay is the short Valorant mode of about 15 minutes with the full buy system, at {{valSwift}} per game, so Swiftplay suits a warm-up or a first session with a new teammate. Unrated is the full 13-round format with no rank on the line at {{valUnrated}} per game, which makes Unrated the honest place to learn a new agent. First, a Deathmatch warm-up is {{valDm}} per game and fixes aim rather than teamplay, so book one before a ranked block. All three hold one price at every rank, while Competitive is priced by the rank you sit at.',
          'Competitive is the ranked mode, and the only one whose price follows the rank you sit at, so the Competitive cards carry a rank list while the casual ones hold one price. First, the teammate tiers are Duo Plus with an Ascendant+ player, Duo Pro with an Immortal+ player and Duo Apex with a Radiant player. Second, bundles cut whichever tier you pick, {{pct3}} off 3 games and {{pct5}} off 5. For example, a Sentinel main books Duo Pro and asks for an Immortal+ Initiator who darts before every entry, agreed using Discord.',
        ],
      },
      {
        heading: 'How much does a Valorant duo cost?',
        paragraphs: [
          'Duo Pro is the Competitive Valorant service with an Immortal+ teammate, priced per game by your own rank. First, find your own rank on the card. A Gold player on EU pays {{valPro}} per game, an Iron player {{valProIron}} and an Immortal player {{valProImmortal}}, so the Duo Pro price rises with your own rank. Finally, every number here was read from Duoly checkout in November 2026, rather than from a list kept by hand.',
          'Bundles cut the total for every rank. For example, a Gold player pays {{valPro3}} for 3 games with {{pct3}} off, {{valPro5}} for 5 games with {{pct5}} off and {{valPro10}} for 10 games with {{pct10}} off. The casual modes hold one flat price at every rank instead, so only Competitive moves with your rank. Valorant coaching from Duoly has separate prices on the [Valorant coaching page](/games/valorant/coaching), and the [Valorant hub](/games/valorant) lists every service for the game.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total game count first, before checkout. Duo Pro is the Competitive option from Duoly with an Immortal+ teammate, and the game count decides your bundle discount: 3 games take {{pct3}} off and 5 games {{pct5}} off in November 2026.',
      'Second, add your region, rank, main role and language. The written request is the first thing your new teammate reads. For example, name EU or NA, your rank and the role you want covered, such as Controller or Sentinel.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord or the in-game party, settle the agent pair, then send a party invite from the Valorant client. Swiftplay is the relaxed version of the same session, and bundles still take {{pct3}} off 3 games and {{pct5}} off 5 in November 2026.',
    ],
    prepare: [
      'A Riot ID is the in-game name plus a tagline, for example Name#EUW. Riot IDs from Riot Games replaced the older separate names, and your teammate needs the full Riot ID to send a party invite.',
      'First, pick the right region, because EU, NA, AP, KR, BR and LATAM keep separate ranked ladders and separate friend lists.',
      'Decide the mode before you pay, because Competitive is priced by your own rank while Swiftplay, Unrated and a Deathmatch warm-up hold one price for every rank.',
      'Test your microphone and your Discord audio, then say whether you want relaxed chat or short round calls.',
      'Bring a small agent pool, for example 2 agents for your main role and 1 agent for a second role, and agree who buys utility on a half buy.',
      'Finally, book the games you want up front, because the bundle discount applies to one order rather than to games added later: 3 games take {{pct3}} off and 5 games {{pct5}} off in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Can I book someone just for Swiftplay?',
        'Yes, Swiftplay is the short Valorant format of about 15 minutes, and it is booked per game at one flat price for every rank.',
      ],
      [
        'Can I play Unrated while learning an agent?',
        'Yes, Unrated is the full 13-round mode with no rank on the line, which suits a new agent or a second role.',
      ],
      [
        'Which Valorant teammate tiers can I book?',
        'Three: Duo Plus with an Ascendant+ player, Duo Pro with an Immortal+ player and Duo Apex with a Radiant player, all priced per game by your own rank.',
      ],
      [
        'Does a duo booking fill the whole team?',
        'No, a duo booking adds 1 teammate, so a booked pair covers 2 of 5. The other 3 seats come from the normal queue.',
      ],
      [
        'How much do 10 Valorant duo games cost?',
        'Ten Duo Pro games cost {{valPro10}} at Gold on EU with {{pct10}} off, against {{pct3}} off 3 games, read from Duoly checkout in November 2026.',
      ],
      [
        'How do I find free Valorant teammates?',
        'For example, start with the VALORANT Discord or the VALORANT LFG server, both checked in November 2026. Include region, rank, role and mode.',
      ],
    ],
    closing:
      'Duo Pro is the Competitive Valorant session with an Immortal+ teammate from Duoly, and 5 games at Gold on EU cost {{valPro5}} as one bundle rather than five separate orders. Swiftplay, Unrated and a Deathmatch warm-up hold one price at every rank, so only Competitive moves with your own rank in November 2026. For example, ask for an Immortal+ Duelist when your agent pool is all smokes, agreed using Discord.',
  },
  {
    slug: 'duos',
    gameSlug: 'fortnite',
    title: 'Fortnite Duos: Find a Duo Partner | Duoly',
    h1: 'Fortnite duos: find a duo partner who lands with you',
    lead: 'Find a Fortnite duo partner for Ranked Duos, Zero Build or Reload. Start with the free Discords and the Fill button, or book a reviewed teammate by the hour.',
    description: (price) =>
      `Find a Fortnite duo partner free in Discord or book a reviewed teammate ${price}. Compare Ranked Duos, Zero Build, Reload and Creative box fights.`,
    service: 'duo2',
    accent: '#7fc4ff',
    services: {
      duo1: 'An hour of Ranked Duos with a Champion+ teammate who calls the drop, the rotate and the endgame.',
      duo2: 'An hour of Ranked Duos or Zero Build with an Unreal teammate who takes the hard fights.',
      duo3: 'An hour with a tournament-level player for high Unreal lobbies and crowded endgames.',
      zb: 'An hour of Zero Build with a strong teammate: cover, positioning and aim, at a calmer pace.',
      reload:
        'An hour of Reload with a strong teammate: a small map, respawns and almost no downtime.',
      box: 'An hour of Creative box fights with an Unreal teammate who shows you how each build went.',
    },
    facts: [
      'Checked by Duoly before any order',
      'Champion+, Unreal or tournament-level partners',
      'PC, PlayStation, Xbox or Switch, either input',
      'Your own account, Europe through to Oceania',
    ],
    formatHeading: 'What is a Fortnite duo booking?',
    stepsHeading: 'How do you book a Fortnite duo partner?',
    prepareHeading: 'How should you prepare for your first Fortnite session?',
    faqHeading: 'Questions before you drop?',
    pricesChecked: '2026-11-08',
    pricesIntro:
      'A Fortnite duo booking is an hourly price set by the mode and, in Ranked, by your own rank. First, pick the mode, because Zero Build, Reload and Creative box fights hold one price at every rank while Ranked Duos does not. Second, open the rank list on a Ranked card: Duo Pro is {{fnProGold}} per hour at Gold and {{fnProUnreal}} at Unreal. Bundles then cut the total: 3 hours take {{pct3}} off, 5 hours take {{pct5}} off and 10 hours take {{pct10}} off. For example, a Platinum player weighing one hour against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here was read from Duoly checkout in November 2026. The line under the cards gives the exact date.',
    format:
      'A Duoly duo booking is a paid session where one reviewed Fortnite player drops with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. Duo Pro is the Ranked service with an Unreal teammate, and Creative box fights are the cheapest building booking at {{fnBox}} per hour. First, pick the mode, because Zero Build, Reload and box fights hold one price while Ranked follows your own rank. Second, pick the tier: Duo Plus is Champion+, Duo Pro Unreal and Duo Apex an Unreal player with a high Power Ranking. Your partner fills the second seat in Duos, so a Trio pulls the rest from the queue. Bundles cut the total, {{pct3}} off 3 hours up to {{pct10}} off 10. Finally, every booking opens an order chat. For example, that is where you agree the drop spot using Discord. Nobody can promise you a rank.',
    sections: [
      {
        heading: 'Zero Build or Builds: which duo should you book?',
        paragraphs: [
          'Zero Build is the Fortnite mode with building removed, at {{fnZb}} per hour, so cover comes from the map and the mantle rather than from walls and ramps. A Zero Build duo splits the job simply: one player holds the angle, the other pushes when shields break. Builds is the original mode, where a duo needs piece control, a box to reset in and mats to spend. Reload sits between them, with respawns on a small map, and Creative box fights cover building practice on their own.',
          'For example, a Zero Build main who books an Unreal partner for Ranked Duos spends the first hour relearning piece control instead of fighting. Say which mode you want before booking, because a Zero Build main and a build fighter train different habits. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5. Finally, pick the tier by the lobbies your rank puts you in now, and agree the drop using Discord before the bus moves.',
        ],
      },
      {
        heading: 'How does a Fortnite duo split the work in a match?',
        paragraphs: [
          'A Fortnite duo is 2 players sharing one drop, one loot path and one rotation plan, on a map that changes every season from Epic Games. First, agree the drop. Then agree who takes the chest side and who takes the floor loot, so the first minute never ends with 2 pistols. Split mats early in Builds, because a duo on 90 wood loses the first build fight. Call rotations by the storm circle rather than by the fight you want, because the storm decides who holds high ground.',
          'In the endgame, 1 player builds and 1 player watches the box line. For example, calling a box reset out loud using Discord turns a lost 2v2 into a trade. Squad Fill in the lobby is the free version for Trios and Squads: a random player arrives from Epic Games at no cost, with no agreed hour and no comms. Finally, a booked partner is the version where the hour, the rank and the comms are agreed first, from {{fnPlus}} per hour on Duo Plus, with {{pct3}} off 3 hours and {{pct5}} off 5.',
        ],
      },
      {
        heading: 'How much does a Fortnite duo cost?',
        paragraphs: [
          'Duo Pro is the Ranked Fortnite service with an Unreal teammate, priced per hour by your own rank. First, find your own rank on the card. A Platinum player in Europe pays {{fnPro}} per hour. A Gold player pays {{fnProGold}} per hour and an Unreal player {{fnProUnreal}}, so the Duo Pro price rises with your own rank. Finally, every number here was read from Duoly checkout in November 2026. The price cards carry the exact date.',
          'Bundles cut the total for every rank. For example, a Platinum player pays {{fnPro3}} for 3 hours with {{pct3}} off, {{fnPro5}} for 5 hours with {{pct5}} off and {{fnPro10}} for 10 hours with {{pct10}} off. The casual modes hold one flat price at every rank instead, so only Ranked moves with your rank: Zero Build is {{fnZb}} per hour. Fortnite coaching from Duoly has separate prices on the [Fortnite coaching page](/games/fortnite/coaching), and the [Fortnite hub](/games/fortnite) lists every service for the game.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is the Ranked option from Duoly with an Unreal teammate, and the hour count decides your bundle discount: 3 hours take {{pct3}} off and 5 hours {{pct5}} off in November 2026.',
      'Second, add your platform, region, rank, input and language. For example, name Europe or NA-East, controller or keyboard, and whether you want Builds or Zero Build. Input matters, because a controller player and a keyboard player build at different speeds.',
      'Finally, meet your partner in the order chat. Agree on voice using Discord, settle the drop spot, then add each other with the Epic name. Zero Build is the calmer version of the same hour, and bundles still take {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026.',
    ],
    prepare: [
      'An Epic name is the account name your partner needs for the friend request, and the request has to be accepted before the first queue.',
      'Name your platform and your input, because a controller player and a keyboard player warm up differently. Fortnite runs on PC, PlayStation, Xbox, Nintendo Switch and cloud, across separate regional queues from Europe to Oceania.',
      'Agree one drop spot and one backup spot, for example a named POI plus the nearest quiet landmark, and split mats before the first build fight.',
      'Test your microphone on Discord first, then say whether you want quiet games or constant calls.',
      'Decide the mode before you pay, because Ranked Duos is priced by your own rank while Zero Build, Reload and Creative box fights hold one price for every rank.',
      'Finally, book the hours you want up front, because the bundle discount applies to one order rather than to hours added later: 10 hours cost {{fnPro10}} at Platinum with {{pct10}} off, against {{pct3}} off 3 in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Can I book a duo partner for Zero Build only?',
        'Yes, Zero Build is the no-building mode, and a Zero Build teammate is booked by the hour at one flat price for every rank.',
      ],
      [
        'Which Fortnite partner tiers can I book?',
        'Three: Duo Plus with a Champion+ player, Duo Pro with an Unreal player and Duo Apex with an Unreal player on a high Power Ranking, all priced per hour by your rank.',
      ],
      [
        'Is Reload a good first session?',
        'Yes: Reload gives respawns on a small map at {{fnReload}} per hour, so a new pair gets many fights inside one hour, with {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026.',
      ],
      [
        'Does a duo booking fill a full squad?',
        'No: a booking adds 1 partner, so a Trio or Squad still needs friends or Squad Fill from Epic Games.',
      ],
      [
        'Can I learn building in a duo session?',
        'Creative box fights include an Unreal teammate showing you how each build went, with {{pct3}} off 3 hours. Fortnite coaching is the separate drill session.',
      ],
      [
        'How do I find a free Fortnite duo?',
        'For example, post in the Official Fortnite Discord, checked in November 2026, or turn Fill on in the lobby for a random teammate from Epic Games at no cost.',
      ],
    ],
    closing:
      'Duo Pro is the Ranked Fortnite session with an Unreal teammate from Duoly, and 5 hours at Platinum in Europe cost {{fnPro5}} as one bundle rather than five separate orders. Zero Build, Reload and Creative box fights hold one price at every rank, so only Ranked moves with your own rank in November 2026. For example, ask for an Unreal partner on controller when you play on a pad yourself, agreed using Discord.',
  },
  {
    slug: 'lfg',
    gameSlug: 'overwatch-2',
    title: 'Overwatch 2 LFG: Find Teammates by Role | Duoly',
    h1: 'Overwatch 2 LFG: find teammates for role queue',
    lead: 'Find Overwatch 2 teammates for Competitive, Quick Play or Stadium. Start with the free LFG servers, or book a reviewed teammate on the role your group is missing.',
    description: (price) =>
      `Find Overwatch 2 teammates free in LFG servers or book a duo ${price}. Pick Tank, Damage or Support and compare Competitive, Quick Play and Stadium.`,
    service: 'qp',
    accent: '#ffb168',
    services: {
      duo1: 'Role Queue Competitive with a Diamond+ teammate who plays the role your group is missing.',
      duo2: 'Competitive with a Master+ teammate who tracks cooldowns and explains fights between rounds.',
      duo3: 'Competitive with a Grandmaster+ teammate for high lobbies and fights that need one player to swing them.',
      stadium:
        'Stadium together: plan builds round by round and close out the best of seven.',
      qp: 'Quick Play and Arcade with a strong teammate for relaxed games and hero practice.',
    },
    facts: [
      'Checked by Duoly before any order',
      'Diamond+, Master+ or Grandmaster+ partners',
      'Tank, Damage or Support, whichever seat is open',
      'Your own account, on Europe, Americas or Asia',
    ],
    formatHeading: 'What is an Overwatch 2 teammate booking?',
    stepsHeading: 'How do you book an Overwatch 2 teammate?',
    prepareHeading:
      'How should you prepare for your first Overwatch 2 session?',
    faqHeading: 'Questions before you queue?',
    pricesChecked: '2026-11-08',
    pricesIntro:
      'An Overwatch 2 teammate booking is a per-game price set by the mode and, in Competitive, by your own rank. First, pick the mode, because Quick Play, Arcade and a Stadium run hold one price at every rank while Competitive does not. Second, open the rank list on a Competitive card: Duo Pro is {{owProGold}} per game at Gold and {{owProMaster}} at Master. Bundles then cut the total: 3 games take {{pct3}} off, 5 games take {{pct5}} off and 10 games take {{pct10}} off. For example, a Platinum player weighing one game against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here was read from Duoly checkout in November 2026. The line under the cards gives the exact date.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Overwatch 2 player joins your group on your own account, for the number of games you select, from 1 game up to 10 games. Duo Pro is the Competitive service with a Master+ teammate, and Quick Play is the cheapest casual booking of the three. First, pick the mode, because Quick Play, Arcade and Stadium hold one price while Competitive follows your own rank. Second, pick the tier: Duo Plus is Diamond+, Duo Pro Master+ and Duo Apex Grandmaster+. Bundles cut the total, {{pct3}} off 3 games up to {{pct10}} off 10. Finally, every booking opens an order chat. For example, that is where you agree the role pair using Discord. Nobody can promise you a rank.',
    sections: [
      {
        heading: 'Which Overwatch 2 roles make a good duo?',
        paragraphs: [
          'Role queue is the Overwatch 2 system from Blizzard Entertainment that locks every team to 1 Tank, 2 Damage and 2 Support, so a duo is a pair of those 5 seats. Tank and Support is the steadiest pair: the Tank takes space, and the Support decides how much space the cooldowns can pay for. Damage and Support is the second pair, because a dive only works when the healing follows the dive. Two Damage players need one shared target and one agreed reset.',
          'For example, a Damage player who books a Master+ Support gets healing that follows the dive instead of a third player holding the back line. Duo Plus pairs you with a Diamond+ teammate at {{owPlus}} per game and Duo Apex with a Grandmaster+ one at {{owTop}}, both with {{pct3}} off 3 games and {{pct5}} off 5 in November 2026. Finally, name your role and one comfortable second role when booking, so the pair still works when the first pick is taken.',
        ],
      },
      {
        heading: 'Competitive, Quick Play or Stadium: what should you queue?',
        paragraphs: [
          'Quick Play is the casual Overwatch 2 mode with no rank attached, at {{owQp}} per game, which suits a first session, a new hero or a console evening with voice on. First, Stadium is the best-of-seven mode where both players spend round money on hero builds, so Stadium rewards a partner who plans 2 rounds ahead. Both hold one price at every rank, with {{pct3}} off 3 games and {{pct5}} off 5 in November 2026, while Competitive is priced by the rank you sit at.',
          'Competitive is the ranked mode, and the only one whose price follows the rank you sit at, so the Competitive cards carry a rank list while the casual ones hold one price. First, the teammate tiers are Duo Plus with a Diamond+ player, Duo Pro with a Master+ player and Duo Apex with a Grandmaster+ player. Second, bundles cut whichever tier you pick, {{pct3}} off 3 games and {{pct5}} off 5. For example, share your platform too, since crossplay settings change which lobby a mixed group lands in, agreed using Discord.',
        ],
      },
      {
        heading: 'How much does an Overwatch 2 duo cost?',
        paragraphs: [
          'Duo Pro is the Competitive Overwatch 2 service with a Master+ teammate, priced per game by your own rank. First, find your own rank on the card. A Platinum player in Europe pays {{owPro}} per game. A Gold player pays {{owProGold}} per game, and a Master player pays {{owProMaster}} per game, so the Duo Pro price rises with your own rank. Finally, every number here was read from Duoly checkout in November 2026. The price cards carry the exact date.',
          'Bundles cut the total for every rank. For example, a Platinum player pays {{owPro3}} for 3 games with {{pct3}} off, {{owPro5}} for 5 games with {{pct5}} off and {{owPro10}} for 10 games with {{pct10}} off. The casual modes hold one flat price at every rank instead, so only Competitive moves with your rank. Coaching from Duoly has separate prices on the [Overwatch 2 coaching page](/games/overwatch-2/coaching), and the [Overwatch 2 hub](/games/overwatch-2) lists every service for the game.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total game count first, before checkout. Duo Pro is the Competitive option from Duoly with a Master+ teammate, and the game count decides your bundle discount: 3 games take {{pct3}} off and 5 games {{pct5}} off in November 2026.',
      'Second, add your platform, region, rank, role and language. For example, name PlayStation or PC, Europe or Americas, and the role you want covered, such as Tank or Support.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord or the in-game group, settle the role pair, then invite with your BattleTag. Quick Play is the relaxed version of the same session, and bundles still take {{pct3}} off 3 games and {{pct5}} off 5 in November 2026.',
    ],
    prepare: [
      'A BattleTag is the Battle.net name plus a number, for example Name#2154. Your teammate needs the full BattleTag to send a group invite, and console players link the same account.',
      'Name your platform first. Overwatch 2 runs on PC, PlayStation, Xbox and Nintendo Switch, and most LFG posts for the game name a console in the first line.',
      'Pick the region before booking, because Europe, Americas and Asia keep separate queues and separate ping.',
      'Test your microphone and your Discord audio first, then say whether you want fight calls or quiet games.',
      'Bring 2 heroes for your main role and 1 for a second role, so a counterpick does not end the session.',
      'Decide the mode before you pay, because Competitive is priced by your own rank while Quick Play, Arcade and a Stadium run hold one price for every rank.',
      'Finally, book the games you want up front, because the bundle discount applies to one order rather than to games added later: 10 games cost {{owPro10}} at Platinum with {{pct10}} off, against {{pct3}} off 3 in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Can I book a teammate for Quick Play only?',
        'Yes: Quick Play is the casual Overwatch 2 mode, booked per game at one flat price for every rank, with {{pct3}} off 3 games and {{pct5}} off 5 in November 2026.',
      ],
      [
        'Which Overwatch 2 teammate tiers can I book?',
        'Three: Duo Plus with a Diamond+ player, Duo Pro with a Master+ player and Duo Apex with a Grandmaster+ player, all priced per game by your own rank.',
      ],
      [
        'Do you support Stadium?',
        'Yes: Stadium Duo is a per-game service at {{owStadium}}, planned round by round with a Master+ teammate who spends build money with you.',
      ],
      [
        'Does a duo booking fill all five seats?',
        'No, a duo booking adds 1 teammate, so a booked pair covers 2 of 5. The other 3 seats come from your group or the queue.',
      ],
      [
        'Can I book on PlayStation or Xbox?',
        'Yes, name your platform in the request, then check the crossplay setting before the first game.',
      ],
      [
        'How do I find free Overwatch 2 teammates?',
        'For example, post in the Overwatch Discord or on Teamfind. Include platform, region, rank, role and mode.',
      ],
    ],
    closing:
      'Duo Pro is the Competitive Overwatch 2 session with a Master+ teammate from Duoly, and 5 games at Platinum in Europe cost {{owPro5}} as one bundle rather than five separate orders. Quick Play, Arcade and a Stadium run hold one price at every rank, so only Competitive moves with your own rank in November 2026. For example, ask for a Master+ Tank when your group is 2 Damage and a Support, agreed using Discord.',
  },
  {
    slug: 'lfg',
    gameSlug: 'apex-legends',
    title: 'Apex Legends LFG: Find Teammates and Duos | Duoly',
    h1: 'Apex Legends LFG: find teammates for Ranked or Duos',
    lead: 'Find Apex Legends teammates for Ranked, the Duos playlist or Mixtape. Start with the free Discords and auto fill, or book a reviewed teammate by the hour.',
    description: (price) =>
      `Find Apex Legends teammates free in Discord or book a reviewed duo ${price}. Compare Ranked, the Duos playlist and Mixtape before you drop.`,
    service: 'duos',
    accent: '#ff8f6b',
    services: {
      duo1: 'An hour of Ranked with a Diamond+ teammate who calls the drop, the rotate and the ring.',
      duo2: 'An hour of Ranked with a Master or Apex Predator teammate who reads the zone and the third party.',
      duos: 'An hour in the Duos playlist: 2-player squads, more fights per hour and shorter games.',
      mix: 'An hour of Mixtape with a strong teammate: Team Deathmatch, Control and Gun Run.',
      pubs: 'An hour of unranked battle royale while you learn a legend with someone covering you.',
    },
    facts: [
      'Checked by Duoly before any order',
      'Diamond+, Master or Apex Predator partners',
      'Assault, Skirmisher, Recon, Controller or Support',
      'Your own account, Europe through to Oceania',
    ],
    formatHeading: 'What is an Apex Legends teammate booking?',
    stepsHeading: 'How do you book an Apex Legends teammate?',
    prepareHeading: 'How should you prepare for your first Apex session?',
    faqHeading: 'Questions before you drop?',
    pricesChecked: '2026-11-08',
    pricesIntro:
      'An Apex Legends teammate booking is an hourly price set by the mode and, in Ranked, by your own rank. First, pick the mode, because the Duos playlist, Mixtape and unranked pubs hold one price at every rank while Ranked does not. Second, open the rank list on a Ranked card: Duo Pro is {{apexProGold}} per hour at Gold and {{apexProMaster}} at Master. Bundles then cut the total: 3 hours take {{pct3}} off, 5 hours take {{pct5}} off and 10 hours take {{pct10}} off. For example, a Platinum player weighing one hour against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here was read from Duoly checkout in November 2026. The line under the cards gives the exact date.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Apex Legends player drops with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. Duo Pro is the Ranked service with a Master or Apex Predator teammate, and Mixtape is the cheapest casual booking of the three. First, pick the mode, because the Duos playlist, Mixtape and pubs hold one price while Ranked follows your own rank. Second, pick the tier: Duo Plus names a Diamond+ player and Duo Pro a Master or Apex Predator. Bundles cut the total, {{pct3}} off 3 hours up to {{pct10}} off 10. Finally, every booking opens an order chat. For example, that is where you agree the legend pair using Discord. Nobody can promise you a rank.',
    sections: [
      {
        heading: 'Which Apex legend roles make a good duo?',
        paragraphs: [
          'Apex Legends sorts every legend into 5 classes from Respawn Entertainment: Assault, Skirmisher, Recon, Controller and Support. A good duo takes 2 classes that answer different problems. Controller and Assault is the steadiest pair, because one player owns the ground and the other converts it into damage. Recon and Skirmisher is the second pair: the scan finds the squad, and the Skirmisher picks the angle to hit it from. Support and anything keeps the pair alive long enough to use the plan.',
          'For example, a Skirmisher main who books a Master Controller gets ground to fight from instead of a second player looking for an angle. Say which legends you play before the first drop, because 2 Skirmishers with no Controller lose every long hold. Duo Plus pairs you with a Diamond+ partner at {{apexPlus}} per hour, with {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026. Finally, the third seat in trios usually comes from auto fill, so leave one class open and agree the drop using Discord.',
        ],
      },
      {
        heading: 'Ranked or the Duos playlist: which should you book?',
        paragraphs: [
          'The Duos playlist is the Apex battle royale format with 2-player squads, the honest answer for playing Apex as a pair, because nobody fills a third seat. Playlists rotate, so check the live list from Respawn Entertainment before booking an hour. For example, a pair booking a Duos hour in a week when Duos is down end up in trios with a stranger. Unranked pubs with the third seat on auto fill is the closest replacement.',
          'Ranked is the mode with Rookie up to Apex Predator and a real cost for dying early, so a called rotation actually pays there. First, Ranked is the one format whose price follows the rank you sit at, so only the Ranked cards carry a rank list. The Duos playlist is {{apexDuos}} per hour with 2-player squads, so nobody fills a third seat. Mixtape gives Team Deathmatch, Control and Gun Run with respawns, the fastest way to learn a legend without losing points, and unranked pubs are {{apexPubs}} per hour for the same practice inside a real battle royale. All three hold one price at every rank, with {{pct3}} off 3 hours and {{pct5}} off 5, while Ranked is priced by the rank you sit at.',
        ],
      },
      {
        heading: 'How much does an Apex Legends duo cost?',
        paragraphs: [
          'Duo Pro is the Ranked Apex service with a Master or Apex Predator teammate, priced per hour by your own rank. First, find your own rank on the card. A Platinum player in Europe pays {{apexPro}} per hour. A Gold player pays {{apexProGold}} per hour, and a Master player pays {{apexProMaster}} per hour, so the Duo Pro price rises with your own rank. Finally, every number here was read from Duoly checkout in November 2026. The price cards carry the exact date.',
          'Bundles cut the total for every rank. For example, a Platinum player pays {{apexPro3}} for 3 hours with {{pct3}} off, {{apexPro5}} for 5 hours with {{pct5}} off and {{apexPro10}} for 10 hours with {{pct10}} off. The casual modes hold one flat price at every rank instead, so only Ranked moves with your rank: unranked pubs stay {{apexPubs}} per hour. Apex coaching from Duoly has separate prices on the [Apex Legends coaching page](/games/apex-legends/coaching), and the [Apex Legends hub](/games/apex-legends) lists every service for the game.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is the Ranked option from Duoly with a Master or Apex Predator teammate, and the hour count decides your bundle discount: 3 hours take {{pct3}} off and 5 hours {{pct5}} off in November 2026.',
      'Second, add your platform, region, rank, legend pool and language. For example, name Europe or North America, PC or PlayStation, and the class you want covered, such as Controller or Recon.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord, settle the legend pair and the drop, then invite with your EA ID. Mixtape is the version with respawns instead of a ring, and bundles still take {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026.',
    ],
    prepare: [
      'An EA ID is the account name your teammate needs for the invite, and Apex Legends shows it on the lobby banner.',
      'Name your platform. Apex Legends runs on PC, PlayStation and Xbox, and crossplay groups land in the PC pool, so say what you play on.',
      'Pick the region before booking, because Europe, North America, South America, Asia, Oceania and Middle East are separate servers.',
      'Bring 2 legends you trust plus 1 backup from a different class, so the pair still covers scan or cover when a pick is taken.',
      'Test your microphone on Discord first, then agree on 1 call for a reset, for example naming the ring edge before the third party arrives.',
      'Decide the mode before you pay, because Ranked is priced by your own rank while the Duos playlist, Mixtape and unranked pubs hold one price for every rank.',
      'Finally, book the hours you want up front, because the bundle discount applies to one order rather than to hours added later: 10 hours cost {{apexPro10}} at Platinum with {{pct10}} off, against {{pct3}} off 3 in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Does Apex Legends have a duos mode?',
        'Duos is a 2-player squad playlist that appears in the rotation from Respawn Entertainment, and Duoly books it by the hour. Check the lobby for what is live.',
      ],
      [
        'Which Apex teammate tiers can I book?',
        'Two for Ranked: Duo Plus with a Diamond+ player and Duo Pro with a Master or Apex Predator, both priced per hour by your rank. The Duos playlist brings a Master partner.',
      ],
      [
        'Is Mixtape a good first session?',
        'Yes: Mixtape costs {{apexMix}} per hour, with respawns and short rounds, so a new pair gets many fights inside one hour. Three hours take {{pct3}} off.',
      ],
      [
        'Does a booking fill a full trio?',
        'No: a booking adds 1 teammate, so a booked pair covers 2 of 3. The third seat comes from auto fill, which costs nothing.',
      ],
      [
        'Can I learn movement in a duo session?',
        'A teammate explains calls as you play, and the Apex movement course is the separate lesson for tap strafes.',
      ],
      [
        'How do I find free Apex teammates?',
        'For example, post in the Apex Legends Discord, or leave auto fill on for a random third from Respawn Entertainment.',
      ],
    ],
    closing:
      'Duo Pro is the Ranked Apex Legends session with a Master or Apex Predator teammate from Duoly, and 5 hours at Platinum in Europe cost {{apexPro5}} as one bundle rather than five separate orders. The Duos playlist, Mixtape and unranked pubs hold one price at every rank, so only Ranked moves with your own rank in November 2026. For example, ask for an Assault legend when you play Controller, agreed using Discord.',
  },
  {
    slug: 'lfg',
    gameSlug: 'call-of-duty',
    title: 'Call of Duty LFG: Find Warzone Teammates | Duoly',
    h1: 'Call of Duty LFG: find Warzone and Ranked teammates',
    lead: 'Find Call of Duty teammates for Warzone, Resurgence, Ranked Play or round-based Zombies. Start with the free Discords, or book a reviewed teammate by the hour.',
    description: (price) =>
      `Find Call of Duty teammates free in Discord or book a reviewed duo ${price}. Compare Warzone, Resurgence, Ranked Play and round-based Zombies.`,
    service: 'duo2',
    accent: '#e8c86a',
    services: {
      duo1: 'An hour of multiplayer Ranked Play with a Crimson+ teammate who holds a lane and plays the objective.',
      duo2: 'An hour of Warzone duos with a teammate who knows the loadouts, the rotations and the buy stations.',
      duo3: 'An hour of Warzone Ranked with an Iridescent teammate, for when placement points decide the session.',
      rebirth:
        'An hour of Resurgence on the small map, where respawns keep the fights coming.',
      zombies:
        'An hour of round-based Zombies with a partner who knows the map and the wonder weapon.',
      party:
        'An hour of unranked multiplayer and party playlists, played purely for fun.',
    },
    facts: [
      'Checked by Duoly before any order',
      'Crimson+ or Iridescent partners for Ranked',
      'PC, PlayStation or Xbox, either input',
      'Your own account, Europe through to Oceania',
    ],
    formatHeading: 'What is a Call of Duty teammate booking?',
    stepsHeading: 'How do you book a Call of Duty teammate?',
    prepareHeading:
      'How should you prepare for your first Call of Duty session?',
    faqHeading: 'Questions before you drop?',
    pricesChecked: '2026-11-08',
    pricesIntro:
      'A Call of Duty teammate booking is an hourly price, and only the 2 Ranked services move with your rank. First, pick the mode, because Warzone duos, Resurgence, round-based Zombies and the party playlists hold one price at every rank. Second, open the rank list on Warzone Ranked or Ranked Play: the service is {{codRanked}} per hour at Platinum and {{codRankedIridescent}} at Iridescent. Bundles then cut the total: 3 hours take {{pct3}} off, 5 hours take {{pct5}} off and 10 hours take {{pct10}} off. For example, a Warzone player weighing one hour against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here was read from Duoly checkout in November 2026. The line under the cards gives the exact date.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Call of Duty player drops with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. Duo Pro is the Warzone duos service, priced by your own rank, and the party playlists are the cheapest booking of the lot. First, pick the side, because a Warzone partner and a Ranked Play partner train different habits. Second, pick the tier: Duo Plus is multiplayer Ranked Play with a Crimson+ teammate, Duo Pro is Warzone duos and Warzone Ranked brings an Iridescent player. Bundles cut the total, {{pct3}} off 3 hours up to {{pct10}} off 10. Finally, every booking opens an order chat. For example, that is where you agree the drop using Discord. Nobody can promise you a placement.',
    sections: [
      {
        heading: 'Warzone or multiplayer: which teammate should you book?',
        paragraphs: [
          'Warzone is the battle royale side of Call of Duty, where a duo lives on rotations, plates and buy station timing. Multiplayer Ranked Play is the 4v4 side, with fixed maps, known spawns and an objective to hold. First, pick one side before booking an hour, because the 2 sides reward different habits. A Warzone partner who reads the circle is not much use on Hardpoint. Multiplayer Ranked Play costs {{codPlus}} per hour at Platinum.',
          'Resurgence on the small map gives respawns, the easiest first session with someone new. Round-based Zombies wants a partner who knows the Easter egg steps rather than one with good aim, while party playlists at {{codParty}} per hour want neither. Name the mode in your request, because a Warzone main and a Ranked Play main rarely overlap. Only the 2 Ranked services move with your own rank, while Resurgence, Zombies and the party playlists hold one price for everybody. For example, a player who books one Resurgence hour to warm up and then one Warzone hour keeps the same voice across both.',
        ],
      },
      {
        heading: 'How does a Warzone duo win more fights?',
        paragraphs: [
          'A Warzone duo is 2 players sharing one rotation, one loadout plan and one buy station budget. First, agree the landing spot and the contract route, so both players reach the first circle with a loadout and cash. Call the rotation by the circle and the roof you want rather than by the squad you can hear. Keep 1 player plating while the other holds the angle, because 2 players plating at once loses a 2v2. For example, one Warzone hour buys about 2 full games, with {{pct3}} off 3 hours and {{pct5}} off 5.',
          'Squad Fill in the lobby is the free version: Activision drops a random player into the empty seat at no cost, with no agreed time and no comms. A booked hour settles the mode, the rank and the voice setup before anyone drops. Resurgence at {{codRebirth}} per hour is the drill version, because respawns let the pair test one fight 10 times in an hour, agreed using Discord.',
        ],
      },
      {
        heading: 'How much does a Call of Duty duo cost?',
        paragraphs: [
          'Duo Pro is the Warzone duos service on Duoly at {{codPro}} per hour for a Diamond player, and like the other duo tiers it follows your own rank. Warzone Ranked is the rank-priced service with an Iridescent teammate: a Platinum player pays {{codRanked}} per hour, and an Iridescent player pays {{codRankedIridescent}} per hour, so that price rises with your own rank. Multiplayer Ranked Play is {{codPlus}} per hour at Platinum with a Crimson+ teammate who holds a lane and plays the objective. Finally, every number here was read from Duoly checkout in November 2026. The price cards carry the exact date.',
          'Bundles cut the total for every service. For example, Warzone duos cost {{codPro3}} for 3 hours with {{pct3}} off, {{codPro5}} for 5 hours with {{pct5}} off and {{codPro10}} for 10 hours with {{pct10}} off. Resurgence, Zombies and the party playlists hold one flat price at every rank too, so only the 2 Ranked services move with your rank. The [Call of Duty hub](/games/call-of-duty) lists every service for the game.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is the Warzone duos service from Duoly, priced by your own rank, and the hour count decides your bundle discount: 3 hours take {{pct3}} off and 5 hours {{pct5}} off in November 2026.',
      'Second, add your platform, region, rank, input and language. For example, name Europe or North America, PlayStation or PC, and whether the session is Warzone, Resurgence, multiplayer Ranked Play or round-based Zombies.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord or the in-game party, settle the drop and the loadout plan, then invite with your Activision ID. Resurgence is the easiest first session together, because respawns keep a wipe from ending the hour.',
    ],
    prepare: [
      'An Activision ID is the account name plus a number, and your teammate needs the full ID from Activision to send a party invite.',
      'Name your platform and your input. Call of Duty runs on PC, PlayStation and Xbox, and controller and keyboard players warm up differently.',
      'Pick the region before booking, because Europe, North America, South America, Asia, Oceania and Middle East give different ping.',
      'Decide the mode before the first hour, for example Warzone battle royale, Resurgence, multiplayer Ranked Play or round-based Zombies.',
      'Test your microphone on Discord first, then agree on 1 call for a reset, for example naming the building you fall back to.',
      'Decide the mode before you pay, because the 2 Ranked services are priced by your own rank while Resurgence, Zombies and the party playlists hold one price for everybody.',
      'Finally, book the hours you want up front, because the bundle discount applies to one order rather than to hours added later: 10 hours cost {{codPro10}} with {{pct10}} off, against {{pct3}} off 3 in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Can I book a Warzone duo for one hour?',
        'Yes: Warzone duos are booked by the hour at a price that follows your own rank, starting from a single hour.',
      ],
      [
        'Which Call of Duty teammate tiers can I book?',
        'Three: Duo Plus is multiplayer Ranked Play with a Crimson+ teammate, Duo Pro is Warzone duos, and Warzone Ranked brings an Iridescent player. All 3 follow your own rank.',
      ],
      [
        'Do you cover multiplayer Ranked Play?',
        'Yes, Duo Plus is multiplayer Ranked Play by the hour with a Crimson+ teammate who holds a lane and plays the objective.',
      ],
      [
        'Can someone help with round-based Zombies?',
        'Yes: a Zombies Run is {{codZombies}} per hour with a partner who knows the map and the wonder weapon steps, with {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026.',
      ],
      [
        'Does a booking fill a full quad?',
        'No: a booking adds 1 teammate, so a pair covers 2 of 4. For a trio or a quad, bring friends or leave Squad Fill on.',
      ],
      [
        'How do I find free Call of Duty teammates?',
        'For example, post in the Call of Duty Discord or the Warzone LFG server, naming platform, region, mode and rank.',
      ],
    ],
    closing:
      'Duo Pro is the Warzone duos session from Duoly, priced by your own rank, and 5 hours cost {{codPro5}} as one bundle rather than five separate orders. Resurgence, Zombies and the party playlists hold one price for everybody, so only the 2 Ranked services move with your own rank in November 2026. For example, ask for a Resurgence hour first when the pair has never played together, agreed using Discord.',
  },
  {
    slug: 'lfg',
    gameSlug: 'rainbow-six-siege',
    title: 'Rainbow Six Siege LFG: Find Teammates | Duoly',
    h1: 'Rainbow Six Siege LFG: find teammates for Ranked',
    lead: 'Find Rainbow Six Siege teammates for Ranked, Quick Match or Arcade. Start with the free LFG servers, or book a reviewed teammate who drones and calls with you.',
    description: (price) =>
      `Find Rainbow Six Siege teammates free in LFG servers or book a reviewed duo ${price}. Compare Ranked, Quick Match and Arcade before you queue.`,
    service: 'duo2',
    accent: '#8fb8ff',
    services: {
      duo1: 'Ranked with an Emerald+ teammate who drones, calls and takes anchor or entry as needed.',
      duo2: 'Ranked with a Diamond+ teammate who calls the round: drones, rotations and defender positions.',
      duo3: 'Ranked with a Champion-level teammate for high lobbies and rounds that need a clutch.',
      quick:
        'Quick Match with a strong teammate who explains maps and operators while you play.',
      arcade:
        'Arcade playlists and Deathmatch together as a warm-up between Ranked games.',
    },
    facts: [
      'Checked by Duoly before any order',
      'Emerald+, Diamond+ or Champion-level partners',
      'Entry, support, anchor or roam',
      'Your own account, EU West through to Japan East',
    ],
    formatHeading: 'What is a Rainbow Six Siege teammate booking?',
    stepsHeading: 'How do you book a Siege teammate?',
    prepareHeading: 'How should you prepare for your first Siege session?',
    faqHeading: 'Questions before you queue?',
    pricesChecked: '2026-11-08',
    pricesIntro:
      'A Rainbow Six Siege teammate booking is a per-game price set by the mode and, in Ranked, by your own rank. First, pick the mode, because Quick Match, Arcade and Deathmatch hold one price at every rank while Ranked does not. Second, open the rank list on a Ranked card: Duo Pro is {{r6ProCopper}} per game at Copper and {{r6ProDiamond}} at Diamond. Bundles then cut the total: 3 games take {{pct3}} off, 5 games take {{pct5}} off and 10 games take {{pct10}} off. For example, a Gold player weighing one game against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here was read from Duoly checkout in November 2026. The line under the cards gives the exact date.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Rainbow Six Siege player queues with you on your own account, for the number of games you select, from 1 game up to 10 games. Duo Pro is the Ranked service with a Diamond+ teammate, and Quick Match is the cheapest unranked booking of the three. First, pick the mode, because Quick Match and Arcade hold one price while Ranked follows your own rank. Second, pick the tier: Duo Plus names an Emerald+ player, Duo Pro a Diamond+ caller and Duo Apex a Champion-level player. Bundles cut the total, {{pct3}} off 3 games up to {{pct10}} off 10. Finally, every booking opens an order chat. For example, that is where you agree the first site using Discord.',
    sections: [
      {
        heading: 'Which Siege roles make a good duo?',
        paragraphs: [
          'A Siege duo is a pair of jobs inside one round, and the strongest pairs share utility rather than duplicate the same gadget. The operator roles come from Ubisoft: entry, support, anchor and roam. Hard breach and support is the classic attacking pair, one player clearing the Bandit or Mute while the other opens the wall. Entry and drone is the second pair, because a fragger moving without a live drone is guessing. On defence, anchor and roamer buys time: the anchor holds site while the roamer takes first contact elsewhere.',
          'For example, an entry player who books a Diamond+ teammate on drone duty walks into rooms that have already been cleared instead of guessing at the first angle. Duo Plus pairs you with an Emerald+ teammate at {{r6Plus}} per game and Duo Apex with a Champion-level one at {{r6Top}}, both with {{pct3}} off 3 games and {{pct5}} off 5 in November 2026. Finally, share your operator pool before the first round using Discord, so the pair always has a hard breach and a drone between them.',
        ],
      },
      {
        heading: 'Ranked, Quick Match or Arcade: what should you queue?',
        paragraphs: [
          'Quick Match is the unranked Siege mode for learning maps, callouts and operators, at {{r6Quick}} per game, which makes it the right first session: a map you cannot call costs more rounds than a rank point is worth. Arcade and Deathmatch warm up aim and peeks between Ranked games rather than teach anything. Both hold that price at every rank, while Ranked is priced by the rank you sit at.',
          'Ranked is the mode with Copper up to Champion, and the only one whose price follows the rank you sit at, so the Ranked cards carry a rank list while the unranked ones hold one price. First, the teammate tiers are Duo Plus with an Emerald+ player, Duo Pro with a Diamond+ caller and Duo Apex with a Champion-level player. Second, bundles cut whichever tier you pick, {{pct3}} off 3 games and {{pct5}} off 5. For example, name your platform, then agree 1 attacking site and 1 defending site to practise using Discord.',
        ],
      },
      {
        heading: 'How much does a Rainbow Six Siege duo cost?',
        paragraphs: [
          'Duo Pro is the Ranked Siege service with a Diamond+ teammate, priced per game by your own rank. First, find your own rank on the card. A Gold player on EU West pays {{r6Pro}} per game. A Copper player pays {{r6ProCopper}} per game, and a Diamond player pays {{r6ProDiamond}} per game, so the Duo Pro price rises with your own rank. Finally, every number here was read from Duoly checkout in November 2026. The price cards carry the exact date.',
          'Bundles cut the total for every rank. For example, a Gold player pays {{r6Pro3}} for 3 games with {{pct3}} off, {{r6Pro5}} for 5 games with {{pct5}} off and {{r6Pro10}} for 10 games with {{pct10}} off. The unranked modes hold one flat price at every rank instead, so only Ranked moves with your rank. Lessons have separate prices on the [Rainbow Six Siege coaching page](/games/rainbow-six-siege/coaching), and the [Siege hub](/games/rainbow-six-siege) lists every service.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total game count first, before checkout. Duo Pro is the Ranked option from Duoly with a Diamond+ teammate, and the game count decides your bundle discount: 3 games take {{pct3}} off and 5 games {{pct5}} off in November 2026.',
      'Second, add your platform, region, rank, role and language. For example, name EU West or US East, PC or PlayStation, and whether you want to entry, support, anchor or roam.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord, settle the operator pair and the first site, then invite with your Ubisoft name. Quick Match is the unranked version of the same session, and bundles still take {{pct3}} off 3 games and {{pct5}} off 5 in November 2026.',
    ],
    prepare: [
      'A Ubisoft name is the account name your teammate needs for the friend request, and the request has to be accepted before the first queue.',
      'Name your platform first. Rainbow Six Siege runs on PC, PlayStation and Xbox, and most LFG posts for the game name a platform in the first line.',
      'Pick the data centre before booking, because EU West, EU North, US East, US Central, US West, Brazil, Asia, Japan, Australia, UAE and South Africa are separate.',
      'Bring 2 attackers and 2 defenders you trust, including 1 hard breach and 1 drone-heavy operator, so the pair always covers the wall.',
      'Test your microphone on Discord first, then agree on short callouts, for example naming the room before the floor.',
      'Decide the mode before you pay, because Ranked is priced by your own rank while Quick Match, Arcade and Deathmatch hold one price for every rank.',
      'Finally, book the games you want up front, because the bundle discount applies to one order rather than to games added later: 10 games cost {{r6Pro10}} at Gold with {{pct10}} off, against {{pct3}} off 3 in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Can I book a teammate for Quick Match only?',
        'Yes: Quick Match is the unranked Siege mode, booked per game at one flat price for every rank, with {{pct3}} off 3 games and {{pct5}} off 5 in November 2026.',
      ],
      [
        'Which Siege teammate tiers can I book?',
        'Three: Duo Plus with an Emerald+ player, Duo Pro with a Diamond+ caller and Duo Apex with a Champion-level player, all priced per game by your own rank.',
      ],
      [
        'Can I ask for a hard breach main?',
        'Yes: name the operator pool in your request, for example a Thermite main to pair with your support, and Arcade stays {{r6Arcade}} per game for the warm-up.',
      ],
      [
        'Does a duo booking fill all five seats?',
        'No, a duo booking adds 1 teammate, so a booked pair covers 2 of 5. The other 3 seats come from the normal queue.',
      ],
      [
        'Can I book on PlayStation or Xbox?',
        'Yes, name your platform in the request, because PC and console posts rarely match in the same queue.',
      ],
      [
        'How do I find free Siege teammates?',
        'For example, post in the Rainbow 6 Discord or a cross-game LFG server, naming platform, data centre, rank and role.',
      ],
    ],
    closing:
      'Duo Pro is the Ranked Rainbow Six Siege session with a Diamond+ teammate from Duoly, and 5 games at Gold on EU West cost {{r6Pro5}} as one bundle rather than five separate orders. Quick Match, Arcade and Deathmatch hold one price at every rank, so only Ranked moves with your own rank in November 2026. For example, ask for a hard breach main when your own pool is Thatcher and Mute, agreed using Discord.',
  },
  {
    slug: 'lfg',
    gameSlug: 'counter-strike-2',
    // The CS2 hub title already carries "CS2 LFG", and hub titles are protected,
    // so this page owns the team finder and teammates side of the same cluster.
    title: 'CS2 Team Finder: Teammates for Premier | Duoly',
    h1: 'CS2 team finder: teammates for Premier and FACEIT',
    lead: 'Find Counter-Strike 2 teammates for Premier, FACEIT, Wingman or a retake server. Pick the mode, name your map pool and book a reviewed teammate who trades every duel.',
    description: (price) =>
      `Find CS2 teammates and book a reviewed Counter-Strike 2 duo ${price}. Compare Premier, FACEIT, Wingman 2v2 and community retake servers.`,
    service: 'duo2',
    accent: '#d9c37a',
    services: {
      duo1: 'Premier with a 15,000+ rated teammate who trades you, throws utility and keeps the buy on track.',
      duo2: 'Premier with a 20,000+ rated teammate who calls the buy, the rotation and the mid-round read.',
      duo3: 'FACEIT with a Level 10 teammate for stricter lobbies, sharper calls and its own anti-cheat.',
      wing: 'Wingman 2v2 on a small map with a Global Elite partner, where every round is the two of you.',
      casual:
        'Casual games and Deathmatch together, as an aim warm-up before a Premier block.',
      retake:
        'Community retake servers together: the fastest way to drill a site execute and a clutch.',
    },
    facts: [
      'Checked by Duoly before any order',
      '15,000+, 20,000+ or FACEIT Level 10 partners',
      'Entry, support, anchor, lurk or AWP',
      'Your own account, EU West through to South Africa',
    ],
    formatHeading: 'What is a CS2 teammate booking?',
    stepsHeading: 'How do you book a CS2 teammate?',
    prepareHeading: 'How should you prepare for your first CS2 session?',
    faqHeading: 'Questions before you queue?',
    pricesChecked: '2026-11-09',
    pricesIntro:
      'A Counter-Strike 2 teammate booking is a per-game price set by the mode and, in Premier, by your own CS Rating. First, pick the mode, because Casual, Deathmatch and a retake server hold one price at every rating while Premier does not. Second, open the rating list on a Premier card: Duo Pro from Duoly is {{cs2ProLow}} per game under 5,000 and {{cs2ProHigh}} above 25,000. Bundles then cut the total: 3 games take {{pct3}} off, 5 games take {{pct5}} off and 10 games take {{pct10}} off. For example, a 12,000 rated player weighing one game against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, we read every figure here from Duoly checkout in November 2026.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Counter-Strike 2 player queues with you on your own account, for the number of games you select, from 1 game up to 10 games. Duo Pro is the Premier service with a 20,000+ rated teammate from Duoly at {{cs2Pro}} per game, and a Casual and Deathmatch game is {{cs2Casual}}. First, pick the platform: Premier and Casual run in the Valve client, while FACEIT Duo queues the separate FACEIT ladder of Level 1 to Level 10. Premier is MR12, so a match is a race to 13 rounds with the side swap after 12. Your teammate fills 1 of the 5 seats, so the other 3 players arrive from the queue. Bundles cut the total in November 2026, {{pct3}} off 3 games up to {{pct10}} off 10. For example, the order chat is where you agree the map pool using Discord.',
    sections: [
      {
        heading: 'Which CS2 roles make a good duo?',
        paragraphs: [
          'A good Counter-Strike 2 duo is a pair of roles whose utility lands on the same site inside the same few seconds. Entry and support is the classic pair: the support player flashes over the wall, and the entry walks through the flash rather than through a guess. Lurk and entry is the second strong pair, because a lurker holding the far side of the map punishes the rotation the entry forced. AWP and anchor is the third, holding one site cheaply so the other three can stack. First, say which of those jobs you actually want.',
          'For example, a player who entries every round and owns no flash gets more from a support partner than from a second rifler. Duo Plus pairs you with a 15,000+ rated teammate at {{cs2Plus}} per game at a 10,000 to 14,999 rating, and FACEIT Duo with a Level 10 player at {{cs2Faceit}} on FACEIT Level 6, both with {{pct3}} off 3 games and {{pct5}} off 5 in November 2026. An AK-47 costs 2700 in game, so a full buy and an eco round want different plans. Finally, name your map pool in the order chat using Discord, so nobody learns Train on the night.',
        ],
      },
      {
        heading: 'Premier, FACEIT or Wingman: what should you queue?',
        paragraphs: [
          'Premier is the Valve ranked mode with the active map pool, a pick and ban phase and a CS Rating number instead of a skill group. Premier is the right queue when you want the rating to move. FACEIT is a separate platform with its own Level 1 to Level 10 ladder, anti-cheat and veto, so FACEIT Duo from Duoly is the booking for a stricter lobby. First, decide which number you care about, because the two ladders do not talk to each other.',
          'Wingman is the 2v2 mode on a single bombsite, and Wingman is the honest pick for playing Counter-Strike 2 as a pair, since nobody fills the other three seats. Wingman keeps the classic skill groups, so the price follows your group: {{cs2Wing}} per game at Master Guardian. Casual and Deathmatch cost {{cs2Casual}} per game for an aim warm-up, and a community retake server costs {{cs2Retake}} per game for the drill version: one site, one execute, replayed 20 times in a session. Those two hold one price at every rating, with {{pct3}} off 3 games and {{pct5}} off 5. For example, book a retake block first when your pair keeps losing the same B site.',
        ],
      },
      {
        heading: 'How much does a CS2 duo cost?',
        paragraphs: [
          'Duo Pro is the Premier Counter-Strike 2 service with a 20,000+ rated teammate, priced per game by your own CS Rating. First, find your own rating band on the card. A player at 10,000 to 14,999 pays {{cs2Pro}} per game, a player under 5,000 pays {{cs2ProLow}} and a player above 25,000 pays {{cs2ProHigh}}, so the Duo Pro price rises with your own rating. Finally, we read every number here from Duoly checkout in November 2026, rather than from a list kept by hand.',
          'Bundles cut the total for every rating. For example, a player at 10,000 to 14,999 pays {{cs2Pro3}} for 3 games with {{pct3}} off, {{cs2Pro5}} for 5 games with {{pct5}} off and {{cs2Pro10}} for 10 games with {{pct10}} off. Casual, Deathmatch and retake servers hold one flat price instead, so a retake server stays {{cs2Retake}} per game at every rating. The ranked services each follow their own ladder: Premier rating on the Premier cards, FACEIT levels on FACEIT Duo and skill groups on Wingman. CS2 coaching from Duoly has separate prices on the coaching page, agreed using Discord.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total game count first, before checkout. Duo Pro is the Premier option from Duoly with a 20,000+ rated teammate, and the game count decides your bundle discount: 3 games take {{pct3}} off and 5 games {{pct5}} off in November 2026.',
      'Second, add your region, CS Rating or FACEIT level, map pool and language. For example, name EU West or NA East, the three maps you actually know and the role you want covered, such as support or AWP.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord, settle who takes utility on a half buy, then add each other by Steam name or FACEIT nickname. A single Duo Pro game costs {{cs2Pro}} at 10,000 to 14,999, and 5 games take {{pct5}} off.',
    ],
    prepare: [
      'A Steam name is the account name your teammate needs for the friend invite, and a FACEIT booking needs your FACEIT nickname instead.',
      'First, pick the region, because EU West, EU East, NA East, NA West, South America, Asia, Oceania, Middle East and South Africa are separate server groups.',
      'Bring a map pool of 3 maps you can call, for example 1) Mirage, 2) Inferno and 3) Ancient, then say which map you want to avoid.',
      'Test your microphone and your audio using Discord, then agree on short calls: a position, a number and a utility state.',
      'Agree the buy rules before the first half, for example a full save under 2000 and armor before a rifle on a force buy.',
      'Finally, book the games you want up front, because the bundle discount applies to one order rather than to games added later: 1 game is {{cs2Pro}} and 10 games cost {{cs2Pro10}} with {{pct10}} off in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Can I book a teammate for Wingman only?',
        'Yes: Wingman is the 2v2 mode on one bombsite, booked per game with a Global Elite partner. Wingman uses the classic skill groups, so a Master Guardian pays {{cs2Wing}} per game.',
      ],
      [
        'Do you cover FACEIT as well as Premier?',
        'Yes: FACEIT Duo queues the FACEIT platform with a Level 10 teammate, priced by your own FACEIT level at {{cs2Faceit}} per game on Level 6. Premier stays in the Valve client.',
      ],
      [
        'Can someone help me practise retakes?',
        'Yes: a retake server booking is {{cs2Retake}} per game, and a session replays one site execute many times, with {{pct3}} off 3 games in November 2026.',
      ],
      [
        'Does a duo booking fill all five seats?',
        'No: a duo booking adds 1 teammate, so a booked pair covers 2 of 5. The other 3 seats come from the queue, and FACEIT Stack is the five-player service.',
      ],
      [
        'Is a duo session the same as CS2 coaching?',
        'No: a duo is shared playing time at {{cs2Pro}} per game with {{pct5}} off 5. Demo Review and Utility and Lineups are the hourly lessons on the coaching page.',
      ],
      [
        'How do I find free CS2 teammates?',
        'For example, post in a Counter-Strike LFG Discord or add players after a good match using Steam, naming region, rating, role and map pool.',
      ],
    ],
    closing:
      'Duo Pro is the Premier Counter-Strike 2 session with a 20,000+ rated teammate from Duoly, and 5 games at 10,000 to 14,999 cost {{cs2Pro5}} with {{pct5}} off, against {{pct3}} off 3. Wingman is the 2v2 pick at {{cs2Wing}} per game when you want the whole match to be the two of you. For example, ask for a support player when you entry every round, agreed using Discord.',
  },
  {
    slug: 'lfg',
    gameSlug: 'rocket-league',
    // The Rocket League hub title already carries "Rocket League LFG", so this
    // page owns the duo and player finder side of the same cluster.
    title: 'Rocket League Duo: Find a 2v2 Partner | Duoly',
    h1: 'Rocket League duo: find a 2v2 partner for Doubles',
    lead: 'Find a Rocket League duo partner for Ranked Doubles, casual 3v3 or the extra modes. Book a reviewed teammate by the hour who rotates properly and calls boost.',
    description: (price) =>
      `Find Rocket League teammates and book a reviewed duo partner ${price}. Compare Ranked Doubles, casual 3v3 and the extra modes before you queue.`,
    service: 'duo2',
    accent: '#63c8ff',
    services: {
      duo1: 'An hour of Ranked Doubles with a Champion+ partner who rotates, so you are never both chasing.',
      duo2: 'An hour of Ranked Doubles with a Grand Champion who sets you up and covers back post.',
      duo3: 'An hour of high-rank Doubles with a Supersonic Legend who wins kickoffs and plays like a pro.',
      casual:
        'An hour of relaxed casual 3v3 with a strong teammate who actually passes the ball.',
      extra:
        'An hour of Rumble, Hoops, Snow Day, Dropshot and Heatseeker, played purely for fun.',
    },
    facts: [
      'Checked by Duoly before any order',
      'Champion+, Grand Champion or Supersonic Legend',
      'Doubles, Standard or the extra modes',
      'Your own account, Europe through to Oceania',
    ],
    formatHeading: 'What is a Rocket League duo booking?',
    stepsHeading: 'How do you book a Rocket League duo partner?',
    prepareHeading:
      'How should you prepare for your first Rocket League session?',
    faqHeading: 'Questions before you queue?',
    pricesChecked: '2026-11-09',
    pricesIntro:
      'A Rocket League duo booking is an hourly price set by the mode and, in Ranked Doubles, by your own rank. First, pick the mode, because casual 3v3 and the extra modes hold one price at every rank while Doubles does not. Second, open the rank list on a Doubles card: Duo Pro from Duoly is {{rlProGold}} per hour at Gold and {{rlProGc}} at Grand Champion. Bundles then cut the total: 3 hours take {{pct3}} off, 5 hours take {{pct5}} off and 10 hours take {{pct10}} off. For example, a Diamond player weighing one hour against a bundle of 5 is comparing 2 rows of the same card. An hour holds about 8 matches, since a match runs 5 minutes plus overtime. Finally, we read every figure here from Duoly checkout in November 2026.',
    format:
      'A Duoly duo booking is a paid session where one reviewed Rocket League player queues with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. Duo Pro is the Ranked Doubles service with a Grand Champion partner from Duoly at {{rlPro}} per hour at Diamond, and the extra modes are {{rlExtra}} per hour at every rank. First, Doubles is 2v2, so a booked partner is the whole rest of the team rather than 1 seat of 5. A Rocket League match runs 5 minutes plus overtime, so an hour covers roughly 8 games including queue time. Bundles cut the total in November 2026, {{pct3}} off 3 hours up to {{pct10}} off 10. Finally, every booking opens an order chat. For example, that is where you agree the car, the camera talk and the voice setup using Discord.',
    sections: [
      {
        heading: 'Which Rocket League duo rotation actually works?',
        paragraphs: [
          'A Doubles rotation is the agreement about who goes for the ball and who covers the net behind the challenge. First, one player challenges and the other holds back post, then the two swap roles after every touch. A pair that both commits to the same ball gives up an open net, and a pair that both hangs back gives the opponents free possession. Second, call boost: a player on 12 boost cannot challenge, so the partner takes the next ball and the low player collects the small pads on the way back.',
          'For example, a Diamond player who books a Grand Champion partner from Duoly spends the hour learning where the second touch should come from rather than chasing. Duo Plus pairs you with a Champion+ partner at {{rlPlus}} per hour and Duo Apex with a Supersonic Legend at {{rlTop}}, both with {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026. There are 6 big boost pads on a standard field, which is why the back post route is a boost route too. Finally, agree one word for a reset using Discord.',
        ],
      },
      {
        heading: 'Doubles, casual 3v3 or the extra modes: what to book?',
        paragraphs: [
          'Ranked Doubles is the 2v2 playlist, and Doubles is the honest answer for playing Rocket League as a pair, because a booked partner fills the only other seat. Casual 3v3 is the no-stakes version at {{rlCasual}} per hour, which suits a first session with someone new or an evening of mechanics with no rank attached. First, pick the playlist before the hour starts, because a Doubles rotation and a Standard rotation are different habits.',
          'The extra modes are Rumble, Hoops, Snow Day, Dropshot and Heatseeker, at {{rlExtra}} per hour, and an hour there is pure fun rather than practice. Second, Heatseeker gives the most touches per minute, so a new pair gets comfortable on voice fastest there. Both casual options hold one price at every rank, with {{pct3}} off 3 hours and {{pct5}} off 5, while Doubles is priced by the rank you sit at. For example, book one casual hour and one Doubles hour and keep the same partner across both, agreed using Discord.',
        ],
      },
      {
        heading: 'How much does a Rocket League duo cost?',
        paragraphs: [
          'Duo Pro is the Ranked Doubles service with a Grand Champion partner, priced per hour by your own rank. First, find your own rank on the card. A Diamond player in Europe pays {{rlPro}} per hour, a Gold player pays {{rlProGold}} and a Grand Champion player pays {{rlProGc}}, so the Duo Pro price rises with your own rank. Finally, we read every number here from Duoly checkout in November 2026, and the line under the price cards carries the exact date.',
          'Bundles cut the total for every rank. For example, a Diamond player pays {{rlPro3}} for 3 hours with {{pct3}} off, {{rlPro5}} for 5 hours with {{pct5}} off and {{rlPro10}} for 10 hours with {{pct10}} off. The casual playlists hold one flat price at every rank instead, so only the ranked playlists move with your rank: the extra modes stay {{rlExtra}} per hour. Rocket League coaching from Duoly has separate prices on the coaching page, agreed using Discord.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is the Ranked Doubles option from Duoly with a Grand Champion partner, and the hour count decides your bundle discount: 3 hours take {{pct3}} off and 5 hours {{pct5}} off in November 2026.',
      'Second, add your platform, region, rank, input and language. For example, name Europe or US-East, controller or keyboard, and the car you play, such as Octane or Fennec.',
      'Finally, meet your partner in the order chat. Agree on voice using Discord, settle who takes the first kickoff, then add each other with the Epic name. A single Duo Pro hour costs {{rlPro}} at Diamond, and 5 hours take {{pct5}} off.',
    ],
    prepare: [
      'An Epic name is the account name your partner needs for the friend request, and the request has to be accepted before the first queue.',
      'First, name your platform and input. Rocket League runs on PC, PlayStation, Xbox and Nintendo Switch, and crossplay keeps a mixed pair in the same party.',
      'Pick the region before booking, because Europe, US-East, US-Central, US-West, South America, Asia, India, Oceania, Middle East and South Africa are separate queues.',
      'Warm up for 10 minutes in free play or a training pack, for example 1) 20 aerials and 2) 10 kickoffs, so the hour goes on rotation.',
      'Test your microphone using Discord first, then agree on 3 calls: going, cover and boost.',
      'Finally, book the hours you want up front, because the bundle discount applies to one order rather than to hours added later: 1 hour is {{rlPro}} and 10 hours cost {{rlPro10}} with {{pct10}} off in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Is a Rocket League duo booking per match or per hour?',
        'Per hour: a match runs about 5 minutes, so Duoly sells Doubles by the hour and an hour holds roughly 8 games including queue time.',
      ],
      [
        'Can I book casual games instead of Ranked?',
        'Yes: casual 3v3 is {{rlCasual}} per hour at one flat price for every rank, with {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026.',
      ],
      [
        'Do you cover Rumble, Hoops and Dropshot?',
        'Yes: the extra modes booking covers Rumble, Hoops, Snow Day, Dropshot and Heatseeker at {{rlExtra}} per hour with a strong teammate.',
      ],
      [
        'Does a booking fill a 3v3 team?',
        'A booking adds 1 partner, which is the whole second seat in Doubles. For Ranked Standard, 3v3 Standard is the Teams service that fills more seats.',
      ],
      [
        'Can I learn aerials in a duo session?',
        'A partner explains each touch as you play. Mechanics Training is the separate hourly lesson with training packs on the Rocket League coaching page.',
      ],
      [
        'How do I find a free Rocket League duo?',
        'For example, post in a Rocket League LFG Discord with your platform, region and rank, or add a player you enjoyed playing against from the match menu.',
      ],
    ],
    closing:
      'Duo Pro is the Ranked Doubles session with a Grand Champion partner from Duoly, and 5 hours at Diamond in Europe cost {{rlPro5}} with {{pct5}} off, against {{pct3}} off 3. Doubles is 2v2, so a booked partner is the whole rest of the team. For example, ask for a partner who plays back post when you like to challenge first, agreed using Discord.',
  },
  {
    slug: 'lfg',
    gameSlug: 'world-of-warcraft',
    title: 'WoW LFG: Find Mythic+ and Arena Teammates | Duoly',
    h1: 'WoW LFG: find teammates for Mythic+ and arena',
    lead: 'Find World of Warcraft teammates for Mythic+ keys, rated arena, Delves or leveling. Book a reviewed player by the hour who knows the route and the interrupts.',
    description: (price) =>
      `Find WoW teammates and book a reviewed World of Warcraft player ${price}. Compare Mythic+ keys, rated arena, Delves and a leveling buddy.`,
    service: 'duo2',
    accent: '#f2b13f',
    services: {
      duo1: 'An hour of Mythic+ keys with a 2,500+ rated teammate who knows the routes, kicks and pulls.',
      duo2: 'An hour of high keys with a 3,000+ rated teammate who plans the route and calls every pull.',
      arena:
        'An hour of rated 2v2 with a Duelist+ partner who calls swaps, crowd control and cooldowns.',
      delves:
        'An hour of Delves, world quests and weekly chores together, done fast and with good company.',
      level:
        'An hour of leveling with a friendly veteran who knows the routes and explains your class.',
    },
    facts: [
      'Checked by Duoly before any order',
      '2,500+ or 3,000+ rated Mythic+ partners',
      'Tank, healer or damage, whichever seat is open',
      'Your own account, on EU, US, KR or TW',
    ],
    formatHeading: 'What is a World of Warcraft teammate booking?',
    stepsHeading: 'How do you book a World of Warcraft teammate?',
    prepareHeading: 'How should you prepare for your first WoW session?',
    faqHeading: 'Questions before you queue?',
    pricesChecked: '2026-11-09',
    pricesIntro:
      'A World of Warcraft teammate booking is an hourly price set by the service and, on the key services, by your own Mythic+ score. First, pick the service, because Delves and a leveling hour hold one price at every score while the key services do not. Second, open the score list on a Mythic+ card: Duo Pro from Duoly is {{wowProLow}} per hour under 1,500 and {{wowProHigh}} above 3,500. Rated arena is priced by arena rating instead, at {{wowArena}} per hour around the Challenger cut. Bundles then cut the total: 3 hours take {{pct3}} off, 5 hours take {{pct5}} off and 10 hours take {{pct10}} off. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, we read every figure here from Duoly checkout in November 2026.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed World of Warcraft player groups with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. Duo Pro is the high key service with a 3,000+ rated teammate from Duoly at {{wowPro}} per hour at a 2,000 to 2,499 score, and a Delves hour is {{wowDelves}} at every score. First, a Mythic+ group holds 5 players: 1 tank, 1 healer and 3 damage, so a booked teammate fills 1 of those seats and Key Group Fill is the service that fills more. Rated 2v2 holds 2, so there a partner is the whole rest of the team. Bundles cut the total in November 2026, {{pct3}} off 3 hours up to {{pct10}} off 10. For example, the order chat is where you agree the realm and the voice setup using Discord.',
    sections: [
      {
        heading: 'Which Mythic+ roles make a good duo?',
        paragraphs: [
          'A Mythic+ duo is a pair of the 5 group seats, and the strongest pairs share one job rather than duplicate it. Tank and healer is the steadiest pair: the tank decides the size of the pull, and the healer decides whether that pull is payable. Healer and damage is the second pair, because an interrupt rotation only works when both players know whose kick is up. Tank and damage is the third, since route knowledge plus a second set of stops keeps a timer alive.',
          'For example, a healer who books a 3,000+ rated tank from Duoly gets pulls sized to the cooldowns actually available. Duo Plus pairs you with a 2,500+ rated teammate at {{wowPlus}} per hour, with {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026. The other 3 seats still come from your guild, your friends or the group finder. Finally, name your class, spec and the dungeon you keep failing in the order chat using Discord, so the first key starts on the right route.',
        ],
      },
      {
        heading: 'Mythic+, rated arena or Delves: what should you book?',
        paragraphs: [
          'Mythic+ is the timed 5-player dungeon mode, and a key either times or it does not, so Mythic+ rewards a partner who plans the route before the first pull. Rated arena is the 2v2 and 3v3 PvP ladder with its own rating and its own titles, from Combatant up through Duelist and Elite. First, pick which rating you actually want to move, because a Mythic+ score and an arena rating are separate numbers.',
          'Delves are the smaller solo or small-group content, at {{wowDelves}} per hour, which makes a Delves hour the relaxed way to clear a weekly list with company. A leveling hour is {{wowLevel}} per hour with a veteran who explains your class on the way up. Second, both hold one price at every score, with {{pct3}} off 3 hours and {{pct5}} off 5. For example, book a Delves hour first when you want to learn a new spec without a timer, then move to keys, agreed using Discord.',
        ],
      },
      {
        heading: 'How much does a World of Warcraft teammate cost?',
        paragraphs: [
          'Duo Pro is the high key service with a 3,000+ rated teammate, priced per hour by your own Mythic+ score. First, find your own score band on the card. A player at 2,000 to 2,499 pays {{wowPro}} per hour, a player under 1,500 pays {{wowProLow}} and a player above 3,500 pays {{wowProHigh}}, so the Duo Pro price rises with your own score. Finally, we read every number here from Duoly checkout in November 2026, and the line under the price cards carries the exact date.',
          'Bundles cut the total for every score. For example, a player at 2,000 to 2,499 pays {{wowPro3}} for 3 hours with {{pct3}} off, {{wowPro5}} for 5 hours with {{pct5}} off and {{wowPro10}} for 10 hours with {{pct10}} off. Delves and leveling hold one flat price at every score instead, so only the key and arena services move with your rating. World of Warcraft coaching from Duoly has separate prices on the coaching page, agreed using Discord.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is the high key option from Duoly with a 3,000+ rated teammate, and the hour count decides your bundle discount: 3 hours take {{pct3}} off and 5 hours {{pct5}} off in November 2026.',
      'Second, add your region, realm, class, spec and Mythic+ score or arena rating. For example, name EU, your realm, Restoration Druid and the dungeon you want to run first.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord, settle the route and the interrupt order, then invite with your BattleTag. A single Duo Pro hour costs {{wowPro}} at 2,000 to 2,499, and 5 hours take {{pct5}} off.',
    ],
    prepare: [
      'A BattleTag is the Battle.net name plus a number, for example Name#2154, and your teammate needs the full BattleTag to accept a group invite.',
      'First, pick the region, because EU, US, KR and TW keep separate realms, separate ladders and separate friend lists.',
      'Name your class and spec, and bring the talent build you actually play, so the route is planned around your real stops and defensives.',
      'Check your keystone and your gear before the hour starts, for example 1) a key you want to time and 2) an item level you are comfortable at.',
      'Test your microphone and your audio using Discord, then agree on 3 calls: pull, stop and defensive.',
      'Finally, book the hours you want up front, because the bundle discount applies to one order rather than to hours added later: 1 hour is {{wowPro}} and 10 hours cost {{wowPro10}} with {{pct10}} off in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Can I book a teammate for one key?',
        'Bookings are hourly, from 1 hour up to 10 hours, and an hour usually covers more than one key depending on the level and the route.',
      ],
      [
        'Do you cover rated arena as well as Mythic+?',
        'Yes: Arena 2v2 is an hourly service with a Duelist+ partner at {{wowArena}} per hour around the Challenger cut, priced by arena rating.',
      ],
      [
        'Can someone help with Delves and weekly chores?',
        'Yes: a Delves hour is {{wowDelves}} per hour with an experienced partner, and a leveling hour is {{wowLevel}} with a veteran who explains your class.',
      ],
      [
        'Does a booking fill a full Mythic+ group?',
        'No: a booking adds 1 teammate, so a pair covers 2 of 5. Key Group Fill is the Teams service for the remaining seats.',
      ],
      [
        'Is this a WoW coaching session?',
        'No: a teammate hour is shared playing time at {{wowPro}} per hour, with {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026. Class and Rotation Coaching is the separate lesson.',
      ],
      [
        'How do I find free WoW teammates?',
        'For example, use the in-game group finder for premade groups, ask in your guild, or post in a World of Warcraft LFG Discord with realm, role and score.',
      ],
    ],
    closing:
      'Duo Pro is the high Mythic+ session with a 3,000+ rated teammate from Duoly, and 5 hours at a 2,000 to 2,499 score cost {{wowPro5}} with {{pct5}} off, against {{pct3}} off 3. A Mythic+ group holds 5 players, so a booked teammate fills 1 seat and Key Group Fill covers the rest. For example, ask for a tank who plans the route when you heal, agreed using Discord.',
  },
  {
    slug: 'player-finder',
    gameSlug: 'minecraft',
    // The Minecraft hub title already carries "Minecraft player finder", so this
    // page owns the LFG side of the same cluster. The URL keeps the slug the
    // keyword gap analysis asked for.
    title: 'Minecraft LFG: Find Players for Bedwars and SMP | Duoly',
    h1: 'Minecraft LFG: find players for Bedwars and your SMP',
    lead: 'Find Minecraft players for Bedwars, SkyWars, Duels, an SMP or a fresh survival world. Book a reviewed partner by the hour on Java or Bedrock, on the server you pick.',
    description: (price) =>
      `Find Minecraft players and book a reviewed partner ${price}. Compare PvP on Hypixel, an SMP survival partner, minigames and a full Ender Dragon run.`,
    service: 'duo2',
    accent: '#86d46b',
    services: {
      duo1: 'An hour of PvP on the server and mode you pick: Bedwars, SkyWars, Duels, UHC or Box PvP.',
      duo2: 'An hour with a top PvPer who takes the hard fights and shows you how each clutch worked.',
      smp: 'An hour on your SMP or a fresh world: gear up, set up farms and handle the fights.',
      surv: 'An hour of relaxed survival: build a base, go mining and explore at your own pace.',
      dragon:
        'An hour aimed at the Ender Dragon: gear, a stronghold and the fight itself, together.',
      mini: 'An hour of Bedwars, SkyWars, Build Battle, Murder Mystery and parkour on your server.',
    },
    facts: [
      'Checked by Duoly before any order',
      'Skilled or top PvP partners',
      'Java or Bedrock, on the server you name',
      'Your own account, no rank and no region picker',
    ],
    formatHeading: 'What is a Minecraft player finder booking?',
    stepsHeading: 'How do you book a Minecraft partner?',
    prepareHeading: 'How should you prepare for your first Minecraft session?',
    faqHeading: 'Questions before you join?',
    pricesChecked: '2026-11-09',
    pricesIntro:
      'A Minecraft booking is an hourly price, and Minecraft is one of the two games on Duoly with no rank picker at all, next to ARC Raiders: every service holds one flat price. First, pick the hour by what you want to do. PvP Duo Pro from Duoly is {{mcPro}} per hour with a top PvPer, PvP Duo is {{mcPlus}}, a Survival Partner is {{mcSmp}}, relaxed survival is {{mcSurv}} and a minigames night is {{mcMini}}. Second, bundles cut the total: 3 hours take {{pct3}} off, 5 hours take {{pct5}} off and 10 hours take {{pct10}} off. For example, a player weighing one hour against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, we read every figure here from Duoly checkout in November 2026.',
    format:
      'A Minecraft player finder booking is a paid session where one reviewed Minecraft player joins the server you name, on your own account, for the number of hours you select, from 1 hour up to 10 hours. First, Minecraft has no ladder and no matchmaking region, so a booking asks for 2 things instead: the server address or your own world, and the edition, Java or Bedrock. PvP Duo Pro is the top tier from Duoly at {{mcPro}} per hour, and a minigames night is the cheapest booking at {{mcMini}}. Second, bundles cut the total in November 2026, {{pct3}} off 3 hours up to {{pct10}} off 10. Finally, every booking opens an order chat. For example, that is where you send the server address, your Minecraft name and the voice setup using Discord.',
    sections: [
      {
        heading: 'Which Minecraft mode should you book a partner for?',
        paragraphs: [
          'A Minecraft booking covers 3 kinds of session, and the mode decides which partner you want. Competitive PvP is Bedwars, SkyWars, Duels, UHC and Box PvP on a network such as Hypixel, where a partner who wins fights changes the result immediately. Survival is your own SMP or a fresh world, where a partner who knows farms and gear changes the next 10 hours instead. Minigames are Build Battle, Murder Mystery and parkour, where the point is the evening rather than the win.',
          'For example, a Bedwars player who keeps losing the rush books PvP Duo Pro from Duoly at {{mcPro}} per hour and spends the hour on bed defence. A Survival Partner is {{mcSmp}} per hour for an SMP, and a Beat the Game hour is {{mcDragon}} for a run at the Ender Dragon. Bundles take {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026. Finally, say the edition first, because a Java network and a Bedrock realm need different accounts, agreed using Discord.',
        ],
      },
      {
        heading: 'How does a Minecraft PvP duo actually practise?',
        paragraphs: [
          'A PvP duo is 2 players drilling one situation until the habit changes, rather than queueing random games. First, pick the situation: a Bedwars rush, a bed defence, a SkyWars mid fight or a Duels combo. Second, play the same scenario several times in the hour and let your partner name what went wrong after each one, which is the part a random teammate never does. Bridging speed, block placement and rod timing all improve faster with somebody watching the same thing.',
          'For example, a pair can replay a four-team Bedwars rush 6 times in an hour and change one thing each time: the bridge angle, the block choice, then the retreat. A top PvPer from Duoly costs {{mcPro}} per hour and a skilled PvPer {{mcPlus}}, with {{pct3}} off 3 hours and {{pct5}} off 5. Finally, a booking is shared playing time. PvP Coaching and Bedwars Coaching are the separate hourly lessons, and both run using Discord screen share.',
        ],
      },
      {
        heading: 'How much does a Minecraft partner cost?',
        paragraphs: [
          'Every Minecraft service on Duoly is a flat hourly price, because Minecraft has no rank to price against. PvP Duo Pro is {{mcPro}} per hour with a top PvPer, PvP Duo is {{mcPlus}} with a skilled PvPer, a Survival Partner is {{mcSmp}}, Survival Together is {{mcSurv}}, Beat the Game is {{mcDragon}} and a minigames night is {{mcMini}}. Finally, we read every number here from Duoly checkout in November 2026, and the line under the price cards carries the exact date.',
          'Bundles cut the total on the main service. For example, PvP Duo Pro costs {{mcPro3}} for 3 hours with {{pct3}} off, {{mcPro5}} for 5 hours with {{pct5}} off and {{mcPro10}} for 10 hours with {{pct10}} off. Prices in US dollars follow the daily rate from the European Central Bank plus 1%, so the dollar figure moves a little day to day. Minecraft coaching from Duoly has separate prices on the coaching page, agreed using Discord.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. PvP Duo Pro is the top option from Duoly at {{mcPro}} per hour, and the hour count decides your bundle discount: 3 hours take {{pct3}} off and 5 hours {{pct5}} off in November 2026.',
      'Second, add the server and the edition. For example, name Hypixel on Java, your own world, or a realm on Bedrock, then add the mode and the language you want on voice.',
      'Finally, meet your partner in the order chat. Send your Minecraft name, agree on voice using Discord and whitelist your partner if the session is on your own world. A single PvP Duo hour costs {{mcPlus}}, and 5 hours take {{pct5}} off.',
    ],
    prepare: [
      'A Minecraft name is the account name your partner needs to join, and a private world also needs your partner added to the whitelist.',
      'First, name the edition. Java and Bedrock are separate clients with separate accounts, so a Hypixel session and a Bedrock realm are different bookings.',
      'Say which server: a public network such as Hypixel, a private SMP with its address, or your own single-player world opened to a friend.',
      'For survival, say how far the world has got, for example 1) a fresh spawn, 2) full iron gear or 3) ready for a stronghold.',
      'Test your microphone and your audio using Discord, then say whether you want quiet building or constant calls.',
      'Finally, book the hours you want up front, because the bundle discount applies to one order rather than to hours added later: 1 hour is {{mcPro}} and 10 hours cost {{mcPro10}} with {{pct10}} off in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Does a Minecraft booking work on Bedrock?',
        'Yes: name Java or Bedrock when you book, because the 2 editions are separate clients and your partner needs the right one to join.',
      ],
      [
        'Can a partner join my own survival world?',
        'Yes: a Survival Partner is {{mcSmp}} per hour on your SMP or a fresh world, and you add your partner to the whitelist before the hour starts.',
      ],
      [
        'Can I book someone just for Bedwars?',
        'Yes: PvP Duo covers Bedwars, SkyWars, Duels, UHC and Box PvP on the network you name, from {{mcPlus}} per hour with {{pct3}} off 3 hours.',
      ],
      [
        'Is there a rank picker for Minecraft?',
        'No: Minecraft has no ladder, so every service holds one flat price and a booking asks for 2 things instead, 1) a server and 2) an edition.',
      ],
      [
        'Can we beat the Ender Dragon together?',
        'Yes: a Beat the Game hour is {{mcDragon}} per hour, covering gear, finding a stronghold and the End fight itself with an experienced partner.',
      ],
      [
        'How do I find free Minecraft players?',
        'First, try a server lobby party or a Minecraft LFG Discord. For example, post on your SMP forum with the edition, the server and your time zone in November 2026.',
      ],
    ],
    closing:
      'A Minecraft booking from Duoly is one partner on the server you name, for the hours you choose, with no rank picker anywhere. PvP Duo Pro is {{mcPro}} per hour and 5 hours cost {{mcPro5}} with {{pct5}} off, against {{pct3}} off 3. First, send the server address and the edition. For example, ask for a Bedwars main when your beds keep falling in the first rush, agreed using Discord.',
  },
  {
    slug: 'lfg',
    gameSlug: 'arc-raiders',
    title: 'ARC Raiders LFG: Find a Duo for Raids | Duoly',
    h1: 'ARC Raiders LFG: find a duo for your next raid',
    lead: 'Find ARC Raiders teammates for raids, loot routes and clean extractions. Book a reviewed raider by the hour who knows the maps and the safe ways out.',
    description: (price) =>
      `Find ARC Raiders teammates and book a reviewed duo raider ${price}. Compare a map learning hour, Duo Pro raids and an elite high-risk run.`,
    service: 'duo2',
    accent: '#ff9f6e',
    services: {
      duo1: 'An hour of raids with an experienced raider who knows the loot spots and the safe ways out.',
      duo2: 'An hour with a Veteran who handles fights, picks the routes and gets you out with your loot.',
      duo3: 'An hour with an elite raider for high-risk maps, hard fights and big extractions.',
      learn:
        'An hour of relaxed runs to learn the maps, the best loot routes and where to extract.',
    },
    facts: [
      'Checked by Duoly before any order',
      'Experienced, Veteran or elite raiders',
      'Loot routes, fights and extraction points',
      'Your own account, Europe through to Oceania',
    ],
    formatHeading: 'What is an ARC Raiders teammate booking?',
    stepsHeading: 'How do you book an ARC Raiders duo?',
    prepareHeading: 'How should you prepare for your first raid together?',
    faqHeading: 'Questions before you drop?',
    pricesChecked: '2026-11-09',
    pricesIntro:
      'An ARC Raiders booking is an hourly price, and ARC Raiders has no rank picker on Duoly: every service holds one flat price for every player. First, pick the tier by the raid you want. Learn the Maps is {{arcLearn}} per hour, Duo Plus is {{arcPlus}}, Duo Pro from Duoly is {{arcPro}} with a Veteran and Duo Apex is {{arcTop}} with an elite raider. Second, bundles cut the total: 3 hours take {{pct3}} off, 5 hours take {{pct5}} off and 10 hours take {{pct10}} off. For example, a player weighing one hour against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, we read every figure here from Duoly checkout in November 2026.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed ARC Raiders player raids with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. ARC Raiders is an extraction shooter from Embark Studios, so the hour is judged by what you carry out rather than by a scoreboard. Duo Pro is the Veteran service from Duoly at {{arcPro}} per hour, and Learn the Maps is the cheapest booking at {{arcLearn}}. First, a raid holds a squad of 3, so a booked partner fills 1 seat and Full Squad is the service that fills 2. Bundles cut the total in November 2026, {{pct3}} off 3 hours up to {{pct10}} off 10. For example, the order chat is where you agree the map and the voice setup using Discord.',
    sections: [
      {
        heading: 'How does an ARC Raiders duo split a raid?',
        paragraphs: [
          'A raid is one trip to the surface, and a duo has 3 jobs to share: looting, watching and knowing the way out. First, agree the route before the drop, because a pair that loots the same room twice has spent half the timer on one building. Second, split the work inside a room: one player takes containers while the other watches the door and the sky. Finally, name the extraction point out loud before anyone is heavy, since a full bag changes which exit is realistic.',
          'For example, a player who keeps dying with a full bag books Duo Pro from Duoly at {{arcPro}} per hour and spends the hour practising the last 2 minutes of a raid instead of the first 20. Duo Plus is {{arcPlus}} per hour with an experienced raider and Duo Apex is {{arcTop}} with an elite one, both with {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026. ARC machines and other raiders both hit a loud fight, so the quiet route is usually the profitable one.',
        ],
      },
      {
        heading: 'Learn the Maps or Duo Pro: which hour should you book?',
        paragraphs: [
          'Learn the Maps is the relaxed ARC Raiders booking at {{arcLearn}} per hour, and the hour goes on routes, loot spots and extraction points rather than on fights. First, book that hour when the map itself is the problem: a player who cannot name an exit loses kit to the timer rather than to other raiders. Second, Duo Pro is the Veteran hour at {{arcPro}}, which suits a player who already knows the map and keeps losing the fight at the end.',
          'Duo Apex at {{arcTop}} per hour is the elite tier, for high-risk maps and the big extractions where several squads want the same exit. Finally, all four services hold one flat price for every player, because ARC Raiders has no rank on Duoly, and bundles take {{pct3}} off 3 hours and {{pct5}} off 5 in November 2026. For example, book one Learn the Maps hour and one Duo Pro hour with the same raider, so the second hour starts with a shared route, agreed using Discord.',
        ],
      },
      {
        heading: 'How much does an ARC Raiders duo cost?',
        paragraphs: [
          'Every ARC Raiders service on Duoly is a flat hourly price, because the game has no ladder to price against. Learn the Maps is {{arcLearn}} per hour, Duo Plus is {{arcPlus}} with an experienced raider, Duo Pro is {{arcPro}} with a Veteran and Duo Apex is {{arcTop}} with an elite raider. Finally, we read every number here from Duoly checkout in November 2026, and the line under the price cards carries the exact date.',
          'Bundles cut the total on the main service. For example, Duo Pro costs {{arcPro3}} for 3 hours with {{pct3}} off, {{arcPro5}} for 5 hours with {{pct5}} off and {{arcPro10}} for 10 hours with {{pct10}} off. Prices in US dollars follow the daily rate from the European Central Bank plus 1%, so the dollar figure moves a little day to day. ARC Raiders coaching has separate prices: PvP and Extraction is the hourly lesson, agreed using Discord.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is the Veteran option from Duoly at {{arcPro}} per hour, and the hour count decides your bundle discount: 3 hours take {{pct3}} off and 5 hours {{pct5}} off in November 2026.',
      'Second, add your platform, the broad area you play in and your language. For example, name Europe or North America, then say which map you want to run and whether you are after loot or fights.',
      'Finally, meet your raider in the order chat. Agree on voice using Discord, settle the route and the extraction point, then add each other with the Embark ID. A single Learn the Maps hour costs {{arcLearn}}, and 5 hours take {{pct5}} off.',
    ],
    prepare: [
      'An Embark ID is the account name your raider needs for the friend request, and the request has to be accepted before the first raid.',
      'First, name the broad area you play in, because ARC Raiders matches on ping across Europe, North America, South America, Asia, Oceania and the Middle East.',
      'Say what you want out of the hour, for example a quiet loot route, a specific quest item or practice at winning the fight near an exit.',
      'Bring kit you are willing to lose plus a backup loadout, for example 1) a cheap raid kit and 2) one spare weapon, because a raid can take both.',
      'Test your microphone using Discord first, then agree on 3 calls: contact, moving and extracting.',
      'Finally, book the hours you want up front, because the bundle discount applies to one order rather than to hours added later: 1 hour is {{arcPro}} and 10 hours cost {{arcPro10}} with {{pct10}} off in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Is there a rank picker for ARC Raiders?',
        'No: ARC Raiders has no ladder on Duoly, so all 4 teammate services hold one flat hourly price for every player.',
      ],
      [
        'Can I book an hour just to learn a map?',
        'Yes: Learn the Maps is {{arcLearn}} per hour of relaxed runs covering loot routes and extraction points, with {{pct3}} off 3 hours in November 2026.',
      ],
      [
        'Does a booking fill a full squad?',
        'No: a booking adds 1 raider, so a pair covers 2 of 3. Full Squad and Escort Run are the Teams services that bring more players.',
      ],
      [
        'What happens if we die mid raid?',
        'An extraction shooter takes the kit you were carrying, so the hour continues with a fresh loadout and a new raid rather than a retry.',
      ],
      [
        'Is a duo hour the same as ARC Raiders coaching?',
        'No: a duo hour is shared raiding time. PvP and Extraction is the hourly lesson on fights, third parties and clean extractions.',
      ],
      [
        'How do I find free ARC Raiders teammates?',
        'For example, post in an ARC Raiders LFG Discord with your area and the map you want to run, or invite a squadmate you got out alive with.',
      ],
    ],
    closing:
      'Duo Pro is the ARC Raiders session with a Veteran raider from Duoly at {{arcPro}} per hour, and 5 hours cost {{arcPro5}} with {{pct5}} off, against {{pct3}} off 3. A raid squad holds 3, so a booked raider fills 1 seat and Full Squad covers 2. For example, ask for a Learn the Maps hour first when you cannot yet name an extraction point, agreed using Discord.',
  },
  {
    slug: 'lfg',
    gameSlug: 'deadlock',
    title: 'Deadlock LFG: Find Teammates for Ranked | Duoly',
    h1: 'Deadlock LFG: find teammates for your next match',
    lead: 'Find Deadlock teammates for ranked or unranked matches. Book a reviewed player who lanes with you, secures souls and calls the Urn and Mid Boss timings.',
    description: (price) =>
      `Find Deadlock teammates and book a reviewed duo partner ${price}. Compare ranked tiers from Oracle to Ascendant and relaxed unranked matches.`,
    service: 'duo2',
    accent: '#8ad6c8',
    services: {
      duo1: 'Ranked with an Oracle+ teammate who lanes with you, secures souls and calls the rotation.',
      duo2: 'Ranked with a Phantom+ teammate who calls Urn runs, Mid Boss timings and the next lane.',
      duo3: 'Ranked with an Ascendant+ teammate for high lobbies and fights that need one player to win them.',
      unranked:
        'Unranked matches with a strong teammate while you learn a hero or the map.',
    },
    facts: [
      'Checked by Duoly before any order',
      'Oracle+, Phantom+ or Ascendant+ partners',
      'Souls, Urn runs and Mid Boss timings',
      'Your own account, Europe through to Oceania',
    ],
    formatHeading: 'What is a Deadlock teammate booking?',
    stepsHeading: 'How do you book a Deadlock teammate?',
    prepareHeading: 'How should you prepare for your first Deadlock session?',
    faqHeading: 'Questions before you queue?',
    pricesChecked: '2026-11-09',
    pricesIntro:
      'A Deadlock teammate booking is a per-match price set by the mode and, in ranked, by your own rank. First, pick the mode, because unranked matches hold one price at every rank while ranked does not. Second, open the rank list on a ranked card: Deadlock has 11 ranks from Initiate up to Eternus, and Duo Pro from Duoly is {{dlProLow}} per match at Initiate and {{dlProHigh}} at Eternus. Bundles then cut the total: 3 matches take {{pct3}} off, 5 matches take {{pct5}} off and 10 matches take {{pct10}} off. For example, an Emissary player weighing one match against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, we read every figure here from Duoly checkout in November 2026.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Deadlock player queues with you on your own account, for the number of matches you select, from 1 match up to 10 matches. Duo Pro is the ranked service with a Phantom+ teammate from Duoly at {{dlPro}} per match, and unranked is the cheapest booking at {{dlUnranked}}. First, Deadlock is 6v6, so a booked teammate fills 1 of the 6 seats and 6-Stack Fill is the service that fills more. A Deadlock match runs about 35 minutes, so a 3 match bundle is an evening rather than a quick queue. Bundles cut the total in November 2026, {{pct3}} off 3 matches up to {{pct10}} off 10. For example, the order chat is where you agree the hero pair using Discord.',
    sections: [
      {
        heading: 'Which Deadlock lanes and heroes make a good duo?',
        paragraphs: [
          'A good Deadlock duo is a pair of heroes who answer different problems in the same lane. A hero with a stun or a slow plus a hero with burst damage is the clearest pair: one player stops the target and the other removes it. Two sustain heroes hold a lane longer but close no fights, and 2 burst heroes trade hard and then both have nothing left. First, say which hero you actually play before the pair is chosen.',
          'Second, souls are the currency, and a lane partner changes how many you keep: shooting a soul orb confirms it for your team, and shooting it as the enemy denies it. For example, an Emissary player who books a Phantom+ teammate from Duoly at {{dlPro}} per match learns which orbs are worth contesting. Duo Plus is {{dlPlus}} per match with an Oracle+ partner and Duo Apex is {{dlTop}} with an Ascendant+ one, both with {{pct3}} off 3 matches and {{pct5}} off 5. Finally, agree the lane using Discord before the first queue.',
        ],
      },
      {
        heading: 'Ranked or unranked: which Deadlock match to book?',
        paragraphs: [
          'Unranked is the Deadlock mode with no rank attached, at {{dlUnranked}} per match, which makes unranked the honest first session: a new hero, a new item build or a first evening on voice with somebody new. First, book unranked when the hero is new, because a 35 minute match is a long time to learn an ability list under pressure.',
          'Ranked is the mode with the 11 ranks from Initiate to Eternus, priced by the rank you sit at: Duo Pro is {{dlPro}} per match at Emissary, with {{pct3}} off 3 matches and {{pct5}} off 5 in November 2026. Second, a ranked match rewards the parts a partner actually changes: the Urn run nobody escorts, the Mid Boss attempt with no vision, the lane that goes unanswered for 5 minutes. Items come in 3 categories, Weapon, Vitality and Spirit, so a partner can also name the column your build is missing. For example, ask for a Phantom+ teammate who calls Mid Boss timings, agreed using Discord.',
        ],
      },
      {
        heading: 'How much does a Deadlock duo cost?',
        paragraphs: [
          'Duo Pro is the ranked Deadlock service with a Phantom+ teammate, priced per match by your own rank. First, find your own rank on the card. An Emissary player in Europe pays {{dlPro}} per match, an Initiate player pays {{dlProLow}} and an Eternus player pays {{dlProHigh}}, so the Duo Pro price rises with your own rank. Finally, we read every number here from Duoly checkout in November 2026, and the line under the price cards carries the exact date.',
          'Bundles cut the total for every rank. For example, an Emissary player pays {{dlPro3}} for 3 matches with {{pct3}} off, {{dlPro5}} for 5 matches with {{pct5}} off and {{dlPro10}} for 10 matches with {{pct10}} off. Unranked holds one flat price at every rank instead, at {{dlUnranked}} per match, so only ranked moves with your rank. Deadlock coaching from Duoly has separate prices on the coaching page, agreed using Discord.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total match count first, before checkout. Duo Pro is the ranked option from Duoly with a Phantom+ teammate, and the match count decides your bundle discount: 3 matches take {{pct3}} off and 5 matches {{pct5}} off in November 2026.',
      'Second, add the broad area you play in, your rank, your hero pool and your language. For example, name Europe or North America, Emissary, and 2 heroes you are comfortable on.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord, settle the lane and the hero pair, then add each other by Steam name. A single unranked match costs {{dlUnranked}}, and 5 matches take {{pct5}} off.',
    ],
    prepare: [
      'A Steam name is the account name your teammate needs for the friend invite, because Deadlock runs through the Steam client.',
      'First, name the broad area you play in, since Deadlock matches on ping across Europe, North America, South America, Asia, Oceania and the Middle East.',
      'Bring 2 heroes you trust plus 1 backup, for example 1) a burst hero and 2) a hero with a stun, so the pair still works when a pick is taken.',
      'Plan for a long match: about 35 minutes each, so 3 matches fill an evening and a 10 match bundle spans several sessions.',
      'Test your microphone and your audio using Discord, then agree on 3 calls: Urn, Mid Boss and back.',
      'Finally, book the matches you want up front, because the bundle discount applies to one order rather than to matches added later: 1 match is {{dlPro}} and 10 matches cost {{dlPro10}} with {{pct10}} off in November 2026. Keep your login private.',
    ],
    faq: [
      [
        'Can I book a teammate for unranked only?',
        'Yes: unranked is {{dlUnranked}} per match at one flat price for every rank, which suits a new hero or a first evening together.',
      ],
      [
        'How long is a Deadlock match?',
        'About 35 minutes, so Duoly prices Deadlock per match rather than per hour and a 3 match bundle is usually a full evening.',
      ],
      [
        'Which ranked tiers can I book?',
        'Three: Duo Plus with an Oracle+ teammate at {{dlPlus}}, Duo Pro with a Phantom+ teammate at {{dlPro}} and Duo Apex with an Ascendant+ teammate at {{dlTop}}.',
      ],
      [
        'Does a booking fill all six seats?',
        'No: a booking adds 1 teammate, so a booked pair covers 2 of 6. 6-Stack Fill is the Teams service for the remaining seats.',
      ],
      [
        'Is a duo the same as Deadlock coaching?',
        'No: a duo is shared playing time at {{dlPro}} per match, with {{pct3}} off 3 matches and {{pct5}} off 5 in November 2026. Macro and Souls is the separate hourly lesson.',
      ],
      [
        'How do I find free Deadlock teammates?',
        'For example, post in a Deadlock LFG Discord with your area, rank and hero pool, or add a player from the Steam match history after a good game.',
      ],
    ],
    closing:
      'Duo Pro is the ranked Deadlock session with a Phantom+ teammate from Duoly, and 5 matches at Emissary in Europe cost {{dlPro5}} with {{pct5}} off, against {{pct3}} off 3. Deadlock is 6v6, so a booked teammate fills 1 seat and 6-Stack Fill covers the rest. For example, ask for a partner with a stun when your hero is pure burst, agreed using Discord.',
  },
];

export const intentForGame = (slug: string) =>
  intentPages.find((page) => page.gameSlug === slug);
export const intentPath = (page: IntentPage) =>
  `/games/${page.gameSlug}/${page.slug}`;
