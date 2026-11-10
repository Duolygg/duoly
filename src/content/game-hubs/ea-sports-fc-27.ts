import type { HubPageCopy } from '../hub-pages';

export const eaSportsFc27: HubPageCopy = {
  gameSlug: 'ea-sports-fc-27',
  title: 'EA FC 27 Co-op: Find a Rivals Partner | Duoly',
  description:
    'Book an EA SPORTS FC 27 Co-op Rivals partner, a Clubs lineup or tactics coaching on Duoly, {{from_lower}}. Compare every FC 27 price.',
  eyebrow: 'EA SPORTS FC 27 partners',
  h1: 'EA FC 27 co-op: find a Rivals partner tonight',
  lead: 'Free LFG Discords work for finding a club mate. Duoly books a reviewed Division 1 or Elite partner for your next Co-op Rivals games, fills a Clubs lineup and sells tactics coaching.',
  cta: 'Book an FC 27 partner',
  facts: [
    'Division 1+ and Elite partners',
    'Co-op Rivals, Clubs and friendlies',
    'Voice on Discord, your own account',
  ],
  related: [
    'minecraft',
    'arc-raiders',
    'world-of-warcraft',
    'rocket-league',
    'fortnite',
  ],
  format: {
    heading: 'What can you book for EA SPORTS FC 27 on Duoly?',
    text: 'An EA SPORTS FC 27 booking on Duoly is a single reviewed partner, a Clubs Lineup or a coaching hour. Co-op Rivals is the 2v2 side of Division Rivals and follows your own division, from {{p_duo2_low}} to {{p_duo2_high}} per game, while Co-op Elite brings an Elite-level partner from {{p_duo3_low}}. Casual games keep one flat price at every division, so Kick-Off and Friendlies costs {{p_kickoff}} per game and a Practice Match costs {{p_friendly}}. Bundles of {{main}} cut the total, {{bundles}}. The fill: Clubs Lineup hires Division 1+ players for up to {{seats_clubs}} seats at {{p_clubs}} per game, so a half-full club gets a real eleven. Lessons cost {{p_tactics}} per hour on tactics and squad building. Name your platform using Discord first.',
  },
  services: {
    duo2: 'Co-op Rivals with a Division 1 partner who links up, tracks back and talks you through it.',
    duo3: 'Co-op Rivals with an Elite-level partner for the top divisions and weekend form.',
    friendly:
      'An online friendly against an Elite player who tells you what to fix afterwards.',
    kickoff: 'Couch-style friendlies on the same team, purely for fun.',
    gg1v1:
      'An online friendly against a verified Gamer Girl, you against her, rematches welcome.',
    ggbuddy:
      'A patient Gamer Girl plays Kick-Off or friendlies and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    clubs:
      'Fill your Clubs team with players who hold their position and actually pass.',
    tactics:
      'One hour on formations, custom tactics and a squad that fits how you play.',
    champs:
      'One hour of weekend-league prep: mindset, defending and the meta, practiced live.',
  },
  intros: {
    teammate:
      'Partner prices are per game, and the two Co-op Rivals tiers read your own division: Co-op Rivals costs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}. Kick-Off and Friendlies, the Practice Match and the Gamer Girl sessions hold one price for everybody, because none of them touch your Rivals record. Pick the mode, because the mode decides whether the division list on a card matters. Read the partner tier beside the price: Co-op Rivals names a Division 1+ partner and Co-op Elite an Elite-level one from {{p_duo3_low}} per game. Only {{main}} is sold in bundles, {{bundles}}, and every other service books {{picker}}. Agree a formation using Discord before game 1.',
    team: 'A Clubs Lineup is one order that hires several players at once, so a half-full club gets a real eleven. The card covers up to {{seats_clubs}} seats at {{p_clubs}} per game, and 5 games cost {{p_clubs_x5}} with {{pick5}} off. Count the seats you actually need, because every seat is priced on its own: a club short 2 players books 2 seats rather than 5. The price is flat rather than division-priced, because a Clubs match reads your club rather than your Rivals division. Name the positions, because an eleven wants a defence and a midfield rather than four strikers. Ask for a centre back and a holding midfielder using Discord.',
    coaching:
      'Lessons are priced by the hour and get no quantity or bundle discount at all, so the {{pct3}} to {{pct10}} bundle savings on partner games stop here. Tactics and Squad Builder and Champions Prep each cost {{p_tactics}} per hour, one on formations and custom tactics, the other on weekend-league defending and the current meta. Pick the problem rather than the format. For example, a player who concedes the same counter attack books the tactics hour instead of a fourth Rivals game from {{p_duo2_low}}. Screen share runs using Discord, and no lesson from Duoly promises a division.',
  },
  steps: {
    heading: 'How does booking an FC 27 partner work?',
    items: [
      'Pick a service and the number of games first. Co-op Rivals is the 2v2 tier with a Division 1+ partner, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five games take {{pct5}} off.',
      'Add your area, division, platform and language at checkout. Name Europe, {{rank_duo2}} and PlayStation, so your partner reads the real request before accepting.',
      'Meet your partner in the order chat using Discord. Agree a formation, who drops deep and how voice runs, then add each other by EA ID and send the co-op invite. One Co-op Elite game costs {{p_duo3}} at {{rank_duo3}}.',
    ],
    note: 'Duoly reviews every FC 27 partner before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which EA FC 27 session fits you?',
    intro:
      'The right FC 27 session is the one matching your goal for the evening. Kick-Off, friendlies and the Practice Match keep one flat price for everybody. Co-op Rivals and Co-op Elite are priced by your own division, from {{p_duo2_low}} per game, and a Clubs Lineup is priced per seat instead. A {{main}} bundle takes {{bundles}}, so a bundle beats booking 1 at a time. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing Co-op Rivals?',
        service: 'duo2',
        answer:
          'Co-op Rivals adds a Division 1+ partner from {{p_duo2_low}} per game, priced by your own division.',
      },
      {
        goal: 'Already in the top divisions?',
        service: 'duo3',
        answer:
          'Co-op Elite brings an Elite-level partner who defends properly, {{p_duo3}} at {{rank_duo3}}.',
      },
      {
        goal: 'Want honest feedback on your play?',
        service: 'friendly',
        answer:
          'Practice Match costs {{p_friendly}} and puts you against an Elite opponent who debriefs after.',
      },
      {
        goal: 'Short of players for Clubs?',
        service: 'clubs',
        answer:
          'A Clubs Lineup covers up to {{seats_clubs}} seats for {{p_clubs}} per game.',
      },
      {
        goal: 'Tactics never feel right?',
        service: 'tactics',
        answer:
          'Tactics and Squad Builder is one hour on formations and your squad, for {{p_tactics}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'What does a Co-op Rivals partner actually do?',
      paragraphs: [
        'A Co-op Rivals partner is the second player on your team in the 2v2 side of Division Rivals, where defensive shape decides far more games than skill moves do. A Division 1+ partner tracks back, holds the line and passes into space instead of chasing every ball. A good partner also talks: who steps to the ball, who covers the channel, when to stop pressing. Agree the split and a corner rule using Discord before kick-off.',
        'Division pricing follows your own rank: {{rank_duo2_low}} players pay {{p_duo2_low}} per game and {{rank_duo2_high}} players pay {{p_duo2_high}}. Co-op Elite sits above both at {{p_duo3}} for {{rank_duo3}} in 2026. Keep the calls short once the whistle goes, and name the next pass rather than reviewing the last one. Bundles of {{main}} take {{bundles}}, so a bundle beats booking 1. Practice Match is the honest alternative at {{p_friendly}} when you want feedback rather than points.',
      ],
    },
    {
      heading: 'What does a Clubs Lineup booking include?',
      paragraphs: [
        'A Clubs Lineup is one order that hires several Division 1+ players at once, so a half-full club gets a real eleven. The card covers up to {{seats_clubs}} seats at {{p_clubs}} per game, and 5 games cost {{p_clubs_x5}} with {{pick5}} off. Count the seats, because every seat is priced on its own, so a club short 2 players books 2 rather than 5. Ask for a centre back and a holding midfielder rather than 2 more wingers.',
        'Co-op Rivals is the two-player shape instead, at {{p_duo2}} per game at {{rank_duo2}}, with Co-op Elite bringing an Elite-level partner from {{p_duo3_low}}. Kick-Off and Friendlies carries no division at all and costs {{p_kickoff}} per game, which makes it the calm first session with somebody new. The order chat is where you name your platform, your formation and who takes set pieces, with voice using Discord before kick-off.',
      ],
    },
    {
      heading: 'Example evening: three Co-op Rivals games in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe books 3 Co-op Rivals games with a Division 1 partner. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. Co-op Rivals is 2v2, so the booked partner is the whole other half of your team. The order chat opens straight after payment, and the first message names the area, the division and the platform: Europe, {{rank_duo2}}, PlayStation, looking for a partner who defends and lets the wing run.',
        'From there the evening runs on a short plan. You agree a formation and who drops deep, voice goes on, and the co-op invite goes out from your friends list. After each game you pick one adjustment, for example holding the line instead of pressing the keeper, agreed using Discord. The same shape works for Kick-Off and Friendlies at {{p_kickoff}} per game, and 5 games take {{pick5}} off.',
      ],
    },
    {
      heading: 'When is FC 27 coaching the better booking?',
      paragraphs: [
        'FC 27 coaching is the better booking when the goal is a repeatable fix rather than a partner for the next game. Tactics and Squad Builder and Champions Prep each cost {{p_tactics}} per hour, one on formations and custom tactics, the other on weekend-league defending and the current meta. Coaching carries no quantity or bundle discount, so the {{pct3}} to {{pct10}} bundle savings apply to partner games only.',
        'Name the goal you keep conceding. For example, a player who concedes the same counter attack gains more from one tactics hour at {{p_tactics}} than from a fourth Rivals game, because the fix lives in the shape. A player who only wants a relaxed evening gains more from Kick-Off and Friendlies at {{p_kickoff}} per game in 2026. EA SPORTS FC 27 has no separate coaching page on Duoly yet, so lessons are booked from the prices above, with screen share using Discord. The nearest neighbours here are [Rocket League teammates](/games/rocket-league), football with rocket cars, and [Minecraft teammates](/games/minecraft) for an evening with nothing on the line.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about EA FC 27 sessions?',
    items: [
      [
        'Is Duoly a free FC 27 teammate finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from EA are the free routes, so try those first.',
      ],
      [
        'How much does a Co-op Rivals partner cost?',
        'Co-op Rivals is {{p_duo2}} per game at {{rank_duo2}}, and {{p_duo2_low}} at the lowest division. Ten games cost {{p_duo2_x10}} with {{pct10}} off in 2026.',
      ],
      [
        'Can any division play co-op together?',
        'Clubs Lineup hires Division 1+ players for up to {{seats_clubs}} seats at {{p_clubs}} per game, and you set the seat count to the gaps your club actually has.',
      ],
      [
        'Is this Ultimate Team coin farming?',
        'No: Duoly sells playing time with a reviewed partner on your own account, never coins, accounts or anything else against the rules from EA.',
      ],
      [
        'Can I play against a partner instead?',
        'Yes: Practice Match costs {{p_friendly}} and puts you against an Elite opponent who plays a full online friendly and then debriefs, with voice using Discord.',
      ],
      [
        'Does a Clubs Lineup fill the whole team?',
        'A lineup covers up to {{seats_clubs}} hired seats, for example 2 of 5, so a club short two players keeps the rest of the squad.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for kick-off in EA FC 27?',
    text: 'Co-op Rivals is the 2v2 session with a Division 1+ partner from Duoly. Three games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off, and 5 games take {{pct5}} off. Kick-Off and Friendlies stays {{p_kickoff}} per game at any division, and a Practice Match costs {{p_friendly}}. Clubs Lineup hires Division 1+ players for up to {{seats_clubs}} seats at {{p_clubs}} per game when you want an eleven in 2026. Agree the formation using Discord.',
  },
};
