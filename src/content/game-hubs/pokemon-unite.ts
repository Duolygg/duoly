import type { HubPageCopy } from '../hub-pages';

export const pokemonUnite: HubPageCopy = {
  gameSlug: 'pokemon-unite',
  title: 'Pokemon Unite LFG: Squads and Coaching | Duoly',
  description:
    'Book a Pokemon Unite squad, a lane partner or draft coaching on Duoly, {{from_lower}}. Compare Ranked and Quick Battle prices.',
  eyebrow: 'Pokemon Unite teammates',
  h1: 'Pokemon Unite LFG: find players for Ranked games',
  lead: 'Free LFG Discords work for finding a lane partner. Duoly books a reviewed Ultra, Master or Legend teammate for Ranked, fills a full five and sells draft and macro coaching by the hour.',
  cta: 'Book a Pokemon Unite teammate',
  facts: [
    'Ultra+ to Legend teammates',
    'Ranked, Standard and Quick Battle',
    'Voice on Discord, your own account',
  ],
  related: [
    'teamfight-tactics',
    'league-of-legends',
    'wild-rift',
    'world-of-warcraft',
    'arc-raiders',
  ],
  intent:
    'After the one-teammate page rather than every Unite service? It covers lane pairings, objective calls and an example ranked plan in detail.',
  format: {
    heading: 'What can you book for Pokemon Unite on Duoly?',
    text: 'A Pokemon Unite booking on Duoly is a single reviewed teammate, a Full Squad fill or a coaching hour. The Ranked tiers are Duo Plus with an Ultra+ teammate, Duo Pro with a Master player who plans Drednaw, Rotom and Zapdos, and Duo Apex with a Legend player. Ranked prices follow your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro. Standard and Quick Battle hold one flat price of {{p_quick}} at every rank. Bundles of {{main}} cut the total, {{bundles}}. The fill: Full Squad hires Master players for up to {{seats_squad}} seats at {{p_squad}} per game, so a part-full group becomes a complete five. The lesson, {{p_draft}} per hour on draft and macro. Name your lane using Discord first.',
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
      'Teammate prices are per game, and the Ranked tiers read your own rank: Duo Pro costs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Standard and Quick Battle holds one price for everybody, and so do the Gamer Girl sessions, because neither moves your rank. Pick the mode, because the mode decides whether the rank list on a card matters. Read the teammate tier beside the price: Duo Plus names an Ultra+ player, Duo Pro a Master player and Duo Apex a Legend player from {{p_duo3_low}} per game. Only {{main}} is sold in bundles, {{bundles}}, and every other service books {{picker}}. For example, agree the lane pairing using Discord before game 1.',
    team: 'A Full Squad is one order that hires several players at once, so a part-full group becomes a complete five. The fill covers up to {{seats_squad}} seats at {{p_squad}} per game, and 5 games cost {{p_squad_x5}} with {{pick5}} off. Count the seats you actually need, because every seat is priced on its own: a duo short 3 players books 3 seats rather than 4. Name the roles, because the five wants an Attacker, a Defender, a Supporter and somebody on the central area rather than five Attackers. For example, ask for a Defender and a Supporter using Discord.',
    coaching:
      'Lessons are priced by the hour and get no quantity or bundle discount at all, so the {{pct3}} to {{pct10}} bundle savings on teammate games stop here. Draft and Macro costs {{p_draft}} per hour and works through the pick phase, lane assignments and the objective timers that decide a game. Play and Learn is the exception covering one live Ranked match at {{p_learn}} rather than a clock hour. Pick the problem rather than the format. For example, a player who loses every Zapdos fight books the macro hour instead of a fourth Ranked game. Screen share runs using Discord, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking a Pokemon Unite teammate work?',
    items: [
      'Pick a service and the number of games first. Duo Pro is the Ranked tier with a Master teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five games take {{pct5}} off.',
      'Add your area, rank, path and language at checkout. For example, name Europe, {{rank_duo2}} and bottom lane, so your teammate reads the real request before accepting.',
      'Meet your teammate in the order chat using Discord. Agree the lane pairing and the Pokemon, then invite each other by trainer name. One Duo Pro game costs {{p_duo2}} at {{rank_duo2}}.',
    ],
    note: 'Duoly reviews every Pokemon Unite teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Pokemon Unite session fits you?',
    intro:
      'The right Unite session is the one matching your goal for the evening. Standard and Quick Battle keep one flat price at every rank, {{p_quick}} per game. Ranked is priced by your own rank, from {{p_duo2_low}} per game on Duo Pro, and a Full Squad fill is priced per seat instead. A {{main}} bundle takes {{bundles}}, so a bundle beats booking 1 at a time. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing Ranked this season?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Master teammate from {{p_duo2_low}} per game, priced by your own rank.',
      },
      {
        goal: 'Already at Master or above?',
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
          'Full Squad covers up to {{seats_squad}} seats for {{p_squad}} per game.',
      },
      {
        goal: 'Objectives always going wrong?',
        service: 'draft',
        answer:
          'Draft and Macro is one hour with a Master coach for {{p_draft}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'The teammate you queue with is a reviewed Pokemon Unite player who applied for the game and showed a rank before taking orders. Duo Plus names an Ultra+ player, Duo Pro a Master player and Duo Apex a Legend player from {{p_duo3_low}} per game, which is the top tier Duoly sells for the game. Orders are not auto-assigned: a teammate picks yours up from the queue, so the person who accepts chose your request. Your teammate plays on a separate account, so nobody needs your login.',
        'What the rank buys is objective timing. A Master teammate calls the Drednaw group before the timer rather than after, and leaves a lane only with a plan. Voice runs using Discord, so a rotation call lands while the fight is still winnable. Rank also sets the price: Duo Pro costs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Bundles of {{main}} cut the total: {{bundles}}. For example, you keep your Pokemon and your account in all 3 games.',
      ],
    },
    {
      heading: 'What does a Full Squad booking include in Unite?',
      paragraphs: [
        'A Full Squad booking is one order that hires several Master players at once, so a part-full group becomes a complete five at {{p_squad}} per game for up to {{seats_squad}} seats. Every Unite team holds 5 players, so the seat count is simply the gap between your group and five. Name the roles, because the five wants an Attacker, a Defender, a Supporter and somebody on the central area. For example, a duo short 3 players books 3 seats rather than 4.',
        'The fill starts like any other order. Pick the service, pick the seat count, pay once, then meet everybody in the order chat. Name your area, the lane you want and the Pokemon you trust, so the squad arrives with a workable composition. Voice runs using Discord, lobby invites go out with your Trainer details, and every hired player joins on a separate account. Bundles of {{main}} still take {{bundles}} in 2026.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 Duo Pro games with a Master teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. Every Unite team holds 5 players, so the booked teammate takes 1 seat and 3 more arrive from the normal queue. The order chat opens straight after payment, and the first message names the area, the rank and the path: Europe, {{rank_duo2}}, bottom lane Attacker, looking for a Supporter in the same lane.',
        'From there the evening runs on a short plan. You agree a lane pairing and a backup pick each, voice goes on, and the invite goes out by trainer name. After each game you pick one adjustment, for example grouping for Rotom 30 seconds earlier instead of farming the jungle camp, agreed using Discord. Three games usually fill about an hour, and 5 games take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Pokemon Unite coaching the better booking?',
      paragraphs: [
        'Pokemon Unite coaching is the better booking when the goal is a repeatable fix rather than company for the next game. Draft and Macro is one hour with a Master coach on picks that work together, objective timing and when to rotate, at {{p_draft}} per hour. Coaching carries no quantity or bundle discount, so the {{pct3}} to {{pct10}} bundle savings apply to teammate games only.',
        'Name the objective you keep losing. For example, a player who loses every Zapdos fight gains more from one macro hour at {{p_draft}} than from a fourth Ranked game. A player who wants to try a new Pokemon gains more from Standard and Quick Battle at {{p_quick}} per game in 2026. Play and Learn is one live Ranked match with a Master coach at {{p_learn}}, and screen share runs using Discord. The one-teammate side is covered on the [Pokemon Unite teammate](/games/pokemon-unite/teammate) page. [League of Legends teammates](/games/league-of-legends) and [Teamfight Tactics partners](/games/teamfight-tactics) are the nearest neighbours here.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Pokemon Unite sessions?',
    items: [
      [
        'Is Duoly a free Pokemon Unite teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and in-game friend invites are the free routes, so try those first.',
      ],
      [
        'How much does a Pokemon Unite teammate cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}}, and {{p_duo2_low}} at the lowest rank. Ten games cost {{p_duo2_x10}} with {{pct10}} off in 2026.',
      ],
      [
        'How do I book a full Pokemon Unite five?',
        'Full Squad hires Master players for up to {{seats_squad}} seats at {{p_squad}} per game, and you set the seat count to the gap between your group and five.',
      ],
      [
        'Can I ask for a particular lane partner?',
        'Yes: name your lane and your Pokemon in the order chat, then ask for a complementary role, for example a Defender who makes space for your Attacker.',
      ],
      [
        'Can I ask for a specific lane?',
        'Yes: name the path in the order chat, with voice using Discord, and your teammate takes the lane next to yours or the central area instead.',
      ],
      [
        'Does a teammate booking fill my whole squad?',
        'No: a duo adds one teammate, and the other seats come from your party or the normal queue. Book a Full Squad at {{p_squad}} per game for several at once.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next Unite ranked game?',
    text: 'Duo Pro is the Ranked tier with a Master teammate from Duoly. Three games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 games take {{pct5}} off. Standard and Quick Battle stay {{p_quick}} per game at any rank, and Duo Apex costs {{p_duo3}}. Full Squad hires Master players for up to {{seats_squad}} seats at {{p_squad}} per game when you want the whole team in 2026. For example, agree your lane pairing using Discord before the first pick.',
  },
};
