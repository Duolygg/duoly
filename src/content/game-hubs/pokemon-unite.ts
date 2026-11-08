import type { HubPageCopy } from '../hub-pages';

export const pokemonUnite: HubPageCopy = {
  gameSlug: 'pokemon-unite',
  title: 'Pokemon Unite LFG: Squads and Coaching | Duoly',
  description:
    'Book a Pokemon Unite squad, a lane partner or draft coaching on Duoly, {{from_lower}}. Compare Ranked and Quick Battle prices.',
  eyebrow: 'Pokemon Unite teammates',
  h1: 'Pokemon Unite LFG: find players for Ranked games',
  lead: 'Free LFG Discords work for finding a lane partner. Duoly books a reviewed Ultra, Master or Legend teammate for your next Ranked games, fills a full five and sells draft and macro coaching.',
  cta: 'Book a Pokemon Unite teammate',
  facts: [
    'Ultra+ to Legend teammates',
    'Ranked, Standard and Quick Battle',
    'Voice on Discord, your own account',
  ],
  related: ['league-of-legends', 'teamfight-tactics', 'ea-sports-fc-27'],
  intent:
    'After the one-teammate page rather than the whole catalog? It covers lane pairings, objective calls and an example ranked plan in detail.',
  format: {
    heading: 'What can you book for Pokemon Unite on Duoly?',
    text: 'Duoly sells three things for Pokemon Unite: one teammate who joins your lobby on your own account, a Full Squad fill for the seats you are missing, and coaching by the hour. Duo Plus brings an Ultra+ teammate who plays the lane next to yours, Duo Pro a Master player who plans rotations around Drednaw, Rotom and Zapdos, and Duo Apex a Legend player for top-rated games. Ranked follows your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro, while Standard and Quick Battle stay {{p_quick}} per game at every rank. Bundles cut the total, {{pct3}} off 3 games up to {{pct10}} off 10. A ranked invite only works within two ranks, so check both ranks in the order chat before you queue.',
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
      'Teammate prices are per game, and the Ranked tiers read your own rank, so a Legend lobby costs more than a Beginner one. Standard Battle and Quick Battle hold one price for everybody, because neither moves your rank. One teammate joins your lobby on your own account and takes the lane you ask for, and bundles take {{pct3}} off 3 games or {{pct5}} off 5.',
    team: 'Full Squad is priced per seat, so the card covers up to {{seats_squad}} seats and falls when your group is only one player short. It is a flat price rather than a rank-priced one, and a full five is also the shape that gets past the invite restriction, since a complete party no longer needs two ranks to line up. Bundles take {{pct3}} off 3 games.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate sessions do not apply. Draft and Macro works through the pick phase, lane assignments and the objective timers that decide a game, and Play and Learn is the exception that covers one live Ranked match instead of a clock hour. Screen share runs on Discord.',
  },
  steps: {
    heading: 'How does booking a Pokemon Unite teammate work?',
    items: [
      'Pick a service and the number of games. Duo Pro is the Ranked tier with a Master teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five games take {{pct5}} off.',
      'Add your area, rank, path and language at checkout. Name Europe, {{rank_duo2}} and bottom lane, so your teammate reads the real request before accepting the order.',
      'Meet your teammate in the order chat, agree the lane pairing and check the two-rank invite window, then invite each other by trainer name. A single Duo Pro game costs {{p_duo2}} at the same rank.',
    ],
    note: 'Duoly reviews every Pokemon Unite teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Pokemon Unite session fits you?',
    intro:
      'The right Unite session is the one matching your goal for the evening, so pick the goal first and let the price follow. Ranked is priced by your own rank, from {{p_duo2_low}} per game on Duo Pro, with {{pct3}} off 3 games and {{pct5}} off 5. Standard and Quick Battle carry no rank gate.',
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
        'Every Duoly Pokemon Unite teammate applied for the game and showed a rank before taking orders. Duo Plus names an Ultra+ player, Duo Pro a Master player and Duo Apex a Legend player. The tier describes the teammate you are hiring and nothing about your own lobby, because a ranked invite only goes out between players whose ranks sit within two of each other. From {{rank_duo2}} that reaches Master and stops short of Legend, so a Duo Apex session needs you higher up the ladder or a casual mode instead. Check both ranks in the order chat first.',
        'What the rank actually buys you is objective timing. A Master teammate calls the Drednaw group before the timer rather than after it, and leaves the lane only with a plan. Voice runs on Discord, so a rotation call lands while the fight is still winnable. Rank also sets the price: Duo Pro runs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. You keep your Pokemon and your account.',
      ],
    },
    {
      heading: 'How does a Full Squad fill work in Unite?',
      paragraphs: [
        'A Full Squad is one order that hires several players at once, so a part-full group becomes a complete five. The fill covers up to {{seats_squad}} empty seats with Master players at {{p_squad}} per game, and 3 games cost {{p_squad_x3}} with {{pct3}} off. Every seat is priced separately, so a duo short three players sets the seats to three instead of four. Name the roles you want covered, because a second Speedster leaves nobody defending the goal zones.',
        'Agree the composition before anybody locks a pick: a Defender and a Supporter give your Attacker room to deal damage. Then agree the lane split, who takes the central area, who contests the final objective and who scores. Keep everybody on one call, since Zapdos is decided by whoever groups first. The two-rank invite window applies to a squad as well, so build the five around the ranks you actually have. Bundles still apply, {{pct3}} off 3 games and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 Duo Pro games with a Master teammate, which is exactly two ranks up and inside the ranked invite window. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. The order chat opens straight after payment, and the first message names the area, the rank and the path: Europe, {{rank_duo2}}, bottom lane Attacker, looking for a Supporter who plays the same lane.',
        'From there the evening runs on a short plan. You agree a lane pairing and a backup pick each, voice goes on, and the invite goes out by trainer name. After each game you pick one adjustment, such as grouping for Rotom thirty seconds earlier instead of farming the jungle camp. Five games take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Pokemon Unite coaching the better booking?',
      paragraphs: [
        'Pokemon Unite coaching is the better booking when the goal is a repeatable fix rather than company for the next game. Draft and Macro is one hour with a Master coach on picks that work together, objective timing and when to rotate, at {{p_draft}} per hour. Coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'A player who loses every Zapdos fight gains more from one macro hour than from three more Ranked games. A player who wants to try a new Pokemon gains more from Standard and Quick Battle at {{p_quick}} per game. Play and Learn is one live Ranked match with a Master coach at {{p_learn}}. The one-teammate side is covered on the [Pokemon Unite teammate](/games/pokemon-unite/teammate) page, and screen share runs on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Pokemon Unite sessions?',
    items: [
      [
        'Is Duoly a free Pokemon Unite teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and in-game friend invites stay the free routes to a regular lane partner.',
      ],
      [
        'How much does a Pokemon Unite teammate cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rank. Bundles take {{pct3}} off 3 games, and 10 games cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Can every rank play a ranked match together?',
        'No. A ranked invite only works when both ranks sit within two of each other, so {{rank_duo2}} reaches Master and stops short of Legend. Standard and Quick Battle have no such limit.',
      ],
      [
        'Is this for Pokemon Unite or other Pokemon games?',
        'Pokemon Unite only. Duoly does not sell trading, mainline co-op adventures, Pokemon Go raids or card battles through these services.',
      ],
      [
        'Can I ask for a specific lane?',
        'Yes. Name the path in the order chat, with voice on Discord, and your teammate takes the lane next to yours or the central area instead.',
      ],
      [
        'Does a teammate booking fill my whole squad?',
        'No. A duo adds one teammate, and the other seats come from your party or the normal queue. Book a Full Squad when you want several at once.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next Unite ranked game?',
    text: 'Duo Pro is the Ranked tier with a Master teammate from Duoly, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Standard and Quick Battle stay {{p_quick}} per game at any rank. Agree your lane pairing on Discord before the first pick.',
  },
};
