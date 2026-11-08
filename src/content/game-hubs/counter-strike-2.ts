import type { HubPageCopy } from '../hub-pages';

export const counterStrike2: HubPageCopy = {
  gameSlug: 'counter-strike-2',
  title: 'CS2 LFG: Find a Premier Duo or a 5-Stack | Duoly',
  description:
    'Book a Counter-Strike 2 duo, a FACEIT stack or a coach on Duoly, {{from_lower}}. Compare Premier, Wingman and retake prices.',
  eyebrow: 'Counter-Strike 2 teammates',
  h1: 'CS2 LFG: find a Premier duo for tonight',
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
    text: 'A Duoly Counter-Strike 2 booking is a paid session where reviewed higher-rated players queue with you on your own account. Duo Plus brings a Premier 15,000+ teammate, Duo Pro a Premier 20,000+ caller and FACEIT Duo a Level 10 player for the third-party ladder. Prices follow your own rating, so a {{rank_duo2}} player pays {{p_duo2}} per match for Duo Pro in November 2026. For example, Casual and Deathmatch or Retake Servers each cost {{p_casual}} per match at every rating, because warm-up modes keep one flat price. Bundles cut the total: 3 matches get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. Stack fills cover Premier fives and FACEIT lobbies, and coaching runs by the hour. Premier and the matchmaking rules from Valve still decide which accounts queue together. Finally, every booking opens an order chat, where you set maps, roles and voice using Discord.',
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
      'One teammate joins your matches on your own account, from Premier and FACEIT to Wingman and retakes.',
    team: 'Stack fills add several high-rated players at once, priced for the seats you need covered.',
    coaching:
      'Every lesson runs for one hour, except Play and Learn, which covers one live Premier match.',
  },
  steps: {
    heading: 'How does booking a CS2 duo work?',
    items: [
      'First, pick a service and the number of matches. Duo Pro is the Premier option with a 20,000+ teammate, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five matches get {{pct5}} off.',
      'Second, add your region, rating, map pool and language at checkout. For example, name EU West, your Premier rating and the two maps you want to play, so your teammate reads the real request before accepting.',
      'Third, meet your teammate in the order chat, agree roles and voice using Discord, then add each other from Steam. A single Duo Pro match costs {{p_duo2}} at the same rating in 2026. Ten matches get {{pct10}} off.',
    ],
    note: 'Duoly reviews every CS2 teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which CS2 session fits you?',
    intro:
      'The right CS2 session is the one matching your goal for the evening. For example, a {{rank_duo2}} player grinding Premier pays {{p_duo2}} per match for Duo Pro in 2026. Pick the goal first, because the queue rules from Valve decide the rest. Voice runs using Discord, and {{pct5}} off applies to 5 matches.',
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
          'Wingman Duo is the real 2v2 on small maps, where every round depends on the two of you.',
      },
      {
        goal: 'Need a fifth, or four?',
        service: 'five',
        answer:
          '5-Stack Premier fills up to {{seats_five}} seats with 20,000+ players for {{p_five}} per match.',
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
        'A Duoly CS2 teammate is a reviewed player who applied for the game and showed a rating before taking orders. Duo Plus names a Premier 15,000+ player, Duo Pro a Premier 20,000+ player and FACEIT Duo a Level 10 player on the FACEIT ladder. The tier describes the teammate, never your own queue eligibility. Premier matchmaking from Valve decides which ratings can queue together, so share your region and rating in the order chat first.',
        'What the rating buys you is a round that makes sense. First, a 20,000+ teammate trades your peek instead of watching, calls the buy and names the rotation. Second, voice runs using Discord, so a flash lands before the entry. For example, a {{rank_duo2}} player pays {{p_duo2}} per match for Duo Pro in 2026. A {{rank_duo2_high}} player pays {{p_duo2_high}}, because higher lobbies need stronger teammates. Bundles take {{pct3}} off 3 matches or {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Should you book Premier, FACEIT or Wingman?',
      paragraphs: [
        'Premier is the ranked mode from Valve with the pick and ban phase and a visible rating, so Duo Plus and Duo Pro are priced by your own band. FACEIT is a third-party platform with its own Level 1 to 10 ladder, so FACEIT Duo uses Level tokens instead of a rating and costs {{p_duo3}} at {{rank_duo3}}. Wingman is the 2v2 mode on small maps with the classic skill groups, at {{p_wing}} per match at {{rank_wing}} in 2026.',
        'Pick by how much time you have and what you want to practice. For example, Wingman suits a short evening, because every round sits on the two of you. Second, Premier suits a steady grind with a caller. Finally, Retake Servers and Casual and Deathmatch each cost {{p_casual}} per match and work as a warm-up before the first real queue, with voice using Discord. Bundles still apply, so 3 matches get {{pct3}} off and 5 get {{pct5}} off.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro matches on EU West',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player on EU West books 3 Duo Pro matches. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one match. The order chat opens straight after payment, and the first message names the region, the rating and the map pool: Mirage and Anubis, entry on the A side, looking for someone who throws the pop flash.',
        'The evening then runs on a short plan. First, both players agree roles and a default on each map. Second, voice goes on using Discord and the friend request goes out on Steam. Third, after each match you agree one adjustment, such as saving two rounds earlier. We found the rating spread by running the price tool from Duoly for every band, so a {{rank_duo2_low}} player pays {{p_duo2_low}} per match and a {{rank_duo2_high}} player pays {{p_duo2_high}}. Five matches take {{pct5}} off.',
      ],
    },
    {
      heading: 'When is CS2 coaching the better booking?',
      paragraphs: [
        'CS2 coaching is the better booking when the goal is a repeatable fix rather than company for the next match. A duo teammate answers a quick question between halves. A coach stops the demo, names the pattern and leaves you with homework. Demo Review and Utility and Lineups each cost {{p_demo}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'For example, a player who dies first on every A execute gains more from one demo review than from another Premier match. A player who only wants to warm up gains more from Casual and Deathmatch at {{p_casual}} per match. Screen share runs using Discord, and Play and Learn covers one live Premier match with a Level 10 coach at {{p_learn}}. Counter-Strike 2 has no separate Duoly coaching page yet, so every lesson is booked from the prices above.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about CS2 sessions?',
    items: [
      [
        'Is Duoly a free CS2 teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and the community servers listed by Valve stay the free routes to a five.',
      ],
      [
        'How much does a CS2 duo cost?',
        'Duo Pro is {{p_duo2}} per match at {{rank_duo2}}, from {{p_duo2_low}} at the lowest band. Casual and Deathmatch and Retake Servers each cost {{p_casual}}.',
      ],
      [
        'Can we play FACEIT instead of Premier?',
        'Yes. FACEIT Duo is the Level 10 service on the FACEIT ladder, and the rank picker uses FACEIT Levels instead of a Premier rating.',
      ],
      [
        'Do I need to share my Steam account?',
        'No. You play on your own account and add each other as friends on Steam. Never send login details to anyone, including a teammate or a coach.',
      ],
      [
        'Do bundles make several matches cheaper?',
        'Yes. Three matches get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off, so 3 Duo Pro matches cost {{p_duo2_x3}} in 2026.',
      ],
      [
        'Can a stack fill fewer than four seats?',
        'Yes. Set the seats to what you actually need, using Discord to agree roles first. 5-Stack Premier opens at {{seats_five}} seats and goes down to one.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Counter-Strike 2?',
    text: 'Duo Pro is the Premier session with a 20,000+ teammate from Duoly. For example, 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five matches get {{pct5}} off. Finally, pick your rating and maps, then meet your teammate using Discord.',
  },
};
