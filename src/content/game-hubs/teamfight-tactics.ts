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
  related: ['league-of-legends', 'pokemon-unite', 'marvel-rivals'],
  format: {
    heading: 'What can you book for Teamfight Tactics on Duoly?',
    text: 'Duoly sells three things for Teamfight Tactics: a Double Up partner who runs the second board in your team of two, a Board Coach who watches your own ranked game live and calls every decision, and a comp and econ review by the hour. Double Up is priced by your own rank, from {{p_duo1_low}} to {{p_duo1_high}} per game, while Board Coach keeps one flat {{p_duo2}} per game and Normals and Hyper Roll cost {{p_norm}} at every rank. Bundles cut the total, {{pct3}} off 3 games up to {{pct10}} off 10. Ranked Double Up has no rank limit on who you partner with, so the only things worth agreeing in the order chat are your server, the comps you know and whether the evening is for LP or for learning.',
  },
  services: {
    duo1: 'Double Up with a Master+ partner: plan both boards and send help at the right moment.',
    duo2: 'You play ranked while a Master+ player watches your screen and calls every decision.',
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
      'Session prices are per game, and only Double Up reads your own rank, because matchmaking there runs on the senior player of the pair and a Challenger lobby is a different game from an Iron one. Board Coach and the casual lobbies hold one price for everybody. Bundles are the only other discount, {{pct3}} off 3 games and {{pct5}} off 5.',
    coaching:
      'The review is priced by the hour and gets no bundle discount, so the {{pct3}} and {{pct5}} savings on Double Up and Board Coach do not reach it. Comp and Econ Review is the slower, structured option: it works through the comps that suit how you play, when to roll and when to level, and gold management from stage two onward. Screen share runs on Discord.',
  },
  steps: {
    heading: 'How does booking a TFT session work?',
    items: [
      'Pick a service and the number of games. Double Up is the two-player mode with a Master+ partner, and 3 games at {{rank_duo1}} cost {{p_duo1_x3}} with the {{pct3}} bundle discount. Five games take {{pct5}} off.',
      'Add your server, rank and language at checkout. Name EUW and {{rank_duo1}}, so your partner reads the real request and knows which lobby strength to expect.',
      'Meet your partner in the order chat, agree who takes the contested line and how voice runs, then add each other by Riot ID. Board Coach costs {{p_duo2}} per game with live screen share.',
    ],
    note: 'Duoly reviews every TFT partner before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which TFT session fits you?',
    intro:
      'The right TFT session is the one matching your goal for the evening, so pick the goal first and let the price follow. Double Up follows your own rank, while Board Coach, Normals and Hyper Roll keep one flat price for everybody. Bundles cut totals by {{pct3}} on 3 games and {{pct5}} on 5, and screen share runs on Discord.',
    picks: [
      {
        goal: 'Want a real Double Up partner?',
        service: 'duo1',
        answer:
          'Double Up pairs you with a Master+ player who plans both boards and sends help at the right moment.',
      },
      {
        goal: 'Want someone calling your rolls?',
        service: 'duo2',
        answer:
          'Board Coach costs {{p_duo2}} per game, with a Master+ player watching your screen live on Discord.',
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
          'Comp and Econ Review is one hour with a Master+ coach on rolling, levelling and gold.',
      },
      {
        goal: 'New to the set?',
        service: 'ggbuddy',
        answer:
          'New Player Buddy pairs you with a patient Gamer Girl who explains the basics while you play.',
      },
    ],
  },
  sections: [
    {
      heading: 'Can any rank queue ranked Double Up together?',
      paragraphs: [
        'Yes. Riot Games removed the rank limits from ranked Double Up, so a Master+ partner can queue with you whatever your own rank. Matchmaking is made on the senior player of the pair, which means the lobby you land in reflects your partner rather than you, and each player gains or loses LP according to their own current tier. That is the opposite of standard TFT ranked and of the League Solo/Duo queue, where the gap between two accounts is capped.',
        'Two things follow from that. The lobbies will be harder than the ones you normally play, so expect stronger contested comps and fewer free eighth-place opponents. And the LP you earn still belongs to your tier, so a climb is a real climb. Double Up is priced by your own rank for the same reason: {{rank_duo1_low}} players pay {{p_duo1_low}} per game and {{rank_duo1_high}} players pay {{p_duo1_high}}, because a harder lobby needs a stronger partner.',
      ],
    },
    {
      heading: 'Double Up or Board Coach: which TFT booking helps more?',
      paragraphs: [
        'Double Up is the two-player mode where both players run a board and can send units, gold or items across. A Master+ partner takes the aggressive line while you play the safer one, and the pair places together, so the help arrives inside the game. Three games at {{rank_duo1}} cost {{p_duo1_x3}} with {{pct3}} off.',
        'Board Coach is the other shape of help, and the one to pick if the goal is learning rather than placement. You play your own ranked game while a Master+ player watches your screen on Discord and says what to buy, roll and position in real time, at a flat {{p_duo2}} per game. A player who always rolls at the wrong level hears it in the moment instead of reading it in a replay three days later. Pick the goal first and the mode second, then agree whether the evening is for LP or for learning, because the two lines diverge at stage four.',
      ],
    },
    {
      heading: 'Example evening: three Double Up games on EUW',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo1}} player on EUW books 3 Double Up games. The total is {{p_duo1_x3}} with the {{pct3}} bundle discount, against {{p_duo1}} for a single game. The order chat opens straight after payment, and the first message names the server, the rank and the weakness: EUW, {{rank_duo1}}, keeps levelling too late, wants help reading the lobby.',
        'From there the evening runs on a short plan. You agree who commits to the contested comp, voice goes on, and you add each other by Riot ID. After each game you pick one adjustment, such as rolling at level seven instead of eight. The same shape works for Normals and Hyper Roll at {{p_norm}} per game if you would rather play with no LP on the line, and 5 games of anything take {{pct5}} off.',
      ],
    },
    {
      heading: 'When is TFT coaching the better booking?',
      paragraphs: [
        'TFT coaching is the better booking when the goal is a repeatable fix rather than a partner for the next lobby. Comp and Econ Review is one hour with a Master+ coach on comps that suit you, roll and level timing, and gold management from stage two, at {{p_econ}} per hour. Coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to Double Up, Board Coach and casual games only.',
        'A player who finishes fifth every lobby gains more from that hour than from three more games, because fifth place is usually one economy habit rather than bad luck. A player who mostly wants company gains more from Normals and Hyper Roll at {{p_norm}} per game. Set rotations from Riot Games change the comps every few months, so say which set you have been playing. The full lesson list, preparation tips and formats live on the [Teamfight Tactics coaching page](/games/teamfight-tactics/coaching).',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about TFT sessions?',
    items: [
      [
        'Is Duoly a free TFT partner finder?',
        'Duoly is a paid marketplace with reviewed players. Discord LFG channels and the in-game friend list from Riot Games stay the free routes to a partner.',
      ],
      [
        'How much does a TFT session cost?',
        'Double Up is {{p_duo1}} per game at {{rank_duo1}}, from {{p_duo1_low}} at the lowest rank. Bundles take {{pct3}} off 3 games, and 10 games cost {{p_duo1_x10}} with {{pct10}} off.',
      ],
      [
        'What is Board Coach exactly?',
        'Board Coach is a live session where you play your own ranked game and a Master+ player watches your screen on Discord, calling buys, rolls and positioning.',
      ],
      [
        'Can a Master+ partner queue ranked Double Up with me?',
        'Yes. Riot Games sets no rank limit on ranked Double Up. Matchmaking uses the senior player of the pair, and each of you gains LP by your own tier.',
      ],
      [
        'Does my partner play on my account?',
        'No. You play on your own account and add each other by Riot ID. Never send login details to anyone, including a partner or a coach.',
      ],
      [
        'Where do I book TFT coaching?',
        'On the Teamfight Tactics coaching page, with the Comp and Econ Review by the hour and the preparation checklist for your first lesson.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next TFT lobby?',
    text: 'Double Up is the two-player session with a Master+ partner from Duoly, and 3 games at {{rank_duo1}} cost {{p_duo1_x3}} with {{pct3}} off. Normals and Hyper Roll stays {{p_norm}} per game with no LP on the line. Pick your server and rank, then agree the plan with your partner in the order chat.',
  },
};
