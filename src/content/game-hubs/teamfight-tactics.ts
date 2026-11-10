import type { HubPageCopy } from '../hub-pages';

export const teamfightTactics: HubPageCopy = {
  gameSlug: 'teamfight-tactics',
  title: 'TFT Double Up Partners, Duos and Coaching | Duoly',
  description:
    'Book a Teamfight Tactics Double Up partner, a duo or a live board coach on Duoly, {{from_lower}}. Compare every TFT session price.',
  eyebrow: 'Teamfight Tactics partners',
  h1: 'Book TFT Double Up partners, duos or coaching',
  lead: 'Free LFG Discords work for finding a Double Up buddy. Duoly books a reviewed Master+ partner for your next games, or a Master+ player who watches your board live and tells you what to roll.',
  cta: 'Book a TFT session',
  facts: [
    'Master+ partners and coaches',
    'Double Up, Normals and Hyper Roll',
    'Voice on Discord, your own account',
  ],
  related: [
    'league-of-legends',
    'wild-rift',
    'dota-2',
    'pokemon-unite',
    'world-of-warcraft',
  ],
  format: {
    heading: 'What can you book for Teamfight Tactics on Duoly?',
    text: 'A Teamfight Tactics booking on Duoly is a Double Up partner, a live Board Coach or a comp and econ review. Double Up puts a Master+ partner on the second board of your team of two, priced by your own rank from {{p_duo1_low}} to {{p_duo1_high}} per game. Board Coach keeps one flat price of {{p_duo2}} per game, and Normals and Hyper Roll cost {{p_norm}} at every rank. Bundles of {{main}} cut the total, {{bundles}}. The lesson: Comp and Econ Review is one hour with a Master+ coach at {{p_econ}}, on comps, roll timing and gold from stage two onward. Name your server and comps using Discord first.',
  },
  services: {
    duo1: 'Double Up with a Master+ partner: plan both boards and send help at the right moment.',
    duo2: 'Your own ranked game with a Master+ player who calls every buy, roll and position live.',
    norm: 'Fast, casual lobbies together in Normals or Hyper Roll, with no LP on the line.',
    gg1v1:
      'A head-to-head in the same lobby against a verified Gamer Girl: higher placement wins.',
    ggbuddy:
      'A patient Gamer Girl plays Normals or Hyper Roll and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and keeps the mood up after a loss.',
    econ: 'One hour on comps that suit you, roll and level timing, and gold from stage two.',
  },
  intros: {
    teammate:
      'Session prices are per game, and only Double Up reads your own rank: {{rank_duo1_low}} players pay {{p_duo1_low}} per game and {{rank_duo1_high}} players pay {{p_duo1_high}}. Board Coach holds one price for everybody at {{p_duo2}}, and so do the casual lobbies at {{p_norm}} and every Gamer Girl session. Pick the mode, because the mode decides whether the rank list on a card matters. Read what the card actually buys: Double Up puts a Master+ partner on the second board of your team of two, while Board Coach puts a Master+ player on your own board as a live caller. Only {{main}} is sold in bundles, {{bundles}}, and every other service books {{picker}}. For example, agree the contested line using Discord before game 1.',
    coaching:
      'The review is priced by the hour and gets no quantity or bundle discount at all, so the {{pct3}} to {{pct10}} bundle savings on {{main}} stop here. Comp and Econ Review costs {{p_econ}} per hour and is the slower, structured option: comps that suit how you play, when to roll, when to level, and gold management from stage two onward. Pick the problem rather than the format. For example, a player who finishes fifth in every lobby books the review hour instead of a fourth Double Up game from {{p_duo1_low}}. Screen share runs using Discord, and no lesson from Duoly promises a rank.',
  },
  steps: {
    heading: 'How does booking a TFT session work?',
    items: [
      'Pick a service and the number of games first. Double Up is the two-player mode with a Master+ partner, and 5 games at {{rank_duo1}} cost {{p_duo1_x5}} with {{pick5}} off in November 2026. Five games take {{pct5}} off.',
      'Add your server, rank and language at checkout. For example, name EUW and {{rank_duo1}}, so your partner reads the real request and knows which lobby strength to expect.',
      'Meet your partner in the order chat using Discord. Agree who takes the contested line and how voice runs, then add each other by Riot ID. Board Coach costs {{p_duo2}} per game with live screen share.',
    ],
    note: 'Duoly reviews every TFT partner before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which TFT session fits you?',
    intro:
      'The right TFT session is the one matching your goal for the evening. Board Coach, Normals and Hyper Roll keep one flat price for everybody, {{p_duo2}} and {{p_norm}} per game. Double Up follows your own rank instead, from {{p_duo1_low}} per game, and the review hour is priced by the clock at {{p_econ}}. A {{main}} bundle takes {{bundles}}, so a bundle beats booking 1 at a time. Screen share runs using Discord.',
    picks: [
      {
        goal: 'Want a real Double Up partner?',
        service: 'duo1',
        answer:
          'Double Up pairs you with a Master+ player who plans both boards, from {{p_duo1_low}} per game.',
      },
      {
        goal: 'Want someone calling your rolls?',
        service: 'duo2',
        answer:
          'Board Coach costs {{p_duo2}} per game, with a Master+ player watching your screen live.',
      },
      {
        goal: 'Just want casual lobbies?',
        service: 'norm',
        answer:
          'Normals and Hyper Roll costs {{p_norm}} per game at every rank, with no LP on the line.',
      },
      {
        goal: 'Keep misplaying your economy?',
        service: 'econ',
        answer:
          'Comp and Econ Review is one hour with a Master+ coach for {{p_econ}}.',
      },
      {
        goal: 'New to the set?',
        service: 'ggbuddy',
        answer:
          'New Player Buddy pairs you with a patient Gamer Girl for {{p_ggbuddy}} per game.',
      },
    ],
  },
  sections: [
    {
      heading: 'What is a TFT Double Up booking?',
      paragraphs: [
        'A TFT Double Up booking is one Master+ partner on the second board of your team of two, for the games you choose. Double Up is the Riot Games mode where two boards share a placement and can send units, gold or items across, so a booked partner plays beside you rather than for you. The price follows your own rank: {{rank_duo1_low}} players pay {{p_duo1_low}} per game and {{rank_duo1_high}} players pay {{p_duo1_high}}. For example, 5 games at {{rank_duo1}} cost {{p_duo1_x5}} with {{pick5}} off.',
        'Board Coach is the other live service at a flat {{p_duo2}} per game. There a Master+ player watches your own board and calls what to buy, roll and position while the lobby happens, so nobody joins your game. Normals and Hyper Roll is the casual option at {{p_norm}} per game, with no LP on the line. Every booking opens an order chat where you name the server, the set and the comps you like, with screen share using Discord.',
      ],
    },
    {
      heading: 'Double Up or Board Coach: which TFT booking helps more?',
      paragraphs: [
        'Double Up is the two-player mode where both players run a board and can send units, gold or items across. A Master+ partner takes the aggressive line while you play the safer one, and the pair places together, so the help arrives inside the game rather than after. Five games at {{rank_duo1}} cost {{p_duo1_x5}} with {{pick5}} off, and 5 games take {{pick5}} off. For example, one partner commits to the contested comp while the other scouts the lobby using Discord.',
        'Board Coach is the other shape of help, and the one to pick when the goal is learning rather than placement. You play a personal ranked game while a Master+ player watches your screen and says what to buy, roll and position in real time, at a flat {{p_duo2}} per game in 2026. A player who always rolls at the wrong level hears the call in the moment instead of reading a replay 3 days later. Pick the goal first and the mode second, then agree whether the evening is for LP or for learning, because the two lines diverge at stage four.',
      ],
    },
    {
      heading: 'Example evening: three Double Up games on EUW',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo1}} player on EUW books 3 Double Up games with a Master partner. The total is {{p_duo1_x3}}, three times {{p_duo1}} for one game, because the discount starts at 5 games. Double Up shares one placement between the two boards, so the pair finishes the lobby together. The order chat opens straight after payment, and the first message names the server, the rank and the weakness: EUW, {{rank_duo1}}, keeps levelling too late, wants help reading the lobby.',
        'From there the evening runs on a short plan. You agree who commits to the contested comp, voice goes on, and you add each other by Riot ID. After each game you pick one adjustment, for example rolling at level 7 instead of 8, agreed using Discord. The same shape works for Normals and Hyper Roll at {{p_norm}} per game with no LP on the line, and 5 games take {{pick5}} off.',
      ],
    },
    {
      heading: 'When is TFT coaching the better booking?',
      paragraphs: [
        'TFT coaching is the better booking when the goal is a repeatable fix rather than a partner for the next lobby. Comp and Econ Review is one hour with a Master+ coach at {{p_econ}}, covering comps that suit how you play, roll and level timing, and gold from stage two. Coaching carries no quantity or bundle discount, so the {{pct3}} to {{pct10}} bundle savings apply to {{main}} only.',
        'Name the placement you keep repeating. For example, a player who finishes fifth in every lobby gains more from one review hour at {{p_econ}} than from a fourth Double Up game, because fifth place is usually one economy habit. A player who mostly wants company gains more from Normals and Hyper Roll at {{p_norm}} per game in 2026. Set rotations from Riot Games change the comps every few months, so say which set you have been playing. The full lesson list and formats live on the [Teamfight Tactics coaching page](/games/teamfight-tactics/coaching), with screen share using Discord. [League of Legends teammates](/games/league-of-legends) and [Wild Rift teammates](/games/wild-rift) are the other Riot games Duoly sells.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about TFT sessions?',
    items: [
      [
        'Is Duoly a free TFT partner finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from Riot Games are the free routes, so try those first.',
      ],
      [
        'How much does a TFT session cost?',
        'Double Up is {{p_duo1}} per game at {{rank_duo1}}, and {{p_duo1_low}} at the lowest rank. Five games cost {{p_duo1_x5}} with {{pick5}} off in 2026.',
      ],
      [
        'What does a Double Up booking actually add?',
        'One Master+ partner on the second board of your team of two, for the games you book. The pair shares a placement and can send units, gold and items across.',
      ],
      [
        'Is there a session where nobody joins my game?',
        'Yes: Board Coach is {{p_duo2}} per game and Comp and Econ Review is {{p_econ}} per hour. In both, a Master+ player works on your own board rather than a second one.',
      ],
      [
        'What is Board Coach exactly?',
        'Board Coach is a live session at {{p_duo2}} per game where you play your own ranked game and a Master+ player watches your screen using Discord, calling buys and rolls.',
      ],
      [
        'Does my partner play on my account?',
        'No: you play on your own account and add each other by Riot ID, for example before game 1. Never send login details to anyone.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next TFT lobby?',
    text: 'Double Up is the two-player session with a Master+ partner from Duoly. Five games at {{rank_duo1}} cost {{p_duo1_x5}} with {{pick5}} off, and 5 games take {{pick5}} off. Normals and Hyper Roll stays {{p_norm}} per game with no LP on the line, and Board Coach costs {{p_duo2}}. Comp and Econ Review is the hour for comps, roll timing and gold from stage two, at {{p_econ}} in 2026. For example, pick your server, then agree the plan using Discord.',
  },
};
