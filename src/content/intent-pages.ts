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
      'Finally, meet in the order chat, exchange Trainer details and agree on voice using Discord. A teammate from Duoly joins on a separate account in 2026, so keep passwords private and send the game invite yourself.',
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
        'First, share your preferred lane and Pokemon before queueing, then ask for a complementary role such as a Defender to make space for your Attacker. Agree the lane plan using Discord before the first queue.',
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
];

export const intentForGame = (slug: string) =>
  intentPages.find((page) => page.gameSlug === slug);
export const intentPath = (page: IntentPage) =>
  `/games/${page.gameSlug}/${page.slug}`;
