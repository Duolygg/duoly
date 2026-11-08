import type { HubPageCopy } from '../hub-pages';

export const overwatch2: HubPageCopy = {
  gameSlug: 'overwatch-2',
  title: 'Overwatch 2 Teammates, 5-Stacks and Coaching | Duoly',
  description:
    'Book an Overwatch 2 teammate, a 5-stack fill or role coaching on Duoly, {{from_lower}}. Compare Competitive and Stadium prices.',
  eyebrow: 'Overwatch 2 teammates',
  h1: 'Book Overwatch 2 teammates, a 5-stack or a role coach',
  lead: 'Free LFG Discords work for a casual five. Duoly books a reviewed Diamond, Master or Grandmaster teammate for your next Competitive games, fills Role Queue and sells role coaching.',
  cta: 'Book an Overwatch teammate',
  facts: [
    'Diamond+ to Grandmaster teammates',
    'Role Queue, Stadium and Quick Play',
    'Voice on Discord, your own account',
  ],
  related: ['marvel-rivals', 'apex-legends', 'rainbow-six-siege'],
  intent:
    'Hunting for free Discords, or a teammate chosen by role rather than by tier? The dedicated page sets the free routes next to the paid Role Queue sessions.',
  format: {
    heading: 'What can you book for Overwatch 2 on Duoly?',
    text: 'Duoly sells three things for Overwatch 2: one teammate who joins your games on your own account, a 5-stack fill for the seats you are missing, and coaching by the hour. Duo Plus brings a Diamond+ teammate who complements your role, Duo Pro a Master+ player who calls engages and Duo Apex a Grandmaster or Champion player who can swing a fight alone. Ranked sessions follow your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro, while Quick Play and Arcade keeps one flat price of {{p_qp}} per game at every rank. Bundles cut the total, {{pct3}} off 3 games up to {{pct10}} off 10. Blizzard Entertainment sorts groups into narrow and wide by how far apart your ranks are, so share your region and rank in the order chat before you queue.',
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
      'Teammate prices are per game, and the Competitive services read your own rank, so a Top 500 lobby costs more than a Bronze one. Quick Play, Arcade and Stadium hold one price for everybody. One teammate joins your games on your own account and plays the role your group is short of, and bundles take {{pct3}} off 3 games or {{pct5}} off 5.',
    team: 'The 5-stack fill is priced per seat, so the card covers the default {{seats_five}} seats and falls when your group already has bodies. It reads your own rank like the Competitive duos do, and a full five is also the party shape that keeps Role Queue locked in rather than leaving the roles to chance. Bundles take {{pct3}} off 3 games.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate sessions do not apply. Role Coaching works through one role in depth, from positioning and cooldown tracking to the ultimate economy, and Play and Learn is the live option where a Grandmaster coach talks through a real Competitive game. Screen share runs on Discord.',
  },
  steps: {
    heading: 'How does booking an Overwatch 2 duo work?',
    items: [
      'Pick a service and the number of games. Duo Pro is the Competitive tier with a Master+ teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five games take {{pct5}} off.',
      'Add your region, rank, role and language at checkout. Name Europe, {{rank_duo2}} and support as your role, so your teammate reads the real request before accepting.',
      'Meet your teammate in the order chat, agree the hero pair and the ultimate order, then add each other by BattleTag. A single Duo Pro game costs {{p_duo2}} at the same rank.',
    ],
    note: 'Duoly reviews every Overwatch teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Overwatch 2 session fits you?',
    intro:
      'The right Overwatch session is the one matching your goal for the evening, so pick the goal first and let the price follow. Competitive sessions are priced by your own rank, from {{p_duo2_low}} per game on Duo Pro, with {{pct3}} off 3 games and {{pct5}} off 5. Voice runs on Discord in every session.',
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
          'Duo Plus is the Diamond+ tier that fills the role your team keeps lacking, {{p_duo1}} at {{rank_duo1}}.',
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
        'Every Duoly Overwatch teammate applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player, Duo Pro a Master+ player and Duo Apex a Grandmaster or Champion player. The tier describes the teammate you are hiring and nothing about your own lobby, because Blizzard Entertainment measures the gap in skill divisions: Bronze through Diamond group inside ten divisions, Master and Grandmaster inside five, Champion inside three. Anything wider counts as a wide group, which still queues 5v5 Role Queue Competitive but meets other wide groups and moves your rank in smaller steps.',
        'What the rank actually buys you is fight timing. A Master+ teammate tracks the enemy cooldowns and calls the engage instead of walking in while yours are down. Voice runs on Discord, so the regroup lands before the next fight rather than after it. Rank also sets the price: Duo Pro runs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. You keep your hero, your aim and your account.',
      ],
    },
    {
      heading: 'Which role pairs make the best Overwatch duo?',
      paragraphs: [
        'A good Overwatch duo is a pair of roles sharing one plan for each fight. Tank and support is the steadiest pair, because the tank takes space only as far as the healing reaches. Damage and support needs the same agreement about distance, since a flanker out of line of sight gets nothing. Two damage players need a shared entry and an exit, so decide who starts the fight and which cooldown means a reset.',
        'Agree the hero pair before you queue, then agree the ultimate order, because two ultimates on the same target waste a whole fight. A Zarya grav wants a follow-up, a Kiriko suzu wants to be held for it, and neither works if both players call at once. Keep the calls short on Discord: the enemy support is down, their tank has no shield, reset. Three Duo Pro games cost {{p_duo2_x3}} at {{rank_duo2}} with {{pct3}} off, and 5 games take {{pct5}} off.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} support in Europe books 3 Duo Pro games. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. The order chat opens straight after payment, and the first message names the region, the rank and the role: Europe, {{rank_duo2}}, main support, looking for a tank who takes space on the first point.',
        'A {{rank_duo2}} player grouped with a Master teammate sits outside the ten-division narrow window, so expect a wide group: still 5v5 Role Queue, matched against other wide groups, with smaller rank changes. From there the evening runs on a short plan. You agree the hero pair and the ultimate order, add each other by BattleTag, and after each game pick one adjustment, such as grouping before the first choke instead of trickling in. Five games take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Overwatch coaching the better booking?',
      paragraphs: [
        'Overwatch coaching is the better booking when the goal is a repeatable fix rather than company for the next game. A duo teammate answers a quick question between rounds; a coach pauses the replay, names the pattern and leaves you with homework. Role Coaching costs {{p_role}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'A support who dies first every fight gains more from one positioning hour than from another Competitive game. A player who wants a relaxed evening gains more from Quick Play and Arcade at {{p_qp}} per game. Play and Learn is one live Competitive game with a Grandmaster+ coach at {{p_learn}}. Overwatch 2 has no separate Duoly coaching page yet, so lessons are booked from the prices above, with screen share on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Overwatch 2 sessions?',
    items: [
      [
        'Is Duoly a free Overwatch 2 teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game social menu from Blizzard Entertainment stay the free routes.',
      ],
      [
        'How much does an Overwatch duo cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rank. Bundles take {{pct3}} off 3 games, and 10 games cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Can I pick my teammate role?',
        'Yes. Name tank, damage or support in the order chat, with voice on Discord, and your teammate queues the role that complements your own pick.',
      ],
      [
        'Can every rank group in Competitive?',
        'Almost. Blizzard Entertainment calls a group narrow when Bronze to Diamond players sit inside ten skill divisions, Master and Grandmaster inside five and Champion inside three. Wider groups still queue 5v5 Role Queue as a wide group, against other wide groups, and stay out of 6v6 Open Queue.',
      ],
      [
        'Can we play Stadium instead?',
        'Yes. Stadium Duo is its own flat-price service, with builds planned round by round across the best of seven games.',
      ],
      [
        'Can a stack fill cover fewer seats?',
        'Yes. Set the seats to the gaps you actually have, and agree roles on Discord first. 5-Stack Role Queue opens at {{seats_five}} seats.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Overwatch 2?',
    text: 'Duo Pro is the Competitive tier with a Master+ teammate from Duoly, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Quick Play stays {{p_qp}} per game at any rank. Agree your hero pair on Discord, then add each other by BattleTag.',
  },
};
