import type { HubPageCopy } from '../hub-pages';

export const leagueOfLegends: HubPageCopy = {
  gameSlug: 'league-of-legends',
  title: 'League of Legends LFG: Find a Duo or a Coach | Duoly',
  description:
    'Book a League of Legends duo, a Ranked Flex five or a coach on Duoly, {{from_lower}}. Compare Solo/Duo, ARAM, Arena and Clash prices.',
  eyebrow: 'League of Legends teammates',
  h1: 'League of Legends LFG: find a duo for tonight',
  lead: 'Free LFG posts are great for building a regular group. Duoly books a reviewed higher-rank teammate for your next games, fills a Ranked Flex five and sells coaching when you want to learn.',
  cta: 'Book a League teammate',
  facts: [
    'Diamond 4+ to Challenger teammates',
    'Solo/Duo, Flex, ARAM and Arena',
    'Voice on Discord, your own account',
  ],
  related: ['teamfight-tactics', 'marvel-rivals', 'pokemon-unite', 'valorant'],
  format: {
    heading: 'What can you book for League of Legends on Duoly?',
    text: 'A Duoly League of Legends booking is a paid session where reviewed higher-rank players join your games on your own account. Three ranked tiers cover Solo/Duo: Duo Plus with a Diamond 4+ teammate, Duo Pro with a Master+ teammate and Duo Apex with a Grandmaster+ teammate. Ranked prices follow your own rank, so a {{rank_duo2}} player on EUW pays {{p_duo2}} per game for Duo Pro in November 2026. For example, ARAM Night, Normal Draft and Swiftplay each cost {{p_aram}} per game at every rank, because casual modes keep one flat price. Bundles cut the total: 3 games get {{pct3}} off, 5 games get {{pct5}} off and 10 games get {{pct10}} off. Teams fills cover Ranked Flex and Clash, and coaching runs by the hour. Ranked duo still follows the party rules from Riot Games, so check the client restrictions together. Finally, every booking opens an order chat, where you agree roles and voice using Discord before the first queue.',
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
      'One teammate joins your games on your own account, from ranked Solo/Duo to ARAM and Arena.',
    team: 'Teams fills add several Master+ players at once, priced for the seats you need covered.',
    coaching:
      'Every lesson runs for one hour, except Play and Learn, which covers one live ranked game.',
  },
  steps: {
    heading: 'How does booking a League of Legends duo work?',
    items: [
      'First, pick a service and the number of games. Duo Pro is the ranked Solo/Duo option with a Master+ teammate, and 3 games at {{rank_duo2}} on EUW cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five games get {{pct5}} off.',
      'Second, add your server, rank, main role and language at checkout. For example, name EUW, {{rank_duo2}} and the lane you want covered, so your teammate reads the real request before accepting the order.',
      'Third, meet your teammate in the order chat, agree champions and voice using Discord, then send the invite from Riot’s League client. A single Duo Pro game costs {{p_duo2}} at the same rank in 2026. Ten games get {{pct10}} off.',
    ],
    note: 'Duoly reviews every League teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which League of Legends session fits you?',
    intro:
      'The right League session is the one matching your goal for the evening. For example, a {{rank_duo2}} player climbing Solo/Duo pays {{p_duo2}} per game for Duo Pro in 2026. Pick the goal first, because the party rules from Riot Games decide the rest. Bundles cut totals by {{pct3}} on 3 games.',
    picks: [
      {
        goal: 'Climbing Solo/Duo this split?',
        service: 'duo2',
        answer:
          'Duo Pro puts a Master+ shotcaller in your games from {{p_duo2_low}} per game, priced by your rank.',
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
        'A Duoly League teammate is a reviewed player who applied for the game and showed a rank before taking orders. Duo Plus names a Diamond 4+ player, Duo Pro a Master+ player and Duo Apex a Grandmaster+ player. The tier describes the teammate, never your own queue eligibility. Ranked party restrictions from Riot Games decide which accounts queue together, so share your server and rank in the order chat first.',
        'What the tier buys you is calm, useful comms. First, a Master+ teammate names the next objective, says when a summoner spell is down and calls the reset instead of reviewing the last fight. Second, voice runs using Discord, so the calls arrive before the fight. For example, a {{rank_duo2}} player on EUW pays {{p_duo2}} per game for Duo Pro in 2026. A {{rank_duo2_high}} player pays {{p_duo2_high}}, because higher lobbies need stronger teammates, and bundles take {{pct3}} off 3 games or {{pct5}} off 5. You keep your champion, your decisions and your account in every game.',
      ],
    },
    {
      heading: 'How do Teams fills work for Ranked Flex and Clash?',
      paragraphs: [
        'A Teams fill is a single order hiring several players at once, so a part-full group becomes a real five. Flex Squad fills up to {{seats_flex}} empty Ranked Flex seats with Master+ players for {{p_flex}} per game at {{rank_flex}} in 2026. Ranked 5s books the whole five with a planned draft, one shotcaller and voice the entire game, at {{p_ranked5}} per game. Clash Roster covers tournament weekends with players who know draft and scouting, and Clash itself still follows the schedule from Riot Games.',
        'Pick the seats you actually need, because every seat is priced separately. For example, a trio short two players sets Flex Squad to two seats instead of four. First, agree the roles before the lobby opens, since a jungler and a support fill differently from two mid laners. Finally, keep comms on one call using Discord so draft and objective calls reach everybody. Bundles still apply, so 3 games get {{pct3}} off and 5 games get {{pct5}} off.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games on EUW',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} support on EUW books 3 Duo Pro games. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for a single game. The order chat opens straight after payment, and the first message names the server, the rank and the role: bot lane support, looking for an ADC who trades on your engage.',
        'The evening then runs on a short plan. First, both players agree a champion pair and a ward route. Second, voice goes on using Discord and the invite comes from Riot’s League client. Third, after each game you agree one adjustment, such as grouping earlier for the next drake. We found the rank spread by running the price tool from Duoly for every tier, so a {{rank_duo2_low}} player pays {{p_duo2_low}} per game and a {{rank_duo2_high}} player pays {{p_duo2_high}}. Five games take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is League coaching the better booking?',
      paragraphs: [
        'League coaching is the better booking when the goal is a repeatable fix rather than company for the next game. A duo teammate answers a quick question between fights. A coach stops the game, names the pattern and leaves you with homework. VOD Review and Champion Mastery each cost {{p_vod}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'For example, a player who keeps dying on the third wave gains more from one review of wave states than from another duo game. A player who wants a calm evening gains more from ARAM Night at {{p_aram}} per game. Screen share runs using Discord, and lessons follow the format set by your coach. The full service list, preparation tips and lesson formats live on the [League of Legends coaching page](/games/league-of-legends/coaching), and the duo side is covered on [play League of Legends with someone](/games/league-of-legends/play-with-someone).',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about League of Legends sessions?',
    items: [
      [
        'Is Duoly a free League of Legends teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and the in-game friend list from Riot Games stay the free routes to a group.',
      ],
      [
        'How much does a League duo cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}} on EUW, from {{p_duo2_low}} at the lowest rank. ARAM Night, Normal Draft and Swiftplay each cost {{p_aram}}.',
      ],
      [
        'Can I choose my role and my lane partner?',
        'Yes. Name the role in the order chat and your teammate plans around the pick. For example, ask a Master+ ADC to trade on your support engage, using Discord voice.',
      ],
      [
        'Can every rank queue Solo/Duo together?',
        'No. The ranked party restrictions from Riot Games apply, so both accounts need a compatible rank and the same server before the first queue.',
      ],
      [
        'Do bundles make several games cheaper?',
        'Yes. Three games get {{pct3}} off, 5 games get {{pct5}} off and 10 games get {{pct10}} off, so 3 Duo Pro games cost {{p_duo2_x3}} in 2026.',
      ],
      [
        'Where do I book a League of Legends coach?',
        'On the League of Legends coaching page, with VOD Review and Champion Mastery by the hour and one live ranked game in Play and Learn. Coaching gets no bundle discount.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in League of Legends?',
    text: 'Duo Pro is the ranked Solo/Duo session with a Master+ teammate from Duoly. For example, 3 games at {{rank_duo2}} on EUW cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five games get {{pct5}} off. Finally, pick your rank and role, then meet your teammate in the order chat using Discord.',
  },
};
