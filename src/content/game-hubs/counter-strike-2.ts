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
    text: 'Duoly sells three things for Counter-Strike 2: one teammate who queues with you on your own account, a stack fill for the seats you are missing, and coaching by the hour. Duo Plus brings a Premier 15,000+ teammate, Duo Pro a Premier 20,000+ caller and FACEIT Duo a Level 10 player for the third-party ladder. Premier sessions follow your own rating, from {{p_duo2_low}} to {{p_duo2_high}} per match on Duo Pro, while Casual and Deathmatch and Retake Servers stay {{p_casual}} per match at every rating. Bundles cut the total, {{pct3}} off 3 matches up to {{pct10}} off 10. Valve caps how far apart two ratings can be in a Premier party without ever publishing the number, so share your region and rating in the order chat first.',
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
      'Pick a service and the number of matches. Duo Pro is the Premier tier with a 20,000+ teammate, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five matches take {{pct5}} off.',
      'Add your region, rating, map pool and language at checkout. Name EU West, your Premier rating and the two maps you want to play, so your teammate reads the real request before accepting.',
      'Meet your teammate in the order chat, agree roles and check the party accepts both ratings, then add each other from Steam. A single Duo Pro match costs {{p_duo2}} at the same rating.',
    ],
    note: 'Duoly reviews every CS2 teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which CS2 session fits you?',
    intro:
      'The right CS2 session is the one matching your goal for the evening, so pick the goal first and let the price follow. Premier is priced by your own rating, from {{p_duo2_low}} per match on Duo Pro, while warm-up servers stay flat. Bundles take {{pct3}} off 3 matches and {{pct5}} off 5.',
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
        'Every Duoly CS2 teammate applied for the game and showed a rating before taking orders. Duo Plus names a Premier 15,000+ player, Duo Pro a Premier 20,000+ player and FACEIT Duo a Level 10 player on the FACEIT ladder. The tier describes the teammate you are hiring and nothing about your own queue eligibility. Valve limits the rating gap inside a Premier party without ever publishing the number, and a full five carries no limit at all, so the practical move is to try the party and fall back on Wingman or a retake server if Premier refuses it.',
        'Two details catch people out. A CS Rating only appears after ten Premier wins, and an account with no established rating cannot party with a high-rated player at all. FACEIT runs its own ladder, so a Level 10 teammate and a Premier rating are separate systems with separate party rules. Past that, the rating buys you a round that makes sense: a 20,000+ teammate trades your peek instead of watching it, calls the buy and names the rotation. Duo Pro runs {{p_duo2_low}} per match at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}.',
      ],
    },
    {
      heading: 'Should you book Premier, FACEIT or Wingman?',
      paragraphs: [
        'Premier is the ranked mode from Valve with the pick and ban phase and a visible rating, so Duo Plus and Duo Pro are priced by your own band. FACEIT is a third-party platform with its own Level 1 to 10 ladder, so FACEIT Duo uses Level tokens instead of a rating and costs {{p_duo3}} at {{rank_duo3}}. Wingman is the 2v2 mode on small maps with the classic skill groups, at {{p_wing}} per match at {{rank_wing}}.',
        'Pick by how much time you have and what you want to practice. Wingman suits a short evening, because every round sits on the two of you and a match rarely passes thirty minutes. Premier suits a steady grind with a caller who talks between halves. Retake Servers and Casual and Deathmatch each cost {{p_casual}} per match and work as a warm-up before the first real queue, with no rating at stake. Bundles still apply, {{pct3}} off 3 matches and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three Duo Plus matches on EU West',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo1}} player on EU West books 3 Duo Plus matches with a Premier 15,000+ teammate, which keeps the party gap small enough to queue comfortably. The total is {{p_duo1_x3}} with the {{pct3}} bundle discount, against {{p_duo1}} for one match. The order chat opens straight after payment, and the first message names the region, the rating and the map pool: Mirage and Anubis, entry on the A side, looking for someone who throws the pop flash.',
        'From there the evening runs on a short plan. You agree roles and a default on each map, voice goes on, and the friend request goes out on Steam. After each match you pick one adjustment, such as saving two rounds earlier instead of forcing on 1,500. Duo Pro with a 20,000+ caller costs {{p_duo2}} per match at {{rank_duo2}} if you want the step up, and 5 matches take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is CS2 coaching the better booking?',
      paragraphs: [
        'CS2 coaching is the better booking when the goal is a repeatable fix rather than company for the next match. A duo teammate answers a quick question between halves; a coach stops the demo, names the pattern and leaves you with homework. Demo Review and Utility and Lineups each cost {{p_demo}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'A player who dies first on the A site execute gains more from one demo review than from another Premier match. A player who only wants to warm up gains more from Casual and Deathmatch at {{p_casual}} per match. Screen share runs on Discord, and Play and Learn covers one live Premier match with a Level 10 coach at {{p_learn}}. Counter-Strike 2 has no separate Duoly coaching page yet, so every lesson is booked from the prices above.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about CS2 sessions?',
    items: [
      [
        'Is Duoly a free CS2 teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the community servers listed by Valve stay the free routes to a five.',
      ],
      [
        'How much does a CS2 duo cost?',
        'Duo Pro is {{p_duo2}} per match at {{rank_duo2}}, from {{p_duo2_low}} at the lowest band. Casual and Deathmatch and Retake Servers each cost {{p_casual}}.',
      ],
      [
        'Can any two ratings queue Premier together?',
        'No. Valve blocks a Premier party when the CS Rating gap is too wide, without publishing the number, and an account with no rating yet cannot party with a high-rated player. A full five has no gap limit.',
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
        'Yes. Three matches get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off, so 3 Duo Pro matches cost {{p_duo2_x3}} at {{rank_duo2}}.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Counter-Strike 2?',
    text: 'Duo Pro is the Premier tier with a 20,000+ teammate from Duoly, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Retake Servers stay {{p_casual}} per match at any rating. Pick your rating and maps, then meet your teammate in the order chat.',
  },
};
