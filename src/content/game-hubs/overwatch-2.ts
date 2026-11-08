import type { HubPageCopy } from '../hub-pages';

export const overwatch2: HubPageCopy = {
  gameSlug: 'overwatch-2',
  title: 'Overwatch 2 Teammates, 5-Stacks and Coaching | Duoly',
  description:
    'Book an Overwatch 2 teammate, a 5-stack fill or role coaching on Duoly, {{from_lower}}. Compare Competitive and Stadium prices.',
  eyebrow: 'Overwatch 2 teammates',
  h1: 'Book Overwatch 2 teammates, a 5-stack or a role coach',
  lead: 'Free LFG Discords work for a casual five. Duoly books the highest-ranked teammate your Competitive group may queue with, fills Role Queue and sells role coaching.',
  facts: [
    'Diamond+ to Grandmaster teammates',
    'Role Queue, Stadium and Quick Play',
    'Voice on Discord, your own account',
  ],
  cta: 'Book an Overwatch teammate',
  related: ['marvel-rivals', 'apex-legends', 'rainbow-six-siege'],
  intent:
    'Hunting for free Discords, or a teammate chosen by role rather than by tier? The dedicated page sets the free routes next to the paid Role Queue sessions.',
  format: {
    heading: 'What can you book for Overwatch 2 on Duoly?',
    text: 'An Overwatch 2 booking on Duoly is a single reviewed teammate, a 5-stack fill or a coaching hour. First, the Competitive tiers are Duo Plus with a Diamond+ player, Duo Pro with a Master+ player and Duo Apex with a Grandmaster or Champion player. Competitive prices follow your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro. Quick Play and Arcade holds one flat price of {{p_qp}} at every rank, and Stadium Duo costs {{p_stadium}}. Bundles cut the total, {{pct3}} off 3 games up to {{pct10}} off 10. Blizzard sorts a group into narrow or wide by rank distance, and the Defense Matrix update from Blizzard dropped the rank-gap limit on wide groups in 2024, read again in November 2026. A wide group still queues 5v5 Role Queue, against other wide groups, with smaller rank changes. For example, name your region and role using Discord first.',
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
      'Teammate prices are per game, and the Competitive services read your own rank: Duo Pro costs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Quick Play, Arcade and Stadium hold one price for everybody. First, pick the mode, because the mode decides whether the rank list on a card matters. Second, read the group rule beside the tier: a wide group carries no rank-gap limit in Competitive under the 2024 rule from Blizzard, so a Gold player really can queue with a Champion teammate and gains rank in smaller steps. Bundles take {{pct3}} off 3 games and {{pct5}} off 5. For example, agree the hero pair using Discord before game 1.',
    team: 'A 5-stack fill is one order that hires several players at once, so a part-full group becomes a real five. 5-Stack Role Queue covers up to {{seats_five}} seats at {{p_five}} per game at {{rank_five}}, from {{p_five_low}} at {{rank_five_low}}. First, count the seats you actually need, because every seat is priced on its own. A full five matters in Overwatch for a second reason: Role Queue accepts a wide five with any rank spread, and a wide group of four cannot queue at all, a limit Blizzard published in 2024 and Duoly read again in November 2026. Bundles take {{pct3}} off 3 games and {{pct5}} off 5. For example, a trio short 2 players books 2 seats rather than 4, agreed using Discord.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount at all, so the {{pct3}} and {{pct5}} savings on teammate games stop here. Role Coaching costs {{p_role}} per hour and works through one role in depth, from positioning and cooldown tracking to the ultimate economy. Play and Learn is the live option where a Grandmaster+ coach talks through one real Competitive game at {{p_learn}}. First, pick the problem rather than the format. For example, a support who dies first in every fight books the positioning hour instead of a fourth Competitive game. Screen share runs using Discord, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking an Overwatch 2 duo work?',
    items: [
      'Pick a service and the number of games first. Duo Pro is the Competitive tier with a Master+ teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five games take {{pct5}} off.',
      'Second, add your region, rank, role and language at checkout. For example, name Europe, {{rank_duo2}} and support as your role, so your teammate reads the real request before accepting.',
      'Finally, meet your teammate in the order chat using Discord. Agree the hero pair and the ultimate order, then add each other by BattleTag. One Duo Pro game costs {{p_duo2}}.',
    ],
    note: 'Duoly reviews every Overwatch teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Overwatch 2 session fits you?',
    intro:
      'The right Overwatch session is the one matching your goal for the evening. First, Quick Play and Stadium stay flat at every rank. Competitive sessions are priced by your own rank, from {{p_duo2_low}} per game on Duo Pro, and a wide group crosses the ladder with smaller rank changes under the 2024 rule from Blizzard. For example, 3 games take {{pct3}} off and 5 games take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
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
          '5-Stack Role Queue covers up to {{seats_five}} seats for {{p_five}}, and a wide five may carry any ranks.',
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
        'The teammate you queue with is a reviewed Overwatch player who applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player, Duo Pro a Master+ player and Duo Apex a Grandmaster or Champion player. A tier describes the person Duoly hires and never your own lobby. First, the group rules come from Blizzard: a narrow Competitive group keeps Bronze through Diamond inside five skill divisions and Master inside three, while any group holding a Grandmaster or Champion player counts as wide. The published source is the Defense Matrix update of 2024, read again in November 2026.',
        'What the rank buys is fight timing. A Master+ teammate tracks the enemy cooldowns and calls the engage instead of walking in while yours are down. Voice runs using Discord, so the regroup lands before the next fight rather than after. Rank also sets the price: Duo Pro costs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Bundles cut the total by {{pct3}} on 3 games and {{pct5}} on 5. For example, you keep your hero, your aim and your account in all 3 games.',
      ],
    },
    {
      heading: 'Can a Gold player group with a Champion teammate?',
      paragraphs: [
        'A Gold player can group with a Champion teammate in Overwatch 2 Competitive. First, Blizzard removed the rank-gap limit for wide groups in the Defense Matrix update of 2024, and a wide duo is allowed, so Overwatch is one of the few games here needing no full lobby for a wide pairing. The cost is progression rather than access: a wide group moves your rank in smaller steps in either direction, and a wider gap shrinks the step further. For example, a Gold player books Duo Apex at {{p_duo3}} per game, or {{p_duo3_x3}} for 3 games with {{pct3}} off.',
        'One shape stays blocked. A wide group of four cannot queue Role Queue at all, so a four short a fifth has to add the fifth or drop to three. A full five may be wide with any rank spread, which is what 5-Stack Role Queue at {{p_five}} for {{seats_five}} seats is for. Quick Play and Arcade carry no rank at all and cost {{p_qp}} per game. Duoly read the Blizzard pages again in November 2026, and Blizzard notes the thresholds move between patches, so check the group label in the client using Discord before the first queue.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} support in Europe books 3 Duo Pro games with a Master teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. The pairing sits outside the narrow window from Blizzard, so the client labels the group wide: still 5v5 Role Queue, matched against other wide groups, with smaller rank changes. The order chat opens straight after payment, and the first message names the region, the rank and the role: Europe, {{rank_duo2}}, main support, looking for a tank who takes space on the first point.',
        'From there the evening runs on a short plan. You agree the hero pair and the ultimate order, add each other by BattleTag, and voice goes on. After each game you pick one adjustment, for example grouping before the first choke instead of trickling in, agreed using Discord. Three games usually fill about 90 minutes at that rank, and 5 games take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Overwatch coaching the better booking?',
      paragraphs: [
        'Overwatch coaching is the better booking when the goal is a repeatable fix rather than company for the next game. A duo teammate answers a quick question between rounds. A coach pauses the replay, names the pattern and leaves you with homework. Role Coaching costs {{p_role}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate games only.',
        'First, name the habit you keep repeating. For example, a support who dies first in every fight gains more from one positioning hour than from Competitive game number 4. A player who wants a relaxed evening gains more from Quick Play and Arcade at {{p_qp}} per game. Play and Learn is one live Competitive game with a Grandmaster+ coach at {{p_learn}}, and screen share runs using Discord. Overwatch 2 has no separate Duoly coaching page yet, so lessons are booked from the prices above.',
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
        'Can a Gold player group with a Champion?',
        'Yes: Blizzard dropped the rank-gap limit for wide groups in 2024, and a wide duo counts. The group gains rank in smaller steps, and a wide four cannot queue.',
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
    text: 'Duo Pro is the Competitive tier with a Master+ teammate from Duoly. Three games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 games take {{pct5}} off. Quick Play stays {{p_qp}} per game at any rank, and Stadium Duo costs {{p_stadium}}. A wide Competitive group carries no rank-gap limit under the 2024 rule from Blizzard, so a Gold player may queue with a Champion and gains rank in smaller steps in 2026. For example, agree your hero pair using Discord, then add each other by BattleTag.',
  },
};
