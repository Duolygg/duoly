import type { HubPageCopy } from '../hub-pages';

export const pokemonUnite: HubPageCopy = {
  gameSlug: 'pokemon-unite',
  title: 'Pokemon Unite LFG: Teammates and Coaching | Duoly',
  description:
    'Book a Pokemon Unite teammate, a full squad or draft coaching on Duoly, {{from_lower}}. Compare Ranked and Quick Battle prices.',
  eyebrow: 'Pokemon Unite teammates',
  h1: 'Pokemon Unite LFG: find a teammate for Ranked',
  lead: 'Free LFG Discords work for finding a lane partner. Duoly books a reviewed Ultra, Master or Legend teammate for your next Ranked games, fills a full five and sells draft and macro coaching.',
  cta: 'Book a Unite teammate',
  facts: [
    'Ultra+ to Legend teammates',
    'Ranked, Standard and Quick Battle',
    'Voice on Discord, your own account',
  ],
  related: ['league-of-legends', 'teamfight-tactics', 'ea-sports-fc-27'],
  format: {
    heading: 'What can you book for Pokemon Unite on Duoly?',
    text: 'A Duoly Pokemon Unite booking is a paid session where reviewed higher-rank players join your lobby on your own account. Duo Plus brings an Ultra+ teammate who plays the lane next to yours, Duo Pro a Master player who plans rotations around Drednaw, Rotom and Zapdos, and Duo Apex a Legend player for top-rated games. Prices follow your own rank, so a {{rank_duo2}} player pays {{p_duo2}} per game for Duo Pro in November 2026. For example, Standard and Quick Battle costs {{p_quick}} per game at every rank, because casual modes keep one flat price. Bundles cut the total: 3 games get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. Full Squad fills the rest of the five, and the party rules from The Pokemon Company still apply. Finally, every booking opens an order chat, where you agree lanes and voice using Discord.',
  },
  services: {
    duo1: 'Ranked with an Ultra player who plays the lane next to yours and calls objectives.',
    duo2: 'Ranked with a Master player who plans rotations around Drednaw, Rotom and Zapdos.',
    duo3: 'Ranked with a Legend player, the highest rank, for your top-rated games.',
    quick:
      'Standard or Quick Battle: relaxed games to practice new Pokemon with backup.',
    gg1v1:
      'A custom 1v1 match against a verified Gamer Girl, rematches encouraged.',
    ggbuddy:
      'A patient Gamer Girl plays Standard or Quick Battle and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    squad:
      'Fill your five with Master players on set roles, all on voice together.',
    learn:
      'One live Ranked match with a Master coach explaining every decision out loud.',
    draft:
      'One hour on picks that work together, objective timing and when to rotate.',
  },
  intros: {
    teammate:
      'One teammate joins your lobby on your own account, from Ranked to Standard and Quick Battle.',
    team: 'Full Squad adds several Master players at once, priced for the seats you need covered.',
    coaching:
      'Every lesson runs for one hour, except Play and Learn, which covers one live Ranked match.',
  },
  steps: {
    heading: 'How does booking a Pokemon Unite teammate work?',
    items: [
      'First, pick a service and the number of games. Duo Pro is the Ranked option with a Master teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five games get {{pct5}} off.',
      'Second, add your area, rank, path and language at checkout. For example, name Europe, {{rank_duo2}} and bottom lane, so your teammate reads the real request from Duoly before accepting the order.',
      'Third, meet your teammate in the order chat, agree the lane pairing and voice using Discord, then invite each other by trainer name. A single Duo Pro game costs {{p_duo2}} at the same rank in 2026. Ten games get {{pct10}} off.',
    ],
    note: 'Duoly reviews every Pokemon Unite teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Pokemon Unite session fits you?',
    intro:
      'The right Unite session is the one matching your goal for the evening, so pick the goal first and let the price follow. For example, a {{rank_duo2}} player climbing Ranked pays {{p_duo2}} per game for Duo Pro in 2026, with {{pct3}} off 3 games and {{pct5}} off 5. Voice runs using Discord in every session booked from Duoly.',
    picks: [
      {
        goal: 'Climbing Ranked this season?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Master teammate from {{p_duo2_low}} per game, priced by your own rank and calling objectives.',
      },
      {
        goal: 'Stuck below Master?',
        service: 'duo3',
        answer:
          'Duo Apex brings a Legend player, the highest rank in the game, {{p_duo3}} at {{rank_duo3}}.',
      },
      {
        goal: 'Learning a new Pokemon?',
        service: 'quick',
        answer:
          'Standard and Quick Battle costs {{p_quick}} per game with backup and nothing on the line.',
      },
      {
        goal: 'Want a full five on voice?',
        service: 'squad',
        answer:
          'Full Squad covers up to {{seats_squad}} seats with Master players on the roles you name.',
      },
      {
        goal: 'Objectives always going wrong?',
        service: 'draft',
        answer:
          'Draft and Macro is one hour with a Master coach on picks, timing and rotations.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'A Duoly Pokemon Unite teammate is a reviewed player who applied for the game and showed a rank before taking orders. Duo Plus names an Ultra+ player, Duo Pro a Master player and Duo Apex a Legend player. The tier describes the teammate, never your own lobby. Party rules from The Pokemon Company decide which ranks can queue together, so share your area and rank in the order chat first. For example, a {{rank_duo2}} player pays {{p_duo2}} per game in 2026.',
        'What the rank buys you is objective timing. First, a Master teammate calls the Drednaw group before the timer rather than after, and leaves the lane only with a plan. Second, voice runs using Discord, so a rotation call lands while the fight is still winnable. A {{rank_duo2_high}} player pays {{p_duo2_high}} per game, because higher lobbies need stronger teammates, and bundles take {{pct3}} off 3 games or {{pct5}} off 5. You keep your Pokemon and your account.',
      ],
    },
    {
      heading: 'How does a Full Squad fill work in Unite?',
      paragraphs: [
        'A Full Squad is a single order hiring several players at once, so a part-full group becomes a complete five. The fill covers up to {{seats_squad}} empty seats with Master players at {{p_squad}} per game in 2026. Three games cost {{p_squad_x3}} with {{pct3}} off, inside the party rules from The Pokemon Company. Every seat is priced separately, so a duo short three players sets the seats to three instead of four. Name the roles you want covered, because a second Speedster leaves nobody defending the goal zones.',
        'Agree the composition before anybody locks a pick. For example, ask for a Defender and a Supporter so your Attacker has room to deal damage. First, agree the lane split and who takes the central area. Second, agree who contests the final objective and who scores. Finally, keep everybody on one call using Discord. Bundles still apply, so 3 games get {{pct3}} off and 5 get {{pct5}} off the total.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games in Europe',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 Duo Pro games. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. The order chat opens straight after payment, and the first message names the area, the rank and the path: Europe, {{rank_duo2}}, bottom lane Attacker, looking for a Supporter who plays the same lane.',
        'The evening then runs on a short plan. First, both players agree a lane pairing and a backup pick each. Second, voice goes on using Discord and the invite goes out by trainer name. Third, after each game you agree one adjustment, such as grouping for Rotom thirty seconds earlier. We found the rank spread by running the price tool from Duoly for every tier, so a {{rank_duo2_low}} player pays {{p_duo2_low}} in 2026. Five games take {{pct5}} off.',
      ],
    },
    {
      heading: 'When is Pokemon Unite coaching the better booking?',
      paragraphs: [
        'Pokemon Unite coaching is the better booking when the goal is a repeatable fix rather than company for the next game. Draft and Macro is one hour with a Master coach on picks that work together, objective timing and when to rotate, at {{p_draft}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'For example, a player who loses every Zapdos fight gains more from one macro hour than from three more Ranked games. Finally, a player who wants to try a new Pokemon gains more from Standard and Quick Battle at {{p_quick}} per game. Play and Learn is one live Ranked match with a Master coach at {{p_learn}}. The duo side is covered on the [Pokemon Unite teammate guide](/games/pokemon-unite/teammate), and screen share runs using Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Pokemon Unite sessions?',
    items: [
      [
        'Is Duoly a free Pokemon Unite teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and in-game friend invites stay the free routes to a regular lane partner.',
      ],
      [
        'How much does a Unite teammate cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}} in 2026. First, bundles take {{pct3}} off 3 games, and 10 games cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Is this for Pokemon Unite or other Pokemon games?',
        'Pokemon Unite only. Duoly does not sell trading, mainline co-op adventures, Pokemon Go raids or card battles through these services.',
      ],
      [
        'Can I ask for a specific lane?',
        'Yes. Name the path in the order chat, using Discord for voice, and your teammate takes the lane next to yours or the central area instead.',
      ],
      [
        'Does a teammate booking fill my whole squad?',
        'No. A duo adds one teammate, and the other seats come from your party or the normal queue. Book a Full Squad when you want several at once.',
      ],
      [
        'Where do I read more about Unite duos?',
        'On the Pokemon Unite teammate guide, which covers lane pairings, objective calls and an example ranked plan in more detail.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next Unite ranked game?',
    text: 'Duo Pro is the Ranked session with a Master teammate from Duoly. For example, 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five games get {{pct5}} off. Finally, agree your lane pairing using Discord before the first pick.',
  },
};
