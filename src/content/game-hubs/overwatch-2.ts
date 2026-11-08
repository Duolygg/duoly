import type { HubPageCopy } from '../hub-pages';

export const overwatch2: HubPageCopy = {
  gameSlug: 'overwatch-2',
  title: 'Overwatch 2 LFG: Find a Duo or a 5-Stack | Duoly',
  description:
    'Book an Overwatch 2 duo, a 5-stack Role Queue fill or role coaching on Duoly, {{from_lower}}. Compare Competitive and Stadium prices.',
  eyebrow: 'Overwatch 2 teammates',
  h1: 'Overwatch 2 LFG: find a duo for Competitive',
  lead: 'Free LFG Discords work for a casual five. Duoly books a reviewed Diamond, Master or Grandmaster teammate for your next Competitive games, fills Role Queue and sells role coaching.',
  cta: 'Book an Overwatch teammate',
  facts: [
    'Diamond+ to Grandmaster teammates',
    'Role Queue, Stadium and Quick Play',
    'Voice on Discord, your own account',
  ],
  related: ['marvel-rivals', 'apex-legends', 'rainbow-six-siege'],
  format: {
    heading: 'What can you book for Overwatch 2 on Duoly?',
    text: 'A Duoly Overwatch 2 booking is a paid session where reviewed higher-rank players join your team on your own account. Duo Plus brings a Diamond+ teammate who complements your role, Duo Pro a Master+ player who calls engages and Duo Apex a Grandmaster+ player who can swing fights alone. Prices follow your own rank, so a {{rank_duo2}} player pays {{p_duo2}} per game for Duo Pro in November 2026. For example, Quick Play and Arcade costs {{p_qp}} per game at every rank, because casual modes keep one flat price. Bundles cut the total: 3 games get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. A 5-Stack Role Queue fill covers the empty seats, and the group rules from Blizzard Entertainment still apply. Finally, every booking opens an order chat, where you agree roles, heroes and voice using Discord.',
  },
  services: {
    duo1: 'Role Queue Competitive with a Diamond player who complements your role and plays around you.',
    duo2: 'Competitive with a Master player who tracks cooldowns and calls every engage.',
    duo3: 'Competitive with a Grandmaster or Champion player who can swing fights alone.',
    stadium:
      'Stadium runs together: plan your builds round by round and close out the best of seven.',
    qp: 'Quick Play and arcade modes with someone who is fun and genuinely good.',
    gg1v1:
      'A custom hero duel against a verified Gamer Girl, rematches encouraged.',
    ggbuddy:
      'A patient Gamer Girl plays Quick Play or Arcade and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    five: 'Bring your friends and we fill your five on the roles you need for a real comp night.',
    learn:
      'One live Competitive game with a Grandmaster+ coach explaining every decision.',
    role: 'One hour on tank, damage or support: positioning, cooldowns and when to take space.',
  },
  intros: {
    teammate:
      'One teammate joins your games on your own account, from Role Queue Competitive to Stadium.',
    team: 'A 5-stack fill adds several Master+ players at once, priced for the seats you need covered.',
    coaching:
      'Both lessons run for one hour, one live in Competitive and one on your chosen role.',
  },
  steps: {
    heading: 'How does booking an Overwatch 2 duo work?',
    items: [
      'First, pick a service and the number of games. Duo Pro is the Competitive option with a Master+ teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five games get {{pct5}} off.',
      'Second, add your region, rank, role and language at checkout. For example, name Europe, {{rank_duo2}} and support as your role, so your teammate reads the real request from Duoly before accepting.',
      'Third, meet your teammate in the order chat, agree the hero pair and voice using Discord, then add each other by BattleTag. A single Duo Pro game costs {{p_duo2}} at the same rank in 2026. Ten games get {{pct10}} off.',
    ],
    note: 'Duoly reviews every Overwatch teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Overwatch 2 session fits you?',
    intro:
      'The right Overwatch session is the one matching your goal for the evening, so pick the goal first and let the price follow. For example, a {{rank_duo2}} player climbing Competitive pays {{p_duo2}} per game for Duo Pro in 2026, with {{pct3}} off 3 games and {{pct5}} off 5. Voice runs using Discord in every session booked from Duoly.',
    picks: [
      {
        goal: 'Climbing Role Queue Competitive?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Master+ teammate from {{p_duo2_low}} per game, priced by your own rank and calling every engage.',
      },
      {
        goal: 'Need a tank who plays around you?',
        service: 'duo1',
        answer:
          'Duo Plus is the Diamond+ option that fills the role your team keeps lacking, {{p_duo1}} at {{rank_duo1}}.',
      },
      {
        goal: 'Prefer Stadium to Role Queue?',
        service: 'stadium',
        answer:
          'Stadium Duo costs {{p_stadium}} per game, with builds planned round by round through the best of seven.',
      },
      {
        goal: 'Want a full comp night?',
        service: 'five',
        answer:
          '5-Stack Role Queue covers up to {{seats_five}} seats with Master+ players on the roles you name.',
      },
      {
        goal: 'One role holding you back?',
        service: 'role',
        answer:
          'Role Coaching is one hour with a Grandmaster+ coach on positioning, cooldowns and space.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'A Duoly Overwatch teammate is a reviewed player who applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player, Duo Pro a Master+ player and Duo Apex a Grandmaster or Champion player. The tier describes the teammate, never your own lobby. Group rules from Blizzard Entertainment decide which ranks can queue Competitive together, so share your region and rank in the order chat first. For example, a {{rank_duo2}} player pays {{p_duo2}} per game in 2026.',
        'What the rank buys you is fight timing. First, a Master+ teammate tracks the enemy cooldowns and calls the engage instead of walking in on cooldown. Second, voice runs using Discord, so the regroup call lands before the next fight. A {{rank_duo2_high}} player pays {{p_duo2_high}} per game, because higher lobbies need stronger teammates, and bundles take {{pct3}} off 3 games or {{pct5}} off 5. You keep your hero and your account.',
      ],
    },
    {
      heading: 'Which role pairs make the best Overwatch duo?',
      paragraphs: [
        'A good Overwatch duo is a pair of roles sharing one plan for each fight. Tank and support is the steadiest pair, because the tank takes space only as far as the healing reaches. Damage and support needs the same agreement about distance, since a flanker out of line of sight gets nothing. Two damage players need a shared entry and an exit, so decide who starts the fight and which cooldown means a reset.',
        'For example, a {{rank_duo2}} support in Europe books Duo Pro with a Master+ tank at {{p_duo2}} per game in 2026. Three games cost {{p_duo2_x3}} with {{pct3}} off, inside the group rules from Blizzard Entertainment. First, agree the hero pair. Second, agree the ultimate order, because two ultimates on the same target waste a fight. Finally, keep the calls short using Discord. Bundles still apply, so 3 games get {{pct3}} off and 5 get {{pct5}} off the total.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games in Europe',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} support in Europe books 3 Duo Pro games. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. The order chat opens straight after payment, and the first message names the region, the rank and the role: Europe, {{rank_duo2}}, main support, looking for a tank who takes space on the first point.',
        'The evening then runs on a short plan. First, both players agree a hero pair and an ultimate order. Second, voice goes on using Discord and the invite goes out by BattleTag. Third, after each game you agree one adjustment, such as grouping before the first choke instead of trickling. We found the rank spread by running the price tool from Duoly for every tier, so a {{rank_duo2_low}} player pays {{p_duo2_low}} in 2026. Five games take {{pct5}} off.',
      ],
    },
    {
      heading: 'When is Overwatch coaching the better booking?',
      paragraphs: [
        'Overwatch coaching is the better booking when the goal is a repeatable fix rather than company for the next game. A duo teammate answers a quick question between rounds. A coach pauses the replay, names the pattern and leaves you with homework. Role Coaching costs {{p_role}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'For example, a support who dies first every fight gains more from one positioning hour than from another Competitive game. A player who wants a relaxed evening gains more from Quick Play and Arcade at {{p_qp}} per game. Play and Learn is one live Competitive game with a Grandmaster+ coach at {{p_learn}}. Overwatch 2 has no separate Duoly coaching page yet, so lessons are booked from the prices above, using Discord screen share.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Overwatch 2 sessions?',
    items: [
      [
        'Is Duoly a free Overwatch 2 teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and the in-game social menu from Blizzard Entertainment stay the free routes.',
      ],
      [
        'How much does an Overwatch duo cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}} in 2026. First, bundles take {{pct3}} off 3 games, and 10 games cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Can I pick my teammate role?',
        'Yes. Name tank, damage or support in the order chat, using Discord for voice, and your teammate queues the role that complements your own pick.',
      ],
      [
        'Can every rank group in Competitive?',
        'No. The group restrictions from Blizzard Entertainment apply, so both accounts need a compatible rank and the same region before queueing.',
      ],
      [
        'Can we play Stadium instead?',
        'Yes. Stadium Duo is its own flat-price service, with builds planned round by round across the best of seven games.',
      ],
      [
        'Can a stack fill cover fewer seats?',
        'Yes. Set the seats to the gaps you actually have, using Discord to agree roles first. 5-Stack Role Queue opens at {{seats_five}} seats.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Overwatch 2?',
    text: 'Duo Pro is the Competitive session with a Master+ teammate from Duoly. For example, 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five games get {{pct5}} off. Finally, agree your hero pair using Discord and add each other by BattleTag.',
  },
};
