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
  related: ['deadlock', 'league-of-legends', 'wild-rift', 'world-of-warcraft'],
  format: {
    heading: 'What can you book for Dota 2 on Duoly?',
    text: 'Duoly sells three things for Dota 2: one teammate who joins your party on your own account, a Ranked 5-Stack fill for the seats you are missing, and coaching by the hour. Duo Plus brings an Ancient+ player who lanes with you, Duo Pro a Divine player who calls smokes and Roshan, and Duo Apex an Immortal player for your hardest lobbies. Ranked follows your own medal, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro, while Turbo stays {{p_turbo}} per game at every medal. Bundles cut the total, {{pct3}} off 3 games up to {{pct10}} off 10. Name your position in the order chat so your teammate drafts around it.',
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
      'Teammate prices are per game, and the ranked tiers read your own medal, so an Immortal lobby costs more than a Herald one. Turbo and unranked All Pick hold one price for everybody, because neither moves your rank. One teammate joins your party on your own account and plays the position you ask for, and bundles take {{pct3}} off 3 games or {{pct5}} off 5. A tier name says who Duoly hires, never who may queue beside you: Duoly has not read the party rules from Valve for this hub yet, so the teammate has to be eligible to queue with you under the rules of the game. Check the party in the client before the first game.',
    team: 'Ranked 5-Stack is priced per seat, so the card covers up to {{seats_party5}} seats and falls when your party is only one player short. It reads your medal like the duo tiers, and bundles take {{pct3}} off 3 games.',
    coaching:
      'Lessons are priced by the hour and get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate sessions do not apply. Replay Review and Hero and Position Coaching are clock hours on Discord, and Play and Learn is the exception that covers one live ranked game instead.',
  },
  steps: {
    heading: 'How does booking a Dota 2 teammate work?',
    items: [
      'Pick a service and the number of games. Duo Pro is the ranked tier with a Divine teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five games take {{pct5}} off.',
      'Add your region, medal, position and language at checkout. Name Europe West, {{rank_duo2}} and position 4, so your teammate reads the real request before accepting the order.',
      'Meet your teammate in the order chat, agree the lane and the draft, then add each other on Steam and queue together. A single Duo Pro game costs {{p_duo2}} at the same medal.',
    ],
    note: 'Duoly reviews every Dota 2 teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Dota 2 session fits you?',
    intro:
      'The right Dota session is the one that matches your goal for the evening, so pick the goal first and let the price follow. Ranked is priced by your own medal, from {{p_duo2_low}} per game on Duo Pro, with {{pct3}} off 3 games and {{pct5}} off 5. Turbo carries no rank at all.',
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
        'Every Duoly Dota 2 teammate applied for the game and showed a medal before taking orders. Duo Plus names an Ancient+ player, Duo Pro a Divine player and Duo Apex an Immortal player. The tier describes the teammate you are hiring, not your own lobby, which matchmaking still builds around both of your ranks. Tell your teammate your medal and your best heroes in the order chat, so the draft starts from what you actually play.',
        'What the medal buys you is decisions. A Divine teammate calls the smoke before the enemy carry finishes the item, stacks the camp at the right minute and says when Roshan is safe. Voice runs on Discord, so the call lands while the fight is still winnable. Your medal also sets the price: Duo Pro runs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. You keep your account and your MMR.',
      ],
    },
    {
      heading: 'How does a Ranked 5-Stack fill work?',
      paragraphs: [
        'A Ranked 5-Stack is one order that hires several players at once, so a part-full party becomes a complete five. The fill covers up to {{seats_party5}} empty seats with Divine+ players at {{p_party5}} per game at {{rank_party5}}, and 5 games cost {{p_party5_x5}} with {{pick5}} off. Every seat is priced separately, so a party short two players sets the seats to two instead of four.',
        'Agree the positions before the draft: name who plays carry, mid and offlane, and who supports. Then agree one shotcaller, because five people calling smokes on voice is how a won game gets thrown. Keep everybody on one Discord call from the draft to the throne. Bundles still apply, {{pct3}} off 3 games and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games in Europe West',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo2}} player in Europe West books 3 Duo Pro games with a Divine teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. The order chat opens straight after payment, and the first message names the region, the medal and the position: Europe West, {{rank_duo2}}, position 4 support, looking for a carry who farms well.',
        'From there the evening runs on a short plan. You agree a lane and two heroes each, voice goes on, and the party invite goes out on Steam. After each game you pick one change, such as smoking for the enemy jungle before the ten minute mark instead of waiting in lane. Five games take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Dota 2 coaching the better booking?',
      paragraphs: [
        'Dota 2 coaching is the better booking when the goal is a fix you can repeat, not company for the next game. Replay Review is one hour with an Immortal coach on your own match, at {{p_replay}} per hour, and Hero and Position Coaching spends the hour on one hero or position at {{p_hero}}. Coaching carries no bundle discount.',
        'A player who dies in the same lane every game gains more from one replay hour than from three more ranked games. A player who wants to try a new hero gains more from Turbo at {{p_turbo}} per game. Play and Learn is one live ranked game with a Divine coach at {{p_learn}}, and screen share runs on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Dota 2 sessions?',
    items: [
      [
        'Is Duoly a free Dota 2 teammate finder?',
        'No. Duoly is a paid marketplace with reviewed players. Party finder channels and your Steam friends list stay the free routes to a regular stack.',
      ],
      [
        'How much does a Dota 2 teammate cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}}, from {{p_duo2_low}} at the lowest medal. Bundles take {{pct3}} off 3 games, and 10 games cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Can I choose my position?',
        'Yes. Pick carry, mid, offlane, soft support or hard support at checkout, or leave it on Fill, and your teammate plays around it.',
      ],
      [
        'Does my teammate play on my account?',
        'No. Your teammate plays on their own account in your party, and you play on yours. Nobody asks for your Steam login.',
      ],
      [
        'Is Turbo cheaper than ranked?',
        'Yes. Turbo is {{p_turbo}} per game at every medal, because it does not move your rank. Ranked prices follow your medal.',
      ],
      [
        'Does a teammate booking fill my whole party?',
        'No. A duo adds one teammate, and the other seats come from your friends or the normal queue. Book a Ranked 5-Stack when you want several at once.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next Dota 2 game?',
    text: 'Duo Pro is the ranked tier with a Divine teammate from Duoly, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Turbo stays {{p_turbo}} per game at any medal. Agree your positions on Discord before the draft.',
  },
};
