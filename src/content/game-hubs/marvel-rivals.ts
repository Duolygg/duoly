import type { HubPageCopy } from '../hub-pages';

export const marvelRivals: HubPageCopy = {
  gameSlug: 'marvel-rivals',
  title: 'Marvel Rivals LFG: Find Teammates or a Coach | Duoly',
  description:
    'Book a Marvel Rivals duo, a 6-stack fill or hero coaching on Duoly, {{from_lower}}. Compare Competitive, Quick Match and Team-Up prices.',
  eyebrow: 'Marvel Rivals teammates',
  h1: 'Marvel Rivals LFG: find teammates for tonight',
  lead: 'Free LFG Discords work for a casual six. Duoly books a reviewed Diamond, Grandmaster or Celestial teammate for your next matches, fills the whole stack and sells hero coaching.',
  cta: 'Book a Marvel Rivals teammate',
  facts: [
    'Diamond+ to Celestial teammates',
    'Competitive, Quick Match and Team-Up',
    'Voice on Discord, your own account',
  ],
  related: [
    'overwatch-2',
    'league-of-legends',
    'teamfight-tactics',
    'valorant',
  ],
  format: {
    heading: 'What can you book for Marvel Rivals on Duoly?',
    text: 'A Duoly Marvel Rivals booking is a paid session where reviewed higher-rank players join your team on your own account. Duo Plus brings a Diamond+ teammate who fills the missing role, Duo Pro a Grandmaster+ player who tracks ultimates and Duo Apex a Celestial+ player for high lobbies. Prices follow your own rank, so a {{rank_duo2}} player pays {{p_duo2}} per match for Duo Pro in November 2026. For example, Quick Match and Arcade costs {{p_quick}} per match at every rank, because casual modes keep one flat price. Bundles cut the total: 3 matches get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. A 6-Stack Fill covers the empty seats, and the party rules from NetEase Games still apply to Competitive. Finally, every booking opens an order chat, where you agree heroes, roles and voice using Discord.',
  },
  services: {
    duo1: 'Competitive with a Diamond player who fills the missing role and holds fights together.',
    duo2: 'Competitive with a Grandmaster player who tracks ultimates and calls every dive.',
    duo3: 'Competitive with a Celestial or higher player who can carry fights on any role.',
    teamup:
      'Pick a hero pair with a Team-Up ability and learn to land it together.',
    quick:
      'Quick Match and Arcade: no-pressure games to try new heroes or just have fun.',
    gg1v1:
      'A custom hero duel against a verified Gamer Girl, rematches encouraged.',
    ggbuddy:
      'A patient Gamer Girl plays Quick Match or Arcade and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    six: 'Bring your friends and we fill your six with Grandmaster+ players on voice.',
    learn:
      'One live Competitive match with a Grandmaster+ coach explaining every decision.',
    hero: 'One hour on one hero: abilities, ultimate timing, positioning and matchups.',
  },
  intros: {
    teammate:
      'One teammate joins your matches on your own account, from Competitive to Quick Match and Team-Up.',
    team: 'A 6-stack fill adds several Grandmaster+ players at once, priced for the seats you need.',
    coaching:
      'Both lessons run for one hour, one live in Competitive and one on a single hero.',
  },
  steps: {
    heading: 'How does booking a Marvel Rivals duo work?',
    items: [
      'First, pick a service and the number of matches. Duo Pro is the Competitive option with a Grandmaster+ teammate, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five matches get {{pct5}} off.',
      'Second, add your region, rank, platform and hero pool at checkout. For example, name Europe, {{rank_duo2}} and two Strategists, so your teammate reads the real request from Duoly before accepting.',
      'Third, meet your teammate in the order chat, agree the hero pair and voice using Discord, then invite each other by username. A single Duo Pro match costs {{p_duo2}} at the same rank in 2026. Ten matches get {{pct10}} off.',
    ],
    note: 'Duoly reviews every Marvel Rivals teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Marvel Rivals session fits you?',
    intro:
      'The right Rivals session is the one matching your goal for the evening, so pick the goal first and let the price follow. For example, a {{rank_duo2}} player climbing Competitive pays {{p_duo2}} per match for Duo Pro in 2026, with {{pct3}} off 3 matches and {{pct5}} off 5. Voice runs using Discord in every session booked from Duoly.',
    picks: [
      {
        goal: 'Climbing Competitive this season?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Grandmaster+ teammate from {{p_duo2_low}} per match, priced by your own rank and tracking every ultimate.',
      },
      {
        goal: 'Missing a Vanguard or Strategist?',
        service: 'duo1',
        answer:
          'Duo Plus fills the role your team keeps lacking with a Diamond+ player, {{p_duo1}} at {{rank_duo1}}.',
      },
      {
        goal: 'Want to land a Team-Up properly?',
        service: 'teamup',
        answer:
          'Team-Up Duo costs {{p_teamup}} per match and is built around one hero pairing and its shared ability.',
      },
      {
        goal: 'Need a full six?',
        service: 'six',
        answer:
          '6-Stack Fill covers up to {{seats_six}} seats with Grandmaster+ players on the roles you name.',
      },
      {
        goal: 'One hero never clicking?',
        service: 'hero',
        answer:
          'Hero Coaching is one hour with a Grandmaster+ coach on abilities, ultimate timing and positioning.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'A Duoly Marvel Rivals teammate is a reviewed player who applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player, Duo Pro a Grandmaster+ player and Duo Apex a Celestial+ player. The tier describes the teammate, never your own lobby. Party rules from NetEase Games decide which ranks can queue Competitive together, so share your platform and rank in the order chat first. For example, a {{rank_duo2}} player pays {{p_duo2}} per match in 2026.',
        'What the rank buys you is fight discipline. First, a Grandmaster+ teammate tracks the enemy ultimates and calls the reset instead of walking in alone. Second, voice runs using Discord, so the dive call lands before the cooldown. A {{rank_duo2_high}} player pays {{p_duo2_high}} per match, because higher lobbies need stronger teammates, and bundles take {{pct3}} off 3 matches or {{pct5}} off 5. You keep your hero and your account.',
      ],
    },
    {
      heading: 'How does a 6-Stack Fill work in Marvel Rivals?',
      paragraphs: [
        'A 6-stack fill is a single order hiring several players at once, so a part-full group becomes a complete six. 6-Stack Fill covers up to {{seats_six}} empty seats with Grandmaster+ players at {{p_six}} per match at {{rank_six}} in 2026. Three matches cost {{p_six_x3}} with {{pct3}} off, and the party rules from NetEase Games still apply. Every seat is priced separately, so a trio short three players sets the seats to three instead of five. Name the roles you want covered, because a second Vanguard changes the whole composition.',
        'Agree the shape of the team before the first lobby. For example, ask for one Vanguard and one Strategist so your Duelist has a front line and healing. First, check the current Team-Up panel, since the pairings change between seasons. Second, agree one caller for dives and resets. Finally, keep everybody on one call using Discord. Bundles still apply, so 3 matches get {{pct3}} off and 5 get {{pct5}} off the total.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro matches in Europe',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} Strategist in Europe books 3 Duo Pro matches. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one match. The order chat opens straight after payment, and the first message names the region, the rank and the role: Europe, {{rank_duo2}}, Strategist, looking for a Vanguard who holds the front line.',
        'The evening then runs on a short plan. First, both players agree a hero pair and a Team-Up to try. Second, voice goes on using Discord and the invite goes out by username. Third, after each match you agree one adjustment, such as holding the ultimate for the second push. We found the rank spread by running the price tool from Duoly for every tier, so a {{rank_duo2_low}} player pays {{p_duo2_low}} in 2026. Five matches take {{pct5}} off.',
      ],
    },
    {
      heading: 'When is Marvel Rivals coaching the better booking?',
      paragraphs: [
        'Marvel Rivals coaching is the better booking when the goal is a repeatable fix rather than company for the next match. A duo teammate answers a quick question between fights. A coach pauses the clip, names the pattern and leaves you with homework. Hero Coaching costs {{p_hero}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'For example, a player who keeps dying after the ultimate gains more from one hero hour than from another Competitive match. Finally, a player who wants a relaxed evening gains more from Quick Match and Arcade at {{p_quick}} per match. The full lesson list lives on the [Marvel Rivals coaching page](/games/marvel-rivals/coaching), the duo side is covered on the [Marvel Rivals duo partner guide](/games/marvel-rivals/duo-partner), and screen share runs using Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Marvel Rivals sessions?',
    items: [
      [
        'Is Duoly a free Marvel Rivals teammate finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and the in-game friend list from NetEase Games stay the free routes to a six.',
      ],
      [
        'How much does a Marvel Rivals duo cost?',
        'Duo Pro is {{p_duo2}} per match at {{rank_duo2}} in 2026. First, bundles take {{pct3}} off 3 matches, and 10 matches cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Do you pick the Team-Up heroes for me?',
        'No. Agree the pair with your teammate using the current in-game Team-Up panel, because the available pairings change between seasons.',
      ],
      [
        'Does a duo booking fill all six seats?',
        'No. A duo adds one teammate, and the other seats come from your party or the normal queue. Book a 6-Stack Fill when you want several at once.',
      ],
      [
        'Can we play Quick Match instead of ranked?',
        'Yes. Quick Match and Arcade is its own flat-price service, which suits trying a new hero or settling into voice using Discord first.',
      ],
      [
        'Where do I book Marvel Rivals coaching?',
        'On the Marvel Rivals coaching page, with Hero Coaching by the hour and one live Competitive match in Play and Learn, using Discord screen share.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Marvel Rivals?',
    text: 'Duo Pro is the Competitive session with a Grandmaster+ teammate from Duoly. For example, 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off in 2026. Five matches get {{pct5}} off. Finally, agree your hero pair using Discord before the first queue.',
  },
};
