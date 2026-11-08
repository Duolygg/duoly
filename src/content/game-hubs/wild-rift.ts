import type { HubPageCopy } from '../hub-pages';

export const wildRift: HubPageCopy = {
  gameSlug: 'wild-rift',
  title: 'Wild Rift Duo Partners: Ranked and Coaching | Duoly',
  description:
    'Book a Wild Rift duo partner for ranked, a full five or champion coaching on Duoly, {{from_lower}}. Compare ranked and ARAM prices.',
  eyebrow: 'Wild Rift teammates',
  h1: 'Wild Rift teammates for ranked, ARAM and coaching',
  lead: 'Discord LFG channels work for meeting a regular duo. Duoly books a reviewed Diamond, Master or Grandmaster player for your next ranked games, fills a full five and sells champion coaching.',
  cta: 'Book a Wild Rift teammate',
  facts: [
    'Diamond+ to Grandmaster+ teammates',
    'Ranked, ARAM and normal matches',
    'Voice on Discord, your own account',
  ],
  related: ['league-of-legends', 'pokemon-unite', 'dota-2'],
  format: {
    heading: 'What can you book for Wild Rift on Duoly?',
    text: 'Duoly sells three things for Wild Rift: one teammate who joins your lobby on your own account, a Ranked 5-Stack fill for the seats you are missing, and coaching. Duo Plus brings a Diamond+ player in the lane you need, Duo Pro a Master player who calls dragons and Baron, and Duo Apex a Grandmaster, Challenger or Sovereign player. Ranked follows your own rank, from {{p_duo2_low}} to {{p_duo2_high}} per game on Duo Pro, while ARAM stays {{p_aram}} per game at every rank. Games are short, so bundles matter: {{pct3}} off 3 games up to {{pct10}} off 10.',
  },
  services: {
    duo1: 'Ranked with a Diamond player who tracks the jungler and calls dragons.',
    duo2: 'Ranked with a Master player who shot-calls fights and the next objective.',
    duo3: 'Ranked with a Grandmaster or higher player who can take over a match.',
    aram: 'ARAM with a strong teammate: random champions, one lane, nonstop fights.',
    norm: 'Normal matches to try a new champion or lane with backup.',
    gg1v1:
      'A mid lane 1v1 against a verified Gamer Girl, rematches encouraged.',
    ggbuddy:
      'A patient Gamer Girl plays with you and explains the basics as you go.',
    gghype:
      'A verified Gamer Girl watches your Discord stream and cheers every play.',
    five: 'Fill your five with Master+ players on the lanes you need, on voice.',
    learn:
      'One live ranked game with a Master coach explaining every decision out loud.',
    champ:
      'One hour on one champion: combos, builds, matchups and power spikes.',
  },
  intros: {
    teammate:
      'Teammate prices are per game, and the ranked tiers read your own rank, so a Sovereign lobby costs more than an Iron one. ARAM and normal matches hold one price for everybody, because neither moves your rank. One teammate joins your lobby on your own account and takes the lane you ask for, and bundles take {{pct3}} off 3 games or {{pct5}} off 5. A tier name says who Duoly hires, never who may queue beside you: the ranked party rules come from Riot Games, so the teammate has to be eligible to queue with you under the rules of the game. Check the lobby in the client before the first game.',
    team: 'Ranked 5-Stack is priced per seat, so the card covers up to {{seats_five}} seats and falls when your group is only one player short. It reads your rank like the duo tiers, and bundles take {{pct3}} off 3 games.',
    coaching:
      'Lessons get no bundle discount, so the {{pct3}} and {{pct5}} savings on teammate sessions do not apply. Champion Mastery is one clock hour on Discord, and Play and Learn covers one live ranked game instead.',
  },
  steps: {
    heading: 'How does booking a Wild Rift teammate work?',
    items: [
      'Pick a service and the number of games. Duo Pro is the ranked tier with a Master teammate, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with the {{pct3}} bundle discount. Five games take {{pct5}} off.',
      'Add your area, rank, lane and language at checkout. Name Europe, {{rank_duo2}} and Dragon Lane, so your teammate reads the real request before accepting the order.',
      'Meet your teammate in the order chat, add each other by Riot ID and agree who plays which lane. A single Duo Pro game costs {{p_duo2}} at the same rank.',
    ],
    note: 'Duoly reviews every Wild Rift teammate before any order goes live. See the [payment and refund terms](/terms), read the [privacy policy](/privacy) for what gets stored, or [contact support](/contact) any time.',
  },
  decide: {
    heading: 'Which Wild Rift session fits you?',
    intro:
      'The right Wild Rift session is the one that matches your goal for the evening, so pick the goal first and let the price follow. Ranked is priced by your own rank, from {{p_duo2_low}} per game on Duo Pro, with {{pct3}} off 3 games and {{pct5}} off 5. ARAM and normal matches carry no rank.',
    picks: [
      {
        goal: 'Climbing ranked this season?',
        service: 'duo2',
        answer:
          'Duo Pro adds a Master teammate from {{p_duo2_low}} per game, priced by your own rank.',
      },
      {
        goal: 'Pushing for Grandmaster or higher?',
        service: 'duo3',
        answer:
          'Duo Apex brings a Grandmaster or higher player, {{p_duo3}} per game at {{rank_duo3}}.',
      },
      {
        goal: 'Just want quick fun games?',
        service: 'aram',
        answer:
          'ARAM costs {{p_aram}} per game at every rank, with nonstop teamfights.',
      },
      {
        goal: 'Want a full five on voice?',
        service: 'five',
        answer:
          'Ranked 5-Stack covers up to {{seats_five}} seats with Master+ players on the lanes you name.',
      },
      {
        goal: 'Learning a new main?',
        service: 'champ',
        answer:
          'Champion Mastery is one hour with a Grandmaster+ coach on one champion, at {{p_champ}}.',
      },
    ],
  },
  sections: [
    {
      heading: 'Who is the teammate you queue with?',
      paragraphs: [
        'Every Duoly Wild Rift teammate applied for the game and showed a rank before taking orders. Duo Plus names a Diamond+ player, Duo Pro a Master player and Duo Apex a Grandmaster or higher player. The tier describes the teammate you are hiring, not your own lobby. Tell your teammate your rank and your lane in the order chat, so you both know the duo can queue ranked together before the first game.',
        'What the rank buys you is objective calls. A Master teammate tracks the enemy jungler, calls the dragon before it spawns and says when Baron is safe to start. Voice runs on Discord, so the call lands while the fight is still winnable. Your rank also sets the price: Duo Pro runs {{p_duo2_low}} per game at {{rank_duo2_low}} and {{p_duo2_high}} at {{rank_duo2_high}}, because higher lobbies need stronger teammates. You keep your champions and your account.',
      ],
    },
    {
      heading: 'How does a Wild Rift 5-Stack fill work?',
      paragraphs: [
        'A Ranked 5-Stack is one order that hires several players at once, so a part-full group becomes a complete five. The fill covers up to {{seats_five}} empty seats with Master+ players at {{p_five}} per game at {{rank_five}}, and 5 games cost {{p_five_x5}} with {{pick5}} off. Every seat is priced separately, so a duo short three players books three seats instead of four.',
        'Agree the lanes before the draft: Baron Lane, Jungle, Mid, Dragon Lane and Support. Then agree one shotcaller, because five people calling Baron on voice is how a won game gets thrown. Keep everybody on one Discord call. Bundles still apply, {{pct3}} off 3 games and {{pct5}} off 5.',
      ],
    },
    {
      heading: 'Example evening: three Duo Pro games in Europe',
      paragraphs: [
        'Here is an example evening, priced with the Duoly checkout calculator on {{checked}}. A player at {{rank_duo2}} in Europe books 3 Duo Pro games with a Master teammate. The total is {{p_duo2_x3}} with the {{pct3}} bundle discount, against {{p_duo2}} for one game. The order chat opens straight after payment, and the first message names the area, the rank and the lane: Europe, {{rank_duo2}}, Dragon Lane, looking for a support who roams.',
        'From there the evening runs on a short plan. You agree a lane pairing and two champions each, voice goes on, and the invite goes out by Riot ID. After each game you pick one change, such as grouping for the second dragon instead of farming the side lane. Five games take {{pct5}} off the total.',
      ],
    },
    {
      heading: 'When is Wild Rift coaching the better booking?',
      paragraphs: [
        'Wild Rift coaching is the better booking when the goal is a fix you can repeat, not company for the next game. Champion Mastery is one hour with a Grandmaster+ coach on one champion, its combos, builds, matchups and power spikes, at {{p_champ}} per hour. Coaching carries no bundle discount.',
        'A player who loses lane to the same matchup every game gains more from one mastery hour than from three more ranked games. A player who wants to relax gains more from ARAM at {{p_aram}} per game. Play and Learn is one live ranked game with a Master coach at {{p_learn}}, and screen share runs on Discord.',
      ],
    },
  ],
  faq: {
    heading: 'What do players ask about Wild Rift sessions?',
    items: [
      [
        'Is Duoly a free Wild Rift duo finder?',
        'No. Duoly is a paid marketplace with reviewed players. Discord LFG channels and your friends list stay the free routes to a regular duo.',
      ],
      [
        'How much does a Wild Rift teammate cost?',
        'Duo Pro is {{p_duo2}} per game at {{rank_duo2}}, from {{p_duo2_low}} at the lowest rank. Bundles take {{pct3}} off 3 games, and 10 games cost {{p_duo2_x10}} with {{pct10}} off.',
      ],
      [
        'Is this Wild Rift or League of Legends on PC?',
        'Wild Rift, the mobile game. Duoly sells League of Legends on PC separately, on its own page with its own teammates.',
      ],
      [
        'Can I choose my lane?',
        'Yes. Pick Baron Lane, Jungle, Mid, Dragon Lane or Support at checkout, or leave it on Fill, and your teammate plays around it.',
      ],
      [
        'Does my teammate play on my account?',
        'No. Your teammate plays on their own account in your lobby, and you play on yours. Nobody asks for your login.',
      ],
      [
        'Does a teammate booking fill my whole team?',
        'No. A duo adds one teammate, and the other seats come from your friends or the queue. Book a Ranked 5-Stack when you want several at once.',
      ],
    ],
  },
  closing: {
    heading: 'Ready for your next Wild Rift game?',
    text: 'Duo Pro is the ranked tier with a Master teammate from Duoly, and 3 games at {{rank_duo2}} cost {{p_duo2_x3}} with {{pct3}} off. ARAM stays {{p_aram}} per game at any rank. Agree your lanes on Discord before the draft.',
  },
};
