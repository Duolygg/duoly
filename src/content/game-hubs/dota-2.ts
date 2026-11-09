import type { HubPageCopy } from '../hub-pages';

export const dota2: HubPageCopy = {
  gameSlug: 'dota-2',
  title: 'Dota 2 Teammates: Ranked Duos and Coaching | Duoly',
  description:
    'Book a Dota 2 teammate for ranked, a full five-stack or replay coaching on Duoly, {{from_lower}}. Compare ranked and Turbo prices.',
  eyebrow: 'Dota 2 teammates',
  h1: 'Dota 2 teammates for ranked, Turbo and coaching',
  lead: 'Party finder channels work for meeting a regular stack. Duoly books a reviewed Ancient, Divine or Immortal player for your next ranked games, fills a full five and sells replay and hero coaching.',
  cta: 'Book a Dota 2 teammate',
  facts: [
    'Ancient+ to Immortal teammates',
    'Ranked, Turbo and unranked All Pick',
    'Voice on Discord, your own account',
  ],
  related: [
    'deadlock',
    'marvel-rivals',
    'overwatch-2',
    'wild-rift',
    'league-of-legends',
  ],
  format: {
    heading: 'What can you book for Dota 2 on Duoly?',
    text: 'A Dota 2 booking on Duoly is one of three things: one teammate who joins your party on your own account, a Ranked 5-Stack fill for the seats you are missing, or coaching by the hour. First, the teammate tiers are Duo Plus with an Ancient+ player who lanes with you, Duo Pro with a Divine player who calls smokes and Roshan, and Duo Apex with an Immortal player at {{p_duo3}} per game. Ranked follows your own medal, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro, while Turbo stays {{p_turbo}} and unranked All Pick {{p_unranked}} at every medal. Second, the fill: Ranked 5-Stack covers up to {{seats_party5}} seats at {{p_party5}} per game. Third, the lessons, {{p_replay}} per hour on your own replay. Bundles cut the total, {{pct3}} off 3 games up to {{pct10}} off 10. For example, name your position in the order chat using Discord so your teammate drafts around it.',
  },
  services: {
    duo1: 'Ranked with an Ancient player who lanes with you, wards and calls when to group.',
    duo2: 'Ranked with a Divine player who calls smokes, Roshan and the next tower.',
    duo3: 'Ranked with an Immortal player who can take over your hardest games.',
    turbo:
      'Turbo games of about 20 minutes, with more gold and quicker respawns.',
    unranked: 'Unranked All Pick to learn a hero or position with backup.',
    gg1v1:
      'A mid lane 1v1 against a verified Gamer Girl, rematches encouraged.',
    ggbuddy:
      'A patient Gamer Girl plays with you and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and cheers every play.',
    party5:
      'Fill your five with Divine+ players in every position, with one shotcaller.',
    learn:
      'One live ranked game with a Divine coach explaining every decision out loud.',
    replay:
      'One hour going through your replay: laning, farm, map moves and items.',
    hero: 'One hour on one hero or position: matchups, builds and farming patterns.',
  },
  intros: {
    teammate:
      'Teammate prices are per game, and the ranked tiers read your own medal, so an Immortal lobby costs more than a Herald one. Turbo and unranked All Pick hold one price for everybody, because neither moves your rank. One teammate joins your party on your own account and plays the position you ask for, and bundles take {{pct3}} off 3 games or {{pct5}} off 5. First, pick the mode, because only the ranked cards carry a medal list. Second, read the tier beside the price: Duo Plus is an Ancient+ player, Duo Pro a Divine player and Duo Apex an Immortal at {{p_duo3}} per game. For example, name carry, mid, offlane or support in the order chat using Discord before the draft.',
    team: 'Ranked 5-Stack is priced per seat, so the card covers up to {{seats_party5}} seats at {{p_party5}} per game and falls when your party is only one player short. First, count the seats you actually need, because a trio short two players books 2 rather than 4. Second, name the positions, because a five wants carry, mid, offlane and both supports covered rather than five cores. The fill reads your medal like the duo tiers do, from {{p_party5_low}} per game, and bundles take {{pct3}} off 3 games and {{pct5}} off 5. For example, a solo player who hates queueing supports books 4 seats and keeps position 1 using Discord.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate sessions do not apply. Replay Review costs {{p_replay}} per hour with an Immortal coach, and Hero and Position Coaching spends the same hour on one hero or one position. Play and Learn is the exception that covers one live ranked game at {{p_learn}} rather than a clock hour. First, pick the problem rather than the format. For example, a player who dies in the same lane every game books Replay Review instead of a fourth ranked game. Finally, screen share runs using Discord, the coach never logs into your account, and no lesson from Duoly promises a medal.',
  },
  steps: {
    heading: 'How does booking a Dota 2 teammate work?',
    items: [
      'First, pick a service and the number of games. Duo Pro is the ranked tier with a Divine teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount in November 2026. Five games take {{pct5}} off.',
      'Second, add your region, medal, position and language at checkout. For example, name Europe West, {{rank_duo2}} and position 4, so your teammate reads the real request before accepting the order.',
      'Finally, meet your teammate in the order chat using Discord. Agree the lane and the draft, then add each other on Steam and queue together. A single Duo Pro game costs {{p_duo2}} at the same medal, and Turbo stays {{p_turbo}}.',
    ],
    note: 'Duoly reviews every Dota 2 teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Dota 2 session fits you?',
    intro:
      'The right Dota session is the one matching your goal for the evening, so pick the goal first and let the price follow. First, Turbo and unranked All Pick hold one price at every medal, {{p_turbo}} and {{p_unranked}} per game. Ranked is priced by your own medal instead, from {{p_duo2_low}} per game on Duo Pro, and a five-stack fill is priced per seat. For example, 3 games take {{pct3}} off and 5 games take {{pct5}} off, so a bundle beats booking 1. Voice runs using Discord.',
    picks: [
      {
        goal: 'Climbing ranked this season?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Divine teammate from {{p_duo2_low}} per game, priced by your medal and calling the map.',
      },
      {
        goal: 'Stuck in Ancient or Divine lobbies?',
        service: 'duo3',
        answer:
          'Duo Apex brings an Immortal player who can carry fights, {{p_duo3}} per game at {{rank_duo3}}.',
      },
      {
        goal: 'Only have half an hour?',
        service: 'turbo',
        answer:
          'Turbo costs {{p_turbo}} per game, with faster gold, quicker respawns and nothing on the line.',
      },
      {
        goal: 'Want a full five on voice?',
        service: 'party5',
        answer:
          'Ranked 5-Stack covers up to {{seats_party5}} seats with Divine+ players in the positions you name.',
      },
      {
        goal: 'Losing the same way every game?',
        service: 'replay',
        answer:
          'Replay Review is one hour with an Immortal coach on your own match, at {{p_replay}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'The teammate you queue with is a reviewed Dota 2 player who applied for the game and showed a medal before taking orders. First, the tiers: Duo Plus names an Ancient+ player, Duo Pro a Divine player and Duo Apex an Immortal player at {{p_duo3}} per game, which is the top tier Duoly sells for the game. Second, orders are not auto-assigned, because a teammate picks yours up from the queue, so the person who accepts chose your request. For example, tell them your medal and your two best heroes in the order chat using Discord, so the draft starts from what you actually play.',
        'What the medal buys you is decisions. A Divine teammate calls the smoke before the enemy carry finishes the item, stacks the camp at the right minute and says when Roshan is safe. Voice runs using Discord, so the call lands while the fight is still winnable. Your medal also sets the price: Duo Pro runs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. Bundles cut that total by {{pct3}} on 3 games and {{pct5}} on 5. For example, you keep your heroes, your decisions and your MMR in all 3 games.',
      ],
    },
    {
      heading: 'How does a Ranked 5-Stack fill work?',
      paragraphs: [
        'A Ranked 5-Stack is one order that hires several players at once, so a part-full party becomes a complete five. First, the fill covers up to {{seats_party5}} empty seats with Divine+ players at {{p_party5}} per game at {{rank_party5}}, and 5 games cost {{p_party5_x5}} with {{pick5}} off. Second, every seat is priced separately, so a party short two players sets the seats to two instead of four. For example, a solo player who only wants to play position 1 books 4 seats and keeps the carry role.',
        'Agree the positions before the draft: name who plays carry, mid and offlane, and who supports. Then agree one shotcaller, because five people calling smokes on voice is how a won game gets thrown. Keep everybody on one call using Discord from the draft to the throne, and nobody ever needs your Steam login. Finally, bundles still apply, {{pct3}} off 3 games and {{pct5}} off 5, read from Duoly checkout in 2026.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games in Europe West',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe West books 3 Duo Pro games with a Divine teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. The order chat opens straight after payment, and the first message names the region, the medal and the position: Europe West, {{rank_duo2}}, position 4 support, looking for a carry who farms well.',
        'From there the evening runs on a short plan. You agree a lane and two heroes each, voice goes on, and the party invite goes out on Steam. After each game you pick one change, for example smoking for the enemy jungle before the ten minute mark instead of waiting in lane, agreed using Discord. Five games take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Dota 2 coaching the better booking?',
      paragraphs: [
        'Dota 2 coaching is the better booking when the goal is a fix you can repeat rather than company for the next game. First, Replay Review is one hour with an Immortal coach on your own match, at {{p_replay}} per hour, covering laning, farm, map moves and items. Second, Hero and Position Coaching spends the same hour on one hero or one position, at {{p_hero}}. Coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to teammate games only.',
        'For example, a player who dies in the same lane every game gains more from one replay hour at {{p_replay}} than from three more ranked games. A player who wants to try a new hero gains more from Turbo at {{p_turbo}} per game, where the clock runs about twenty minutes. Play and Learn is one live ranked game with a Divine coach at {{p_learn}}, and screen share runs using Discord. Finally, Duoly reviews every coach before any order goes live, and nobody needs your Steam login. Its closest neighbours here are [Deadlock teammates](/games/deadlock) and [League of Legends teammates](/games/league-of-legends), both MOBAs with the same objective clock.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Dota 2 sessions?',
    items: [
      [
        'Is Duoly a free Dota 2 teammate finder?',
        'No: Duoly is a paid marketplace with reviewed players, so the party finder channels and your Steam friends list stay the free routes to a regular stack.',
      ],
      [
        'How much does a Dota 2 teammate cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}}, from {{p_duo2_low}} at the lowest medal. Bundles take {{pct3}} off 3 games, and 10 games cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Can I choose my position?',
        'Yes: pick carry, mid, offlane, soft support or hard support at checkout, or leave it on Fill, and your teammate drafts around the position you name using Discord.',
      ],
      [
        'Does my teammate play on my account?',
        'No: your teammate plays on their own account in your party while you play on yours, and nobody from Duoly ever asks for your Steam login.',
      ],
      [
        'Is Turbo cheaper than ranked?',
        'Yes: Turbo is {{p_turbo}} per game at every medal because it does not move your rank, and unranked All Pick is {{p_unranked}}. Ranked prices follow your own medal.',
      ],
      [
        'Does a teammate booking fill my whole party?',
        'No: a duo adds one teammate and the other seats come from your friends or the normal queue, so book a Ranked 5-Stack at {{p_party5}} per game when you want several at once.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next Dota 2 game?',
    text: 'Duo Pro is the ranked tier with a Divine teammate from Duoly, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Five games take {{pct5}} off and 10 games take {{pct10}} off. Turbo stays {{p_turbo}} per game at any medal, and unranked All Pick costs {{p_unranked}}. Ranked 5-Stack hires Divine+ players for up to {{seats_party5}} seats at {{p_party5}} per game when you want the whole party in 2026. For example, pick your medal and position, then agree the lane and the draft in the order chat using Discord.',
  },
};
