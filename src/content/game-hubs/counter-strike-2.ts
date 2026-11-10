import type { HubPageCopy } from '../hub-pages';

export const counterStrike2: HubPageCopy = {
  gameSlug: 'counter-strike-2',
  title: 'CS2 Coaching and LFG: Premier and FACEIT Duos | Duoly',
  description:
    'Book Counter-Strike 2 coaching, a Premier duo or a FACEIT stack on Duoly, {{from_lower}}. Compare Premier, Wingman and retake prices.',
  eyebrow: 'Counter-Strike 2 teammates',
  h1: 'CS2 coaching and LFG: find a Premier or FACEIT duo',
  lead: 'Free LFG servers and Discord channels are fine for a casual five. Duoly books a reviewed Premier or FACEIT teammate for your next matches, fills a stack and sells demo review when you want to learn.',
  cta: 'Book a CS2 teammate',
  facts: [
    'Premier 15,000+ to FACEIT Level 10',
    'Premier, Wingman and FACEIT queues',
    'Voice on Discord, your own account',
  ],
  related: [
    'valorant',
    'call-of-duty',
    'pubg',
    'rainbow-six-siege',
    'overwatch-2',
  ],
  intent:
    'After the team finder page rather than every CS2 service? It compares Premier, FACEIT, Wingman and retake servers, with a map pool checklist.',
  format: {
    heading: 'What can you book for Counter-Strike 2 on Duoly?',
    text: 'A Counter-Strike 2 booking on Duoly is one of three things: a teammate who queues with you, a stack fill for the seats you are missing, or coaching by the hour. Duo Plus brings a Premier 15,000+ teammate, Duo Pro a Premier 20,000+ caller and FACEIT Duo a Level 10 player for the third-party ladder. Premier prices follow your own rating, from {{p_duo2_low}} to {{p_duo2_high}} per match on Duo Pro. Casual and Deathmatch and Retake Servers stay {{p_casual}} per match at every rating. Bundles of {{main}} cut the total, {{bundles}}. The fills: Premier 5-Stack hires Premier 20,000+ players for {{seats_five}} seats from {{p_five_low}} per match, and FACEIT Stack covers the FACEIT ladder at {{p_faceit5}}. Lessons start from {{p_demo}} per hour. For example, share your region and rating in the order chat using Discord first.',
  },
  services: {
    duo1: 'Premier or Competitive with a 15,000+ teammate who trades you and throws the right utility.',
    duo2: 'Premier with a 20,000+ caller who explains buys, rotations and timings between halves.',
    duo3: 'FACEIT queues with a Level 10 player for sharper calls and better lobbies.',
    wing: 'The real 2v2 on small maps, where every round depends on the two of you.',
    casual:
      'Deathmatch and casual servers to warm up your aim with no rating at stake.',
    retake:
      'Community retake servers together: the fastest practice for site executes and clutches.',
    gg1v1:
      'An aim-map duel against a verified Gamer Girl, best of as many rounds as you like.',
    ggbuddy:
      'A patient Gamer Girl plays casual, Wingman or Deathmatch and explains the basics.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    five: 'Premier as a full five: 20,000+ players who hold positions and call their smokes.',
    faceit5:
      'A FACEIT stack of Level 8+ players who communicate and play for the round win.',
    learn:
      'One live Premier match with a FACEIT Level 10 coach explaining every decision.',
    demo: 'One hour on your demo: positioning, crosshair placement and mid-round decisions.',
    util: 'One hour of smokes, flashes and molotovs for your map pool, with reusable lineups.',
  },
  intros: {
    teammate:
      'Teammate prices are per match, and the ranked services follow your own rating: Duo Pro costs {{p_duo2_low}} per match in the lowest Premier band and {{p_duo2_high}} at {{rank_duo2_high}}. Casual and Deathmatch, Retake Servers and the Gamer Girl sessions hold one price for everybody. Pick the ladder, because a Premier duo reads your CS Rating while FACEIT Duo reads your FACEIT level. Read the teammate tier beside the price: Duo Plus names a Premier 15,000+ player, Duo Pro a 20,000+ caller and FACEIT Duo a Level 10 player from {{p_duo3_low}} per match. Only {{main}} is sold in bundles, {{bundles}}, and every other service books {{picker}}. For example, agree the map pool in the order chat using Discord before match 1.',
    team: 'A CS2 stack fill is one order that hires several players at once, so a part-full party becomes a full five. Premier 5-Stack queues the Valve ladder from {{p_five_low}} for {{seats_five}} seats, and FACEIT Stack queues FACEIT at {{p_faceit5}} with Level 8 and above on every seat. Pick the ladder, because the two have separate ratings and separate maps in the active pool. Count the seats you actually need, because every seat is priced on its own. Bundles of {{main}} still take {{bundles}}. For example, a trio short two players books 2 seats rather than 4, agreed using Discord.',
    coaching:
      'Lessons are priced by the hour and get no quantity or bundle discount at all, so the {{pct3}} to {{pct10}} bundle savings on teammate matches stop here. Demo Review and Utility and Lineups each cost {{p_demo}} per hour. Play and Learn is the exception that covers one live Premier match at {{p_learn}} rather than a clock hour. Pick the problem rather than the format. For example, a player who dies first on every execute onto the A site books Demo Review instead of a fourth Premier match. Screen share runs using Discord, the coach never logs into your account, and no lesson from Duoly promises a rating.',
  },
  steps: {
    heading: 'How does booking a CS2 duo work?',
    items: [
      'Pick a service and the number of matches first. Duo Pro is the Premier tier with a 20,000+ teammate, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five matches take {{pct5}} off.',
      'Add your region, rating, map pool and language at checkout. For example, name EU West, your Premier rating and the 2 maps you want to play, so your teammate reads the real request before accepting.',
      'Meet your teammate in the order chat using Discord. Agree roles and check the party accepts both ratings, then add each other from Steam. One Duo Pro match costs {{p_duo2}} at {{rank_duo2}}.',
    ],
    note: 'Duoly reviews every CS2 teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which CS2 session fits you?',
    intro:
      'The right CS2 session is the one matching your goal tonight. The warm-up servers hold one price at every rating: Casual and Deathmatch and Retake Servers are each {{p_casual}} per match. Premier is priced by your own rating, from {{p_duo2_low}} per match on Duo Pro, and a stack fill is priced per seat instead. A {{main}} bundle takes {{bundles}}, so a bundle beats booking 1 at a time. Voice runs using Discord.',
    picks: [
      {
        goal: 'Grinding Premier rating?',
        service: 'duo2',
        answer:
          'Duo Pro adds a 20,000+ caller from {{p_duo2_low}} per match, priced by your own rating.',
      },
      {
        goal: 'Playing FACEIT instead of Premier?',
        service: 'duo3',
        answer:
          'FACEIT Duo queues with a Level 10 player, {{p_duo3}} per match at {{rank_duo3}}.',
      },
      {
        goal: 'Only have 30 minutes?',
        service: 'wing',
        answer:
          'Wingman Duo is the real 2v2 on small maps, {{p_wing}} per match at {{rank_wing}}.',
      },
      {
        goal: 'Prefer the FACEIT ladder?',
        service: 'faceit5',
        answer:
          'FACEIT Stack fills {{seats_faceit5}} seats with Level 8 and above players, from {{p_faceit5_low}} per match.',
      },
      {
        goal: 'Keep losing the same mid-round?',
        service: 'demo',
        answer:
          'Demo Review is one hour with a FACEIT Level 10 coach for {{p_demo}}, ending with clear fixes.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'The teammate you queue with is a reviewed CS2 player who applied for the game and showed a rating before taking orders. Duo Plus names a Premier 15,000+ player, Duo Pro a Premier 20,000+ player and FACEIT Duo a Level 10 player from {{p_duo3_low}} per match. Note that FACEIT runs a separate Level 1 to 10 ladder, so a Level 10 teammate and a Premier rating are two different systems. Orders are not auto-assigned: a teammate picks yours up from the queue, so the person who accepts chose your request.',
        'What the rating buys is a round that makes sense. A 20,000+ teammate trades your peek instead of watching it, calls the buy and names the rotation. Voice runs using Discord, so the call lands before the execute rather than after. Rating also sets the price: Duo Pro costs {{p_duo2_low}} per match in the lowest band and {{p_duo2_high}} at {{rank_duo2_high}}. Bundles of {{main}} cut that total: {{bundles}}. For example, you keep your Steam account and your own decisions in all 3 matches.',
      ],
    },
    {
      heading: 'What does a CS2 stack fill include?',
      paragraphs: [
        'A CS2 stack fill is one order that hires several players at once, so a part-full party becomes a full five. Premier 5-Stack queues the Valve ladder from {{p_five_low}} per match for {{seats_five}} seats, with Premier 20,000+ players on each one. FACEIT Stack queues FACEIT instead from {{p_faceit5_low}}, with Level 8 and above on every seat. For example, a trio short two players books 2 seats rather than 4, because each seat is priced on its own.',
        'Both fills start the same way. Pick the service, pick the seat count, pay once, then meet the roster in the order chat. Name your region, the maps you actually practise and the roles you already cover, so nobody turns up expecting to entry when you already do. Voice runs using Discord, friend requests go out on Steam, and nobody needs your login. Bundles of {{main}} still take {{bundles}}, read from Duoly checkout in 2026.',
      ],
    },
    {
      heading: 'Example evening: three Duo Plus matches on EU West',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo1}} player on EU West books 3 Duo Plus matches with a Premier 15,000+ teammate. The total is {{p_duo1_x3}}, three times {{p_duo1}} for one match, because the discount starts at 5 matches. The order chat opens straight after payment, and the first message names the region, the rating and the map pool: Mirage and Anubis, entry on the A side, looking for someone who throws the pop flash.',
        'From there the evening runs on a short plan. You agree roles and a default on each map, voice goes on, and the friend request goes out on Steam. After each match you pick one adjustment, for example saving two rounds earlier instead of forcing a half buy, agreed using Discord. Duo Pro with a 20,000+ caller costs {{p_duo2}} per match at {{rank_duo2}} for the step up, and 5 matches take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is CS2 coaching the better booking?',
      paragraphs: [
        'CS2 coaching is the better booking when the goal is a repeatable fix rather than company for the next match. A duo teammate answers a quick question between halves. A coach stops the demo, names the pattern and leaves you with homework. Demo Review and Utility and Lineups each cost {{p_demo}} per hour, and coaching carries no quantity or bundle discount, so the {{pct3}} to {{pct10}} bundle savings apply to teammate matches only.',
        'For example, a player who dies first on the A site execute gains more from one demo review than from a fourth Premier match. A player who only wants to warm up gains more from Casual and Deathmatch at {{p_casual}} per match. Screen share runs using Discord, and Play and Learn covers one live Premier match with a Level 10 coach at {{p_learn}}. The full service list, preparation tips and lesson formats live on the [Counter-Strike 2 coaching page](/games/counter-strike-2/coaching). [Valorant teammates](/games/valorant) and [Rainbow Six Siege teammates](/games/rainbow-six-siege) are the other two tactical shooters Duoly sells.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about CS2 sessions?',
    items: [
      [
        'Is Duoly a free CS2 teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the community servers listed by Valve are the free routes, so try those first.',
      ],
      [
        'How much does a CS2 duo cost?',
        'Duo Pro is {{p_duo2}} per match at {{rank_duo2}}, and {{p_duo2_low}} in the lowest band. Casual and Deathmatch and Retake Servers each cost {{p_casual}}.',
      ],
      [
        'How do I book a full CS2 five?',
        'Premier 5-Stack hires Premier 20,000+ players for {{seats_five}} seats from {{p_five_low}} per match, and FACEIT Stack covers the FACEIT ladder at {{p_faceit5}} with Level 8 and above.',
      ],
      [
        'Can we play FACEIT instead of Premier?',
        'Yes: FACEIT Duo is the Level 10 service on the FACEIT ladder, and the rank picker uses FACEIT Levels instead of a Premier rating.',
      ],
      [
        'Do I need to share my Steam account?',
        'No: you play on your own account and add each other as friends on Steam, for example before the first warm-up. Never send login details to anyone, and keep voice using Discord.',
      ],
      [
        'Do bundles make several matches cheaper?',
        'Yes, on {{main}}: {{bundles}}, so 3 Duo Pro matches cost {{p_duo2_x3}} at {{rank_duo2}} in 2026.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Counter-Strike 2?',
    text: 'Duo Pro is the Premier tier with a 20,000+ teammate from Duoly. Three matches at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 matches take {{pct5}} off. Retake Servers stay {{p_casual}} per match at any rating, and Casual and Deathmatch costs the same. Premier 5-Stack hires {{seats_five}} Premier 20,000+ players from {{p_five_low}} per match, and FACEIT Stack covers the FACEIT ladder at {{p_faceit5}} in 2026. For example, pick your rating and maps, then agree roles in the order chat using Discord.',
  },
};
