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
  intent:
    'After the two-player page rather than the whole catalog? It covers hero pairings, Team-Up abilities and prices for a pair on their own.',
  format: {
    heading: 'What can you book for Marvel Rivals on Duoly?',
    text: 'Duoly sells three things for Marvel Rivals: one teammate who joins your matches on your own account, a 6-stack fill for the seats you are missing, and coaching by the hour. Duo Plus brings a Diamond+ teammate who fills the missing role, Duo Pro a Grandmaster+ player who tracks ultimates and Duo Apex a Celestial+ player for high lobbies. Competitive follows your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per match on Duo Pro, while Quick Match and Arcade stay {{p_quick}} per match at every rank. Bundles cut the total, {{pct3}} off 3 matches up to {{pct10}} off 10. NetEase Games caps party size rather than the rank gap: a duo works at any rank, and one Celestial player holds the whole party to two.',
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
      'Teammate prices are per match, and the Competitive services read your own rank, so the top of the ladder costs more than a Bronze lobby. Quick Match, Arcade and the Team-Up session hold one price for everybody. One teammate joins your matches on your own account, picking the role your team keeps missing, and bundles take {{pct3}} off 3 matches or {{pct5}} off 5.',
    team: 'The 6-stack fill is priced per seat, so the card covers the default {{seats_six}} seats and falls when your group already has bodies. It reads your own rank like the Competitive duos do, and a full six is the shape NetEase Games allows where a five is not. Bundles take {{pct3}} off 3 matches and {{pct5}} off 5.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate sessions stop at this grid. Hero Mastery works through one hero in depth, from ability timings to the matchups that counter you, and Play and Learn is the live option where the coach calls a real Competitive game. Screen share runs on Discord.',
  },
  steps: {
    heading: 'How does booking a Marvel Rivals duo work?',
    items: [
      'Pick a service and the number of matches. Duo Pro is the Competitive tier with a Grandmaster+ teammate, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five matches take {{pct5}} off.',
      'Add your region, rank, platform and hero pool at checkout. Name Europe, {{rank_duo2}} and two Strategists, so your teammate reads the real request before accepting.',
      'Meet your teammate in the order chat, agree the hero pair and a Team-Up to try, then invite each other by username. A single Duo Pro match costs {{p_duo2}} at the same rank.',
    ],
    note: 'Duoly reviews every Marvel Rivals teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Marvel Rivals session fits you?',
    intro:
      'The right Rivals session is the one matching your goal for the evening, so pick the goal first and let the price follow. Competitive is priced by your own rank, from {{p_duo2_low}} per match on Duo Pro, with {{pct3}} off 3 matches and {{pct5}} off 5. Quick Match stays flat at every rank.',
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
        'Every Duoly Marvel Rivals teammate applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player, Duo Pro a Grandmaster+ player and Duo Apex a Celestial+ player. The tier describes the teammate you are hiring and nothing about your own lobby. Marvel Rivals is unusually relaxed here: NetEase Games limits party size rather than the rank gap, so a duo queues Competitive at any pairing, and only a player in placements brings a three-division limit into the party. Share your platform and rank in the order chat anyway, because matchmaking reads the higher rank.',
        'What the rank actually buys you is fight discipline. A Grandmaster+ teammate tracks the enemy ultimates and calls the reset instead of walking in alone, and the dive call arrives before the cooldown comes back. Voice runs on Discord for exactly that reason. Rank also sets the price: Duo Pro runs {{p_duo2_low}} per match at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. You keep your hero and your account.',
      ],
    },
    {
      heading: 'How does a 6-Stack Fill work in Marvel Rivals?',
      paragraphs: [
        'A 6-stack fill is one order that hires several players at once, so a part-full group becomes a complete six. 6-Stack Fill covers up to {{seats_six}} empty seats with Grandmaster+ players at {{p_six}} per match at {{rank_six}}, and 3 matches cost {{p_six_x3}} with {{pct3}} off. Every seat is priced separately, so a trio short three players sets the seats to three instead of five. Name the roles you want covered, because a second Vanguard changes the whole composition.',
        'One rule decides whether a six is even possible: NetEase Games lets Bronze to Grandmaster players queue Competitive in any party size except five, while a single Celestial, Eternity or One Above All player caps the party at two. A six therefore needs everybody at Grandmaster or below. Past that, check the current Team-Up panel, since the pairings change between seasons, agree one caller for dives and resets, and keep everybody on the same call. Bundles still apply, {{pct3}} off 3 matches and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro matches in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} Strategist in Europe books 3 Duo Pro matches. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one match. A duo has no rank gap limit in Competitive, so the pairing queues as it is. The order chat opens straight after payment, and the first message names the region, the rank and the role: Europe, {{rank_duo2}}, Strategist, looking for a Vanguard who holds the front line.',
        'From there the evening runs on a short plan. You agree a hero pair and a Team-Up to try, voice goes on, and the invite goes out by username. After each match you pick one adjustment, such as holding the ultimate for the second push instead of spending it on the first contest. Five matches take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Marvel Rivals coaching the better booking?',
      paragraphs: [
        'Marvel Rivals coaching is the better booking when the goal is a repeatable fix rather than company for the next match. A duo teammate answers a quick question between fights; a coach pauses the clip, names the pattern and leaves you with homework. Hero Coaching costs {{p_hero}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate sessions only.',
        'A player who keeps dying after the ultimate gains more from one hero hour than from another Competitive match. A player who wants a relaxed evening gains more from Quick Match and Arcade at {{p_quick}} per match. The full lesson list lives on the [Marvel Rivals coaching page](/games/marvel-rivals/coaching), the two-player side is covered on the [Marvel Rivals duo partner](/games/marvel-rivals/duo-partner) page, and screen share runs on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Marvel Rivals sessions?',
    items: [
      [
        'Is Duoly a free Marvel Rivals teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from NetEase Games stay the free routes to a six.',
      ],
      [
        'How much does a Marvel Rivals duo cost?',
        'Duo Pro is {{p_duo2}} per match at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rank. Bundles take {{pct3}} off 3 matches, and 10 matches cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Can every rank queue Competitive together?',
        'A duo can. NetEase Games limits party size instead of the rank gap, so Bronze to Grandmaster players group in any size except five, and one Celestial or higher player caps the party at two.',
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
        'Where do I book Marvel Rivals coaching?',
        'On the Marvel Rivals coaching page, with Hero Coaching by the hour and one live Competitive match in Play and Learn, with screen share on Discord.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Marvel Rivals?',
    text: 'Duo Pro is the Competitive tier with a Grandmaster+ teammate from Duoly, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Quick Match stays {{p_quick}} per match at any rank. Agree your hero pair on Discord before the first queue.',
  },
};
