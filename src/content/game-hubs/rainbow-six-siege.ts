import type { HubPageCopy } from '../hub-pages';

export const rainbowSixSiege: HubPageCopy = {
  gameSlug: 'rainbow-six-siege',
  title: 'Rainbow Six Siege LFG: Find a Ranked Duo | Duoly',
  description:
    'Book a Rainbow Six Siege duo, a 5-stack fill or a coach on Duoly, {{from_lower}}. Compare Ranked, Quick Match and lesson prices.',
  eyebrow: 'Rainbow Six Siege teammates',
  h1: 'Rainbow Six Siege LFG: find a Ranked duo',
  lead: 'Free LFG Discords work for a casual five. Duoly books a reviewed Emerald, Diamond or Champion teammate for your next ranked matches, fills a stack and sells operator and map lessons.',
  cta: 'Book a Siege teammate',
  facts: [
    'Emerald+ to Champion teammates',
    'Ranked, Quick Match and Arcade',
    'Voice on Discord, your own account',
  ],
  related: ['overwatch-2', 'counter-strike-2', 'arc-raiders', 'valorant'],
  format: {
    heading: 'What can you book for Rainbow Six Siege on Duoly?',
    text: 'A Duoly Rainbow Six Siege booking is a paid session where reviewed higher-rank players queue with you on your own account. Duo Plus brings an Emerald+ teammate who drones and anchors, Duo Pro a Diamond+ player who calls the round and Duo Apex a Champion-level player for high lobbies. Ranked prices follow your own rank, so a {{rank_duo2}} player pays {{p_duo2}} per match for Duo Pro in November 2026. For example, Quick Match and Arcade and Deathmatch each cost {{p_quick}} per match at every rank. Bundles cut the total: 3 matches get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. A 5-Stack Fill covers the empty seats, and the matchmaking rules from Ubisoft still decide which ranks queue together. Finally, every booking opens an order chat, where you agree operators, sites and voice using Discord.',
  },
  services: {
    duo1: 'Ranked with an Emerald player who drones, calls and takes anchor or entry as needed.',
    duo2: 'Ranked with a Diamond player who calls the round: drones, rotations and defender reads.',
    duo3: 'Ranked with a Champion-level player who can win rounds alone in high lobbies.',
    quick:
      'Unranked matches to learn maps and operators with someone explaining as you play.',
    arcade:
      'Warm-up modes and arcade playlists between ranked matches, with nothing at stake.',
    gg1v1: 'A custom 1v1 against a verified Gamer Girl, one clutch at a time.',
    ggbuddy:
      'A patient Gamer Girl plays Quick Match or Arcade and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    stack:
      'Bring your friends and we fill your five with Diamond+ players who run real utility.',
    learn:
      'One live Ranked match with a Champion coach explaining every decision out loud.',
    ops: 'One hour on one attacker and one defender: gadgets, setups and exact timings.',
    maps: 'One hour on your weakest map, room by room: callouts, rotations and site setups.',
  },
  intros: {
    teammate:
      'One teammate joins your matches on your own account, from Ranked to Quick Match and Arcade.',
    team: 'A stack fill adds several Diamond+ players at once, priced for the seats you need covered.',
    coaching:
      'Every lesson runs for one hour, except Play and Learn, which covers one live Ranked match.',
  },
  steps: {
    heading: 'How does booking a Siege duo work?',
    items: [
      'First, pick a service and the number of matches. Duo Pro is the Ranked option with a Diamond+ teammate, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five matches get {{pct5}} off.',
      'Second, add your data centre, rank, role and language at checkout. For example, name EU West, {{rank_duo2}} and whether you anchor or entry, so your teammate reads the real request from Duoly first.',
      'Third, meet your teammate in the order chat, agree operators and voice using Discord, then add each other with your Ubisoft name. A single Duo Pro match costs {{p_duo2}} at the same rank in 2026. Ten matches get {{pct10}} off.',
    ],
    note: 'Duoly reviews every Siege teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Rainbow Six Siege session fits you?',
    intro:
      'The right Siege session is the one matching your goal for the evening, so pick the goal first and let the price follow. For example, a {{rank_duo2}} player climbing Ranked pays {{p_duo2}} per match for Duo Pro in 2026, with {{pct3}} off 3 matches and {{pct5}} off 5. Voice runs using Discord in every session booked from Duoly.',
    picks: [
      {
        goal: 'Climbing Ranked this season?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Diamond+ caller from {{p_duo2_low}} per match, priced by your own rank and ready to drone for you.',
      },
      {
        goal: 'Stuck in Diamond lobbies?',
        service: 'duo3',
        answer:
          'Duo Apex brings a Champion-level player who can hold a site alone, {{p_duo3}} per match at {{rank_duo3}}.',
      },
      {
        goal: 'Still learning the maps?',
        service: 'quick',
        answer:
          'Quick Match costs {{p_quick}} per match with someone who explains callouts and setups while you play.',
      },
      {
        goal: 'Short a player or four?',
        service: 'stack',
        answer:
          '5-Stack Fill covers up to {{seats_stack}} seats with Diamond+ players who run real utility.',
      },
      {
        goal: 'One map ruining your rank?',
        service: 'maps',
        answer:
          'Map and Callouts is one hour with a Champion coach, room by room on your weakest map.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'A Duoly Siege teammate is a reviewed player who applied for the game and showed a rank before taking orders. Duo Plus names an Emerald+ player, Duo Pro a Diamond+ player and Duo Apex a Champion-level player. The tier describes the teammate, never your own queue eligibility. Ranked matchmaking from Ubisoft decides which ranks can queue together, so share your data centre and rank in the order chat first. For example, a {{rank_duo2}} player pays {{p_duo2}} per match in 2026.',
        'What the rank buys you is information. First, a Diamond+ teammate drones the site before the push and names the defender instead of guessing. Second, voice runs using Discord, so a rotate call lands while the timer still matters. A {{rank_duo2_high}} player pays {{p_duo2_high}} per match, because higher lobbies need stronger teammates, and bundles take {{pct3}} off 3 matches or {{pct5}} off 5. You keep your operator and your account.',
      ],
    },
    {
      heading: 'How does a 5-Stack Fill work in Siege?',
      paragraphs: [
        'A stack fill is a single order hiring several players at once, so a part-full group becomes a real five. 5-Stack Fill covers up to {{seats_stack}} empty seats with Diamond+ players at {{p_stack}} per match at {{rank_stack}} in 2026. Three matches cost {{p_stack_x3}} with {{pct3}} off, and the matchmaking from Ubisoft still applies. Every seat is priced separately, so a trio short two players sets the seats to two instead of four. The booked players bring utility plans, not only aim, which is what a five-stack actually needs.',
        'Agree the structure before the first lobby. For example, decide who anchors, who roams and who drones on attack. First, pick two maps you all know. Second, agree one caller, because five voices on one site is worse than silence. Finally, keep everybody on one call using Discord so rotations reach the whole team. Bundles still apply, so 3 matches get {{pct3}} off and 5 get {{pct5}} off the total.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro matches on EU West',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player on EU West books 3 Duo Pro matches. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one match. The order chat opens straight after payment, and the first message names the data centre, the rank and the role: EU West, {{rank_duo2}}, anchor on defence, looking for a partner who drones the site properly.',
        'The evening then runs on a short plan. First, both players agree two maps and a site setup for each. Second, voice goes on using Discord and the friend request goes out on Ubisoft Connect. Third, after each match you agree one adjustment, such as droning before the entry instead of during. We found the rank spread by running the price tool from Duoly for every tier, so a {{rank_duo2_low}} player pays {{p_duo2_low}} in 2026. Five matches take {{pct5}} off.',
      ],
    },
    {
      heading: 'When is Siege coaching the better booking?',
      paragraphs: [
        'Siege coaching is the better booking when the goal is a repeatable fix rather than company for the next match. A duo teammate answers a quick question between rounds. A coach stops the clip, names the pattern and leaves you with homework. Operator Lab and Map and Callouts each cost {{p_ops}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'For example, a player who loses the same site every match gains more from one map hour than from another ranked queue. Finally, a player who only wants to warm up gains more from Arcade and Deathmatch at {{p_arcade}} per match. Play and Learn is one live Ranked match with a Champion coach at {{p_learn}}. Rainbow Six Siege has no separate Duoly coaching page yet, so lessons are booked from the prices above, using Discord screen share.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Rainbow Six Siege sessions?',
    items: [
      [
        'Is Duoly a free Rainbow Six Siege teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and the in-game friend list from Ubisoft stay the free routes to a regular five.',
      ],
      [
        'How much does a Siege duo cost?',
        'Duo Pro is {{p_duo2}} per match at {{rank_duo2}} in 2026. First, bundles take {{pct3}} off 3 matches, and 10 matches cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Can I ask for a specific role?',
        'Yes. Name anchor, roam or entry in the order chat, using Discord for voice, and your teammate plans the operator pool and the site setup around the request.',
      ],
      [
        'Can every rank queue together?',
        'No. The ranked matchmaking rules from Ubisoft apply, so both accounts need a compatible rank and the same data centre before the first queue.',
      ],
      [
        'Can a stack fill cover fewer seats?',
        'Yes. Set the seats to the gaps you actually have, using Discord to agree roles first. 5-Stack Fill opens at {{seats_stack}} seats and goes down to one.',
      ],
      [
        'Do you need my account?',
        'No. You play on your own account and add each other on Ubisoft Connect. Never send login details to anyone, including a teammate or a coach.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Rainbow Six Siege?',
    text: 'Duo Pro is the Ranked session with a Diamond+ caller from Duoly. For example, 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five matches get {{pct5}} off. Finally, agree your site setup using Discord and add each other on Ubisoft Connect.',
  },
};
