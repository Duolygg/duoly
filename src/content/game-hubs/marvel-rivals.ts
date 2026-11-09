import type { HubPageCopy } from '../hub-pages';

export const marvelRivals: HubPageCopy = {
  gameSlug: 'marvel-rivals',
  title: 'Marvel Rivals Team Finder: Teammates and Coaching | Duoly',
  description:
    'Find Marvel Rivals teammates, a 6-stack or hero coaching on Duoly, {{from_lower}}. Compare Competitive, Quick Match and Team-Up prices.',
  eyebrow: 'Marvel Rivals teammates',
  h1: 'Marvel Rivals team finder: book teammates or a coach',
  lead: 'Free LFG Discords work for a casual six. Duoly books a reviewed Diamond, Grandmaster or Celestial teammate for Competitive, fills the empty seats of a six and sells hero coaching by the hour.',
  cta: 'Book a Marvel Rivals teammate',
  facts: [
    'Diamond+ to Celestial teammates',
    'Competitive, Quick Match and Team-Up',
    'Voice on Discord, your own account',
  ],
  related: [
    'overwatch-2',
    'rainbow-six-siege',
    'counter-strike-2',
    'deadlock',
    'dota-2',
  ],
  intent:
    'After the two-player page rather than every Rivals service? It covers hero pairings, Team-Up abilities and prices for a pair on their own.',
  format: {
    heading: 'What can you book for Marvel Rivals on Duoly?',
    text: 'A Marvel Rivals booking on Duoly is a single reviewed teammate, a 6-stack fill or a coaching hour. First, the Competitive tiers are Duo Plus with a Diamond+ teammate, Duo Pro with a Grandmaster+ player and Duo Apex with a Celestial+ player. Competitive prices follow your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per match on Duo Pro. Quick Match and Arcade holds one flat price of {{p_quick}} at every rank, and Team-Up Duo costs {{p_teamup}}. Bundles cut the total, {{pct3}} off 3 matches up to {{pct10}} off 10. Second, the fill: 6-Stack Fill hires Grandmaster+ players for up to {{seats_six}} seats at {{p_six}} per match, which turns a part-full group into a complete six. Third, the lessons, from {{p_hero}} for one hour on a single hero. For example, name your platform and role using Discord first.',
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
      'Teammate prices are per match, and the Competitive services read your own rank: Duo Pro costs {{p_duo2_low}} per match at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Quick Match, Arcade and the Team-Up session hold one price for everybody. First, pick the mode, because the mode decides whether the rank list on a card matters. Second, read the teammate tier beside the price: Duo Plus names a Diamond+ player, Duo Pro a Grandmaster+ player and Duo Apex a Celestial+ player at {{p_duo3}} per match. Every teammate booking adds one player to your party, so the tier decides who takes that seat. Bundles take {{pct3}} off 3 matches and {{pct5}} off 5. For example, agree the hero pair using Discord before match 1.',
    team: 'A 6-stack fill is one order that hires several players at once, so a part-full group becomes a complete six. 6-Stack Fill covers up to {{seats_six}} seats at {{p_six}} per match at {{rank_six}}, from {{p_six_low}} at {{rank_six_low}}. First, count the seats you actually need, because every seat is priced on its own. Second, name the roles, because a Marvel Rivals six usually wants two Vanguards, two Duelists and two Strategists and the fill covers whichever of those your group is short. Bundles take {{pct3}} off 3 matches and {{pct5}} off 5. For example, a trio short 3 players books 3 seats rather than 5, agreed using Discord.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount at all, so the {{pct3}} and {{pct5}} savings on teammate matches stop here. Hero Coaching costs {{p_hero}} per hour and works through one hero in depth, from ability timings to the matchups that counter you. Play and Learn is the live option where a Grandmaster+ coach calls one real Competitive match at {{p_learn}}. First, pick the problem rather than the format. For example, a player who dies straight after the ultimate books the hero hour instead of a fourth Competitive match. Screen share runs using Discord, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking a Marvel Rivals duo work?',
    items: [
      'Pick a service and the number of matches first. Duo Pro is the Competitive tier with a Grandmaster+ teammate, and 3 matches at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five matches take {{pct5}} off.',
      'Second, add your region, rank, platform and hero pool at checkout. For example, name Europe, {{rank_duo2}} and two Strategists, so your teammate reads the real request before accepting.',
      'Finally, meet your teammate in the order chat using Discord. Agree the hero pair and a Team-Up to try, then invite each other by username. One Duo Pro match costs {{p_duo2}}.',
    ],
    note: 'Duoly reviews every Marvel Rivals teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Marvel Rivals session fits you?',
    intro:
      'The right Rivals session is the one matching your goal for the evening. First, Quick Match and Arcade stay flat at every rank, {{p_quick}} per match. Competitive is priced by your own rank, from {{p_duo2_low}} per match on Duo Pro, and a 6-stack fill is priced per seat instead. For example, 3 matches take {{pct3}} off and 5 matches take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
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
          '6-Stack Fill covers up to {{seats_six}} seats for {{p_six}} per match, with Grandmaster+ players on each one.',
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
        'The teammate you queue with is a reviewed Marvel Rivals player who applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player, Duo Pro a Grandmaster+ player and Duo Apex a Celestial+ player at {{p_duo3}} per match, which is the top tier Duoly sells for the game. Orders are not auto-assigned: a teammate picks yours up from the queue, so the person who accepts chose your request. Nobody from Duoly ever logs into your account.',
        'What the rank buys is fight discipline. A Grandmaster+ teammate tracks the enemy ultimates and calls the reset instead of walking in alone, so the dive lands before a cooldown returns. Voice runs using Discord for exactly that reason. Rank also sets the price: Duo Pro costs {{p_duo2_low}} per match at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Bundles cut the total by {{pct3}} on 3 matches and {{pct5}} on 5. For example, you keep your hero and your account in all 3 matches.',
      ],
    },
    {
      heading: 'What does a 6-stack fill include in Marvel Rivals?',
      paragraphs: [
        'A 6-stack fill is 6-Stack Fill: Duoly hires Grandmaster+ players for the seats your group is missing, up to {{seats_six}} seats at {{p_six}} per match. Marvel Rivals Competitive is 6v6, so the fill is how a trio or a four becomes a full team on one order. Every seat is priced on its own, so a trio short 3 players books 3 seats rather than 5. For example, a group with two Duelists and no Strategist books one seat and keeps its own front line.',
        'The fill starts like any other order. Pick the service, pick the seat count, pay once, then meet everybody in the order chat. Name the platform, the roles you already cover and the evening you want to play, so the hired players arrive knowing the gaps. Voice runs using Discord, invites go out by username, and nobody needs your login. Team-Up Duo is the two-player format built around one hero pairing at {{p_teamup}} per match, and Quick Match and Arcade cost {{p_quick}}.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro matches in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} Strategist in Europe books 3 Duo Pro matches with a Grandmaster teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one match. Competitive is 6v6, so the booked teammate takes 1 of the 6 seats and the other 4 arrive from the party or the normal queue. The order chat opens straight after payment, and the first message names the region, the rank and the role: Europe, {{rank_duo2}}, Strategist, looking for a Vanguard who holds the front line.',
        'From there the evening runs on a short plan. You agree a hero pair and a Team-Up to try, voice goes on, and the invite goes out by username. After each match you pick one adjustment, for example holding the ultimate for the second push instead of spending it on the first contest, agreed using Discord. Three matches usually fill about 75 minutes, and 5 matches take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Marvel Rivals coaching the better booking?',
      paragraphs: [
        'Marvel Rivals coaching is the better booking when the goal is a repeatable fix rather than company for the next match. A duo teammate answers a quick question between fights. A coach pauses the clip, names the pattern and leaves you with homework. Hero Coaching costs {{p_hero}} per hour, and coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate matches only.',
        'First, name the habit you keep repeating. For example, a player who keeps dying right after the ultimate gains more from one hero hour at {{p_hero}} than from a fourth Competitive match. A player who wants a relaxed evening gains more from Quick Match and Arcade at {{p_quick}} per match in 2026. Play and Learn is one live Competitive match with a Grandmaster+ coach at {{p_learn}}, and screen share runs using Discord. The full lesson list lives on the [Marvel Rivals coaching page](/games/marvel-rivals/coaching), and the two-player side is covered on the [Marvel Rivals duo partner](/games/marvel-rivals/duo-partner) page. [Overwatch 2 teammates](/games/overwatch-2) and [Deadlock teammates](/games/deadlock) are the other hero shooters here.',
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
        'How do I book a full Marvel Rivals six?',
        '6-Stack Fill hires Grandmaster+ players for up to {{seats_six}} seats at {{p_six}} per match, and you set the seat count to the gaps your group actually has.',
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
    text: 'Duo Pro is the Competitive tier with a Grandmaster+ teammate from Duoly. Three matches at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 matches take {{pct5}} off. Quick Match stays {{p_quick}} per match at any rank, and Team-Up Duo costs {{p_teamup}}. 6-Stack Fill hires Grandmaster+ players for up to {{seats_six}} seats at {{p_six}} per match when you want a complete six in 2026. For example, agree your hero pair using Discord before the first queue.',
  },
};
