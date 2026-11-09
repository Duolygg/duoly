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
  related: ['call-of-duty', 'rainbow-six-siege', 'fortnite', 'valorant'],
  format: {
    heading: 'What can you book for Counter-Strike 2 on Duoly?',
    text: 'A Counter-Strike 2 booking on Duoly is one of three things: a teammate who queues with you, a stack fill for the seats you are missing, or coaching by the hour. First, Duo Plus brings a Premier 15,000+ teammate, Duo Pro a Premier 20,000+ caller and FACEIT Duo a Level 10 player for the third-party ladder. Premier prices follow your own rating, from {{p_duo2_low}} to {{p_duo2_high}} per match on Duo Pro. Casual and Deathmatch and Retake Servers stay {{p_casual}} per match at every rating. Bundles cut the total, {{pct3}} off 3 matches up to {{pct10}} off 10. Valve publishes no party rating gap for Premier, so the teammate has to be eligible to queue with you under the rules of the game. For example, share your region and rating in the order chat using Discord first.',
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
      'Teammate prices are per match, and the ranked services follow your own rating: Duo Pro costs {{p_duo2_low}} per match in the lowest Premier band and {{p_duo2_high}} at {{rank_duo2_high}}. Casual Match and Retake Practice hold one price for everybody. First, pick the ladder, because a Premier duo reads your CS Rating while FACEIT Duo reads your FACEIT level. Second, read the queue rule beside the tier. Valve publishes no Premier party gap, so the teammate has to be eligible to queue with you under the rules of the game. Bundles take {{pct3}} off 3 matches and {{pct5}} off 5. For example, agree the map pool in the order chat using Discord before match 1.',
    team: 'A CS2 stack fill is one order that hires several players at once, so a part-full party becomes a full five. Premier 5-Stack queues the Valve ladder at {{p_five}} for {{seats_five}} seats, and FACEIT Stack queues FACEIT at {{p_faceit5}}. FACEIT is the documented wide-gap route: a FACEIT Standard team has no party Elo restriction at all, on a support FAQ from FACEIT read in November 2026. Super and Premium matches are stricter, capping a party at 3 and 2 players inside 400 Elo. First, count the seats you actually need, because every seat is priced on its own. Bundles still take {{pct3}} off 3 matches and {{pct5}} off 5. For example, a trio short two players books 2 seats rather than 4, agreed using Discord.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount at all, so the {{pct3}} and {{pct5}} savings on teammate matches stop here. Demo Review and Utility and Lineups each cost {{p_demo}} per hour. Play and Learn is the exception that covers one live Premier match at {{p_learn}} rather than a clock hour. First, pick the problem rather than the format. For example, a player who dies first on every execute onto the A site books Demo Review instead of a fourth Premier match. Screen share runs using Discord, the coach never logs into your account, and no lesson from Duoly promises a rating.',
  },
  steps: {
    heading: 'How does booking a CS2 duo work?',
    items: [
      'Pick a service and the number of matches first. Duo Pro is the Premier tier with a 20,000+ teammate, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five matches take {{pct5}} off.',
      'Second, add your region, rating, map pool and language at checkout. For example, name EU West, your Premier rating and the 2 maps you want to play, so your teammate reads the real request before accepting.',
      'Finally, meet your teammate in the order chat using Discord. Agree roles and check the party accepts both ratings, then add each other from Steam. One Duo Pro match costs {{p_duo2}}.',
    ],
    note: 'Duoly reviews every CS2 teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which CS2 session fits you?',
    intro:
      'The right CS2 session is the one matching your goal tonight. First, warm-up servers carry no rating gate at all. Premier is priced by your own rating, from {{p_duo2_low}} per match on Duo Pro. For example, 3 matches take {{pct3}} off and 5 matches take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
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
        goal: 'Want the widest rating gap allowed?',
        service: 'faceit5',
        answer:
          'A FACEIT Standard five has no party Elo limit, {{p_faceit5}} for {{seats_faceit5}} seats.',
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
        'The teammate you queue with is a reviewed CS2 player who applied for the game and showed a rating before taking orders. Duo Plus names a Premier 15,000+ player, Duo Pro a Premier 20,000+ player and FACEIT Duo a Level 10 player. A tier describes the person Duoly hires and nothing about your own queue eligibility. First, note that FACEIT runs a separate Level 1 to 10 ladder, so a Level 10 teammate and a Premier rating are two systems with two sets of party rules. A CS Rating also appears only once your Premier placement matches are done.',
        'What the rating buys is a round that makes sense. A 20,000+ teammate trades your peek instead of watching it, calls the buy and names the rotation. Voice runs using Discord, so the call lands before the execute rather than after. Rating also sets the price: Duo Pro costs {{p_duo2_low}} per match in the lowest band and {{p_duo2_high}} at {{rank_duo2_high}}. Bundles cut that total by {{pct3}} on 3 matches and {{pct5}} on 5. For example, you keep your Steam account and your own decisions in all 3 matches.',
      ],
    },
    {
      heading: 'How wide can the rating gap in a CS2 party be?',
      paragraphs: [
        'Valve does not publish a CS Rating gap for Premier parties. The official skill-group FAQ says only that a lower-skilled friend is taken into account when matchmaking picks a lobby, with no admission threshold named. First, that means the honest promise is the highest-rated teammate the queue accepts for your rating, checked live in the client rather than asserted here. For example, a {{rank_duo1}} player books Duo Plus at {{p_duo1}} per match, or {{p_duo1_x3}} for 3 matches with {{pct3}} off.',
        'FACEIT is the documented route for a wide gap. A FACEIT Standard match has no party Elo restriction and no party size restriction inside the team, so a full five from FACEIT may mix Level 2 and Level 10. Super and Premium matches are the strict ones, capped at 3 and 2 players within 400 Elo. FACEIT Stack is the booking for that, {{p_faceit5}} for {{seats_faceit5}} seats at {{rank_faceit5}}, with {{pct5}} off 5 matches and voice using Discord.',
      ],
    },
    {
      heading: 'Example evening: three Duo Plus matches on EU West',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo1}} player on EU West books 3 Duo Plus matches with a Premier 15,000+ teammate, which keeps the party gap small enough to queue comfortably. The total is {{p_duo1_x3}} with the {{pct3}} bundle discount, against {{p_duo1}} for one match. The order chat opens straight after payment, and the first message names the region, the rating and the map pool: Mirage and Anubis, entry on the A side, looking for someone who throws the pop flash.',
        'From there the evening runs on a short plan. You agree roles and a default on each map, voice goes on, and the friend request goes out on Steam. After each match you pick one adjustment, for example saving two rounds earlier instead of forcing a half buy, agreed using Discord. Duo Pro with a 20,000+ caller costs {{p_duo2}} per match at {{rank_duo2}} for the step up, and 5 matches take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is CS2 coaching the better booking?',
      paragraphs: [
        'CS2 coaching is the better booking when the goal is a repeatable fix rather than company for the next match. A duo teammate answers a quick question between halves. A coach stops the demo, names the pattern and leaves you with homework. Demo Review and Utility and Lineups each cost {{p_demo}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate matches only.',
        'For example, a player who dies first on the A site execute gains more from one demo review than from a fourth Premier match. A player who only wants to warm up gains more from Casual and Deathmatch at {{p_casual}} per match. Screen share runs using Discord, and Play and Learn covers one live Premier match with a Level 10 coach at {{p_learn}}. Counter-Strike 2 has no separate Duoly coaching page yet, so every lesson is booked from the prices above.',
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
        'Can any two ratings queue Premier together?',
        'Valve publishes no rating gap for a Premier party, so the teammate has to be eligible to queue with you under the rules of the game. FACEIT Standard is the documented wide-gap route, with no party Elo limit.',
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
        'Yes: 3 matches get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off, so 3 Duo Pro matches cost {{p_duo2_x3}} at {{rank_duo2}} in 2026.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Counter-Strike 2?',
    text: 'Duo Pro is the Premier tier with a 20,000+ teammate from Duoly. Three matches at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 matches take {{pct5}} off. Retake Servers stay {{p_casual}} per match at any rating, and Casual and Deathmatch costs the same. Valve publishes no Premier party gap, so book a FACEIT Stack when you want the widest rating gap the rules allow in 2026. For example, pick your rating and maps, then agree roles in the order chat using Discord.',
  },
};
