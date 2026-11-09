import type { HubPageCopy } from '../hub-pages';

export const rainbowSixSiege: HubPageCopy = {
  gameSlug: 'rainbow-six-siege',
  title: 'Rainbow Six Siege Coaching, Duos and Stacks | Duoly',
  description:
    'Book Rainbow Six Siege coaching, a duo or a 5-stack fill on Duoly, {{from_lower}}. Compare Ranked, Quick Match and lesson prices.',
  eyebrow: 'Rainbow Six Siege teammates',
  h1: 'Book Rainbow Six Siege coaching, a duo or a stack',
  lead: 'Free LFG Discords work for a casual five. Duoly books a reviewed Emerald, Diamond or Champion-level teammate for Ranked, fills a five and sells operator and map lessons by the hour.',
  cta: 'Book a Siege teammate',
  facts: [
    'Emerald+ to Champion teammates',
    'Ranked, Quick Match and Arcade',
    'Voice on Discord, your own account',
  ],
  related: [
    'counter-strike-2',
    'valorant',
    'call-of-duty',
    'overwatch-2',
    'marvel-rivals',
  ],
  intent:
    'Only after teammates for tonight, free or paid? The dedicated page sets the free Discords next to the paid Ranked sessions, rank by rank.',
  format: {
    heading: 'What can you book for Rainbow Six Siege on Duoly?',
    text: 'A Rainbow Six Siege booking on Duoly is a single reviewed teammate, a 5-stack fill or a coaching hour. First, the Ranked tiers are Duo Plus with an Emerald+ teammate, Duo Pro with a Diamond+ caller and Duo Apex with a Champion-level player. Ranked prices follow your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per match on Duo Pro. Quick Match and Arcade holds one flat price of {{p_quick}} at every rank, and Duo Apex costs {{p_duo3}}. Bundles cut the total, {{pct3}} off 3 matches up to {{pct10}} off 10. Second, the fill: 5-Stack Fill hires Diamond+ players for up to {{seats_stack}} seats at {{p_stack}} per match, which turns a part-full party into a real five. Third, the lessons, from {{p_ops}} per hour in the Operator Lab. For example, name your data centre and rank using Discord first.',
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
      'Teammate prices are per match, and the Ranked services read your own rank: Duo Pro costs {{p_duo2_low}} per match at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Quick Match and Arcade hold one price for everybody, because neither has a ladder to climb. First, pick the mode, because the mode decides whether the rank list on a card matters. Second, read the teammate tier beside the price: Duo Plus names an Emerald+ player, Duo Pro a Diamond+ caller and Duo Apex a Champion-level player at {{p_duo3}} per match. Bundles take {{pct3}} off 3 matches and {{pct5}} off 5. For example, agree the site setup using Discord before match 1.',
    team: 'A stack fill is one order that hires several players at once, so a part-full party becomes a real five. 5-Stack Fill covers up to {{seats_stack}} seats at {{p_stack}} per match at {{rank_stack}}, from {{p_stack_low}} at {{rank_stack_low}}. First, count the seats you actually need, because every seat is priced on its own. Second, name the jobs, because a five wants a hard breach, a drone, an anchor and a roamer covered rather than five fraggers. Bundles take {{pct3}} off 3 matches and {{pct5}} off 5. For example, a trio short 2 players books 2 seats rather than 4, agreed using Discord.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount at all, so the {{pct3}} and {{pct5}} savings on teammate matches stop here. Operator Lab and Map and Callouts each cost {{p_ops}} per hour, one on a gadget pair and one on your weakest map. Play and Learn is the live option covering one real Ranked match at {{p_learn}}. First, pick the problem rather than the format. For example, a player who loses the same site every match books the map hour instead of a fourth Ranked queue. Screen share runs using Discord, and no lesson from Duoly promises a rank, which the Player Protection rules from Ubisoft prohibit outright.',
  },
  steps: {
    heading: 'How does booking a Siege duo work?',
    items: [
      'Pick a service and the number of matches first. Duo Pro is the Ranked tier with a Diamond+ teammate, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five matches take {{pct5}} off.',
      'Second, add your data centre, rank, role and language at checkout. For example, name EU West, {{rank_duo2}} and whether you anchor or entry, so your teammate reads the real request first.',
      'Finally, meet your teammate in the order chat using Discord. Agree operators and the first site, then add each other with your Ubisoft name. One Duo Pro match costs {{p_duo2}}.',
    ],
    note: 'Duoly reviews every Siege teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Rainbow Six Siege session fits you?',
    intro:
      'The right Siege session is the one matching your goal for the evening. First, Quick Match and Arcade hold one price at every rank, {{p_quick}} and {{p_arcade}} per match. Ranked is priced by your own rank, from {{p_duo2_low}} per match on Duo Pro, and a stack fill is priced per seat instead. For example, 3 matches take {{pct3}} off and 5 matches take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing Ranked this season?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Diamond+ caller from {{p_duo2_low}} per match, priced by your own rank.',
      },
      {
        goal: 'Already in Diamond lobbies?',
        service: 'duo3',
        answer:
          'Duo Apex brings a Champion-level player who can hold a site alone, {{p_duo3}} at {{rank_duo3}}.',
      },
      {
        goal: 'Still learning the maps?',
        service: 'quick',
        answer:
          'Quick Match costs {{p_quick}} per match with someone explaining callouts and setups.',
      },
      {
        goal: 'Short a player or four?',
        service: 'stack',
        answer:
          '5-Stack Fill covers up to {{seats_stack}} seats for {{p_stack}}, inside the same rank limits.',
      },
      {
        goal: 'One map ruining your rank?',
        service: 'maps',
        answer:
          'Map and Callouts is one hour with a Champion coach for {{p_maps}}, room by room.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'The teammate you queue with is a reviewed Siege player who applied for the game and showed a rank before taking orders. Duo Plus names an Emerald+ player, Duo Pro a Diamond+ player and Duo Apex a Champion-level player at {{p_duo3}} per match, which is the top tier Duoly sells for the game. Orders are not auto-assigned: a teammate picks yours up from the queue, so the person who accepts chose your request. Nobody from Duoly ever logs into your account.',
        'What the rank buys is information. A Diamond+ teammate drones the site before the push and names the defender instead of guessing, so the callout lands while the timer still matters. Voice runs using Discord for exactly that reason. Rank also sets the price: Duo Pro costs {{p_duo2_low}} per match at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Bundles cut the total by {{pct3}} on 3 matches and {{pct5}} on 5. For example, you keep your operator and your account in all 3 matches.',
      ],
    },
    {
      heading: 'What does a Siege 5-stack fill include?',
      paragraphs: [
        '5-Stack Fill is one order that hires several Diamond+ players at once, so a part-full party becomes a real five at {{p_stack}} per match for up to {{seats_stack}} seats. First, count the seats, because every seat is priced on its own, so a trio short 2 players books 2 rather than 4. Second, name the jobs you already cover, since a five needs a hard breach, a live drone, an anchor and a roamer. For example, a pair with no hard breach books 3 seats and asks for a Thermite main.',
        'The fill starts like any other order. Pick the service, pick the seat count, pay once, then meet the squad in the order chat. Name your platform, your data centre and the maps you practise, so the roster arrives ready for the right setup. Voice runs using Discord, invites go out with your Ubisoft name, and nobody needs your login. The Player Protection rules from Ubisoft prohibit paying to inflate a rank, so every session here is shared playing time rather than a result.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro matches on EU West',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player on EU West books 3 Duo Pro matches with a Diamond teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one match. The order chat opens straight after payment, and the first message names the data centre, the rank and the role: EU West, {{rank_duo2}}, anchor on defence, looking for a partner who drones the site properly.',
        'From there the evening runs on a short plan. You agree two maps and a site setup for each, voice goes on, and the friend request goes out on Ubisoft Connect. After each match you pick one adjustment, for example droning before the entry instead of during it, agreed using Discord. Three matches usually fill about 90 minutes at that rank, and 5 matches take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Siege coaching the better booking?',
      paragraphs: [
        'Siege coaching is the better booking when the goal is a repeatable fix rather than company for the next match. A duo teammate answers a quick question between rounds. A coach stops the clip, names the pattern and leaves you with homework. Operator Lab and Map and Callouts each cost {{p_ops}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate matches only.',
        'First, name the round you keep losing. For example, a player who drops the same site every match gains more from one map hour at {{p_maps}} than from a fourth Ranked queue. A player who only wants to warm up gains more from Arcade and Deathmatch at {{p_arcade}} per match in 2026. Play and Learn is one live Ranked match with a Champion coach at {{p_learn}}, and screen share runs using Discord. The full service list, preparation tips and lesson formats live on the [Rainbow Six Siege coaching page](/games/rainbow-six-siege/coaching). The [Rainbow Six Siege LFG page](/games/rainbow-six-siege/lfg) sets the free routes beside the paid ones, and [Counter-Strike 2 teammates](/games/counter-strike-2) is the other tactical shooter here.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Rainbow Six Siege sessions?',
    items: [
      [
        'Is Duoly a free Rainbow Six Siege teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from Ubisoft are the free routes, so try those first.',
      ],
      [
        'How much does a Siege duo cost?',
        'Duo Pro is {{p_duo2}} per match at {{rank_duo2}}, and {{p_duo2_low}} at the lowest rank. Ten matches cost {{p_duo2_x10}} with {{pct10}} off in 2026.',
      ],
      [
        'How do I book a full Rainbow Six Siege five?',
        '5-Stack Fill hires Diamond+ players for up to {{seats_stack}} seats at {{p_stack}} per match, and you set the seat count to the gaps your party actually has.',
      ],
      [
        'Can I ask for a specific role?',
        'Yes: name anchor, roam or entry in the order chat, with voice using Discord, and your teammate plans the operator pool and the site setup around the request.',
      ],
      [
        'Can a stack fill cover fewer seats?',
        'Yes: set the seats to the gaps you actually have, for example 2 of 4, and agree roles using Discord first. 5-Stack Fill opens at {{seats_stack}} seats.',
      ],
      [
        'Do you need my account?',
        'No: you play on your own account and add each other on Ubisoft Connect. Never send login details to anyone, including a teammate or a coach.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Rainbow Six Siege?',
    text: 'Duo Pro is the Ranked tier with a Diamond+ caller from Duoly. Three matches at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 matches take {{pct5}} off. Quick Match stays {{p_quick}} per match at any rank, and Arcade costs {{p_arcade}}. 5-Stack Fill hires Diamond+ players for up to {{seats_stack}} seats at {{p_stack}} per match when you want a real five in 2026. For example, agree your site setup using Discord, then add each other on Ubisoft Connect.',
  },
};
