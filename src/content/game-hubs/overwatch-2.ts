import type { HubPageCopy } from '../hub-pages';

export const overwatch2: HubPageCopy = {
  gameSlug: 'overwatch-2',
  title: 'Overwatch 2 Teammates, 5-Stacks and Coaching | Duoly',
  description:
    'Book an Overwatch 2 teammate, a 5-stack fill or role coaching on Duoly, {{from_lower}}. Compare Competitive and Stadium prices.',
  eyebrow: 'Overwatch 2 teammates',
  h1: 'Book Overwatch 2 teammates, a 5-stack or a role coach',
  lead: 'Free LFG Discords work for a casual five. Duoly books a reviewed Diamond, Master, Grandmaster or Champion teammate for Role Queue, fills the empty seats of a five and sells role coaching by the hour.',
  facts: [
    'Diamond+ to Grandmaster teammates',
    'Role Queue, Stadium and Quick Play',
    'Voice on Discord, your own account',
  ],
  cta: 'Book an Overwatch teammate',
  related: [
    'rainbow-six-siege',
    'counter-strike-2',
    'valorant',
    'marvel-rivals',
    'deadlock',
  ],
  intent:
    'Hunting for free Discords, or a teammate chosen by role rather than by tier? The dedicated page sets the free routes next to the paid Role Queue sessions.',
  format: {
    heading: 'What can you book for Overwatch 2 on Duoly?',
    text: 'An Overwatch 2 booking on Duoly is a single reviewed teammate, a 5-stack fill or a coaching hour. The Competitive tiers are Duo Plus with a Diamond+ player, Duo Pro with a Master+ player and Duo Apex with a Grandmaster or Champion player. Competitive prices follow your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro. Quick Play and Arcade holds one flat price of {{p_qp}} at every rank, and Stadium Duo costs {{p_stadium}}. Bundles of {{main}} cut the total, {{bundles}}. The fill: 5-Stack Role Queue hires Master+ players for up to {{seats_five}} seats from {{p_five_low}} per game, which turns a part-full group into a real comp night. Lessons start from {{p_role}} for one hour on a single role. Name your region and role using Discord first.',
  },
  services: {
    duo1: 'Role Queue Competitive with a Diamond player who complements your role and plays around you.',
    duo2: 'Competitive with a Master player who tracks cooldowns and calls every engage.',
    duo3: 'Competitive with a Grandmaster or Champion player who can swing a fight alone.',
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
      'Teammate prices are per game, and the Competitive services read your own rank: Duo Pro costs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Quick Play and Arcade, Stadium Duo and the Gamer Girl sessions hold one price for everybody. Pick the mode, because the mode decides whether the rank list on a card matters. Read the teammate tier beside the price: Duo Plus names a Diamond+ player, Duo Pro a Master+ player and Duo Apex a Grandmaster or Champion player from {{p_duo3_low}} per game. Every teammate booking adds one player to your group, so the tier decides who takes that seat. Only {{main}} is sold in bundles, {{bundles}}, and every other service books {{picker}}. Agree the hero pair using Discord before game 1.',
    team: 'A 5-stack fill is one order that hires several players at once, so a part-full group becomes a real five. 5-Stack Role Queue covers up to {{seats_five}} seats at {{p_five}} per game at {{rank_five}}, from {{p_five_low}} at {{rank_five_low}}. Count the seats you actually need, because every seat is priced on its own. Name the roles, because Role Queue holds 1 tank, 2 damage and 2 support and the fill covers whichever of those your group is missing. Bundles of {{main}} take {{bundles}}. For example, a trio short 2 players books 2 seats rather than 4, agreed using Discord.',
    coaching:
      'Lessons are priced by the hour and get no quantity or bundle discount at all, so the {{pct3}} to {{pct10}} bundle savings on teammate games stop here. Role Coaching costs {{p_role}} per hour and works through one role in depth, from positioning and cooldown tracking to the ultimate economy. Play and Learn is the live option where a Grandmaster+ coach talks through one real Competitive game at {{p_learn}}. Pick the problem rather than the format. For example, a support who dies first in every fight books the positioning hour instead of a fourth Competitive game. Screen share runs using Discord, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking an Overwatch 2 duo work?',
    items: [
      'Pick a service and the number of games first. Duo Pro is the Competitive tier with a Master+ teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five games take {{pct5}} off.',
      'Add your region, rank, role and language at checkout. Name Europe, {{rank_duo2}} and support as your role, so your teammate reads the real request before accepting.',
      'Meet your teammate in the order chat using Discord. Agree the hero pair and the ultimate order, then add each other by BattleTag. One Duo Pro game costs {{p_duo2}} at {{rank_duo2}}.',
    ],
    note: 'Duoly reviews every Overwatch teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Overwatch 2 session fits you?',
    intro:
      'The right Overwatch session is the one matching your goal for the evening. Quick Play and Stadium stay flat at every rank, {{p_qp}} and {{p_stadium}} per game. Competitive sessions are priced by your own rank, from {{p_duo2_low}} per game on Duo Pro, and a 5-stack fill is priced per seat instead. A {{main}} bundle takes {{bundles}}, so a bundle beats booking 1 at a time. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing Role Queue Competitive?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Master+ teammate from {{p_duo2_low}} per game, priced by your own rank.',
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
          'Stadium Duo costs {{p_stadium}} per game, with builds planned round by round.',
      },
      {
        goal: 'Want a full comp night?',
        service: 'five',
        answer:
          '5-Stack Role Queue covers up to {{seats_five}} seats from {{p_five_low}} per game, with Master+ players on each one.',
      },
      {
        goal: 'One role holding you back?',
        service: 'role',
        answer:
          'Role Coaching is one hour with a Grandmaster+ coach for {{p_role}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'The teammate you queue with is a reviewed Overwatch player who applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player, Duo Pro a Master+ player and Duo Apex a Grandmaster or Champion player from {{p_duo3_low}} per game, which is the top tier Duoly sells for the game. Orders are not auto-assigned: a teammate picks yours up from the queue, so the person who accepts chose your request. Nobody from Duoly ever logs into your account.',
        'What the rank buys is fight timing. A Master+ teammate tracks the enemy cooldowns and calls the engage instead of walking in while yours are down. Voice runs using Discord, so the regroup lands before the next fight rather than after. Rank also sets the price: Duo Pro costs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Bundles of {{main}} cut the total: {{bundles}}. You keep your hero, your aim and your account in all 3 games.',
      ],
    },
    {
      heading: 'What does a 5-stack fill include in Overwatch 2?',
      paragraphs: [
        'A 5-stack fill is 5-Stack Role Queue: Duoly hires Master+ players for the seats your group is missing, up to {{seats_five}} seats from {{p_five_low}} per game. Role Queue holds 1 tank, 2 damage and 2 support, so the fill covers whichever of those nobody in your group wants. Every seat is priced on its own, so a trio short 2 players books 2 seats rather than 4. For example, a group that always lacks a tank books 1 seat and keeps its own damage pair.',
        'The fill starts like any other order. Pick the service, pick the seat count, pay once, then meet everybody in the order chat. Name the region, the roles you already cover and the evening you want to play, so the hired players arrive knowing the gaps. Voice runs using Discord, invites go out by BattleTag, and nobody needs your login. Stadium Duo is the other group format at {{p_stadium}} per game, planned round by round across the best of seven.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} support in Europe books 3 Duo Pro games with a Master teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. Role Queue is 5v5, so the booked teammate takes 1 of the 5 seats and the other 3 arrive from the normal queue. The order chat opens straight after payment, and the first message names the region, the rank and the role: Europe, {{rank_duo2}}, main support, looking for a tank who takes space on the first point.',
        'From there the evening runs on a short plan. You agree the hero pair and the ultimate order, add each other by BattleTag, and voice goes on. After each game you pick one adjustment, for example grouping before the first choke instead of trickling in, agreed using Discord. Three games usually fill about 90 minutes at that rank, and 5 games take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Overwatch coaching the better booking?',
      paragraphs: [
        'Overwatch coaching is the better booking when the goal is a repeatable fix rather than company for the next game. A duo teammate answers a quick question between rounds. A coach pauses the replay, names the pattern and leaves you with homework. Role Coaching costs {{p_role}} per hour, and coaching carries no quantity or bundle discount, so the {{pct3}} to {{pct10}} bundle savings apply to teammate games only.',
        'Name the habit you keep repeating. For example, a support who dies first in every fight gains more from one positioning hour at {{p_role}} than from a fourth Competitive game. A player who wants a relaxed evening gains more from Quick Play and Arcade at {{p_qp}} per game in 2026. Play and Learn is one live Competitive game with a Grandmaster+ coach at {{p_learn}}, and screen share runs using Discord. The full service list, preparation tips and lesson formats live on the [Overwatch 2 coaching page](/games/overwatch-2/coaching). The [Overwatch 2 LFG page](/games/overwatch-2/lfg) sets the free routes beside the paid ones, and [Marvel Rivals teammates](/games/marvel-rivals) is the other hero shooter here.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Overwatch 2 sessions?',
    items: [
      [
        'Is Duoly a free Overwatch 2 teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game social menu from Blizzard are the free routes, so try those first.',
      ],
      [
        'How much does an Overwatch duo cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}}, and {{p_duo2_low}} at the lowest rank. Ten games cost {{p_duo2_x10}} with {{pct10}} off in 2026.',
      ],
      [
        'How do I book a full Overwatch 2 five?',
        '5-Stack Role Queue hires Master+ players for up to {{seats_five}} seats from {{p_five_low}} per game, and you set the seat count to the gaps your group actually has.',
      ],
      [
        'Can I pick my teammate role?',
        'Yes: name tank, damage or support in the order chat, with voice using Discord, and your teammate queues the role that complements your own pick.',
      ],
      [
        'Can we play Stadium instead?',
        'Yes: Stadium Duo is its own flat-price service at {{p_stadium}} per game, with builds planned round by round across the best of seven.',
      ],
      [
        'Can a stack fill cover fewer seats?',
        'Yes: set the seats to the gaps you actually have, and agree roles using Discord first. 5-Stack Role Queue opens at {{seats_five}} seats.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Overwatch 2?',
    text: 'Duo Pro is the Competitive tier with a Master+ teammate from Duoly. Three games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 games take {{pct5}} off. Quick Play stays {{p_qp}} per game at any rank, and Stadium Duo costs {{p_stadium}}. 5-Stack Role Queue hires Master+ players for up to {{seats_five}} seats from {{p_five_low}} per game when you want a full comp night in 2026. Agree your hero pair using Discord, then add each other by BattleTag.',
  },
};
