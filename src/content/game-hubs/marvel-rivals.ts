import type { HubPageCopy } from '../hub-pages';

export const marvelRivals: HubPageCopy = {
  gameSlug: 'marvel-rivals',
  title: 'Marvel Rivals Team Finder: Teammates and Coaching | Duoly',
  description:
    'Find Marvel Rivals teammates, a 6-stack or hero coaching on Duoly, {{from_lower}}. Compare Competitive, Quick Match and Team-Up prices.',
  eyebrow: 'Marvel Rivals teammates',
  h1: 'Marvel Rivals team finder: book teammates or a coach',
  lead: 'Free LFG Discords work for a casual six. Duoly books the highest-ranked teammate your Competitive party may queue with, fills the whole stack and sells hero coaching.',
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
    text: 'A Marvel Rivals booking on Duoly is a single reviewed teammate, a 6-stack fill or a coaching hour. First, the Competitive tiers are Duo Plus with a Diamond+ teammate, Duo Pro with a Grandmaster+ player and Duo Apex with a Celestial+ player. Competitive prices follow your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per match on Duo Pro. Quick Match and Arcade holds one flat price of {{p_quick}} at every rank, and Team-Up Duo costs {{p_teamup}}. Bundles cut the total, {{pct3}} off 3 matches up to {{pct10}} off 10. The Season 5 notes from NetEase Games, published in 2025 and read again in November 2026, cap party size rather than naming a rank gap: Bronze through Grandmaster may use any party size except 5, and one Celestial player holds the party to 2. For example, name your platform and role using Discord first.',
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
      'Teammate prices are per match, and the Competitive services read your own rank: Duo Pro costs {{p_duo2_low}} per match at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Quick Match, Arcade and the Team-Up session hold one price for everybody. First, pick the mode, because the mode decides whether the rank list on a card matters. Second, read the party rule beside the tier. NetEase Games publishes party sizes and a placement limit rather than a general rank-gap table, so the honest promise is the highest-ranked teammate your party may queue with under the rules of the game in 2026. Bundles take {{pct3}} off 3 matches and {{pct5}} off 5. For example, agree the hero pair using Discord before match 1.',
    team: 'A 6-stack fill is one order that hires several players at once, so a part-full group becomes a complete six. 6-Stack Fill covers up to {{seats_six}} seats at {{p_six}} per match at {{rank_six}}, from {{p_six_low}} at {{rank_six_low}}. First, count the seats you actually need, because every seat is priced on its own. A six does not widen the party rule either: NetEase Games allows any party size except 5 only while nobody sits at Celestial or above, so a stack caps at Grandmaster, read in November 2026. Bundles take {{pct3}} off 3 matches and {{pct5}} off 5. For example, a trio short 3 players books 3 seats rather than 5, agreed using Discord.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount at all, so the {{pct3}} and {{pct5}} savings on teammate matches stop here. Hero Coaching costs {{p_hero}} per hour and works through one hero in depth, from ability timings to the matchups that counter you. Play and Learn is the live option where a Grandmaster+ coach calls one real Competitive match at {{p_learn}}. First, pick the problem rather than the format. For example, a player who dies straight after the ultimate books the hero hour instead of a fourth Competitive match. Screen share runs using Discord, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking a Marvel Rivals duo work?',
    items: [
      'Pick a service and the number of matches first. Duo Pro is the Competitive tier with a Grandmaster+ teammate, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five matches take {{pct5}} off.',
      'Second, add your region, rank, platform and hero pool at checkout. For example, name Europe, {{rank_duo2}} and two Strategists, so your teammate reads the real request before accepting.',
      'Finally, meet your teammate in the order chat using Discord. Agree the hero pair and a Team-Up to try, check the party is eligible under the rules from NetEase Games, then invite each other by username. One Duo Pro match costs {{p_duo2}}.',
    ],
    note: 'Duoly reviews every Marvel Rivals teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Marvel Rivals session fits you?',
    intro:
      'The right Rivals session is the one matching your goal for the evening. First, Quick Match and Arcade stay flat at every rank. Competitive is priced by your own rank, from {{p_duo2_low}} per match on Duo Pro, and the party rules come from NetEase Games rather than from a tier name. For example, 3 matches take {{pct3}} off and 5 matches take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing Competitive this season?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Grandmaster+ teammate from {{p_duo2_low}} per match, priced by your own rank.',
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
          'Team-Up Duo costs {{p_teamup}} per match, built around one hero pairing and its shared ability.',
      },
      {
        goal: 'Need a full six?',
        service: 'six',
        answer:
          '6-Stack Fill covers up to {{seats_six}} seats for {{p_six}}, and a stack caps at Grandmaster.',
      },
      {
        goal: 'One hero never clicking?',
        service: 'hero',
        answer:
          'Hero Coaching is one hour with a Grandmaster+ coach for {{p_hero}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'The teammate you queue with is a reviewed Marvel Rivals player who applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player, Duo Pro a Grandmaster+ player and Duo Apex a Celestial+ player. A tier describes the person Duoly hires and never your own lobby. First, the party rules come from NetEase Games: the Season 5 notes allow any party size except 5 from Bronze through Grandmaster, hold Celestial, Eternity and One Above All to a solo or a duo, and cap a party containing a player in placements at 3 seats with under 3 divisions between the top and the bottom.',
        'What the rank buys is fight discipline. A Grandmaster+ teammate tracks the enemy ultimates and calls the reset instead of walking in alone, so the dive lands before a cooldown returns. Voice runs using Discord for exactly that reason. Rank also sets the price: Duo Pro costs {{p_duo2_low}} per match at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Bundles cut the total by {{pct3}} on 3 matches and {{pct5}} on 5. For example, you keep your hero and your account in all 3 matches.',
      ],
    },
    {
      heading: 'How wide can a Marvel Rivals party be?',
      paragraphs: [
        'NetEase Games publishes party sizes for Marvel Rivals Competitive and no general rank-gap table. First, the Season 5 notes name three rules: Bronze through Grandmaster may queue in any party size except 5, Celestial and above may only queue solo or as a duo, and a party holding anybody in placements is capped at 3 players with under 3 divisions between the highest and the lowest. For example, Duoly read the official notes again in November 2026 and found no published cap for an ordinary Diamond and Grandmaster pairing.',
        'So the honest promise is the highest-ranked teammate your party may queue with under the rules of the game, checked in the client rather than asserted here. A full six does not open a wider gap: a stack of 6 needs everybody at Grandmaster or below, so a six-stack holding a Celestial player is ruled out entirely. Quick Match and Arcade carry no rank at all and cost {{p_quick}} per match, so a very wide pairing belongs there. Duo Apex is {{p_duo3}} per match, or {{p_duo3_x3}} for 3 matches with {{pct3}} off and {{pct5}} off 5, agreed using Discord.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro matches in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} Strategist in Europe books 3 Duo Pro matches with a Grandmaster teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one match. Neither player is in placements and neither sits at Celestial, so the published party rules from NetEase Games leave the duo free to queue. The order chat opens straight after payment, and the first message names the region, the rank and the role: Europe, {{rank_duo2}}, Strategist, looking for a Vanguard who holds the front line.',
        'From there the evening runs on a short plan. You agree a hero pair and a Team-Up to try, voice goes on, and the invite goes out by username. After each match you pick one adjustment, for example holding the ultimate for the second push instead of spending it on the first contest, agreed using Discord. Three matches usually fill about 75 minutes, and 5 matches take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Marvel Rivals coaching the better booking?',
      paragraphs: [
        'Marvel Rivals coaching is the better booking when the goal is a repeatable fix rather than company for the next match. A duo teammate answers a quick question between fights. A coach pauses the clip, names the pattern and leaves you with homework. Hero Coaching costs {{p_hero}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate matches only.',
        'First, name the habit you keep repeating. For example, a player who keeps dying right after the ultimate gains more from one hero hour at {{p_hero}} than from a fourth Competitive match. A player who wants a relaxed evening gains more from Quick Match and Arcade at {{p_quick}} per match in 2026. Play and Learn is one live Competitive match with a Grandmaster+ coach at {{p_learn}}, and screen share runs using Discord. The full lesson list lives on the [Marvel Rivals coaching page](/games/marvel-rivals/coaching), and the two-player side is covered on the [Marvel Rivals duo partner](/games/marvel-rivals/duo-partner) page.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Marvel Rivals sessions?',
    items: [
      [
        'Is Duoly a free Marvel Rivals teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from NetEase Games are the free routes, so try those first.',
      ],
      [
        'How much does a Marvel Rivals duo cost?',
        'Duo Pro is {{p_duo2}} per match at {{rank_duo2}}, and {{p_duo2_low}} at the lowest rank. Ten matches cost {{p_duo2_x10}} with {{pct10}} off in 2026.',
      ],
      [
        'Can a Gold player queue with a Celestial teammate?',
        'NetEase Games holds Celestial and above to a solo or a duo and publishes no general rank-gap table, so the teammate has to be eligible to queue with you under the rules of the game. Check the party in the client.',
      ],
      [
        'Do you pick the Team-Up heroes for me?',
        'No: agree the pair with your teammate using the current in-game Team-Up panel, for example before match 1, because the pairings change between seasons.',
      ],
      [
        'Does a duo booking fill all six seats?',
        'No: a duo adds one teammate, and the other seats come from your party or the normal queue. Book a 6-Stack Fill at {{p_six}} per match for several at once.',
      ],
      [
        'Where do I book Marvel Rivals coaching?',
        'The Marvel Rivals coaching page sells Hero Coaching by the hour, plus one live Competitive match in Play and Learn. Coaching gets no bundle discount.',
      ],
    ],
  },
  closing: {
    heading: 'Ready to queue in Marvel Rivals?',
    text: 'Duo Pro is the Competitive tier with a Grandmaster+ teammate from Duoly. Three matches at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 matches take {{pct5}} off. Quick Match stays {{p_quick}} per match at any rank, and Team-Up Duo costs {{p_teamup}}. NetEase Games caps party size rather than publishing a rank-gap table, so a stack of 6 caps at Grandmaster and Celestial queues solo or as a duo in 2026. For example, agree your hero pair using Discord before the first queue.',
  },
};
