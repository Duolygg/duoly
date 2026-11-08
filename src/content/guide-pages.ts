import type { IntentPage } from './intent-pages';

export interface FreeRoute {
  label: string;
  url?: string;
  text: string;
}
export interface GuideCheck {
  yes: boolean;
  text: string;
}
export interface GuidePriceRow {
  label: string;
  value: string;
}
export interface FlowAnswer {
  text: string;
  /** Where the answer leads: a free route, the next question or a booking. */
  kind: 'free' | 'next' | 'paid';
}
export interface FlowStep {
  question: string;
  yes: FlowAnswer;
  no: FlowAnswer;
}

/**
 * The game-specific "what to put in your post" card: one chip group per field
 * a reader has to name before anyone can answer, free or paid.
 */
export interface LfgPostGuide {
  pill: string;
  heading: string;
  intro: string;
  fields: { label: string; chips: string[] }[];
  example: string;
}

/** Free versus paid guidance for games with a published paid example. */
export interface GameDuoGuide {
  gameSlug: string;
  heading: string;
  answer: string;
  freeIntro: string;
  freeRoutes: FreeRoute[];
  /** When the external links were last confirmed live. */
  linksNote: string;
  freeGets: string;
  limits: string[];
  paidIntro: string;
  paidChecks: GuideCheck[];
  /** Visible caption naming the service, rank and server of the rows. */
  priceCaption: string;
  priceRows: GuidePriceRow[];
  paidExample: string;
  flowIntro: string;
  flow: FlowStep[];
  faqExtra: [string, string][];
  /** Shown on the teammate pages added after the first two guides. */
  post?: LfgPostGuide;
}

const FREE_LIMITS = [
  'Replies depend on who is online when you post',
  'Rank and role are self-reported',
  'Planned sessions can fall through',
  'Voice quality and language vary',
];

export const GUIDE_PAGES: GameDuoGuide[] = [
  {
    gameSlug: 'league-of-legends',
    heading: 'Should I find a League duo for free or pay for one?',
    answer:
      'Finding a League duo for free is the right start for most players. Free LFG is a set of community spaces, such as the League of Legends Discord, RiftQ and DUO.OP.GG, where players post a server, role and rank. A free duo costs €0 and can grow into a regular group over many evenings. A paid duo is a reviewed, higher-rank teammate who joins a booked session at an agreed time. Paying makes sense for a specific goal. For example, a Gold player climbing on EUW in 2026 can book 3 Duo Pro games with a Master+ partner from Duoly with the {{pct3}} bundle discount for {{lolPro3}}. Five games cost {{lolPro5}} with {{pct5}} off. Paying makes less sense for casual company, because free communities already cover ARAM and normals well. Try free first, and book when reliability, rank or a fixed time matters more than the price.',
    freeIntro:
      'Free LFG is the no-cost way to meet League players on your server, and every post costs €0.',
    freeRoutes: [
      {
        label: 'League of Legends Discord',
        url: 'https://discord.gg/leagueoflegends',
        text: 'a partnered community server run in collaboration with Riot Games. Read the rules first, then post your server, role, mode and playing time.',
      },
      {
        label: 'RiftQ',
        url: 'https://riftq.com/euw',
        text: 'a League duo finder with filters for server, role and mode. Post once with the same details.',
      },
      {
        label: 'DUO.OP.GG',
        url: 'https://duo.op.gg/en/lol/',
        text: 'the duo board from OP.GG, sorted by region and role. Reply with your rank and champion pool.',
      },
      {
        label: 'Players you meet in game',
        text: 'after a good match, add the player as a friend using the League client and invite again.',
      },
    ],
    linksNote: 'We found every link in this list live on 8 November 2026.',
    freeGets:
      'no cost, a large pool of players and a chance to build a regular group.',
    limits: FREE_LIMITS,
    paidIntro:
      'A paid Duoly session is a booked block of games with a reviewed teammate at a known price. The price is fixed before checkout, and the order chat on Duoly sets the start time for the first game. Between games, you can ask the teammate questions about the last match.',
    paidChecks: [
      { yes: true, text: 'Ranked climb with a Master+ partner' },
      { yes: true, text: 'A set time agreed in the order chat' },
      { yes: true, text: 'Comms in your language' },
      { yes: false, text: 'Costs money for every game' },
    ],
    priceCaption: 'Duo Pro at Gold on EUW, in euro',
    priceRows: [
      { label: '1 game', value: '{{lolPro}}' },
      {
        label: '3 games, {{pct3}} off',
        value: '{{lolPro3}}',
      },
      {
        label: '5 games, {{pct5}} off',
        value: '{{lolPro5}}',
      },
    ],
    paidExample:
      'For example, a Gold player on EUW who wants 3 focused ranked games tonight pays {{lolPro3}}. Casual company is cheaper using Discord, where a post costs €0. Prices were checked in November 2026. Duoly reviews every teammate before any order, and you agree in the order chat whether voice runs on Discord or in the League client.',
    flowIntro:
      'A decision flow is the quickest way to choose between a free League duo and a paid session from Duoly. Answer 3 questions in order, starting with the first one. For example, a Gold player on EUW in November 2026 lands on a different answer for ARAM than for ranked. Each answer points to a free route, the next step or a paid session.',
    flow: [
      {
        question: 'Do you mainly want casual company for ARAM or normals?',
        yes: {
          text: 'Yes: start with the free communities above.',
          kind: 'free',
        },
        no: { text: 'No: go to step 2.', kind: 'next' },
      },
      {
        question:
          'Do you need a set time tonight or a higher-rank partner for ranked?',
        yes: { text: 'Yes: go to step 3.', kind: 'next' },
        no: {
          text: 'No: a free LFG post using Discord is enough.',
          kind: 'free',
        },
      },
      {
        question: 'Is {{lolPro3}} for 3 Duo Pro games at Gold worth the goal?',
        yes: {
          text: 'Yes: book a paid session with the {{pct3}} bundle discount.',
          kind: 'paid',
        },
        no: { text: 'No: stay with free LFG at €0.', kind: 'free' },
      },
    ],
    faqExtra: [
      [
        'Should I pay for a League duo or find one free?',
        'Try free communities first for casual games. Book a paid session for a set time, a chosen service or a higher-rank partner.',
      ],
      [
        'What does a League Duo Pro session cost?',
        'A Gold player on EUW pays {{lolPro}} per game for Duo Pro. Three games cost {{lolPro3}} with the {{pct3}} discount, and 5 games cost {{lolPro5}} with {{pct5}} off.',
      ],
    ],
  },
  {
    gameSlug: 'marvel-rivals',
    heading: 'Should I find a Marvel Rivals duo for free or pay for one?',
    answer:
      'Finding a Marvel Rivals duo for free is the right start for most players. Free LFG is a set of community spaces, such as the official Marvel Rivals Discord and the Rivals LFG board, where players post a platform, region, rank and role. A free duo costs €0 and can grow into a regular group over many evenings. A paid duo is a reviewed, higher-rank teammate who joins a booked session at an agreed time. Paying makes sense for a specific goal. For example, a Platinum player in Europe in 2026 can book 3 Duo Pro matches with a Grandmaster+ partner from Duoly with the {{pct3}} bundle discount for {{mrPro3}}. Five matches cost {{mrPro5}} with {{pct5}} off. Paying makes less sense for casual Quick Match company, because free communities already cover casual play well. Try free first.',
    freeIntro:
      'Free LFG is the no-cost way to meet Marvel Rivals players on your platform, and every post costs €0.',
    freeRoutes: [
      {
        label: 'Official Marvel Rivals Discord',
        url: 'https://discord.gg/marvelrivals',
        text: 'the verified server linked from the Marvel Rivals website by NetEase Games. Read the rules first, then post your platform, region, rank and preferred role.',
      },
      {
        label: 'Rivals LFG board',
        url: 'https://rivalslfg.com/lfg',
        text: 'a public board for Marvel Rivals teammate posts. Filter by Vanguard, Duelist, Strategist or Flex and reply with your platform and region.',
      },
      {
        label: 'Players you meet in Quick Match',
        text: 'after a good match, send a friend request and ask about queueing again. A specific invite beats a generic post.',
      },
    ],
    linksNote: 'We found both links in this list live on 8 November 2026.',
    freeGets:
      'no cost, a large pool of players and a chance to build a regular group using Discord.',
    limits: FREE_LIMITS,
    paidIntro:
      'A paid Duoly session is a booked block of matches with a reviewed teammate at a known price. The price is fixed before checkout, and the order chat on Duoly sets the start time for the first match. Between matches, you can ask the teammate questions about the last fight.',
    paidChecks: [
      { yes: true, text: 'Competitive with a Grandmaster+ partner' },
      { yes: true, text: 'A set time agreed in the order chat' },
      { yes: true, text: 'A Team-Up pair practiced on voice' },
      { yes: false, text: 'Costs money for every match' },
    ],
    priceCaption: 'Duo Pro at Platinum in Europe, in euro',
    priceRows: [
      { label: '1 match', value: '{{mrPro}}' },
      {
        label: '3 matches, {{pct3}} off',
        value: '{{mrPro3}}',
      },
      {
        label: '5 matches, {{pct5}} off',
        value: '{{mrPro5}}',
      },
    ],
    paidExample:
      'For example, a Platinum player in Europe who wants 3 focused Competitive matches tonight pays {{mrPro3}}. Casual company is cheaper using Discord, where a post costs €0. Prices were checked in November 2026. Duoly reviews every teammate before any order, and you agree in the order chat whether voice runs on Discord or in-game chat.',
    flowIntro:
      'A decision flow is the quickest way to choose between a free Marvel Rivals duo and a paid session from Duoly. Answer 3 questions in order, starting with the first one. For example, a Platinum player in Europe in November 2026 lands on a different answer for Quick Match than for Competitive. Each answer points to a free route, the next step or a paid session.',
    flow: [
      {
        question:
          'Do you mainly want casual company for Quick Match or Arcade?',
        yes: {
          text: 'Yes: start with the free communities above.',
          kind: 'free',
        },
        no: { text: 'No: go to step 2.', kind: 'next' },
      },
      {
        question:
          'Do you need a set time tonight or a higher-rank partner for Competitive?',
        yes: { text: 'Yes: go to step 3.', kind: 'next' },
        no: {
          text: 'No: a free LFG post using Discord is enough.',
          kind: 'free',
        },
      },
      {
        question:
          'Is {{mrPro3}} for 3 Duo Pro matches at Platinum worth the goal?',
        yes: {
          text: 'Yes: book a paid session with the {{pct3}} bundle discount.',
          kind: 'paid',
        },
        no: { text: 'No: stay with free LFG at €0.', kind: 'free' },
      },
    ],
    faqExtra: [
      [
        'Should I pay for a Marvel Rivals duo or find one free?',
        'Try free communities first for casual Quick Match. Book a paid session for a set time or a Grandmaster+ partner in Competitive.',
      ],
      [
        'What does a Marvel Rivals Duo Pro session cost?',
        'A Platinum player in Europe pays {{mrPro}} per match for Duo Pro in 2026. Three matches cost {{mrPro3}} with {{pct3}} off.',
      ],
    ],
  },
  {
    gameSlug: 'valorant',
    heading: 'Should I find a Valorant duo for free or pay for one?',
    answer:
      'Finding a Valorant duo for free is the right start for most players. Free LFG is a set of community spaces, such as the VALORANT Discord and the VALORANT LFG server, where players post a region, rank, role and agent pool. A free duo costs €0 and can grow into a regular five over many evenings. A paid duo is a reviewed, higher-rank teammate who joins a booked session at an agreed time. Paying makes sense for a specific goal. For example, a Gold player on EU in 2026 can book 3 Duo Pro games with an Immortal+ partner from Duoly with the {{pct3}} bundle discount for {{valPro3}}. Five games cost {{valPro5}} with {{pct5}} off. Paying makes less sense for casual company, because the free servers already cover Swiftplay and Unrated well. Try free first, and book when a set time or a higher rank matters more than the price.',
    freeIntro:
      'Free LFG is the no-cost way to meet Valorant players in your region, and every post costs €0.',
    freeRoutes: [
      {
        label: 'VALORANT Discord',
        url: 'https://discord.gg/valorant',
        text: 'the partnered community server named VALORANT, which Discord listed with about 3.0 million members. Read the rules, then post in the teammate channels.',
      },
      {
        label: 'VALORANT LFG',
        url: 'https://discord.gg/valorantlfg',
        text: 'a public server built around teammate posts, listed in Discord server discovery with about 1.2 million members. Post region, rank, role and mode.',
      },
      {
        label: 'Players you meet in Competitive',
        text: 'after a good game, add the player as a friend in the Valorant client and invite again tomorrow. A specific invite beats a generic post.',
      },
    ],
    linksNote:
      'We found every link in this list live on 8 November 2026, and read the member counts from Discord on the same day.',
    freeGets:
      'no cost, a large pool of players and a chance to build a regular five using Discord.',
    limits: FREE_LIMITS,
    paidIntro:
      'A paid Duoly session is a booked block of games with a reviewed teammate at a known price. The price is fixed before checkout, and the order chat on Duoly sets the start time for the first game. Between games, you can ask the teammate what they read on the last retake.',
    paidChecks: [
      { yes: true, text: 'Competitive with an Immortal+ partner' },
      { yes: true, text: 'A set time agreed in the order chat' },
      { yes: true, text: 'Comms in your language' },
      { yes: false, text: 'Costs money for every game' },
    ],
    priceCaption: 'Duo Pro at Gold on EU, in euro',
    priceRows: [
      { label: '1 game', value: '{{valPro}}' },
      { label: '3 games, {{pct3}} off', value: '{{valPro3}}' },
      { label: '5 games, {{pct5}} off', value: '{{valPro5}}' },
    ],
    paidExample:
      'For example, a Gold player on EU who wants 3 focused Competitive games tonight pays {{valPro3}}. Casual company is cheaper using Discord, where a post costs €0. Prices were checked in November 2026. Duoly reviews every teammate before any order, and you agree in the order chat whether voice runs on Discord or in the Valorant party.',
    flowIntro:
      'A decision flow is the quickest way to choose between a free Valorant duo and a paid session from Duoly. Answer 3 questions in order, starting with the first one. For example, a Gold player on EU in November 2026 lands on a different answer for Swiftplay than for Competitive. Each answer points to a free route, the next step or a paid session.',
    flow: [
      {
        question: 'Do you mainly want casual company for Swiftplay or Unrated?',
        yes: {
          text: 'Yes: start with the free communities above.',
          kind: 'free',
        },
        no: { text: 'No: go to step 2.', kind: 'next' },
      },
      {
        question:
          'Do you need a set time tonight or an Immortal+ partner for Competitive?',
        yes: { text: 'Yes: go to step 3.', kind: 'next' },
        no: {
          text: 'No: a free LFG post using Discord is enough.',
          kind: 'free',
        },
      },
      {
        question: 'Is {{valPro3}} for 3 Duo Pro games at Gold worth the goal?',
        yes: {
          text: 'Yes: book a paid session with the {{pct3}} bundle discount.',
          kind: 'paid',
        },
        no: { text: 'No: stay with free LFG at €0.', kind: 'free' },
      },
    ],
    faqExtra: [
      [
        'Should I pay for a Valorant duo or find one free?',
        'Try free servers first for Swiftplay and Unrated. Book a paid session for a set time or an Immortal+ partner in Competitive.',
      ],
      [
        'What does a Valorant Duo Pro session cost?',
        'A Gold player on EU pays {{valPro}} per game for Duo Pro. Three games cost {{valPro3}} with the {{pct3}} discount.',
      ],
    ],
    post: {
      pill: 'LFG post template',
      heading: 'What should a Valorant LFG post say?',
      intro:
        'A Valorant LFG post is a short message naming your region, rank, role and mode, so the right player answers instead of ten wrong ones. Region comes first, because EU, NA, AP, KR, BR and LATAM keep separate queues and separate ladders. Rank comes second, since Competitive only lets nearby ranks queue together under the current rules from Riot Games. Role comes third: say Duelist, Controller, Initiator, Sentinel or flex, and name 2 agents you actually play. Mode comes last, because a Swiftplay partner and a ranked grind partner are rarely the same person.',
      fields: [
        { label: 'Region', chips: ['EU', 'NA', 'AP', 'KR', 'BR', 'LATAM'] },
        {
          label: 'Rank',
          chips: [
            'Iron',
            'Bronze',
            'Silver',
            'Gold',
            'Platinum',
            'Diamond',
            'Ascendant',
            'Immortal',
            'Radiant',
          ],
        },
        {
          label: 'Role',
          chips: ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'],
        },
        {
          label: 'Mode',
          chips: ['Competitive', 'Swiftplay', 'Unrated', 'Deathmatch'],
        },
      ],
      example:
        'For example: "EU, Gold 2, Controller main on Omen and Viper, looking for a Duelist for Competitive tonight, English voice on Discord." That post gets answered. The same 4 fields go into a paid booking on Duoly, where Swiftplay costs {{valSwift}} per game, Competitive costs {{valPro}} at Gold and 3 games get {{pct3}} off in November 2026.',
    },
  },
  {
    gameSlug: 'fortnite',
    heading: 'Should I find a Fortnite duo for free or pay for one?',
    answer:
      'Finding a Fortnite duo for free is the right start for most players. Free LFG is a set of community spaces, such as the Official Fortnite Discord and the Fill button in your own lobby, where a partner costs €0. A free duo can grow into a regular pair over many evenings, which is how most endgame partners meet. A paid duo is a reviewed, higher-rank teammate who drops with you for a booked hour at an agreed time. Paying makes sense for a specific goal. For example, a Platinum player in Europe in 2026 can book 3 Duo Pro hours with an Unreal partner from Duoly with the {{pct3}} bundle discount for {{fnPro3}}. Five hours cost {{fnPro5}} with {{pct5}} off. Paying makes less sense for casual company, because Fill and the free Discords already cover relaxed Zero Build well. Try free first.',
    freeIntro:
      'Free LFG is the no-cost way to meet Fortnite players on your platform, and every post costs €0.',
    freeRoutes: [
      {
        label: 'Official Fortnite Discord',
        url: 'https://discord.gg/fortnite',
        text: 'the verified server named Official Fortnite, which Discord listed with about 2.1 million members. Post mode, platform, region and input.',
      },
      {
        label: 'Fill in your own lobby',
        text: 'turn Fill on in Duos, Trios or Squads and Epic Games drops a random player into the empty seat for €0, with no post and no waiting.',
      },
      {
        label: 'GameTree',
        url: 'https://gametree.me',
        text: 'a cross-game LFG site and app where you build a profile, pick your games and filter other players. Free to post.',
      },
    ],
    linksNote:
      'We found both links in this list live on 8 November 2026, and read the member count from Discord on the same day.',
    freeGets:
      'no cost, a large pool of players and a chance to build a regular pair using Discord.',
    limits: FREE_LIMITS,
    paidIntro:
      'A paid Duoly session is a booked block of hours with a reviewed teammate at a known price. The price is fixed before checkout, and the order chat on Duoly sets the start time and the drop spot. Between games, you can ask the teammate how they took the last box fight.',
    paidChecks: [
      { yes: true, text: 'Ranked Duos with an Unreal partner' },
      { yes: true, text: 'A set time agreed in the order chat' },
      { yes: true, text: 'Builds or Zero Build, your choice' },
      { yes: false, text: 'Costs money for every hour' },
    ],
    priceCaption: 'Duo Pro at Platinum in Europe, in euro',
    priceRows: [
      { label: '1 hour', value: '{{fnPro}}' },
      { label: '3 hours, {{pct3}} off', value: '{{fnPro3}}' },
      { label: '5 hours, {{pct5}} off', value: '{{fnPro5}}' },
    ],
    paidExample:
      'For example, a Platinum player in Europe who wants 3 focused Ranked Duos hours tonight pays {{fnPro3}}. Casual company is cheaper using Fill, which costs €0. Prices were checked in November 2026. Duoly reviews every teammate before any order, and you agree in the order chat whether voice runs on Discord or in the Fortnite party.',
    flowIntro:
      'A decision flow is the quickest way to choose between a free Fortnite duo and a paid session from Duoly. Answer 3 questions in order, starting with the first one. For example, a Platinum player in Europe in November 2026 lands on a different answer for Zero Build than for Ranked Duos. Each answer points to a free route, the next step or a paid session.',
    flow: [
      {
        question: 'Do you mainly want relaxed games in Zero Build or Reload?',
        yes: {
          text: 'Yes: start with Fill and the free Discord above.',
          kind: 'free',
        },
        no: { text: 'No: go to step 2.', kind: 'next' },
      },
      {
        question:
          'Do you need a set hour tonight or an Unreal partner for Ranked Duos?',
        yes: { text: 'Yes: go to step 3.', kind: 'next' },
        no: {
          text: 'No: a free LFG post using Discord is enough.',
          kind: 'free',
        },
      },
      {
        question:
          'Is {{fnPro3}} for 3 Duo Pro hours at Platinum worth the goal?',
        yes: {
          text: 'Yes: book a paid session with the {{pct3}} bundle discount.',
          kind: 'paid',
        },
        no: { text: 'No: stay with Fill and free LFG at €0.', kind: 'free' },
      },
    ],
    faqExtra: [
      [
        'Should I pay for a Fortnite duo or find one free?',
        'Try Fill and the free Discords first for casual games. Book a paid hour for a set time or an Unreal partner in Ranked Duos.',
      ],
      [
        'What does a Fortnite Duo Pro hour cost?',
        'A Platinum player in Europe pays {{fnPro}} per hour for Duo Pro. Three hours cost {{fnPro3}} with the {{pct3}} discount.',
      ],
    ],
    post: {
      pill: 'LFG post template',
      heading: 'What should a Fortnite duo post say?',
      intro:
        'A Fortnite duo post is a short message naming your platform, region, mode and input, so the right partner answers on the first try. Platform comes first, because an invite needs an Epic name and a console player and a PC player warm up differently. Region comes second, since Europe, NA-East, NA-Central, NA-West, Brazil, Asia, Oceania and Middle East are separate queues. Mode comes third: Builds and Zero Build train different habits, and Reload is the respawn playground between them. Input comes last, because controller and keyboard change how a pair fights in a box.',
      fields: [
        {
          label: 'Platform',
          chips: ['PC', 'PlayStation', 'Xbox', 'Switch', 'Cloud'],
        },
        {
          label: 'Region',
          chips: [
            'Europe',
            'NA-East',
            'NA-Central',
            'NA-West',
            'Brazil',
            'Asia',
            'Oceania',
            'Middle East',
          ],
        },
        {
          label: 'Mode',
          chips: ['Ranked Duos', 'Zero Build', 'Reload', 'Creative box fights'],
        },
        { label: 'Input', chips: ['Keyboard', 'Controller'] },
      ],
      example:
        'For example: "Europe, Platinum, controller, Zero Build duos, want a partner for 2 hours tonight, English voice on Discord." That post gets answered. The same 4 fields go into a paid booking on Duoly, where Zero Build costs {{fnZb}} per hour, Ranked Duos cost {{fnPro}} at Platinum and 3 hours get {{pct3}} off in November 2026.',
    },
  },
  {
    gameSlug: 'overwatch-2',
    heading: 'Should I find an Overwatch 2 duo for free or pay for one?',
    answer:
      'Finding an Overwatch 2 duo for free is the right start for most players. Free LFG is a set of community spaces, such as the Overwatch Discord and the Teamfind board, where players post a platform, region, rank and role. A free duo costs €0 and can grow into a regular five over many evenings. A paid duo is a reviewed, higher-rank teammate who joins a booked session at an agreed time. Paying makes sense for a specific goal. For example, a Platinum player in Europe in 2026 can book 3 Duo Pro games with a Master+ partner from Duoly with the {{pct3}} bundle discount for {{owPro3}}. Five games cost {{owPro5}} with {{pct5}} off. Paying makes less sense for casual company, because the free servers already cover Quick Play and Arcade well. Try free first, and book when the role you need is the one nobody fills.',
    freeIntro:
      'Free LFG is the no-cost way to meet Overwatch 2 players on your platform, and every post costs €0.',
    freeRoutes: [
      {
        label: 'Overwatch Discord',
        url: 'https://discord.gg/overwatch',
        text: 'the partnered community server named Overwatch, which Discord listed with about 780,000 members. Post platform, region, rank and role.',
      },
      {
        label: 'Overwatch community LFG server',
        url: 'https://discord.gg/overwatchlfg',
        text: 'a public Overwatch server with teammate channels, listed in Discord server discovery with about 174,000 members.',
      },
      {
        label: 'Teamfind',
        url: 'https://teamfind.com/overwatch',
        text: 'a player and team finding board with an Overwatch section. Posts stay readable for days, so console players still find them.',
      },
      {
        label: 'Players you meet in Quick Play',
        text: 'after a good game, send a friend request with the BattleTag and ask about grouping again.',
      },
    ],
    linksNote:
      'We found every link in this list live on 8 November 2026, and read the member counts from Discord on the same day.',
    freeGets:
      'no cost, a large pool of players on every platform and a chance to build a regular five.',
    limits: FREE_LIMITS,
    paidIntro:
      'A paid Duoly session is a booked block of games with a reviewed teammate at a known price. The price is fixed before checkout, and the order chat on Duoly sets the start time for the first game. Between rounds, you can ask the teammate which cooldown lost the fight.',
    paidChecks: [
      { yes: true, text: 'Competitive with a Master+ partner' },
      { yes: true, text: 'The role your group is missing' },
      { yes: true, text: 'A set time agreed in the order chat' },
      { yes: false, text: 'Costs money for every game' },
    ],
    priceCaption: 'Duo Pro at Platinum in Europe, in euro',
    priceRows: [
      { label: '1 game', value: '{{owPro}}' },
      { label: '3 games, {{pct3}} off', value: '{{owPro3}}' },
      { label: '5 games, {{pct5}} off', value: '{{owPro5}}' },
    ],
    paidExample:
      'For example, a Platinum player in Europe who wants 3 focused Competitive games tonight pays {{owPro3}}. Casual company is cheaper using Discord, where a post costs €0. Prices were checked in November 2026. Duoly reviews every teammate before any order, and you agree in the order chat whether voice runs on Discord or in the in-game group.',
    flowIntro:
      'A decision flow is the quickest way to choose between a free Overwatch 2 duo and a paid session from Duoly. Answer 3 questions in order, starting with the first one. For example, a Platinum player in Europe in November 2026 lands on a different answer for Quick Play than for Competitive. Each answer points to a free route, the next step or a paid session.',
    flow: [
      {
        question: 'Do you mainly want casual games in Quick Play or Arcade?',
        yes: {
          text: 'Yes: start with the free communities above.',
          kind: 'free',
        },
        no: { text: 'No: go to step 2.', kind: 'next' },
      },
      {
        question:
          'Do you need a set time tonight or a Master+ partner on a specific role?',
        yes: { text: 'Yes: go to step 3.', kind: 'next' },
        no: {
          text: 'No: a free LFG post using Discord is enough.',
          kind: 'free',
        },
      },
      {
        question:
          'Is {{owPro3}} for 3 Duo Pro games at Platinum worth the goal?',
        yes: {
          text: 'Yes: book a paid session with the {{pct3}} bundle discount.',
          kind: 'paid',
        },
        no: { text: 'No: stay with free LFG at €0.', kind: 'free' },
      },
    ],
    faqExtra: [
      [
        'Should I pay for an Overwatch 2 duo or find one free?',
        'Try free servers first for Quick Play and Arcade. Book a paid session when you need a set time or a Master+ player on one role.',
      ],
      [
        'What does an Overwatch 2 Duo Pro game cost?',
        'A Platinum player in Europe pays {{owPro}} per game for Duo Pro. Three games cost {{owPro3}} with the {{pct3}} discount.',
      ],
    ],
    post: {
      pill: 'LFG post template',
      heading: 'What should an Overwatch 2 LFG post say?',
      intro:
        'An Overwatch 2 LFG post is a short message naming your platform, region, rank, role and mode, in that order. Platform comes first, because console searches are a large share of Overwatch LFG traffic and an invite needs the BattleTag either way. Region comes second, since Europe, Americas and Asia keep separate queues. Rank comes third, because Competitive group rules from Blizzard Entertainment limit how far apart a group can be. Role comes fourth, and it is the field most posts forget: role queue locks every team to 1 Tank, 2 Damage and 2 Support, so the open seat decides who can answer.',
      fields: [
        {
          label: 'Platform',
          chips: ['PC', 'PlayStation', 'Xbox', 'Switch'],
        },
        { label: 'Region', chips: ['Europe', 'Americas', 'Asia'] },
        {
          label: 'Rank',
          chips: [
            'Bronze',
            'Silver',
            'Gold',
            'Platinum',
            'Diamond',
            'Master',
            'Grandmaster',
            'Champion',
            'Top 500',
          ],
        },
        { label: 'Role', chips: ['Tank', 'Damage', 'Support', 'Flex'] },
        {
          label: 'Mode',
          chips: ['Competitive', 'Quick Play', 'Arcade', 'Stadium'],
        },
      ],
      example:
        'For example: "PS5, Europe, Platinum 3, Support main on Kiriko and Juno, looking for a Tank for Competitive tonight, English voice on Discord." The same 5 fields go into a paid booking on Duoly, where Quick Play costs {{owQp}} per game, Competitive costs {{owPro}} at Platinum and 3 games get {{pct3}} off in November 2026.',
    },
  },
  {
    gameSlug: 'apex-legends',
    heading: 'Should I find an Apex Legends duo for free or pay for one?',
    answer:
      'Finding an Apex Legends duo for free is the right start for most players. Free LFG is a set of community spaces, such as the Apex Legends Discord and the auto fill in your own lobby, where a squadmate costs €0. A free duo can grow into a regular trio over many evenings. A paid duo is a reviewed, higher-rank teammate who drops with you for a booked hour at an agreed time. Paying makes sense for a specific goal. For example, a Platinum player in Europe in 2026 can book 3 Duo Pro hours with a Master partner from Duoly with the {{pct3}} bundle discount for {{apexPro3}}. Five hours cost {{apexPro5}} with {{pct5}} off. Paying makes less sense for casual company, because auto fill and the free Discords already cover Mixtape and pubs well. Try free first.',
    freeIntro:
      'Free LFG is the no-cost way to meet Apex Legends players in your region, and every post costs €0.',
    freeRoutes: [
      {
        label: 'Apex Legends Discord',
        url: 'https://discord.gg/apexlegends',
        text: 'the partnered community server named Apex Legends, which Discord listed with about 890,000 members. Post platform, region, rank and legend pool.',
      },
      {
        label: 'Auto fill in your own lobby',
        text: 'leave fill on and Respawn Entertainment drops a random player into the empty squad seat for €0, with no post and no waiting.',
      },
      {
        label: 'Looking For Gamers',
        url: 'https://discord.gg/lfg',
        text: 'a cross-game LFG server with per-game channels, listed in Discord server discovery. Post the same details as anywhere else.',
      },
    ],
    linksNote:
      'We found both links in this list live on 8 November 2026, and read the member count from Discord on the same day.',
    freeGets:
      'no cost, a large pool of players and a chance to build a regular trio using Discord.',
    limits: FREE_LIMITS,
    paidIntro:
      'A paid Duoly session is a booked block of hours with a reviewed teammate at a known price. The price is fixed before checkout, and the order chat on Duoly sets the start time and the drop. Between games, you can ask the teammate why they rotated early.',
    paidChecks: [
      { yes: true, text: 'Ranked with a Master or Predator partner' },
      { yes: true, text: 'A set hour agreed in the order chat' },
      { yes: true, text: 'The legend class your pair is missing' },
      { yes: false, text: 'Costs money for every hour' },
    ],
    priceCaption: 'Duo Pro at Platinum in Europe, in euro',
    priceRows: [
      { label: '1 hour', value: '{{apexPro}}' },
      { label: '3 hours, {{pct3}} off', value: '{{apexPro3}}' },
      { label: '5 hours, {{pct5}} off', value: '{{apexPro5}}' },
    ],
    paidExample:
      'For example, a Platinum player in Europe who wants 3 focused Ranked hours tonight pays {{apexPro3}}. Casual company is cheaper using auto fill, which costs €0. Prices were checked in November 2026. Duoly reviews every teammate before any order, and you agree in the order chat whether voice runs on Discord or in the in-game squad.',
    flowIntro:
      'A decision flow is the quickest way to choose between a free Apex Legends duo and a paid session from Duoly. Answer 3 questions in order, starting with the first one. For example, a Platinum player in Europe in November 2026 lands on a different answer for Mixtape than for Ranked. Each answer points to a free route, the next step or a paid session.',
    flow: [
      {
        question: 'Do you mainly want relaxed games in Mixtape or pubs?',
        yes: {
          text: 'Yes: start with auto fill and the free Discord above.',
          kind: 'free',
        },
        no: { text: 'No: go to step 2.', kind: 'next' },
      },
      {
        question:
          'Do you need a set hour tonight or a Master partner for Ranked?',
        yes: { text: 'Yes: go to step 3.', kind: 'next' },
        no: {
          text: 'No: a free LFG post using Discord is enough.',
          kind: 'free',
        },
      },
      {
        question:
          'Is {{apexPro3}} for 3 Duo Pro hours at Platinum worth the goal?',
        yes: {
          text: 'Yes: book a paid session with the {{pct3}} bundle discount.',
          kind: 'paid',
        },
        no: {
          text: 'No: stay with auto fill and free LFG at €0.',
          kind: 'free',
        },
      },
    ],
    faqExtra: [
      [
        'Should I pay for an Apex duo or find one free?',
        'Try auto fill and the free Discords first for casual games. Book a paid hour for a set time or a Master partner in Ranked.',
      ],
      [
        'What does an Apex Legends Duo Pro hour cost?',
        'A Platinum player in Europe pays {{apexPro}} per hour for Duo Pro. Three hours cost {{apexPro3}} with the {{pct3}} discount.',
      ],
    ],
    post: {
      pill: 'LFG post template',
      heading: 'What should an Apex Legends LFG post say?',
      intro:
        'An Apex Legends LFG post is a short message naming your platform, region, rank, legend class and mode. Platform comes first, because crossplay groups land in the PC pool and an invite needs the EA ID. Region comes second, since Europe, North America, South America, Asia, Oceania and Middle East are separate servers. Rank comes third, because Ranked from Rookie to Apex Predator has real matchmaking limits on how far apart a squad can be. Legend class comes fourth: Assault, Skirmisher, Recon, Controller and Support answer different problems, so name the one you leave open.',
      fields: [
        { label: 'Platform', chips: ['PC', 'PlayStation', 'Xbox'] },
        {
          label: 'Region',
          chips: [
            'Europe',
            'North America',
            'South America',
            'Asia',
            'Oceania',
            'Middle East',
          ],
        },
        {
          label: 'Rank',
          chips: [
            'Rookie',
            'Bronze',
            'Silver',
            'Gold',
            'Platinum',
            'Diamond',
            'Master',
            'Apex Predator',
          ],
        },
        {
          label: 'Legend class',
          chips: ['Assault', 'Skirmisher', 'Recon', 'Controller', 'Support'],
        },
        { label: 'Mode', chips: ['Ranked', 'Duos', 'Mixtape', 'Pubs'] },
      ],
      example:
        'For example: "Europe, PC, Platinum 2, Controller main on Catalyst, looking for an Assault for Ranked tonight, English voice on Discord." The same 5 fields go into a paid booking on Duoly, where Mixtape costs {{apexMix}} per hour, Ranked costs {{apexPro}} at Platinum and 3 hours get {{pct3}} off in November 2026.',
    },
  },
  {
    gameSlug: 'call-of-duty',
    heading: 'Should I find a Call of Duty duo for free or pay for one?',
    answer:
      'Finding a Call of Duty duo for free is the right start for most players. Free LFG is a set of community spaces, such as the Call of Duty Discord, the Warzone LFG server and Squad Fill in your own lobby, where a teammate costs €0. A free duo can grow into a regular quad over many evenings. A paid duo is a reviewed teammate who drops with you for a booked hour at an agreed time. Paying makes sense for a specific goal. For example, a player in Europe in 2026 can book 3 Warzone duo hours from Duoly with the {{pct3}} bundle discount for {{codPro3}}. Five hours cost {{codPro5}} with {{pct5}} off. Paying makes less sense for casual company, because Squad Fill and the free Discords already cover party modes well. Try free first.',
    freeIntro:
      'Free LFG is the no-cost way to meet Call of Duty players on your platform, and every post costs €0.',
    freeRoutes: [
      {
        label: 'Call of Duty Discord',
        url: 'https://discord.gg/callofduty',
        text: 'a large public Call of Duty server listed in Discord server discovery, with about 690,000 members. Post platform, region, mode and rank.',
      },
      {
        label: 'Call of Duty: Warzone LFG',
        url: 'https://discord.gg/warzonelfg',
        text: 'a server built around Warzone teammate posts, listed in Discord server discovery with about 166,000 members.',
      },
      {
        label: 'Teamfind',
        url: 'https://teamfind.com/call-of-duty',
        text: 'a player and team finding board with a Call of Duty section, where posts stay readable for days.',
      },
      {
        label: 'Squad Fill in your own lobby',
        text: 'leave Squad Fill on and Activision drops a random player into the empty seat for €0, with no post and no waiting.',
      },
    ],
    linksNote:
      'We found every link in this list live on 8 November 2026, and read the member counts from Discord on the same day.',
    freeGets:
      'no cost, a large pool of players on every platform and a chance to build a regular quad.',
    limits: FREE_LIMITS,
    paidIntro:
      'A paid Duoly session is a booked block of hours with a reviewed teammate at a known price. The price is fixed before checkout, and the order chat on Duoly sets the start time and the mode. Between games, you can ask the teammate why they bought that loadout.',
    paidChecks: [
      { yes: true, text: 'Warzone duos at one flat hourly price' },
      { yes: true, text: 'A set hour agreed in the order chat' },
      { yes: true, text: 'Warzone, Resurgence, Ranked Play or Zombies' },
      { yes: false, text: 'Costs money for every hour' },
    ],
    priceCaption: 'Warzone duos, every rank, in euro',
    priceRows: [
      { label: '1 hour', value: '{{codPro}}' },
      { label: '3 hours, {{pct3}} off', value: '{{codPro3}}' },
      { label: '5 hours, {{pct5}} off', value: '{{codPro5}}' },
    ],
    paidExample:
      'For example, a player in Europe who wants 3 focused Warzone hours tonight pays {{codPro3}}. Casual company is cheaper using Squad Fill, which costs €0. Prices were checked in November 2026. Duoly reviews every teammate before any order, and you agree in the order chat whether voice runs on Discord or in the in-game party.',
    flowIntro:
      'A decision flow is the quickest way to choose between a free Call of Duty duo and a paid session from Duoly. Answer 3 questions in order, starting with the first one. For example, a Platinum player in Europe in November 2026 lands on a different answer for party modes than for Warzone Ranked. Each answer points to a free route, the next step or a paid session.',
    flow: [
      {
        question: 'Do you mainly want relaxed games in party modes or pubs?',
        yes: {
          text: 'Yes: start with Squad Fill and the free Discords above.',
          kind: 'free',
        },
        no: { text: 'No: go to step 2.', kind: 'next' },
      },
      {
        question:
          'Do you need a set hour tonight or an Iridescent partner for Ranked?',
        yes: { text: 'Yes: go to step 3.', kind: 'next' },
        no: {
          text: 'No: a free LFG post using Discord is enough.',
          kind: 'free',
        },
      },
      {
        question: 'Is {{codPro3}} for 3 Warzone duo hours worth the goal?',
        yes: {
          text: 'Yes: book a paid session with the {{pct3}} bundle discount.',
          kind: 'paid',
        },
        no: {
          text: 'No: stay with Squad Fill and free LFG at €0.',
          kind: 'free',
        },
      },
    ],
    faqExtra: [
      [
        'Should I pay for a Warzone duo or find one free?',
        'Try Squad Fill and the free Discords first for casual games. Book a paid hour for a set time, a chosen mode or an Iridescent partner.',
      ],
      [
        'What does a Warzone duo hour cost?',
        'Warzone duos cost {{codPro}} per hour for every rank. Three hours cost {{codPro3}} with the {{pct3}} discount in 2026.',
      ],
    ],
    post: {
      pill: 'LFG post template',
      heading: 'What should a Call of Duty LFG post say?',
      intro:
        'A Call of Duty LFG post is a short message naming your platform, region, mode, rank and input. Platform comes first, because an invite needs the Activision ID and crossplay settings change the lobby. Region comes second, since Europe, North America, South America, Asia, Oceania and Middle East give very different ping. Mode comes third, and it matters more here than in any other shooter: Warzone, Resurgence, multiplayer Ranked Play and round-based Zombies attract 4 different crowds. Rank comes fourth for Ranked Play and Warzone Ranked, which run from Bronze to Top 250.',
      fields: [
        { label: 'Platform', chips: ['PC', 'PlayStation', 'Xbox'] },
        {
          label: 'Region',
          chips: [
            'Europe',
            'North America',
            'South America',
            'Asia',
            'Oceania',
            'Middle East',
          ],
        },
        {
          label: 'Mode',
          chips: [
            'Warzone',
            'Resurgence',
            'Ranked Play',
            'Warzone Ranked',
            'Zombies',
          ],
        },
        {
          label: 'Rank',
          chips: [
            'Bronze',
            'Silver',
            'Gold',
            'Platinum',
            'Diamond',
            'Crimson',
            'Iridescent',
            'Top 250',
          ],
        },
        { label: 'Input', chips: ['Keyboard', 'Controller'] },
      ],
      example:
        'For example: "Europe, PS5, controller, Warzone duos, Crimson, looking for a partner for 2 hours tonight, English voice on Discord." The same 5 fields go into a paid booking on Duoly, where Warzone duos cost {{codPro}} per hour, Warzone Ranked costs {{codRanked}} at Platinum and 3 hours get {{pct3}} off in November 2026.',
    },
  },
  {
    gameSlug: 'rainbow-six-siege',
    heading: 'Should I find a Siege duo for free or pay for one?',
    answer:
      'Finding a Rainbow Six Siege duo for free is the right start for most players. Free LFG is a set of community spaces, such as the Rainbow 6 Discord and cross-game LFG servers, where players post a platform, data centre, rank and role. A free duo costs €0 and can grow into a regular five over many evenings. A paid duo is a reviewed, higher-rank teammate who queues with you at an agreed time. Paying makes sense for a specific goal. For example, a Gold player on EU West in 2026 can book 3 Duo Pro games with a Diamond+ partner from Duoly with the {{pct3}} bundle discount for {{r6Pro3}}. Five games cost {{r6Pro5}} with {{pct5}} off. Paying makes less sense for learning maps, because Quick Match in a free group already does that. Try free first.',
    freeIntro:
      'Free LFG is the no-cost way to meet Siege players on your platform, and every post costs €0.',
    freeRoutes: [
      {
        label: 'Rainbow 6 Discord',
        url: 'https://discord.gg/rainbow6',
        text: 'the partnered community server named Rainbow 6, which Discord listed with about 910,000 members. Post platform, data centre, rank and role.',
      },
      {
        label: 'Looking For Gamers',
        url: 'https://discord.gg/lfg',
        text: 'a cross-game LFG server with per-game channels, listed in Discord server discovery. Useful when the big server is busy.',
      },
      {
        label: 'Players you meet in Quick Match',
        text: 'after a round where the callouts worked, send a Ubisoft friend request and ask about queueing again.',
      },
    ],
    linksNote:
      'We found both links in this list live on 8 November 2026, and read the member count from Discord on the same day.',
    freeGets:
      'no cost, a large pool of players and a chance to build a regular five using Discord.',
    limits: FREE_LIMITS,
    paidIntro:
      'A paid Duoly session is a booked block of games with a reviewed teammate at a known price. The price is fixed before checkout, and the order chat on Duoly sets the start time for the first game. Between rounds, you can ask the teammate what the drone saw.',
    paidChecks: [
      { yes: true, text: 'Ranked with a Diamond+ partner' },
      { yes: true, text: 'A hard breach or a drone main on call' },
      { yes: true, text: 'A set time agreed in the order chat' },
      { yes: false, text: 'Costs money for every game' },
    ],
    priceCaption: 'Duo Pro at Gold on EU West, in euro',
    priceRows: [
      { label: '1 game', value: '{{r6Pro}}' },
      { label: '3 games, {{pct3}} off', value: '{{r6Pro3}}' },
      { label: '5 games, {{pct5}} off', value: '{{r6Pro5}}' },
    ],
    paidExample:
      'For example, a Gold player on EU West who wants 3 focused Ranked games tonight pays {{r6Pro3}}. Learning a map is cheaper in Quick Match at {{r6Quick}} per game, and a free Discord post costs €0. Prices were checked in November 2026. Duoly reviews every teammate before any order, and voice runs on Discord or in the in-game party.',
    flowIntro:
      'A decision flow is the quickest way to choose between a free Siege duo and a paid session from Duoly. Answer 3 questions in order, starting with the first one. For example, a Gold player on EU West in November 2026 lands on a different answer for Quick Match than for Ranked. Each answer points to a free route, the next step or a paid session.',
    flow: [
      {
        question: 'Do you mainly want to learn maps and operators?',
        yes: {
          text: 'Yes: start with the free communities above.',
          kind: 'free',
        },
        no: { text: 'No: go to step 2.', kind: 'next' },
      },
      {
        question:
          'Do you need a set time tonight or a Diamond+ partner for Ranked?',
        yes: { text: 'Yes: go to step 3.', kind: 'next' },
        no: {
          text: 'No: a free LFG post using Discord is enough.',
          kind: 'free',
        },
      },
      {
        question: 'Is {{r6Pro3}} for 3 Duo Pro games at Gold worth the goal?',
        yes: {
          text: 'Yes: book a paid session with the {{pct3}} bundle discount.',
          kind: 'paid',
        },
        no: { text: 'No: stay with free LFG at €0.', kind: 'free' },
      },
    ],
    faqExtra: [
      [
        'Should I pay for a Siege duo or find one free?',
        'Try free servers first for Quick Match and map learning. Book a paid session for a set time or a Diamond+ partner in Ranked.',
      ],
      [
        'What does a Siege Duo Pro game cost?',
        'A Gold player on EU West pays {{r6Pro}} per game for Duo Pro. Three games cost {{r6Pro3}} with the {{pct3}} discount.',
      ],
    ],
    post: {
      pill: 'LFG post template',
      heading: 'What should a Siege LFG post say?',
      intro:
        'A Siege LFG post is a short message naming your platform, data centre, rank, role and operator pool. Platform comes first, because a PC post and a console post rarely match, and an invite needs the Ubisoft name. Data centre comes second: EU West, EU North, US East, US Central, US West, Brazil and the Asian regions are separate, and ping decides peeks. Rank comes third, from Copper to Champion. Role comes fourth, because a pair without a hard breach or a live drone is guessing at every wall.',
      fields: [
        { label: 'Platform', chips: ['PC', 'PlayStation', 'Xbox'] },
        {
          label: 'Data centre',
          chips: [
            'EU West',
            'EU North',
            'US East',
            'US Central',
            'US West',
            'Brazil South',
            'Asia East',
            'Japan East',
            'Australia East',
          ],
        },
        {
          label: 'Rank',
          chips: [
            'Copper',
            'Bronze',
            'Silver',
            'Gold',
            'Platinum',
            'Emerald',
            'Diamond',
            'Champion',
          ],
        },
        {
          label: 'Role',
          chips: ['Entry', 'Support', 'Anchor', 'Roam', 'Flex'],
        },
        { label: 'Mode', chips: ['Ranked', 'Quick Match', 'Arcade'] },
      ],
      example:
        'For example: "EU West, PC, Gold 2, support main with Thatcher and Mute, looking for a hard breach for Ranked tonight, English voice on Discord." The same 5 fields go into a paid booking on Duoly, where Quick Match costs {{r6Quick}} per game, Ranked costs {{r6Pro}} at Gold and 3 games get {{pct3}} off in November 2026.',
    },
  },
];

export const guideForGame = (slug: string) =>
  GUIDE_PAGES.find((guide) => guide.gameSlug === slug);

/** Fill price tokens from checkout-derived quotes; unknown tokens fail loudly. */
export function renderGuideText(text: string, prices: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = prices[key];
    if (value === undefined) throw new Error(`Unknown price token ${key}`);
    return value;
  });
}

/** Replace price tokens in every string of a plain data structure. */
export function renderTokens<T>(value: T, prices: Record<string, string>): T {
  if (typeof value === 'string') return renderGuideText(value, prices) as T;
  if (Array.isArray(value))
    return value.map((item) => renderTokens(item, prices)) as T;
  if (value && typeof value === 'object' && typeof value !== 'function') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        typeof item === 'function' ? item : renderTokens(item, prices),
      ]),
    ) as T;
  }
  return value;
}

/** The visible FAQ: page questions plus the guide answers, prices filled. */
export function guideFaq(
  page: IntentPage,
  prices: Record<string, string>,
): [string, string][] {
  const guide = guideForGame(page.gameSlug);
  return renderTokens([...page.faq, ...(guide?.faqExtra ?? [])], prices);
}
