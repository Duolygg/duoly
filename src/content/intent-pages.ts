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
          'Top lane gains the least from a duo, so a top laner should ask for calls about pressure. For example, a Gold support on EUW can book Duo Pro with a Master+ ADC from Duoly for {{lolPro}} per game in 2026. Duo Plus with a Diamond 4+ teammate costs {{lolPlus}} per game at the same rank. Booking 3 games with the same partner gets {{pct3}} off. Useful duo calls stay short: a summoner spell is down or the wave is pushing. Your duo fills 1 seat, and the other 3 players still come from the normal queue.',
        ],
      },
      {
        heading: 'Which League mode should you book: ARAM, normals or ranked?',
        paragraphs: [
          'ARAM is the Howling Abyss mode with random champions, one lane and constant team fights. ARAM Night costs {{lolAram}} per game, and 3 games cost {{lolAram3}} with the {{pct3}} discount in November 2026. Normal Draft is the better pick for practicing a champion or a new role with no LP on the line. Swiftplay is the shorter Summoner’s Rift mode for a quick evening session with a teammate on voice.',
          'Ranked duo needs 2 accounts on the same server, inside the current duo rules from Riot Games. Share your rank and server before the first game, then check the client restrictions together. For example, a Gold player on EUW can queue Solo/Duo with a Master+ teammate booked through Duoly. A listed teammate rank describes the teammate tier and never overrides queue eligibility. You control your champion, your decisions and your account in every match, and the booking pays for playing together.',
        ],
      },
      {
        heading: 'How much does a League duo cost in 2026?',
        paragraphs: [
          'Duo Pro is the ranked League service with a Master+ teammate, priced per game by your own rank. Every price here comes from the Duoly checkout calculator. We found these numbers by running the calculator on 7 November 2026. A Gold player on EUW pays {{lolPro}} per game for Duo Pro. An Iron player pays {{lolProIron}} per game, and a Diamond player pays {{lolProDiamond}} per game, so the Duo Pro price rises with your own rank.',
          'Bundles cut the total for every rank. For example, a Gold player pays {{lolPro3}} for 3 games with {{pct3}} off, {{lolPro5}} for 5 games with {{pct5}} off and {{lolPro10}} for 10 games with {{pct10}} off. Casual modes keep one flat price, so ARAM Night, Normal Draft and Swiftplay each cost {{lolAram}} per game for every rank. Prices in US dollars use the daily exchange rate from the European Central Bank plus 1%. Coaching has separate prices on the League coaching page.',
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
        'Both accounts need the same server and the current ranked rules from Riot Games. Share your server and rank before starting.',
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
      'Duo Pro is the ranked League session with a Master+ teammate from Duoly, at {{lolPro}} per game for Gold on EUW in 2026, with {{pct3}} off 3 games and {{pct5}} off 5 games. For example, 3 games at Gold cost {{lolPro3}}.',
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
      'A Duoly duo booking is a paid session where one reviewed Marvel Rivals player joins your team for each match you select, from 1 match up to 10 matches. Duo Pro is the Competitive service with a Grandmaster+ teammate. For example, a Platinum player in Europe pays {{mrPro}} per match for Duo Pro in November 2026. Bundles lower the total: 3 matches get {{pct3}} off, 5 matches get {{pct5}} off and 10 matches get {{pct10}} off. Quick Match and Arcade cost {{mrQuick}} per match, and Team-Up Duo costs {{mrTeamup}} per match. Your partner fills 1 of the 6 seats, so the other 4 players come from your party or the normal queue. Every booking opens an order chat on Duoly, where you agree on roles, voice and a start time before the first match. For a lesson on one hero, choose Hero Coaching from Duoly instead.',
    sections: [
      {
        heading: 'Which Marvel Rivals roles make a good duo?',
        paragraphs: [
          'A good Marvel Rivals duo is a pair of roles with one clear plan for each fight. Vanguard and Strategist is the steadiest pair: the Vanguard holds the front line, and the Strategist keeps the Vanguard alive from a safe angle. Agree on the route into the objective first, and call when the front line moves forward. Duelist and Strategist needs the same clarity about distance, because a Duelist chasing a target around a corner leaves healing range.',
          'Two Duelists need a shared entry and an exit. Decide who starts, who follows and which cooldown means a reset. For example, a Platinum Strategist in Europe can book Duo Pro with a Grandmaster+ Vanguard from Duoly for {{mrPro}} per match in 2026. Duo Plus with a Diamond+ teammate costs {{mrPlus}} per match at the same rank. Booking 3 matches with the same partner gets {{pct3}} off. Share your main role and one comfortable second role when booking.',
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
          'Competitive is the ranked Marvel Rivals mode, and a duo needs ranks inside the current party rules from NetEase Games. Bring your rank and platform, then check party eligibility together before queueing. For example, a Platinum player in Europe pays {{mrPro}} per match for Duo Pro with a Grandmaster+ partner. You control your hero, your decisions and your account in every match, and the booking pays for playing together.',
        ],
      },
      {
        heading: 'How much does a Marvel Rivals duo cost in 2026?',
        paragraphs: [
          'Duo Pro is the Competitive Marvel Rivals service with a Grandmaster+ teammate, priced per match by your own rank. Every price here comes from the Duoly checkout calculator. We found these numbers by running the calculator on 7 November 2026. A Platinum player in Europe pays {{mrPro}} per match for Duo Pro, and a Gold player pays {{mrProGold}} per match, so the Duo Pro price rises with your own rank.',
          'Bundles cut the total for every rank. For example, a Platinum player pays {{mrPro3}} for 3 matches with {{pct3}} off, {{mrPro5}} for 5 matches with {{pct5}} off and {{mrPro10}} for 10 matches with {{pct10}} off. Quick Match and Arcade keep one flat price of {{mrQuick}} per match for every rank. Prices in US dollars use the daily exchange rate from the European Central Bank plus 1%. Hero Coaching has separate prices on the Marvel Rivals coaching page.',
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
        'Yes. Competitive duo services work when your platform, accounts and ranks meet the current party rules from NetEase Games.',
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
      'Duo Pro is the Competitive Marvel Rivals session with a Grandmaster+ teammate from Duoly, at {{mrPro}} per match for Platinum in Europe in 2026, with {{pct3}} off 3 matches and {{pct5}} off 5 matches. For example, 3 matches at Platinum cost {{mrPro3}}.',
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
      'Pokemon Unite teammate prices from Duoly start at {{puPlus}} per game and rise with your own rank. For Duo Pro with a Master teammate, a player ranked Expert in Europe pays {{puPro}}. Standard and Quick Battle keeps one flat price for every rank. First, open the rank list on the card, because Beginner and Legend do not pay the same. Bundles then cut the total: 3 games get {{pct3}} off, 5 games get {{pct5}} off and 10 games get {{pct10}} off. For example, 3 Duo Pro games at Expert cost {{puPro3}}. Every booking adds one partner, and lanes, voice using Discord and a start time are agreed in the order chat.',
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
          'Standard and Quick Battle is the better starting point when you want to try a role or get used to making calls with a new partner. Ranked makes more sense once you know your Pokemon, have held items ready and can queue together under the current party rules. First, share your rank and region so eligibility can be checked before anyone pays.',
          'For example, a player ranked Expert in Europe pays {{puPro}} per game for Duo Pro with a Master teammate, and 3 games cost {{puPro3}} after the {{pct3}} bundle discount. Second, choose the game count around the time you actually have, and leave room to talk between queues. A Ranked match runs 10:00. Finally, a teammate from Duoly coordinates lanes and objectives with you using Discord voice; nobody can promise a win for a five-player team.',
        ],
      },
    ],
    steps: [
      'A Pokemon Unite booking is one partner plus a game count, so start with the mode: Ranked, Standard or Quick Battle. Bookings run from 1 game up to 10. The price cards show every service, and ranked prices follow your own rank.',
      'Share your rank, region, language and preferred lane. Ask for a complementary role, such as a Defender alongside your Attacker, then confirm ranked party eligibility together before paying. For example, 3 games take {{pct3}} off the total.',
      'Finally, meet in the order chat, exchange Trainer details and agree on voice using Discord. A teammate from Duoly joins on a separate account, so keep passwords private and send the game invite yourself.',
    ],
    prepare: [
      'Preparation for a Pokemon Unite session is a short checklist: an updated client, Trainer details and one lane preference.',
      'Update Pokemon Unite and have your Trainer details ready, because a lobby invite needs the exact name.',
      'Bring a familiar Pokemon and a backup in case another player locks the same one, for example 1) an Attacker you trust and 2) a Defender for the lane.',
      'Check held items and battle items before the first lobby. Each Pokemon carries 3. Swapping items late in a series only wastes queue time.',
      'Tell your partner which lane you prefer and whether you want relaxed chat or short objective calls using Discord.',
      'Agree on a retreat call and an objective call, then check the active arena and the 2026 party rules together.',
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
      'A Valorant teammate booking is a per-game price set by the mode and, in Competitive, by your own rank. First, pick the mode, because Swiftplay, Unrated and a Deathmatch warm-up hold one price at every rank while Competitive does not. Second, open the rank list on a Competitive card, since an Iron player and an Immortal player do not pay the same. Bundles then cut the total: 3 games take {{pct3}} off, 5 games take {{pct5}} off and 10 games take {{pct10}} off. For example, a Gold player weighing one game against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here is read from Duoly checkout, and the line under the cards says when it was last read.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Valorant player queues with you on your own account, for the number of games you select, from 1 game up to 10 games. Duo Pro is the Competitive service with an Immortal+ teammate, and Duo Plus and Duo Apex sit either side of it on rank. Swiftplay, Unrated and a Deathmatch warm-up are the casual bookings, and the price table below lists all six together. Your teammate fills 1 of the 5 seats, so the other 3 players come from the normal queue. Finally, every booking opens an order chat on Duoly. For example, that is where you agree the agent pair, the start time and whether voice runs using Discord or in the Valorant party. Nobody else logs into your account, and nobody can promise you a rank. For a lesson on one agent, choose Valorant coaching from Duoly instead.',
    sections: [
      {
        heading: 'Which Valorant agents and roles make a good duo?',
        paragraphs: [
          'A good Valorant duo is a pair of agents whose utility lands on the same site inside the same 3 seconds. The 4 agent roles come from Riot Games: Duelist, Controller, Initiator and Sentinel. Controller and Duelist is the classic pair. The smoke goes down, and the Duelist enters through it on a count. Initiator and Duelist is the second strong pair, because a Breach stun or a Sova dart gives the entry a target instead of a guess. Sentinel and Controller is the third, holding the far site and rotating together.',
          'For example, a Sentinel player who books an Immortal+ Initiator gets a dart before every entry instead of a guess at first contact. Duo Plus pairs you with an Ascendant+ teammate at {{valPlus}} per game, and Duo Apex with a Radiant one at {{valTop}}. Pick the tier by the lobbies you queue into now rather than the ones you want to reach. Finally, name your agent pool in the order chat using Discord, so neither player instant-locks the same role.',
        ],
      },
      {
        heading: 'Should you book Competitive, Swiftplay or Unrated?',
        paragraphs: [
          'Swiftplay is the short Valorant mode of about 15 minutes with the full buy system, at {{valSwift}} per game, so it suits a warm-up or a first session with a new teammate. Unrated is the full 13-round format with no rank on the line at {{valUnrated}} per game, which makes Unrated the honest place to learn a new agent or a second role. A Deathmatch warm-up is {{valDm}} per game and fixes aim rather than teamplay, so book one before a ranked block instead of inside it. All three hold that price at every rank, while Competitive is priced by the rank you sit at.',
          'Competitive is the ranked mode, and a duo needs both accounts inside the current rank restriction from Riot Games. Read the restriction message in the client together before the first game, because a listed teammate tier never overrides queue eligibility. For example, an Iron player and a Radiant teammate cannot queue Competitive together whatever the listing says, so Swiftplay or Unrated is the honest booking for that pair.',
        ],
      },
      {
        heading: 'How much does a Valorant duo cost?',
        paragraphs: [
          'Duo Pro is the Competitive Valorant service with an Immortal+ teammate, priced per game by your own rank. First, find your own rank on the card. A Gold player on EU pays {{valPro}} per game. An Iron player pays {{valProIron}} per game, and an Immortal player pays {{valProImmortal}} per game, so the Duo Pro price rises with your own rank. Finally, every number on this page is read from Duoly checkout rather than a list kept by hand, and the price cards carry the date it was last read.',
          'Bundles cut the total for every rank. For example, a Gold player pays {{valPro3}} for 3 games with {{pct3}} off, {{valPro5}} for 5 games with {{pct5}} off and {{valPro10}} for 10 games with {{pct10}} off. The casual modes hold one flat price at every rank instead, so only Competitive moves with your rank. Valorant coaching has separate prices on the coaching page.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total game count first, before checkout. Duo Pro is the Competitive option from Duoly with an Immortal+ teammate, and the game count is what decides your bundle discount.',
      'Second, add your region, rank, main role and language. The written request is the first thing your new teammate reads. For example, name EU or NA, your rank and the role you want covered, such as Controller or Sentinel.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord or the in-game party, settle the agent pair, then send a party invite from the Valorant client. The chat stays open for the whole order, so a later game starts from the same place.',
    ],
    prepare: [
      'A Riot ID is the in-game name plus a tagline, for example Name#EUW. Riot IDs from Riot Games replaced the older separate names, and your teammate needs the full Riot ID to send a party invite.',
      'Pick the right region before booking, because EU, NA, AP, KR, BR and LATAM keep separate ranked ladders and separate friend lists.',
      'Test your microphone and your Discord audio first, then say whether you want relaxed chat or short round calls.',
      'Bring a small agent pool, for example 2 agents for your main role and 1 agent for a second role.',
      'Agree who buys utility on a half buy, so neither player ends the round holding full credits and no smokes.',
      'Book the games you want up front, because the bundle discount applies to one order rather than to games you add later. Keep your login private and stay on your own account.',
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
        'Can we queue Competitive together at any rank?',
        'Both accounts need the same region and the current rank restriction from Riot Games, so read the queue message together first.',
      ],
      [
        'Does a duo booking fill the whole team?',
        'No, a duo booking adds 1 teammate, so a booked pair covers 2 of 5. The other 3 seats come from the normal queue.',
      ],
      [
        'Is this the same as Valorant coaching?',
        'No, duo sessions are shared playing time, and Valorant coaching is the separate hourly lesson, VOD review or crosshair session.',
      ],
      [
        'How do I find free Valorant teammates?',
        'For example, start with the VALORANT Discord or the VALORANT LFG server. Include region, rank, role and mode.',
      ],
    ],
    closing:
      'Duo Pro is the Competitive Valorant session with an Immortal+ teammate from Duoly, priced per game by your own rank, with bundle discounts on 3, 5 and 10 games. For example, ask for an Immortal+ Duelist if your agent pool is all smokes. Pick your mode, name the role you want covered and book the games you have time for tonight.',
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
      'A Fortnite duo booking is an hourly price set by the mode and, in Ranked, by your own rank. First, pick the mode, because Zero Build, Reload and Creative box fights hold one price at every rank while Ranked Duos does not. Second, open the rank list on a Ranked card, since a Gold player and an Unreal player do not pay the same. Bundles then cut the total: 3 hours take {{pct3}} off, 5 hours take {{pct5}} off and 10 hours take {{pct10}} off. For example, a Platinum player weighing one hour against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here is read from Duoly checkout, and the line under the cards says when it was last read.',
    format:
      'A Duoly duo booking is a paid session where one reviewed Fortnite player drops with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. Duo Pro is the Ranked service with an Unreal teammate, and Duo Plus and the tournament-level tier sit either side of it on rank. Zero Build, Reload and Creative box fights are the casual bookings, and the price table below lists all six together. Your partner fills the second seat in Duos, so a Trio or a Squad pulls the rest from the queue or your friends list. Finally, every booking opens an order chat on Duoly. For example, that is where you agree the drop spot, the start time and whether voice runs using Discord or in the Fortnite party. Nobody else logs into your account, and nobody can promise you a rank. For building drills alone, choose Fortnite coaching from Duoly instead.',
    sections: [
      {
        heading: 'Zero Build or Builds: which duo should you book?',
        paragraphs: [
          'Zero Build is the Fortnite mode with building removed, at {{fnZb}} per hour, so cover comes from the map and the mantle rather than from walls and ramps. A Zero Build duo splits the job simply: one player holds the angle, the other pushes when shields break. Builds is the original mode, where a duo needs piece control, a box to reset in and mats to spend. Reload sits between them at {{fnReload}} per hour, with respawns on a small map, and Creative box fights are {{fnBox}} per hour for building practice on its own.',
          'For example, a Zero Build main who books an Unreal partner for Ranked Duos spends the first hour relearning piece control instead of fighting. Say which mode you want before booking, because a Zero Build main and a build fighter train different habits. Duo Plus pairs you with a Champion+ partner at {{fnPlus}} per hour. Finally, pick the tier by the lobbies your rank puts you in now, and agree the drop using Discord before the bus moves.',
        ],
      },
      {
        heading: 'How does a Fortnite duo split the work in a match?',
        paragraphs: [
          'A Fortnite duo is 2 players sharing one drop, one loot path and one rotation plan, on a map that changes every season from Epic Games. First, agree the drop. Then agree who takes the chest side and who takes the floor loot, so the first minute never ends with 2 pistols. Split mats early in Builds, because a duo on 90 wood loses the first build fight. Call rotations by the storm circle rather than by the fight you want, because the storm decides who holds high ground.',
          'In the endgame, 1 player builds and 1 player watches the box line, so the pair keeps eyes on 2. For example, calling a box reset out loud using Discord turns a lost 2v2 into a trade. Squad Fill in the lobby is the free version of the same idea for Trios and Squads, because a random player arrives from Epic Games at no cost. Finally, a booked partner is the version where the hour, the rank and the comms are agreed before anyone queues.',
        ],
      },
      {
        heading: 'How much does a Fortnite duo cost?',
        paragraphs: [
          'Duo Pro is the Ranked Fortnite service with an Unreal teammate, priced per hour by your own rank. First, find your own rank on the card. A Platinum player in Europe pays {{fnPro}} per hour. A Gold player pays {{fnProGold}} per hour, and an Unreal player pays {{fnProUnreal}} per hour, so the Duo Pro price rises with your own rank. Finally, every number on this page is read from Duoly checkout rather than a list kept by hand, and the price cards carry the date it was last read.',
          'Bundles cut the total for every rank. For example, a Platinum player pays {{fnPro3}} for 3 hours with {{pct3}} off, {{fnPro5}} for 5 hours with {{pct5}} off and {{fnPro10}} for 10 hours with {{pct10}} off. The casual modes hold one flat price at every rank instead, so only Ranked moves with your rank. Fortnite coaching has separate prices on the coaching page.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is the Ranked option from Duoly with an Unreal teammate, and the hour count is what decides your bundle discount.',
      'Second, add your platform, region, rank, input and language. For example, name Europe or NA-East, controller or keyboard, and whether you want Builds or Zero Build. Input matters, because a controller player and a keyboard player build at different speeds.',
      'Finally, meet your partner in the order chat. Agree on voice using Discord, settle the drop spot, then add each other with the Epic name. The chat stays open for the whole order, so a later hour starts from the same place.',
    ],
    prepare: [
      'An Epic name is the account name your partner needs for the friend request, and the request has to be accepted before the first queue.',
      'Name your platform and your input. Fortnite runs on PC, PlayStation, Xbox, Nintendo Switch and cloud, and a controller player and a keyboard player warm up differently.',
      'Pick the region before booking, because Europe, NA-East, NA-Central, NA-West, Brazil, Asia, Oceania and Middle East are separate queues with separate ping.',
      'Agree one drop spot and one backup spot, for example a named POI plus the nearest quiet landmark.',
      'Test your microphone on Discord first, then say whether you want quiet games or constant calls.',
      'Book the hours you want up front, because the bundle discount applies to one order rather than to hours you add later. Keep your login private and stay on your own account.',
    ],
    faq: [
      [
        'Can I book a duo partner for Zero Build only?',
        'Yes, Zero Build is the no-building mode, and a Zero Build teammate is booked by the hour at one flat price for every rank.',
      ],
      [
        'Can we play Ranked Duos together?',
        'Yes, Duo Plus and Duo Pro are the Ranked services, with a Champion+ or an Unreal teammate.',
      ],
      [
        'Is Reload a good first session?',
        'Yes, Reload gives respawns on a small map, so a new pair gets many fights inside a single hour.',
      ],
      [
        'Does a duo booking fill a full squad?',
        'No, a booking adds 1 partner, so a Trio or a Squad still needs friends or Squad Fill.',
      ],
      [
        'Can I learn building in a duo session?',
        'Creative box fights include an Unreal teammate showing you how each build went, and Fortnite coaching is the separate drill session.',
      ],
      [
        'How do I find a free Fortnite duo?',
        'For example, post in the Official Fortnite Discord, or turn Fill on in the lobby for a random teammate from Epic Games at no cost.',
      ],
    ],
    closing:
      'Duo Pro is the Ranked Fortnite session with an Unreal teammate from Duoly, priced per hour by your own rank, with bundle discounts on 3, 5 and 10 hours. For example, ask for an Unreal partner on controller if you play on a pad yourself. Pick Builds or Zero Build, name your input and book the hours you have time for tonight.',
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
      'An Overwatch 2 teammate booking is a per-game price set by the mode and, in Competitive, by your own rank. First, pick the mode, because Quick Play, Arcade and a Stadium run hold one price at every rank while Competitive does not. Second, open the rank list on a Competitive card, since a Gold player and a Master player do not pay the same. Bundles then cut the total: 3 games take {{pct3}} off, 5 games take {{pct5}} off and 10 games take {{pct10}} off. For example, a Platinum player weighing one game against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here is read from Duoly checkout, and the line under the cards says when it was last read.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Overwatch 2 player joins your group on your own account, for the number of games you select, from 1 game up to 10 games. Duo Pro is the Competitive service with a Master+ teammate, and Duo Plus and Duo Apex sit either side of it on rank. Quick Play, Arcade and a Stadium run are the casual bookings, and the price table below lists all five together. Your teammate fills 1 of the 5 seats, so the other 3 players come from the normal queue. Finally, every booking opens an order chat on Duoly. For example, that is where you agree the role pair, the start time and whether voice runs using Discord or in the in-game group. Nobody else logs into your account, and nobody can promise you a rank. For a role lesson, choose Overwatch coaching from Duoly instead.',
    sections: [
      {
        heading: 'Which Overwatch 2 roles make a good duo?',
        paragraphs: [
          'Role queue is the Overwatch 2 system from Blizzard Entertainment that locks every team to 1 Tank, 2 Damage and 2 Support, so a duo is a pair of those 5 seats. Tank and Support is the steadiest pair: the Tank takes space, and the Support decides how much space the cooldowns can pay for. Damage and Support is the second pair, because a dive only works when the healing follows the dive. Two Damage players need one shared target and one agreed reset.',
          'For example, a Damage player who books a Master+ Support gets healing that follows the dive instead of a third player holding the back line. Duo Plus pairs you with a Diamond+ teammate at {{owPlus}} per game, and Duo Apex with a Grandmaster+ one at {{owTop}}. Finally, name your role and one comfortable second role when booking, so the pair still works when the first pick is taken.',
        ],
      },
      {
        heading: 'Competitive, Quick Play or Stadium: what should you queue?',
        paragraphs: [
          'Quick Play is the casual Overwatch 2 mode with no rank attached, at {{owQp}} per game, which suits a first session, a new hero or a console evening with voice on. Stadium is the best-of-seven mode where both players spend round money on hero builds, at {{owStadium}} per game, so it rewards a partner who plans the next two rounds rather than the next fight. Both hold that price at every rank, while Competitive is priced by the rank you sit at.',
          'Competitive is the ranked mode, and a group needs ranks inside the current group rules from Blizzard Entertainment. Share your platform too, because Overwatch 2 LFG posts for PlayStation and Xbox are among the most searched, and crossplay settings change which lobby a mixed group lands in. Check the group screen together before queueing, because a listed teammate tier never overrides the group rules.',
        ],
      },
      {
        heading: 'How much does an Overwatch 2 duo cost?',
        paragraphs: [
          'Duo Pro is the Competitive Overwatch 2 service with a Master+ teammate, priced per game by your own rank. First, find your own rank on the card. A Platinum player in Europe pays {{owPro}} per game. A Gold player pays {{owProGold}} per game, and a Master player pays {{owProMaster}} per game, so the Duo Pro price rises with your own rank. Finally, every number on this page is read from Duoly checkout rather than a list kept by hand, and the price cards carry the date it was last read.',
          'Bundles cut the total for every rank. For example, a Platinum player pays {{owPro3}} for 3 games with {{pct3}} off, {{owPro5}} for 5 games with {{pct5}} off and {{owPro10}} for 10 games with {{pct10}} off. The casual modes hold one flat price at every rank instead, so only Competitive moves with your rank. Coaching has separate prices on the Overwatch coaching page.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total game count first, before checkout. Duo Pro is the Competitive option from Duoly with a Master+ teammate, and the game count is what decides your bundle discount.',
      'Second, add your platform, region, rank, role and language. For example, name PlayStation or PC, Europe or Americas, and the role you want covered, such as Tank or Support.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord or the in-game group, settle the role pair, then invite with your BattleTag. The chat stays open for the whole order, so a later game starts from the same place.',
    ],
    prepare: [
      'A BattleTag is the Battle.net name plus a number, for example Name#2154. Your teammate needs the full BattleTag to send a group invite, and console players link the same account.',
      'Name your platform first. Overwatch 2 runs on PC, PlayStation, Xbox and Nintendo Switch, and most LFG posts for the game name a console in the first line.',
      'Pick the region before booking, because Europe, Americas and Asia keep separate queues and separate ping.',
      'Test your microphone and your Discord audio first, then say whether you want fight calls or quiet games.',
      'Bring 2 heroes for your main role and 1 for a second role, so a counterpick does not end the session.',
      'Book the games you want up front, because the bundle discount applies to one order rather than to games you add later. Keep your login private and stay on your own account.',
    ],
    faq: [
      [
        'Can I book a teammate for Quick Play only?',
        'Yes, Quick Play is the casual Overwatch 2 mode, and a Quick Play teammate is booked per game at one flat price for every rank.',
      ],
      [
        'Can we play Competitive role queue together?',
        'Yes, Duo Plus, Duo Pro and Duo Apex are Competitive services, inside the group rules from Blizzard Entertainment.',
      ],
      [
        'Do you support Stadium?',
        'Yes, Stadium Duo is a per-game service, planned round by round with a Master+ teammate who spends build money with you.',
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
      'Duo Pro is the Competitive Overwatch 2 session with a Master+ teammate from Duoly, priced per game by your own rank, with bundle discounts on 3, 5 and 10 games. For example, ask for a Master+ Tank if your group is 2 Damage and a Support. Name your platform, name the role you want covered and book the games you have time for tonight.',
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
      'An Apex Legends teammate booking is an hourly price set by the mode and, in Ranked, by your own rank. First, pick the mode, because the Duos playlist, Mixtape and unranked pubs hold one price at every rank while Ranked does not. Second, open the rank list on a Ranked card, since a Gold player and a Master player do not pay the same. Bundles then cut the total: 3 hours take {{pct3}} off, 5 hours take {{pct5}} off and 10 hours take {{pct10}} off. For example, a Platinum player weighing one hour against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here is read from Duoly checkout, and the line under the cards says when it was last read.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Apex Legends player drops with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. Duo Pro is the Ranked service with a Master or Apex Predator teammate, and Duo Plus sits below it with a Diamond+ partner. The Duos playlist, Mixtape and unranked pubs are the casual bookings, and the price table below lists all five together. In trios your booked teammate fills 1 of the 3 seats, so the third seat comes from auto fill or a friend. Finally, every booking opens an order chat on Duoly. For example, that is where you agree the legend pair, the drop and whether voice runs using Discord or in the in-game squad. Nobody else logs into your account, and nobody can promise you a rank. For movement drills alone, choose Apex coaching from Duoly instead.',
    sections: [
      {
        heading: 'Which Apex legend roles make a good duo?',
        paragraphs: [
          'Apex Legends sorts every legend into 5 classes from Respawn Entertainment: Assault, Skirmisher, Recon, Controller and Support. A good duo takes 2 classes that answer different problems. Controller and Assault is the steadiest pair, because one player owns the ground and the other converts it into damage. Recon and Skirmisher is the second pair: the scan finds the squad, and the Skirmisher picks the angle to hit it from. Support and anything keeps the pair alive long enough to use the plan.',
          'For example, a Skirmisher main who books a Master Controller gets ground to fight from instead of a second player looking for an angle. Say which legends you play before the first drop, because 2 Skirmishers with no Controller lose every long hold. Duo Plus pairs you with a Diamond+ partner at {{apexPlus}} per hour. Finally, the third seat in trios usually comes from auto fill, so leave one class open and agree the drop using Discord.',
        ],
      },
      {
        heading: 'Ranked or the Duos playlist: which should you book?',
        paragraphs: [
          'The Duos playlist is the Apex battle royale format with 2-player squads, which is the honest answer to the common question about playing Apex as a pair, because nobody fills a third seat. Playlists rotate, so open the lobby and check the live list from Respawn Entertainment before you book an hour. For example, a pair who book a Duos hour in a week when Duos is not up end the hour in trios with a stranger. If Duos is down, unranked pubs with the third seat on auto fill is the closest thing to it.',
          'Ranked is the mode with Rookie up to Apex Predator and a real cost for dying early, so it is where a called rotation actually pays. The Duos playlist is {{apexDuos}} per hour. Mixtape is {{apexMix}} per hour and gives Team Deathmatch, Control and Gun Run with respawns, which is the fastest way to learn a legend without losing points for it, and unranked pubs are {{apexPubs}} per hour for the same practice inside a real battle royale. All three hold that price at every rank, while Ranked is priced by the rank you sit at.',
        ],
      },
      {
        heading: 'How much does an Apex Legends duo cost?',
        paragraphs: [
          'Duo Pro is the Ranked Apex service with a Master or Apex Predator teammate, priced per hour by your own rank. First, find your own rank on the card. A Platinum player in Europe pays {{apexPro}} per hour. A Gold player pays {{apexProGold}} per hour, and a Master player pays {{apexProMaster}} per hour, so the Duo Pro price rises with your own rank. Finally, every number on this page is read from Duoly checkout rather than a list kept by hand, and the price cards carry the date it was last read.',
          'Bundles cut the total for every rank. For example, a Platinum player pays {{apexPro3}} for 3 hours with {{pct3}} off, {{apexPro5}} for 5 hours with {{pct5}} off and {{apexPro10}} for 10 hours with {{pct10}} off. The casual modes hold one flat price at every rank instead, so only Ranked moves with your rank. Apex coaching has separate prices on the coaching page.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is the Ranked option from Duoly with a Master or Apex Predator teammate, and the hour count is what decides your bundle discount.',
      'Second, add your platform, region, rank, legend pool and language. For example, name Europe or North America, PC or PlayStation, and the class you want covered, such as Controller or Recon.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord, settle the legend pair and the drop, then invite with your EA ID. The chat stays open for the whole order, so a later hour starts from the same place.',
    ],
    prepare: [
      'An EA ID is the account name your teammate needs for the invite, and Apex Legends shows it on the lobby banner.',
      'Name your platform. Apex Legends runs on PC, PlayStation and Xbox, and crossplay groups land in the PC pool, so say what you play on.',
      'Pick the region before booking, because Europe, North America, South America, Asia, Oceania and Middle East are separate servers.',
      'Bring 2 legends you trust plus 1 backup from a different class, so the pair still covers scan or cover when a pick is taken.',
      'Test your microphone on Discord first, then agree on 1 call for a reset, for example naming the ring edge before the third party arrives.',
      'Book the hours you want up front, because the bundle discount applies to one order rather than to hours you add later. Keep your login private and stay on your own account.',
    ],
    faq: [
      [
        'Does Apex Legends have a duos mode?',
        'Duos is a 2-player squad playlist that appears in the rotation from Respawn Entertainment, and Duoly books it by the hour. Check the lobby for what is live.',
      ],
      [
        'Can I book a teammate for Ranked?',
        'Yes, Duo Plus and Duo Pro are hourly Ranked services, with a Diamond+ teammate or a Master teammate respectively.',
      ],
      [
        'Is Mixtape a good first session?',
        'Yes, Mixtape has respawns and short rounds, so a new pair gets many fights inside a single hour.',
      ],
      [
        'Does a booking fill a full trio?',
        'No, a booking adds 1 teammate, so a booked pair covers 2 of 3. The third seat comes from auto fill.',
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
      'Duo Pro is the Ranked Apex Legends session with a Master or Apex Predator teammate from Duoly, priced per hour by your own rank, with bundle discounts on 3, 5 and 10 hours. For example, ask for an Assault legend if you play Controller and want an opener. Name your region, name the class you leave open and book the hours you have time for tonight.',
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
      'A Call of Duty teammate booking is an hourly price, and the three duo tiers move with your rank. First, pick the mode, because Resurgence, round-based Zombies and the party playlists hold one price at every rank. Second, open the rank list on Warzone duos, Warzone Ranked or Ranked Play, since a Platinum player and an Iridescent player do not pay the same. Bundles then cut the total: 3 hours take {{pct3}} off, 5 hours take {{pct5}} off and 10 hours take {{pct10}} off. For example, a Warzone player weighing one hour against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here is read from Duoly checkout, and the line under the cards says when it was last read.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Call of Duty player drops with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. Duo Pro is the Warzone duos service. It, Warzone Ranked and multiplayer Ranked Play are the rank-priced services, with Crimson+ or Iridescent teammates, while Resurgence, round-based Zombies and party playlists stay flat. The price table below lists all six together. In a quad your booked teammate fills 1 of the 4 seats, so the rest come from your party or fill. Finally, every booking opens an order chat on Duoly. For example, that is where you agree the mode, the start time and whether voice runs using Discord or in the in-game party. Nobody else logs into your account, and nobody can promise you a placement.',
    sections: [
      {
        heading: 'Warzone or multiplayer: which teammate should you book?',
        paragraphs: [
          'Warzone is the battle royale side of Call of Duty, where a duo lives on rotations, plates and buy station timing. Multiplayer Ranked Play is the 4v4 side, with fixed maps, known spawns and an objective to hold. The 2 sides reward different habits, so pick one before you book an hour. A Warzone partner who reads the circle is not much use on Hardpoint, and a lane holder rarely calls a good rotation.',
          'Resurgence on the small map gives respawns at {{codRebirth}} per hour, which makes it the easiest first session with someone new. Round-based Zombies is {{codZombies}} per hour and wants a partner who knows the Easter egg steps rather than one with good aim, while party playlists are {{codParty}} per hour and want neither. Name the mode in your request, because a Warzone main and a Ranked Play main rarely overlap. For example, a player who books one Resurgence hour to warm up and then one Warzone hour keeps the same voice and the same plan across both.',
        ],
      },
      {
        heading: 'How does a Warzone duo win more fights?',
        paragraphs: [
          'A Warzone duo is 2 players sharing one rotation, one loadout plan and one buy station budget. Agree the landing spot and the contract route first, so both players reach the first circle with a loadout and cash. Call the rotation by the circle and the roof you want, not by the squad you can hear. Keep 1 player plating while the other holds the angle, because 2 players plating at once is how a duo loses a 2v2.',
          'Squad Fill in the lobby is the free version of the same idea: Activision drops a random player into the empty seat at no cost, with no agreed time and no agreed comms. A booked hour is the version where the mode, the rank and the voice setup are settled before anyone drops. Resurgence is the drill version of either, because respawns mean the pair can test the same fight 10 times in one hour.',
        ],
      },
      {
        heading: 'How much does a Call of Duty duo cost?',
        paragraphs: [
          'Duo Pro is the Warzone duos service on Duoly, at {{codPro}} per hour for a Diamond player, and like the other duo tiers it follows your own rank. Warzone Ranked is the rank-priced service with an Iridescent teammate: a Platinum player pays {{codRanked}} per hour, and an Iridescent player pays {{codRankedIridescent}} per hour, so that price rises with your own rank. Multiplayer Ranked Play with a Crimson+ teammate is {{codPlus}} per hour at Platinum. Finally, every number on this page is read from Duoly checkout rather than a list kept by hand, and the price cards carry the date it was last read.',
          'Bundles cut the total for every service. For example, Warzone duos cost {{codPro3}} for 3 hours with {{pct3}} off, {{codPro5}} for 5 hours with {{pct5}} off and {{codPro10}} for 10 hours with {{pct10}} off. Resurgence, Zombies and the party playlists hold one flat price at every rank, so only the three duo tiers move with your rank.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is the Warzone duos service from Duoly, priced by your rank, and the hour count is what decides your discount.',
      'Second, add your platform, region, rank, input and language. For example, name Europe or North America, PlayStation or PC, and whether the session is Warzone, Resurgence, multiplayer Ranked Play or round-based Zombies.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord or the in-game party, settle the drop and the loadout plan, then invite with your Activision ID. The chat stays open for the whole order, so a later hour starts from the same place.',
    ],
    prepare: [
      'An Activision ID is the account name plus a number, and your teammate needs the full ID from Activision to send a party invite.',
      'Name your platform and your input. Call of Duty runs on PC, PlayStation and Xbox, and controller and keyboard players warm up differently.',
      'Pick the region before booking, because Europe, North America, South America, Asia, Oceania and Middle East give different ping.',
      'Decide the mode before the first hour, for example Warzone battle royale, Resurgence, multiplayer Ranked Play or round-based Zombies.',
      'Test your microphone on Discord first, then agree on 1 call for a reset, for example naming the building you fall back to.',
      'Book the hours you want up front, because the bundle discount applies to one order rather than to hours you add later. Keep your login private and stay on your own account.',
    ],
    faq: [
      [
        'Can I book a Warzone duo for one hour?',
        'Yes, Warzone duos are booked by the hour at a price that follows your rank, starting from a single hour.',
      ],
      [
        'Can we play Warzone Ranked together?',
        'Yes, Warzone Ranked is an hourly service with an Iridescent teammate, priced by your rank from Bronze to Top 250.',
      ],
      [
        'Do you cover multiplayer Ranked Play?',
        'Yes, Duo Plus is multiplayer Ranked Play by the hour with a Crimson+ teammate who holds a lane and plays the objective.',
      ],
      [
        'Can someone help with round-based Zombies?',
        'Yes, a Zombies Run is booked by the hour with a partner who knows the map and the wonder weapon steps.',
      ],
      [
        'Does a booking fill a full quad?',
        'No, a booking adds 1 teammate, so a booked pair covers 2 of 4. For a trio or a quad, bring friends or leave Squad Fill on.',
      ],
      [
        'How do I find free Call of Duty teammates?',
        'For example, post in the Call of Duty Discord or the Warzone LFG server, naming platform, region, mode and rank.',
      ],
    ],
    closing:
      'Duo Pro is the Warzone duos session from Duoly, at an hourly price that follows your rank, with bundle discounts on 3, 5 and 10 hours. For example, ask for a Resurgence hour first if the pair has never played together. Name the mode you want, name your platform and book the hours you have time for tonight.',
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
      'A Rainbow Six Siege teammate booking is a per-game price set by the mode and, in Ranked, by your own rank. First, pick the mode, because Quick Match, Arcade and Deathmatch hold one price at every rank while Ranked does not. Second, open the rank list on a Ranked card, since a Copper player and a Diamond player do not pay the same. Bundles then cut the total: 3 games take {{pct3}} off, 5 games take {{pct5}} off and 10 games take {{pct10}} off. For example, a Gold player weighing one game against a bundle of 5 is comparing 2 rows of the same card. Prices in US dollars follow the daily rate from the European Central Bank plus 1%. Finally, every figure here is read from Duoly checkout, and the line under the cards says when it was last read.',
    format:
      'A Duoly teammate booking is a paid session where one reviewed Rainbow Six Siege player queues with you on your own account, for the number of games you select, from 1 game up to 10 games. Duo Pro is the Ranked service with a Diamond+ teammate, and Duo Plus and Duo Apex sit either side of it on rank. Quick Match, Arcade and Deathmatch are the unranked bookings, and the price table below lists all five together. Your teammate fills 1 of the 5 seats, so the other 3 players come from the normal queue. Finally, every booking opens an order chat on Duoly. For example, that is where you agree the operator pair, the first site and whether voice runs using Discord or in the party. Nobody else logs into your account, and nobody can promise you a rank.',
    sections: [
      {
        heading: 'Which Siege roles make a good duo?',
        paragraphs: [
          'A Siege duo is a pair of jobs inside one round, and the strongest pairs share utility rather than duplicate it. The operator roles come from Ubisoft: entry, support, anchor and roam. Hard breach and support is the classic attacking pair: one player clears the Bandit or Mute denying the wall, the other opens it. Entry and drone is the second pair, because a fragger moving without a live drone is guessing. On defence, anchor and roamer is the pair that buys time: the anchor holds site while the roamer takes the first contact away from it.',
          'For example, an entry player who books a Diamond+ teammate on drone duty walks into rooms that have already been cleared instead of guessing at the first angle. Duo Plus pairs you with an Emerald+ teammate at {{r6Plus}} per game, and Duo Apex with a Champion-level one at {{r6Top}}. Finally, share your operator pool before the first round using Discord, so the pair always has a hard breach and a drone between them.',
        ],
      },
      {
        heading: 'Ranked, Quick Match or Arcade: what should you queue?',
        paragraphs: [
          'Quick Match is the unranked Siege mode for learning maps, callouts and operators, at {{r6Quick}} per game, which makes it the right first session: a map you cannot call costs more rounds than a rank point is worth. Arcade and Deathmatch are {{r6Arcade}} per game and warm up aim and peeks between Ranked games rather than teach anything. Both hold that price at every rank, while Ranked is priced by the rank you sit at.',
          'Ranked is the mode with Copper up to Champion, and a duo needs both accounts inside the current queue rules from Ubisoft. Name your platform first, because a PC post and a console post rarely match. Then agree 1 attacking site and 1 defending site to practice, so the pair learns the same 2 setups in a session instead of a different map every round.',
        ],
      },
      {
        heading: 'How much does a Rainbow Six Siege duo cost?',
        paragraphs: [
          'Duo Pro is the Ranked Siege service with a Diamond+ teammate, priced per game by your own rank. First, find your own rank on the card. A Gold player on EU West pays {{r6Pro}} per game. A Copper player pays {{r6ProCopper}} per game, and a Diamond player pays {{r6ProDiamond}} per game, so the Duo Pro price rises with your own rank. Finally, every number on this page is read from Duoly checkout rather than a list kept by hand, and the price cards carry the date it was last read.',
          'Bundles cut the total for every rank. For example, a Gold player pays {{r6Pro3}} for 3 games with {{pct3}} off, {{r6Pro5}} for 5 games with {{pct5}} off and {{r6Pro10}} for 10 games with {{pct10}} off. The unranked modes hold one flat price at every rank instead, so only Ranked moves with your rank.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total game count first, before checkout. Duo Pro is the Ranked option from Duoly with a Diamond+ teammate, and the game count is what decides your bundle discount.',
      'Second, add your platform, region, rank, role and language. For example, name EU West or US East, PC or PlayStation, and whether you want to entry, support, anchor or roam.',
      'Finally, meet your teammate in the order chat. Agree on voice using Discord, settle the operator pair and the first site, then invite with your Ubisoft name. The chat stays open for the whole order, so a later game starts from the same place.',
    ],
    prepare: [
      'A Ubisoft name is the account name your teammate needs for the friend request, and the request has to be accepted before the first queue.',
      'Name your platform first. Rainbow Six Siege runs on PC, PlayStation and Xbox, and most LFG posts for the game name a platform in the first line.',
      'Pick the data centre before booking, because EU West, EU North, US East, US Central, US West, Brazil, Asia, Japan, Australia, UAE and South Africa are separate.',
      'Bring 2 attackers and 2 defenders you trust, including 1 hard breach and 1 drone-heavy operator, so the pair always covers the wall.',
      'Test your microphone on Discord first, then agree on short callouts, for example naming the room before the floor.',
      'Book the games you want up front, because the bundle discount applies to one order rather than to games you add later. Keep your login private and stay on your own account.',
    ],
    faq: [
      [
        'Can I book a teammate for Quick Match only?',
        'Yes, Quick Match is the unranked Siege mode, and a Quick Match teammate is booked per game at one flat price for every rank.',
      ],
      [
        'Can we queue Ranked together?',
        'Yes, Duo Plus, Duo Pro and Duo Apex are the Ranked services, with an Emerald+, a Diamond+ or a Champion-level teammate, inside the current queue rules from Ubisoft.',
      ],
      [
        'Can I ask for a hard breach main?',
        'Yes, name the operator pool in your request, for example a Thermite main to pair with your support.',
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
      'Duo Pro is the Ranked Rainbow Six Siege session with a Diamond+ teammate from Duoly, priced per game by your own rank, with bundle discounts on 3, 5 and 10 games. For example, ask for a hard breach main if your own pool is Thatcher and Mute. Name your data centre, name the role you want covered and book the games you have time for tonight.',
  },
];

export const intentForGame = (slug: string) =>
  intentPages.find((page) => page.gameSlug === slug);
export const intentPath = (page: IntentPage) =>
  `/games/${page.gameSlug}/${page.slug}`;
