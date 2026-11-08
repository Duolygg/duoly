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
      'Competitive, Swiftplay or Unrated',
      'Duelist, Controller, Initiator or Sentinel',
      'One teammate, your own account',
    ],
    format:
      'A Duoly teammate booking is a paid session where one reviewed Valorant player queues with you on your own account, for the number of games you select, from 1 game up to 10 games. Duo Pro is the Competitive service with an Immortal+ teammate. For example, a Gold player on EU pays {{valPro}} per game for Duo Pro in November 2026. Bundles lower the total: 3 games get {{pct3}} off, 5 games get {{pct5}} off and 10 games get {{pct10}} off. Swiftplay costs {{valSwift}} per game, Unrated costs {{valUnrated}} and a Deathmatch warm-up costs {{valDm}}. Your teammate fills 1 of the 5 seats, so the other 3 players still come from the normal queue. Every booking opens an order chat on Duoly, where you agree on agents, voice and a start time before the first game. For a lesson on one agent, choose Valorant coaching from Duoly instead.',
    sections: [
      {
        heading: 'Which Valorant agents and roles make a good duo?',
        paragraphs: [
          'A good Valorant duo is a pair of agents whose utility lands on the same site in the same 3 seconds. Controller and Duelist is the classic pair: the smoke goes down, and the Duelist enters through it on a count. Initiator and Duelist is the second strong pair, because a Breach stun or a Sova dart gives the entry a target to hit instead of a guess. Sentinel and Controller is the third, holding the far site and rotating together.',
          'For example, a Gold player on EU can book Duo Pro with an Immortal+ Initiator from Duoly for {{valPro}} per game in 2026. Duo Plus with an Ascendant+ teammate costs {{valPlus}} per game at the same rank, Duo Apex with a Radiant teammate costs {{valTop}}, and 3 games get {{pct3}} off. Name your agent pool in the order chat before the first game, so neither player instant-locks the same role and leaves the team without smokes.',
        ],
      },
      {
        heading: 'Should you book Competitive, Swiftplay or Unrated?',
        paragraphs: [
          'Swiftplay is the short Valorant mode of about 15 minutes with the full buy system, and it costs {{valSwift}} per game on Duoly, or {{valSwift3}} for 3 games with {{pct3}} off. Swiftplay suits a warm-up, a first session with a new teammate or an evening with 40 minutes in it. Unrated is the full 13-round format with no rank on the line at {{valUnrated}} per game, so Unrated is the honest place to learn a new agent. A Deathmatch warm-up costs {{valDm}} per game and fixes aim rather than teamplay.',
          'Competitive is the ranked mode, and a duo needs both accounts inside the current rank restriction from Riot Games. For example, a Gold player on EU pays {{valPro}} per game for Duo Pro with an Immortal+ partner in November 2026, and 5 games get {{pct5}} off. Open the Competitive queue in the client together and read the restriction message before the first game, because a listed teammate tier never overrides queue eligibility. You keep your agent, your calls and your account in every game.',
        ],
      },
      {
        heading: 'How much does a Valorant duo cost in 2026?',
        paragraphs: [
          'Duo Pro is the Competitive Valorant service with an Immortal+ teammate, priced per game by your own rank. Every price here comes from the Duoly checkout calculator. We found these numbers by running the calculator on 8 November 2026. A Gold player on EU pays {{valPro}} per game for Duo Pro. An Iron player pays {{valProIron}} per game, and an Immortal player pays {{valProImmortal}} per game, so the Duo Pro price rises with your own rank.',
          'Bundles cut the total for every rank. For example, a Gold player pays {{valPro3}} for 3 games with {{pct3}} off, {{valPro5}} for 5 games with {{pct5}} off and {{valPro10}} for 10 games with {{pct10}} off. Casual modes keep one flat price for every rank: Swiftplay is {{valSwift}} per game, Unrated is {{valUnrated}} and Deathmatch is {{valDm}}. Prices in US dollars use the daily exchange rate from the European Central Bank plus 1%. Valorant coaching has separate prices on the coaching page.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total game count first, before checkout. Duo Pro is the Competitive option with an Immortal+ teammate, and 3 games at Gold on EU cost {{valPro3}} with the {{pct3}} bundle discount in November 2026.',
      'Add your region, rank, main role and language. The written request is the first thing your new teammate reads. For example, name EU or NA, your rank and the role you want covered, such as Controller or Sentinel.',
      'Meet your teammate in the order chat. Agree on voice using Discord or the in-game party, settle the agent pair, then send a party invite from the Valorant client. A single Duo Pro game costs {{valPro}} at Gold, and 5 games get {{pct5}} off.',
    ],
    prepare: [
      'A Riot ID is the in-game name plus a tagline, for example Name#EUW. Riot IDs from Riot Games replaced the older separate names, and your teammate needs the full Riot ID to send a party invite.',
      'Pick the right region before booking, because EU, NA, AP, KR, BR and LATAM keep separate ranked ladders and separate friend lists.',
      'Test your microphone and your Discord audio first, then say whether you want relaxed chat or short round calls.',
      'Bring a small agent pool, for example 2 agents for your main role and 1 agent for a second role.',
      'Agree who buys utility on a half buy, so neither player ends the round holding full credits and no smokes.',
      'Book the games you want up front, because 3 games at Gold cost {{valPro3}} with {{pct3}} off in 2026. Keep your login private and stay on your own account.',
    ],
    faq: [
      [
        'Can I book someone just for Swiftplay?',
        'Yes. Swiftplay is a per-game teammate service for the short 15 minute format at {{valSwift}} per game in 2026.',
      ],
      [
        'Can I play Unrated while learning an agent?',
        'Yes. Unrated is the full 13-round mode at {{valUnrated}} per game, which suits a new agent or a second role.',
      ],
      [
        'Can we queue Competitive together at any rank?',
        'Both accounts need the same region and the current rank restriction from Riot Games. Check the queue message together.',
      ],
      [
        'Does a duo booking fill the whole team?',
        'No. A duo booking adds 1 teammate to your party, and the other 3 seats come from the normal queue.',
      ],
      [
        'Is this the same as Valorant coaching?',
        'No. Duo sessions are shared playing time. Valorant coaching is the hourly lesson, VOD review or crosshair work.',
      ],
      [
        'How do I find free Valorant teammates?',
        'For example, start with the VALORANT Discord or the VALORANT LFG server. Include region, rank, role and mode.',
      ],
    ],
    closing:
      'Duo Pro is the Competitive Valorant session with an Immortal+ teammate from Duoly, at {{valPro}} per game for Gold on EU in 2026, with {{pct3}} off 3 games and {{pct5}} off 5 games. For example, 3 games at Gold cost {{valPro3}}, and Swiftplay stays at {{valSwift}} per game for every rank.',
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
      'Ranked Duos, Zero Build or Reload',
      'Builds or no builds, your call',
      'Booked by the hour',
    ],
    format:
      'A Duoly duo booking is a paid session where one reviewed Fortnite player drops with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. Duo Pro is the Ranked service with an Unreal teammate. For example, a Platinum player in Europe pays {{fnPro}} per hour for Duo Pro in November 2026. Bundles lower the total: 3 hours get {{pct3}} off, 5 hours get {{pct5}} off and 10 hours get {{pct10}} off. Zero Build costs {{fnZb}} per hour, Reload costs {{fnReload}} and Creative box fights cost {{fnBox}}. Your partner fills the second seat in Duos, so a Trio or a Squad still pulls the rest from the queue or your friends list. Every booking opens an order chat on Duoly, where you agree on drop spots, voice and a start time. For building drills alone, choose Fortnite coaching from Duoly instead.',
    sections: [
      {
        heading: 'Zero Build or Builds: which duo should you book?',
        paragraphs: [
          'Zero Build is the Fortnite mode with building removed, so cover comes from the map and the mantle, not from walls and ramps. Zero Build costs {{fnZb}} per hour on Duoly, or {{fnZb3}} for 3 hours with {{pct3}} off in November 2026. A Zero Build duo splits the job simply: one player holds the angle, the other pushes when shields break. Builds is the original mode, where a duo needs piece control, a box to reset in and mats to spend.',
          'For example, a Platinum player in Europe can book Duo Pro with an Unreal partner from Duoly for {{fnPro}} per hour in 2026. Duo Plus with a Champion+ partner costs {{fnPlus}} per hour at the same rank, and 3 hours get {{pct3}} off. Reload costs {{fnReload}} per hour and gives respawns, which is the fastest way to practice fights with someone new. Say which mode you want before booking, because a Zero Build main and a build fighter train different habits.',
        ],
      },
      {
        heading: 'How does a Fortnite duo split the work in a match?',
        paragraphs: [
          'A Fortnite duo is 2 players sharing one drop, one loot path and one rotation plan. Agree the drop first, then who takes the chest side and who takes the floor loot, so the first minute never ends with 2 pistols. Split mats early in Builds: a duo that leaves one player on 90 wood loses the first build fight. Call rotations by the storm circle, not by the fight you want, because the storm decides who holds high ground.',
          'In the endgame, 1 player builds and 1 player watches the box line. For example, a Platinum player in Europe pays {{fnPro}} per hour for Duo Pro with an Unreal partner in November 2026, and 5 hours get {{pct5}} off. Squad Fill in the lobby is the free version of the same idea for Trios and Squads: Epic Games drops a random player into the empty seat at no cost. A booked partner is the version where the time, the rank and the comms are agreed first.',
        ],
      },
      {
        heading: 'How much does a Fortnite duo cost in 2026?',
        paragraphs: [
          'Duo Pro is the Ranked Fortnite service with an Unreal teammate, priced per hour by your own rank. Every price here comes from the Duoly checkout calculator. We found these numbers by running the calculator on 8 November 2026. A Platinum player in Europe pays {{fnPro}} per hour for Duo Pro. A Gold player pays {{fnProGold}} per hour, and an Unreal player pays {{fnProUnreal}} per hour, so the Duo Pro price rises with your own rank.',
          'Bundles cut the total for every rank. For example, a Platinum player pays {{fnPro3}} for 3 hours with {{pct3}} off, {{fnPro5}} for 5 hours with {{pct5}} off and {{fnPro10}} for 10 hours with {{pct10}} off. Casual modes keep one flat price for every rank: Zero Build is {{fnZb}} per hour, Reload is {{fnReload}} and Creative box fights are {{fnBox}}. Prices in US dollars use the daily exchange rate from the European Central Bank plus 1%. Fortnite coaching has separate prices on the coaching page.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is the Ranked option with an Unreal teammate, and 3 hours at Platinum in Europe cost {{fnPro3}} with the {{pct3}} bundle discount in November 2026.',
      'Add your platform, region, rank, input and language. For example, name Europe or NA-East, controller or keyboard, and whether you want Builds or Zero Build. Input matters, because the habits differ.',
      'Meet your partner in the order chat. Agree on voice using Discord, settle the drop spot, then add each other with the Epic name. A single Duo Pro hour costs {{fnPro}} at Platinum, and 5 hours get {{pct5}} off.',
    ],
    prepare: [
      'An Epic name is the account name your partner needs for the friend request, and the request has to be accepted before the first queue.',
      'Name your platform and your input. Fortnite runs on PC, PlayStation, Xbox, Nintendo Switch and cloud, and a controller player and a keyboard player warm up differently.',
      'Pick the region before booking, because Europe, NA-East, NA-Central, NA-West, Brazil, Asia, Oceania and Middle East are separate queues with separate ping.',
      'Agree one drop spot and one backup spot, for example a named POI plus the nearest quiet landmark.',
      'Test your microphone on Discord first, then say whether you want quiet games or constant calls.',
      'Book the hours you want up front, because 3 hours at Platinum cost {{fnPro3}} with {{pct3}} off in 2026. Keep your login private and stay on your own account.',
    ],
    faq: [
      [
        'Can I book a duo partner for Zero Build only?',
        'Yes. Zero Build is an hourly teammate service at {{fnZb}} per hour, and 3 hours cost {{fnZb3}} with {{pct3}} off.',
      ],
      [
        'Can we play Ranked Duos together?',
        'Yes. Duo Plus and Duo Pro are the Ranked services, with a Champion+ or an Unreal teammate for the hours you book.',
      ],
      [
        'Is Reload a good first session?',
        'Yes. Reload gives respawns on a small map at {{fnReload}} per hour, so a new pair gets many fights in one hour.',
      ],
      [
        'Does a duo booking fill a full squad?',
        'No. A booking adds 1 partner. For a Trio or a Squad, bring friends or use Squad Fill in the lobby.',
      ],
      [
        'Can I learn building in a duo session?',
        'Creative box fights at {{fnBox}} per hour include showing the builds. For drills alone, book Fortnite coaching instead.',
      ],
      [
        'How do I find a free Fortnite duo?',
        'For example, post in the Official Fortnite Discord, or turn Fill on in the lobby for a random teammate at no cost.',
      ],
    ],
    closing:
      'Duo Pro is the Ranked Fortnite session with an Unreal teammate from Duoly, at {{fnPro}} per hour for Platinum in Europe in 2026, with {{pct3}} off 3 hours and {{pct5}} off 5 hours. For example, 3 hours at Platinum cost {{fnPro3}}, and Zero Build stays at {{fnZb}} per hour for every rank.',
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
      'Competitive, Quick Play or Stadium',
      'Tank, Damage or Support',
      'One teammate, your own account',
    ],
    format:
      'A Duoly teammate booking is a paid session where one reviewed Overwatch 2 player joins your group on your own account, for the number of games you select, from 1 game up to 10 games. Duo Pro is the Competitive service with a Master+ teammate. For example, a Platinum player in Europe pays {{owPro}} per game for Duo Pro in November 2026. Bundles lower the total: 3 games get {{pct3}} off, 5 games get {{pct5}} off and 10 games get {{pct10}} off. Quick Play and Arcade cost {{owQp}} per game, and a Stadium run costs {{owStadium}}. Your teammate fills 1 of the 5 seats, so the other 3 players still come from the normal queue. Every booking opens an order chat on Duoly, where you agree on roles, voice and a start time before the first game. For a role lesson, choose Overwatch coaching from Duoly instead.',
    sections: [
      {
        heading: 'Which Overwatch 2 roles make a good duo?',
        paragraphs: [
          'Role queue is the Overwatch 2 system that locks every team to 1 Tank, 2 Damage and 2 Support, so a duo is really a pair of those 5 seats. Tank and Support is the steadiest pair: the Tank takes space, and the Support decides how much space the cooldowns can pay for. Damage and Support is the second pair, because a dive only works when the healing follows the dive. Two Damage players need one shared target and one agreed reset.',
          'For example, a Platinum player in Europe can book Duo Pro with a Master+ Support from Duoly for {{owPro}} per game in 2026. Duo Plus with a Diamond+ teammate costs {{owPlus}} per game at the same rank, Duo Apex with a Grandmaster+ teammate costs {{owTop}}, and 3 games get {{pct3}} off. Name your role and one comfortable second role when booking, so the pair still works when the first pick is taken.',
        ],
      },
      {
        heading: 'Competitive, Quick Play or Stadium: what should you queue?',
        paragraphs: [
          'Quick Play is the casual Overwatch 2 mode with no rank attached, and Quick Play and Arcade cost {{owQp}} per game on Duoly, or {{owQp3}} for 3 games with {{pct3}} off. Quick Play suits a first session, a new hero or a console evening with voice on. Stadium is the best-of-seven mode where both players spend round money on hero builds, and a Stadium run costs {{owStadium}} per game, or {{owStadium3}} for 3 games.',
          'Competitive is the ranked mode, and a group needs ranks inside the current group rules from Blizzard Entertainment. For example, a Platinum player in Europe pays {{owPro}} per game for Duo Pro with a Master+ partner in November 2026, and 5 games get {{pct5}} off. Share your platform too, because Overwatch 2 LFG posts for PlayStation and Xbox are among the most searched, and crossplay settings change which lobby a mixed group lands in. Check the group screen together before queueing.',
        ],
      },
      {
        heading: 'How much does an Overwatch 2 duo cost in 2026?',
        paragraphs: [
          'Duo Pro is the Competitive Overwatch 2 service with a Master+ teammate, priced per game by your own rank. Every price here comes from the Duoly checkout calculator. We found these numbers by running the calculator on 8 November 2026. A Platinum player in Europe pays {{owPro}} per game for Duo Pro. A Gold player pays {{owProGold}} per game, and a Master player pays {{owProMaster}} per game, so the Duo Pro price rises with your own rank.',
          'Bundles cut the total for every rank. For example, a Platinum player pays {{owPro3}} for 3 games with {{pct3}} off, {{owPro5}} for 5 games with {{pct5}} off and {{owPro10}} for 10 games with {{pct10}} off. Casual modes keep one flat price for every rank: Quick Play and Arcade are {{owQp}} per game, and Stadium is {{owStadium}}. Prices in US dollars use the daily exchange rate from the European Central Bank plus 1%. Coaching has separate prices on the Overwatch coaching page.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total game count first, before checkout. Duo Pro is the Competitive option with a Master+ teammate, and 3 games at Platinum in Europe cost {{owPro3}} with the {{pct3}} bundle discount in November 2026.',
      'Add your platform, region, rank, role and language. For example, name PlayStation or PC, Europe or Americas, and the role you want covered, such as Tank or Support.',
      'Meet your teammate in the order chat. Agree on voice using Discord or the in-game group, settle the role pair, then invite with your BattleTag. A single Duo Pro game costs {{owPro}} at Platinum, and 5 games get {{pct5}} off.',
    ],
    prepare: [
      'A BattleTag is the Battle.net name plus a number, for example Name#2154. Your teammate needs the full BattleTag to send a group invite, and console players link the same account.',
      'Name your platform first. Overwatch 2 runs on PC, PlayStation, Xbox and Nintendo Switch, and most LFG posts for the game name a console in the first line.',
      'Pick the region before booking, because Europe, Americas and Asia keep separate queues and separate ping.',
      'Test your microphone and your Discord audio first, then say whether you want fight calls or quiet games.',
      'Bring 2 heroes for your main role and 1 for a second role, so a counterpick does not end the session.',
      'Book the games you want up front, because 3 games at Platinum cost {{owPro3}} with {{pct3}} off in 2026. Keep your login private and stay on your own account.',
    ],
    faq: [
      [
        'Can I book a teammate for Quick Play only?',
        'Yes. Quick Play and Arcade are a per-game service at {{owQp}} per game, and 3 games cost {{owQp3}} with {{pct3}} off.',
      ],
      [
        'Can we play Competitive role queue together?',
        'Yes. Duo Plus, Duo Pro and Duo Apex are Competitive services, inside the current group rules from Blizzard Entertainment.',
      ],
      [
        'Do you support Stadium?',
        'Yes. Stadium Duo is a per-game service at {{owStadium}} per game, planned round by round with a Master+ teammate.',
      ],
      [
        'Does a duo booking fill all five seats?',
        'No. A duo booking adds 1 teammate, and the other 3 seats come from your group or the normal queue.',
      ],
      [
        'Can I book on PlayStation or Xbox?',
        'Yes. Name your platform in the request, and check the crossplay setting in the group screen before the first game.',
      ],
      [
        'How do I find free Overwatch 2 teammates?',
        'For example, post in the Overwatch Discord or on Teamfind. Include platform, region, rank, role and mode.',
      ],
    ],
    closing:
      'Duo Pro is the Competitive Overwatch 2 session with a Master+ teammate from Duoly, at {{owPro}} per game for Platinum in Europe in 2026, with {{pct3}} off 3 games and {{pct5}} off 5 games. For example, 3 games at Platinum cost {{owPro3}}, and Quick Play stays at {{owQp}} per game for every rank.',
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
      'Ranked, Duos playlist or Mixtape',
      'Assault, Skirmisher, Recon, Controller or Support',
      'Booked by the hour',
    ],
    format:
      'A Duoly teammate booking is a paid session where one reviewed Apex Legends player drops with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. Duo Pro is the Ranked service with a Master or Apex Predator teammate. For example, a Platinum player in Europe pays {{apexPro}} per hour for Duo Pro in November 2026. Bundles lower the total: 3 hours get {{pct3}} off, 5 hours get {{pct5}} off and 10 hours get {{pct10}} off. The Duos playlist costs {{apexDuos}} per hour, Mixtape costs {{apexMix}} and unranked pubs cost {{apexPubs}}. In trios your booked teammate fills 1 of the 3 seats, so the third seat still comes from auto fill or a friend. Every booking opens an order chat on Duoly for legends, voice and a start time. For movement drills alone, choose Apex coaching from Duoly instead.',
    sections: [
      {
        heading: 'Which Apex legend roles make a good duo?',
        paragraphs: [
          'Apex Legends sorts every legend into 5 classes from Respawn Entertainment: Assault, Skirmisher, Recon, Controller and Support. A good duo takes 2 classes that answer different problems. Controller and Assault is the steadiest pair, because one player owns the ground and the other converts it into damage. Recon and Skirmisher is the second pair: the scan finds the squad, and the Skirmisher picks the angle to hit it from. Support and anything keeps the pair alive long enough to use the plan.',
          'For example, a Platinum player in Europe can book Duo Pro with a Master partner from Duoly for {{apexPro}} per hour in 2026. Duo Plus with a Diamond+ partner costs {{apexPlus}} per hour at the same rank, and 3 hours get {{pct3}} off. Say which legends you actually play before the first drop, because 2 Skirmishers with no Controller lose every long hold. The third seat in trios usually comes from auto fill, so leave one class open.',
        ],
      },
      {
        heading: 'Ranked or the Duos playlist: which should you book?',
        paragraphs: [
          'The Duos playlist is the Apex battle royale format with 2-player squads, and it costs {{apexDuos}} per hour on Duoly, or {{apexDuos3}} for 3 hours with {{pct3}} off in November 2026. Duos is the honest answer to the common question about playing Apex as a pair, because nobody fills a third seat. Playlists rotate, so open the lobby and check what Respawn Entertainment has live before you book an hour.',
          'Ranked is the mode with Rookie up to Apex Predator and a real cost for dying early. For example, a Platinum player in Europe pays {{apexPro}} per hour for Duo Pro with a Master partner in November 2026, and 5 hours get {{pct5}} off. Mixtape costs {{apexMix}} per hour and gives Team Deathmatch, Control and Gun Run with respawns, which is the fastest way to learn a legend. Unranked pubs cost {{apexPubs}} per hour for the same practice inside a real battle royale.',
        ],
      },
      {
        heading: 'How much does an Apex Legends duo cost in 2026?',
        paragraphs: [
          'Duo Pro is the Ranked Apex service with a Master or Apex Predator teammate, priced per hour by your own rank. Every price here comes from the Duoly checkout calculator. We found these numbers by running the calculator on 8 November 2026. A Platinum player in Europe pays {{apexPro}} per hour for Duo Pro. A Gold player pays {{apexProGold}} per hour, and a Master player pays {{apexProMaster}} per hour, so the Duo Pro price rises with your own rank.',
          'Bundles cut the total for every rank. For example, a Platinum player pays {{apexPro3}} for 3 hours with {{pct3}} off, {{apexPro5}} for 5 hours with {{pct5}} off and {{apexPro10}} for 10 hours with {{pct10}} off. Casual modes keep one flat price for every rank: the Duos playlist is {{apexDuos}} per hour, Mixtape is {{apexMix}} and pubs are {{apexPubs}}. Prices in US dollars use the daily exchange rate from the European Central Bank plus 1%. Apex coaching has separate prices on the coaching page.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is the Ranked option with a Master or Apex Predator teammate, and 3 hours at Platinum in Europe cost {{apexPro3}} with the {{pct3}} bundle discount in November 2026.',
      'Add your platform, region, rank, legend pool and language. For example, name Europe or North America, PC or PlayStation, and the class you want covered, such as Controller or Recon.',
      'Meet your teammate in the order chat. Agree on voice using Discord, settle the legend pair and the drop, then invite with your EA ID. A single Duo Pro hour costs {{apexPro}} at Platinum, and 5 hours get {{pct5}} off.',
    ],
    prepare: [
      'An EA ID is the account name your teammate needs for the invite, and Apex Legends shows it on the lobby banner.',
      'Name your platform. Apex Legends runs on PC, PlayStation and Xbox, and crossplay groups land in the PC pool, so say what you play on.',
      'Pick the region before booking, because Europe, North America, South America, Asia, Oceania and Middle East are separate servers.',
      'Bring 2 legends you trust plus 1 backup from a different class, so the pair still covers scan or cover when a pick is taken.',
      'Test your microphone on Discord first, then agree on 1 call for a reset, for example naming the ring edge before the third party arrives.',
      'Book the hours you want up front, because 3 hours at Platinum cost {{apexPro3}} with {{pct3}} off in 2026. Keep your login private and stay on your own account.',
    ],
    faq: [
      [
        'Does Apex Legends have a duos mode?',
        'A Duos playlist with 2-player squads appears in the rotation from Respawn Entertainment. Check the lobby for what is live today.',
      ],
      [
        'Can I book a teammate for Ranked?',
        'Yes. Duo Plus and Duo Pro are hourly Ranked services with a Diamond+ or a Master and Apex Predator teammate.',
      ],
      [
        'Is Mixtape a good first session?',
        'Yes. Mixtape costs {{apexMix}} per hour with respawns, so a new pair gets many fights inside one hour.',
      ],
      [
        'Does a booking fill a full trio?',
        'No. A booking adds 1 teammate. In trios the third seat comes from auto fill or a friend you bring.',
      ],
      [
        'Can I learn movement in a duo session?',
        'A teammate explains calls as you play. For tap strafes and slide jumps alone, book the Apex movement course instead.',
      ],
      [
        'How do I find free Apex teammates?',
        'For example, post in the Apex Legends Discord, or leave auto fill on for a random third at no cost.',
      ],
    ],
    closing:
      'Duo Pro is the Ranked Apex Legends session with a Master or Apex Predator teammate from Duoly, at {{apexPro}} per hour for Platinum in Europe in 2026, with {{pct3}} off 3 hours and {{pct5}} off 5 hours. For example, 3 hours at Platinum cost {{apexPro3}}, and the Duos playlist stays at {{apexDuos}} per hour.',
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
      'Warzone, Resurgence or Ranked Play',
      'Battle royale or multiplayer',
      'Booked by the hour',
    ],
    format:
      'A Duoly teammate booking is a paid session where one reviewed Call of Duty player drops with you on your own account, for the number of hours you select, from 1 hour up to 10 hours. Duo Pro is the Warzone duos service, at {{codPro}} per hour for every rank in November 2026. Bundles lower the total: 3 hours get {{pct3}} off, 5 hours get {{pct5}} off and 10 hours get {{pct10}} off. Warzone Ranked with an Iridescent teammate costs {{codRanked}} per hour at Platinum, multiplayer Ranked Play costs {{codPlus}}, Resurgence costs {{codRebirth}}, Zombies costs {{codZombies}} and party modes cost {{codParty}}. In a quad your teammate fills 1 of the 4 seats, so the rest still come from your party or fill. Every booking opens an order chat on Duoly for modes, voice and a start time.',
    sections: [
      {
        heading: 'Warzone or multiplayer: which teammate should you book?',
        paragraphs: [
          'Warzone is the battle royale side of Call of Duty, where a duo lives on rotations, plates and buy station timing. Warzone duos cost {{codPro}} per hour on Duoly, or {{codPro3}} for 3 hours with {{pct3}} off in November 2026. Multiplayer Ranked Play is the 4v4 side with maps, spawns and an objective, and it costs {{codPlus}} per hour at Platinum with a Crimson+ teammate. The 2 sides reward different habits, so pick one before you book an hour.',
          'Resurgence on the small map costs {{codRebirth}} per hour and gives respawns, which makes it the easiest first session with someone new. Round-based Zombies costs {{codZombies}} per hour with a partner who knows the Easter egg steps, and party playlists cost {{codParty}}. For example, a Platinum player in Europe pays {{codRanked}} per hour for Warzone Ranked with an Iridescent teammate in 2026, and 3 hours cost {{codRanked3}} with {{pct3}} off. Name the mode in your request, because a Warzone main and a Ranked Play main rarely overlap.',
        ],
      },
      {
        heading: 'How does a Warzone duo win more fights?',
        paragraphs: [
          'A Warzone duo is 2 players sharing one rotation, one loadout plan and one buy station budget. Agree the landing spot and the contract route first, so both players reach the first circle with a loadout and cash. Call the rotation by the circle and the roof you want, not by the squad you can hear. Keep 1 player plating while the other holds the angle, because 2 players plating at once is how a duo loses a 2v2.',
          'For example, a Platinum player in Europe pays {{codPro}} per hour for Warzone duos in November 2026, and 5 hours get {{pct5}} off. Squad Fill in the lobby is the free version of the same idea: Activision drops a random player into the empty seat at no cost, with no agreed time and no agreed comms. Resurgence at {{codRebirth}} per hour is the drill version, because respawns mean the pair can test the same fight 10 times in one hour.',
        ],
      },
      {
        heading: 'How much does a Call of Duty duo cost in 2026?',
        paragraphs: [
          'Duo Pro is the Warzone duos service on Duoly, and it keeps one flat price of {{codPro}} per hour for every rank. Every price here comes from the Duoly checkout calculator. We found these numbers by running the calculator on 8 November 2026. Warzone Ranked is the rank-priced service with an Iridescent teammate: a Platinum player pays {{codRanked}} per hour, and an Iridescent player pays {{codRankedIridescent}} per hour, so that price rises with your own rank.',
          'Bundles cut the total for every service. For example, Warzone duos cost {{codPro3}} for 3 hours with {{pct3}} off, {{codPro5}} for 5 hours with {{pct5}} off and {{codPro10}} for 10 hours with {{pct10}} off. The other flat prices stay the same at every rank: Resurgence is {{codRebirth}} per hour, Zombies is {{codZombies}} and party modes are {{codParty}}. Prices in US dollars use the daily exchange rate from the European Central Bank plus 1%.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total hour count first, before checkout. Duo Pro is Warzone duos at {{codPro}} per hour, and 3 hours cost {{codPro3}} with the {{pct3}} bundle discount in November 2026.',
      'Add your platform, region, rank, input and language. For example, name Europe or North America, PlayStation or PC, and whether you want Warzone, Resurgence, Ranked Play or Zombies.',
      'Meet your teammate in the order chat. Agree on voice using Discord or the in-game party, settle the drop and the loadout plan, then invite with your Activision ID. A single Warzone hour costs {{codPro}}, and 5 hours get {{pct5}} off.',
    ],
    prepare: [
      'An Activision ID is the account name plus a number, and your teammate needs the full ID to send a party invite.',
      'Name your platform and your input. Call of Duty runs on PC, PlayStation and Xbox, and controller and keyboard players warm up differently.',
      'Pick the region before booking, because Europe, North America, South America, Asia, Oceania and Middle East give different ping.',
      'Decide the mode before the first hour, for example Warzone battle royale, Resurgence, multiplayer Ranked Play or round-based Zombies.',
      'Test your microphone on Discord first, then agree on 1 call for a reset, for example naming the building you fall back to.',
      'Book the hours you want up front, because 3 Warzone hours cost {{codPro3}} with {{pct3}} off in 2026. Keep your login private and stay on your own account.',
    ],
    faq: [
      [
        'Can I book a Warzone duo for one hour?',
        'Yes. Warzone duos cost {{codPro}} per hour for every rank, and 3 hours cost {{codPro3}} with {{pct3}} off in 2026.',
      ],
      [
        'Can we play Warzone Ranked together?',
        'Yes. Warzone Ranked is an hourly service with an Iridescent teammate, priced by your own rank from Bronze to Top 250.',
      ],
      [
        'Do you cover multiplayer Ranked Play?',
        'Yes. Duo Plus is multiplayer Ranked Play with a Crimson+ teammate at {{codPlus}} per hour at Platinum.',
      ],
      [
        'Can someone help with round-based Zombies?',
        'Yes. A Zombies Run is {{codZombies}} per hour with a partner who knows the map, the wonder weapon and the steps.',
      ],
      [
        'Does a booking fill a full quad?',
        'No. A booking adds 1 teammate. For a trio or a quad, bring friends or leave Squad Fill on.',
      ],
      [
        'How do I find free Call of Duty teammates?',
        'For example, post in the Call of Duty Discord or the Warzone LFG server. Include platform, region, mode and rank.',
      ],
    ],
    closing:
      'Duo Pro is the Warzone duos session from Duoly, at {{codPro}} per hour for every rank in 2026, with {{pct3}} off 3 hours and {{pct5}} off 5 hours. For example, 3 hours cost {{codPro3}}, and Warzone Ranked with an Iridescent teammate costs {{codRanked}} per hour at Platinum.',
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
      'Ranked, Quick Match or Arcade',
      'Entry, support, anchor or roam',
      'One teammate, your own account',
    ],
    format:
      'A Duoly teammate booking is a paid session where one reviewed Rainbow Six Siege player queues with you on your own account, for the number of games you select, from 1 game up to 10 games. Duo Pro is the Ranked service with a Diamond+ teammate. For example, a Gold player on EU West pays {{r6Pro}} per game for Duo Pro in November 2026. Bundles lower the total: 3 games get {{pct3}} off, 5 games get {{pct5}} off and 10 games get {{pct10}} off. Quick Match costs {{r6Quick}} per game, and Arcade and Deathmatch cost {{r6Arcade}}. Your teammate fills 1 of the 5 seats, so the other 3 players still come from the normal queue. Every booking opens an order chat on Duoly, where you agree on operators, voice and a start time before the first round.',
    sections: [
      {
        heading: 'Which Siege roles make a good duo?',
        paragraphs: [
          'A Siege duo is a pair of jobs inside one round, and the strongest pairs share utility. Hard breach and support is the classic attacking pair: one player clears the Bandit or Mute denying the wall, the other opens it. Entry and drone is the second pair, because a fragger moving without a live drone is guessing. On defence, anchor and roamer is the pair that buys time: the anchor holds site while the roamer takes the first contact away from it.',
          'For example, a Gold player on EU West can book Duo Pro with a Diamond+ teammate from Duoly for {{r6Pro}} per game in 2026. Duo Plus with an Emerald+ teammate costs {{r6Plus}} per game at the same rank, Duo Apex with a Champion-level teammate costs {{r6Top}}, and 3 games get {{pct3}} off. Share your operator pool before the first round, so the pair always has a hard breach and a drone between them.',
        ],
      },
      {
        heading: 'Ranked, Quick Match or Arcade: what should you queue?',
        paragraphs: [
          'Quick Match is the unranked Siege mode for learning maps, callouts and operators, and it costs {{r6Quick}} per game on Duoly, or {{r6Quick3}} for 3 games with {{pct3}} off. Quick Match is the right first session, because a map you cannot call is worth more than a rank point. Arcade and Deathmatch cost {{r6Arcade}} per game and warm up aim and peeks between Ranked games.',
          'Ranked is the mode with Copper up to Champion, and a duo needs both accounts inside the current queue rules from Ubisoft. For example, a Gold player on EU West pays {{r6Pro}} per game for Duo Pro with a Diamond+ partner in November 2026, and 5 games get {{pct5}} off. Name your platform first, because a PC post and a console post rarely match. Then agree 1 attacking site and 1 defending site to practice, so the pair learns the same 2 setups in a session.',
        ],
      },
      {
        heading: 'How much does a Rainbow Six Siege duo cost in 2026?',
        paragraphs: [
          'Duo Pro is the Ranked Siege service with a Diamond+ teammate, priced per game by your own rank. Every price here comes from the Duoly checkout calculator. We found these numbers by running the calculator on 8 November 2026. A Gold player on EU West pays {{r6Pro}} per game for Duo Pro. A Copper player pays {{r6ProCopper}} per game, and a Diamond player pays {{r6ProDiamond}} per game, so the Duo Pro price rises with your own rank.',
          'Bundles cut the total for every rank. For example, a Gold player pays {{r6Pro3}} for 3 games with {{pct3}} off, {{r6Pro5}} for 5 games with {{pct5}} off and {{r6Pro10}} for 10 games with {{pct10}} off. Unranked modes keep one flat price for every rank: Quick Match is {{r6Quick}} per game, and Arcade and Deathmatch are {{r6Arcade}}. Prices in US dollars use the daily exchange rate from the European Central Bank plus 1%.',
        ],
      },
    ],
    steps: [
      'Choose a service and a total game count first, before checkout. Duo Pro is the Ranked option with a Diamond+ teammate, and 3 games at Gold on EU West cost {{r6Pro3}} with the {{pct3}} bundle discount in November 2026.',
      'Add your platform, region, rank, role and language. For example, name EU West or US East, PC or PlayStation, and whether you want to entry, support, anchor or roam.',
      'Meet your teammate in the order chat. Agree on voice using Discord, settle the operator pair and the first site, then invite with your Ubisoft name. A single Duo Pro game costs {{r6Pro}} at Gold, and 5 games get {{pct5}} off.',
    ],
    prepare: [
      'A Ubisoft name is the account name your teammate needs for the friend request, and the request has to be accepted before the first queue.',
      'Name your platform first. Rainbow Six Siege runs on PC, PlayStation and Xbox, and most LFG posts for the game name a platform in the first line.',
      'Pick the data centre before booking, because EU West, EU North, US East, US Central, US West, Brazil, Asia, Japan, Australia, UAE and South Africa are separate.',
      'Bring 2 attackers and 2 defenders you trust, including 1 hard breach and 1 drone-heavy operator, so the pair always covers the wall.',
      'Test your microphone on Discord first, then agree on short callouts, for example naming the room before the floor.',
      'Book the games you want up front, because 3 games at Gold cost {{r6Pro3}} with {{pct3}} off in 2026. Keep your login private and stay on your own account.',
    ],
    faq: [
      [
        'Can I book a teammate for Quick Match only?',
        'Yes. Quick Match is a per-game service at {{r6Quick}} per game, and 3 games cost {{r6Quick3}} with {{pct3}} off.',
      ],
      [
        'Can we queue Ranked together?',
        'Yes. Duo Plus, Duo Pro and Duo Apex are Ranked services, inside the current queue rules from Ubisoft.',
      ],
      [
        'Can I ask for a hard breach main?',
        'Yes. Name the operator pool in your request, for example a Thermite or Hibana main to pair with your support.',
      ],
      [
        'Does a duo booking fill all five seats?',
        'No. A duo booking adds 1 teammate, and the other 3 seats come from the normal queue.',
      ],
      [
        'Can I book on PlayStation or Xbox?',
        'Yes. Name your platform in the request, because PC and console posts rarely match in the same queue.',
      ],
      [
        'How do I find free Siege teammates?',
        'For example, post in the Rainbow 6 Discord or a cross-game LFG server. Include platform, data centre, rank and role.',
      ],
    ],
    closing:
      'Duo Pro is the Ranked Rainbow Six Siege session with a Diamond+ teammate from Duoly, at {{r6Pro}} per game for Gold on EU West in 2026, with {{pct3}} off 3 games and {{pct5}} off 5 games. For example, 3 games at Gold cost {{r6Pro3}}, and Quick Match stays at {{r6Quick}} per game for every rank.',
  },
];

export const intentForGame = (slug: string) =>
  intentPages.find((page) => page.gameSlug === slug);
export const intentPath = (page: IntentPage) =>
  `/games/${page.gameSlug}/${page.slug}`;
