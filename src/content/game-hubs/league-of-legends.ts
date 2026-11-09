import type { HubPageCopy } from '../hub-pages';

export const leagueOfLegends: HubPageCopy = {
  gameSlug: 'league-of-legends',
  title: 'League of Legends LFG: Teammates and Coaching | Duoly',
  description:
    'Book a League of Legends teammate, a Ranked Flex five or a coach on Duoly, {{from_lower}}. Compare Solo/Duo, ARAM and Clash prices.',
  eyebrow: 'League of Legends teammates',
  h1: 'League of Legends LFG: find teammates for tonight',
  lead: 'Free LFG posts are great for building a regular group. Duoly books a reviewed Diamond, Master or Grandmaster teammate for your next games, fills a Ranked Flex five and sells coaching when you want to learn.',
  cta: 'Book a League teammate',
  facts: [
    'Diamond 4+ to Challenger teammates',
    'Solo/Duo, Flex, ARAM and Arena',
    'Voice on Discord, your own account',
  ],
  related: [
    'wild-rift',
    'dota-2',
    'deadlock',
    'teamfight-tactics',
    'pokemon-unite',
  ],
  intent:
    'After the duo partner page rather than every League service? It covers ARAM, normals and ranked duo on their own, with the free routes next to the paid ones.',
  format: {
    heading: 'What can you book for League of Legends on Duoly?',
    text: 'A League of Legends booking on Duoly is one of three things: a teammate who queues with you, a Teams fill that turns a part-full group into a five, or a lesson by the hour. First, the teammate tiers are Duo Plus with a Diamond 4+ player, Duo Pro with a Master+ player and Duo Apex with a Grandmaster+ player. Ranked prices follow your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro. Casual modes keep one flat price: ARAM Night, Normal Draft and Swiftplay each cost {{p_aram}} per game. Bundles cut the total, {{pct3}} off 3 games up to {{pct10}} off 10. Second, the fills: Ranked 5s books a whole Master+ five at {{p_ranked5}} per game, Flex Squad covers up to {{seats_flex}} empty Ranked Flex seats at {{p_flex}} and Clash Roster is the tournament-weekend version at {{p_clash}}. Third, the lessons, from {{p_vod}} per hour. For example, name your server and rank in the order chat using Discord before anybody hits Find Match.',
  },
  services: {
    duo1: 'Ranked Solo/Duo with a Diamond 4+ teammate who plays around your lane and pings objectives.',
    duo2: 'Ranked Solo/Duo with a Master+ shotcaller who names the next objective between fights.',
    duo3: 'Ranked Solo/Duo with a Grandmaster+ player for Diamond and Master lobbies.',
    arena:
      'Arena 2v2v2v2 with a Master+ partner who picks augments that combo with yours.',
    swift:
      'Swiftplay games of about 15 to 20 minutes, same map, with no LP at stake.',
    aram: 'Howling Abyss games with random champions, nonstop teamfights and a high-elo teammate.',
    norm: 'Normal Draft to try a champion or a second role with a Master+ player covering you.',
    gg1v1:
      'A custom mid-lane duel against a verified Gamer Girl: first blood, 100 CS or first tower.',
    ggbuddy:
      'A patient Gamer Girl plays ARAM or normals with you and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    ranked5:
      'Ranked Flex as a real five: Master+ players on every role, one shotcaller, voice all game.',
    flex: 'Bring one to three friends to Ranked Flex and we fill the empty seats.',
    clash:
      'A Clash roster filled with Master+ players who know draft and scouting.',
    learn:
      'One live ranked game with a Master+ coach explaining every decision out loud.',
    vod: 'One hour on a recent game: laning, wave states and map moves, ending with three fixes.',
    champ:
      'One hour on one champion: matchups, combos, builds and power spikes, practiced live.',
  },
  intros: {
    teammate:
      'Teammate prices are per game, and only ranked services move with your own rank: Duo Pro costs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. ARAM Night, Normal Draft and Swiftplay hold one price for everybody. First, pick the mode, because the mode decides whether the rank list on a card matters. Second, read the teammate tier beside the price: Duo Plus names a Diamond 4+ player, Duo Pro a Master+ player and Duo Apex a Grandmaster+ player at {{p_duo3}} per game. Arena Partner is the 2v2v2v2 option at {{p_arena}}, with augments picked to combo with yours. Bundles are the only other discount, {{pct3}} off 3 games and {{pct5}} off 5. For example, agree the lane pairing in the order chat using Discord before game 1.',
    team: 'A Teams fill is one order that hires several players at once, so a part-full group becomes a real five. Flex Squad fills up to {{seats_flex}} empty Ranked Flex seats for {{p_flex}} per game, and Ranked 5s books the whole five at {{p_ranked5}}. Clash Roster is the third shape at {{p_clash}} per game, with Master+ players who know draft and scouting for a tournament weekend. First, count the seats you actually need, because every seat is priced on its own. Second, name the roles, because a five wants top, jungle, mid, bot and support covered rather than five mid laners. Bundles still take {{pct3}} off 3 games and {{pct5}} off 5. For example, a trio short two players books 2 seats rather than 4.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount at all, so the {{pct3}} and {{pct5}} savings on teammate games stop here. VOD Review and Champion Mastery each cost {{p_vod}} per hour. Play and Learn is the exception that covers one live ranked game at {{p_learn}} rather than a clock hour. First, pick the problem rather than the format. For example, a player who keeps dying on the third wave books VOD Review instead of a fourth duo game. Screen share runs using Discord, the coach never logs into your account, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking a League of Legends duo work?',
    items: [
      'Pick a service and the number of games first. Duo Pro is the ranked Solo/Duo tier with a Master+ teammate, and 3 games at {{rank_duo2}} on EUW cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five games take {{pct5}} off.',
      'Second, add your server, rank, main role and language at checkout. For example, name EUW, {{rank_duo2}} and the lane you want covered, so your teammate reads the real request before accepting.',
      'Finally, meet your teammate in the order chat using Discord. Agree champions and the mode, then send the invite from the League client. One Duo Pro game costs {{p_duo2}}.',
    ],
    note: 'Duoly reviews every League teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which League of Legends session fits you?',
    intro:
      'The right League session is the one matching your goal tonight. First, the casual modes hold one price at every rank: ARAM Night, Normal Draft and Swiftplay are each {{p_aram}} per game. Ranked follows the rank you sit at, and a Teams fill is priced per seat instead. For example, 3 games take {{pct3}} off and 5 games take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing Solo/Duo this split?',
        service: 'duo2',
        answer:
          'Duo Pro names a Master+ shotcaller from {{p_duo2_low}} per game, priced by your rank.',
      },
      {
        goal: 'Stuck in Diamond or Master lobbies?',
        service: 'duo3',
        answer:
          'Duo Apex brings a Grandmaster+ player who can take over a game, {{p_duo3}} at {{rank_duo3}}.',
      },
      {
        goal: 'Just want a relaxed evening?',
        service: 'aram',
        answer:
          'ARAM Night costs {{p_aram}} per game at every rank, and 5 games get {{pct5}} off.',
      },
      {
        goal: 'Short a player for Ranked Flex?',
        service: 'flex',
        answer:
          'Flex Squad fills up to {{seats_flex}} seats with Master+ players for {{p_flex}} per game.',
      },
      {
        goal: 'Want to fix one repeatable mistake?',
        service: 'vod',
        answer:
          'VOD Review is one hour with a Grandmaster+ coach for {{p_vod}}, ending with three fixes.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'The teammate you queue with is a reviewed League player who applied for the game and showed a rank before taking orders. Duo Plus names a Diamond 4+ player, Duo Pro a Master+ player and Duo Apex a Grandmaster+ player at {{p_duo3}} per game, which is the top tier Duoly sells for the game. Orders are not auto-assigned: a teammate picks yours up from the queue, so the person who accepts chose your request. Nobody from Duoly ever logs into your account.',
        'What the tier buys is calm, useful comms. A Master+ teammate names the next objective, says when a summoner spell is down and calls the reset. Voice runs using Discord, so the call arrives before the fight rather than after. Rank also sets the price: Duo Pro costs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Bundles cut that total by {{pct3}} on 3 games and {{pct5}} on 5. For example, you keep your champion, your decisions and your account in all 3 games.',
      ],
    },
    {
      heading: 'What does a League of Legends five-stack booking include?',
      paragraphs: [
        'A League five-stack booking is one of three Teams services. First, Ranked 5s books a whole Master+ five at {{p_ranked5}} per game, with one shotcaller and voice all game. Second, Flex Squad fills only the seats you are missing, up to {{seats_flex}} of them at {{p_flex}} per game, so a trio short two players books 2 seats rather than 4. Third, Clash Roster is the tournament-weekend version at {{p_clash}} per game, with players who know draft and scouting.',
        'All three start the same way. Pick the service, pick the seat count, pay once, then meet the roster in the order chat. Name your server, the roles you already cover and the evening you want to play, so nobody turns up expecting mid. For example, a duo that always lacks a jungler books one seat and keeps its own bot lane. Voice runs using Discord, invites come from the League client, and bundles still take {{pct3}} off 3 games and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three ARAM Night games on EUW',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. ARAM Night is the one to show, because the Howling Abyss has no rank gate at all, so any 2 accounts on EUW can queue it. Three games cost {{p_aram_x3}} with the {{pct3}} bundle discount, against {{p_aram}} for a single game. The order chat opens straight after payment, and the first message names the server and what you want from the evening: EUW, happy to play frontline, looking for someone who engages first.',
        'From there the evening runs on a short plan. You agree who takes the engage and who holds the poke, voice goes on, and the invite comes from the League client. After each game you pick one adjustment, for example grouping on the enemy side of the bridge instead of defending the tower, agreed using Discord. The same shape works on Normal Draft or Swiftplay, both {{p_aram}} per game, and Arena Partner is the 2v2v2v2 version at {{p_arena}}.',
      ],
    },
    {
      heading: 'When is League coaching the better booking?',
      paragraphs: [
        'League coaching is the better booking when the goal is a repeatable fix rather than company for the next game. A duo teammate answers a quick question between fights. A coach stops the game, names the pattern and leaves you with homework. VOD Review and Champion Mastery each cost {{p_vod}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate games only.',
        'For example, a player who keeps dying on the third wave gains more from one review of wave states than from a fourth duo game. A player who wants a calm evening gains more from ARAM Night at {{p_aram}} per game. Screen share runs using Discord, and Play and Learn covers one live ranked game at {{p_learn}} instead of a clock hour. The full service list, preparation tips and lesson formats live on the [League of Legends coaching page](/games/league-of-legends/coaching). The [Play League of Legends with someone](/games/league-of-legends/play-with-someone) page covers ARAM, normals and ranked duo on their own, while [Teamfight Tactics partners](/games/teamfight-tactics) and [Wild Rift teammates](/games/wild-rift) are the other Riot games Duoly sells.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about League of Legends sessions?',
    items: [
      [
        'Is Duoly a free League of Legends teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from Riot Games are the free routes, so try those first.',
      ],
      [
        'How much does a League duo cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}} on EUW, and {{p_duo2_low}} at the lowest rank. ARAM Night, Normal Draft and Swiftplay each cost {{p_aram}}.',
      ],
      [
        'How do I book a full League of Legends five?',
        'Ranked 5s books a whole Master+ five at {{p_ranked5}} per game, Flex Squad fills up to {{seats_flex}} empty Ranked Flex seats at {{p_flex}}, and Clash Roster covers a tournament weekend at {{p_clash}}.',
      ],
      [
        'Can I choose my role and my lane partner?',
        'Yes: name the role in the order chat and your teammate plans around the pick, for example a Master+ ADC trading on your support engage, with voice using Discord.',
      ],
      [
        'Do bundles make several games cheaper?',
        'Yes: 3 games get {{pct3}} off, 5 games get {{pct5}} off and 10 games get {{pct10}} off, so 3 Duo Pro games cost {{p_duo2_x3}} at {{rank_duo2}} in 2026.',
      ],
      [
        'Where do I book a League of Legends coach?',
        'The League coaching page sells VOD Review and Champion Mastery by the hour, plus one live ranked game in Play and Learn. Coaching gets no bundle discount.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in League of Legends?',
    text: 'Duo Pro is the ranked Solo/Duo tier with a Master+ teammate from Duoly. Three games at {{rank_duo2}} on EUW cost {{p_duo2_x3}} with {{pct3}} off, and 5 games take {{pct5}} off. ARAM Night stays {{p_aram}} per game at any rank, and Normal Draft costs the same. Ranked 5s books a whole Master+ five at {{p_ranked5}} per game, and Flex Squad fills up to {{seats_flex}} empty seats at {{p_flex}} in 2026. For example, pick your rank and role, then agree champions and the mode in the order chat using Discord.',
  },
};
