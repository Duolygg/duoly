import type { HubPageCopy } from '../hub-pages';

export const valorant: HubPageCopy = {
  gameSlug: 'valorant',
  title: 'Valorant Teammates, Duos and Coaching | Duoly',
  description:
    'Book a Valorant teammate, a five-stack or a coach on Duoly, {{from_lower}}. Compare Competitive, Swiftplay, Unrated and Premier prices.',
  eyebrow: 'Valorant teammates',
  h1: 'Book a Valorant teammate, a duo or a coach',
  lead: 'Free LFG Discords work for building a regular group. Duoly books a reviewed Ascendant, Immortal or Radiant teammate for your next games, fills a five-stack when you want a bigger rank gap and sells coaching when you want to learn.',
  cta: 'Book a Valorant teammate',
  facts: [
    'Ascendant+, Immortal+ and Radiant teammates',
    'Competitive, Swiftplay, Unrated and Premier',
    'Your own account, voice on Discord',
  ],
  related: [
    'league-of-legends',
    'counter-strike-2',
    'marvel-rivals',
    'overwatch-2',
  ],
  intent:
    'After the LFG page rather than every Valorant service? It covers the free Discord routes, what a post should say and the paid duo next to them.',
  format: {
    heading: 'What can you book for Valorant on Duoly?',
    text: 'A Valorant booking on Duoly is one of three things: a teammate who queues with you, a fill that completes your party, or a lesson by the hour. First, the teammate tiers are Duo Plus with an Ascendant+ player, Duo Pro with an Immortal+ player and Duo Apex with a Radiant player. Competitive prices follow your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro. The casual modes hold one price everywhere: Swiftplay is {{p_swift}}, Unrated {{p_unrated}} and a Deathmatch warm-up {{p_dm}}. Bundles cut the total, {{pct3}} off 3 games up to {{pct10}} off 10. A tier name describes who Duoly hires and never the queue, because the Competitive rank restriction comes from Riot Games: a duo moves one tier, so Gold queues with Platinum. For example, name your region and rank in the order chat using Discord before anybody hits Find Match.',
  },
  services: {
    duo1: 'Competitive with an Ascendant+ teammate who plays around your agent and trades every duel.',
    duo2: 'Competitive with an Immortal+ teammate who calls the round, the rotate and the retake.',
    duo3: 'Competitive with a Radiant teammate for Immortal lobbies and rounds that need a 1v2 held.',
    swift:
      'Swiftplay games of about 15 minutes with the full buy system and no rank at stake.',
    unrated:
      'Unrated, the full 13-round format, while you learn an agent or a second role.',
    dm: 'Deathmatch and Team Deathmatch together as an aim warm-up before you queue Competitive.',
    gg1v1:
      'A custom 1v1 duel against a verified Gamer Girl: aim maps, pistols and rematches.',
    ggbuddy:
      'A patient Gamer Girl plays Unrated or Swiftplay with you and explains the basics.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    stack:
      'Competitive as a five-stack: Duoly fills the empty seats with Immortal+ players.',
    premier:
      'A Premier roster filled with Immortal+ players who run real strats on your match night.',
    learn:
      'One live Competitive game with an Immortal+ coach explaining every decision out loud.',
    vod: 'One hour on a recent match: positioning, utility and decisions, round by round.',
    aim: 'One hour on crosshair placement, peeking and counter-strafing, plus a training routine.',
  },
  intros: {
    teammate:
      'Teammate prices are per game, and only Competitive moves with your own rank: Duo Pro costs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Swiftplay, Unrated and a Deathmatch warm-up hold one price for everybody. First, pick the mode, because the mode decides whether the rank list on a card matters. Second, read the queue rule beside the tier. A Competitive duo moves one tier under the restriction from Riot Games, so a Gold player books Platinum rather than Immortal. The five-stack row opens the gap instead. Bundles are the only other discount, {{pct3}} off 3 games and {{pct5}} off 5. For example, agree the agent pair in the order chat using Discord before game 1.',
    team: 'A Valorant fill is one order that hires several Immortal+ players at once, so a part-full party becomes a full five. Stack Fill completes your Competitive party at {{p_stack}} for {{seats_stack}} seats, and a five is the one party that may carry any rank combination. That rule comes from Riot Games, on a Competitive FAQ dated May 2026. Expect a reduced RR gain there, 25% with any Immortal in the five and up to 90% when a Radiant plays alongside someone below Radiant. Premier Roster covers your weekly Premier night instead, at {{p_premier}} per game. First, count the seats you actually need, because every seat is priced on its own. For example, a trio short two players books 2 seats rather than 4.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount at all, so the {{pct3}} and {{pct5}} savings on teammate games stop here. VOD Review and Aim and Crosshair each cost {{p_vod}} per hour. Play and Learn is the exception that covers one live Competitive game at {{p_learn}} rather than a clock hour. First, pick the problem rather than the format. For example, a player who dies on the first peek of every round books Aim and Crosshair instead of a fourth duo game. Screen share runs using Discord, the coach never logs into your account, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking a Valorant teammate work?',
    items: [
      'Pick a service and the number of games first. Duo Pro is the Competitive tier with an Immortal+ teammate, and 3 games at {{rank_duo2}} on EU cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five games take {{pct5}} off.',
      'Second, add your region, rank, main role and language at checkout. For example, name EU, {{rank_duo2}} and the role you want covered, so your teammate reads the real request before accepting.',
      'Finally, meet your teammate in the order chat using Discord. Agree the agent pair and the queue you are both eligible for under the rules from Riot Games, then send the party invite from the Valorant client. One Duo Pro game costs {{p_duo2}}.',
    ],
    note: 'Duoly reviews every Valorant teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Valorant session fits you?',
    intro:
      'The right Valorant session is the one matching your goal tonight. First, casual modes carry no rank gate at all. A Competitive duo has to clear the one-tier restriction from Riot Games, while a five-stack allows any rank combination. For example, 3 games take {{pct3}} off and 5 games take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing Competitive this act?',
        service: 'duo2',
        answer:
          'Duo Pro names an Immortal+ teammate from {{p_duo2_low}} per game, priced by your rank.',
      },
      {
        goal: 'Want a teammate far above your rank?',
        service: 'stack',
        answer:
          'Stack Fill turns the session into a five-stack, the one party that may cross tiers, {{p_stack}} at {{rank_stack}}.',
      },
      {
        goal: 'Just want a relaxed evening?',
        service: 'swift',
        answer:
          'Swiftplay costs {{p_swift}} per game at every rank, and 5 games get {{pct5}} off.',
      },
      {
        goal: 'Short players for your Premier night?',
        service: 'premier',
        answer:
          'Premier Roster fills {{seats_premier}} seats for your weekly matches at {{p_premier}} per game.',
      },
      {
        goal: 'Want to fix one repeatable mistake?',
        service: 'vod',
        answer:
          'VOD Review is one hour with an Immortal+ coach for {{p_vod}}, round by round.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'The teammate you queue with is a reviewed Valorant player who applied for the game and showed a rank before taking orders. Duo Plus names an Ascendant+ player, Duo Pro an Immortal+ player and Duo Apex a Radiant player. A tier describes the person Duoly hires and nothing else. The Competitive party rules come from Riot Games, on a support page dated May 2026. From Platinum upwards the window is one full tier with the division kept, so the official example pairs Platinum 2 with Diamond 2. An Immortal 1 player may only queue solo, as a duo or in a five.',
        'What the tier buys is calm, useful comms. An Immortal+ teammate calls the rotate and names the retake plan. Voice runs using Discord, so the call lands before the push rather than after. Rank also sets the price: Duo Pro costs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Bundles cut that total by {{pct3}} on 3 games and {{pct5}} on 5. For example, you keep your agent, your decisions and your account in all 3 games.',
      ],
    },
    {
      heading: 'Can a Gold player queue with an Immortal+ teammate?',
      paragraphs: [
        'A Gold player cannot queue Competitive as a duo with an Immortal+ teammate. The published party table from Riot Games, read on 8 November 2026, moves a Competitive duo one full tier, so Gold pairs with Platinum and Platinum 2 pairs with Diamond 2. What Duoly sells is the highest-ranked teammate the Competitive queue allows for your own rank, which is the honest version of the promise. For example, a Gold player books Duo Pro at {{p_duo2}} and plays with the strongest Platinum the queue permits.',
        'For a wider gap the session is played as a full lobby instead. A five-stack is the one Valorant party that may carry any rank combination, and Riot Games matches a five only against other five-stacks. The trade is progress: 25% less RR with any Immortal in the five, and up to 90% less when a Radiant plays alongside someone below Radiant. Stack Fill is the booking for that, {{p_stack}} for {{seats_stack}} seats at {{rank_stack}}, with voice using Discord.',
      ],
    },
    {
      heading: 'Example evening: three Swiftplay games on EU',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. Swiftplay is the one to show, because the mode has no rank gate at all, so any 2 accounts on EU can queue it. Three games cost {{p_swift_x3}} with the {{pct3}} bundle discount, against {{p_swift}} for a single game. The order chat opens straight after payment, and the first message names the region and the evening you want: EU, happy to play sentinel, looking for someone who entries first.',
        'From there the evening runs on a short plan. You agree who takes the entry and who holds the flank, voice goes on, and the party invite comes from the Valorant client. After each game you pick one adjustment, for example smoking the far side of the site instead of the choke, agreed using Discord. The same shape works on Unrated at {{p_unrated}} per game, and Competitive pairings still follow the one-tier restriction from Riot Games covered above.',
      ],
    },
    {
      heading: 'When is Valorant coaching the better booking?',
      paragraphs: [
        'Valorant coaching is the better booking when the goal is a repeatable fix rather than company for the next game. A duo teammate answers a quick question between rounds. A coach stops the match, names the pattern and leaves you with homework. VOD Review and Aim and Crosshair each cost {{p_vod}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate games only.',
        'For example, a player who keeps dying on the first peek gains more from one hour on crosshair placement than from a fourth duo game. A player who wants a calm evening gains more from Swiftplay at {{p_swift}} per game. Screen share runs using Discord, and Play and Learn covers one live Competitive game at {{p_learn}} instead of a clock hour. The full service list, preparation tips and lesson formats live on the [Valorant coaching page](/games/valorant/coaching).',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Valorant sessions?',
    items: [
      [
        'Is Duoly a free Valorant teammate finder?',
        'Duoly is a paid marketplace with reviewed players. The VALORANT Discord and the in-game friend list from Riot Games are the free routes, so try those first.',
      ],
      [
        'How much does a Valorant duo cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}} on EU, and {{p_duo2_low}} at the lowest rank. Swiftplay is {{p_swift}}, Unrated {{p_unrated}} and a Deathmatch warm-up {{p_dm}}.',
      ],
      [
        'Can a Gold player duo with a Radiant teammate?',
        'No: a Competitive duo moves one tier, so a Gold player queues with Platinum. For a bigger gap, book Stack Fill and play the session as a five-stack, where any rank combination is allowed and RR falls 25% to 90%.',
      ],
      [
        'Can I choose my agent and my role?',
        'Yes: name the role in the order chat and your teammate plans around the pick, for example an Immortal+ initiator flashing for your duelist entry, with voice using Discord.',
      ],
      [
        'Do bundles make several games cheaper?',
        'Yes: 3 games get {{pct3}} off, 5 games get {{pct5}} off and 10 games get {{pct10}} off, so 3 Duo Pro games cost {{p_duo2_x3}} at {{rank_duo2}} in 2026.',
      ],
      [
        'Where do I book a Valorant coach?',
        'The Valorant coaching page sells VOD Review and Aim and Crosshair by the hour, plus one live Competitive game in Play and Learn. Coaching gets no bundle discount.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Valorant?',
    text: 'Duo Pro is the Competitive tier with an Immortal+ teammate from Duoly. Three games at {{rank_duo2}} on EU cost {{p_duo2_x3}} with {{pct3}} off, and 5 games take {{pct5}} off. Swiftplay stays {{p_swift}} per game at any rank, and a Deathmatch warm-up stays {{p_dm}}. A Competitive duo moves one tier under the rules from Riot Games, so book Stack Fill when you want a teammate further above your own rank in 2026. For example, pick your rank and role, then agree the agent pair and the queue in the order chat using Discord.',
  },
};
