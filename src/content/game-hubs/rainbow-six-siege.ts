import type { HubPageCopy } from '../hub-pages';

export const rainbowSixSiege: HubPageCopy = {
  gameSlug: 'rainbow-six-siege',
  title: 'Rainbow Six Siege Duos, Stacks and Coaching | Duoly',
  description:
    'Book a Rainbow Six Siege duo, a 5-stack fill or a coach on Duoly, {{from_lower}}. Compare Ranked, Quick Match and lesson prices.',
  eyebrow: 'Rainbow Six Siege teammates',
  h1: 'Book a Rainbow Six Siege duo, a stack or a coach',
  lead: 'Free LFG Discords work for a casual five. Duoly books a reviewed Emerald, Diamond or Champion teammate for your next ranked matches, fills a stack and sells operator and map lessons.',
  cta: 'Book a Siege teammate',
  facts: [
    'Emerald+ to Champion teammates',
    'Ranked, Quick Match and Arcade',
    'Voice on Discord, your own account',
  ],
  related: ['overwatch-2', 'counter-strike-2', 'arc-raiders', 'valorant'],
  intent:
    'Only after teammates for tonight, free or paid? The dedicated page sets the free Discords next to the paid Ranked sessions, rank by rank.',
  format: {
    heading: 'What can you book for Rainbow Six Siege on Duoly?',
    text: 'Duoly sells three things for Rainbow Six Siege: one teammate who queues with you on your own account, a 5-stack fill for the seats you are missing, and coaching by the hour. Duo Plus brings an Emerald+ teammate who drones and anchors, Duo Pro a Diamond+ player who calls the round and Duo Apex a Champion-level player for high lobbies. Ranked follows your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per match on Duo Pro, while Quick Match and Arcade stay {{p_quick}} per match at every rank. Bundles cut the total, {{pct3}} off 3 matches up to {{pct10}} off 10. Ranked 3.0 from Ubisoft caps the squad gap at three full ranks, or two once Diamond or Champion is involved, so share your data centre and rank in the order chat first.',
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
      'Teammate prices are per match, and the Ranked services read your own rank, so a Champion lobby costs more than a Copper one. Quick Match and Arcade hold one price for everybody, because neither has a ladder to climb. One teammate joins your matches on your own account, and bundles are the only other discount, {{pct3}} off 3 matches and {{pct5}} off 5.',
    team: 'The stack fill is priced per seat, so the card covers the default {{seats_stack}} seats and falls when your party already has bodies. It reads your own rank like the Ranked duos do, because the squad restrictions in Ranked 3.0 apply to a five exactly as they apply to a pair. Bundles take {{pct3}} off 3 matches and {{pct5}} off 5.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate sessions do not reach them. Operator Mastery works through one attacker and one defender, Map and Site Setup covers two maps in detail, and Play and Learn is the exception that covers one live Ranked match. Screen share runs on Discord.',
  },
  steps: {
    heading: 'How does booking a Siege duo work?',
    items: [
      'Pick a service and the number of matches. Duo Pro is the Ranked tier with a Diamond+ teammate, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five matches take {{pct5}} off.',
      'Add your data centre, rank, role and language at checkout. Name EU West, {{rank_duo2}} and whether you anchor or entry, so your teammate reads the real request first.',
      'Meet your teammate in the order chat, agree operators and check the squad rank gap, then add each other with your Ubisoft name. A single Duo Pro match costs {{p_duo2}} at the same rank.',
    ],
    note: 'Duoly reviews every Siege teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Rainbow Six Siege session fits you?',
    intro:
      'The right Siege session is the one matching your goal for the evening, so pick the goal first and let the price follow. Ranked is priced by your own rank, from {{p_duo2_low}} per match on Duo Pro, with {{pct3}} off 3 matches and {{pct5}} off 5. Unranked playlists carry no rank gate at all.',
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
        'Every Duoly Siege teammate applied for the game and showed a rank before taking orders. Duo Plus names an Emerald+ player, Duo Pro a Diamond+ player and Duo Apex a Champion-level player. The tier describes the teammate you are hiring and nothing about your own queue eligibility, because Ranked 3.0 from Ubisoft sets the squad restrictions: Copper to Emerald players queue inside three full ranks, while Diamond and Champion players are held to two. A {{rank_duo2}} account therefore pairs with a Diamond teammate and needs to climb before Champion becomes an option, so check both ranks in the order chat.',
        'What the rank actually buys you is information. A Diamond+ teammate drones the site before the push and names the defender instead of guessing, and the callout arrives while the timer still matters. Voice runs on Discord for exactly that reason. Rank also sets the price: Duo Pro runs {{p_duo2_low}} per match at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. You keep your operator and your account.',
      ],
    },
    {
      heading: 'How does a 5-Stack Fill work in Siege?',
      paragraphs: [
        'A stack fill is one order that hires several players at once, so a part-full group becomes a real five. 5-Stack Fill covers up to {{seats_stack}} empty seats with Diamond+ players at {{p_stack}} per match at {{rank_stack}}, and 5 matches cost {{p_stack_x5}} with {{pick5}} off. Every seat is priced separately, so a trio short two players sets the seats to two instead of four. The booked players bring utility plans rather than only aim, which is what a five-stack actually needs.',
        'Agree the structure before the first lobby: who anchors, who roams and who drones on attack. Pick two maps you all know, then agree one caller, because five voices on one site is worse than silence. Keep everybody on one call so rotations reach the whole team. Note that squad restrictions apply to the stack as well, so a five with a Champion in it has to sit inside two full ranks. Bundles still apply, {{pct3}} off 3 matches and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro matches on EU West',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player on EU West books 3 Duo Pro matches with a Diamond teammate, which is the two-rank gap Ranked 3.0 allows once Diamond is in the squad. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one match. The order chat opens straight after payment, and the first message names the data centre, the rank and the role: EU West, {{rank_duo2}}, anchor on defence, looking for a partner who drones the site properly.',
        'From there the evening runs on a short plan. You agree two maps and a site setup for each, voice goes on, and the friend request goes out on Ubisoft Connect. After each match you pick one adjustment, such as droning before the entry instead of during it. Five matches take {{pct5}} off the total, and placement matches are the one case with no squad restriction at all.',
      ],
    },
    {
      heading: 'When is Siege coaching the better booking?',
      paragraphs: [
        'Siege coaching is the better booking when the goal is a repeatable fix rather than company for the next match. A duo teammate answers a quick question between rounds; a coach stops the clip, names the pattern and leaves you with homework. Operator Lab and Map and Callouts each cost {{p_ops}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'A player who loses the same site every match gains more from one map hour than from another ranked queue. A player who only wants to warm up gains more from Arcade and Deathmatch at {{p_arcade}} per match. Play and Learn is one live Ranked match with a Champion coach at {{p_learn}}. Rainbow Six Siege has no separate Duoly coaching page yet, so lessons are booked from the prices above, with screen share on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Rainbow Six Siege sessions?',
    items: [
      [
        'Is Duoly a free Rainbow Six Siege teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from Ubisoft stay the free routes to a regular five.',
      ],
      [
        'How much does a Siege duo cost?',
        'Duo Pro is {{p_duo2}} per match at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rank. Bundles take {{pct3}} off 3 matches, and 10 matches cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Can I ask for a specific role?',
        'Yes. Name anchor, roam or entry in the order chat, with voice on Discord, and your teammate plans the operator pool and the site setup around the request.',
      ],
      [
        'Can every rank queue Ranked together?',
        'No. Ranked 3.0 from Ubisoft keeps Copper to Emerald squads inside three full ranks and Diamond or Champion squads inside two. Placement matches are the exception and have no restriction.',
      ],
      [
        'Can a stack fill cover fewer seats?',
        'Yes. Set the seats to the gaps you actually have, and agree roles on Discord first. 5-Stack Fill opens at {{seats_stack}} seats and goes down to one.',
      ],
      [
        'Do you need my account?',
        'No. You play on your own account and add each other on Ubisoft Connect. Never send login details to anyone, including a teammate or a coach.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Rainbow Six Siege?',
    text: 'Duo Pro is the Ranked tier with a Diamond+ caller from Duoly, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Quick Match stays {{p_quick}} per match at any rank. Agree your site setup on Discord, then add each other on Ubisoft Connect.',
  },
};
