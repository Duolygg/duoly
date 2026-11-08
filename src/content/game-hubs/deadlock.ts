import type { HubPageCopy } from '../hub-pages';

export const deadlock: HubPageCopy = {
  gameSlug: 'deadlock',
  title: 'Deadlock Teammates: Ranked Duos and Coaching | Duoly',
  description:
    'Book a Deadlock teammate for ranked, a full six or macro coaching on Duoly, {{from_lower}}. Compare ranked and unranked prices.',
  eyebrow: 'Deadlock teammates',
  h1: 'Deadlock teammates for ranked and coaching',
  lead: 'Discord LFG channels work for meeting a regular group. Duoly books a reviewed Oracle, Phantom or Ascendant player for your next ranked matches, fills a full six and sells macro coaching.',
  cta: 'Book a Deadlock teammate',
  facts: [
    'Oracle+ to Ascendant+ teammates',
    'Ranked and unranked matches',
    'Voice on Discord, your own account',
  ],
  related: ['dota-2', 'overwatch-2', 'marvel-rivals', 'world-of-warcraft'],
  format: {
    heading: 'What can you book for Deadlock on Duoly?',
    text: 'Duoly sells three things for Deadlock: one teammate who joins your party on your own account, a 6-Stack Fill for the seats you are missing, and coaching. Duo Plus brings an Oracle+ player who lanes with you, Duo Pro a Phantom player who calls Urn runs and Mid Boss, and Duo Apex an Ascendant or Eternus player. Ranked follows your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro, while unranked matches stay {{p_unranked}} per game at every rank. Bundles cut the total, {{pct3}} off 3 games up to {{pct10}} off 10.',
  },
  services: {
    duo1: 'Ranked with an Oracle player who lanes with you and secures souls.',
    duo2: 'Ranked with a Phantom player who calls Urn runs, Mid Boss and rotations.',
    duo3: 'Ranked with an Ascendant or Eternus player who wins fights on their own.',
    unranked:
      'Unranked matches to learn a new hero or the map with someone covering you.',
    gg1v1: 'A lane duel 1v1 against a verified Gamer Girl in a private lobby.',
    ggbuddy:
      'A patient Gamer Girl plays with you and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and cheers every play.',
    six: 'Fill your six with Phantom+ players who know their heroes and lanes.',
    learn:
      'One live ranked match with a Phantom coach explaining every decision out loud.',
    macro:
      'One hour on farming patterns, soul economy, item timings and rotations.',
  },
  intros: {
    teammate:
      'Teammate prices are per game, and the ranked tiers read your own rank, so an Eternus lobby costs more than an Initiate one. Unranked matches hold one price for everybody, because they do not move your rank. One teammate joins your party on your own account, and bundles take {{pct3}} off 3 games or {{pct5}} off 5. A tier name says who Duoly hires, never who may queue beside you: Duoly has not read the party rules from Valve for this hub yet, so the teammate has to be eligible to queue with you under the rules of the game. Check the party in the client before the first game.',
    team: '6-Stack Fill is priced per seat, so the card covers up to {{seats_six}} seats and falls when your party is only one player short. It reads your rank like the duo tiers, and bundles take {{pct3}} off 3 games.',
    coaching:
      'Lessons get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate sessions do not apply. Macro and Souls is one clock hour on Discord, and Play and Learn covers one live ranked match instead.',
  },
  steps: {
    heading: 'How does booking a Deadlock teammate work?',
    items: [
      'Pick a service and the number of games. Duo Pro is the ranked tier with a Phantom teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five games take {{pct5}} off.',
      'Add your area, rank, favourite heroes and language at checkout. Name Europe, {{rank_duo2}} and the heroes you play, so your teammate reads the real request before accepting the order.',
      'Meet your teammate in the order chat, add each other on Steam and queue together. A single Duo Pro game costs {{p_duo2}} at the same rank.',
    ],
    note: 'Duoly reviews every Deadlock teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Deadlock session fits you?',
    intro:
      'The right Deadlock session is the one that matches your goal for the evening, so pick the goal first and let the price follow. Ranked is priced by your own rank, from {{p_duo2_low}} per game on Duo Pro, with {{pct3}} off 3 games and {{pct5}} off 5. Unranked matches carry no rank.',
    picks: [
      {
        goal: 'Climbing ranked this season?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Phantom teammate from {{p_duo2_low}} per game, priced by your own rank.',
      },
      {
        goal: 'Stuck below Ascendant?',
        service: 'duo3',
        answer:
          'Duo Apex brings an Ascendant or Eternus player, {{p_duo3}} per game at {{rank_duo3}}.',
      },
      {
        goal: 'Learning a new hero?',
        service: 'unranked',
        answer:
          'Unranked matches cost {{p_unranked}} each with backup and nothing on the line.',
      },
      {
        goal: 'Want a full six on voice?',
        service: 'six',
        answer:
          '6-Stack Fill covers up to {{seats_six}} seats with Phantom+ players on the heroes you need.',
      },
      {
        goal: 'Always behind on souls?',
        service: 'macro',
        answer:
          'Macro and Souls is one hour with an Ascendant coach, at {{p_macro}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'Every Duoly Deadlock teammate applied for the game and showed a rank before taking orders. Duo Plus names an Oracle+ player, Duo Pro a Phantom player and Duo Apex an Ascendant or Eternus player. The tier describes the teammate you are hiring, not your own lobby, which matchmaking still builds around both of your ranks. Tell your teammate your rank and your heroes in the order chat, so the plan starts from what you actually play.',
        'What the rank buys you is map calls. A Phantom teammate knows when to run the Urn, when Mid Boss is safe and which lane to push next, and spends every quiet minute farming souls. Voice runs on Discord, so the call lands while the fight is still winnable. Your rank also sets the price: Duo Pro runs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. You keep your account and your rank.',
      ],
    },
    {
      heading: 'How does a Deadlock 6-Stack Fill work?',
      paragraphs: [
        'A 6-Stack Fill is one order that hires several players at once, so a part-full party becomes a complete six. The fill covers up to {{seats_six}} empty seats with Phantom+ players at {{p_six}} per game at {{rank_six}}, and 5 games cost {{p_six_x5}} with {{pick5}} off. Every seat is priced separately, so a party short two players books two seats instead of five.',
        'Agree the heroes before the match: who takes which lane, who roams and who carries the late game. Then agree one caller, because six people calling the Patron push on voice is how a won match gets thrown. Keep everybody on one Discord call. Bundles still apply, {{pct3}} off 3 games and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro matches in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A player at {{rank_duo2}} in Europe books 3 Duo Pro games with a Phantom teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one match. The order chat opens straight after payment, and the first message names the area, the rank and the heroes: Europe, {{rank_duo2}}, Haze and Seven, looking to farm better.',
        'From there the evening runs on a short plan. You agree a lane and two heroes each, voice goes on, and the party invite goes out on Steam. After each match you pick one change, such as taking the jungle camps on the way to a fight instead of walking past them. Five games take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Deadlock coaching the better booking?',
      paragraphs: [
        'Deadlock coaching is the better booking when the goal is a fix you can repeat, not company for the next match. Macro and Souls is one hour with an Ascendant coach on farming patterns, soul economy, item timings and rotations, at {{p_macro}} per hour. Coaching carries no bundle discount.',
        'A player who ends every match behind on souls gains more from one macro hour than from three more ranked matches. A player who wants to try a new hero gains more from unranked matches at {{p_unranked}} each. Play and Learn is one live ranked match with a Phantom coach at {{p_learn}}, and screen share runs on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Deadlock sessions?',
    items: [
      [
        'Is Duoly a free Deadlock teammate finder?',
        'No. Duoly is a paid marketplace with reviewed players. Discord LFG channels and your Steam friends list stay the free routes to a regular group.',
      ],
      [
        'How much does a Deadlock teammate cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rank. Bundles take {{pct3}} off 3 games, and 10 games cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Can I ask for a specific hero or lane?',
        'Yes. Name your heroes and lane in the order chat, and your teammate picks heroes that work with yours.',
      ],
      [
        'Does my teammate play on my account?',
        'No. Your teammate plays on their own account in your party, and you play on yours. Nobody asks for your Steam login.',
      ],
      [
        'Why is Deadlock priced per game?',
        'Because a game has a clear start and end. Your teammate stays for the whole game, however long it runs, and bundles cut the price of several.',
      ],
      [
        'Does a teammate booking fill my whole party?',
        'No. A duo adds one teammate, and the other seats come from your friends or the queue. Book a 6-Stack Fill when you want several at once.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next Deadlock match?',
    text: 'Duo Pro is the ranked tier with a Phantom teammate from Duoly, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. Unranked matches stay {{p_unranked}} each at any rank. Agree your heroes on Discord before the match.',
  },
};
