import type { HubPageCopy } from '../hub-pages';

export const teamfightTactics: HubPageCopy = {
  gameSlug: 'teamfight-tactics',
  title: 'TFT Double Up Partner and Live Board Coaching | Duoly',
  description:
    'Book a Teamfight Tactics Double Up partner, a live board coach or a comp review on Duoly, {{from_lower}}. Compare TFT session prices.',
  eyebrow: 'Teamfight Tactics partners',
  h1: 'TFT: find a Double Up partner or a board coach',
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
    text: 'A Duoly Teamfight Tactics booking is a paid session where a reviewed Master+ player joins your lobby or watches your board on your own account. Double Up is the two-player mode where you plan boards together and send help at the right moment, priced by your own rank, so a {{rank_duo1}} player pays {{p_duo1}} per game in November 2026. Board Coach is the live option at {{p_duo2}} per game: you play your ranked game while a Master+ player watches your screen and says what to buy, roll and position. For example, Normals and Hyper Roll costs {{p_norm}} per game at every rank. Bundles cut the total: 3 games get {{pct3}} off, 5 get {{pct5}} off and 10 get {{pct10}} off. Set rotations from Riot Games change the comps, never the format. Finally, every booking opens an order chat, where you agree the plan and voice using Discord.',
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
      'A partner either plays the lobby with you in Double Up or watches your board live on Discord.',
    coaching:
      'The lesson runs for one hour on Discord, with your own boards and replays on screen.',
  },
  steps: {
    heading: 'How does booking a TFT session work?',
    items: [
      'First, pick a service and the number of games. Double Up is the two-player mode with a Master+ partner, and 3 games at {{rank_duo1}} cost {{p_duo1_x3}} with the {{pct3}} bundle discount. Five games get {{pct5}} off.',
      'Second, add your server, rank and language at checkout. For example, name EUW and {{rank_duo1}}, so your partner reads the real request from Duoly and knows which lobby strength to expect.',
      'Third, meet your partner in the order chat, agree a plan and voice using Discord, then invite each other with your Riot ID. Board Coach costs {{p_duo2}} per game with live screen share in 2026. Ten games get {{pct10}} off.',
    ],
    note: 'Duoly reviews every TFT partner before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which TFT session fits you?',
    intro:
      'The right TFT session is the one matching your goal for the evening, so pick the goal first and let the price follow. For example, a {{rank_duo1}} player who wants live calls pays {{p_duo2}} per game for Board Coach in 2026, with {{pct3}} off 3 games and {{pct5}} off 5. Screen share runs using Discord on every session from Duoly.',
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
      heading: 'Double Up or Board Coach: which TFT booking helps more?',
      paragraphs: [
        'Double Up is the two-player TFT mode where both players run a board and can send units, gold or items across. A Master+ partner handles the aggressive line while you play the safer one, and the pair climbs together. Double Up is priced by your own rank, so a {{rank_duo1}} player pays {{p_duo1}} per game in 2026 and a {{rank_duo1_high}} player pays {{p_duo1_high}}, because higher lobbies need stronger partners.',
        'Board Coach is the other shape of help, at {{p_duo2}} per game in 2026. Three games cost {{p_duo2_x3}} with {{pct3}} off. You play your own ranked game while a Master+ player watches your screen using Discord and says what to buy, roll and position in real time. For example, a player who always rolls at the wrong level learns faster from live calls than from a replay. First, pick the goal. Second, pick the mode. Finally, bundles take {{pct3}} off 3 games or {{pct5}} off 5.',
      ],
    },
    {
      heading: 'What should you tell your TFT partner first?',
      paragraphs: [
        'The useful first message is a short line naming your server, your rank and the comps you actually know. For example: EUW, {{rank_duo1}}, comfortable with reroll lines, bad at knowing when to level eight. A partner can plan around a stated weakness in 2026, and a Board Coach can watch for exactly that moment. Board Coach costs {{p_duo2}} per game. Set rotations from Riot Games change the comps every few months, so say which set you have been playing.',
        'Then agree how the session runs. First, agree whether the goal is LP or learning, because the two lines diverge at stage four. Second, agree who commits to the contested comp in Double Up. Finally, keep calls short using Discord and name the next decision rather than the last fight. Double Up costs {{p_duo1}} per game at {{rank_duo1}} in 2026, with {{pct3}} off 3 games and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three Double Up games on EUW',
      paragraphs: [
        'For example, here is a real booking, priced with the Duoly checkout calculator on {{checked}}. A {{rank_duo1}} player on EUW books 3 Double Up games. The total is {{p_duo1_x3}} with the {{pct3}} bundle discount, against {{p_duo1}} for one game. The order chat opens straight after payment, and the first message names the server, the rank and the weakness: EUW, {{rank_duo1}}, keeps levelling too late, wants help reading the lobby.',
        'The evening then runs on a short plan. First, both players agree who takes the contested line. Second, voice goes on using Discord and the invite goes out with the Riot ID. Third, after each game you agree one adjustment, such as rolling at level seven instead of eight. We found the rank spread by running the price tool from Duoly for every tier, so {{rank_duo1_low}} players pay {{p_duo1_low}} in 2026. Five games take {{pct5}} off.',
      ],
    },
    {
      heading: 'When is TFT coaching the better booking?',
      paragraphs: [
        'TFT coaching is the better booking when the goal is a repeatable fix rather than a partner for the next lobby. Comp and Econ Review is one hour with a Master+ coach on comps that suit you, roll and level timing, and gold management from stage two, at {{p_econ}} per hour in 2026. Finally, coaching carries no bundle discount, so the {{pct3}} and {{pct5}} savings apply to Double Up, Board Coach and casual games only.',
        'For example, a player who finishes fifth every lobby gains more from one econ hour than from three more games. Finally, a player who wants company gains more from Normals and Hyper Roll at {{p_norm}} per game, using Discord for voice. The full lesson list, preparation tips and formats live on the [Teamfight Tactics coaching page](/games/teamfight-tactics/coaching), and every lesson uses Discord screen share so the coach sees your real board.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about TFT sessions?',
    items: [
      [
        'Is Duoly a free TFT partner finder?',
        'Duoly is a paid marketplace with reviewed players. For example, Discord LFG channels and the in-game friend list from Riot Games stay the free routes to a partner.',
      ],
      [
        'How much does a TFT session cost?',
        'Double Up is {{p_duo1}} per game at {{rank_duo1}} in 2026. First, bundles take {{pct3}} off 3 games, and 10 games cost {{p_duo1_x10}} with {{pct10}} off.',
      ],
      [
        'What is Board Coach exactly?',
        'Board Coach is a live session where you play your own ranked game and a Master+ player watches your screen on Discord, calling buys, rolls and positioning.',
      ],
      [
        'Does my partner play on my account?',
        'No. You play on your own account and invite each other with your Riot ID. Never send login details to anyone, including a partner or a coach.',
      ],
      [
        'Can we play casual lobbies instead?',
        'Yes. Normals and Hyper Roll is its own flat-price service at {{p_norm}} per game, which suits a relaxed evening using Discord.',
      ],
      [
        'Where do I book TFT coaching?',
        'On the Teamfight Tactics coaching page, with the Comp and Econ Review by the hour and the preparation checklist for your first lesson.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next TFT lobby?',
    text: 'Double Up is the two-player session with a Master+ partner from Duoly. For example, 3 games at {{rank_duo1}} cost {{p_duo1_x3}} with {{pct3}} off in 2026. Five games get {{pct5}} off. Finally, agree your plan using Discord and invite each other with your Riot ID.',
  },
};
